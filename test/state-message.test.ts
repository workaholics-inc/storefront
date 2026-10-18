import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import {
  StateMessage,
  type StateMessageProps,
} from "@/components/ui/state-message";

const messages = { fa, en };

// NextIntlClientProvider types its children as a required prop; the lint rule
// wants them as a createElement argument, so give the provider a children-free type.
const Provider = NextIntlClientProvider as ComponentType<
  Omit<ComponentProps<typeof NextIntlClientProvider>, "children">
>;

function render(locale: "fa" | "en", props: StateMessageProps) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messages[locale] },
      createElement(StateMessage, props),
    ),
  );
}

// What renderToStaticMarkup does to text: the message strings as they appear in markup.
function escaped(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#x27;");
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

  it("lets a title override the default in both locales", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, { kind: "unreachable", title: "Custom title" });

      expect(html).toContain("Custom title");
      expect(html).not.toContain(
        locale === "fa"
          ? fa.State.unreachableTitle
          : "We can&#x27;t reach",
      );
    }
  });

  it("renders the action after the body in both locales", () => {
    const bodies = { fa: fa.State.errorBody, en: "Something went wrong" };

    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, {
        kind: "error",
        action: createElement("a", { href: "/retry" }, "Retry now"),
      });

      expect(html).toContain('<a href="/retry">Retry now</a>');
      expect(html.indexOf("Retry now")).toBeGreaterThan(
        html.indexOf(bodies[locale]),
      );
      expect(html.indexOf(bodies[locale])).toBeGreaterThan(-1);
    }
  });

  it("shows the default error title and body when given neither", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, { kind: "error" });

      expect(html).toContain(escaped(messages[locale].State.errorTitle));
      expect(html).toContain(escaped(messages[locale].State.errorBody));
    }
  });

  it("shows the default unreachable body when given neither", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, { kind: "unreachable" });

      expect(html).toContain(escaped(messages[locale].State.unreachableBody));
    }
  });

  it("shows no generic body under an error's own title", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, { kind: "error", title: "Only owners can do this" });

      expect(html).toContain("Only owners can do this");
      expect(html).not.toContain(escaped(messages[locale].State.errorTitle));
      expect(html).not.toContain(escaped(messages[locale].State.errorBody));
    }
  });

  it("shows no default unreachable body under an unreachable message's own title", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, { kind: "unreachable", title: "Custom title" });

      expect(html).toContain("Custom title");
      expect(html).not.toContain(escaped(messages[locale].State.unreachableBody));
    }
  });

  it("shows both a title and a body when the caller gives both", () => {
    for (const locale of ["fa", "en"] as const) {
      const html = render(locale, {
        kind: "error",
        title: "Own title",
        body: "Own body",
      });

      expect(html).toContain("Own title");
      expect(html).toContain("Own body");
      expect(html).not.toContain(escaped(messages[locale].State.errorBody));
    }
  });
});
