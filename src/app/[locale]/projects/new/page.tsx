import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectForm } from "@/components/project/project-form";
import { routing } from "@/i18n/routing";
import { localePath, requireMember } from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import { createProject } from "../actions";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  await requireMember(locale, localePath(locale, "/projects/new"));
  const t = await getTranslations("Projects");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-title-1 text-ink">{t("new")}</h1>
      <ProjectForm
        mode="create"
        linksMax={LIMITS.linksMax}
        action={createProject.bind(null, locale)}
      />
    </div>
  );
}
