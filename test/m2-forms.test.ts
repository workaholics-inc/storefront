import { NextIntlClientProvider } from "next-intl";
import {
  createElement,
  Fragment,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { ReplyForm } from "@/components/feedback/reply-form";
import {
  ResponseControl,
  type ResponseInitial,
} from "@/components/feedback/response-control";
import { PostForm } from "@/components/post/post-form";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { recheckChoices } from "@/lib/recheck";
import contract from "../contract/openapi.json";

type PostData = components["schemas"]["Post"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;

// A fixed clock: the quick picks are 2026-10-27, 2026-11-03 and 2026-11-19.
const now = new Date("2026-10-20T12:00:00.000Z");

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

// useActionState renders on the server, so this is each form's initial markup.
function inLocale(locale: Locale, ...children: ReactNode[]) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(Fragment, null, ...children),
    ),
  );
}

const noop = async (state: never) => state;
const action = noop as unknown as ComponentProps<typeof FeedbackForm>["action"];

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

const inputs = (html: string, name: string) =>
  openTags(html, "input").filter((input) => input.name === name);

const checked = (input: Attrs) => "checked" in input;

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

function textareas(html: string) {
  return [
    ...html.matchAll(/<textarea(\s[^>]*)?>([\s\S]*?)<\/textarea>/g),
  ].map((match) => ({
    attrs: attrsOf(match[1] ?? ""),
    text: decode(match[2] ?? ""),
  }));
}

const textareaNamed = (html: string, name: string) =>
  textareas(html).find((area) => area.attrs.name === name);

function selectedValue(select: ReturnType<typeof selects>[number]) {
  return select.options.find((option) => option.selected)?.value;
}

function ids(html: string) {
  return [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1] ?? "");
}

function labelTargets(html: string) {
  return [...html.matchAll(/<label[^>]*\sfor="([^"]*)"/g)].map(
    (match) => match[1] ?? "",
  );
}

function labelText(html: string, target: string) {
  const match = new RegExp(
    `<label[^>]*\\sfor="${target}"[^>]*>([\\s\\S]*?)</label>`,
  ).exec(html);

  return visibleText(match?.[1] ?? "");
}

