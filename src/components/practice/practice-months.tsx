import { hasLocale, useLocale, useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";
import { routing, type Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { StateMessage } from "../ui/state-message";

type PracticeSnapshot = components["schemas"]["PracticeSnapshot"];

const CELL = "border-b border-rule px-3 py-3 text-start align-top";
const BLOCK = "block text-small font-normal text-ink-muted";

// The months are UTC Gregorian months in both languages, so the month is named
// in the Gregorian calendar even in fa (unlike formatDate, which uses the Persian one).
function monthName(month: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-gregory" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

// The community's monthly numbers, as the platform computed them: never per member,
// per project or per owner, and the share is never worked out here.
export function PracticeMonths({
  snapshots,
}: {
  snapshots: readonly PracticeSnapshot[];
}) {
  const t = useTranslations("Practice");
  const current = useLocale();
  const locale = hasLocale(routing.locales, current)
    ? current
    : routing.defaultLocale;

  if (snapshots.length === 0) {
    return <StateMessage kind="empty" title={t("empty")} />;
  }

  const number = new Intl.NumberFormat(locale);
  const columns = [
    t("month"),
    t("members"),
    t("membersPostingWip"),
    t("projectsWithPublicChangelog"),
    t("feedbackAnsweredInWindow"),
    t("casesWritten"),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-body text-ink">
        <caption className="sr-only">{t("months")}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className={`${CELL} border-rule-strong text-label font-bold text-ink-muted`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot) => {
            const { numbers } = snapshot;
            const answered = numbers.feedbackAnsweredInWindow;

            return (
              <tr key={snapshot.month}>
                <th scope="row" className={`${CELL} font-semibold`}>
                  <time dateTime={snapshot.month}>
                    {monthName(snapshot.month, locale)}
                  </time>
                  <span className={BLOCK}>
                    {t("computedAt", { date: formatDate(snapshot.computedAt, locale) })}
                  </span>
                  <span className={BLOCK}>
                    {t("rulesVersion", { version: snapshot.rulesVersion })}
                  </span>
                </th>
                <td className={CELL}>{number.format(numbers.members)}</td>
                <td className={CELL}>{number.format(numbers.membersPostingWip)}</td>
                <td className={CELL}>
                  {number.format(numbers.projectsWithPublicChangelog)}
                </td>
                <td className={CELL}>
                  {snapshot.answeredSharePercent !== null ? (
                    <>
                      <span className="block">
                        {t("share", { percent: snapshot.answeredSharePercent })}
                      </span>
                      <span className="block text-small text-ink-muted">
                        {t("shareOf", {
                          answered: answered.answered,
                          due: answered.due,
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">{t("noShare")}</span>
                      <span className="sr-only">{t("noShareLabel")}</span>
                    </>
                  )}
                </td>
                <td className={CELL}>{number.format(numbers.casesWritten)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
