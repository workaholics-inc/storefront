import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FeedbackSummary } from "@/components/feedback/feedback-summary";
import { InviteeList } from "@/components/member/invitee-list";
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
type FeedbackPage = components["schemas"]["FeedbackPage"];

const PROFILE_TIMEOUT_MS = 5000;
const FEEDBACK_TIMEOUT_MS = 5000;
const PAGE_SIZE = 20;

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<{ cursor?: string | string[]; export?: string | string[] }>;
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
  const tFeedback = await getTranslations("Feedback");
  const tExport = await getTranslations("Export");

  const { cursor: rawCursor, export: rawExport } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;
  const exportParam = Array.isArray(rawExport) ? rawExport[0] : rawExport;
  const lowerHandle = handle.toLowerCase();

  const [result, given] = await Promise.all([
    platformCall<MemberProfile>(async () =>
      (await getPlatformClient()).GET("/v1/members/{handle}", {
        params: { path: { handle: lowerHandle } },
        signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
      }),
    ),
    platformCall<FeedbackPage>(async () =>
      (await getPlatformClient()).GET("/v1/members/{handle}/feedback", {
        params: { path: { handle: lowerHandle }, query: { cursor, limit: PAGE_SIZE } },
        signal: AbortSignal.timeout(FEEDBACK_TIMEOUT_MS),
      }),
    ),
  ]);
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
  const exportFailed = isSelf && exportParam === "failed";
  const profilePath = `/members/${encodeURIComponent(profile.handle)}`;
  const projects = [...profile.projects].sort(
    (a, b) =>
      Date.parse(b.lastPostAt ?? b.createdAt) - Date.parse(a.lastPostAt ?? a.createdAt),
  );

  let givenBody;
  if (!given.ok) {
    if (given.code === "unreachable") {
      givenBody = <StateMessage kind="unreachable" />;
    } else if (given.status === 400) {
      // A cursor the platform does not accept: offer the way back.
      givenBody = (
        <StateMessage
          kind="error"
          action={
            <Link href={profilePath} className={buttonClasses({ variant: "secondary" })}>
              {tProjects("backToNewest")}
            </Link>
          }
        />
      );
    } else if (given.status === 404) {
      notFound();
    } else if (given.status === 401 && given.code === "session_required") {
      redirect(expiredPath(locale, here));
    } else {
      throw new Error("platform error: " + given.code);
    }
  } else if (given.data.items.length === 0) {
    givenBody = (
      <StateMessage
        kind="empty"
        title={isSelf ? tFeedback("givenEmptySelf") : tFeedback("givenEmpty")}
      />
    );
  } else {
    const { items, nextCursor } = given.data;
    givenBody = (
      <>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {items.map((item) => (
            <li key={item.id}>
              <FeedbackSummary item={item} locale={locale} showProject />
            </li>
          ))}
        </ul>
        {nextCursor ? (
          <div>
            <Link
              href={`${profilePath}?cursor=${encodeURIComponent(nextCursor)}#feedback-given`}
              className={buttonClasses({ variant: "secondary" })}
            >
              {tFeedback("more")}
            </Link>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <MemberHead member={profile} locale={locale} isSelf={isSelf} />
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="m-0 text-title-2 text-ink">{t("projects")}</h2>
              {projects.length > 0 ? (
                <span className="text-small text-ink-muted">{tProjects("byLastPost")}</span>
              ) : null}
            </div>
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
          <section id="feedback-given" className="flex min-w-0 flex-col gap-4">
            <h2 className="m-0 text-title-2 text-ink">
              {isSelf ? tFeedback("givenTitleSelf") : tFeedback("givenTitle")}
            </h2>
            {givenBody}
          </section>
        </div>
        <aside>
          <p className="m-0 text-small text-ink-muted">{t("noScores")}</p>
          <InviteeList invitees={profile.invitees} isSelf={isSelf} />
          {isSelf ? (
            <section
              id="export"
              aria-labelledby="export-title"
              className="mt-6 flex flex-col gap-2"
            >
              <h2 id="export-title" className="m-0 text-label font-bold text-ink-muted">
                {tExport("title")}
              </h2>
              <p className="m-0 text-small">{tExport("body")}</p>
              {exportFailed ? (
                <p role="alert" className="m-0 text-small text-danger">
                  {tExport("failed")}
                </p>
              ) : null}
              {/* A plain link without `download`: next-intl's Link would prefetch
                  the route, and a prefetch GET would run the export. */}
              <a
                href={localePath(locale, "/me/export")}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                {tExport("download")}
              </a>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