describe("ResponseControl", () => {
  const choices = (locale: Locale) => recheckChoices(now, locale);

  function control(
    locale: Locale,
    props: { idPrefix?: string; initial?: ResponseInitial } = {},
  ) {
    return createElement(ResponseControl, {
      idPrefix: "answer",
      action,
      giverName: "Arash",
      choices: choices(locale),
      reasonMax: 1000,
      ...props,
    });
  }

  const render = (
    locale: Locale,
    props: { idPrefix?: string; initial?: ResponseInitial } = {},
  ) => inLocale(locale, control(locale, props));

  const testing: ResponseInitial = {
    status: "testing",
    reason: "Trying it on more people.",
    recheckOn: "2026-11-15",
  };

  it.each(locales)("offers accepted, rejected and testing in that order, none chosen (%s)", (locale) => {
    const radios = inputs(render(locale), "status");

    expect(radios.map((radio) => radio.type)).toEqual(["radio", "radio", "radio"]);
    expect(radios.map((radio) => radio.value)).toEqual([
      "accepted",
      "rejected",
      "testing",
    ]);
    expect(radios.some(checked)).toBe(false);
  });

  it.each(locales)("has its submit button disabled until a status is chosen (%s)", (locale) => {
    const html = render(locale);
    const submit = openTags(html, "button");

    expect(submit).toHaveLength(1);
    expect(submit[0]?.type).toBe("submit");
    expect(submit[0] && "disabled" in submit[0]).toBe(true);
    expect(visibleText(html)).toContain(messages[locale].Answer.submit);
  });

  it.each(locales)("enables it when the answer is being edited (%s)", (locale) => {
    const [submit] = openTags(
      render(locale, { initial: { status: "accepted", reason: "Yes.", recheckOn: null } }),
      "button",
    );

    expect(submit && "disabled" in submit).toBe(false);
  });

  it.each(locales)("has no dismiss, later or snooze control (%s)", (locale) => {
    for (const initial of [undefined, testing]) {
      const html = render(locale, { initial });
      const text = visibleText(html);

      // The only things to press are the options and the submit button.
      expect(openTags(html, "button")).toHaveLength(1);
      expect(openTags(html, "a")).toEqual([]);
      for (const word of [
        /dismiss/i,
        /later/i,
        /snooze/i,
        /remind/i,
        /بعداً|بعدا/,
        /بستن/,
        /یادآور/,
        /فعلاً/,
      ]) {
        expect(text).not.toMatch(word);
      }
    }
  });

  it.each(locales)("shows no report-back date until testing is chosen (%s)", (locale) => {
    for (const initial of [
      undefined,
      { status: "accepted" as const, reason: "Yes.", recheckOn: null },
      { status: "rejected" as const, reason: "No.", recheckOn: null },
    ]) {
      const html = render(locale, { initial });

      expect(inputs(html, "recheckPick")).toEqual([]);
      expect(selects(html)).toEqual([]);
    }
  });

  it.each(locales)("checks testing and another date when editing a dated testing answer (%s)", (locale) => {
    const html = render(locale, { initial: testing });
    const radios = inputs(html, "status");
    const picks = inputs(html, "recheckPick");

    expect(radios.filter(checked).map((radio) => radio.value)).toEqual(["testing"]);
    expect(picks.filter(checked).map((radio) => radio.value)).toEqual(["other"]);
    expect(textareaNamed(html, "reason")?.text).toBe(testing.reason);
  });

  it.each(locales)("gives the quick picks their ISO date as the value (%s)", (locale) => {
    const picks = inputs(render(locale, { initial: testing }), "recheckPick");

    expect(picks.map((radio) => radio.value)).toEqual([
      "2026-10-27",
      "2026-11-03",
      "2026-11-19",
      "other",
    ]);
    expect(picks.map((radio) => radio.value)).toEqual([
      ...choices(locale).quick.map((quick) => quick.iso),
      "other",
    ]);
  });

  it.each(locales)("shows the quick picks' dates in the member's calendar (%s)", (locale) => {
    const text = visibleText(render(locale, { initial: testing }));

    if (locale === "fa") {
      expect(text).toContain("۵ آبان");
      expect(text).toContain("۱۲ آبان");
      expect(text).toContain("۲۸ آبان");
    } else {
      expect(text).toContain("27 Oct");
      expect(text).toContain("3 Nov");
      expect(text).toContain("19 Nov");
    }
  });

  it.each(locales)("orders the date selects day, month, year and holds the date's parts (%s)", (locale) => {
    const found = selects(render(locale, { initial: testing }));
    const expected =
      locale === "fa"
        ? { day: "24", month: "8", year: "1405", monthName: "آبان" }
        : { day: "15", month: "11", year: "2026", monthName: "November" };

    expect(found.map((select) => select.attrs.name)).toEqual([
      "recheckDay",
      "recheckMonth",
      "recheckYear",
    ]);
    expect(found.map(selectedValue)).toEqual([
      expected.day,
      expected.month,
      expected.year,
    ]);
    expect(
      found[1]?.options.find((option) => option.selected)?.label,
    ).toBe(expected.monthName);
  });

  it("labels the numbers in the selects with Persian digits in fa and Latin in en, values always Latin", () => {
    const [day, month, year] = selects(render("fa", { initial: testing }));
    const [dayEn, , yearEn] = selects(render("en", { initial: testing }));

    for (const select of [day, year]) {
      for (const option of (select?.options ?? []).filter((item) => item.value !== "")) {
        expect(option.label).toMatch(/^[۰-۹]+$/);
        expect(option.value).toMatch(/^[0-9]+$/);
      }
    }
    expect(month?.options.map((option) => option.value)).toEqual([
      "",
      ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
    ]);
    for (const select of [dayEn, yearEn]) {
      for (const option of (select?.options ?? []).filter((item) => item.value !== "")) {
        expect(option.label).toBe(option.value);
      }
    }
    expect(day?.options.find((option) => option.selected)?.label).toBe("۲۴");
    expect(
      year?.options.find((option) => option.selected)?.label,
    ).toBe("۱۴۰۵");
  });

  it.each(locales)("offers nothing preselected in the date selects when none was given (%s)", (locale) => {
    const html = render(locale, {
      initial: { status: "testing", reason: "Soon.", recheckOn: null },
    });

    expect(inputs(html, "recheckPick").some(checked)).toBe(false);
    expect(selects(html)).toEqual([]);
  });

  it.each(locales)("keeps the reason limit and shows the giver's name inside bdi (%s)", (locale) => {
    const html = render(locale);

    expect(textareaNamed(html, "reason")?.attrs.maxLength).toBe("1000");
    expect(html).toContain("<bdi>Arash</bdi>");
  });

  it.each(locales)("shares no id between two instances with different prefixes (%s)", (locale) => {
    const html = inLocale(
      locale,
      control(locale, { idPrefix: "answer-1", initial: testing }),
      control(locale, { idPrefix: "answer-2", initial: testing }),
    );
    const all = ids(html);

    expect(all.length).toBeGreaterThan(20);
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((id) => id.startsWith("answer-1-"))).toHaveLength(
      all.length / 2,
    );
    for (const target of labelTargets(html)) {
      expect(all).toContain(target);
    }
  });
});

