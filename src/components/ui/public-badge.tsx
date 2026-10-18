import { useTranslations } from "next-intl";
import { Icon } from "./icon";

const BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-label";

export function PublicBadge({
  visibility,
}: {
  visibility: "public" | "members";
}) {
  const t = useTranslations("PublicBadge");

  if (visibility === "public") {
    return (
      <span className={`${BASE} bg-brand-soft text-link`} title={t("publicTitle")}>
        <Icon name="eye" size={16} />
        {t("public")}
      </span>
    );
  }

  return (
    <span className={`${BASE} border border-rule bg-transparent text-ink-muted`}>
      <Icon name="lock" size={16} />
      {t("members")}
    </span>
  );
}
