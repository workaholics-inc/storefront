import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectForm } from "@/components/project/project-form";
import { OwnerManager } from "@/components/project/owner-manager";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import { addOwner, removeOwner, updateProject } from "../../actions";

type Project = components["schemas"]["Project"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const PROJECT_TIMEOUT_MS = 5000;

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: rawSlug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const slug = rawSlug.toLowerCase();
  const here = localePath(locale, `/projects/${slug}/edit`);
  const me = await requireMember(locale, here);
  const t = await getTranslations("Projects");

  const result = await platformCall<Project>(async () =>
    (await getPlatformClient()).GET("/v1/projects/{slug}", {
      params: { path: { slug } },
      signal: AbortSignal.timeout(PROJECT_TIMEOUT_MS),
    }),
  );
  if (!result.ok) {
    if (result.status === 404) notFound();
    if (result.code === "unreachable") return <StateMessage kind="unreachable" />;
    // The session ended between the check above and this call.
    if (result.status === 401 && result.code === "session_required") {
      redirect(expiredPath(locale, here));
    }
    throw new Error("platform error: " + result.code);
  }

  const project = result.data;
  const owners = project.owners.filter((owner): owner is Owner => owner !== null);
  const isOwner = owners.some((owner) => owner.handle === me.handle);

  if (!isOwner) {
    return (
      <StateMessage
        kind="error"
        title={t("onlyOwners")}
        action={
          <Link
            href={`/projects/${slug}`}
            className={buttonClasses({ variant: "secondary" })}
          >
            {t("backToProject")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <h1 className="m-0 text-title-1 text-ink">{t("edit")}</h1>
        <ProjectForm
          mode="update"
          project={project}
          linksMax={LIMITS.linksMax}
          action={updateProject.bind(null, locale, slug)}
        />
      </div>
      <OwnerManager
        owners={owners}
        addAction={addOwner.bind(null, locale, slug)}
        removeAction={removeOwner.bind(null, locale, slug)}
      />
    </div>
  );
}
