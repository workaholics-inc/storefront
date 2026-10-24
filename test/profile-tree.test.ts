import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { InviteeList } from "@/components/member/invitee-list";
import type { Locale } from "@/i18n/routing";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

const messages = { fa, en };
const prefixes = { fa: "", en: "/en" } as const;

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

type Invitees = ComponentProps<typeof InviteeList>["invitees"];

// Oldest first, as the platform sends them, and deliberately not alphabetical.
const invitees: Invitees = [
  { handle: "kian", displayName: "کیان نوری" },
  { handle: "former-0199f1a2", displayName: "" },
  null,
  { handle: "arash", displayName: "آرش کاظمی" },
];

function render(locale: Locale, props: { invitees: Invitees; isSelf: boolean }) {
  return renderToStaticMarkup(
    createElement(Provider, { locale, messages: messages[locale] }, createElement(InviteeList, props)),
  );
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

function collapsed(html: string) {
  return visibleText(html).replace(/\s+/g, " ");
}

function items(html: string) {
  return html.split("<li").slice(1);
}

function anchors(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: /\shref="([^"]*)"/.exec(match[1] ?? "")?.[1],
    content: match[2],
  }));
}

describe("InviteeList", () => {
  it("titles the list for its owner or for a visitor, and states the order", () => {
    for (const locale of ["fa", "en"] as const) {
      const m = messages[locale];

      for (const [isSelf, title] of [
        [true, m.Profile.invitedTitleSelf],
        [false, m.Profile.invitedTitle],
      ] as const) {
        const html = render(locale, { invitees, isSelf });
        const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => match[1]);

        expect(headings).toEqual([title]);
        expect(collapsed(html)).toContain(m.Profile.invitedOrder);
      }
    }
  });

  it("renders one item per invitee, each real member as a link to their page by name", () => {
    for (const locale of ["fa", "en"] as const) {
      const prefix = prefixes[locale];
      const html = render(locale, { invitees, isSelf: true });

      expect(items(html)).toHaveLength(4);
      expect(anchors(html)).toEqual([
        { href: `${prefix}/members/kian`, content: "<bdi>کیان نوری</bdi>" },
        { href: `${prefix}/members/arash`, content: "<bdi>آرش کاظمی</bdi>" },
      ]);
      // Whatever the attribute order, the link is the one anchor of its item.
      for (const index of [0, 3]) expect(items(html)[index]?.match(/<a\b/g)).toHaveLength(1);
    }
  });

  it("shows a former member and an unknown one as plain text that stands alone, with no link", () => {
    for (const locale of ["fa", "en"] as const) {
      const m = messages[locale];
      const html = render(locale, { invitees, isSelf: false });
      const [, former, unknown] = items(html);

      expect(html).not.toContain("former-0199f1a2");
      expect(html).toContain(`<span>${m.Feedback.formerMemberStart}</span>`);
      expect(html).toContain(`<span>${m.Feedback.unknownMember}</span>`);
      expect(former?.replace(/^[^>]*>/, "")).toBe(`<span>${m.Feedback.formerMemberStart}</span></li>`);
      expect(unknown?.replace(/^[^>]*>/, "")).toBe(`<span>${m.Feedback.unknownMember}</span></li>`);
      expect(former).not.toMatch(/<a\b/);
      expect(unknown).not.toMatch(/<a\b/);
    }
  });

  it("keeps the platform's order, oldest first, and does not sort by name", () => {
    for (const locale of ["fa", "en"] as const) {
      const m = messages[locale];
      const prefix = prefixes[locale];

      for (const isSelf of [true, false]) {
        const html = render(locale, { invitees, isSelf });
        const positions = [
          html.indexOf(`${prefix}/members/kian"`),
          html.indexOf(`<span>${m.Feedback.formerMemberStart}</span>`),
          html.indexOf(`<span>${m.Feedback.unknownMember}</span>`),
          html.indexOf(`${prefix}/members/arash"`),
        ];

        for (const position of positions) expect(position).toBeGreaterThan(-1);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(new Set(positions).size).toBe(4);
      }
    }
  });

  it("says nobody has joined yet, with no list and no order line, when there are no invitees", () => {
    for (const locale of ["fa", "en"] as const) {
      const m = messages[locale];

      for (const [isSelf, line] of [
        [true, m.Profile.invitedEmptySelf],
        [false, m.Profile.invitedEmpty],
      ] as const) {
        const html = render(locale, { invitees: [], isSelf });
        const text = collapsed(html);

        expect(text).toContain(line);
        expect(text).not.toContain(m.Profile.invitedOrder);
        expect(html).not.toContain("<ul");
        expect(html).not.toMatch(/<a[\s>]/);
        expect(html).not.toContain("<li");
      }
    }
  });

  it("shows no count: no digit in the text and no label attribute", () => {
    for (const locale of ["fa", "en"] as const) {
      for (const isSelf of [true, false]) {
        const html = render(locale, { invitees, isSelf });

        expect(visibleText(html)).not.toMatch(/[0-9۰-۹٠-٩]/);
        // `aria-labelledby` ties the heading to its section and is not a label of a count.
        expect(html).not.toMatch(/\saria-label[\s=>]/);
      }
    }
  });
});
