import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditConsent } from "@/components/case/credit-consent";
import { CreditList } from "@/components/case/credit-list";
import { memberName } from "@/components/member/member-name";
import { buttonClasses } from "@/components/ui/button";
import { HiddenPlaceholder } from "@/components/ui/hidden-placeholder";
import { PublicBadge } from "@/components/ui/public-badge";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import {
  expiredPath,
  getCurrentMember,
  getViewer,
  localePath,
  signInPath,
} from "@/lib/session";
import { setCredit } from "../actions";

type CaseData = components["schemas"]["Case"];
type PublicCaseData = components["schemas"]["PublicCase"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const TIMEOUT_MS = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTICES = ["case", "credit"] as const;

const SECTION_HEADING = "m-0 text-label font-bold text-ink-muted";

// A search param is a string, a list of them, or absent.
function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// One platform call per request, shared by the page and its metadata.
const loadPublicCase = cache(async (id: string) =>
  platformCall<PublicCaseData>(async () =>
    (await getPlatformClient()).GET("/v1/public/cases/{id}", {
      params: { path: { id } },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  ),
);

// Only a visitor gets a title of their own; members' pages keep the layout's.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id: rawId } = await params;
  const id = rawId.toLowerCase();
  if (!hasLocale(routing.locales, locale) || !UUID.test(id)) return {};
  if ((await getCurrentMember()).state !== "signed-out") return {};

  const result = await loadPublicCase(id);
  if (!result.ok) return {};
  const t = await getTranslations({ locale, namespace: "Cases" });

  return { title: t("metaTitle", { title: result.data.title }) };
}

type CaseText = {
  title: string;
  author: PublicCaseData["author"];
  createdAt: string;
  editedAt: string | null;
  feedbackStory: string;
  change: string;
  result: string;
  oneNumber: string | null;
};

// The byline under the title.
async function Byline({ kase, locale }: { kase: CaseText; locale: Locale }) {
  const t = await getTranslations("Cases");
  const tFeedback = await getTranslations("Feedback");

  return (
    <p className="m-0 flex flex-wrap gap-x-2 text-small text-ink-muted">
      <span>
        {t.rich("by", {
          name: memberName(kase.author, tFeedback),
          date: formatDate(kase.createdAt, locale),
          n: (chunks) => <bdi>{chunks}</bdi>,
        })}
      </span>
      {kase.editedAt ? <span>{t("edited")}</span> : null}
    </p>
  );
}

// The feedback, the change and the result, then the one number as a sentence.
async function Story({ kase }: { kase: CaseText }) {
  const t = await getTranslations("Cases");
  const sections = [
    { heading: t("feedbackStory"), text: kase.feedbackStory },
    { heading: t("change"), text: kase.change },
    { heading: t("result"), text: kase.result },
  ];

  return (
    <>
      {sections.map(({ heading, text }) => (
        <section key={heading} className="flex flex-col gap-2">
          <h2 className={SECTION_HEADING}>{heading}</h2>
          <p className="m-0 max-w-read whitespace-pre-line">
            <bdi>{text}</bdi>
          </p>
        </section>
      ))}
      {kase.oneNumber !== null ? (
        <section className="flex flex-col gap-2">
          <h2 className={SECTION_HEADING}>{t("oneNumber")}</h2>
          <p className="m-0 max-w-read">
            <bdi>{kase.oneNumber}</bdi>
          </p>
        </section>
      ) : null}
    </>
  );
}

// Links to the updates a case points at, by their date.
async function PostsLinked({
  slug,
  posts,
  locale,
}: {
  slug: string;
  posts: readonly { id: string; createdAt: string }[];
  locale: Locale;
}) {
  const t = await getTranslations("Cases");

  if (posts.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className={SECTION_HEADING}>{t("postsLinked")}</h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/projects/${encodeURIComponent(slug)}/posts/${encodeURIComponent(post.id)}`}
            >
              {t("update", { date: formatDate(post.createdAt, locale) })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function AllCases({ slug }: { slug: string }) {
  const t = await getTranslations("Cases");

  return (
    <div>
      <Link
        href={`/projects/${encodeURIComponent(slug)}/cases`}
        className={buttonClasses({ variant: "secondary" })}
      >
        {t("allCases")}
      </Link>
    </div>
  );
}

// What a visitor (no session cookie at all) sees: the public case and nothing
// around it. Every refusal reads as sign-in, so a members-only address reveals
// nothing.
async function PublicCaseView({
  locale,
  slug,
  id,
  here,
}: {
  locale: Locale;
  slug: string;
  id: string;
  here: string;
}) {
  const t = await getTranslations("Cases");
  const tFeedback = await getTranslations("Feedback");
  const tPublic = await getTranslations("PublicPages");

  const result = await loadPublicCase(id);
  if (!result.ok) {
    if (result.status === 404) redirect(signInPath(locale, { next: here }));
    if (result.code === "unreachable") return <StateMessage kind="unreachable" />;
    throw new Error("platform error: " + result.code);
  }

  const kase = result.data;
  // The case's own address names its project.
  if (kase.project.slug !== slug) {
    redirect(
      localePath(
        locale,
        `/projects/${encodeURIComponent(kase.project.slug)}/cases/${encodeURIComponent(kase.id)}`,
      ),
    );
  }
  const projectPath = `/projects/${encodeURIComponent(kase.project.slug)}`;
  const link = "text-ink-muted no-underline hover:underline";

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={tFeedback("breadcrumbs")}>
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-small text-ink-muted">
          {kase.project.isPublic ? (
            <>
              <li>
                <Link href={projectPath} className={link}>
                  <bdi>{kase.project.name}</bdi>
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`${projectPath}/cases`} className={link}>
                  {t("title")}
                </Link>
              </li>
            </>
          ) : (
            <li>
              <bdi>{kase.project.name}</bdi>
            </li>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page">
            <bdi>{kase.title}</bdi>
          </li>
        </ol>
      </nav>
      {kase.project.isPublic ? null : (
        <p className="m-0 text-small text-ink-muted">{tPublic("projectMembersOnly")}</p>
      )}
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-title-2 text-ink">
          <bdi>{kase.title}</bdi>
        </h1>
        <Byline kase={kase} locale={locale} />
      </div>
      <Story kase={kase} />
      <CreditList credits={kase.credits} />
      <PostsLinked slug={kase.project.slug} posts={kase.posts} locale={locale} />
      {kase.project.isPublic ? <AllCases slug={kase.project.slug} /> : null}
    </div>
  );
}

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const { locale, slug: rawSlug, id: rawId } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const slug = rawSlug.toLowerCase();
  const id = rawId.toLowerCase();
  // A malformed id is never a case.
  if (!UUID.test(id)) notFound();
  const here = localePath(locale, `/projects/${slug}/cases/${id}`);
  const viewer = await getViewer(locale, here);
  if (viewer.kind === "visitor") {
    return <PublicCaseView locale={locale} slug={slug} id={id} here={here} />;
  }
  const me = viewer.member;
  const t = await getTranslations("Cases");
  const tCredits = await getTranslations("Credits");
  const tFeedback = await getTranslations("Feedback");

  const savedParam = firstOf((await searchParams).saved);
  const saved = NOTICES.find((notice) => notice === savedParam);

  const result = await platformCall<CaseData>(async () =>
    (await getPlatformClient()).GET("/v1/cases/{id}", {
      params: { path: { id } },
      signal: AbortSignal.timeout(TIMEOUT_MS),
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

  const kase = result.data;
  // The case's own address names its project.
  if (kase.project.slug !== slug) {
    redirect(
      localePath(
        locale,
        `/projects/${encodeURIComponent(kase.project.slug)}/cases/${encodeURIComponent(kase.id)}`,
      ),
    );
  }
  const owners = kase.project.owners.filter(
    (owner): owner is Owner => owner !== null,
  );
  const isOwner = owners.some((owner) => owner.handle === me.handle);
  const projectPath = `/projects/${encodeURIComponent(kase.project.slug)}`;
  const link = "text-ink-muted no-underline hover:underline";
  const notice = "m-0 rounded-sm bg-sunken px-3 py-2 text-small text-ink";

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={tFeedback("breadcrumbs")}>
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-small text-ink-muted">
          <li>
            <Link href={projectPath} className={link}>
              <bdi>{kase.project.name}</bdi>
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`${projectPath}/cases`} className={link}>
              {t("title")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">
            <bdi>{kase.title}</bdi>
          </li>
        </ol>
      </nav>
      {saved === "case" ? (
        <p role="status" className={notice}>
          {t("saved")}
        </p>
      ) : null}
      {saved === "credit" ? (
        <p role="status" className={notice}>
          {tCredits("saved")}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="m-0 text-title-2 text-ink">
              <bdi>{kase.title}</bdi>
            </h1>
            {kase.isPublic ? <PublicBadge visibility="public" /> : null}
          </div>
          {isOwner ? (
            <Link
              href={`${projectPath}/cases/${encodeURIComponent(kase.id)}/edit`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("edit")}
            </Link>
          ) : null}
        </div>
        <Byline kase={kase} locale={locale} />
      </div>
      <Story kase={kase} />
      {kase.feedback.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className={SECTION_HEADING}>{t("feedbackLinked")}</h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {kase.feedback.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${projectPath}/posts/${encodeURIComponent(item.postId)}#feedback-${encodeURIComponent(item.id)}`}
                >
                  {item.hidden !== null ? (
                    <HiddenPlaceholder hidden={item.hidden} locale={locale} variant="inline" />
                  ) : (
                    <bdi>{item.excerpt}</bdi>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <CreditList credits={kase.credits} />
      {kase.myConsent !== null ? (
        <CreditConsent
          action={setCredit.bind(null, locale, slug, id)}
          consent={kase.myConsent}
        />
      ) : null}
      <PostsLinked slug={kase.project.slug} posts={kase.posts} locale={locale} />
      <AllCases slug={kase.project.slug} />
    </div>
  );
}
