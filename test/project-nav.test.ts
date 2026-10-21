import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { ProjectNav, type ProjectSection } from "@/components/project/project-nav";
import type { Locale } from "@/i18n/routing";

const messages = { fa, en };
const locales = ["fa", "en"] as const;
const sections: readonly ProjectSection[] = ["timeline", "changelog", "cases"];
const prefixes = { fa: "", en: "/en" } as const;

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(locale: Locale, current: ProjectSection, slug = "daftar") {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(ProjectNav, { slug, current }),
    ),
  );
}

function links(html: string) {
  return [...html.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    attrs: match[1] ?? "",
    href: /\shref="([^"]*)"/.exec(match[1] ?? "")?.[1],
    text: (match[2] ?? "").replace(/<[^>]*>/g, "").trim(),
    isCurrent: /\saria-current="page"/.test(match[1] ?? ""),
  }));
}

describe("ProjectNav", () => {
  it.each(locales.flatMap((locale) => sections.map((current) => [locale, current] as const)))(
    "is one labelled nav with the three section links in order in %s with %s current",
    (locale, current) => {
      const html = render(locale, current);
      const prefix = prefixes[locale];
      const t = messages[locale];

      expect(html.match(/<nav[\s>]/g)).toHaveLength(1);
      expect(/<nav[^>]*\saria-label="([^"]*)"/.exec(html)?.[1]).toBe(t.Projects.sections);
      expect(links(html).map(({ href, text }) => ({ href, text }))).toEqual([
        { href: `${prefix}/projects/daftar`, text: t.Projects.timeline },
        { href: `${prefix}/projects/daftar/changelog`, text: t.Changelog.title },
        { href: `${prefix}/projects/daftar/cases`, text: t.Cases.title },
      ]);
    },
  );

  it.each(locales.flatMap((locale) => sections.map((current) => [locale, current] as const)))(
    "marks only the current section in %s with %s current",
    (locale, current) => {
      const marked = links(render(locale, current)).map((link) => link.isCurrent);

      expect(marked).toEqual(sections.map((section) => section === current));
    },
  );

  it.each(locales.flatMap((locale) => sections.map((current) => [locale, current] as const)))(
    "has exactly one aria-current in the whole nav in %s with %s current",
    (locale, current) => {
      expect(render(locale, current).match(/aria-current=/g)).toHaveLength(1);
    },
  );

  it("encodes the slug in every link", () => {
    for (const locale of locales) {
      const hrefs = links(render(locale, "timeline", "a b")).map((link) => link.href);

      expect(hrefs).toEqual([
        `${prefixes[locale]}/projects/a%20b`,
        `${prefixes[locale]}/projects/a%20b/changelog`,
        `${prefixes[locale]}/projects/a%20b/cases`,
      ]);
    }
  });

  it.each(locales)("shows no digit in %s", (locale) => {
    for (const current of sections) {
      const text = render(locale, current).replace(/<[^>]*>/g, " ");

      expect(text).not.toMatch(/[0-9۰-۹٠-٩]/);
    }
  });
});