describe("FeedbackForm", () => {
  const questions = ["Is the pricing clear?", "سوال دوم؟"];

  function render(
    locale: Locale,
    props: Partial<ComponentProps<typeof FeedbackForm>> = {},
  ) {
    return inLocale(
      locale,
      createElement(FeedbackForm, {
        idPrefix: "feedback",
        action,
        questions,
        bodyMax: 3000,
        mode: "give",
        ...props,
      }),
    );
  }

  it.each(locales)("has a body textarea with its limit (%s)", (locale) => {
    const area = textareaNamed(render(locale), "body");

    expect(area?.attrs.maxLength).toBe("3000");
    expect(area?.text).toBe("");
  });

  it.each(locales)("offers general plus each question in a questionIndex select (%s)", (locale) => {
    const [select, ...rest] = selects(render(locale));

    expect(rest).toEqual([]);
    expect(select?.attrs.name).toBe("questionIndex");
    expect(select?.options.map((option) => option.value)).toEqual(["", "0", "1"]);
    expect(select?.options[0]?.label).toBe(messages[locale].Feedback.questionNone);
    // Each question is isolated, so a Latin one never misplaces a Persian one's punctuation.
    expect(select?.options.slice(1).map((option) => option.label)).toEqual(
      questions.map((question) => `⁨${question}⁩`),
    );
  });

  it.each(locales)("has no select when the post has no questions (%s)", (locale) => {
    expect(selects(render(locale, { questions: [] }))).toEqual([]);
  });

  it.each(locales)("carries the give-feedback anchor in give mode only (%s)", (locale) => {
    const [give] = openTags(render(locale, { mode: "give" }), "form");
    const [edit] = openTags(render(locale, { mode: "edit" }), "form");

    expect(give?.id).toBe("give-feedback");
    expect(edit?.id).toBeUndefined();
  });

  it.each(locales)("starts general when giving, and on the question being edited (%s)", (locale) => {
    expect(selectedValue(required(selects(render(locale))[0]))).toBe("");
    expect(
      selectedValue(
        required(
          selects(
            render(locale, {
              mode: "edit",
              initial: { body: "Clear enough.", questionIndex: 1 },
            }),
          )[0],
        ),
      ),
    ).toBe("1");
    expect(
      selectedValue(
        required(
          selects(
            render(locale, {
              mode: "edit",
              initial: { body: "General.", questionIndex: null },
            }),
          )[0],
        ),
      ),
    ).toBe("");
  });

  it.each(locales)("is prefilled from initial when editing (%s)", (locale) => {
    const html = render(locale, {
      mode: "edit",
      initial: { body: "Clear enough.", questionIndex: null },
    });

    expect(textareaNamed(html, "body")?.text).toBe("Clear enough.");
  });

  it.each(locales)("says send to give and save to edit (%s)", (locale) => {
    expect(visibleText(render(locale, { mode: "give" }))).toContain(
      messages[locale].Feedback.send,
    );
    expect(visibleText(render(locale, { mode: "edit" }))).toContain(
      messages[locale].Forms.save,
    );
    expect(visibleText(render(locale, { mode: "edit" }))).not.toContain(
      messages[locale].Feedback.send,
    );
  });

  it.each(locales)("shares no id between two instances with different prefixes (%s)", (locale) => {
    const html = inLocale(
      locale,
      createElement(FeedbackForm, {
        idPrefix: "feedback-1",
        action,
        questions,
        bodyMax: 3000,
        mode: "edit",
      }),
      createElement(FeedbackForm, {
        idPrefix: "feedback-2",
        action,
        questions,
        bodyMax: 3000,
        mode: "edit",
      }),
    );
    const all = ids(html);

    expect(all).toHaveLength(4);
    expect(new Set(all).size).toBe(4);
    for (const target of labelTargets(html)) {
      expect(all).toContain(target);
    }
  });
});

