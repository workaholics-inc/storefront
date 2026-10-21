import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { SiteHeader, type HeaderSection } from "@/components/site-header";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const current = vi.hoisted(() => ({ path: "/" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => current.path,
}));

const messages = { fa, en };

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

function languageLinks(html: string, lang: Locale) {
  return [...html.matchAll(new RegExp(`<a[^>]*\\slang="${lang}"[^>]*>`, "g"))].map(
    (match) => match[0],
  );
}

function hrefOf(tag: string) {
  return /\shref="([^"]*)"/.exec(tag)?.[1];
}

describe("SiteHeader", () => {
  it("shows the signed-out navigation in Persian", () => {
    const text = visibleText(render("fa"));

    for (const label of ["پروژه‌ها", "قواعد", "مانیفست", "English", "ورود"]) {
      expect(text).toContain(label);
    }
    expect(text).not.toContain("اعضا");
  });

  it("shows the member menu and no sign-in link when signed in", () => {
    const html = render("fa", { member: { displayName: "سارا مقدم" } });
    const text = visibleText(html);

    for (const label of ["سارا مقدم", "صفحه‌ی من", "خروج"]) {
      expect(text).toContain(label);
    }
    expect(text).not.toContain("اعضا");
    expect(html).not.toContain('href="/sign-in"');
  });

  it("marks the current section in the desktop nav and in the phone menu", () => {
    const html = render("fa", { current: "rules" });
    const nav = /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
    const rest = html.replace(nav, "");
    const mark = /<a[^>]*aria-current="page"[^>]*>/g;
    const inNav = [...nav.matchAll(mark)];
    const inMenu = [...rest.matchAll(mark)];

    expect(inNav).toHaveLength(1);
    expect(inMenu).toHaveLength(1);
    expect(inNav[0]?.[0]).toContain('href="/rules"');
    expect(inMenu[0]?.[0]).toContain('href="/rules"');
  });

  describe("practice link", () => {
    const prefixes = { fa: "", en: "/en" } as const;
    const anchors = (html: string) => [...html.matchAll(/<a[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);

    it("is in the desktop nav and in the phone sheet, signed out and signed in", () => {
      for (const locale of ["fa", "en"] as const) {
        for (const member of [undefined, { displayName: "سارا مقدم" }]) {
          const html = render(locale, { member });
          const nav = /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
          const rest = html.replace(nav, "");
          const href = `href="${prefixes[locale]}/practice"`;
          const inNav = anchors(nav).filter((tag) => tag.includes(href));
          const inRest = anchors(rest).filter((tag) => tag.includes(href));

          expect(inNav).toHaveLength(1);
          expect(inRest).toHaveLength(1);
          for (const tag of [...inNav, ...inRest]) {
            expect(visibleText(tag).trim()).toBe(messages[locale].Nav.practice);
          }
        }
      }
    });

    it("sits between the rules and the manifesto in the desktop nav", () => {
      for (const locale of ["fa", "en"] as const) {
        const prefix = prefixes[locale];
        const html = render(locale);
        const nav = /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
        const hrefs = [...nav.matchAll(/<a[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);

        expect(hrefs).toEqual([
          `${prefix}/projects`,
          `${prefix}/rules`,
          `${prefix}/practice`,
          `${prefix}/manifesto`,
        ]);
      }
    });

    it("is marked as the current section in the nav and in the phone menu", () => {
      for (const locale of ["fa", "en"] as const) {
        const html = render(locale, { current: "practice" });
        const nav = /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
        const rest = html.replace(nav, "");
        const mark = /<a[^>]*aria-current="page"[^>]*>/g;
        const inNav = [...nav.matchAll(mark)];
        const inMenu = [...rest.matchAll(mark)];

        expect(inNav).toHaveLength(1);
        expect(inMenu).toHaveLength(1);
        expect(inNav[0]?.[0]).toContain(`href="${prefixes[locale]}/practice"`);
        expect(inMenu[0]?.[0]).toContain(`href="${prefixes[locale]}/practice"`);
      }
    });
  });

  it("names the other language in its own script", () => {
    const html = render("en");

    expect(html).toMatch(/<a[^>]*\slang="fa"[^>]*>فارسی<\/a>/);
  });

  it("shows no digits in the output text", () => {
    for (const locale of ["fa", "en"] as const) {
      expect(visibleText(render(locale, { current: "projects" }))).not.toMatch(
        /[0-9۰-۹٠-٩]/,
      );
    }
  });

  it("contains the logo mark and the wordmark", () => {
    const html = render("en");

    expect(html).toContain('<svg viewBox="0 0 61 38"');
    expect(visibleText(html)).toContain("workaholics");
  });

  describe("member menu links", () => {
    const member = { displayName: "سارا مقدم" };
    const prefixes = { fa: "", en: "/en" } as const;

    // The signed-in header has two menus, the desktop dropdown and then the phone sheet.
    function menus(html: string) {
      return html.split("<details").slice(1);
    }

    it("lists awaiting and notifications after My page and before Sign out, in both menus", () => {
      for (const locale of ["fa", "en"] as const) {
        const prefix = prefixes[locale];
        const sections = menus(render(locale, { member }));

        expect(sections).toHaveLength(2);
        for (const section of sections) {
          const hrefs = [`${prefix}/me"`, `${prefix}/me/awaiting"`, `${prefix}/me/notifications"`].map(
            (tail) => section.indexOf(`href="${tail}`),
          );
          const signOut = section.indexOf('action="/sign-out"');

          for (const index of hrefs) expect(index).toBeGreaterThan(-1);
          expect(hrefs).toEqual([...hrefs].sort((a, b) => a - b));
          expect(signOut).toBeGreaterThan(hrefs[2] ?? Infinity);
        }
      }
    });

    it("labels the links with the menu's own words", () => {
      for (const locale of ["fa", "en"] as const) {
        const prefix = prefixes[locale];
        const html = render(locale, { member });

        for (const [path, label] of [
          ["/me/awaiting", messages[locale].Nav.awaiting],
          ["/me/notifications", messages[locale].Nav.notifications],
        ] as const) {
          const tags = [...html.matchAll(new RegExp(`<a[^>]*href="${prefix}${path}"[^>]*>([^<]*)</a>`, "g"))];

          expect(tags.map((tag) => tag[1])).toEqual([label, label]);
        }
      }
    });

    it("has neither link when signed out", () => {
      for (const locale of ["fa", "en"] as const) {
        const html = render(locale);

        expect(html).not.toContain("/me/awaiting");
        expect(html).not.toContain("/me/notifications");
        expect(html).not.toMatch(/href="[^"]*\/me"/);
      }
    });
  });

  it("holds no count and no unread marker when signed in", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, { current: "projects", member: { displayName: "سارا مقدم" } });
      const labels = [...html.matchAll(/\saria-label="([^"]*)"/g)].map((match) => match[1]);

      expect(visibleText(html)).not.toMatch(/[0-9۰-۹٠-٩]/);
      // The only label is the phone menu button's.
      expect(labels).toEqual([messages[locale].Nav.menu]);
      // The initials circle is the only round element: no dot badge.
      expect(html.match(/rounded-full/g)).toHaveLength(1);
      expect(html).not.toContain("sr-only");
      expect(html).not.toMatch(/\s(?:data-unread|aria-live|role="status")/);
    }
  });

  it("keeps the current path in the language link", () => {
    const faLinks = languageLinks(render("fa", {}, "/projects"), "en");
    const enLinks = languageLinks(render("en", {}, "/en/projects"), "fa");

    expect(faLinks.length).toBeGreaterThan(0);
    expect(enLinks.length).toBeGreaterThan(0);
    for (const tag of faLinks) {
      expect(hrefOf(tag)).toBe(getPathname({ locale: "en", href: "/projects", forcePrefix: true }));
    }
    for (const tag of enLinks) {
      expect(hrefOf(tag)).toBe(getPathname({ locale: "fa", href: "/projects", forcePrefix: true }));
    }
  });
});
