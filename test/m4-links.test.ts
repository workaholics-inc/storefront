import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { MemberHead } from "@/components/member/member-head";
import { SiteHeader, type HeaderSection } from "@/components/site-header";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";

const current = vi.hoisted(() => ({ path: "/" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => current.path,
}));

type Member = components["schemas"]["Member"];

const messages = { fa, en };
const prefixes = { fa: "", en: "/en" } as const;

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(
  locale: Locale,
  props: { current?: HeaderSection; member?: { displayName: string } } = {},
  path = "/",
) {
  current.path = path;
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(SiteHeader, { locale, ...props }),
    ),
  );
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

function collapsed(html: string) {
  return visibleText(html).replace(/\s+/g, " ");
}

const member: Member = {
  handle: "sara",
  displayName: "سارا رحیمی",
  bio: "طراح و برنامه‌نویس",
  links: [{ label: "Website", url: "https://example.com" }],
  invitedBy: { handle: "kian", displayName: "کیان نوری" },
  joinedAt: "2024-03-02T08:00:00Z",
};

function renderHead(locale: Locale, isSelf: boolean) {
  current.path = "/";
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(MemberHead, { member, locale, isSelf }),
    ),
  );
}

const signedIn = { displayName: "سارا مقدم" };

// The signed-in header has two menus, the desktop dropdown and then the phone sheet.
function menus(html: string) {
  return html.split("<details").slice(1);
}

// Every anchor of the HTML as its href and its collapsed text.
function anchors(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: /\shref="([^"]*)"/.exec(match[1] ?? "")?.[1],
    text: collapsed(match[2] ?? "").trim(),
  }));
}

describe("SiteHeader member menu", () => {
  it("lists notifications, invites, moderation log and account in that order before Sign out, in both menus", () => {
    for (const locale of ["fa", "en"] as const) {
      const prefix = prefixes[locale];
      const sections = menus(render(locale, { member: signedIn }));

      expect(sections).toHaveLength(2);
      for (const section of sections) {
        const positions = [
          `href="${prefix}/me/notifications"`,
          `href="${prefix}/me/invites"`,
          `href="${prefix}/moderation"`,
          `href="${prefix}/me/account"`,
          'action="/sign-out"',
        ].map((needle) => section.indexOf(needle));

        for (const index of positions) expect(index).toBeGreaterThan(-1);
        for (let i = 1; i < positions.length; i += 1) {
          expect(positions[i]).toBeGreaterThan(positions[i - 1] ?? Infinity);
        }
      }
    }
  });

  it("labels the three links with the menu's own words, once per menu", () => {
    for (const locale of ["fa", "en"] as const) {
      const prefix = prefixes[locale];
      const html = render(locale, { member: signedIn });

      for (const [path, label] of [
        ["/me/invites", messages[locale].Nav.invites],
        ["/moderation", messages[locale].Nav.moderationLog],
        ["/me/account", messages[locale].Nav.account],
      ] as const) {
        const tags = [
          ...html.matchAll(new RegExp(`<a[^>]*href="${prefix}${path}"[^>]*>([^<]*)</a>`, "g")),
        ];

        expect(tags.map((tag) => tag[1])).toEqual([label, label]);
      }
    }
  });

  it("keeps the three links out of the desktop nav", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, { member: signedIn });
      const nav = /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";

      expect(nav).not.toBe("");
      for (const path of ["/me/invites", "/moderation", "/me/account"]) {
        expect(nav).not.toContain(path);
      }
    }
  });

  it("shows none of the three links when signed out", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale);

      for (const path of ["/me/invites", "/moderation", "/me/account"]) {
        expect(html).not.toContain(path);
      }
    }
  });
});

describe("MemberHead links", () => {
  it("offers edit, invites and account to the member themselves, in that order, and no moderation link", () => {
    for (const locale of ["fa", "en"] as const) {
      const prefix = prefixes[locale];
      const found = anchors(renderHead(locale, true));
      const wanted = [
        [`${prefix}/me/edit`, messages[locale].Profile.edit],
        [`${prefix}/me/invites`, messages[locale].Nav.invites],
        [`${prefix}/me/account`, messages[locale].Nav.account],
      ] as const;

      const indexes = wanted.map(([href]) => found.findIndex((anchor) => anchor.href === href));
      for (const index of indexes) expect(index).toBeGreaterThan(-1);
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      wanted.forEach(([, label], i) => {
        expect(found[indexes[i] ?? -1]?.text).toBe(label);
      });
      for (const anchor of found) expect(anchor.href ?? "").not.toContain("/moderation");
    }
  });

  it("offers none of them to anyone else", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = renderHead(locale, false);

      for (const path of ["/me/edit", "/me/invites", "/me/account"]) {
        expect(html).not.toContain(path);
      }
    }
  });
});
