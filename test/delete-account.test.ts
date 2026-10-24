import { revalidatePath } from "next/cache";
import { NextIntlClientProvider } from "next-intl";
import {
  createElement,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { deleteAccount } from "@/app/[locale]/me/delete/actions";
import {
  DeleteAccountForm,
  SoleOwnerProjects,
  soleOwnerProjects,
} from "@/components/member/delete-account-form";
import type { Locale } from "@/i18n/routing";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation";

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

// `usePathname` is read by the locale-aware Link the form renders.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
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

const messages = { fa, en };
const locales = ["fa", "en"] as const;

const SESSION = "wh_session";

function ok(data: unknown, status = 200): Answer {
  return { data, response: new Response(null, { status }) };
}

function fail(status: number, code: string): Answer {
  return {
    error: { error: { code, message: "ignored" } },
    response: new Response(null, { status }),
  };
}

// A `sole_owner` refusal that names projects; `fail` carries no details.
function soleOwner(projects: unknown): Answer {
  return {
    error: {
      error: { code: "sole_owner", message: "ignored", details: { projects } },
    },
    response: new Response(null, { status: 409 }),
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
});

const DONE = {
  fa: "/me/delete?deleted=1",
  en: "/en/me/delete?deleted=1",
} as const;

const deleteCall = (confirm: string) => ({
  method: "DELETE",
  path: "/v1/me",
  init: { body: { confirm } },
});

describe("deleteAccount", () => {
  it.each(locales)(
    "deletes the account with the normalized handle, drops the session and redirects to the confirmation in %s",
    async (locale) => {
      h.answer = ok(undefined, 204);

      expect(
        await outcome(
          deleteAccount(locale, initialFormState, formOf({ confirm: "  Sara  " })),
        ),
      ).toStrictEqual({ redirect: DONE[locale] });
      expect(h.calls).toStrictEqual([deleteCall("sara")]);
      expect(h.deleted).toStrictEqual([SESSION]);
      expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
    },
  );

  it("treats an account that is already gone (404) as a success", async () => {
    h.answer = fail(404, "not_found");

    expect(
      await outcome(
        deleteAccount("fa", initialFormState, formOf({ confirm: "sara" })),
      ),
    ).toStrictEqual({ redirect: "/me/delete?deleted=1" });
    expect(h.calls).toStrictEqual([deleteCall("sara")]);
    expect(h.deleted).toStrictEqual([SESSION]);
  });

  it("normalizes Persian digits in the confirmation before sending it", async () => {
    h.answer = ok(undefined, 204);

    await outcome(
      deleteAccount("fa", initialFormState, formOf({ confirm: "sara۱۲" })),
    );

    expect(h.calls).toStrictEqual([deleteCall("sara12")]);
  });

  it.each([
    ["the longest handle", "s" + "a".repeat(29)],
    ["the shortest handle", "saa"],
  ])("sends %s to the platform", async (_name, handle) => {
    expect(LIMITS.handlePattern.test(handle)).toBe(true);
    h.answer = ok(undefined, 204);

    expect(
      await outcome(
        deleteAccount("fa", initialFormState, formOf({ confirm: handle })),
      ),
    ).toStrictEqual({ redirect: "/me/delete?deleted=1" });
    expect(h.calls).toStrictEqual([deleteCall(handle)]);
    expect(h.deleted).toStrictEqual([SESSION]);
  });

  it.each([
    ["no field", {}],
    ["an empty value", { confirm: "" }],
    ["a blank value", { confirm: "   " }],
  ])("requires the confirmation: %s", async (_name, fields) => {
    const form = formOf(fields);

    expect(
      await outcome(deleteAccount("fa", initialFormState, form)),
    ).toStrictEqual({
      state: { errors: { confirm: { key: "required" } }, values: fields },
    });
    expect(h.calls).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
  });

  it.each([
    ["too short", "sa"],
    ["too long", "s" + "a".repeat(30)],
    ["with a dash", "sara-x"],
    ["starting with a digit", "1sara"],
  ])(
    "reports a value that is not shaped like a handle as a mismatch: %s",
    async (_name, typed) => {
      expect(LIMITS.handlePattern.test(typed)).toBe(false);

      expect(
        await outcome(
          deleteAccount("fa", initialFormState, formOf({ confirm: typed })),
        ),
      ).toStrictEqual({
        state: {
          errors: {},
          formError: "confirm_mismatch",
          values: { confirm: typed },
        },
      });
      expect(h.calls).toStrictEqual([]);
      expect(h.deleted).toStrictEqual([]);
    },
  );

  it("keeps the session and returns the projects a sole owner must hand over", async () => {
    h.answer = soleOwner(["daftar", "kar-dasti"]);

    expect(
      await outcome(
        deleteAccount("fa", initialFormState, formOf({ confirm: "sara" })),
      ),
    ).toStrictEqual({
      state: {
        errors: {},
        formError: "sole_owner",
        values: { confirm: "sara", projects: "daftar,kar-dasti" },
      },
    });
    expect(h.calls).toStrictEqual([deleteCall("sara")]);
    expect(h.deleted).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
  });

  it("keeps only well-formed slugs from a sole_owner refusal", async () => {
    h.answer = soleOwner(["daftar", "../x", 7, "Kar"]);

    expect(
      await outcome(
        deleteAccount("fa", initialFormState, formOf({ confirm: "sara" })),
      ),
    ).toStrictEqual({
      state: {
        errors: {},
        formError: "sole_owner",
        values: { confirm: "sara", projects: "daftar" },
      },
    });
    expect(h.deleted).toStrictEqual([]);
  });

  it("returns no projects when a sole_owner refusal carries no details", async () => {
    h.answer = fail(409, "sole_owner");

    expect(
      await outcome(
        deleteAccount("fa", initialFormState, formOf({ confirm: "sara" })),
      ),
    ).toStrictEqual({
      state: {
        errors: {},
        formError: "sole_owner",
        values: { confirm: "sara", projects: "" },
      },
    });
    expect(h.deleted).toStrictEqual([]);
  });

  it("returns no projects when a sole_owner refusal names them as one string", async () => {
    h.answer = soleOwner("daftar");

    expect(
      await outcome(
        deleteAccount("fa", initialFormState, formOf({ confirm: "sara" })),
      ),
    ).toStrictEqual({
      state: {
        errors: {},
        formError: "sole_owner",
        values: { confirm: "sara", projects: "" },
      },
    });
    expect(h.deleted).toStrictEqual([]);
  });

  it.each([
    ["409 last_admins", fail(409, "last_admins"), "last_admins"],
    ["400 confirm_mismatch", fail(400, "confirm_mismatch"), "confirm_mismatch"],
    ["400 validation_failed", fail(400, "validation_failed"), "validation_failed"],
    ["401 storefront_key_invalid", fail(401, "storefront_key_invalid"), "internal_error"],
    ["a thrown error", new Error("connection refused"), "unreachable"],
  ])(
    "keeps the session and shows the platform failure: %s",
    async (_name, answer, formError) => {
      h.answer = answer;

      expect(
        await outcome(
          deleteAccount("fa", initialFormState, formOf({ confirm: "sara" })),
        ),
      ).toStrictEqual({
        state: { errors: {}, formError, values: { confirm: "sara" } },
      });
      expect(h.calls).toStrictEqual([deleteCall("sara")]);
      expect(h.deleted).toStrictEqual([]);
      expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual([]);
    },
  );

  it.each([
    ["fa", "/sign-in?error=session_required&next=%2Fme%2Fdelete"],
    ["en", "/en/sign-in?error=session_required&next=%2Fen%2Fme%2Fdelete"],
  ] as const)(
    "drops the session and sends an expired session to sign-in in %s",
    async (locale, redirect) => {
      h.answer = fail(401, "session_required");

      expect(
        await outcome(
          deleteAccount(locale, initialFormState, formOf({ confirm: "sara" })),
        ),
      ).toStrictEqual({ redirect });
      expect(h.calls).toStrictEqual([deleteCall("sara")]);
      expect(h.deleted).toStrictEqual([SESSION]);
    },
  );
});

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function inLocale(locale: Locale, ...children: ReactNode[]) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      ...children,
    ),
  );
}

