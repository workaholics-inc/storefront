import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonClasses, type ButtonProps } from "@/components/ui/button";

function render(props: ButtonProps, children = "Save") {
  return renderToStaticMarkup(createElement(Button, props, children));
}

function classAttribute(html: string) {
  return /<button[^>]*\sclass="([^"]*)"/.exec(html)?.[1];
}

describe("Button", () => {
  it("defaults type to button and keeps an explicit type", () => {
    expect(render({})).toContain('type="button"');
    expect(render({ type: "submit" })).toContain('type="submit"');
  });

  it("styles each variant", () => {
    expect(render({ variant: "primary" })).toContain("bg-brand");
    expect(render({ variant: "secondary" })).toContain("border-rule-strong");
    expect(render({ variant: "quiet" })).toContain("text-link");
  });

  it("sizes md at h-10 by default and sm at h-8", () => {
    expect(render({})).toContain("h-10");
    expect(render({ size: "sm" })).toContain("h-8");
    expect(render({ size: "sm" })).not.toContain("h-10");
  });

  it("shows the busy state with the busy label instead of the children", () => {
    const html = render({ busy: true, busyLabel: "Posting…" });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("<svg");
    expect(html).toContain("animate-spin");
    expect(html).toContain("Posting…");
    expect(html).not.toContain("Save");
  });

  it("puts the icon before the label", () => {
    const html = render({ icon: "plus" });

    expect(html.indexOf("<svg")).toBeGreaterThan(-1);
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("Save"));
  });
});

describe("buttonClasses", () => {
  it("matches the class attribute of a primary Button", () => {
    const html = render({ variant: "primary" });

    expect(buttonClasses({ variant: "primary" })).toBe(classAttribute(html));
  });
});
