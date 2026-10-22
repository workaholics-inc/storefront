import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import contract from "../contract/openapi.json";
import { CaseForm } from "@/components/case/case-form";
import { PostForm } from "@/components/post/post-form";
import { VisibilityForm } from "@/components/post/visibility-form";
import { ProjectForm } from "@/components/project/project-form";
import {
  PROBATION_RULES_URL,
  ProbationNotice,
  probationView,
  type ProbationView,
} from "@/components/ui/probation-notice";
import { VisibilityField } from "@/components/ui/visibility-field";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

type PostData = components["schemas"]["Post"];
type Project = components["schemas"]["Project"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;
const now = new Date("2026-12-07T10:00:00.000Z");

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(locale: Locale, element: ReactElement) {
  return renderToStaticMarkup(
    createElement(Provider, { locale, messages: messages[locale] }, element),
  );
}

const noop = async (state: FormState) => state;

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

function selects(html: string) {
  return [...html.matchAll(/<select(\s[^>]*)?>([\s\S]*?)<\/select>/g)].map(
    (match) => ({
      attrs: attrsOf(match[1] ?? ""),
      options: [
        ...(match[2] ?? "").matchAll(/<option(\s[^>]*)?>([^<]*)<\/option>/g),
      ].map((option) => {
        const attrs = attrsOf(option[1] ?? "");

        return {
          value: attrs.value ?? "",
          selected: "selected" in attrs,
          disabled: "disabled" in attrs,
        };
      }),
    }),
  );
}

// The visibility select of a form; the project form has a stage select too.
function visibilitySelect(html: string) {
  const found = selects(html).find((select) => select.attrs.name === "visibility");

  if (found === undefined) throw new Error("the form has no visibility select");

  return found;
}

const disabledFlags = (html: string) =>
  visibilitySelect(html).options.map((option) => option.disabled);
const selectedFlags = (html: string) =>
  visibilitySelect(html).options.map((option) => option.selected);
const optionNamed = (html: string, value: string) =>
  visibilitySelect(html).options.find((option) => option.value === value);

const DIGIT = /[0-9۰-۹٠-٩]/;

const waiting: ProbationView = { untilDate: "21 Dec", feedbackDone: false };

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("the example is missing a value this test reads");
  }

  return value;
}

describe("probationView", () => {
  const until = (iso: string, feedbackDone = false) => ({ until: iso, feedbackDone });

  it.each(locales)("is null for a member who is not on probation (%s)", (locale) => {
    expect(probationView(null, locale, now)).toBeNull();
  });

  it.each(locales)("formats the date when it ends one millisecond after now (%s)", (locale) => {
    const iso = "2026-12-07T10:00:00.001Z";

    expect(probationView(until(iso), locale, now)).toEqual({
      untilDate: formatDate(iso, locale, now),
      feedbackDone: false,
    });
  });

  it.each(locales)("has no date once it ends at now or before it (%s)", (locale) => {
    const done = { untilDate: null, feedbackDone: false };

    expect(probationView(until("2026-12-07T10:00:00.000Z"), locale, now)).toEqual(done);
    expect(probationView(until("2026-12-07T09:59:59.999Z"), locale, now)).toEqual(done);
  });

  it.each(locales)("carries feedbackDone through next to a future date (%s)", (locale) => {
    const iso = "2026-12-21T10:00:00.000Z";

    expect(probationView(until(iso, true), locale, now)).toEqual({
      untilDate: formatDate(iso, locale, now),
      feedbackDone: true,
    });
  });
});

