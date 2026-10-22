import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { Post } from "@/components/post/post";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import contract from "../contract/openapi.json";

type PostData = components["schemas"]["Post"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;
const now = new Date("2026-10-20T12:00:00.000Z");

const posts = contract.components.schemas.PostPage.example
  .items as PostData[];

// The contract's example page: an update that acted on two items, then the
// work in progress it answers (with feedback still waiting).
function example(index: number): PostData {
  const post = posts[index];

  if (!post) {
    throw new Error(`the contract's PostPage example has no item ${index}`);
  }

  return post;
}

const update = example(0);
const wip = example(1);

function required(value: string | null | undefined): string {
  if (!value) {
    throw new Error("the example is missing a value this test reads");
  }

  return value;
}

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

type Options = {
  variant?: "full" | "compact";
  showThreadLink?: boolean;
  canGiveFeedback?: boolean;
  now?: Date;
};

function render(locale: Locale, post: PostData, options: Options = {}) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(Post, {
        post,
        locale,
        variant: "full",
        showThreadLink: false,
        canGiveFeedback: false,
        now,
        ...options,
      }),
    ),
  );
}

function visibleText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hrefs(html: string) {
  return [...html.matchAll(/<a[^>]*\shref="([^"]*)"/g)].map((match) => match[1]);
}

// The `<section>` that carries a heading, or undefined when it is not shown.
function sectionOf(html: string, heading: string) {
  return html
    .split("<section")
    .map((part) => part.split("</section>")[0] ?? "")
    .find((part) => part.includes(`>${heading}</h4>`));
}

