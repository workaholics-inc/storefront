import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PublicBadge } from "@/components/ui/public-badge";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { expiredPath, localePath, requireMember } from "@/lib/session";

type Project = components["schemas"]["Project"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const PROJECT_TIMEOUT_MS = 5000;

export default async function ProjectPage({
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
  const here = localePath(locale, "/projects/" + slug);
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

  return (
    <div className="flex flex-col gap-6">
      <nav>
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-small text-ink-muted">
          <li>
            <Link href="/projects" className="text-ink-muted no-underline hover:underline">
              {t("title")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">
            <bdi>{project.name}</bdi>
          </li>
        </ol>
      </nav>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-title-1 text-ink">
            <bdi>{project.name}</bdi>
          </h1>
          {project.visibility === "public" ? <PublicBadge visibility="public" /> : null}
        </div>
        {project.oneLiner ? (
          <p className="m-0 max-w-read text-lead text-ink">{project.oneLiner}</p>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-2 text-small text-ink-muted">
          <span>
            {owners.map((owner, index) => (
              <span key={owner.handle}>
                {index > 0 ? (locale === "fa" ? "، " : ", ") : null}
                <Link
                  href={`/members/${encodeURIComponent(owner.handle)}`}
                  className="font-semibold text-ink no-underline hover:underline"
                >
                  <bdi>{owner.displayName}</bdi>
                </Link>
              </span>
            ))}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t(`stages.${project.stage}`)}</span>
          <span aria-hidden="true">·</span>
          <span>{t("since", { date: formatDate(project.createdAt, locale) })}</span>
        </div>
        {project.links.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
            {project.links.map((link) => (
              <li key={`${link.label}\n${link.url}`}>
                <a
                  href={link.url}
                  rel="nofollow ugc noopener"
                  className="inline-flex items-center gap-1 text-small font-medium text-link"
                >
                  <bdi>{link.label}</bdi>
                  <Icon name="external-link" size={16} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {isOwner ? (
          <div>
            <Link
              href={`/projects/${slug}/edit`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("edit")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
