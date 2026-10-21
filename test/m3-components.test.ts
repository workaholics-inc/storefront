import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import contract from "../contract/openapi.json";
import { BadgeSnippet, badgeEmbedCode } from "@/components/project/badge-snippet";
import { CaseCard } from "@/components/case/case-card";
import { CreditList } from "@/components/case/credit-list";
import { Post } from "@/components/post/post";
import { PublicPost } from "@/components/post/public-post";
import { PracticeMonths } from "@/components/practice/practice-months";
import { ProjectCard } from "@/components/project/project-card";
import { PublicBadge, itemBadge } from "@/components/ui/public-badge";
import { VisibilityField } from "@/components/ui/visibility-field";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";

type PostData = components["schemas"]["Post"];
type PublicPostData = components["schemas"]["PublicPost"];
type CaseData = components["schemas"]["Case"];
type PublicCaseData = components["schemas"]["PublicCase"];
type Snapshot = components["schemas"]["PracticeSnapshot"];
type Project = components["schemas"]["Project"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;
const now = new Date("2026-10-20T12:00:00.000Z");
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
          label: decode(option[2] ?? ""),
          selected: "selected" in attrs,
        };
      }),
    }),
  );
}

// The `<section>` that carries a heading, or undefined when it is not shown.
function sectionOf(html: string, heading: string) {
  return html
    .split("<section")
    .map((part) => part.split("</section>")[0] ?? "")
    .find((part) => part.includes(`>${heading}</h4>`));
}

function headingAt(html: string, heading: string) {
  return html.indexOf(`>${heading}</h4>`);
}

function expectInOrder(html: string, headings: string[]) {
  const positions = headings.map((heading) => headingAt(html, heading));

  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

function count(text: string, needle: string) {
  return text.split(needle).length - 1;
}

const anchors = (html: string) => [...html.matchAll(/<a[\s>]/g)].length;
const DIGIT = /[0-9۰-۹٠-٩]/;
const prefix = (locale: Locale) => (locale === "fa" ? "" : "/en");

const publicUpdate = schemas.PublicPost.example as PublicPostData;
const publicWip = schemas.PublicPostPage.example.items[1] as PublicPostData;
const publicCase = schemas.PublicCase.example as PublicCaseData;
const memberCase = schemas.Case.example as CaseData;
const snapshots = schemas.PracticePage.example.items as Snapshot[];
const memberPosts = schemas.PostPage.example.items as PostData[];
const memberUpdate = memberPosts[0] as PostData;
const memberWip = memberPosts[1] as PostData;

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("the example is missing a value this test reads");
  }

  return value;
}

describe("itemBadge", () => {
  it("labels a public item, and a members-only one only inside a public project", () => {
    expect(itemBadge({ isPublic: true })).toBe("public");
    expect(itemBadge({ isPublic: true, projectPublic: false })).toBe("public");
    expect(itemBadge({ isPublic: false, projectPublic: true })).toBe("members");
    expect(itemBadge({ isPublic: false })).toBeNull();
    expect(itemBadge({ isPublic: false, projectPublic: false })).toBeNull();
  });
});

