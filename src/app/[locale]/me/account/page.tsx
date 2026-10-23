import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localePath, requireMember } from "@/lib/session";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  await requireMember(locale, localePath(locale, "/me/account"));
  const t = await getTranslations("Account");
  const tExport = await getTranslations("Export");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
        <p className="m-0 max-w-read text-ink-muted">{t("intro")}</p>
      </div>
      <section aria-labelledby="account-data-title" className="flex max-w-read flex-col gap-3">
        <h2 id="account-data-title" className="m-0 text-title-2 text-ink">
          {tExport("title")}
        </h2>
        <p className="m-0 text-ink">{tExport("body")}</p>
        <div>
          {/* A plain link, not `Link`: a prefetch GET would run the export. */}
          <a
            href={localePath(locale, "/me/export")}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {tExport("download")}
          </a>
        </div>
      </section>
      <section aria-labelledby="account-delete-title" className="flex max-w-read flex-col gap-3">
        <h2 id="account-delete-title" className="m-0 text-title-2 text-ink">
          {t("deleteTitle")}
        </h2>
        <p className="m-0 text-ink">{t("deleteHint")}</p>
        <div>
          <Link
            href="/me/delete"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {t("deleteLink")}
          </Link>
        </div>
      </section>
    </div>
  );
}
