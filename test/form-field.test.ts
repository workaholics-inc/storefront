import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form-field";

describe("TextField", () => {
  it("renders a label bound to the input", () => {
    const html = renderToStaticMarkup(
      createElement(TextField, { id: "handle", label: "Handle" }),
    );

    expect(html).toMatch(/<label[^>]*for="handle"[^>]*>[^<]*Handle/);
    expect(html).toMatch(/<input[^>]*id="handle"/);
  });

  it("links the hint and the error and marks the input invalid", () => {
    const html = renderToStaticMarkup(
      createElement(TextField, {
        id: "handle",
        label: "Handle",
        hint: "Letters only",
        error: "Already taken",
      }),
    );

    expect(html).toContain('aria-describedby="handle-hint handle-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<p[^>]*id="handle-error"[^>]*>.*Already taken/);
    expect(html).toMatch(/<p[^>]*id="handle-hint"[^>]*>Letters only/);
  });

  it("adds no aria-describedby or aria-invalid without a hint or an error", () => {
    const html = renderToStaticMarkup(
      createElement(TextField, { id: "handle", label: "Handle" }),
    );

    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("aria-invalid");
  });

  it("passes dir and name through and shows the optional label inside the label", () => {
    const html = renderToStaticMarkup(
      createElement(TextField, {
        id: "site",
        label: "Website",
        optionalLabel: "(optional)",
        dir: "ltr",
        name: "website",
      }),
    );

    expect(html).toMatch(/<input[^>]*dir="ltr"/);
    expect(html).toMatch(/<input[^>]*name="website"/);
    expect(html).toMatch(/<label[^>]*>.*\(optional\).*<\/label>/);
  });
});

describe("TextAreaField and SelectField", () => {
  it("renders a textarea", () => {
    const html = renderToStaticMarkup(
      createElement(TextAreaField, { id: "body", label: "Feedback" }),
    );

    expect(html).toMatch(/<textarea[^>]*id="body"/);
  });

  it("renders a select with its options", () => {
    const html = renderToStaticMarkup(
      createElement(
        SelectField,
        { id: "month", label: "Month" },
        createElement("option", { value: "1" }, "Farvardin"),
        createElement("option", { value: "2" }, "Ordibehesht"),
      ),
    );

    expect(html).toMatch(/<select[^>]*id="month"/);
    expect(html).toContain("<option value=\"1\">Farvardin</option>");
    expect(html).toContain("<option value=\"2\">Ordibehesht</option>");
  });
});
