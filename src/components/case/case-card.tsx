import { hasLocale, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { PublicBadge, itemBadge } from "../ui/public-badge";
import { CreditList } from "./credit-list";

type Case = components["schemas"]["Case"];
type PublicCase = components["schemas"]["PublicCase"];

const SECTION_HEADING = "m-0 text-label font-bold text-ink-muted";

// The whole case, for the list and the case page alike. It names a giver only
// through the credits the platform sends, never through the linked feedback.
export function CaseCard({
  kase,
  href,
}: {
  kase: Case | PublicCase;
  href?: string;
}) {
  const t = useTranslations("Cases");
  const f = useTranslations("Feedback");
  const current = useLocale();
  const locale = hasLocale(routing.locales, current)
    ? current
    : routing.defaultLocale;
  const badge = "isPublic" in kase ? itemBadge({ isPublic: kase.isPublic }) : null;
  const story = [
    { heading: t("feedbackStory"), text: kase.feedbackStory },
    { heading: t("change"), text: kase.change },
    { heading: t("result"), text: kase.result },
  ];

  return (
    <article
      id={`case-${kase.id}`}
      className="flex min-w-0 flex-col gap-4 rounded-md border border-rule bg-sheet p-4 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="m-0 text-title-3 text-ink">
          {href ? (
            <Link href={href}>
              <bdi>{kase.title}</bdi>
            </Link>
          ) : (
            <bdi>{kase.title}</bdi>
          )}
        </h3>
        {badge ? <PublicBadge visibility={badge} /> : null}
      </div>

      <p className="m-0 flex flex-wrap gap-x-2 text-small text-ink-muted">
        <span>
          {t.rich("by", {
            name: kase.author ? kase.author.displayName : f("unknownMember"),
            date: formatDate(kase.createdAt, locale),
            n: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </span>
        {kase.editedAt ? <span>{t("edited")}</span> : null}
      </p>

      {story.map(({ heading, text }) => (
        <section key={heading} className="flex flex-col gap-2">
          <h4 className={SECTION_HEADING}>{heading}</h4>
          <p className="m-0 max-w-read whitespace-pre-line">
            <bdi>{text}</bdi>
          </p>
        </section>
      ))}
      {kase.oneNumber ? (
        <section className="flex flex-col gap-2">
          <h4 className={SECTION_HEADING}>{t("oneNumber")}</h4>
          <p className="m-0 max-w-read whitespace-pre-line">
            <bdi>{kase.oneNumber}</bdi>
          </p>
        </section>
      ) : null}

      <CreditList credits={kase.credits} />
    </article>
  );
}
