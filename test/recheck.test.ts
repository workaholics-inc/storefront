import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import {
  addDays,
  isoFromParts,
  partsOf,
  RECHECK_MAX_DAYS,
  recheckChoices,
  utcToday,
} from "@/lib/recheck";

// Already 21 October in Tehran (UTC+3:30), still the 20th in UTC: the platform
// counts from the UTC date.
const now = new Date("2026-10-20T22:00:00Z");
const locales: Locale[] = ["fa", "en"];

describe("utcToday and addDays", () => {
  it("reads the UTC date, not the date in Tehran", () => {
    expect(utcToday(now)).toBe("2026-10-20");
  });

  it.each([
    ["2026-10-20", 1, "2026-10-21"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2027-02-28", 1, "2027-03-01"],
    ["2026-10-20", 180, "2027-04-18"],
    ["2026-10-20", -1, "2026-10-19"],
  ])("%s plus %i days is %s", (iso, days, expected) => {
    expect(addDays(iso, days)).toBe(expected);
  });

  it("allows tomorrow up to 180 days ahead", () => {
    expect(RECHECK_MAX_DAYS).toBe(180);
  });
});

describe.each(locales)("recheckChoices in %s", (locale) => {
  const choices = recheckChoices(now, locale);

  it("allows tomorrow up to 180 days ahead, counted from the UTC date", () => {
    expect(choices.min).toBe("2026-10-21");
    expect(choices.max).toBe("2027-04-18");
  });

  it("offers a week, two weeks and a month from the UTC date", () => {
    expect(choices.quick).toEqual([
      { pick: "week", iso: "2026-10-27" },
      { pick: "twoWeeks", iso: "2026-11-03" },
      { pick: "month", iso: "2026-11-19" },
    ]);
  });

  it("offers twelve months and 31 days", () => {
    expect(choices.months.map((month) => month.value)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(new Set(choices.months.map((month) => month.label)).size).toBe(12);
    expect(choices.days).toHaveLength(31);
    expect(choices.days[0]).toBe(1);
    expect(choices.days[30]).toBe(31);
  });

  it("converts every allowed date to parts and back to the same date", () => {
    for (let ahead = 0; ahead < RECHECK_MAX_DAYS; ahead++) {
      const iso = addDays(choices.min, ahead);

      expect(isoFromParts(partsOf(iso, locale), now, locale)).toBe(iso);
    }
  });
});

describe("en calendar", () => {
  it("lists the Gregorian years and month names", () => {
    const choices = recheckChoices(now, "en");

    expect(choices.years).toEqual([2026, 2027]);
    expect(choices.months[0]?.label).toBe("January");
    expect(choices.months[9]?.label).toBe("October");
  });

  it("reads the parts of a date", () => {
    expect(partsOf("2026-11-03", "en")).toEqual({ year: 2026, month: 11, day: 3 });
  });

  it("finds a date from its parts", () => {
    expect(isoFromParts({ year: 2026, month: 11, day: 3 }, now, "en")).toBe(
      "2026-11-03",
    );
  });

  it.each([
    ["the 20th, which is today in UTC", { year: 2026, month: 10, day: 20 }],
    ["the day after the last allowed date", { year: 2027, month: 4, day: 19 }],
    ["30 February", { year: 2027, month: 2, day: 30 }],
  ])("finds nothing for %s", (_label, parts) => {
    expect(isoFromParts(parts, now, "en")).toBeNull();
  });
});

describe("fa calendar", () => {
  it("lists the Persian years and month names", () => {
    const choices = recheckChoices(now, "fa");

    expect(choices.years).toEqual([1405, 1406]);
    expect(choices.months[7]?.label).toBe("آبان");
  });

  it("reads the parts of a date in the Persian calendar", () => {
    expect(partsOf("2026-11-03", "fa")).toEqual({ year: 1405, month: 8, day: 12 });
  });

  it.each([
    [{ year: 1405, month: 8, day: 12 }, "2026-11-03"],
    [{ year: 1406, month: 1, day: 29 }, "2027-04-18"],
  ])("finds the date for %o", (parts, iso) => {
    expect(isoFromParts(parts, now, "fa")).toBe(iso);
  });

  it("finds nothing for 31 Mehr, which has 30 days", () => {
    expect(isoFromParts({ year: 1405, month: 7, day: 31 }, now, "fa")).toBeNull();
  });
});

describe("a later day", () => {
  it("moves the range with the UTC date", () => {
    const later = new Date("2026-10-21T08:00:00Z");

    expect(isoFromParts({ year: 2026, month: 10, day: 21 }, now, "en")).toBe(
      "2026-10-21",
    );
    expect(isoFromParts({ year: 2026, month: 10, day: 21 }, later, "en")).toBeNull();
    expect(isoFromParts({ year: 2027, month: 4, day: 19 }, later, "en")).toBe(
      "2027-04-19",
    );
    expect(recheckChoices(later, "en").min).toBe("2026-10-22");
  });
});
