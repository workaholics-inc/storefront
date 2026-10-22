import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import contract from "../contract/openapi.json";
import { CaseCard } from "@/components/case/case-card";
import { CaseForm } from "@/components/case/case-form";
import { MemberHead } from "@/components/member/member-head";
import { MemberLink, isFormerMember, memberName } from "@/components/member/member-name";
import { PostForm } from "@/components/post/post-form";
import { PublicPost } from "@/components/post/public-post";
import { HiddenPlaceholder, type HiddenMark } from "@/components/ui/hidden-placeholder";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

type Member = components["schemas"]["Member"];
type PostData = components["schemas"]["Post"];
type PublicPostData = components["schemas"]["PublicPost"];
type PublicCaseData = components["schemas"]["PublicCase"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;
const schemas = contract.components.schemas;

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

function collapsed(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const prefix = (locale: Locale) => (locale === "fa" ? "" : "/en");

const former = { handle: "former-0199f1a2", displayName: "" };
const kian = { handle: "kian", displayName: "کیان نوری" };
const hidden: HiddenMark = {
  reason: "Spam link (test)",
  role: "moderator",
  at: "2026-12-07T10:00:00.000Z",
};

const noop = async (state: FormState) => state;

describe("isFormerMember", () => {
  it("is true for an empty name only: one space is a name", () => {
    expect(isFormerMember({ displayName: "" })).toBe(true);
    expect(isFormerMember({ displayName: " " })).toBe(false);
    expect(isFormerMember({ displayName: "Sara" })).toBe(false);
  });
});

describe("memberName", () => {
  it.each(locales)("names a missing, former or real member (%s)", (locale) => {
    const t = (key: keyof (typeof messages)[typeof locale]["Feedback"]) =>
      messages[locale].Feedback[key];
    const feedback = messages[locale].Feedback;

    expect(memberName(null, t)).toBe(feedback.unknownMember);
    expect(memberName(former, t)).toBe(feedback.formerMember);
    expect(memberName(former, t, "inline")).toBe(feedback.formerMember);
    expect(memberName(former, t, "start")).toBe(feedback.formerMemberStart);
    expect(memberName(kian, t)).toBe(kian.displayName);
    expect(memberName(kian, t, "start")).toBe(kian.displayName);
    expect(memberName({ displayName: " " }, t)).toBe(" ");
  });

  it("differs between the inline and the start form in English only by the capital", () => {
    expect(en.Feedback.formerMemberStart.toLowerCase()).toBe(en.Feedback.formerMember.toLowerCase());
    expect(en.Feedback.formerMemberStart).not.toBe(en.Feedback.formerMember);
  });
});

describe("MemberLink", () => {
  it.each(locales)("links a real member once, with the name in bdi (%s)", (locale) => {
    const html = render(locale, createElement(MemberLink, { member: kian, className: "x" }));
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];

    expect(links).toHaveLength(1);
    expect(links[0]?.[1]).toContain(`href="${prefix(locale)}/members/kian"`);
    expect(links[0]?.[1]).toContain('class="x"');
    expect(links[0]?.[2]).toBe("<bdi>کیان نوری</bdi>");
  });

  it.each(locales)("renders a former member as plain text with no link (%s)", (locale) => {
    const html = render(locale, createElement(MemberLink, { member: former, className: "x" }));

    expect(html).toBe(`<span>${messages[locale].Feedback.formerMember}</span>`);
    expect(html).not.toContain("<a");
  });
});

describe("HiddenPlaceholder", () => {
  const block = (locale: Locale, mark: HiddenMark = hidden) =>
    render(locale, createElement(HiddenPlaceholder, { hidden: mark, locale, variant: "block" }));

  it.each(locales)("says who hid it, when and why, and links to the log (%s)", (locale) => {
    const t = messages[locale].Hidden;
    const html = block(locale);
    const text = collapsed(html);
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];

    expect(text).toContain(t.title);
    expect(text).toContain(t.byModerator.replace("{date}", formatDate(hidden.at, locale)));
    expect(html).toContain("<bdi>Spam link (test)</bdi>");
    expect(links).toHaveLength(1);
    expect(links[0]?.[1]).toContain(`href="${prefix(locale)}/moderation"`);
    expect(links[0]?.[2]).toBe(t.logLink);
    expect(html).not.toContain("border-dashed");
  });

  it.each(locales)("names an admin as the one who hid it (%s)", (locale) => {
    const t = messages[locale].Hidden;
    const text = collapsed(block(locale, { ...hidden, role: "admin" }));

    expect(text).toContain(t.byAdmin.replace("{date}", formatDate(hidden.at, locale)));
    expect(text).not.toContain(t.byModerator.replace("{date}", formatDate(hidden.at, locale)));
  });

  it.each(locales)("leaves out the reason line when the reason is empty (%s)", (locale) => {
    const t = messages[locale].Hidden;
    const html = block(locale, { ...hidden, reason: "" });
    const label = t.reason.split("<n>")[0]?.trim() ?? "";

    expect(label).not.toBe("");
    expect(html).not.toContain("<bdi>");
    expect(collapsed(html)).not.toContain(label);
  });

  it.each(locales)("is just the title in muted text when inline (%s)", (locale) => {
    const html = render(
      locale,
      createElement(HiddenPlaceholder, { hidden, locale, variant: "inline" }),
    );

    expect(html).toBe(`<span class="text-ink-muted">${messages[locale].Hidden.title}</span>`);
  });
});

