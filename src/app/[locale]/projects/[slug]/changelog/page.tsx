import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Post } from "@/components/post/post";
import { PublicPost } from "@/components/post/public-post";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import {
  expiredPath,
  getCurrentMember,
  getViewer,
  localePath,
  signInPath,
} from "@/lib/session";

type Project = components["schemas"]["Project"];
type PostPage = components["schemas"]["PostPage"];
type PublicProject = components["schemas"]["PublicProject"];
type PublicPostPage = components["schemas"]["PublicPostPage"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const TIMEOUT_MS = 5000;
const PAGE_SIZE = 20;

// One platform call per request, shared by the page and its metadata.
const loadPublicProject = cache(async (slug: string) =>
  platformCall<PublicProject>(async () =>
    (await getPlatformClient()).GET("/v1/public/projects/{slug}", {
      params: { path: { slug } },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  ),
);

// Only a visitor gets a title of their own; members' pages keep the layout's.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if ((await getCurrentMember()).state !== "signed-out") return {};

  const result = await loadPublicProject(slug.toLowerCase());
  if (!result.ok) return {};
  const t = await getTranslations({ locale, namespace: "Changelog" });

  return { title: t("metaTitle", { project: result.data.name }) };
}

async function Crumbs({
  slug,
  name,
  members,
}: {
  slug: string;
  name: string;
  members: boolean;
}) {
  const t = await getTranslations("Projects");
  const tFeedback = await getTranslations("Feedback");
  const tChangelog = await getTranslations("Changelog");
  const link = "text-ink-muted no-underline hover:underline";

  return (
    <nav aria-label={tFeedback("breadcrumbs")}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-small text-ink-muted">
        {members ? (
          <>
            <li>
              <Link href="/projects" className={link}>
                {t("title")}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
          </>
        ) : null}
        <li>
          <Link href={`/projects/${encodeURIComponent(slug)}`} className={link}>
            <bdi>{name}</bdi>
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{tChangelog("title")}</li>
      </ol>
    </nav>
  );
}

// The list of updates under its heading, or what stands in for it.
async function Changelog({
  members,
  slug,
  name,
  intro,
  body,
}: {
  members: boolean;
  slug: string;
  name: string;
  intro: string;
  body: ReactNode;
}) {
  const t = await getTranslations("Changelog");

  return (
    <div className="flex flex-col gap-6">
      <Crumbs slug={slug} name={name} members={members} />
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
        <p className="m-0 max-w-read text-ink-muted">{intro}</p>
      </div>
      {body}
    </div>
  );
}

async function BackToNewest({ path }: { path: string }) {
  const t = await getTranslations("Projects");

  return (
    <StateMessage
      kind="error"
      action={
        <Link href={path} className={buttonClasses({ variant: "secondary" })}>
          {t("backToNewest")}
        </Link>
      }
    />
  );
}

async function Older({ path, nextCursor }: { path: string; nextCursor: string | null }) {
  const t = await getTranslations("Changelog");

  return nextCursor ? (
    <div>
      <Link
        href={`${path}?cursor=${encodeURIComponent(nextCursor)}`}
        className={buttonClasses({ variant: "secondary" })}
      >
        {t("older")}
      </Link>
    </div>
  ) : null;
}

// What a visitor (no session cookie at all) sees: the owners' public updates
// only. Every refusal reads as sign-in, so a members-only address reveals nothing.
async function PublicChangelog({
  locale,
  slug,
  cursor,
  here,
}: {
  locale: Locale;
  slug: string;
  cursor: string | undefined;
  here: string;
}) {
  const t = await getTranslations("Changelog");
  const path = `/projects/${encodeURIComponent(slug)}/changelog`;

  const [result, posts] = await Promise.all([
    loadPublicProject(slug),
    platformCall<PublicPostPage>(async () =>
      (await getPlatformClient()).GET("/v1/public/projects/{slug}/posts", {
        params: { path: { slug }, query: { cursor, kind: "update", limit: PAGE_SIZE } },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ),
  ]);
  if (!result.ok) {
    if (result.status === 404) redirect(signInPath(locale, { next: here }));
    if (result.code === "unreachable") return <StateMessage kind="unreachable" />;
    throw new Error("platform error: " + result.code);
  }

  let body: ReactNode;
  if (!posts.ok) {
    if (posts.status === 404) redirect(signInPath(locale, { next: here }));
    if (posts.code === "unreachable") {
      body = <StateMessage kind="unreachable" />;
    } else if (posts.status === 400) {
      body = <BackToNewest path={path} />;
    } else {
      throw new Error("platform error: " + posts.code);
    }
  } else if (posts.data.items.length === 0 && !cursor) {
    body = <StateMessage kind="empty" title={t("emptyPublic")} />;
  } else {
    const { items, nextCursor } = posts.data;
    body = (
      <>
        <ol className="m-0 flex list-none flex-col gap-6 p-0">
          {items.map((post) => (
            <li key={post.id}>
              <PublicPost
                post={post}
                variant="full"
                href={`/projects/${encodeURIComponent(slug)}/posts/${encodeURIComponent(post.id)}`}
              />
            </li>
          ))}
        </ol>
        <Older path={path} nextCursor={nextCursor} />
      </>
    );
  }

  return (
    <Changelog
      members={false}
      slug={result.data.slug}
      name={result.data.name}
      intro={t("introPublic")}
      body={body}
    />
  );
}

export default async function ChangelogPage({
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
  const here = localePath(locale, `/projects/${slug}/changelog`);
  const { cursor: rawCursor } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;
  const viewer = await getViewer(locale, here);
  if (viewer.kind === "visitor") {
    return <PublicChangelog locale={locale} slug={slug} cursor={cursor} here={here} />;
  }
  const me = viewer.member;
  const t = await getTranslations("Changelog");
  const tProjects = await getTranslations("Projects");
  const path = `/projects/${encodeURIComponent(slug)}/changelog`;

  const [result, posts] = await Promise.all([
    platformCall<Project>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}", {
        params: { path: { slug } },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ),
    platformCall<PostPage>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}/posts", {
        params: { path: { slug }, query: { cursor, kind: "update", limit: PAGE_SIZE } },
        signal: AbortSignal.timeout(TIMEOUT_MS),
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

  let body: ReactNode;
  if (!posts.ok) {
    if (posts.status === 404) notFound();
    if (posts.code === "unreachable") {
      body = <StateMessage kind="unreachable" />;
    } else if (posts.status === 400) {
      body = <BackToNewest path={path} />;
    } else if (posts.status === 401 && posts.code === "session_required") {
      redirect(expiredPath(locale, here));
    } else {
      throw new Error("platform error: " + posts.code);
    }
  } else if (posts.data.items.length === 0 && !cursor) {
    body = isOwner ? (
      <StateMessage
        kind="empty"
        title={t("emptyOwner")}
        action={
          <Link
            href={`/projects/${encodeURIComponent(slug)}/posts/new`}
            className={buttonClasses({ variant: "primary" })}
          >
            {tProjects("newPost")}
          </Link>
        }
      />
    ) : (
      <StateMessage kind="empty" title={t("empty")} />
    );
  } else {
    const { items, nextCursor } = posts.data;
    const now = new Date();
    body = (
      <>
        <ol className="m-0 flex list-none flex-col gap-6 p-0">
          {items.map((post) => (
            <li key={post.id}>
              <Post
                post={post}
                locale={locale}
                variant="full"
                showThreadLink
                canGiveFeedback={!isOwner}
                now={now}
                projectPublic={project.visibility === "public"}
              />
            </li>
          ))}
        </ol>
        <Older path={path} nextCursor={nextCursor} />
      </>
    );
  }

  return (
    <Changelog
      members
      slug={project.slug}
      name={project.name}
      intro={t("intro")}
      body={body}
    />
  );
}