describe("VisibilityField", () => {
  const field = (locale: Locale, props: ComponentProps<typeof VisibilityField>) =>
    render(locale, createElement(VisibilityField, props));

  it.each(locales)("is one select with the three options, inherit selected (%s)", (locale) => {
    const t = messages[locale].Visibility;
    const html = field(locale, { name: "visibility", kind: "post" });
    const [select, ...rest] = selects(html);

    expect(rest).toEqual([]);
    expect(select?.attrs.name).toBe("visibility");
    expect(select?.attrs.id).toBe("post-visibility");
    expect(select?.options.map((option) => option.value)).toEqual(["inherit", "members", "public"]);
    expect(select?.options.map((option) => option.label)).toEqual([t.inherit, t.members, t.public]);
    expect(select?.options.map((option) => option.selected)).toEqual([true, false, false]);
    expect(html).toContain(`<label for="post-visibility" class="text-label text-ink">${t.postLabel}`);
  });

  it.each(locales)("labels a case's field as a case (%s)", (locale) => {
    const html = field(locale, { name: "visibility", kind: "case" });
    const [select] = selects(html);

    expect(select?.attrs.id).toBe("case-visibility");
    expect(html).toContain(`>${messages[locale].Visibility.caseLabel}`);
    expect(html).not.toContain(messages[locale].Visibility.postLabel);
  });

  it.each(locales)("selects the given value and falls back to inherit (%s)", (locale) => {
    const given = selects(field(locale, { name: "visibility", kind: "post", value: "public" }))[0];
    const unknown = selects(field(locale, { name: "visibility", kind: "post", value: "everyone" }))[0];
    const members = selects(field(locale, { name: "visibility", kind: "post", value: "members" }))[0];

    expect(given?.options.map((option) => option.selected)).toEqual([false, false, true]);
    expect(unknown?.options.map((option) => option.selected)).toEqual([true, false, false]);
    expect(members?.options.map((option) => option.selected)).toEqual([false, true, false]);
  });

  it.each(locales)("explains every option and says feedback is never public (%s)", (locale) => {
    const t = messages[locale].Visibility;
    const html = field(locale, { name: "visibility", kind: "post" });
    const list = html.match(/<ul id="post-visibility-options"[^>]*>([\s\S]*?)<\/ul>/);
    const items = [...(list?.[1] ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) =>
      visibleText(match[1] ?? ""),
    );

    expect(items).toEqual([
      `${t.inherit} ${t.inheritHint}`,
      `${t.members} ${t.membersHint}`,
      `${t.public} ${t.publicHint}`,
    ]);
    expect(html).toContain(`<p id="post-visibility-note" class="m-0 text-small text-ink-muted">${t.feedbackNote}</p>`);
    expect(selects(html)[0]?.attrs["aria-describedby"]).toBe(
      "post-visibility-options post-visibility-note",
    );
    expect(visibleText(html)).not.toMatch(DIGIT);
  });

  it.each(locales)("shows a given error and marks the select invalid (%s)", (locale) => {
    const html = field(locale, { name: "visibility", kind: "post", error: "E" });
    const select = selects(html)[0];

    expect(html).toContain('<p id="post-visibility-error"');
    expect(visibleText(html)).toContain("E");
    expect(select?.attrs["aria-invalid"]).toBe("true");
    expect(select?.attrs["aria-describedby"]).toBe(
      "post-visibility-options post-visibility-note post-visibility-error",
    );
    expect(selects(field(locale, { name: "visibility", kind: "post" }))[0]?.attrs["aria-invalid"]).toBeUndefined();
  });
});

describe("Post head row", () => {
  const post = (locale: Locale, data: PostData, projectPublic?: boolean) =>
    render(
      locale,
      createElement(Post, {
        post: data,
        locale,
        variant: "full",
        showThreadLink: false,
        canGiveFeedback: false,
        now,
        ...(projectPublic === undefined ? {} : { projectPublic }),
      }),
    );

  const badge = (locale: Locale, visibility: "public" | "members") =>
    render(locale, createElement(PublicBadge, { visibility }));

  it.each(locales)("shows Public on a public post, before its first section (%s)", (locale) => {
    const t = messages[locale].PublicBadge;
    const html = post(locale, memberUpdate);
    const title = `title="${t.publicTitle}"`;

    expect(memberUpdate.isPublic).toBe(true);
    expect(count(html, badge(locale, "public"))).toBe(1);
    expect(count(html, title)).toBe(1);
    expect(html).not.toContain(badge(locale, "members"));
    expect(html.indexOf(title)).toBeGreaterThan(-1);
    expect(html.indexOf(title)).toBeLessThan(html.indexOf("<h4"));
  });

  it.each(locales)("shows no badge on a members-only post without a public project (%s)", (locale) => {
    const t = messages[locale].PublicBadge;
    const html = post(locale, memberWip);

    expect(memberWip.isPublic).toBe(false);
    expect(html).not.toContain(`title="${t.publicTitle}"`);
    expect(html).not.toContain(badge(locale, "members"));
  });

  it.each(locales)("labels a members-only post only inside a public project (%s)", (locale) => {
    const t = messages[locale].PublicBadge;
    const closed: PostData = { ...memberWip, visibility: "members", isPublic: false };

    expect(count(post(locale, closed, true), badge(locale, "members"))).toBe(1);
    expect(post(locale, closed, true)).not.toContain(`title="${t.publicTitle}"`);
    expect(post(locale, closed, false)).not.toContain(badge(locale, "members"));
    expect(post(locale, closed)).not.toContain(badge(locale, "members"));
  });
});

