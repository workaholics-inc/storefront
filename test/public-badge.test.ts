import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { PublicBadge } from "@/components/ui/public-badge";

const messages = { fa, en };

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(locale: "fa" | "en", visibility: "public" | "members") {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(PublicBadge, { visibility }),
    ),
  );
}

describe("PublicBadge", () => {
  it("shows public with its explanatory title", () => {
    const faHtml = render("fa", "public");
    const enHtml = render("en", "public");

    expect(faHtml).toContain("عمومی");
    expect(faHtml).toContain(`title="${fa.PublicBadge.publicTitle}"`);
    expect(enHtml).toContain("Public");
    expect(enHtml).toContain('title="Everyone can see this, not only members"');
  });

  it("shows members only without a title", () => {
    const faHtml = render("fa", "members");
    const enHtml = render("en", "members");

    expect(faHtml).toContain("فقط اعضا");
    expect(enHtml).toContain("Members only");
    expect(faHtml).not.toContain("title=");
  });
});
