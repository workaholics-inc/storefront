import { revalidatePath } from "next/cache";
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
import {
  removeEmail,
  startAddEmail,
  verifyAddEmail,
} from "@/app/[locale]/me/account/actions";
import { SignInMethods } from "@/components/member/sign-in-methods";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { codeSent, initialFormState } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation";
import contract from "../contract/openapi.json";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;
type IdentitySummary = components["schemas"]["IdentitySummary"];

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

// The list the account page shows: Telegram, then email with the address.
const IDENTITIES = contract.components.schemas.IdentityList.example;
const TELEGRAM = IDENTITIES.items[0] as IdentitySummary;
const EMAIL = IDENTITIES.items[1] as IdentitySummary;

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
  vi.mocked(revalidatePath).mockClear();
  vi.stubEnv("SITE_URL", "https://workaholics.example");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const EXPIRED = {
  fa: "/sign-in?error=session_required&next=%2Fme%2Faccount",
  en: "/en/sign-in?error=session_required&next=%2Fen%2Fme%2Faccount",
};

const START_CALL = [
  {
    method: "POST",
    path: "/v1/me/identities/email",
    init: { body: { address: ADDRESS } },
  },
];

const VERIFY_CALL = [
  {
    method: "POST",
    path: "/v1/me/identities/email/verify",
    init: { body: { code: CODE } },
  },
];

const REMOVE_CALL = [{ method: "DELETE", path: "/v1/me/identities/email", init: undefined }];

const REVALIDATED = [["/[locale]/me/account", "page"]];

describe("the contract examples this file relies on", () => {
  it("has the identity list the account page will show", () => {
    expect(IDENTITIES.items.map((item) => [item.provider, item.address])).toStrictEqual([
      ["telegram", null],
      ["email", ADDRESS],
    ]);
  });
});

