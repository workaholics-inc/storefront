import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/format";

const instant = "2026-10-17T08:30:00.000Z";

describe("formatDateTime", () => {
  it("renders fa in the Persian calendar with Tehran time", () => {
    const text = formatDateTime(instant, "fa");

    expect(text).toContain("مهر");
    expect(text).toContain("۱۴۰۵");
    expect(text).toContain("۱۲:۰۰");
  });

  it("renders en as a long British date with Tehran time", () => {
    const text = formatDateTime(instant, "en");

    expect(text).toContain("17 October 2026");
    expect(text).toContain("12:00");
  });

  it("switches day at midnight in Tehran, not at midnight UTC", () => {
    expect(formatDateTime("2026-10-17T20:29:00.000Z", "en")).toContain(
      "17 October 2026",
    );
    expect(formatDateTime("2026-10-17T20:31:00.000Z", "en")).toContain(
      "18 October 2026",
    );
  });
});
