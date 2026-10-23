import { NextIntlClientProvider } from "next-intl";
import {
  createElement,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { startEmailSignIn, verifyEmailSignIn } from "@/app/[locale]/sign-in/actions";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from "@/lib/cookies";
import type { FormState } from "@/lib/form-state";
import { codeSent, initialFormState, sentAddress } from "@/lib/form-state";
import { LIMITS, validateEmailAddress, validateEmailCode } from "@/lib/validation";
import contract from "../contract/openapi.json";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;
type SignInResponse = components["schemas"]["SignInResponse"];

const h = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; init: unknown }[],
  answer: undefined as unknown,
  deleted: [] as string[],
  set: [] as { name: string; value: string; options: unknown }[],
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
    set: (name: string, value: string, options: unknown) => {
      h.set.push({ name, value, options });
    },
    get: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const messages = { fa, en };
const locales = ["fa", "en"] as const;

const ADDRESS = "sara@example.test";
const CODE = "123456";
const TOKEN = "test-session-token-not-a-secret";

const SIGNED_IN: SignInResponse = {
  ...contract.components.schemas.SignInResponse.example,
  session: { token: TOKEN, expiresAt: "2027-01-06T10:00:00.000Z" },
  joined: false,
};

// The list the account page shows: Telegram, then email with the address.
const IDENTITIES = contract.components.schemas.IdentityList.example;

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
  h.set = [];
  vi.stubEnv("SITE_URL", "https://workaholics.example");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

const SESSION_SET = [{ name: "wh_session", value: TOKEN, options: SESSION_COOKIE_OPTIONS }];

const VERIFY_CALL = [
  {
    method: "POST",
    path: "/v1/auth/email/verify",
    init: { body: { address: ADDRESS, code: CODE } },
  },
];

const START_CALL = [
  { method: "POST", path: "/v1/auth/email/start", init: { body: { address: ADDRESS } } },
];

describe("the contract examples this file relies on", () => {
  it("has the identity list the account page will show", () => {
    expect(IDENTITIES.items.map((item) => [item.provider, item.address])).toStrictEqual([
      ["telegram", null],
      ["email", ADDRESS],
    ]);
  });
});

describe("validateEmailAddress", () => {
  it("trims and lowercases the address", () => {
    expect(validateEmailAddress(formOf({ address: "  Sara@Example.TEST " }))).toStrictEqual({
      ok: true,
      body: { address: ADDRESS },
    });
  });

  it.each([
    ["no field", {}, {}],
    ["blanks", { address: "   " }, { address: "   " }],
  ])("asks for the address when there is %s", (_name, fields, values) => {
    expect(validateEmailAddress(formOf(fields))).toStrictEqual({
      ok: false,
      state: { errors: { address: { key: "required" } }, values },
    });
  });

  it("accepts an address of exactly the limit", () => {
    const address = "a".repeat(LIMITS.emailAddressMax - "@example.test".length) + "@example.test";

    expect(address).toHaveLength(LIMITS.emailAddressMax);
    expect(validateEmailAddress(formOf({ address }))).toStrictEqual({
      ok: true,
      body: { address },
    });
  });

  it("refuses an address one character over the limit", () => {
    const address = "a".repeat(LIMITS.emailAddressMax - "@example.test".length + 1) + "@example.test";

    expect(validateEmailAddress(formOf({ address }))).toStrictEqual({
      ok: false,
      state: {
        errors: { address: { key: "tooLong", max: LIMITS.emailAddressMax } },
        values: { address },
      },
    });
  });

  it.each(["sara", "sara@", "@example.test", "sara@example", "sara @example.test", "sara@example.test@x.test"])(
    "refuses the malformed address %j",
    (address) => {
      expect(validateEmailAddress(formOf({ address }))).toStrictEqual({
        ok: false,
        state: { errors: { address: { key: "emailInvalid" } }, values: { address } },
      });
    },
  );
});

describe("validateEmailCode", () => {
  it.each(["123456", " 123456 ", "۱۲۳۴۵۶", "١٢٣٤٥٦"])("reads %j as the code", (code) => {
    expect(validateEmailCode(formOf({ code }))).toStrictEqual({
      ok: true,
      body: { code: CODE },
    });
  });

  it.each([
    ["no field", {}],
    ["an empty value", { code: "" }],
  ])("asks for the code when there is %s", (_name, fields) => {
    expect(validateEmailCode(formOf(fields))).toStrictEqual({
      ok: false,
      state: { errors: { code: { key: "required" } }, values: fields },
    });
  });

  it.each(["12345", "1234567", "12345a", "123 456"])("refuses the code %j", (code) => {
    expect(validateEmailCode(formOf({ code }))).toStrictEqual({
      ok: false,
      state: { errors: { code: { key: "codePattern" } }, values: { code } },
    });
  });
});

