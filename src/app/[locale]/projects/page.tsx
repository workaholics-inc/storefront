import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectCard } from "@/components/project/project-card";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";

type ProjectPage = components["schemas"]["ProjectPage"];

const PAGE_SIZE = 20;
const LIST_TIMEOUT_MS = 5000;

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const here = localePath(locale, "/projects");
  await requireMember(locale, here);
  const t = await getTranslations("Projects");

  const { cursor: rawCursor } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;

  const result = await platformCall<ProjectPage>(async () =>
    (await getPlatformClient()).GET("/v1/projects", {
      params: { query: { cursor, limit: PAGE_SIZE } },
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    }),
  );

  const newProject = (
    <Link href="/projects/new" className={buttonClasses({ variant: "primary" })}>
      {t("new")}
    </Link>
  );

  let body;
  if (!result.ok) {
    if (result.code === "unreachable") {
      body = <StateMessage kind="unreachable" />;
    } else if (result.status === 400) {
      // A cursor the platform does not accept: offer the way back.
      body = (
        <StateMessage
          kind="error"
          action={
            <Link href="/projects" className={buttonClasses({ variant: "secondary" })}>
              {t("backToNewest")}
            </Link>
          }
        />
      );
    } else if (result.status === 401 && result.code === "session_required") {
      // The session ended between the check above and this call.
      redirect(expiredPath(locale, here));
    } else {
      throw new Error("platform error: " + result.code);
    }
  } else if (result.data.items.length === 0 && !cursor) {
    body = <StateMessage kind="empty" title={t("empty")} action={newProject} />;
  } else {
    const { items, nextCursor } = result.data;
    body = (
      <>
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
          {items.map((project) => (
            <ProjectCard key={project.slug} project={project} locale={locale} />
          ))}
        </div>
        {nextCursor ? (
          <div>
            <Link
              href={`/projects?cursor=${encodeURIComponent(nextCursor)}`}
              className={buttonClasses({ variant: "secondary" })}
            >
              {t("older")}
            </Link>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
          <span className="text-small text-ink-muted">{t("byLastPost")}</span>
        </div>
        {newProject}
      </div>
      {body}
    </div>
  );
}