describe("ProbationNotice", () => {
  const notice = (locale: Locale, probation: ProbationView) =>
    render(locale, createElement(ProbationNotice, { id: "x-probation", probation }));

  it("links the published rules", () => {
    expect(PROBATION_RULES_URL).toBe(
      "https://github.com/workaholics-inc/storefront/blob/main/docs/rules.md#new-members",
    );
  });

  it.each(locales)("says what is still ahead, with the date and a link to the rules (%s)", (locale) => {
    const t = messages[locale].Probation;
    const html = notice(locale, waiting);
    const text = visibleText(html);
    const [link, ...rest] = openTags(html, "a");

    expect(html).toContain('<div id="x-probation"');
    for (const line of [
      t.title,
      t.publicOption,
      t.body,
      t.dateAhead.replace("{date}", "21 Dec"),
      t.feedbackPending,
    ]) {
      expect(text).toContain(line);
    }
    expect(text).not.toContain(t.dateMet);
    expect(text).not.toContain(t.feedbackMet);
    expect(rest).toEqual([]);
    expect(link?.href).toBe(PROBATION_RULES_URL);
    expect(link?.rel).toBe("noopener");
    expect(visibleText(/<a[^>]*>([\s\S]*?)<\/a>/.exec(html)?.[1] ?? "")).toBe(t.rulesLink);
  });

  it.each(locales)("says what is met and shows no number when nothing is ahead (%s)", (locale) => {
    const t = messages[locale].Probation;
    const text = visibleText(notice(locale, { untilDate: null, feedbackDone: true }));

    expect(text).toContain(t.dateMet);
    expect(text).toContain(t.feedbackMet);
    expect(text).not.toContain(t.dateAhead.split("{date}")[0]?.trim() ?? "");
    expect(text).not.toContain(t.feedbackPending);
    expect(text).not.toMatch(DIGIT);
  });
});

describe("VisibilityField with probation", () => {
  const field = (locale: Locale, props: Partial<ComponentProps<typeof VisibilityField>> = {}) =>
    render(locale, createElement(VisibilityField, { name: "visibility", kind: "post", ...props }));

  it.each(locales)("disables public and keeps inherit selected, with the notice after the note (%s)", (locale) => {
    const html = field(locale, { probation: waiting });

    expect(visibilitySelect(html).options.map((option) => option.value)).toEqual([
      "inherit",
      "members",
      "public",
    ]);
    expect(disabledFlags(html)).toEqual([false, false, true]);
    expect(selectedFlags(html)).toEqual([true, false, false]);
    expect(visibilitySelect(html).attrs["aria-describedby"]).toBe(
      "post-visibility-options post-visibility-note post-visibility-probation",
    );
    expect(html).toContain('<div id="post-visibility-probation"');
    expect(html.indexOf('<p id="post-visibility-note"')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('<div id="post-visibility-probation"')).toBeGreaterThan(
      html.indexOf('<p id="post-visibility-note"'),
    );
  });

  it.each(locales)("keeps public disabled for members and lets an already public item stay public (%s)", (locale) => {
    const members = field(locale, { value: "members", probation: waiting });
    const open = field(locale, { value: "public", probation: waiting });

    expect(disabledFlags(members)).toEqual([false, false, true]);
    expect(selectedFlags(members)).toEqual([false, true, false]);
    expect(disabledFlags(open)).toEqual([false, false, false]);
    expect(selectedFlags(open)).toEqual([false, false, true]);
    expect(open).toContain('<div id="post-visibility-probation"');
  });

  it.each(locales)("names the notice after the case for a case (%s)", (locale) => {
    const html = field(locale, { kind: "case", probation: waiting });

    expect(html).toContain('<div id="case-visibility-probation"');
    expect(html).not.toContain("post-visibility-probation");
    expect(visibilitySelect(html).attrs["aria-describedby"]).toBe(
      "case-visibility-options case-visibility-note case-visibility-probation",
    );
  });

  it.each(locales)("renders exactly what it did before when probation is null (%s)", (locale) => {
    const without = field(locale);
    const none = field(locale, { probation: null });

    expect(none).toBe(without);
    expect(none).not.toContain('disabled=""');
    expect(none).not.toContain(messages[locale].Probation.title);
  });

  it.each(locales)("lists the probation notice before the error in aria-describedby (%s)", (locale) => {
    const html = field(locale, { probation: waiting, error: "E" });

    expect(visibilitySelect(html).attrs["aria-describedby"]).toBe(
      "post-visibility-options post-visibility-note post-visibility-probation post-visibility-error",
    );
  });
});

