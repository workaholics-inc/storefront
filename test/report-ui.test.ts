import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import contract from "../contract/openapi.json";
import { FeedbackItem, type FeedbackControls } from "@/components/feedback/feedback-item";
import { ReportForm, type ReportKind } from "@/components/moderation/report-form";
import { Post } from "@/components/post/post";
import type { HiddenMark } from "@/components/ui/hidden-placeholder";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import type { FormState } from "@/lib/form-state";

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

// PostPage's second item is a work in progress; FeedbackPage's fourth item is
// a rejected answer with one reply.
const wip = required(posts[1]);
const rejected = required(items[3]);

const hidden: HiddenMark = {
  reason: "Spam link (test)",
  role: "moderator",
  at: "2026-12-07T10:00:00.000Z",
};

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

// A report control the page would build (a form), as a marker that names itself.
function reportControl(name: string) {
  return createElement("form", { "data-report": name });
}

async function noop(state: FormState): Promise<FormState> {
  return state;
}

function renderReportForm(locale: Locale, kind: ReportKind, idPrefix = "report-x", reasonMax = 321) {
  return render(
    locale,
    createElement(ReportForm, { idPrefix, action: noop, kind, reasonMax }),
  );
}

function renderPost(locale: Locale, post: PostData, report?: ReactElement) {
  return render(
    locale,
    createElement(Post, {
      post,
      locale,
      variant: "full",
      showThreadLink: false,
      canGiveFeedback: false,
      now,
      report,
    }),
  );
}

