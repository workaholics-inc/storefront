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
