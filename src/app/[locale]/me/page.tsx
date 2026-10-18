import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { localePath, requireMember } from "@/lib/session";

export default async function MePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const me = await requireMember(locale, localePath(locale, "/me"));
  redirect(localePath(locale, "/members/" + me.handle));
}