function listItems(html: string) {
  return [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("Post: work in progress", () => {
  it.each(locales)("lists the questions in the well, in order (%s)", (locale) => {
    const html = render(locale, wip);
    const well = sectionOf(html, messages[locale].Posts.feedbackWanted);

    expect(well).toBeDefined();
    expect(well).toContain("<ol");
    expect(listItems(well ?? "")).toEqual(
      wip.feedbackWanted.map((question) => `<bdi>${question}</bdi>`),
    );
  });

  it.each(locales)("shows the self-critique in full (%s)", (locale) => {
    const html = render(locale, wip, { variant: "full" });
    const critique = sectionOf(html, messages[locale].Posts.selfCritique);

    expect(critique).toContain(`<bdi>${wip.selfCritique}</bdi>`);
  });

  it.each(locales)("leaves the self-critique out of compact (%s)", (locale) => {
    const html = render(locale, wip, { variant: "compact" });

    expect(html).not.toContain(required(wip.selfCritique));
    expect(visibleText(html)).not.toContain(messages[locale].Posts.selfCritique);
    // The questions are the ask, so they stay.
    expect(sectionOf(html, messages[locale].Posts.feedbackWanted)).toBeDefined();
  });

  it.each(locales)("shows no self-critique heading when there is none (%s)", (locale) => {
    const html = render(locale, { ...wip, selfCritique: null });

    expect(visibleText(html)).not.toContain(messages[locale].Posts.selfCritique);
  });

  it.each(locales)("shows the unanswered chip in compact only with unanswered feedback (%s)", (locale) => {
    const chip = messages[locale].ResponseChip.hasUnanswered;

    expect(wip.hasUnansweredFeedback).toBe(true);
    expect(visibleText(render(locale, wip, { variant: "compact" }))).toContain(
      chip,
    );
    expect(
      visibleText(
        render(locale, { ...wip, hasUnansweredFeedback: false }, {
          variant: "compact",
        }),
      ),
    ).not.toContain(chip);
  });

  it.each(locales)("does not show the unanswered chip in full (%s)", (locale) => {
    expect(visibleText(render(locale, wip, { variant: "full" }))).not.toContain(
      messages[locale].ResponseChip.hasUnanswered,
    );
  });

  it.each(locales)("shows the body, and none when it is empty (%s)", (locale) => {
    expect(render(locale, wip)).toContain(`<bdi>${wip.body}</bdi>`);
    expect(render(locale, { ...wip, body: "" })).not.toContain("<bdi></bdi>");
  });

  it("shows the kind, the author and the date in the head row", () => {
    const persian = visibleText(render("fa", wip));
    expect(persian).toContain(fa.Posts.wip);
    expect(persian).toContain(required(wip.author?.displayName));
    expect(persian).toContain("۲۳ مهر");

    const english = visibleText(render("en", wip));
    expect(english).toContain("Work in progress");
    expect(english).toContain(required(wip.author?.displayName));
    expect(english).toContain("15 Oct");
  });

});

describe("Post: update", () => {
  it.each(locales)("shows the sections in the template's order (%s)", (locale) => {
    const html = render(locale, update);
    const copy = messages[locale].Posts;
    const order = [
      copy.whatChanged,
      copy.actedOn,
      copy.rejectedAndWhy,
      copy.oneNumber,
    ].map((heading) => html.indexOf(`>${heading}</h4>`));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it.each(locales)("shows what changed and what was rejected, as written (%s)", (locale) => {
    const html = render(locale, update);
    const copy = messages[locale].Posts;

    expect(sectionOf(html, copy.whatChanged)).toContain(
      `<bdi>${update.whatChanged}</bdi>`,
    );
    expect(sectionOf(html, copy.rejectedAndWhy)).toContain(
      `<bdi>${update.rejectedAndWhy}</bdi>`,
    );
  });

  it.each(locales)("shows no feedback questions on an update (%s)", (locale) => {
    const html = render(locale, update);

    expect(visibleText(html)).not.toContain(messages[locale].Posts.feedbackWanted);
    expect(visibleText(html)).not.toContain(messages[locale].Posts.selfCritique);
  });

  it.each(locales)("tags each acted-on item with the answer it got (%s)", (locale) => {
    const section = sectionOf(render(locale, update), messages[locale].Posts.actedOn);
    const [first, second] = listItems(section ?? "");
    const [accepted, testing] = update.actedOn;

    expect(listItems(section ?? "")).toHaveLength(2);
    expect(first).toContain(`<bdi>${accepted?.excerpt}</bdi>`);
    expect(first).toContain(`<bdi>${accepted?.author?.displayName}</bdi>`);
    expect(visibleText(first ?? "")).toContain(
      messages[locale].ResponseChip.accepted,
    );
    expect(visibleText(first ?? "")).not.toContain(
      required(messages[locale].ResponseChip.testing.split("{")[0]),
    );

    expect(second).toContain(`<bdi>${testing?.excerpt}</bdi>`);
    expect(visibleText(second ?? "")).toContain(
      locale === "fa" ? "نتیجه تا ۲۴ آبان" : "results by 15 Nov",
    );
  });

  it("tags a rejected acted-on item", () => {
    const rejected: PostData = {
      ...update,
      actedOn: [
        {
          feedbackId: "0199f1a2-7c3e-7a10-8000-000000000204",
          author: { handle: "sara", displayName: "Sara" },
          excerpt: "Shorter, please.",
          status: "rejected",
          recheckOn: null,
        },
      ],
    };
    const text = visibleText(render("en", rejected));

    expect(text).toContain("Shorter, please.");
    expect(text).toContain("Rejected");
  });

  it("shows an acted-on testing item without a date with no tag", () => {
    const untagged: PostData = {
      ...update,
      actedOn: [
        {
          feedbackId: "0199f1a2-7c3e-7a10-8000-000000000205",
          author: { handle: "sara", displayName: "Sara" },
          excerpt: "Try it on more people.",
          status: "testing",
          recheckOn: null,
        },
      ],
    };
    const text = visibleText(render("en", untagged));

    expect(text).toContain("Try it on more people.");
    expect(text).not.toContain("Testing");
  });

  it.each(locales)("shows the one number as plain text (%s)", (locale) => {
    const section = sectionOf(render(locale, update), messages[locale].Posts.oneNumber);

    expect(section).toBeDefined();
    expect(section).toContain(`<p class="m-0 max-w-read"><bdi>${update.oneNumber}</bdi></p>`);
    // Nothing but the heading, the paragraph and the isolating tag: no
    // emphasis, no badge, no big figure.
    expect(
      (section ?? "").replace(/<\/?(h4|p|bdi)\b[^>]*>/g, "").replace(/^[^>]*>/, ""),
    ).toBe(`${messages[locale].Posts.oneNumber}${update.oneNumber}`);
  });

  it.each(locales)("leaves out a section that has nothing in it (%s)", (locale) => {
    const html = render(locale, {
      ...update,
      whatChanged: null,
      actedOn: [],
      rejectedAndWhy: null,
      oneNumber: null,
    });
    const copy = messages[locale].Posts;

    for (const heading of [
      copy.whatChanged,
      copy.actedOn,
      copy.rejectedAndWhy,
      copy.oneNumber,
    ]) {
      expect(visibleText(html)).not.toContain(heading);
    }
  });
});

describe("Post: links", () => {
  const editable = new Date("2026-10-20T12:10:00.000Z").toISOString();
  const closed = new Date("2026-10-20T11:50:00.000Z").toISOString();
  const threadPath = `/projects/${wip.project.slug}/posts/${wip.id}`;

  it.each(locales)("links to the edit page while the window is open (%s)", (locale) => {
    const prefix = locale === "en" ? "/en" : "";

    expect(hrefs(render(locale, { ...wip, editableUntil: editable }))).toEqual([
      `${prefix}${threadPath}/edit`,
    ]);
  });

  it.each(locales)("hides the edit link when the window has closed or never opened (%s)", (locale) => {
    expect(render(locale, { ...wip, editableUntil: closed })).not.toContain(
      "/edit",
    );
    expect(render(locale, { ...wip, editableUntil: null })).not.toContain(
      "/edit",
    );
    expect(hrefs(render(locale, wip))).toEqual([]);
  });

  it("closes the window at exactly the editable-until time", () => {
    const html = render("en", { ...wip, editableUntil: now.toISOString() });

    expect(html).not.toContain("/edit");
  });

  it("is decided by the now it is given", () => {
    const post = { ...wip, editableUntil: editable };

    expect(render("en", post, { now: new Date("2026-10-20T12:09:59.000Z") }))
      .toContain("/edit");
    expect(render("en", post, { now: new Date("2026-10-20T12:10:01.000Z") }))
      .not.toContain("/edit");
  });

  it.each(locales)("shows edited when it was edited, and only then (%s)", (locale) => {
    const edited = messages[locale].Posts.edited;

    expect(visibleText(render(locale, wip))).not.toContain(edited);
    expect(
      visibleText(render(locale, { ...wip, editedAt: "2026-10-15T09:05:00.000Z" })),
    ).toContain(edited);
  });

  it.each(locales)("toggles the give-feedback link with canGiveFeedback (%s)", (locale) => {
    const prefix = locale === "en" ? "/en" : "";
    const give = `${prefix}${threadPath}#give-feedback`;

    expect(hrefs(render(locale, wip, { canGiveFeedback: true }))).toEqual([give]);
    expect(visibleText(render(locale, wip, { canGiveFeedback: true }))).toContain(
      messages[locale].Posts.giveFeedback,
    );
    expect(hrefs(render(locale, wip, { canGiveFeedback: false }))).toEqual([]);
  });

  it.each(locales)("toggles the thread link with showThreadLink (%s)", (locale) => {
    const prefix = locale === "en" ? "/en" : "";

    expect(hrefs(render(locale, wip, { showThreadLink: true }))).toEqual([
      `${prefix}${threadPath}`,
    ]);
    expect(hrefs(render(locale, wip, { showThreadLink: false }))).toEqual([]);
  });

  it.each(locales)("shows both links when both are asked for (%s)", (locale) => {
    const prefix = locale === "en" ? "/en" : "";

    expect(
      hrefs(render(locale, wip, { showThreadLink: true, canGiveFeedback: true })),
    ).toEqual([`${prefix}${threadPath}`, `${prefix}${threadPath}#give-feedback`]);
  });
});
