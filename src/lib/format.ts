import type { Locale } from "@/i18n/routing";

const intlLocale: Record<Locale, string> = {
  fa: "fa-IR-u-ca-persian",
  en: "en-GB",
};

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(iso));
}

const TIME_ZONE = "Asia/Tehran";

// A date for lists and bylines. The year is left out for the current year:
// the Persian year for fa, the Gregorian one for en.
export function formatDate(
  iso: string,
  locale: Locale,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  const tag = intlLocale[locale];
  const yearOf = (value: Date) =>
    new Intl.DateTimeFormat(tag, {
      year: "numeric",
      timeZone: TIME_ZONE,
    }).format(value);
  const sameYear = yearOf(date) === yearOf(now);

  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: locale === "fa" ? "long" : "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: TIME_ZONE,
  }).format(date);
}
