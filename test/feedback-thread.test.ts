import { NextIntlClientProvider } from "next-intl";
import {
  createElement,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { FeedbackSummary } from "@/components/feedback/feedback-summary";
import {
  FeedbackThread,
  type ThreadTab,
} from "@/components/feedback/feedback-thread";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import contract from "../contract/openapi.json";

type FeedbackItem = components["schemas"]["FeedbackItem"];

const messages = { fa, en };
const locales = ["fa", "en"] as const;
const tabs: readonly ThreadTab[] = ["all", "awaiting", "answered"];

const items = contract.components.schemas.FeedbackPage.example
  .items as FeedbackItem[];

// The contract's example page, in its order: awaiting, overdue, accepted
// (answered the same day), rejected (with a reply) and testing.
function example(index: number): FeedbackItem {
  const item = items[index];

  if (!item) {
    throw new Error(`the contract's FeedbackPage example has no item ${index}`);
  }

  return item;
}

const ids = (list: readonly FeedbackItem[]) => list.map((item) => item.id);

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function inLocale(locale: Locale, child: ReactNode) {
  return renderToStaticMarkup(
    createElement(Provider, { locale, messages: messages[locale] }, child),
  );
}

const tabHref = (tab: ThreadTab) => `/projects/daftar/posts/p1?tab=${tab}`;

// A marker without text, so a test of the thread's own words sees only those.
function marker(item: FeedbackItem) {
  return createElement("span", { "data-item": item.id });
}

function thread(
  locale: Locale,
  tab: ThreadTab,
  list: FeedbackItem[] = items,
  renderItem: (item: FeedbackItem) => ReactNode = marker,
) {
  return inLocale(
    locale,
    createElement(FeedbackThread, { items: list, tab, tabHref, renderItem }),
  );
}

function shownIds(html: string) {
  return [...html.matchAll(/data-item="([^"]*)"/g)].map((match) => match[1]);
}

function tabLinks(html: string) {
  const nav = /<nav[^>]*>[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";

  return [...nav.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: /\shref="([^"]*)"/.exec(match[1] ?? "")?.[1],
    current: /\saria-current="page"/.test(match[1] ?? ""),
    text: (match[2] ?? "").replace(/<[^>]*>/g, "").trim(),
  }));
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Western, Persian and Arabic-Indic digits.
const DIGIT = /[0-9۰-۹٠-٩]/;

