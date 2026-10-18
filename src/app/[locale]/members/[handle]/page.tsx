import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MemberHead } from "@/components/member/member-head";
import { ProjectCard } from "@/components/project/project-card";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";

type MemberProfile = components["schemas"]["MemberProfile"];

const PROFILE_TIMEOUT_MS = 5000;

export default async function MemberPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const here = localePath(locale, "/members/" + handle);
  const me = await requireMember(locale, here);
  const t = await getTranslations("Profile");
  const tProjects = await getTranslations("Projects");

  const result = await platformCall<MemberProfile>(async () =>
    (await getPlatformClient()).GET("/v1/members/{handle}", {
      params: { path: { handle: handle.toLowerCase() } },
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
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

  const profile = result.data;
  const isSelf = profile.handle === me.handle;
  const projects = [...profile.projects].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  return (
    <div className="flex flex-col gap-10">
      <MemberHead member={profile} locale={locale} isSelf={isSelf} />
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="m-0 text-title-2 text-ink">{t("projects")}</h2>
          {projects.length > 0 ? (
            <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
              {projects.map((project) => (
                <ProjectCard key={project.slug} project={project} locale={locale} />
              ))}
            </div>
          ) : (
            <StateMessage
              kind="empty"
              title={isSelf ? t("noProjectsSelf") : t("noProjects")}
              action={
                isSelf ? (
                  <Link
                    href="/projects/new"
                    className={buttonClasses({ variant: "secondary" })}
                  >
                    {tProjects("new")}
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>
        <aside>
          <p className="m-0 text-small text-ink-muted">{t("noScores")}</p>
        </aside>
      </div>
    </div>
  );
}