describe("ReplyForm", () => {
  function render(
    locale: Locale,
    props: Partial<ComponentProps<typeof ReplyForm>> = {},
  ) {
    return inLocale(
      locale,
      createElement(ReplyForm, {
        idPrefix: "reply",
        action,
        bodyMax: 2000,
        ...props,
      }),
    );
  }

  it.each(locales)("has an empty body textarea with its limit to give a reply (%s)", (locale) => {
    const area = textareaNamed(render(locale), "body");

    expect(area?.attrs.maxLength).toBe("2000");
    expect(area?.text).toBe("");
    expect(visibleText(render(locale))).toContain(messages[locale].Feedback.send);
  });

  it.each(locales)("is prefilled from initial and says save when editing (%s)", (locale) => {
    const html = render(locale, { initial: { body: "Thanks, that is clear." } });

    expect(textareaNamed(html, "body")?.text).toBe("Thanks, that is clear.");
    expect(visibleText(html)).toContain(messages[locale].Forms.save);
    expect(visibleText(html)).not.toContain(messages[locale].Feedback.send);
  });

  it.each(locales)("shares no id between two instances, or with a feedback form, when prefixes differ (%s)", (locale) => {
    const html = inLocale(
      locale,
      createElement(ReplyForm, { idPrefix: "reply-1", action, bodyMax: 2000 }),
      createElement(ReplyForm, {
        idPrefix: "reply-2",
        action,
        bodyMax: 2000,
        initial: { body: "x" },
      }),
      createElement(FeedbackForm, {
        idPrefix: "feedback-1",
        action,
        questions: ["Q?"],
        bodyMax: 3000,
        mode: "edit",
      }),
    );
    const all = ids(html);

    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain("reply-1-body");
    expect(all).toContain("reply-2-body");
  });
});

