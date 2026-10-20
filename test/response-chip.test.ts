import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import {
  ResponseChip,
  type ResponseChipProps,
} from "@/components/feedback/response-chip";

const messages = { fa, en };

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(locale: "fa" | "en", props: ResponseChipProps) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(ResponseChip, props),
    ),
  );
}

describe("ResponseChip", () => {
  it("shows overdue days in Persian digits for fa and Latin for en", () => {
    expect(render("fa", { kind: "overdue", days: 5 })).toContain(
      "۵ روز گذشته از مهلت",
    );
    expect(render("en", { kind: "overdue", days: 5 })).toContain(
      "5 days overdue",
    );
  });

  it("says answered the same day for zero days", () => {
    expect(render("fa", { kind: "answered", days: 0 })).toContain(
      fa.ResponseChip.answeredSameDay,
    );
    expect(render("en", { kind: "answered", days: 0 })).toContain(
      "Answered the same day",
    );
  });

  it("uses the singular for one day in English", () => {
    expect(render("en", { kind: "answered", days: 1 })).toContain(
      "Answered in 1 day",
    );
  });

  it("names the month of the report-back date in each calendar", () => {
    expect(
      render("fa", { kind: "testing", recheckOn: "2026-10-24" }),
    ).toContain("آبان");
    expect(
      render("en", { kind: "testing", recheckOn: "2026-10-24" }),
    ).toContain("24 Oct");
  });

  it.each<ResponseChipProps>([
    { kind: "awaiting" },
    { kind: "overdue", days: 3 },
    { kind: "answered", days: 2 },
    { kind: "accepted" },
    { kind: "rejected" },
    { kind: "testing", recheckOn: "2026-10-24" },
    { kind: "has-unanswered" },
  ])("renders an icon with words for $kind", (props) => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, props);

      expect(html).toContain("<svg");
      expect(html.replace(/<svg.*?<\/svg>/g, "").replace(/<[^>]*>/g, "").trim())
        .not.toBe("");
    }
  });
});