describe("PublicPost", () => {
  const publicPost = (
    locale: Locale,
    data: PublicPostData,
    options: { variant?: "full" | "compact"; href?: string } = {},
  ) =>
    render(locale, createElement(PublicPost, { post: data, variant: "full", ...options }));
  const href = `/projects/daftar/posts/${publicUpdate.id}`;

  it.each(locales)("shows an update's three sections in order, in bdi (%s)", (locale) => {
    const t = messages[locale].Posts;
    const html = publicPost(locale, publicUpdate);

    expectInOrder(html, [t.whatChanged, t.rejectedAndWhy, t.oneNumber]);
    expect(sectionOf(html, t.whatChanged)).toContain(`<bdi>${required(publicUpdate.whatChanged)}</bdi>`);
    expect(sectionOf(html, t.rejectedAndWhy)).toContain(`<bdi>${required(publicUpdate.rejectedAndWhy)}</bdi>`);
    expect(sectionOf(html, t.oneNumber)).toContain(`<bdi>${required(publicUpdate.oneNumber)}</bdi>`);
    expect(html).toContain(`<bdi>${required(publicUpdate.author).displayName}</bdi>`);
  });

  it.each(locales)("offers a visitor nothing to act on (%s)", (locale) => {
    const html = publicPost(locale, publicUpdate);
    const text = visibleText(html);
    const t = messages[locale];

    expect(anchors(html)).toBe(0);
    for (const word of [t.Posts.actedOn, t.Posts.feedbackWanted, t.Posts.openThread, t.Posts.giveFeedback]) {
      expect(text).not.toContain(word);
    }
    expect(html).not.toContain(`title="${t.PublicBadge.publicTitle}"`);
  });

  it.each(locales)("links the date to the post's own page when given an href (%s)", (locale) => {
    const html = publicPost(locale, publicUpdate, { href });
    const links = [...html.matchAll(/<a[^>]*\shref="([^"]*)"[^>]*>([^<]*)<\/a>/g)];

    expect(anchors(html)).toBe(1);
    expect(links).toHaveLength(1);
    expect(links[0]?.[1]).toBe(`${prefix(locale)}${href}`);
    expect(links[0]?.[2]).toBe(formatDate(publicUpdate.createdAt, locale));
  });

  it.each(locales)("shows a work in progress's questions in an ol, and its self-critique only in full (%s)", (locale) => {
    const t = messages[locale].Posts;
    const full = publicPost(locale, publicWip);
    const compact = publicPost(locale, publicWip, { variant: "compact" });
    const well = required(sectionOf(full, t.feedbackWanted));

    expect(well).toContain("<ol");
    expect(publicWip.feedbackWanted).toHaveLength(3);
    expect(
      [...well.matchAll(/<li[^>]*><bdi>([\s\S]*?)<\/bdi><\/li>/g)].map((match) => match[1]),
    ).toEqual(publicWip.feedbackWanted);
    expect(sectionOf(full, t.selfCritique)).toContain(`<bdi>${required(publicWip.selfCritique)}</bdi>`);
    expect(compact).not.toContain(`>${t.selfCritique}</h4>`);
    expect(compact).not.toContain(required(publicWip.selfCritique));
    expect(compact).toContain(`<bdi>${publicWip.feedbackWanted[0]}</bdi>`);
  });

  it.each(locales)("drops an update's sections that are empty (%s)", (locale) => {
    const t = messages[locale].Posts;
    const html = publicPost(locale, { ...publicUpdate, oneNumber: null, rejectedAndWhy: null, whatChanged: null });

    for (const heading of [t.whatChanged, t.rejectedAndWhy, t.oneNumber]) {
      expect(html).not.toContain(`>${heading}</h4>`);
    }
    expect(html).not.toContain("<section");
    expect(publicPost(locale, { ...publicUpdate, oneNumber: null })).not.toContain(`>${t.oneNumber}</h4>`);
  });

  it.each(locales)("never shows feedback the post acted on, even if the data carried it (%s)", (locale) => {
    const leaky = { ...publicUpdate, actedOn: memberUpdate.actedOn } as PublicPostData;
    const html = publicPost(locale, leaky);

    expect(memberUpdate.actedOn.length).toBeGreaterThan(0);
    for (const item of memberUpdate.actedOn) {
      expect(html).not.toContain(item.excerpt);
      expect(html).not.toContain(required(item.author).displayName);
    }
    expect(html).not.toContain(`>${messages[locale].Posts.actedOn}</h4>`);
  });

  it.each(locales)("says edited only when edited, and an unknown author when there is none (%s)", (locale) => {
    const t = messages[locale];
    const edited = publicPost(locale, { ...publicUpdate, editedAt: "2026-10-28T10:00:00.000Z" });
    const original = publicPost(locale, publicUpdate);
    const unknown = publicPost(locale, { ...publicUpdate, author: null });

    expect(visibleText(edited)).toContain(t.Posts.edited);
    expect(visibleText(original)).not.toContain(t.Posts.edited);
    expect(visibleText(unknown)).toContain(t.Feedback.unknownMember);
    expect(visibleText(original)).not.toContain(t.Feedback.unknownMember);
  });
});