describe("codeSent and sentAddress", () => {
  it("marks the code step with the address it went to", () => {
    expect(codeSent(ADDRESS)).toStrictEqual({
      errors: {},
      values: { step: "code", address: ADDRESS },
    });
    expect(sentAddress(codeSent(ADDRESS))).toBe(ADDRESS);
  });

  it.each([
    ["the initial state", initialFormState],
    ["a code step with no address", { errors: {}, values: { step: "code" } }],
    ["a code step with an empty address", { errors: {}, values: { step: "code", address: "" } }],
    ["an address with no step", { errors: {}, values: { address: ADDRESS } }],
  ])("finds no address in %s", (_name, state) => {
    expect(sentAddress(state)).toBeNull();
  });
});

describe("startEmailSignIn", () => {
  const call = (fields: Record<string, string>) =>
    outcome(startEmailSignIn(initialFormState, formOf(fields)));

  it("sends the checked address and moves to the code step", async () => {
    h.answer = ok(undefined, 202);

    const result = await call({ address: "  Sara@Example.TEST " });

    expect(result).toStrictEqual({ state: codeSent(ADDRESS) });
    expect(h.calls).toStrictEqual(START_CALL);
    expect(h.set).toStrictEqual([]);
  });

  it("answers the same way for any address", async () => {
    h.answer = ok(undefined, 202);

    const result = await call({ address: "someone-else@example.test" });

    expect(result).toStrictEqual({ state: codeSent("someone-else@example.test") });
    expect(h.calls).toStrictEqual([
      {
        method: "POST",
        path: "/v1/auth/email/start",
        init: { body: { address: "someone-else@example.test" } },
      },
    ]);
    expect(h.set).toStrictEqual([]);
  });

  it.each([
    ["an empty address", "", { key: "required" }],
    ["a malformed address", "sara", { key: "emailInvalid" }],
  ])("sends nothing for %s", async (_name, address, error) => {
    h.answer = ok(undefined, 202);

    const result = await call({ address });

    expect(result).toStrictEqual({
      state: { errors: { address: error }, values: { address } },
    });
    expect(h.calls).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
  });

  it.each([
    [400, "validation_failed", { errors: { address: { key: "emailInvalid" } } }],
    [401, "storefront_key_invalid", { errors: {}, formError: "internal_error" }],
    [429, "rate_limited", { errors: {}, formError: "rate_limited" }],
    [503, "sign_in_method_unavailable", { errors: {}, formError: "sign_in_method_unavailable" }],
    [500, "internal_error", { errors: {}, formError: "internal_error" }],
  ])("maps a %s %s and keeps the form", async (status, code, expected) => {
    h.answer = fail(status, code);

    const result = await call({ address: ADDRESS });

    expect(result).toStrictEqual({ state: { ...expected, values: { address: ADDRESS } } });
    expect(h.calls).toStrictEqual(START_CALL);
    expect(h.set).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    const result = await call({ address: ADDRESS });

    expect(result).toStrictEqual({
      state: { errors: {}, formError: "unreachable", values: { address: ADDRESS } },
    });
    expect(h.set).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
  });
});

