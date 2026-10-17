import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import {
  StateMessage,
  type StateMessageProps,
} from "@/components/ui/state-message";

const messages = { fa, en };

function render(locale: "fa" | "en", props: StateMessageProps) {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: messages[locale] },
      createElement(StateMessage, props),
    ),
  );
}

describe("StateMessage", () => {
  it("shows the default unreachable title in both locales", () => {
    expect(render("fa", { kind: "unreachable" })).toContain(
      fa.State.unreachableTitle,
    );
    expect(render("en", { kind: "unreachable" })).toContain(
      "We can&#x27;t reach the Workaholics platform right now",
    );
  });

  it("shows the error code as a reference line", () => {
    for (const locale of ["fa", "en"] as const) {
      expect(
        render(locale, { kind: "error", code: "internal_error" }),
      ).toContain("internal_error");
    }
  });

  it("lets a title override the default", () => {
    const html = render("en", { kind: "unreachable", title: "Custom title" });

    expect(html).toContain("Custom title");
    expect(html).not.toContain("We can&#x27;t reach");
  });

  it("renders the action after the body", () => {
    const html = render("en", {
      kind: "error",
      action: createElement("a", { href: "/retry" }, "Retry now"),
    });

    expect(html).toContain('<a href="/retry">Retry now</a>');
    expect(html.indexOf("Retry now")).toBeGreaterThan(
      html.indexOf("Something went wrong"),
    );
  });
});