describe("FeedbackThread", () => {
  it.each(locales)("keeps every item in the given order on all (%s)", (locale) => {
    expect(shownIds(thread(locale, "all"))).toEqual(ids(items));
  });

  it.each(locales)("shows only the awaiting items on awaiting (%s)", (locale) => {
    expect(shownIds(thread(locale, "awaiting"))).toEqual(
      ids([example(0), example(1)]),
    );
  });

  it.each(locales)("shows only the answered items on answered (%s)", (locale) => {
    expect(shownIds(thread(locale, "answered"))).toEqual(
      ids([example(2), example(3), example(4)]),
    );
  });

  it("does not sort: the platform's order is the order shown", () => {
    const reversed = [...items].reverse();

    expect(shownIds(thread("en", "all", reversed))).toEqual(ids(reversed));
    expect(shownIds(thread("en", "answered", reversed))).toEqual(
      ids([example(4), example(3), example(2)]),
    );
    expect(shownIds(thread("en", "awaiting", reversed))).toEqual(
      ids([example(1), example(0)]),
    );
  });

  it("hands each shown item to renderItem and no other", () => {
    const seen: string[] = [];

    thread("en", "awaiting", items, (item) => {
      seen.push(item.id);
      return marker(item);
    });

    expect(seen).toEqual(ids([example(0), example(1)]));
  });

  it.each(locales)("labels the three tabs in order and links each (%s)", (locale) => {
    const copy = messages[locale].Feedback;
    const prefix = locale === "en" ? "/en" : "";

    expect(tabLinks(thread(locale, "all"))).toEqual(
      tabs.map((tab, index) => ({
        href: `${prefix}${tabHref(tab)}`,
        current: index === 0,
        text: [copy.tabAll, copy.tabAwaiting, copy.tabAnswered][index],
      })),
    );
  });

  it.each(locales)("marks only the current tab with aria-current (%s)", (locale) => {
    for (const [index, tab] of tabs.entries()) {
      const html = thread(locale, tab);

      expect(tabLinks(html).map((link) => link.current)).toEqual(
        tabs.map((_, position) => position === index),
      );
      expect(html.match(/aria-current/g)).toHaveLength(1);
    }
  });

  it.each(locales)("names the tabs for assistive technology (%s)", (locale) => {
    expect(thread(locale, "all")).toContain(
      `<nav aria-label="${messages[locale].Feedback.tabsLabel}">`,
    );
  });

  it.each(locales)("shows the heading and the order line (%s)", (locale) => {
    const text = visibleText(thread(locale, "all"));

    expect(text).toContain(messages[locale].Feedback.title);
    expect(text).toContain(messages[locale].Feedback.order);
  });

  it.each(locales)("shows each tab's own message when it is empty (%s)", (locale) => {
    const copy = messages[locale].Feedback;
    const message = {
      all: copy.emptyAll,
      awaiting: copy.emptyAwaiting,
      answered: copy.emptyAnswered,
    };

    for (const tab of tabs) {
      const html = thread(locale, tab, []);

      expect(visibleText(html)).toContain(message[tab]);
      expect(shownIds(html)).toEqual([]);
      for (const other of tabs.filter((name) => name !== tab)) {
        expect(visibleText(html)).not.toContain(message[other]);
      }
    }
  });

  it("is empty on awaiting when everything is answered, and the reverse", () => {
    const answered = [example(2), example(3), example(4)];
    const awaiting = [example(0), example(1)];

    const none = thread("en", "awaiting", answered);
    expect(visibleText(none)).toContain(en.Feedback.emptyAwaiting);
    expect(shownIds(none)).toEqual([]);

    const unanswered = thread("en", "answered", awaiting);
    expect(visibleText(unanswered)).toContain(en.Feedback.emptyAnswered);
    expect(shownIds(unanswered)).toEqual([]);
  });

  it("shows no empty message while there are items to show", () => {
    for (const locale of locales) {
      for (const tab of tabs) {
        const text = visibleText(thread(locale, tab));

        for (const message of [
          messages[locale].Feedback.emptyAll,
          messages[locale].Feedback.emptyAwaiting,
          messages[locale].Feedback.emptyAnswered,
        ]) {
          expect(text).not.toContain(message);
        }
      }
    }
  });

  it.each(locales)("has no digit in any tab label (%s)", (locale) => {
    const labels = tabLinks(thread(locale, "all")).map((link) => link.text);

    expect(labels).toHaveLength(3);
    for (const label of labels) {
      expect(label).not.toMatch(DIGIT);
    }
  });

  it.each(locales)("counts nothing in its own words (%s)", (locale) => {
    for (const tab of tabs) {
      for (const list of [items, []]) {
        const html = thread(locale, tab, list);
        const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map(
          (match) => match[1],
        );

        expect(visibleText(html)).not.toMatch(DIGIT);
        expect(labels.join(" ")).not.toMatch(DIGIT);
      }
    }
  });

  it.each(locales)("counts nothing around the items either (%s)", (locale) => {
    const summaries = (item: FeedbackItem) =>
      createElement(FeedbackSummary, { item, locale, showProject: false });

    for (const tab of tabs) {
      const html = thread(locale, tab, items, summaries);
      const around = html.replace(/<article[\s\S]*?<\/article>/g, " ");

      expect(html).toContain("<article");
      expect(visibleText(around)).not.toMatch(DIGIT);
    }
  });
});

