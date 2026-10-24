import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import contract from "../contract/openapi.json";
import { FeedbackItem, type FeedbackControls } from "@/components/feedback/feedback-item";
import { FeedbackSummary } from "@/components/feedback/feedback-summary";
import { Post } from "@/components/post/post";
import type { HiddenMark } from "@/components/ui/hidden-placeholder";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";

type PostData = components["schemas"]["Post"];
type FeedbackItemData = components["schemas"]["FeedbackItem"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;
const now = new Date("2026-10-20T12:00:00.000Z");

const posts = contract.components.schemas.PostPage.example.items as PostData[];
const items = contract.components.schemas.FeedbackPage.example.items as FeedbackItemData[];

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("the example is missing a value this test reads");
  }

  return value;
}

// The contract's examples: PostPage is an update that acted on two items, then
// the work in progress it answers; FeedbackPage's fourth item is a rejected
// answer with one reply and its third an accepted answer.
const update = required(posts[0]);
const wip = required(posts[1]);
const rejected = required(items[3]);
const accepted = required(items[2]);

const hidden: HiddenMark = {
  reason: "Spam link (test)",
  role: "moderator",
  at: "2026-12-07T10:00:00.000Z",
};
const former = { handle: "former-0199f1a2", displayName: "" };

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

type PostOptions = { showThreadLink?: boolean; canGiveFeedback?: boolean };

function renderPost(locale: Locale, post: PostData, options: PostOptions = {}) {
  return render(
    locale,
    createElement(Post, {
      post,
      locale,
      variant: "full",
      showThreadLink: false,
      canGiveFeedback: false,
      now,
      ...options,
    }),
  );
}

function renderItem(locale: Locale, item: FeedbackItemData, controls?: FeedbackControls) {
  return render(locale, createElement(FeedbackItem, { item, locale, controls }));
}