describe("PostForm", () => {
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
  const posts = contract.components.schemas.PostPage.example
    .items as PostData[];
  const update = required(posts[0]);
  const wip = required(posts[1]);
  const options = [
    {
      feedbackId: "0199f1a2-7c3e-7a10-8000-000000000203",
      excerpt: "The start button is lost under the picture.",
      authorName: "Arash",
    },
    {
      feedbackId: "0199f1a2-7c3e-7a10-8000-000000000204",
      excerpt: "Shorten the first page.",
      authorName: "Niloufar",
    },
    {
      feedbackId: "0199f1a2-7c3e-7a10-8000-000000000205",
      excerpt: "Telegram asked for a code twice.",
      authorName: "Arash",
    },
  ];

  function render(
    locale: Locale,
    props: Partial<ComponentProps<typeof PostForm>> = {},
  ) {
    return inLocale(
      locale,
      createElement(PostForm, {
        action,
        mode: "create",
        limits,
        actedOnOptions: options,
        ...props,
      }),
    );
  }

  it.each(locales)("offers work in progress and update when creating, work in progress chosen (%s)", (locale) => {
    const radios = inputs(render(locale), "kind");

    expect(radios.map((radio) => radio.type)).toEqual(["radio", "radio"]);
    expect(radios.map((radio) => radio.value)).toEqual(["wip", "update"]);
    expect(radios.map(checked)).toEqual([true, false]);
  });

  it.each(locales)("shows the five question inputs and the work-in-progress fields when creating (%s)", (locale) => {
    const html = render(locale);

    expect(
      openTags(html, "input")
        .filter((input) => /^question\d$/.test(input.name ?? ""))
        .map((input) => input.name),
    ).toEqual(["question0", "question1", "question2", "question3", "question4"]);
    expect(textareaNamed(html, "body")).toBeDefined();
    expect(textareaNamed(html, "selfCritique")).toBeDefined();
    expect(textareaNamed(html, "whatChanged")).toBeUndefined();
    expect(inputs(html, "oneNumber")).toEqual([]);
  });

  it.each(locales)("marks only the first question as required (%s)", (locale) => {
    const html = render(locale);
    const optional = messages[locale].Forms.optional;

    expect(labelText(html, "post-question-0")).not.toContain(optional);
    for (const index of [1, 2, 3, 4]) {
      expect(labelText(html, `post-question-${index}`)).toContain(optional);
    }
  });

  it.each(locales)("applies the limits it is given to each field (%s)", (locale) => {
    const html = render(locale);
    const questionMax = openTags(html, "input")
      .filter((input) => /^question\d$/.test(input.name ?? ""))
      .map((input) => input.maxLength);

    expect(questionMax).toEqual(Array(5).fill("281"));
    expect(textareaNamed(html, "body")?.attrs.maxLength).toBe("5001");
    expect(textareaNamed(html, "selfCritique")?.attrs.maxLength).toBe("1001");

    const edit = render(locale, { mode: "edit", initial: update });

    expect(textareaNamed(edit, "whatChanged")?.attrs.maxLength).toBe("3001");
    expect(textareaNamed(edit, "rejectedAndWhy")?.attrs.maxLength).toBe("2001");
    expect(textareaNamed(edit, "body")?.attrs.maxLength).toBe("5001");
    expect(inputs(edit, "oneNumber")[0]?.maxLength).toBe("201");
  });

  it.each(locales)("asks for as many questions as questionsMax says (%s)", (locale) => {
    const html = render(locale, { limits: { ...limits, questionsMax: 3 } });

    expect(
      openTags(html, "input").filter((input) => /^question\d$/.test(input.name ?? "")),
    ).toHaveLength(3);
  });

  it.each(locales)("fixes the kind with a hidden input and no radios when editing an update (%s)", (locale) => {
    const html = render(locale, { mode: "edit", initial: update });
    const [kind, ...rest] = inputs(html, "kind");

    expect(rest).toEqual([]);
    expect(kind?.type).toBe("hidden");
    expect(kind?.value).toBe("update");
  });

  it.each(locales)("checks the acted-on boxes from initial and prefills the update fields (%s)", (locale) => {
    const html = render(locale, { mode: "edit", initial: update });
    const boxes = inputs(html, "actedOn");

    expect(boxes.map((box) => box.type)).toEqual(["checkbox", "checkbox", "checkbox"]);
    expect(boxes.map((box) => box.value)).toEqual(
      options.map((option) => option.feedbackId),
    );
    expect(boxes.map(checked)).toEqual([true, false, true]);
    expect(inputs(html, "oneNumber")[0]?.value).toBe(update.oneNumber);
    expect(textareaNamed(html, "whatChanged")?.text).toBe(update.whatChanged);
    expect(textareaNamed(html, "rejectedAndWhy")?.text).toBe(
      update.rejectedAndWhy,
    );
    expect(inputs(html, "question0")).toEqual([]);
    expect(textareaNamed(html, "selfCritique")).toBeUndefined();
  });

  it.each(locales)("shows each acted-on option's excerpt and giver inside bdi (%s)", (locale) => {
    const html = render(locale, { mode: "edit", initial: update });

    for (const option of options) {
      expect(html).toContain(`<bdi>${option.excerpt}</bdi>`);
      expect(html).toContain(`<bdi>${option.authorName}</bdi>`);
    }
  });

  it.each(locales)("says there is nothing to act on when there are no options (%s)", (locale) => {
    const html = render(locale, {
      mode: "edit",
      initial: update,
      actedOnOptions: [],
    });

    expect(inputs(html, "actedOn")).toEqual([]);
    expect(visibleText(html)).toContain(messages[locale].Posts.actedOnEmpty);
  });

  it.each(locales)("fixes the kind and fills the questions in order when editing work in progress (%s)", (locale) => {
    const html = render(locale, { mode: "edit", initial: wip });
    const [kind, ...rest] = inputs(html, "kind");

    expect(rest).toEqual([]);
    expect(kind?.type).toBe("hidden");
    expect(kind?.value).toBe("wip");
    expect(
      [0, 1, 2, 3, 4].map((index) => inputs(html, `question${index}`)[0]?.value),
    ).toEqual([...wip.feedbackWanted, "", ""]);
    expect(textareaNamed(html, "selfCritique")?.text).toBe(wip.selfCritique);
    expect(textareaNamed(html, "body")?.text).toBe(wip.body);
    expect(inputs(html, "actedOn")).toEqual([]);
  });

  it.each(locales)("says publish to create and save to edit (%s)", (locale) => {
    const copy = messages[locale];

    expect(visibleText(render(locale))).toContain(copy.Posts.publish);
    expect(visibleText(render(locale, { mode: "edit", initial: wip }))).toContain(
      copy.Forms.save,
    );
    expect(
      visibleText(render(locale, { mode: "edit", initial: wip })),
    ).not.toContain(copy.Posts.publish);
  });

  it.each(locales)("shows a single submit button and no other (%s)", (locale) => {
    for (const html of [
      render(locale),
      render(locale, { mode: "edit", initial: update }),
    ]) {
      expect(openTags(html, "button").map((button) => button.type)).toEqual([
        "submit",
      ]);
    }
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("the example is missing a value this test reads");
  }

  return value;
}