describe("MemberHead with a former inviter", () => {
  const member: Member = {
    handle: "sara",
    displayName: "سارا رحیمی",
    bio: "طراح و برنامه‌نویس",
    links: [],
    invitedBy: former,
    joinedAt: "2024-03-02T08:00:00Z",
  };

  it.each(locales)("names them as a former member and does not link them (%s)", (locale) => {
    const html = render(locale, createElement(MemberHead, { member, locale, isSelf: false }));

    expect(collapsed(html)).toContain(
      messages[locale].Profile.invitedBy.replace("{name}", messages[locale].Feedback.formerMember),
    );
    expect(html).not.toMatch(/href="[^"]*former-0199f1a2/);
  });
});

describe("PublicPost with a former author", () => {
  const publicUpdate = schemas.PublicPost.example as PublicPostData;

  it.each(locales)("starts the byline with the former-member label and no empty bdi (%s)", (locale) => {
    const html = render(
      locale,
      createElement(PublicPost, { post: { ...publicUpdate, author: former }, variant: "full" }),
    );

    expect(collapsed(html)).toContain(messages[locale].Feedback.formerMemberStart);
    expect(html).not.toContain("<bdi></bdi>");
  });
});

describe("CaseCard with a former author", () => {
  const publicCase = schemas.PublicCase.example as PublicCaseData;

  it.each(locales)("writes the former member's label as the author (%s)", (locale) => {
    const html = render(
      locale,
      createElement(CaseCard, { kase: { ...publicCase, author: former } }),
    );
    const expected = messages[locale].Cases.by
      .replace("<n>{name}</n>", messages[locale].Feedback.formerMember)
      .replace("{date}", formatDate(publicCase.createdAt, locale));

    expect(collapsed(html)).toContain(expected);
    expect(html).not.toContain("<bdi></bdi>");
  });
});

describe("feedback options of a former member's feedback", () => {
  const formerOption = {
    feedbackId: "0199f1a2-7c3e-7a10-8000-000000000301",
    excerpt: "",
    authorName: "",
  };
  const arashOption = {
    feedbackId: "0199f1a2-7c3e-7a10-8000-000000000302",
    excerpt: "Shorten the first page.",
    authorName: "Arash",
  };
  const feedbackOptions = [formerOption, arashOption];

  // The label of the checkbox with that id, as the form renders it.
  function labelOf(html: string, id: string) {
    return new RegExp(`<label\\b[^>]*\\sfor="${id}"[^>]*>([\\s\\S]*?)</label>`).exec(html)?.[1] ?? "";
  }

  function expectOptions(locale: Locale, formerLabel: string, arashLabel: string) {
    const t = messages[locale];

    expect(formerLabel).not.toBe("");
    expect(collapsed(formerLabel)).toContain(t.Feedback.formerMemberStart);
    expect(collapsed(formerLabel)).toContain(t.Hidden.title);
    expect(formerLabel).not.toContain("<bdi></bdi>");

    expect(arashLabel).toContain("<bdi>Arash</bdi>");
    expect(arashLabel).toContain("<bdi>Shorten the first page.</bdi>");
    expect(collapsed(arashLabel)).not.toContain(t.Feedback.formerMemberStart);
    expect(collapsed(arashLabel)).not.toContain(t.Hidden.title);
  }

  it.each(locales)("PostForm shows the former member and the hidden text (%s)", (locale) => {
    const update = (schemas.PostPage.example.items as PostData[])[0] as PostData;
    const html = render(
      locale,
      createElement(PostForm, {
        action: noop,
        mode: "edit",
        limits: {
          postBodyMax: 5001,
          questionsMax: 5,
          questionMax: 281,
          selfCritiqueMax: 1001,
          whatChangedMax: 3001,
          actedOnMax: 21,
          rejectedAndWhyMax: 2001,
          oneNumberMax: 201,
        },
        actedOnOptions: feedbackOptions,
        initial: update,
      }),
    );

    expectOptions(
      locale,
      labelOf(html, `post-acted-on-${formerOption.feedbackId}`),
      labelOf(html, `post-acted-on-${arashOption.feedbackId}`),
    );
  });

  it.each(locales)("CaseForm shows the former member and the hidden text (%s)", (locale) => {
    const html = render(
      locale,
      createElement(CaseForm, {
        mode: "create",
        action: noop,
        limits: {
          titleMax: 101,
          feedbackStoryMax: 2001,
          changeMax: 2001,
          resultMax: 2001,
          oneNumberMax: 201,
        },
        feedbackOptions,
        postOptions: [],
      }),
    );

    expectOptions(
      locale,
      labelOf(html, `case-feedback-${formerOption.feedbackId}`),
      labelOf(html, `case-feedback-${arashOption.feedbackId}`),
    );
  });
});
