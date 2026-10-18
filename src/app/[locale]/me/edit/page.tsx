import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileForm } from "@/components/member/profile-form";
import { routing } from "@/i18n/routing";
import { LIMITS } from "@/lib/validation";
import { localePath, requireMember } from "@/lib/session";
import { updateProfile } from "./actions";

export default async function EditProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const member = await requireMember(locale, localePath(locale, "/me/edit"));
  const { welcome } = await searchParams;
  const t = await getTranslations("Profile");
  const tAuth = await getTranslations("Auth");

  return (
    <div className="flex flex-col gap-6">
      {welcome === "1" ? (
        <p className="m-0 text-lead text-ink">{tAuth("welcome")}</p>
      ) : null}
      <h1 className="m-0 text-title-1 text-ink">{t("editTitle")}</h1>
      <ProfileForm
        member={member}
        linksMax={LIMITS.linksMax}
        action={updateProfile.bind(null, locale)}
      />
    </div>
  );
}