describe("verifyEmailSignIn", () => {
  const call = (fields: Record<string, string>, locale = "fa") =>
    outcome(verifyEmailSignIn(locale, initialFormState, formOf(fields)));

  it("sets the session cookie and goes to the next path", async () => {
    h.answer = ok(SIGNED_IN);

    const result = await call({ address: ADDRESS, code: CODE, next: "/projects/daftar" });

    expect(result).toStrictEqual({ redirect: "/projects/daftar" });
    expect(h.calls).toStrictEqual(VERIFY_CALL);
    expect(h.set).toStrictEqual(SESSION_SET);
    expect(h.deleted).toStrictEqual([]);
  });

  it("sets the cookie with the secure session options", () => {
    expect(SESSION_COOKIE_OPTIONS).toStrictEqual(sessionCookieOptions());
  });

  it.each([
    ["fa", "/projects"],
    ["en", "/en/projects"],
  ])("goes to the projects page in %s when there is no next path", async (locale, path) => {
    h.answer = ok(SIGNED_IN);

    const result = await call({ address: ADDRESS, code: CODE }, locale);

    expect(result).toStrictEqual({ redirect: path });
    expect(h.calls).toStrictEqual(VERIFY_CALL);
    expect(h.set).toStrictEqual(SESSION_SET);
  });

  it.each(["//evil.example", "https://evil.example/x"])(
    "ignores the next path %j, which is not a path on this site",
    async (next) => {
      h.answer = ok(SIGNED_IN);

      const result = await call({ address: ADDRESS, code: CODE, next });

      expect(result).toStrictEqual({ redirect: "/projects" });
      expect(h.set).toStrictEqual(SESSION_SET);
    },
  );

  it("falls back to the default locale for a bound locale that is a host", async () => {
    h.answer = ok(SIGNED_IN);

    const result = await call({ address: ADDRESS, code: CODE }, "//evil.example");

    expect(result).toStrictEqual({ redirect: "/projects" });
    expect(h.set).toStrictEqual(SESSION_SET);
  });

  it("does not send a member who just joined to the profile", async () => {
    h.answer = ok({ ...SIGNED_IN, joined: true });

    const result = await call({ address: ADDRESS, code: CODE, next: "/projects/daftar" });

    expect(result).toStrictEqual({ redirect: "/projects/daftar" });
    expect(h.set).toStrictEqual(SESSION_SET);
  });

  it("sends the checked address and code, not the raw ones", async () => {
    h.answer = ok(SIGNED_IN);

    await call({ address: "  Sara@Example.TEST ", code: "۱۲۳۴۵۶" });

    expect(h.calls).toStrictEqual(VERIFY_CALL);
  });

  it.each([
    ["no code", "", { key: "required" }],
    ["a code that is too short", "12345", { key: "codePattern" }],
    ["a code that is too long", "1234567", { key: "codePattern" }],
  ])("sends nothing for %s", async (_name, code, error) => {
    h.answer = ok(SIGNED_IN);
    const fields = { address: ADDRESS, code, next: "/projects/daftar" };

    const result = await call(fields);

    expect(result).toStrictEqual({ state: { errors: { code: error }, values: fields } });
    expect(h.calls).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
  });

  it.each([
    ["an empty address", ""],
    ["a malformed address", "sara"],
  ])("answers sign_in_failed without a call for %s", async (_name, address) => {
    h.answer = ok(SIGNED_IN);
    const fields = { address, code: CODE, next: "/projects/daftar" };

    const result = await call(fields);

    expect(result).toStrictEqual({
      state: { errors: {}, formError: "sign_in_failed", values: fields },
    });
    expect(h.calls).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
  });

  describe("when the platform refuses", () => {
    const fields = { address: ADDRESS, code: CODE, next: "/projects/daftar" };

    it.each([
      [400, "email_code_invalid", { errors: {}, formError: "email_code_invalid" }],
      [400, "validation_failed", { errors: { code: { key: "codePattern" } } }],
      [401, "storefront_key_invalid", { errors: {}, formError: "internal_error" }],
      [503, "sign_in_method_unavailable", { errors: {}, formError: "sign_in_method_unavailable" }],
    ])("maps a %s %s and keeps the form", async (status, code, expected) => {
      h.answer = fail(status, code);

      const result = await call(fields);

      expect(result).toStrictEqual({ state: { ...expected, values: fields } });
      expect(h.calls).toStrictEqual(VERIFY_CALL);
      expect(h.set).toStrictEqual([]);
      expect(h.deleted).toStrictEqual([]);
    });

    it("maps a call that throws to unreachable", async () => {
      h.answer = new Error("connect ECONNREFUSED");

      const result = await call(fields);

      expect(result).toStrictEqual({
        state: { errors: {}, formError: "unreachable", values: fields },
      });
      expect(h.set).toStrictEqual([]);
      expect(h.deleted).toStrictEqual([]);
    });
  });
});

// useActionState renders on the server, so these are first renders.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function inLocale(locale: Locale, child: ReactNode) {
  return renderToStaticMarkup(
    createElement(Provider, { locale, messages: messages[locale] }, child),
  );
}

const noop = async (state: never) => state;
const action = noop as unknown as ComponentProps<typeof EmailSignIn>["start"];

type Attrs = Record<string, string>;

// React writes autoComplete and maxLength; HTML attribute names are not case-sensitive.
function attrsOf(source: string): Attrs {
  const attrs: Attrs = {};

  for (const match of source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
    attrs[(match[1] ?? "").toLowerCase()] = match[2] ?? "";
  }

  return attrs;
}

function openTags(html: string, name: string): Attrs[] {
  return [...html.matchAll(new RegExp(`<${name}(\\s[^>]*)?>`, "g"))].map((match) =>
    attrsOf(match[1] ?? ""),
  );
}

function textOf(source: string) {
  return source
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("EmailSignIn", () => {
  function render(locale: Locale) {
    return inLocale(
      locale,
      createElement(EmailSignIn, {
        next: "/projects/daftar",
        addressMax: LIMITS.emailAddressMax,
        start: action,
        verify: action,
      }),
    );
  }

  it.each(locales)("starts with one address field and a send button (%s)", (locale) => {
    const html = render(locale);
    const t = messages[locale].Auth;
    const inputs = openTags(html, "input");
    const address = inputs.filter((input) => input.name === "address");

    expect(inputs).toHaveLength(1);
    expect(address).toHaveLength(1);
    expect(address[0]).toMatchObject({
      type: "email",
      dir: "ltr",
      autocomplete: "email",
      maxlength: String(LIMITS.emailAddressMax),
    });

    const label = [...html.matchAll(/<label\s([^>]*)>([\s\S]*?)<\/label>/g)].filter(
      (match) => attrsOf(match[1] ?? "").for === address[0]?.id,
    );
    expect(label.map((match) => textOf(match[2] ?? ""))).toStrictEqual([t.emailLabel]);

    const submits = [...html.matchAll(/<button\s([^>]*)>([\s\S]*?)<\/button>/g)].filter(
      (match) => attrsOf(match[1] ?? "").type === "submit",
    );
    expect(submits.map((match) => textOf(match[2] ?? ""))).toStrictEqual([t.emailSend]);
  });

  it.each(locales)("shows no code field and no status before a code is sent (%s)", (locale) => {
    const html = render(locale);

    expect(openTags(html, "input").filter((input) => input.name === "code")).toStrictEqual([]);
    expect(html).not.toContain('role="status"');
  });
});
