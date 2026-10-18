import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { PublicBadge } from "../ui/public-badge";

type Project = components["schemas"]["Project"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const SEPARATOR: Record<Locale, string> = { fa: "، ", en: ", " };

export function ProjectCard({
  project,
  locale,
}: {
  project: Project;
  locale: Locale;
}) {
  const t = useTranslations("Projects");
  const owners = project.owners.filter((owner): owner is Owner => owner !== null);

  return (
    <article className="relative flex min-w-0 flex-col gap-3 rounded-md border border-rule bg-sheet p-5 hover:border-rule-strong sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="m-0 text-title-3 text-ink">
          <Link
            href={`/projects/${encodeURIComponent(project.slug)}`}
            className="text-ink no-underline after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            <bdi>{project.name}</bdi>
          </Link>
        </h3>
        {project.visibility === "public" ? (
          <PublicBadge visibility="public" />
        ) : null}
      </div>
      {project.oneLiner ? (
        <p className="m-0 text-ink">{project.oneLiner}</p>
      ) : null}
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-small text-ink-muted">
        {owners.length > 0 ? (
          <>
            <span>
              {owners.map((owner, index) => (
                <Fragment key={owner.handle}>
                  {index > 0 ? SEPARATOR[locale] : null}
                  <bdi>{owner.displayName}</bdi>
                </Fragment>
              ))}
            </span>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <span>{t(`stages.${project.stage}`)}</span>
      </p>
    </article>
  );
}
