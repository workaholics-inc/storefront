import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import {
  FeedbackItem,
  type FeedbackControls,
  type FeedbackNotice,
} from "@/components/feedback/feedback-item";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import contract from "../contract/openapi.json";

type FeedbackItemData = components["schemas"]["FeedbackItem"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;

const items = contract.components.schemas.FeedbackPage.example
  .items as FeedbackItemData[];

// The contract's example page, in its order: awaiting, overdue, accepted
// (answered the same day), rejected (with a reply) and testing.
function example(index: number): FeedbackItemData {
  const item = items[index];

  if (!item) {
    throw new Error(`the contract's FeedbackPage example has no item ${index}`);
  }

  return item;
}

const awaiting = example(0);
const overdue = example(1);
const accepted = example(2);
const rejected = example(3);
const testing = example(4);

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("the example is missing a value this test reads");
  }

  return value;
}

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(
  locale: Locale,
  item: FeedbackItemData,
  props: { notice?: FeedbackNotice; controls?: FeedbackControls } = {},
) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(FeedbackItem, { item, locale, ...props }),
    ),
  );
}

// A control the page would build (a form), as a marker that names itself.
function control(name: string) {
  return createElement("span", { "data-control": name });
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

function disclosures(html: string) {
  return [
    ...html.matchAll(/<details[^>]*><summary[^>]*>([^<]*)<\/summary>([\s\S]*?)<\/details>/g),
  ].map((match) => ({ summary: match[1], content: match[2] }));
}

function controlsIn(html: string) {
  return [...html.matchAll(/data-control="([^"]*)"/g)].map((match) => match[1]);
}

function statusLine(html: string) {
  return /<p role="status"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1];
}

describe("FeedbackItem", () => {
  it.each(locales)("sets the anchor id the thread links to (%s)", (locale) => {
    expect(render(locale, awaiting)).toContain(`<article id="feedback-${awaiting.id}"`);
    expect(render(locale, rejected)).toContain(`<article id="feedback-${rejected.id}"`);
  });

  it.each(locales)("shows who said it, when, and what (%s)", (locale) => {
    const html = render(locale, awaiting);

    expect(html).toContain(`<bdi>${required(awaiting.author).displayName}</bdi>`);
    expect(html).toContain(`<bdi>${awaiting.body}</bdi>`);
    expect(visibleText(html)).toContain(locale === "fa" ? "۴ آبان" : "26 Oct");
  });

  it.each(locales)("shows the question the feedback answers, when it has one (%s)", (locale) => {
    const withQuestion = render(locale, awaiting);
    const without = render(locale, accepted);

    expect(withQuestion).toContain(`<bdi>${required(awaiting.question)}</bdi>`);
    expect(visibleText(withQuestion)).toContain(
      locale === "fa" ? "درباره‌ی:" : "About:",
    );
    expect(visibleText(without)).not.toContain(
      locale === "fa" ? "درباره‌ی:" : "About:",
    );
  });

  it.each(locales)("shows the state chip: awaiting, overdue and answered (%s)", (locale) => {
    const chips = messages[locale].ResponseChip;

    expect(visibleText(render(locale, awaiting))).toContain(chips.awaiting);
    expect(visibleText(render(locale, overdue))).toContain(
      locale === "fa" ? "۵ روز گذشته از مهلت" : "5 days overdue",
    );
    expect(visibleText(render(locale, accepted))).toContain(chips.answeredSameDay);
    expect(visibleText(render(locale, rejected))).toContain(
      locale === "fa" ? "پاسخ در ۲ روز" : "Answered in 2 days",
    );
  });

  it.each(locales)("says former member when a person is gone (%s)", (locale) => {
    const gone = messages[locale].Feedback.unknownMember;
    const item: FeedbackItemData = {
      ...rejected,
      author: null,
      response: { ...required(rejected.response), responder: null },
      replies: rejected.replies.map((reply) => ({ ...reply, author: null })),
    };
    const html = visibleText(render(locale, item));

    expect(html.split(gone)).toHaveLength(4);
    expect(html).not.toContain(required(rejected.author).displayName);
  });

  it.each(locales)("shows edited on the item, the answer and a reply only when they were edited (%s)", (locale) => {
    const edited = messages[locale].Feedback.edited;
    const reply = required(rejected.replies[0]);
    const response = required(rejected.response);
    const editedAt = "2026-10-24T09:00:00.000Z";

    expect(visibleText(render(locale, rejected))).not.toContain(edited);
    expect(
      visibleText(render(locale, { ...rejected, editedAt })).split(edited),
    ).toHaveLength(2);
    expect(
      visibleText(
        render(locale, { ...rejected, response: { ...response, editedAt } }),
      ).split(edited),
    ).toHaveLength(2);
    expect(
      visibleText(
        render(locale, { ...rejected, replies: [{ ...reply, editedAt }] }),
      ).split(edited),
    ).toHaveLength(2);
  });
});

