import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteAccountForm } from "@/components/member/delete-account-form";
import { buttonClasses } from "@/components/ui/button";
import { routing } from "@/i18n/routing";
import { getCurrentMember, localePath, requireMember } from "@/lib/session";
import { deleteAccount } from "./actions";

export default async function DeleteAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ deleted?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const here = localePath(locale, "/me/delete");
  const t = await getTranslations("Deletion");
  const tExport = await getTranslations("Export");

  const { deleted: rawDeleted } = await searchParams;
  const deleted = (Array.isArray(rawDeleted) ? rawDeleted[0] : rawDeleted) === "1";
  if (deleted) {
    // The action ends the session before it redirects here. A member still
    // signed in who opens this address sees the normal page below.
    const current = await getCurrentMember();
    if (current.state === "signed-out" || current.state === "expired") {
      return (
        <div className="flex max-w-read flex-col gap-4">
          <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
          <p role="status" className="m-0 rounded-sm bg-sunken px-3 py-2 text-ink">
            {t("done")}
          </p>
        </div>
      );
    }
  }

  const me = await requireMember(locale, here);

  return (
    <div className="flex max-w-read flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
        <p className="m-0 text-ink">{t("intro")}</p>
      </div>
      <section aria-labelledby="delete-export" className="flex flex-col gap-2">
        <h2 id="delete-export" className="m-0 text-title-3 text-ink">
          {tExport("title")}
        </h2>
        <p className="m-0">{t("exportFirst")}</p>
        <div>
          {/* A plain link, never `Link`: a prefetch would run the export. */}
          <a
            href={localePath(locale, "/me/export")}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {tExport("download")}
          </a>
        </div>
      </section>
      <section aria-labelledby="delete-kept" className="flex flex-col gap-2">
        <h2 id="delete-kept" className="m-0 text-title-3 text-ink">
          {t("keptTitle")}
        </h2>
        <p className="m-0">{t("kept")}</p>
      </section>
      <section aria-labelledby="delete-erased" className="flex flex-col gap-2">
        <h2 id="delete-erased" className="m-0 text-title-3 text-ink">
          {t("erasedTitle")}
        </h2>
        <p className="m-0">{t("erased")}</p>
        <p className="m-0">{t("coOwned")}</p>
      </section>
      <DeleteAccountForm action={deleteAccount.bind(null, locale)} handle={me.handle} />
    </div>
  );
}
