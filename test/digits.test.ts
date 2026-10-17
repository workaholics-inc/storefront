import { describe, expect, it } from "vitest";
import { normalizeDigits } from "@/lib/digits";

describe("normalizeDigits", () => {
  it.each([
    ["۱۲۳۴", "1234"],
    ["٤٥٦", "456"],
    ["abc-۷۸", "abc-78"],
    ["", ""],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizeDigits(input)).toBe(expected);
  });
});