describe("FeedbackItem: the answer", () => {
  it.each(locales)("shows an empty slot, with the answer control inside a details, while awaiting (%s)", (locale) => {
    const html = render(locale, awaiting, {
      controls: { answer: control("answer") },
    });
    const [only, ...rest] = disclosures(html);

    expect(visibleText(html)).toContain(messages[locale].Feedback.noAnswerYet);
    expect(rest).toEqual([]);
    expect(only).toEqual({
      summary: messages[locale].Feedback.answer,
      content: '<span data-control="answer"></span>',
    });
  });

  it.each(locales)("keeps the empty slot even when there is no control to answer it (%s)", (locale) => {
    const html = render(locale, awaiting);

    expect(visibleText(html)).toContain(messages[locale].Feedback.noAnswerYet);
    expect(html).not.toContain("<details");
  });

  it.each(locales)("shows the tag, the reason and the responder when answered (%s)", (locale) => {
    const response = required(accepted.response);
    const html = render(locale, accepted);
    const text = visibleText(html);

    expect(text).toContain(messages[locale].ResponseChip.accepted);
    expect(text).not.toContain(messages[locale].ResponseChip.rejected);
    expect(html).toContain(`<bdi>${response.reason}</bdi>`);
    expect(html).toContain(`<bdi>${required(response.responder).displayName}</bdi>`);
    expect(text).toContain(locale === "fa" ? "پاسخ" : "Answer from");
    expect(text).not.toContain(messages[locale].Feedback.noAnswerYet);
  });

  it.each(locales)("tags a rejected answer as rejected (%s)", (locale) => {
    expect(visibleText(render(locale, rejected))).toContain(
      messages[locale].ResponseChip.rejected,
    );
  });

  it.each(locales)("tags a testing answer with its report-back date (%s)", (locale) => {
    expect(visibleText(render(locale, testing))).toContain(
      locale === "fa" ? "نتیجه تا ۲۴ آبان" : "results by 15 Nov",
    );
  });

  it.each(locales)("shows the reply under the answer (%s)", (locale) => {
    const html = render(locale, rejected);
    const reply = required(rejected.replies[0]);
    const response = required(rejected.response);

    expect(html).toContain(`<bdi>${reply.body}</bdi>`);
    expect(html.indexOf(reply.body)).toBeGreaterThan(html.indexOf(response.reason));
  });

  it.each(locales)("lists replies oldest first whatever order they arrive in (%s)", (locale) => {
    const first = required(rejected.replies[0]);
    const second = {
      ...first,
      id: "0199f1a2-7c3e-7a10-8000-000000000402",
      body: "Second reply",
      createdAt: "2026-10-24T09:00:00.000Z",
    };
    const third = {
      ...first,
      id: "0199f1a2-7c3e-7a10-8000-000000000403",
      body: "Third reply",
      createdAt: "2026-10-25T09:00:00.000Z",
    };

    for (const replies of [
      [third, second, first],
      [second, third, first],
      [first, second, third],
    ]) {
      const html = render(locale, { ...rejected, replies });
      const positions = [first.body, second.body, third.body].map((body) =>
        html.indexOf(body),
      );

      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it.each(locales)("shows the report-back control under a testing answer (%s)", (locale) => {
    const response = required(testing.response);
    const html = render(locale, testing, {
      controls: { answer: control("answer") },
    });
    const [only, ...rest] = disclosures(html);

    expect(rest).toEqual([]);
    expect(only?.summary).toBe(messages[locale].Feedback.reportBack);
    expect(only?.summary).not.toBe(messages[locale].Feedback.answer);
    expect(only?.content).toBe('<span data-control="answer"></span>');
    // It sits under the current answer, which stays visible above it.
    expect(html.indexOf(response.reason)).toBeLessThan(
      html.indexOf('data-control="answer"'),
    );
    expect(visibleText(html)).not.toContain(messages[locale].Feedback.noAnswerYet);
  });
});

describe("FeedbackItem: controls", () => {
  const withReply: FeedbackItemData = {
    ...testing,
    replies: rejected.replies,
  };
  const everything: FeedbackControls = {
    answer: control("answer"),
    editAnswer: control("editAnswer"),
    reply: control("reply"),
    edit: control("edit"),
    editReplies: { [required(rejected.replies[0]).id]: control("editReply") },
  };

  it.each(locales)("renders nothing for a control that is not passed (%s)", (locale) => {
    for (const item of [awaiting, accepted, withReply]) {
      const html = render(locale, item);

      expect(html).not.toContain("<details");
      expect(controlsIn(html)).toEqual([]);
    }
    expect(controlsIn(render(locale, withReply, { controls: {} }))).toEqual([]);
  });

  it.each(locales)("renders only the one control it is given (%s)", (locale) => {
    for (const name of Object.keys(everything) as (keyof FeedbackControls)[]) {
      const html = render(locale, withReply, {
        controls: { [name]: everything[name] },
      });

      expect(disclosures(html)).toHaveLength(1);
      expect(controlsIn(html)).toHaveLength(1);
    }
  });

  it.each(locales)("renders every control it is given, each in its own details (%s)", (locale) => {
    const copy = messages[locale].Feedback;
    const html = render(locale, withReply, { controls: everything });

    expect(controlsIn(html).sort()).toEqual(
      ["answer", "edit", "editAnswer", "editReply", "reply"].sort(),
    );
    expect(disclosures(html).map((entry) => entry.summary)).toEqual([
      copy.edit,
      copy.edit,
      copy.reportBack,
      copy.edit,
      copy.reply,
    ]);
  });

  it.each(locales)("shows the edit control for the item itself (%s)", (locale) => {
    const [only] = disclosures(
      render(locale, awaiting, { controls: { edit: control("edit") } }),
    );

    expect(only).toEqual({
      summary: messages[locale].Feedback.edit,
      content: '<span data-control="edit"></span>',
    });
  });

  it.each(locales)("shows the reply control whether or not it was answered (%s)", (locale) => {
    for (const item of [awaiting, accepted]) {
      const [only] = disclosures(
        render(locale, item, { controls: { reply: control("reply") } }),
      );

      expect(only?.summary).toBe(messages[locale].Feedback.reply);
    }
  });

  it.each(locales)("puts a reply's edit control under that reply only (%s)", (locale) => {
    const reply = required(rejected.replies[0]);
    const other = { ...reply, id: "0199f1a2-7c3e-7a10-8000-000000000402", body: "Another reply", createdAt: "2026-10-24T09:00:00.000Z" };
    const html = render(locale, { ...rejected, replies: [reply, other] }, {
      controls: { editReplies: { [other.id]: control("editOther") } },
    });

    expect(controlsIn(html)).toEqual(["editOther"]);
    expect(html.indexOf("editOther")).toBeGreaterThan(html.indexOf(other.body));
  });

  it.each(locales)("does not show the answer edit control on an item with no answer (%s)", (locale) => {
    const html = render(locale, awaiting, {
      controls: { editAnswer: control("editAnswer") },
    });

    expect(controlsIn(html)).toEqual([]);
  });
});

describe("FeedbackItem: notices", () => {
  it.each(locales)("says the answer was saved, with the giver's name inside bdi (%s)", (locale) => {
    const html = render(locale, accepted, { notice: "answer" });
    const line = required(statusLine(html));
    const giver = required(accepted.author).displayName;

    expect(line).toContain(`<bdi>${giver}</bdi>`);
    expect(visibleText(line)).toBe(
      locale === "fa"
        ? `پاسخ ثبت شد. ${giver} خبردار می‌شود و می‌تواند جواب بدهد.`
        : `Answer saved. ${giver} will be notified and can reply.`,
    );
  });

  it.each(locales)("says former member in the answer notice when the giver is gone (%s)", (locale) => {
    const line = required(
      statusLine(render(locale, { ...accepted, author: null }, { notice: "answer" })),
    );

    expect(visibleText(line)).toContain(messages[locale].Feedback.unknownMember);
  });

  it.each(locales)("says what was saved for the other notices (%s)", (locale) => {
    const copy = messages[locale].Feedback;
    const expected = {
      feedback: copy.savedFeedback,
      reply: copy.savedReply,
      edit: copy.savedEdit,
    };

    for (const notice of ["feedback", "reply", "edit"] as const) {
      const line = required(statusLine(render(locale, accepted, { notice })));

      expect(visibleText(line)).toBe(expected[notice]);
    }
  });

  it.each(locales)("shows no status line without a notice (%s)", (locale) => {
    expect(render(locale, accepted)).not.toContain('role="status"');
  });
});