describe("ProjectForm with probation", () => {
  const project: Project = {
    slug: "daftar",
    name: "دفتر",
    oneLiner: "دفترچه‌ی کار مشترک",
    stage: "building",
    visibility: "members",
    links: [{ label: "Repo", url: "https://example.com/daftar" }],
    owners: [
      { handle: "sara", displayName: "سارا رحیمی" },
      { handle: "kian", displayName: "کیان نوری" },
    ],
    lastPostAt: null,
    hasUnansweredFeedback: false,
    createdAt: "2026-10-17T08:00:00Z",
    updatedAt: "2026-10-17T08:00:00Z",
  };

  const form = (locale: Locale, props: Partial<ComponentProps<typeof ProjectForm>>) =>
    render(
      locale,
      createElement(ProjectForm, {
        mode: "update",
        project,
        linksMax: LIMITS.linksMax,
        action: noop,
        ...props,
      }),
    );

  it.each(locales)("disables public for a members project and shows the notice (%s)", (locale) => {
    const html = form(locale, { probation: waiting });

    expect(html).toContain('<option value="public" disabled="">');
    expect(html).toContain('<div id="project-visibility-probation"');
    expect(visibilitySelect(html).attrs["aria-describedby"]).toMatch(/^project-visibility-probation/);
    expect(selectedFlags(html)).toEqual([true, false]);
  });

  it.each(locales)("leaves a public project's public option selected and enabled (%s)", (locale) => {
    const html = form(locale, {
      project: { ...project, visibility: "public" },
      probation: waiting,
    });

    expect(optionNamed(html, "public")?.selected).toBe(true);
    expect(optionNamed(html, "public")?.disabled).toBe(false);
    expect(html).toContain('<div id="project-visibility-probation"');
  });

  it.each(locales)("disables public when creating a project (%s)", (locale) => {
    const html = render(
      locale,
      createElement(ProjectForm, {
        mode: "create",
        linksMax: LIMITS.linksMax,
        action: noop,
        probation: waiting,
      }),
    );

    expect(optionNamed(html, "public")?.disabled).toBe(true);
    expect(optionNamed(html, "members")?.disabled).toBe(false);
  });

  it.each(locales)("renders exactly what it did before when probation is null (%s)", (locale) => {
    const without = form(locale, {});
    const none = form(locale, { probation: null });

    expect(none).toBe(without);
    expect(none).not.toContain('disabled=""');
    expect(none).not.toContain("probation");
    expect(visibilitySelect(none).attrs["aria-describedby"] ?? "").not.toContain("probation");
  });
});

describe("the forms that offer visibility", () => {
  const limits = {
    postBodyMax: 5001,
    questionsMax: 5,
    questionMax: 281,
    selfCritiqueMax: 1001,
    whatChangedMax: 3001,
    actedOnMax: 21,
    rejectedAndWhyMax: 2001,
    oneNumberMax: 201,
  };
  const wip = required(
    (contract.components.schemas.PostPage.example.items as PostData[])[1],
  );

  const post = (locale: Locale, props: Partial<ComponentProps<typeof PostForm>>) =>
    render(
      locale,
      createElement(PostForm, {
        action: noop,
        mode: "create",
        limits,
        actedOnOptions: [],
        ...props,
      }),
    );

  it.each(locales)("PostForm disables public and shows the notice when creating (%s)", (locale) => {
    const html = post(locale, { probation: waiting });

    expect(optionNamed(html, "public")?.disabled).toBe(true);
    expect(html).toContain('<div id="post-visibility-probation"');
  });

  it.each(locales)("PostForm shows no notice when editing, where visibility is not offered (%s)", (locale) => {
    const html = post(locale, { mode: "edit", initial: wip, probation: waiting });

    expect(html).not.toContain("post-visibility-probation");
    expect(visibleText(html)).not.toContain(messages[locale].Probation.title);
  });

  it.each(locales)("VisibilityForm disables public unless the post already is public (%s)", (locale) => {
    const visibility = (value: "members" | "public") =>
      render(
        locale,
        createElement(VisibilityForm, {
          action: noop,
          visibility: value,
          isPublic: value === "public",
          postKind: "wip",
          probation: waiting,
        }),
      );

    expect(disabledFlags(visibility("members"))).toEqual([false, false, true]);
    expect(disabledFlags(visibility("public"))).toEqual([false, false, false]);
  });

  it.each(locales)("CaseForm disables public and shows the notice (%s)", (locale) => {
    const html = render(
      locale,
      createElement(CaseForm, {
        mode: "create",
        action: noop,
        limits: {
          titleMax: LIMITS.caseTitleMax,
          feedbackStoryMax: LIMITS.caseFeedbackStoryMax,
          changeMax: LIMITS.caseChangeMax,
          resultMax: LIMITS.caseResultMax,
          oneNumberMax: LIMITS.caseOneNumberMax,
        },
        feedbackOptions: [],
        postOptions: [],
        probation: waiting,
      }),
    );

    expect(optionNamed(html, "public")?.disabled).toBe(true);
    expect(html).toContain('<div id="case-visibility-probation"');
  });
});
