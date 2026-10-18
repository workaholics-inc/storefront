import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ICON_NAMES,
  Icon,
  MIRRORED_ICONS,
  type IconName,
} from "@/components/ui/icon";

function render(props: Parameters<typeof Icon>[0]) {
  return renderToStaticMarkup(createElement(Icon, props));
}

describe("Icon", () => {
  it.each(ICON_NAMES)("renders %s as a 20px svg with stroke 2", (name) => {
    const html = render({ name });

    expect(html).toContain("<svg");
    expect(html).toContain('width="20"');
    expect(html).toContain('stroke-width="2"');
  });

  it("hides decorative icons from assistive technology", () => {
    expect(render({ name: "x" })).toContain('aria-hidden="true"');
  });

  it("labels an icon that stands on its own", () => {
    const html = render({ name: "x", label: "Close" });

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Close"');
    expect(html).not.toContain("aria-hidden");
  });

  it("renders the 16px size", () => {
    expect(render({ name: "x", size: 16 })).toContain('width="16"');
  });

  it.each([...MIRRORED_ICONS])("mirrors %s in right-to-left", (name) => {
    expect(render({ name })).toContain("rtl:-scale-x-100");
  });

  it("does not mirror an icon that has no direction", () => {
    expect(render({ name: "circle-check" })).not.toContain("rtl:-scale-x-100");
  });
});

describe("ICON_NAMES", () => {
  it("has the 31 allowed icons", () => {
    expect(ICON_NAMES).toHaveLength(31);
    expect(new Set(ICON_NAMES).size).toBe(31);
  });

  it("holds none of the icons the site never uses", () => {
    const banned = [
      "thumbs-up",
      "thumbs-down",
      "heart",
      "star",
      "sparkles",
      "trophy",
      "award",
      "medal",
      "crown",
      "flame",
      "trending-up",
      "rocket",
      "dollar-sign",
      "coins",
      "wallet",
      "credit-card",
      "gem",
    ];
    const names: readonly string[] = ICON_NAMES satisfies readonly IconName[];

    for (const name of banned) {
      expect(names).not.toContain(name);
    }
  });
});