// A control the page would build (a form), as a marker that names itself.
function control(name: string) {
  return createElement("form", { "data-control": name });
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

// The text with its tags dropped and no space put in their place, so one
// message that holds a `<n>` tag reads as it was written.
function joined(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function hrefs(html: string) {
  return [...html.matchAll(/<a[^>]*\shref="([^"]*)"/g)].map((match) => match[1]);
}

function controlsIn(html: string) {
  return [...html.matchAll(/data-control="([^"]*)"/g)].map((match) => match[1]);
}

// The `<section>` that carries a heading, or undefined when it is not shown.
function sectionOf(html: string, heading: string) {
  return html
    .split("<section")
    .map((part) => part.split("</section>")[0] ?? "")
    .find((part) => part.includes(`>${heading}</h4>`));
}

function listItems(html: string) {
  return [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1] ?? "");
}

const prefix = (locale: Locale) => (locale === "fa" ? "" : "/en");

// How many block placeholders the markup holds: the title with the line that
// says who hid it and when, and the reason the mark carries.
function blockPlaceholders(html: string, locale: Locale) {
  const t = messages[locale].Hidden;
  const line = t.byModerator.replace("{date}", formatDate(hidden.at, locale));

  return [...html.matchAll(/<div[^>]*><p[^>]*>([^<]*)<\/p><p[^>]*>([^<]*)<\/p>/g)].filter(
    (match) => match[1] === t.title && match[2] === line,
  ).length;
}

function inlinePlaceholder(locale: Locale) {
  return `<span class="text-ink-muted">${messages[locale].Hidden.title}</span>`;
}

describe("Post: hidden", () => {
  const threadPath = `/projects/${wip.project.slug}/posts/${wip.id}`;
  const hiddenWip: PostData = {
    ...wip,
    body: "",
    feedbackWanted: [],
    selfCritique: null,
    hasUnansweredFeedback: false,
    editableUntil: new Date("2026-10-20T13:00:00.000Z").toISOString(),
    hidden,
  };

  it.each(locales)("shows a placeholder, and no ask, edit or give-feedback (%s)", (locale) => {
    const html = renderPost(locale, hiddenWip, { showThreadLink: true, canGiveFeedback: true });
    const copy = messages[locale].Posts;

    expect(blockPlaceholders(html, locale)).toBe(1);
    expect(html).toContain("<bdi>Spam link (test)</bdi>");
    expect(html).not.toContain(`>${copy.feedbackWanted}</h4>`);
    expect(html).not.toContain(`>${copy.selfCritique}</h4>`);
    expect(visibleText(html)).not.toContain(copy.feedbackWanted);
    expect(visibleText(html)).not.toContain(copy.selfCritique);
    expect(visibleText(html)).not.toContain(copy.giveFeedback);
    expect(html).not.toContain("/edit");
    expect(html).not.toContain("#give-feedback");
  });

  it.each(locales)("keeps the link to the thread (%s)", (locale) => {
    const html = renderPost(locale, hiddenWip, { showThreadLink: true, canGiveFeedback: true });

    expect(hrefs(html)).toContain(`${prefix(locale)}${threadPath}`);
    expect(visibleText(html)).toContain(messages[locale].Posts.openThread);
  });

  it.each(locales)("has no footer links when the thread link is not asked for (%s)", (locale) => {
    const html = renderPost(locale, hiddenWip, { showThreadLink: false, canGiveFeedback: true });

    // The only link left is the placeholder's, to the moderation log.
    expect(hrefs(html)).toEqual([`${prefix(locale)}/moderation`]);
    expect(visibleText(html)).not.toContain(messages[locale].Posts.openThread);
    expect(visibleText(html)).not.toContain(messages[locale].Posts.giveFeedback);
  });

  it.each(locales)("is the same post with the mark taken off that offers all of it (%s)", (locale) => {
    // Guards the cases above: the same fixture without the mark does offer them.
    const visible: PostData = { ...hiddenWip, hidden: null, feedbackWanted: ["Q?"] };
    const html = renderPost(locale, visible, { showThreadLink: true, canGiveFeedback: true });

    expect(blockPlaceholders(html, locale)).toBe(0);
    expect(html).toContain(`>${messages[locale].Posts.feedbackWanted}</h4>`);
    expect(html).toContain("/edit");
    expect(html).toContain("#give-feedback");
  });
});

describe("Post: a hidden acted-on item", () => {
  const [first, second] = update.actedOn;
  const withHiddenItem: PostData = {
    ...update,
    actedOn: [{ ...required(first), excerpt: "", hidden }, required(second)],
  };

  it.each(locales)("shows an inline placeholder in it and keeps the rest (%s)", (locale) => {
    const html = renderPost(locale, withHiddenItem);
    const section = sectionOf(html, messages[locale].Posts.actedOn);
    const [hiddenRow, otherRow] = listItems(section ?? "");

    expect(listItems(section ?? "")).toHaveLength(2);
    expect(hiddenRow).toContain(inlinePlaceholder(locale));
    expect(hiddenRow).not.toContain("<bdi></bdi>");
    expect(hiddenRow).toContain(`<bdi>${required(first?.author).displayName}</bdi>`);
    expect(visibleText(hiddenRow ?? "")).toContain(messages[locale].ResponseChip.accepted);

    expect(otherRow).toContain(`<bdi>${required(second).excerpt}</bdi>`);
    expect(otherRow).not.toContain(inlinePlaceholder(locale));
    // Only the item is hidden, not the post.
    expect(blockPlaceholders(html, locale)).toBe(0);
  });
});

describe("Post: a former member's post", () => {
  it.each(locales)("starts the byline with the former-member label, with no empty bdi (%s)", (locale) => {
    const html = renderPost(locale, { ...wip, author: former });

    expect(visibleText(html)).toContain(messages[locale].Feedback.formerMemberStart);
    expect(html).not.toContain("<bdi></bdi>");
  });
});

describe("FeedbackItem: hidden", () => {
  const reply = required(rejected.replies[0]);
  const second = {
    ...reply,
    id: "0199f1a2-7c3e-7a10-8000-000000000402",
    body: "Second reply",
    createdAt: "2026-10-24T09:00:00.000Z",
  };
  // The first reply is hidden too; the second stays visible.
  const hiddenReply = { ...reply, body: "", hidden };
  const hiddenItem: FeedbackItemData = {
    ...rejected,
    body: "",
    replies: [hiddenReply, second],
    hidden,
  };
  const everything: FeedbackControls = {
    answer: control("answer"),
    editAnswer: control("editAnswer"),
    reply: control("reply"),
    edit: control("edit"),
    editReplies: {
      [reply.id]: control("editReply"),
      [second.id]: control("editSecond"),
    },
  };

  it.each(locales)("is a placeholder in place of the body, with the question and the answer kept (%s)", (locale) => {
    const html = renderItem(locale, hiddenItem, everything);
    const response = required(rejected.response);

    // One for the item's body, one for the hidden first reply.
    expect(blockPlaceholders(html, locale)).toBe(2);
    expect(html).toContain("<bdi>Spam link (test)</bdi>");
    expect(html).not.toContain("<bdi></bdi>");
    expect(html).toContain(`<bdi>${required(rejected.question)}</bdi>`);
    expect(visibleText(html)).toContain(messages[locale].Feedback.about.split("<n>")[0]?.trim());
    expect(html).toContain(`<bdi>${response.reason}</bdi>`);
    expect(html).toContain(`<bdi>${second.body}</bdi>`);
  });

  it.each(locales)("drops its own controls and a hidden reply's, and keeps a visible reply's (%s)", (locale) => {
    const html = renderItem(locale, hiddenItem, everything);

    // The item's own controls (answer, editAnswer, reply, edit) and the hidden
    // reply's edit control are gone; the visible reply keeps its own.
    expect(controlsIn(html)).toEqual(["editSecond"]);
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html.indexOf("editSecond")).toBeGreaterThan(html.indexOf(second.body));
  });

  it.each(locales)("offers no answer control in the empty answer slot either (%s)", (locale) => {
    const html = renderItem(locale, { ...hiddenItem, response: null }, everything);

    expect(html).toContain(messages[locale].Feedback.noAnswerYet);
    expect(controlsIn(html)).toEqual(["editSecond"]);
    expect(controlsIn(renderItem(locale, { ...hiddenItem, response: null, hidden: null }, everything))).toContain(
      "answer",
    );
  });

  it.each(locales)("is the same item with the marks taken off that offers every control (%s)", (locale) => {
    // Guards the case above: the same item and replies without the marks do
    // render them all.
    const html = renderItem(
      locale,
      { ...hiddenItem, body: "Visible", hidden: null, replies: [reply, second] },
      everything,
    );

    expect(controlsIn(html).sort()).toEqual(
      ["answer", "edit", "editAnswer", "editReply", "editSecond", "reply"].sort(),
    );
  });
});

