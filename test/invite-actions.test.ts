import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInvite,
  revokeInvite,
} from "@/app/[locale]/me/invites/actions";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";
import { formatDate } from "@/lib/format";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const h = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; init: unknown }[],
  answer: undefined as unknown,
  deleted: [] as string[],
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getPlatformClient: async () => {
    const call = (method: string) => async (path: string, init: unknown) => {
      h.calls.push({ method, path, init });
      if (h.answer instanceof Error) throw h.answer;
      return h.answer;
    };
    return {
      GET: call("GET"),
      PATCH: call("PATCH"),
      POST: call("POST"),
      PUT: call("PUT"),
      DELETE: call("DELETE"),
    };
  },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (path: string) => {
    throw Object.assign(new Error("redirect"), { path });
  },
}));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({
    delete: (name: string) => {
      h.deleted.push(name);
    },
    get: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const locales = ["fa", "en"] as const;

const INVITE_ID = "0199f1a2-7c3e-7a10-8000-000000000801";
const CODE = "t3st-c0de_Q7f";
const EXPIRES_AT = "2026-12-21T10:00:00.000Z";

function ok(data: unknown, status = 200): Answer {
  return { data, response: new Response(null, { status }) };
}

function fail(status: number, code: string): Answer {
  return {
    error: { error: { code, message: "ignored" } },
    response: new Response(null, { status }),
  };
}

function formOf(fields: Record<string, string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

type Outcome = { state: FormState } | { redirect: string };

async function outcome(run: Promise<FormState>): Promise<Outcome> {
  try {
    return { state: await run };
  } catch (error) {
    if (error instanceof Error && "path" in error) {
      return { redirect: String(error.path) };
    }
    throw error;
  }
}

beforeEach(() => {
  h.calls = [];
  h.answer = undefined;
  h.deleted = [];
  vi.mocked(revalidatePath).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("SITE_URL", "https://workaholics.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const created = (code = CODE) =>
  ok({ id: INVITE_ID, code, expiresAt: EXPIRES_AT }, 201);

const create = (locale: string) =>
  outcome(createInvite(locale, initialFormState, formOf({})));

const revoke = (locale: string, id = INVITE_ID) =>
  outcome(revokeInvite(locale, id, initialFormState, formOf({})));

const failedState = (formError: string): Outcome => ({
  state: { errors: {}, formError, values: {} },
});

const SIGN_IN = {
  fa: "/sign-in?error=session_required&next=%2Fme%2Finvites",
  en: "/en/sign-in?error=session_required&next=%2Fen%2Fme%2Finvites",
};

describe("createInvite", () => {
  it.each([
    ["fa", `https://workaholics.test/sign-in?invite=${CODE}`],
    ["en", `https://workaholics.test/en/sign-in?invite=${CODE}`],
  ] as const)(
    "creates an invite and returns the code once with its link and date (%s)",
    async (locale, link) => {
      h.answer = created();

      const result = await create(locale);

      expect(result).toStrictEqual({
        state: {
          errors: {},
          values: {
            code: CODE,
            link,
            validUntil: formatDate(EXPIRES_AT, locale),
          },
        },
      });
      expect(h.calls).toStrictEqual([
        { method: "POST", path: "/v1/invites", init: undefined },
      ]);
      expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([
        ["/[locale]/me/invites", "page"],
      ]);
      expect(h.deleted).toStrictEqual([]);
    },
  );

  it("encodes the code in the link and returns it unchanged", async () => {
    h.answer = created("a+b/c=d");

    const result = await create("fa");

    expect(result).toStrictEqual({
      state: {
        errors: {},
        values: {
          code: "a+b/c=d",
          link: "https://workaholics.test/sign-in?invite=a%2Bb%2Fc%3Dd",
          validUntil: formatDate(EXPIRES_AT, "fa"),
        },
      },
    });
  });

  it("builds the link from the origin of SITE_URL only", async () => {
    vi.stubEnv("SITE_URL", "https://workaholics.test/base/");
    h.answer = created();

    const result = await create("fa");

    expect(result).toStrictEqual({
      state: {
        errors: {},
        values: {
          code: CODE,
          link: `https://workaholics.test/sign-in?invite=${CODE}`,
          validUntil: formatDate(EXPIRES_AT, "fa"),
        },
      },
    });
  });

  it("falls back to the fa link for a bound locale that is not one", async () => {
    h.answer = created();

    const result = await create("//evil.example");

    expect(result).toStrictEqual({
      state: {
        errors: {},
        values: {
          code: CODE,
          link: `https://workaholics.test/sign-in?invite=${CODE}`,
          validUntil: formatDate(EXPIRES_AT, "fa"),
        },
      },
    });
  });

  it.each([
    [403, "on_probation", "on_probation"],
    [403, "forbidden", "not_project_owner"],
    [409, "invite_limit_reached", "invite_limit_reached"],
    [429, "rate_limited", "rate_limited"],
    [404, "not_found", "not_found"],
    [401, "storefront_key_invalid", "internal_error"],
    [500, "internal_error", "internal_error"],
  ])("maps a %s %s to %s and keeps the form", async (status, code, formError) => {
    h.answer = fail(status, code);

    const result = await create("fa");

    expect(result).toStrictEqual(failedState(formError));
    expect(h.calls).toStrictEqual([
      { method: "POST", path: "/v1/invites", init: undefined },
    ]);
    expect(h.deleted).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    const result = await create("fa");

    expect(result).toStrictEqual(failedState("unreachable"));
    expect(h.deleted).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
  });

  it.each(locales)(
    "deletes the session cookie and redirects to sign-in on session_required (%s)",
    async (locale) => {
      h.answer = fail(401, "session_required");

      const result = await create(locale);

      expect(result).toStrictEqual({ redirect: SIGN_IN[locale] });
      expect(h.deleted).toStrictEqual(["wh_session"]);
      expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
    },
  );
});

describe("revokeInvite", () => {
  it.each([
    ["fa", "/me/invites?revoked=1"],
    ["en", "/en/me/invites?revoked=1"],
  ] as const)(
    "revokes the invite and redirects to the list (%s)",
    async (locale, path) => {
      h.answer = ok(undefined, 204);

      const result = await revoke(locale);

      expect(result).toStrictEqual({ redirect: path });
      expect(h.calls).toStrictEqual([
        {
          method: "DELETE",
          path: "/v1/invites/{id}",
          init: { params: { path: { id: INVITE_ID } } },
        },
      ]);
      expect(h.deleted).toStrictEqual([]);
      expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
    },
  );

  it.each([
    ["an id that is not a UUID", "nope"],
    ["an id with a path in it", `${INVITE_ID}/../x`],
    ["an empty id", ""],
  ])("answers not_found without a call for %s", async (_name, id) => {
    h.answer = ok(undefined, 204);

    const result = await revoke("fa", id);

    expect(result).toStrictEqual(failedState("not_found"));
    expect(h.calls).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
  });

  it.each([
    [409, "invite_not_open", "invite_not_open"],
    [404, "not_found", "not_found"],
    [400, "validation_failed", "validation_failed"],
  ])("maps a %s %s to %s and keeps the form", async (status, code, formError) => {
    h.answer = fail(status, code);

    const result = await revoke("fa");

    expect(result).toStrictEqual(failedState(formError));
    expect(h.calls).toStrictEqual([
      {
        method: "DELETE",
        path: "/v1/invites/{id}",
        init: { params: { path: { id: INVITE_ID } } },
      },
    ]);
    expect(h.deleted).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    const result = await revoke("fa");

    expect(result).toStrictEqual(failedState("unreachable"));
    expect(h.deleted).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
  });

  it.each(locales)(
    "deletes the session cookie and redirects to sign-in on session_required (%s)",
    async (locale) => {
      h.answer = fail(401, "session_required");

      const result = await revoke(locale);

      expect(result).toStrictEqual({ redirect: SIGN_IN[locale] });
      expect(h.deleted).toStrictEqual(["wh_session"]);
      expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
    },
  );
});
