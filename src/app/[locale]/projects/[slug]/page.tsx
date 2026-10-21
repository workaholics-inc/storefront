import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Post } from "@/components/post/post";
import { buttonClasses } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
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
type PostPage = components["schemas"]["PostPage"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const PROJECT_TIMEOUT_MS = 5000;
const POSTS_PAGE_SIZE = 20;

const KIND_ICON: Record<components["schemas"]["Post"]["kind"], IconName> = {
  wip: "file-pen-line",
  update: "file-diff",
};

// One entry on the notebook margin line: a dot, then what it holds.
function Entry({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="relative flex min-w-0 flex-col gap-3 ps-12">
      <span
        aria-hidden="true"
        className="absolute start-0 top-0 box-border grid size-8 place-items-center rounded-full border-2 border-rail bg-paper text-ink-muted"
      >
        <Icon name={icon} size={16} />
      </span>
      {children}
    </li>
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
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

  const { cursor: rawCursor } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;

  const [result, posts] = await Promise.all([
    platformCall<Project>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}", {
        params: { path: { slug } },
        signal: AbortSignal.timeout(PROJECT_TIMEOUT_MS),
      }),
    ),
    platformCall<PostPage>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}/posts", {
        params: { path: { slug }, query: { cursor, limit: POSTS_PAGE_SIZE } },
        signal: AbortSignal.timeout(PROJECT_TIMEOUT_MS),
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

  const project = result.data;
  const owners = project.owners.filter((owner): owner is Owner => owner !== null);
  const isOwner = owners.some((owner) => owner.handle === me.handle);
  const projectPath = `/projects/${encodeURIComponent(project.slug)}`;

  let timeline: ReactNode;
  if (!posts.ok) {
    if (posts.status === 404) notFound();
    if (posts.code === "unreachable") {
      timeline = <StateMessage kind="unreachable" />;
    } else if (posts.status === 400) {
      // A cursor the platform does not accept: offer the way back.
      timeline = (
        <StateMessage
          kind="error"
          action={
            <Link
              href={projectPath}
              className={buttonClasses({ variant: "secondary" })}
            >
              {t("backToNewest")}
            </Link>
          }
        />
      );
    } else if (posts.status === 401 && posts.code === "session_required") {
      redirect(expiredPath(locale, here));
    } else {
      throw new Error("platform error: " + posts.code);
    }
  } else if (posts.data.items.length === 0 && !cursor) {
    timeline = (
      <StateMessage
        kind="empty"
        title={isOwner ? t("timelineEmptyOwner") : t("timelineEmpty")}
      />
    );
  } else {
    const { items, nextCursor } = posts.data;
    const now = new Date();
    timeline = (
      <>
        <ol className="relative m-0 flex list-none flex-col gap-8 p-0 before:absolute before:bottom-0 before:start-[0.9375rem] before:top-3 before:border-s-2 before:border-rail before:content-['']">
          {items.map((post) => (
            <Entry key={post.id} icon={KIND_ICON[post.kind]}>
              <time
                dateTime={post.createdAt}
                className="text-small font-semibold leading-8 text-ink-muted"
              >
                {formatDate(post.createdAt, locale)}
              </time>
              <Post
                post={post}
                locale={locale}
                variant={post.kind === "update" ? "full" : "compact"}
                showThreadLink
                canGiveFeedback={!isOwner}
                now={now}
              />
            </Entry>
          ))}
          {nextCursor === null ? (
            <Entry icon="plus">
              <p className="m-0 text-small leading-8 text-ink-muted">
                {t("created", { date: formatDate(project.createdAt, locale) })}
              </p>
            </Entry>
          ) : null}
        </ol>
        {nextCursor ? (
          <div>
            <Link
              href={`${projectPath}?cursor=${encodeURIComponent(nextCursor)}`}
              className={buttonClasses({ variant: "secondary" })}
            >
              {t("olderPosts")}
            </Link>
          </div>
        ) : null}
      </>
    );
  }

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
          <p className="m-0 max-w-read text-lead text-ink"><bdi>{project.oneLiner}</bdi></p>
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
          <div className="flex flex-wrap gap-3">
            <Link
              href={`${projectPath}/posts/new`}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              <Icon name="plus" size={16} />
              {t("newPost")}
            </Link>
            <Link
              href={`/projects/${slug}/edit`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("edit")}
            </Link>
          </div>
        ) : null}
      </div>
      <section aria-labelledby="timeline-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="timeline-title" className="m-0 text-title-2 text-ink">
            {t("timeline")}
          </h2>
          <span className="text-small text-ink-muted">{t("newestFirst")}</span>
        </div>
        {timeline}
      </section>
    </div>
  );
}