describe("FeedbackItem: a hidden reply", () => {
  const reply = required(rejected.replies[0]);
  const hiddenReply = {
    ...reply,
    author: { handle: "kian", displayName: "کیان نوری" },
    body: "",
    hidden,
  };
  const second = {
    ...reply,
    id: "0199f1a2-7c3e-7a10-8000-000000000402",
    body: "Second reply",
    createdAt: "2026-10-24T09:00:00.000Z",
  };
  const item: FeedbackItemData = { ...rejected, replies: [hiddenReply, second] };
  const controls: FeedbackControls = {
    editReplies: {
      [hiddenReply.id]: control("editHidden"),
      [second.id]: control("editSecond"),
    },
  };

  it.each(locales)("shows the placeholder for it, with its byline, and the other reply as written (%s)", (locale) => {
    const html = renderItem(locale, item, controls);

    expect(blockPlaceholders(html, locale)).toBe(1);
    expect(html).toContain("<bdi>کیان نوری</bdi>");
    expect(visibleText(html)).toContain(formatDate(hiddenReply.createdAt, locale));
    expect(html).not.toContain("<bdi></bdi>");
    expect(html).toContain(`<bdi>${second.body}</bdi>`);
    // The placeholder stands where the hidden reply's body would.
    expect(html.indexOf("کیان نوری")).toBeLessThan(html.indexOf(">" + messages[locale].Hidden.title));
    expect(html.indexOf(messages[locale].Hidden.title)).toBeLessThan(html.indexOf(second.body));
  });

  it.each(locales)("drops the hidden reply's edit control and keeps the other's (%s)", (locale) => {
    const html = renderItem(locale, item, controls);

    expect(controlsIn(html)).toEqual(["editSecond"]);
    expect(html.indexOf("editSecond")).toBeGreaterThan(html.indexOf(second.body));
  });
});

describe("FeedbackItem: former members", () => {
  it("names a former author and a former responder, each as its position needs (en)", () => {
    const response = required(rejected.response);
    const item: FeedbackItemData = {
      ...rejected,
      author: former,
      response: { ...response, responder: former },
      replies: [],
    };
    const copy = en.Feedback;
    const html = renderItem("en", item);
    const answerLine = copy.answerBy
      .replace("<n>{name}</n>", copy.formerMember)
      .replace("{date}", formatDate(response.createdAt, "en"));

    // The byline starts with the name, so it takes the capital.
    expect(html).toContain(`<bdi>${copy.formerMemberStart}</bdi>`);
    expect(html).not.toContain("<bdi></bdi>");
    // The answer line holds the name in the middle of a sentence.
    expect(joined(html)).toContain(answerLine);
    expect(joined(html)).toContain("Answer from a former member");
  });
});

describe("FeedbackSummary: hidden", () => {
  const hiddenItem: FeedbackItemData = { ...accepted, body: "", hidden };

  it.each(locales)("puts the inline placeholder inside the link and keeps both chips (%s)", (locale) => {
    const html = render(
      locale,
      createElement(FeedbackSummary, { item: hiddenItem, locale, showProject: false }),
    );
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    const inside = links[0]?.[2] ?? "";
    const chips = messages[locale].ResponseChip;

    expect(links).toHaveLength(1);
    expect(inside).toContain(inlinePlaceholder(locale));
    expect(inside).not.toContain("<bdi></bdi>");
    expect(blockPlaceholders(html, locale)).toBe(0);
    expect(visibleText(inside)).toContain(chips.answeredSameDay);
    expect(visibleText(inside)).toContain(chips.accepted);
  });
});
