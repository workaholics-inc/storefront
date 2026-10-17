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
