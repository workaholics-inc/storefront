import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileReport } from "@/app/[locale]/projects/[slug]/posts/[id]/actions";
import { reportNotice } from "@/components/moderation/report-form";
import { formFailure } from "@/lib/actions";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const h = vi.hoisted(() => ({
  posts: 0,
  last: undefined as { path: string; body: unknown } | undefined,
  answer: undefined as unknown,
  deleted: [] as string[],
  redirected: [] as string[],
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getPlatformClient: async () => ({
    POST: async (path: string, init: { body: unknown }) => {
      h.posts += 1;
      h.last = { path, body: init.body };
      if (h.answer instanceof Error) throw h.answer;
      return h.answer;
    },
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (path: string) => {
    h.redirected.push(path);
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

const SLUG = "daftar";
const POST_ID = "0199f1a2-7c3e-7a10-8000-000000000101";
const TARGET_ID = "0199f1a2-7c3e-7a10-8000-000000000203";
const REASON = "Off-topic advert (test)";

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

function file(
  fields: Record<string, string> = { reason: REASON },
  bound: { slug?: string; postId?: string; kind?: string; targetId?: string } = {},
) {
  return fileReport(
    "fa",
    bound.slug ?? SLUG,
    bound.postId ?? POST_ID,
    bound.kind ?? "feedback",
    bound.targetId ?? TARGET_ID,
    initialFormState,
    formOf(fields),
  );
}

beforeEach(() => {
  h.posts = 0;
  h.last = undefined;
  h.answer = undefined;
  h.deleted = [];
  h.redirected = [];
  vi.mocked(revalidatePath).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("fileReport", () => {
  it.each(["feedback", "post", "reply"])(
    "sends a %s report with the trimmed reason and answers sent",
    async (kind) => {
      h.answer = ok({ id: TARGET_ID }, 201);

      const result = await outcome(file({ reason: `  ${REASON}  ` }, { kind }));

      expect(result).toStrictEqual({
        state: { errors: {}, values: { report: "sent" } },
      });
      expect(h.posts).toBe(1);
      expect(h.last).toStrictEqual({
        path: "/v1/reports",
        body: { targetKind: kind, targetId: TARGET_ID, reason: REASON },
      });
      expect(h.redirected).toStrictEqual([]);
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a slug that is not a slug", { slug: "Daftar!" }],
    ["a post id that is not a UUID", { postId: "not-a-uuid" }],
    ["a target id that is not a UUID", { targetId: "not-a-uuid" }],
    ["a target kind that is not reportable", { kind: "case" }],
  ])("sends nothing and answers not_found for %s", async (_name, bound) => {
    h.answer = ok({ id: TARGET_ID }, 201);
    const fields = { reason: REASON };

    const result = await outcome(file(fields, bound));

    expect(result).toStrictEqual({ state: formFailure(formOf(fields), "not_found") });
    expect(h.posts).toBe(0);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("refuses a reason that is %s as required, sending nothing", async (_name, reason) => {
    h.answer = ok({ id: TARGET_ID }, 201);

    const result = await outcome(file({ reason }));

    expect(result).toMatchObject({
      state: { errors: { reason: { key: "required" } } },
    });
    expect(h.posts).toBe(0);
  });

  it("accepts a reason of exactly the maximum length", async () => {
    h.answer = ok({ id: TARGET_ID }, 201);
    const reason = "a".repeat(LIMITS.reportReasonMax);

    const result = await outcome(file({ reason }));

    expect(result).toStrictEqual({
      state: { errors: {}, values: { report: "sent" } },
    });
    expect(h.posts).toBe(1);
    expect(h.last?.body).toStrictEqual({
      targetKind: "feedback",
      targetId: TARGET_ID,
      reason,
    });
  });

  it("refuses a reason one character over the maximum, sending nothing", async () => {
    h.answer = ok({ id: TARGET_ID }, 201);

    const result = await outcome(
      file({ reason: "a".repeat(LIMITS.reportReasonMax + 1) }),
    );

    expect(result).toMatchObject({
      state: {
        errors: { reason: { key: "tooLong", max: LIMITS.reportReasonMax } },
      },
    });
    expect(h.posts).toBe(0);
  });

  it.each([
    [409, "already_reported", "already_reported"],
    [404, "not_found", "not_found"],
    [429, "rate_limited", "rate_limited"],
    [500, "internal_error", "internal_error"],
  ])("answers %i %s with the form error %s", async (status, code, formError) => {
    h.answer = fail(status, code);

    const result = await outcome(file({ reason: REASON }));

    expect(result).toStrictEqual({
      state: { errors: {}, formError, values: { reason: REASON } },
    });
    expect(h.deleted).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes the session cookie and redirects to sign-in on session_required", async () => {
    h.answer = fail(401, "session_required");

    const result = await outcome(file({ reason: REASON }));

    expect(result).toStrictEqual({
      redirect: `/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}`,
    });
    expect(h.deleted).toStrictEqual(["wh_session"]);
  });
});

describe("reportNotice", () => {
  it.each([
    ["a sent report", { errors: {}, values: { report: "sent" } }, "sent"],
    [
      "an already reported item",
      { errors: {}, formError: "already_reported", values: {} },
      "already_reported",
    ],
    [
      "a rate limit",
      { errors: {}, formError: "rate_limited", values: {} },
      null,
    ],
    ["the initial state", initialFormState, null],
    ["a report still sending", { errors: {}, values: { report: "sending" } }, null],
  ] satisfies [string, FormState, "sent" | "already_reported" | null][])(
    "reads %s as %s",
    (_name, state, expected) => {
      expect(reportNotice(state)).toBe(expected);
    },
  );
});