describe("startAddEmail", () => {
  const call = (fields: Record<string, string>, locale = "fa") =>
    outcome(startAddEmail(locale, initialFormState, formOf(fields)));

  it("sends the checked address and moves to the code step", async () => {
    h.answer = ok(undefined, 202);

    const result = await call({ address: "  Sara@Example.TEST " });

    expect(result).toStrictEqual({ state: codeSent(ADDRESS) });
    expect(h.calls).toStrictEqual(START_CALL);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("asks for the address and sends nothing when it is empty", async () => {
    h.answer = ok(undefined, 202);

    const result = await call({ address: "" });

    expect(result).toStrictEqual({
      state: { errors: { address: { key: "required" } }, values: { address: "" } },
    });
    expect(h.calls).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [400, "validation_failed", { errors: { address: { key: "emailInvalid" } } }],
    [409, "identity_in_use", { errors: {}, formError: "identity_in_use" }],
    [409, "identity_already_connected", { errors: {}, formError: "identity_already_connected" }],
    [429, "rate_limited", { errors: {}, formError: "rate_limited" }],
    [503, "sign_in_method_unavailable", { errors: {}, formError: "sign_in_method_unavailable" }],
    [401, "storefront_key_invalid", { errors: {}, formError: "internal_error" }],
  ])("maps a %s %s and keeps the form", async (status, code, expected) => {
    h.answer = fail(status, code);

    const result = await call({ address: ADDRESS });

    expect(result).toStrictEqual({ state: { ...expected, values: { address: ADDRESS } } });
    expect(h.calls).toStrictEqual(START_CALL);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    const result = await call({ address: ADDRESS });

    expect(result).toStrictEqual({
      state: { errors: {}, formError: "unreachable", values: { address: ADDRESS } },
    });
    expect(h.calls).toStrictEqual(START_CALL);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(locales)("deletes the session cookie and redirects to sign-in on session_required in %s", async (locale) => {
    h.answer = fail(401, "session_required");

    const result = await call({ address: ADDRESS }, locale);

    expect(result).toStrictEqual({ redirect: EXPIRED[locale] });
    expect(h.calls).toStrictEqual(START_CALL);
    expect(h.deleted).toStrictEqual(["wh_session"]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("verifyAddEmail", () => {
  const call = (fields: Record<string, string>, locale = "fa") =>
    outcome(verifyAddEmail(locale, initialFormState, formOf(fields)));

  it.each([
    ["fa", "/me/account?email=added"],
    ["en", "/en/me/account?email=added"],
  ])("connects the address and redirects with the added notice in %s", async (locale, path) => {
    h.answer = ok(IDENTITIES);

    const result = await call({ code: CODE }, locale);

    expect(result).toStrictEqual({ redirect: path });
    expect(h.calls).toStrictEqual(VERIFY_CALL);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual(REVALIDATED);
  });

  it("sends the checked code, not the raw one", async () => {
    h.answer = ok(IDENTITIES);

    await call({ code: "۱۲۳۴۵۶" });

    expect(h.calls).toStrictEqual(VERIFY_CALL);
    expect(h.set).toStrictEqual([]);
  });

  it("refuses a code that is too short and sends nothing", async () => {
    h.answer = ok(IDENTITIES);

    const result = await call({ code: "12345" });

    expect(result).toStrictEqual({
      state: { errors: { code: { key: "codePattern" } }, values: { code: "12345" } },
    });
    expect(h.calls).toStrictEqual([]);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [400, "email_code_invalid", { errors: {}, formError: "email_code_invalid" }],
    [400, "validation_failed", { errors: { code: { key: "codePattern" } } }],
    [409, "identity_in_use", { errors: {}, formError: "identity_in_use" }],
    [409, "identity_already_connected", { errors: {}, formError: "identity_already_connected" }],
  ])("maps a %s %s and keeps the form", async (status, code, expected) => {
    h.answer = fail(status, code);

    const result = await call({ code: CODE });

    expect(result).toStrictEqual({ state: { ...expected, values: { code: CODE } } });
    expect(h.calls).toStrictEqual(VERIFY_CALL);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(locales)("deletes the session cookie and redirects to sign-in on session_required in %s", async (locale) => {
    h.answer = fail(401, "session_required");

    const result = await call({ code: CODE }, locale);

    expect(result).toStrictEqual({ redirect: EXPIRED[locale] });
    expect(h.calls).toStrictEqual(VERIFY_CALL);
    expect(h.deleted).toStrictEqual(["wh_session"]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removeEmail", () => {
  const call = (locale = "fa") => outcome(removeEmail(locale, initialFormState, formOf({})));

  it.each([
    ["fa", "/me/account?email=removed"],
    ["en", "/en/me/account?email=removed"],
  ])("removes the address and redirects with the removed notice in %s", async (locale, path) => {
    h.answer = ok({ items: [TELEGRAM] });

    const result = await call(locale);

    expect(result).toStrictEqual({ redirect: path });
    expect(h.calls).toStrictEqual(REMOVE_CALL);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(vi.mocked(revalidatePath).mock.calls).toStrictEqual(REVALIDATED);
  });

  it.each([
    [409, "last_identity", "last_identity"],
    [404, "not_found", "not_found"],
  ])("maps a %s %s and shows it", async (status, code, formError) => {
    h.answer = fail(status, code);

    const result = await call();

    expect(result).toStrictEqual({ state: { errors: {}, formError, values: {} } });
    expect(h.calls).toStrictEqual(REMOVE_CALL);
    expect(h.deleted).toStrictEqual([]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(locales)("deletes the session cookie and redirects to sign-in on session_required in %s", async (locale) => {
    h.answer = fail(401, "session_required");

    const result = await call(locale);

    expect(result).toStrictEqual({ redirect: EXPIRED[locale] });
    expect(h.calls).toStrictEqual(REMOVE_CALL);
    expect(h.deleted).toStrictEqual(["wh_session"]);
    expect(h.set).toStrictEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
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
const action = noop as unknown as ComponentProps<typeof SignInMethods>["startAdd"];

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

function decode(text: string) {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function textOf(source: string) {
  return decode(
    source
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

const inputsNamed = (html: string, name: string) =>
  openTags(html, "input").filter((input) => input.name === name);

function submitButtons(html: string) {
  return [...html.matchAll(/<button\s([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter((match) => attrsOf(match[1] ?? "").type === "submit")
    .map((match) => textOf(match[2] ?? ""));
}

function statuses(html: string) {
  return [...html.matchAll(/<[a-z0-9]+\s[^>]*role="status"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/g)].map(
    (match) => textOf(match[1] ?? ""),
  );
}

function itemsOf(html: string) {
  return html.split("<li").slice(1);
}

function dated(template: string, iso: string, locale: Locale) {
  return template.replace("{date}", formatDate(iso, locale));
}

describe("SignInMethods", () => {
  function render(
    locale: Locale,
    items: IdentitySummary[],
    props: Partial<ComponentProps<typeof SignInMethods>> = {},
  ) {
    return inLocale(
      locale,
      createElement(SignInMethods, {
        items,
        locale,
        notice: null,
        addressMax: LIMITS.emailAddressMax,
        startAdd: action,
        verifyAdd: action,
        remove: action,
        ...props,
      }),
    );
  }

  it.each(locales)("lists Telegram without a control, then the email with a remove button (%s)", (locale) => {
    const t = messages[locale].SignInMethods;
    const html = render(locale, IDENTITIES.items as IdentitySummary[]);
    const items = itemsOf(html);

    expect(items).toHaveLength(2);

    const telegram = textOf(items[0] ?? "");
    expect(telegram).toContain(t.telegram);
    expect(telegram).toContain(t.telegramNote);
    expect(telegram).toContain(dated(t.connectedOn, TELEGRAM.connectedAt, locale));
    expect(telegram).toContain(dated(t.lastUsed, TELEGRAM.lastUsedAt, locale));
    expect(items[0]).not.toContain("<form");
    expect(items[0]).not.toContain("<button");

    const email = items[1] ?? "";
    expect(email).toContain(`<bdi>${ADDRESS}</bdi>`);
    expect(textOf(email)).toContain((t.email.split("<n>")[0] ?? "").trim());
    expect(textOf(email)).toContain(dated(t.connectedOn, EMAIL.connectedAt, locale));
    expect(textOf(email)).toContain(dated(t.lastUsed, EMAIL.lastUsedAt, locale));
    expect([...email.matchAll(/<button type="submit"/g)]).toHaveLength(1);
    expect(submitButtons(email)).toStrictEqual([t.remove]);

    expect(html.split(ADDRESS)).toHaveLength(2);
    expect(inputsNamed(html, "address")).toStrictEqual([]);
  });

  it.each(locales)("offers the add form and no remove when only Telegram is connected (%s)", (locale) => {
    const t = messages[locale].SignInMethods;
    const html = render(locale, [TELEGRAM]);

    expect(itemsOf(html)).toHaveLength(1);
    expect(textOf(html)).not.toContain(t.remove);

    const text = textOf(html);
    expect(text).toContain(t.addTitle);
    expect(text).toContain(t.addHint);

    const address = inputsNamed(html, "address");
    expect(address).toHaveLength(1);
    expect(address[0]).toMatchObject({
      type: "email",
      dir: "ltr",
      maxlength: String(LIMITS.emailAddressMax),
    });

    const label = [...html.matchAll(/<label\s([^>]*)>([\s\S]*?)<\/label>/g)].filter(
      (match) => attrsOf(match[1] ?? "").for === address[0]?.id,
    );
    expect(label.map((match) => textOf(match[2] ?? ""))).toStrictEqual([t.addressLabel]);

    expect(submitButtons(html)).toStrictEqual([t.sendCode]);
    expect(inputsNamed(html, "code")).toStrictEqual([]);
  });

  it.each(locales)("explains why the only method has no remove, with no add form (%s)", (locale) => {
    const messagesOf = messages[locale];
    const html = render(locale, [EMAIL]);
    const items = itemsOf(html);

    expect(items).toHaveLength(1);
    expect(textOf(items[0] ?? "")).toContain(messagesOf.Errors.last_identity);
    expect(items[0]).not.toContain("<button");
    expect(html).not.toContain("<button");
    expect(inputsNamed(html, "address")).toStrictEqual([]);
    expect(textOf(html)).not.toContain(messagesOf.SignInMethods.addTitle);
  });

  it.each(
    locales.flatMap((locale) => (["added", "removed"] as const).map((notice) => [locale, notice] as const)),
  )("shows one status line for the %s %s notice", (locale, notice) => {
    const html = render(locale, IDENTITIES.items as IdentitySummary[], { notice });

    expect(statuses(html)).toStrictEqual([messages[locale].SignInMethods[notice]]);
    expect(html.split('role="status"')).toHaveLength(2);
  });

  it.each(locales)("shows no status line without a notice (%s)", (locale) => {
    const html = render(locale, IDENTITIES.items as IdentitySummary[]);

    expect(html).not.toContain('role="status"');
  });
});
