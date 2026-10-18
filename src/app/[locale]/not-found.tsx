import { useTranslations } from "next-intl";
import { StateMessage } from "@/components/ui/state-message";
import { buttonClasses } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("Errors");

  return (
    <StateMessage
      kind="empty"
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
      action={
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          {t("backHome")}
        </Link>
      }
    />
  );
}
