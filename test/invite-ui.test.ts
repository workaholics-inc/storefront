import { NextIntlClientProvider } from "next-intl";
import {
  createElement,
  Fragment,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import {
  CreatedInvite,
  createdInvite,
  InviteCreate,
  RevokeInviteForm,
} from "@/components/member/invite-forms";
import { InviteList } from "@/components/member/invite-list";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { initialFormState, type FormState } from "@/lib/form-state";

type Invite = components["schemas"]["MyInvite"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

// useActionState renders on the server, so this is each form's initial markup.
function inLocale(locale: Locale, ...children: ReactNode[]) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(Fragment, null, ...children),
    ),
  );
}

const noop = async (state: never) => state;
const action = noop as unknown as ComponentProps<typeof InviteCreate>["action"];

type Attrs = Record<string, string>;

function attrsOf(source: string): Attrs {
  const attrs: Attrs = {};

  for (const match of source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
    attrs[match[1] ?? ""] = match[2] ?? "";
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

function labelText(html: string, target: string) {
  const match = new RegExp(
    `<label[^>]*\\sfor="${target}"[^>]*>([\\s\\S]*?)</label>`,
  ).exec(html);

  return visibleText(match?.[1] ?? "");
}

function buttons(html: string) {
  return [...html.matchAll(/<button(\s[^>]*)?>([\s\S]*?)<\/button>/g)].map(
    (match) => ({
      attrs: attrsOf(match[1] ?? ""),
      text: visibleText(match[2] ?? ""),
    }),
  );
}

// A message with arguments: `{name}` placeholders replaced, `<n>` tags dropped.
function fill(message: string, args: Record<string, string> = {}) {
  let text = message.replace(/<\/?n>/g, "");

  for (const [key, value] of Object.entries(args)) {
    text = text.replaceAll(`{${key}}`, value);
  }

  return text;
}

describe("createdInvite", () => {
  const view = { code: "c", link: "l", validUntil: "v" };

  it("reads the three values of a successful state", () => {
    expect(createdInvite({ errors: {}, values: view })).toStrictEqual(view);
  });

  it("ignores an extra value", () => {
    expect(
      createdInvite({ errors: {}, values: { ...view, other: "x" } }),
    ).toStrictEqual(view);
  });

  it("is null for the initial state", () => {
    expect(createdInvite(initialFormState)).toBeNull();
  });

  it.each(["code", "link", "validUntil"] as const)(
    "is null when %s is missing",
    (key) => {
      const values: Record<string, string> = { ...view };
      delete values[key];

      expect(createdInvite({ errors: {}, values })).toBeNull();
    },
  );

  it.each(["code", "link", "validUntil"] as const)(
    "is null when %s is empty",
    (key) => {
      expect(
        createdInvite({ errors: {}, values: { ...view, [key]: "" } }),
      ).toBeNull();
    },
  );

  it("is null for a failed state even with every value present", () => {
    const failed: FormState = {
      errors: {},
      formError: "rate_limited",
      values: view,
    };

    expect(createdInvite(failed)).toBeNull();
  });
});

describe("CreatedInvite", () => {
  const props = {
    code: "t3st-c0de_Q7f",
    link: "https://workaholics.test/sign-in?invite=t3st-c0de_Q7f",
    validUntil: "21 Dec",
  };
  const render = (locale: Locale) =>
    inLocale(locale, createElement(CreatedInvite, props));

  it.each(locales)("shows the title, the one-time note and the date (%s)", (locale) => {
    const t = messages[locale].Invites;
    const text = visibleText(render(locale));

    expect(text).toContain(t.createdTitle);
    expect(text).toContain(t.createdOnce);
    expect(text).toContain(fill(t.validUntil, { date: props.validUntil }));
  });

  it.each(locales)("has two read-only, left-to-right, unnamed inputs (%s)", (locale) => {
    const html = render(locale);
    const found = openTags(html, "input");

    expect(found).toHaveLength(2);

    const [code, link] = found;
    expect(code?.id).toBe("invite-code");
    expect(code?.value).toBe(props.code);
    expect(link?.id).toBe("invite-link");
    expect(link?.value).toBe(props.link);

    for (const input of found) {
      // React writes the boolean attribute as readOnly; HTML names are case-insensitive.
      expect(
        Object.keys(input).map((key) => key.toLowerCase()),
      ).toContain("readonly");
      expect(input.dir).toBe("ltr");
      expect("name" in input).toBe(false);
    }
  });

  it.each(locales)("labels the inputs (%s)", (locale) => {
    const t = messages[locale].Invites;
    const html = render(locale);

    expect(labelText(html, "invite-code")).toBe(t.codeLabel);
    expect(labelText(html, "invite-link")).toBe(t.linkLabel);
  });

  it.each(locales)("has two plain buttons and no form (%s)", (locale) => {
    const t = messages[locale].Invites;
    const html = render(locale);
    const found = buttons(html);

    expect(found.map((button) => button.attrs.type)).toStrictEqual([
      "button",
      "button",
    ]);
    expect(found.map((button) => button.text)).toStrictEqual([
      t.copyCode,
      t.copyLink,
    ]);
    expect(html).not.toContain("<form");
  });

  it.each(locales)("has two empty status regions and no 'copied' text (%s)", (locale) => {
    const t = messages[locale].Invites;
    const html = render(locale);
    const regions = [
      ...html.matchAll(/<span\s[^>]*role="status"[^>]*>([\s\S]*?)<\/span>/g),
    ].map((match) => match[1]);

    expect(regions).toStrictEqual(["", ""]);
    expect(visibleText(html)).not.toContain(t.copied);
  });
});

describe("InviteCreate", () => {
  const render = (locale: Locale) =>
    inLocale(locale, createElement(InviteCreate, { action }));

  it.each(locales)("offers one submit button and the limit note, nothing created (%s)", (locale) => {
    const t = messages[locale].Invites;
    const html = render(locale);
    const text = visibleText(html);

    expect(html.match(/<button\s[^>]*type="submit"/g)).toHaveLength(1);
    expect(buttons(html).map((button) => button.text)).toStrictEqual([t.create]);
    expect(text).toContain(t.limitNote);
    expect(text).not.toContain(t.createdTitle);
    expect(html).not.toContain("<input");

    for (const message of Object.values(messages[locale].Errors)) {
      expect(text).not.toContain(message);
    }
  });
});

describe("RevokeInviteForm", () => {
  const render = (locale: Locale) =>
    inLocale(locale, createElement(RevokeInviteForm, { action }));

  it.each(locales)("offers one submit button and the hint (%s)", (locale) => {
    const t = messages[locale].Invites;
    const html = render(locale);

    expect(html.match(/<button\s[^>]*type="submit"/g)).toHaveLength(1);
    expect(buttons(html).map((button) => button.text)).toStrictEqual([t.revoke]);
    expect(visibleText(html)).toContain(t.revokeHint);
  });
});

describe("InviteList", () => {
  const idOf = (digits: string) => `0199f1a2-7c3e-7a10-8000-000000000${digits}`;

  const invites: Invite[] = [
    {
      id: idOf("801"),
      createdAt: "2026-12-06T10:00:00.000Z",
      expiresAt: "2026-12-20T10:00:00.000Z",
      status: "open",
      invitee: null,
    },
    {
      id: idOf("802"),
      createdAt: "2026-11-20T10:00:00.000Z",
      expiresAt: "2026-12-01T10:00:00.000Z",
      status: "redeemed",
      invitee: { handle: "arash", displayName: "آرش کاظمی" },
    },
    {
      id: idOf("803"),
      createdAt: "2026-11-10T10:00:00.000Z",
      expiresAt: "2026-11-20T10:00:00.000Z",
      status: "redeemed",
      invitee: { handle: "former-0199f1a2", displayName: "" },
    },
    {
      id: idOf("804"),
      createdAt: "2026-10-01T10:00:00.000Z",
      expiresAt: "2026-10-20T10:00:00.000Z",
      status: "expired",
      invitee: null,
    },
    {
      id: idOf("805"),
      createdAt: "2026-09-01T10:00:00.000Z",
      expiresAt: "2026-09-20T10:00:00.000Z",
      status: "revoked",
      invitee: null,
    },
  ];

  const revoke: Record<string, ReactNode> = {
    [idOf("801")]: createElement("form", { "data-revoke": "801" }),
    [idOf("804")]: createElement("form", { "data-revoke": "804" }),
  };

  const render = (locale: Locale) =>
    inLocale(locale, createElement(InviteList, { invites, locale, revoke }));

  const items = (html: string) => html.match(/<li[\s>][\s\S]*?<\/li>/g) ?? [];

  it.each(locales)("lists the five invites with their status labels in order (%s)", (locale) => {
    const t = messages[locale].Invites;
    const found = items(render(locale));

    expect(found).toHaveLength(5);
    expect(
      found.map((item) => visibleText(/<span[^>]*>([^<]*)<\/span>/.exec(item)?.[1] ?? "")),
    ).toStrictEqual([
      t.status.open,
      t.status.redeemed,
      t.status.redeemed,
      t.status.expired,
      t.status.revoked,
    ]);
  });

  it.each(locales)("shows the created date on each and the valid-until date only on the open one (%s)", (locale) => {
    const t = messages[locale].Invites;
    const found = items(render(locale));

    invites.forEach((invite, index) => {
      const text = visibleText(found[index] ?? "");

      expect(text).toContain(
        fill(t.createdOn, { date: formatDate(invite.createdAt, locale) }),
      );

      const validUntil = fill(t.validUntil, {
        date: formatDate(invite.expiresAt, locale),
      });

      if (index === 0) expect(text).toContain(validUntil);
      else expect(text).not.toContain(validUntil);
    });
  });

  it.each(locales)("renders only the revoke control of the open invite (%s)", (locale) => {
    const html = render(locale);
    const found = items(html);

    expect(html.match(/data-revoke/g)).toHaveLength(1);
    expect(found[0]).toContain('data-revoke="801"');
    expect(html).not.toContain('data-revoke="804"');
  });

  it.each(locales)("links a redeemed invite to the member, with the name isolated (%s)", (locale) => {
    const t = messages[locale].Invites;
    const second = items(render(locale))[1] ?? "";
    const links = [...second.matchAll(/<a(\s[^>]*)?>([\s\S]*?)<\/a>/g)];

    expect(links).toHaveLength(1);
    expect(attrsOf(links[0]?.[1] ?? "").href).toBe(
      locale === "fa" ? "/members/arash" : "/en/members/arash",
    );
    expect(links[0]?.[2]).toBe("<bdi>آرش کاظمی</bdi>");
    expect(visibleText(second)).toContain(fill(t.joined, { name: "آرش کاظمی" }));
  });

  it.each(locales)("does not link a former member (%s)", (locale) => {
    const t = messages[locale].Invites;
    const html = render(locale);
    const third = items(html)[2] ?? "";

    expect(visibleText(third)).toContain(
      fill(t.joined, { name: messages[locale].Feedback.formerMemberStart }),
    );
    expect(openTags(third, "a")).toHaveLength(0);
    expect(html).not.toMatch(/href="[^"]*former-0199f1a2/);
  });

  it.each(locales)("links no invite that is open, expired or revoked (%s)", (locale) => {
    const found = items(render(locale));

    for (const index of [0, 3, 4]) {
      expect(openTags(found[index] ?? "", "a")).toHaveLength(0);
    }
  });

  it.each(locales)("shows no number besides the formatted dates (%s)", (locale) => {
    let text = visibleText(render(locale));

    for (const invite of invites) {
      for (const date of [invite.createdAt, invite.expiresAt]) {
        text = text.replaceAll(formatDate(date, locale), "");
      }
    }

    expect(text).not.toMatch(/[0-9۰-۹٠-٩]/);
  });
});