describe("CaseCard", () => {
  const card = (locale: Locale, kase: CaseData | PublicCaseData, href?: string) =>
    render(locale, createElement(CaseCard, href === undefined ? { kase } : { kase, href }));
  const href = `/projects/daftar/cases/${publicCase.id}`;

  it.each(locales)("shows the whole story of a public case with its title as the only link (%s)", (locale) => {
    const t = messages[locale];
    const html = card(locale, publicCase, href);
    const links = [...html.matchAll(/<a[^>]*\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];

    expect(links).toHaveLength(1);
    expect(anchors(html)).toBe(1);
    expect(links[0]?.[1]).toBe(`${prefix(locale)}${href}`);
    expect(links[0]?.[2]).toBe(`<bdi>${publicCase.title}</bdi>`);

    const byline = visibleText(
      html.match(/<p class="m-0 flex flex-wrap gap-x-2 text-small text-ink-muted">([\s\S]*?)<\/p>/)?.[1] ?? "",
    );
    expect(html).toContain(`<bdi>${required(publicCase.author).displayName}</bdi>`);
    expect(byline).toContain(required(publicCase.author).displayName);
    expect(byline).toContain(formatDate(publicCase.createdAt, locale));

    expectInOrder(html, [t.Cases.feedbackStory, t.Cases.change, t.Cases.result, t.Cases.oneNumber]);
    expect(sectionOf(html, t.Cases.feedbackStory)).toContain(`<bdi>${publicCase.feedbackStory}</bdi>`);
    expect(sectionOf(html, t.Cases.change)).toContain(`<bdi>${publicCase.change}</bdi>`);
    expect(sectionOf(html, t.Cases.result)).toContain(`<bdi>${publicCase.result}</bdi>`);
    expect(sectionOf(html, t.Cases.oneNumber)).toContain(`<bdi>${required(publicCase.oneNumber)}</bdi>`);

    expect(html).toContain(`<bdi>${required(publicCase.credits[0]?.member).displayName}</bdi>`);
    expect(count(visibleText(html), t.Credits.aMember)).toBe(1);
    expect(html).not.toContain(`title="${t.PublicBadge.publicTitle}"`);
  });

  it.each(locales)("labels a members' case public only when it is, and never names an uncredited giver (%s)", (locale) => {
    const t = messages[locale];
    const open = card(locale, memberCase);
    const closed = card(locale, { ...memberCase, isPublic: false });
    const withheld = required(required(memberCase.feedback[1]).author).displayName;

    expect(count(open, `title="${t.PublicBadge.publicTitle}"`)).toBe(1);
    expect(closed).not.toContain(`title="${t.PublicBadge.publicTitle}"`);
    expect(closed).not.toContain(render(locale, createElement(PublicBadge, { visibility: "members" })));
    expect(memberCase.credits[1]?.member).toBeNull();
    for (const html of [open, closed]) {
      expect(html).not.toContain(withheld);
      for (const item of memberCase.feedback) {
        expect(html).not.toContain(item.excerpt);
      }
      expect(html).toContain(`<bdi>${required(memberCase.credits[0]?.member).displayName}</bdi>`);
    }
  });

  it.each(locales)("has no link without an href, says edited, and drops an empty number (%s)", (locale) => {
    const t = messages[locale].Cases;
    const plain = card(locale, publicCase);
    const edited = card(locale, { ...publicCase, editedAt: "2026-11-03T09:00:00.000Z" });
    const numberless = card(locale, { ...publicCase, oneNumber: null });

    expect(anchors(plain)).toBe(0);
    expect(plain).toContain(`<bdi>${publicCase.title}</bdi>`);
    expect(visibleText(edited)).toContain(t.edited);
    expect(visibleText(plain)).not.toContain(t.edited);
    expect(plain).toContain(`>${t.oneNumber}</h4>`);
    expect(numberless).not.toContain(`>${t.oneNumber}</h4>`);
  });
});

describe("CreditList", () => {
  const list = (locale: Locale, credits: ComponentProps<typeof CreditList>["credits"]) =>
    render(locale, createElement(CreditList, { credits }));

  it.each(locales)("renders nothing without credits (%s)", (locale) => {
    expect(list(locale, [])).toBe("");
  });

  it.each(locales)("names the consenting member and says a member for the rest (%s)", (locale) => {
    const t = messages[locale].Credits;
    const html = list(locale, [
      { member: { handle: "arash", displayName: "آرش" } },
      { member: null },
      { member: null },
    ]);
    const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);

    expect(items).toEqual(["<bdi>آرش</bdi>", t.aMember, t.aMember]);
    expect(html).toContain(`>${t.title}</h4>`);
    expect(html).not.toContain("arash");
    expect(anchors(html)).toBe(0);
    expect(visibleText(html)).not.toMatch(DIGIT);
  });
});