function renderItem(locale: Locale, item: FeedbackItemData, controls?: FeedbackControls) {
  return render(locale, createElement(FeedbackItem, { item, locale, controls }));
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// The text of each `<summary>` in the markup.
function summaries(html: string) {
  return [...html.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map((match) =>
    visibleText(match[1] ?? ""),
  );
}

function reportFormsIn(html: string) {
  return [...html.matchAll(/data-report="([^"]*)"/g)].map((match) => match[1]);
}

function attributeOf(tag: string, name: string) {
  // HTML attribute names are case-insensitive; the serializer writes `maxLength`.
  return new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
}

describe("ReportForm", () => {
  const labelKey = {
    post: "reasonPost",
    feedback: "reasonFeedback",
    reply: "reasonReply",
  } as const;

  describe.each(locales)("(%s)", (locale) => {
    const copy = messages[locale].Reports;

    it.each(["post", "feedback", "reply"] as const)(
      "asks the reason for a %s in that kind's words, in a textarea that holds the limit",
      (kind) => {
        const html = renderReportForm(locale, kind, "report-abc", 321);
        const label = new RegExp(`<label\\b[^>]*\\sfor="report-abc-reason"[^>]*>([\\s\\S]*?)</label>`).exec(html);
        const textarea = /<textarea\b[^>]*>/.exec(html)?.[0] ?? "";

        expect(visibleText(label?.[1] ?? "")).toContain(copy[labelKey[kind]]);
        expect(attributeOf(textarea, "id")).toBe("report-abc-reason");
        expect(attributeOf(textarea, "name")).toBe("reason");
        expect(attributeOf(textarea, "maxlength")).toBe("321");
      },
    );

    it("tells what is asked, that a report hides nothing, and has a send button", () => {
      const html = renderReportForm(locale, "post");
      const button = /<button\b[^>]*>([\s\S]*?)<\/button>/.exec(html);

      expect(visibleText(html)).toContain(copy.reasonHint);
      expect(visibleText(html)).toContain(copy.note);
      expect(button).not.toBeNull();
      expect(visibleText(button?.[1] ?? "")).toBe(copy.send);
      expect(html).toMatch(/<button\b[^>]*\stype="submit"/);
    });

    it("takes the limit it is given, not a fixed one", () => {
      const textarea = /<textarea\b[^>]*>/.exec(renderReportForm(locale, "feedback", "r", 40))?.[0] ?? "";

      expect(attributeOf(textarea, "maxlength")).toBe("40");
    });

    it("starts with an empty reason", () => {
      const html = renderReportForm(locale, "reply");
      const body = /<textarea\b[^>]*>([\s\S]*?)<\/textarea>/.exec(html)?.[1];

      expect(body).toBe("");
    });
  });
});

describe("Post: report", () => {
  const hiddenWip: PostData = {
    ...wip,
    body: "",
    feedbackWanted: [],
    selfCritique: null,
    hasUnansweredFeedback: false,
    editableUntil: null,
    hidden,
  };

  it.each(locales)("offers one report summary that holds the form (%s)", (locale) => {
    const html = renderPost(locale, wip, reportControl("post"));
    const link = messages[locale].Reports.link;

    expect(summaries(html)).toEqual([link]);
    expect(html).toContain("<summary");
    expect(reportFormsIn(html)).toEqual(["post"]);
    // The form sits inside the disclosure that the summary opens.
    const details = /<details\b[^>]*>([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
    expect(details).toContain('data-report="post"');
    expect(details.indexOf("<summary")).toBeLessThan(details.indexOf("data-report"));
  });

  it.each(locales)("offers neither the summary nor the form on a hidden post (%s)", (locale) => {
    const html = renderPost(locale, hiddenWip, reportControl("post"));

    expect(html).not.toContain("<summary");
    expect(html).not.toContain("data-report");
    expect(visibleText(html)).not.toContain(messages[locale].Reports.link);
  });

  it.each(locales)("has no report link when the page gave none (%s)", (locale) => {
    const html = renderPost(locale, wip);

    expect(summaries(html)).toEqual([]);
    expect(html).not.toContain("data-report");
    expect(visibleText(html)).not.toContain(messages[locale].Reports.link);
  });
});

describe("FeedbackItem: report", () => {
  const reply = required(rejected.replies[0]);
  const first = { ...reply, body: "First reply" };
  const second = {
    ...reply,
    id: "0199f1a2-7c3e-7a10-8000-000000000402",
    body: "Second reply",
    createdAt: "2026-10-24T09:00:00.000Z",
  };
  const item: FeedbackItemData = { ...rejected, replies: [first, second] };

  it.each(locales)("offers one report summary that holds the form (%s)", (locale) => {
    const html = renderItem(locale, item, { report: reportControl("feedback") });

    expect(summaries(html)).toEqual([messages[locale].Reports.link]);
    expect(reportFormsIn(html)).toEqual(["feedback"]);
    const details = /<details\b[^>]*>([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
    expect(details).toContain('data-report="feedback"');
  });

  it.each(locales)("offers neither the summary nor the form on a hidden item (%s)", (locale) => {
    const html = renderItem(
      locale,
      { ...item, body: "", hidden },
      { report: reportControl("feedback") },
    );

    expect(html).not.toContain("<summary");
    expect(html).not.toContain("data-report");
    expect(visibleText(html)).not.toContain(messages[locale].Reports.link);
  });

  it.each(locales)("has no report link when the page gave none (%s)", (locale) => {
    const html = renderItem(locale, item, {});

    expect(summaries(html)).toEqual([]);
    expect(html).not.toContain("data-report");
  });

  it.each(locales)("puts a reply's report form after that reply and not after the other (%s)", (locale) => {
    const html = renderItem(locale, item, {
      reportReplies: { [second.id]: reportControl("reply") },
    });
    const formAt = html.indexOf('data-report="reply"');

    expect(reportFormsIn(html)).toEqual(["reply"]);
    expect(summaries(html)).toEqual([messages[locale].Reports.link]);
    expect(formAt).toBeGreaterThan(html.indexOf(second.body));
    // Nothing between the first reply's body and the second's holds a form.
    expect(html.slice(html.indexOf(first.body), html.indexOf(second.body))).not.toContain(
      "data-report",
    );
  });

  it.each(locales)("puts it after the first reply when the form is for the first (%s)", (locale) => {
    // Guards the case above: the position follows the reply the form is keyed to.
    const html = renderItem(locale, item, {
      reportReplies: { [first.id]: reportControl("reply") },
    });
    const formAt = html.indexOf('data-report="reply"');

    expect(formAt).toBeGreaterThan(html.indexOf(first.body));
    expect(formAt).toBeLessThan(html.indexOf(second.body));
  });

  it.each(locales)("offers no report on a hidden reply (%s)", (locale) => {
    const hiddenSecond = { ...second, body: "", hidden };
    const html = renderItem(
      locale,
      { ...item, replies: [first, hiddenSecond] },
      { reportReplies: { [second.id]: reportControl("reply") } },
    );

    expect(html).not.toContain("data-report");
    expect(html).not.toContain("<summary");
  });

  it.each(locales)("keeps a visible reply's report form under a hidden item (%s)", (locale) => {
    // The report follows the reply's own mark, not the item's: the item's form
    // is gone, the second reply (still visible) keeps its own, after its body.
    const html = renderItem(
      locale,
      { ...item, body: "", hidden },
      { report: reportControl("feedback"), reportReplies: { [second.id]: reportControl("reply") } },
    );

    expect(reportFormsIn(html)).toEqual(["reply"]);
    expect(summaries(html)).toEqual([messages[locale].Reports.link]);
    expect(html.indexOf('data-report="reply"')).toBeGreaterThan(html.indexOf(second.body));
    expect(html).not.toContain('data-report="feedback"');
  });
});
