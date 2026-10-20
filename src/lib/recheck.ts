import type { Locale } from "@/i18n/routing";

// Mirrors the platform's limit on a report-back date: tomorrow up to this many
// days ahead. The platform re-checks every answer, so this only shapes the form.
export const RECHECK_MAX_DAYS = 180;

export type Pick = "week" | "twoWeeks" | "month";

export type DateParts = { year: number; month: number; day: number };

export type RecheckChoices = {
  min: string;
  max: string;
  quick: { pick: Pick; iso: string }[];
  years: number[];
  months: { value: number; label: string }[];
  days: number[];
};

const QUICK_DAYS: { pick: Pick; days: number }[] = [
  { pick: "week", days: 7 },
  { pick: "twoWeeks", days: 14 },
  { pick: "month", days: 30 },
];

// Persian for fa, Gregorian for en. The members' dates are read in their own
// calendar while the platform takes YYYY-MM-DD, so each locale has one
// formatter for a date's numeric parts and one for a month's long name.
const calendars: Record<
  Locale,
  { numeric: Intl.DateTimeFormat; monthName: Intl.DateTimeFormat }
> = {
  fa: {
    numeric: new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    }),
    monthName: new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
      month: "long",
      timeZone: "UTC",
    }),
  },
  en: {
    numeric: new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    }),
    monthName: new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
      month: "long",
      timeZone: "UTC",
    }),
  },
};

// Noon UTC, so no time zone can shift the day.
function noon(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

// `now`'s date in UTC: the platform counts from the UTC date.
export function utcToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = noon(iso);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

// The parts of a valid YYYY-MM-DD date in the locale's calendar.
export function partsOf(iso: string, locale: Locale): DateParts {
  const found: Partial<DateParts> = {};
  for (const part of calendars[locale].numeric.formatToParts(noon(iso))) {
    if (part.type === "year") found.year = Number(part.value);
    if (part.type === "month") found.month = Number(part.value);
    if (part.type === "day") found.day = Number(part.value);
  }
  const { year, month, day } = found;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Cannot read the date parts of ${iso} in ${locale}`);
  }

  return { year, month, day };
}

type Day = DateParts & { iso: string };

// The allowed dates, tomorrow up to RECHECK_MAX_DAYS ahead, with their parts.
// Kept for the latest UTC date per locale, so converting every date in a test
// or on each render reads the formatter 180 times only once a day.
const ranges = new Map<Locale, { today: string; days: Day[] }>();

function rangeOf(now: Date, locale: Locale): Day[] {
  const today = utcToday(now);
  const kept = ranges.get(locale);
  if (kept?.today === today) return kept.days;

  const days: Day[] = [];
  for (let ahead = 1; ahead <= RECHECK_MAX_DAYS; ahead++) {
    const iso = addDays(today, ahead);
    days.push({ iso, ...partsOf(iso, locale) });
  }
  ranges.set(locale, { today, days });

  return days;
}

const monthLists = new Map<Locale, RecheckChoices["months"]>();

// The twelve months with their long names, found by walking one year of dates
// and naming the first date of each month, not by calendar arithmetic.
function monthsOf(locale: Locale): RecheckChoices["months"] {
  const kept = monthLists.get(locale);
  if (kept) return kept;

  const names = new Map<number, string>();
  for (let ahead = 0; ahead < 366 && names.size < 12; ahead++) {
    const iso = addDays("2026-01-01", ahead);
    const { month } = partsOf(iso, locale);
    if (!names.has(month)) {
      names.set(month, calendars[locale].monthName.format(noon(iso)));
    }
  }
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: names.get(index + 1) ?? String(index + 1),
  }));
  monthLists.set(locale, months);

  return months;
}

export function recheckChoices(now: Date, locale: Locale): RecheckChoices {
  const today = utcToday(now);
  const years = new Set(rangeOf(now, locale).map((day) => day.year));

  return {
    min: addDays(today, 1),
    max: addDays(today, RECHECK_MAX_DAYS),
    quick: QUICK_DAYS.map(({ pick, days }) => ({
      pick,
      iso: addDays(today, days),
    })),
    years: [...years].sort((a, b) => a - b),
    months: monthsOf(locale),
    days: Array.from({ length: 31 }, (_, index) => index + 1),
  };
}

// The allowed date whose parts equal `parts`, found by walking the range;
// null for an impossible day or a date outside it.
export function isoFromParts(
  parts: DateParts,
  now: Date,
  locale: Locale,
): string | null {
  const match = rangeOf(now, locale).find(
    (day) =>
      day.year === parts.year &&
      day.month === parts.month &&
      day.day === parts.day,
  );

  return match?.iso ?? null;
}
