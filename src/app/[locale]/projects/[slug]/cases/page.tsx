import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CaseCard } from "@/components/case/case-card";
import { ProjectNav } from "@/components/project/project-nav";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
type CasePage = components["schemas"]["CasePage"];
type PublicProject = components["schemas"]["PublicProject"];
type PublicCasePage = components["schemas"]["PublicCasePage"];
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
  const t = await getTranslations({ locale, namespace: "Cases" });

  return { title: t("listMetaTitle", { project: result.data.name }) };
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
  const tCases = await getTranslations("Cases");
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
        <li aria-current="page">{tCases("title")}</li>
      </ol>
    </nav>
  );
}

async function NewCaseLink({ slug, size }: { slug: string; size?: "sm" }) {
  const t = await getTranslations("Cases");

  return (
    <Link
      href={`/projects/${encodeURIComponent(slug)}/cases/new`}
      className={buttonClasses({ variant: "primary", size })}
    >
      <Icon name="plus" size={16} />
      {t("new")}
    </Link>
  );
}

// The list of cases under its heading, or what stands in for it.
async function CaseList({
  members,
  slug,
  name,
  isOwner,
  nav,
  body,
}: {
  members: boolean;
  slug: string;
  name: string;
  isOwner: boolean;
  nav: ReactNode;
  body: ReactNode;
}) {
  const t = await getTranslations("Cases");

  return (
    <div className="flex flex-col gap-6">
      <Crumbs slug={slug} name={name} members={members} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
          {isOwner ? <NewCaseLink slug={slug} size="sm" /> : null}
        </div>
        <p className="m-0 max-w-read text-ink-muted">{t("intro")}</p>
      </div>
      {nav}
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
  const t = await getTranslations("Cases");

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
async function PublicCases({
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
  const t = await getTranslations("Cases");
  const path = `/projects/${encodeURIComponent(slug)}/cases`;

  const [result, posts] = await Promise.all([
    loadPublicProject(slug),
    platformCall<PublicCasePage>(async () =>
      (await getPlatformClient()).GET("/v1/public/projects/{slug}/cases", {
        params: { path: { slug }, query: { cursor, limit: PAGE_SIZE } },
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
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {items.map((kase) => (
            <li key={kase.id}>
              <CaseCard
                kase={kase}
                href={`/projects/${encodeURIComponent(slug)}/cases/${encodeURIComponent(kase.id)}`}
              />
            </li>
          ))}
        </ul>
        <Older path={path} nextCursor={nextCursor} />
      </>
    );
  }

  return (
    <CaseList
      members={false}
      slug={result.data.slug}
      name={result.data.name}
      isOwner={false}
      nav={<ProjectNav slug={result.data.slug} current="cases" />}
      body={body}
    />
  );
}

export default async function CasesPage({
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
  const here = localePath(locale, `/projects/${slug}/cases`);
  const { cursor: rawCursor } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;
  const viewer = await getViewer(locale, here);
  if (viewer.kind === "visitor") {
    return <PublicCases locale={locale} slug={slug} cursor={cursor} here={here} />;
  }
  const me = viewer.member;
  const t = await getTranslations("Cases");
  const path = `/projects/${encodeURIComponent(slug)}/cases`;

  const [result, posts] = await Promise.all([
    platformCall<Project>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}", {
        params: { path: { slug } },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ),
    platformCall<CasePage>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}/cases", {
        params: { path: { slug }, query: { cursor, limit: PAGE_SIZE } },
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
        action={<NewCaseLink slug={slug} />}
      />
    ) : (
      <StateMessage kind="empty" title={t("empty")} />
    );
  } else {
    const { items, nextCursor } = posts.data;
    body = (
      <>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {items.map((kase) => (
            <li key={kase.id}>
              <CaseCard
                kase={kase}
                href={`/projects/${encodeURIComponent(slug)}/cases/${encodeURIComponent(kase.id)}`}
              />
            </li>
          ))}
        </ul>
        <Older path={path} nextCursor={nextCursor} />
      </>
    );
  }

  return (
    <CaseList
      members
      slug={project.slug}
      name={project.name}
      isOwner={isOwner}
      nav={<ProjectNav slug={project.slug} current="cases" />}
      body={body}
    />
  );
}
