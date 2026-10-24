import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";

export type HiddenMark = { reason: string; role: "admin" | "moderator"; at: string };

const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

// What a member sees where moderation hid a post, a piece of feedback or a
// reply. It never receives the item's own text and never names anyone.
export function HiddenPlaceholder({
  hidden,
  locale,
  variant = "block",
}: {
  hidden: HiddenMark;
  locale: Locale;
  variant?: "block" | "inline";
}) {
  const t = useTranslations("Hidden");

  if (variant === "inline") {
    return <span className="text-ink-muted">{t("title")}</span>;
  }

  const date = formatDate(hidden.at, locale);

  return (
    <div className="flex flex-col gap-1 rounded-sm bg-sunken px-3 py-2 text-small text-ink-muted">
      <p className="m-0 font-semibold text-ink">{t("title")}</p>
      <p className="m-0">
        {hidden.role === "admin" ? t("byAdmin", { date }) : t("byModerator", { date })}
      </p>
      {hidden.reason === "" ? null : (
        <p className="m-0">{t.rich("reason", { reason: hidden.reason, n: bdi })}</p>
      )}
      <p className="m-0">
        {t("note")}{" "}
        <Link href="/moderation" className="font-semibold text-link">
          {t("logLink")}
        </Link>
      </p>
    </div>
  );
}