describe("FeedbackSummary", () => {
  function summary(
    locale: Locale,
    item: FeedbackItem,
    showProject: boolean,
  ) {
    return inLocale(
      locale,
      createElement(FeedbackSummary, { item, locale, showProject }),
    );
  }

  function hrefs(html: string) {
    return [...html.matchAll(/<a[^>]*\shref="([^"]*)"/g)].map((match) => match[1]);
  }

  it.each(locales)("links to the item's place in its thread (%s)", (locale) => {
    const item = example(3);
    const prefix = locale === "en" ? "/en" : "";

    expect(hrefs(summary(locale, item, false))).toEqual([
      `${prefix}/projects/${item.project.slug}/posts/${item.post.id}#feedback-${item.id}`,
    ]);
  });

  it.each(locales)("shows the feedback itself (%s)", (locale) => {
    const html = summary(locale, example(0), false);

    expect(html).toContain(`<bdi>${example(0).body}</bdi>`);
  });

  it("shows the date: Persian calendar for fa, Gregorian for en", () => {
    expect(visibleText(summary("fa", example(0), false))).toContain("۴ آبان");
    expect(visibleText(summary("en", example(0), false))).toContain("26 Oct");
  });

  it.each(locales)("shows the project only when asked (%s)", (locale) => {
    const item = example(0);
    const word = locale === "fa" ? "روی" : "On";

    const withProject = summary(locale, item, true);
    expect(withProject).toContain(`<bdi>${item.project.name}</bdi>`);
    expect(visibleText(withProject)).toContain(word);

    const without = summary(locale, item, false);
    expect(without).not.toContain(`<bdi>${item.project.name}</bdi>`);
    expect(visibleText(without)).not.toContain(word);
  });

  it("shows the state chip and the answer chip for an answered item", () => {
    const rejected = visibleText(summary("en", example(3), false));
    expect(rejected).toContain("Answered in 2 days");
    expect(rejected).toContain("Rejected");

    const accepted = visibleText(summary("en", example(2), false));
    expect(accepted).toContain("Answered the same day");
    expect(accepted).toContain("Accepted");

    const testing = visibleText(summary("en", example(4), false));
    expect(testing).toContain("Answered in 2 days");
    expect(testing).toContain("Testing · results by November 15");
  });

  it("shows both chips in Persian too", () => {
    const rejected = visibleText(summary("fa", example(3), false));
    expect(rejected).toContain("پاسخ در ۲ روز");
    expect(rejected).toContain(fa.ResponseChip.rejected);

    const accepted = visibleText(summary("fa", example(2), false));
    expect(accepted).toContain(fa.ResponseChip.answeredSameDay);
    expect(accepted).not.toContain(fa.ResponseChip.rejected);

    const testing = visibleText(summary("fa", example(4), false));
    expect(testing).toContain("نتیجه تا ۲۴ آبان");
  });

  it.each(locales)("shows only the state chip while nothing is answered (%s)", (locale) => {
    const chips = messages[locale].ResponseChip;

    const awaiting = visibleText(summary(locale, example(0), false));
    expect(awaiting).toContain(chips.awaiting);
    expect(awaiting).not.toContain(chips.accepted);
    expect(awaiting).not.toContain(chips.rejected);

    const overdue = visibleText(summary(locale, example(1), false));
    expect(overdue).toContain(locale === "fa" ? "۵ روز گذشته از مهلت" : "5 days overdue");
    expect(overdue).not.toContain(chips.awaiting);
  });

  it.each(locales)("shows no answer chip for a testing answer without a date (%s)", (locale) => {
    const { response } = example(4);

    if (!response) {
      throw new Error("example item 4 has no response");
    }

    const item: FeedbackItem = {
      ...example(4),
      response: { ...response, recheckOn: null },
    };
    const html = visibleText(summary(locale, item, false));

    expect(html).toContain(locale === "fa" ? "پاسخ در ۲ روز" : "Answered in 2 days");
    expect(html).not.toContain(locale === "fa" ? "در حال امتحان" : "Testing");
  });
});