// useActionState renders on the server, so this is the form's initial markup.
const noop = async (state: never) => state;
const action = noop as unknown as ComponentProps<typeof DeleteAccountForm>["action"];

type Attrs = Record<string, string>;

// React spells some attributes in camelCase (autoComplete, readOnly,
// maxLength); compare names case-insensitively.
function attrsOf(source: string): Attrs {
  const attrs: Attrs = {};

  for (const match of source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
    attrs[(match[1] ?? "").toLowerCase()] = match[2] ?? "";
  }

  return attrs;
}

function decode(text: string) {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function visibleText(html: string) {
  return decode(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function openTags(html: string, name: string): Attrs[] {
  return [...html.matchAll(new RegExp(`<${name}(\\s[^>]*)?>`, "g"))].map(
    (match) => attrsOf(match[1] ?? ""),
  );
}

const inputs = (html: string, name: string) =>
  openTags(html, "input").filter((input) => input.name === name);

function labelText(html: string, target: string) {
  const match = new RegExp(
    `<label[^>]*\\sfor="${target}"[^>]*>([\\s\\S]*?)</label>`,
  ).exec(html);

  return visibleText(match?.[1] ?? "");
}

function anchors(html: string) {
  return [...html.matchAll(/<a(\s[^>]*)?>([\s\S]*?)<\/a>/g)].map((match) => ({
    attrs: attrsOf(match[1] ?? ""),
    content: match[2] ?? "",
  }));
}

describe("soleOwnerProjects", () => {
  it("reads the slugs of a sole_owner refusal", () => {
    expect(
      soleOwnerProjects({
        errors: {},
        formError: "sole_owner",
        values: { projects: "daftar,kar-dasti" },
      }),
    ).toStrictEqual(["daftar", "kar-dasti"]);
  });

  it("reads no slugs from an empty or absent projects value", () => {
    expect(
      soleOwnerProjects({
        errors: {},
        formError: "sole_owner",
        values: { projects: "" },
      }),
    ).toStrictEqual([]);
    expect(
      soleOwnerProjects({ errors: {}, formError: "sole_owner", values: {} }),
    ).toStrictEqual([]);
  });

  it("ignores projects when the error is not sole_owner", () => {
    expect(
      soleOwnerProjects({
        errors: {},
        formError: "last_admins",
        values: { projects: "daftar" },
      }),
    ).toStrictEqual([]);
  });

  it("reads no slugs from the initial state", () => {
    expect(soleOwnerProjects(initialFormState)).toStrictEqual([]);
  });
});

describe("SoleOwnerProjects", () => {
  const slugs = ["daftar", "kar-dasti"];

  it.each(locales)("names the problem and links each project in %s", (locale) => {
    const html = inLocale(locale, createElement(SoleOwnerProjects, { slugs }));
    const copy = messages[locale].Deletion;
    const prefix = locale === "fa" ? "" : "/en";

    const text = visibleText(html);
    expect(text).toContain(copy.soleOwnerTitle);
    expect(text).toContain(copy.soleOwnerBody);

    expect(
      anchors(html).map(({ attrs, content }) => ({ href: attrs.href, content })),
    ).toStrictEqual([
      {
        href: `${prefix}/projects/daftar/edit`,
        content: '<bdi dir="ltr">daftar</bdi>',
      },
      {
        href: `${prefix}/projects/kar-dasti/edit`,
        content: '<bdi dir="ltr">kar-dasti</bdi>',
      },
    ]);
  });

  it.each(locales)("renders nothing without projects in %s", (locale) => {
    expect(
      inLocale(locale, createElement(SoleOwnerProjects, { slugs: [] })),
    ).toBe("");
  });
});

describe("DeleteAccountForm", () => {
  function form(locale: Locale) {
    return inLocale(
      locale,
      createElement(DeleteAccountForm, { action, handle: "sara" }),
    );
  }

  it.each(locales)("renders one empty, described confirmation input in %s", (locale) => {
    const html = form(locale);

    expect(openTags(html, "input")).toHaveLength(1);

    const [input] = inputs(html, "confirm");
    expect({
      name: input?.name,
      id: input?.id,
      dir: input?.dir,
      autocomplete: input?.autocomplete,
      value: input?.value,
      describedBy: input?.["aria-describedby"],
    }).toStrictEqual({
      name: "confirm",
      id: "delete-confirm",
      dir: "ltr",
      autocomplete: "off",
      value: "",
      describedBy: "delete-confirm-how",
    });
    expect(labelText(html, "delete-confirm")).toBe(
      messages[locale].Deletion.confirmLabel,
    );
  });

  it.each(locales)("tells the member which handle to type in %s", (locale) => {
    const html = form(locale);
    const hint = messages[locale].Deletion.confirmHint;
    expect(hint).toContain("<n>{handle}</n>");

    const paragraph = /<p id="delete-confirm-how"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    expect(paragraph).not.toBeNull();

    const inner = paragraph?.[1] ?? "";
    expect(visibleText(inner)).toBe(hint.replace("<n>{handle}</n>", "sara"));
    expect(inner).toMatch(/<bdi dir="ltr"[^>]*>sara<\/bdi>/);
  });

  it.each(locales)("renders one submit button in %s", (locale) => {
    const html = form(locale);

    const buttons = [...html.matchAll(/<button(\s[^>]*)?>([\s\S]*?)<\/button>/g)].map(
      (match) => ({
        type: attrsOf(match[1] ?? "").type,
        text: visibleText(match[2] ?? ""),
      }),
    );

    expect(buttons).toStrictEqual([
      { type: "submit", text: messages[locale].Deletion.submit },
    ]);
  });

  it.each(locales)("shows no refusal or error before a submit in %s", (locale) => {
    const html = form(locale);
    const text = visibleText(html);

    expect(text).not.toContain(messages[locale].Deletion.soleOwnerTitle);
    expect(html).not.toContain("delete-sole-owner");
    expect(html).not.toContain("delete-confirm-error");
    for (const message of Object.values(messages[locale].Errors)) {
      expect(text).not.toContain(message);
    }
  });
});
