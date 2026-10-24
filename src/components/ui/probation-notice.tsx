import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { Icon } from "./icon";

export type ProbationView = { untilDate: string | null; feedbackDone: boolean };

// The rules are published in docs/rules.md; /rules has no page yet.
export const PROBATION_RULES_URL =
  "https://github.com/workaholics-inc/storefront/blob/main/docs/rules.md#new-members";

// Server pages call this and pass the result down, so a client component
// never reads the clock or formats a date.
export function probationView(
  probation: { until: string; feedbackDone: boolean } | null,
  locale: Locale,
  now: Date = new Date(),
): ProbationView | null {
  if (probation === null) return null;
  return {
    untilDate:
      Date.parse(probation.until) > now.getTime()
        ? formatDate(probation.until, locale, now)
        : null,
    feedbackDone: probation.feedbackDone,
  };
}

export function ProbationNotice({
  id,
  probation,
}: {
  id: string;
  probation: ProbationView;
}) {
  const t = useTranslations("Probation");

  return (
    <div id={id} className="flex flex-col gap-2 rounded-sm bg-sunken px-3 py-2 text-small text-ink">
      <p className="m-0 font-semibold">{t("title")}</p>
      <p className="m-0">{t("publicOption")}</p>
      <p className="m-0">{t("body")}</p>
      <ul className="m-0 flex flex-col gap-1 ps-5">
        <li>
          {probation.untilDate !== null
            ? t("dateAhead", { date: probation.untilDate })
            : t("dateMet")}
        </li>
        <li>{probation.feedbackDone ? t("feedbackMet") : t("feedbackPending")}</li>
      </ul>
      <p className="m-0">
        <a
          href={PROBATION_RULES_URL}
          rel="noopener"
          className="inline-flex items-center gap-1 font-medium text-link"
        >
          {t("rulesLink")}
          <Icon name="external-link" size={16} />
        </a>
      </p>
    </div>
  );
}