describe("PracticeMonths", () => {
  const months = (locale: Locale, items: readonly Snapshot[]) =>
    render(locale, createElement(PracticeMonths, { snapshots: items }));

  function rows(html: string) {
    const body = html.split("<tbody>")[1] ?? "";

    return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) => ({
      head: row[1]?.match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? "",
      cells: [...(row[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => visibleText(cell[1] ?? "")),
    }));
  }

  it("shows the English table: caption, six headers, two rows in the given order", () => {
    const t = en.Practice;
    const html = months("en", snapshots);
    const headers = [...html.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map((match) => match[1]);
    const [october, september] = rows(html);
    const computed = t.computedAt.replace("{date}", formatDate(required(snapshots[0]).computedAt, "en"));

    expect(html).toContain(`<caption class="sr-only">${t.months}</caption>`);
    expect(headers).toEqual([
      t.month,
      t.members,
      t.membersPostingWip,
      t.projectsWithPublicChangelog,
      t.feedbackAnsweredInWindow,
      t.casesWritten,
    ]);
    expect(rows(html)).toHaveLength(2);
    expect(visibleText(october?.head ?? "")).toBe(`October 2026 ${computed} Rules version 1`);
    expect(visibleText(september?.head ?? "")).toBe(
      `September 2026 ${computed} Rules version 1`,
    );
    // React prints the attribute as dateTime; HTML reads it case-insensitively.
    expect(october?.head).toMatch(/<time datetime="2026-10">October 2026<\/time>/i);
    expect(september?.head).toMatch(/<time datetime="2026-09">September 2026<\/time>/i);
    expect(october?.cells).toEqual(["12", "5", "1", "77% 7 of 9", "1"]);
    expect(september?.cells).toEqual(["3", "1", "0", `— ${t.noShareLabel}`, "0"]);
  });

  it("shows the Persian table with Gregorian month names and Persian digits", () => {
    const html = months("fa", snapshots);
    const [october, september] = rows(html);

    expect(visibleText(october?.head ?? "")).toContain("اکتبر ۲۰۲۶");
    expect(visibleText(september?.head ?? "")).toContain("سپتامبر ۲۰۲۶");
    expect(october?.cells).toEqual(["۱۲", "۵", "۱", "۷۷٪ ۷ از ۹", "۱"]);
    expect(september?.cells).toEqual(["۳", "۱", "۰", `— ${fa.Practice.noShareLabel}`, "۰"]);
    expect(visibleText(html)).not.toMatch(/[0-9]/);
  });

  it("never computes the share: it shows the given one, or a dash", () => {
    const october = required(snapshots[0]);
    const nullShare = rows(months("en", [{ ...october, answeredSharePercent: null }]))[0];
    const given = rows(months("en", [{ ...october, answeredSharePercent: 50 }]))[0];

    expect(nullShare?.cells[3]).toBe(`— ${en.Practice.noShareLabel}`);
    expect(months("en", [{ ...october, answeredSharePercent: null }])).toContain(
      `<span aria-hidden="true">${en.Practice.noShare}</span><span class="sr-only">${en.Practice.noShareLabel}</span>`,
    );
    expect(given?.cells[3]).toBe("50% 7 of 9");
  });

  it.each(locales)("says no month is computed yet, with no table (%s)", (locale) => {
    const html = months(locale, []);

    expect(visibleText(html)).toContain(messages[locale].Practice.empty);
    expect(html).not.toContain("<table");
  });
});

describe("BadgeSnippet", () => {
  const pageUrl = "https://workaholics.example/projects/daftar";

  it("builds the exact embed code in both languages", () => {
    expect(
      badgeEmbedCode({
        pageUrl,
        imageUrl: "https://workaholics.example/badge/daftar.svg?lang=fa",
        alt: fa.Badge.text,
      }),
    ).toBe(
      `<a href="https://workaholics.example/projects/daftar"><img src="https://workaholics.example/badge/daftar.svg?lang=fa" alt="${fa.Badge.text}"></a>`,
    );
    expect(
      badgeEmbedCode({
        pageUrl: "https://workaholics.example/en/projects/daftar",
        imageUrl: "https://workaholics.example/badge/daftar.svg?lang=en",
        alt: en.Badge.text,
      }),
    ).toBe(
      `<a href="https://workaholics.example/en/projects/daftar"><img src="https://workaholics.example/badge/daftar.svg?lang=en" alt="Building in public at Workaholics"></a>`,
    );
  });

  it("escapes the three values for an attribute, ampersand first", () => {
    expect(badgeEmbedCode({ pageUrl, imageUrl: "https://x.example/b.svg?a=1&b=2", alt: 'a "b" <c> & d' })).toBe(
      `<a href="${pageUrl}"><img src="https://x.example/b.svg?a=1&amp;b=2" alt="a &quot;b&quot; &lt;c&gt; &amp; d"></a>`,
    );
  });

  it.each(locales)("renders a read-only code box with the copy button (%s)", (locale) => {
    const t = messages[locale].Badge;
    const imageUrl = `https://workaholics.example/badge/daftar.svg?lang=${locale}`;
    const html = render(locale, createElement(BadgeSnippet, { pageUrl, imageUrl }));
    const area = html.match(/<textarea([^>]*)>([\s\S]*?)<\/textarea>/);
    const attrs = attrsOf(area?.[1] ?? "");
    const rest = html.replace(/<textarea[\s\S]*?<\/textarea>/, "");

    expect(count(html, "<textarea")).toBe(1);
    expect(attrs.readOnly).toBe("");
    expect(attrs.dir).toBe("ltr");
    expect(decode(area?.[2] ?? "")).toBe(badgeEmbedCode({ pageUrl, imageUrl, alt: t.text }));
    expect(attrs.name).toBeUndefined();

    const text = visibleText(rest);
    expect(text).toContain(t.snippetTitle);
    expect(text).toContain(t.snippetHint);
    expect(text).toContain(t.snippetLabel);
    expect(rest).toMatch(new RegExp(`<button[^>]*>${t.copy}</button>`));
    expect(text).not.toContain(t.copied);
    expect(text).not.toMatch(DIGIT);
  });
});

describe("ProjectCard one-liner", () => {
  const project: Project = {
    slug: "daftar",
    name: "دفتر",
    oneLiner: "دفترچه‌ی کار مشترک.",
    stage: "building",
    visibility: "members",
    links: [],
    owners: [{ handle: "sara", displayName: "سارا رحیمی" }],
    lastPostAt: null,
    hasUnansweredFeedback: false,
    createdAt: "2026-10-17T08:00:00Z",
    updatedAt: "2026-10-17T08:00:00Z",
  };

  it.each(locales)("sets the description in its own bdi (%s)", (locale) => {
    const html = render(locale, createElement(ProjectCard, { project, locale }));

    expect(html).toContain(`<p class="m-0 text-ink"><bdi>${project.oneLiner}</bdi></p>`);
    expect(
      render(locale, createElement(ProjectCard, { project: { ...project, oneLiner: "" }, locale })),
    ).not.toContain('<p class="m-0 text-ink">');
  });
});
