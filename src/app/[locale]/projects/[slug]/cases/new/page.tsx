import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CaseForm } from "@/components/case/case-form";
import { buttonClasses } from "@/components/ui/button";
import { probationView } from "@/components/ui/probation-notice";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import { createCase } from "../actions";

type Project = components["schemas"]["Project"];
type FeedbackPage = components["schemas"]["FeedbackPage"];
type PostPage = components["schemas"]["PostPage"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const PLATFORM_TIMEOUT_MS = 5000;
// A case often reaches back past the newest items: the routes' maximum.
const PAGE_SIZE = 100;
// The platform counts an excerpt in code points, so the form does too.
const EXCERPT_LENGTH = 140;

const cut = (text: string) => Array.from(text).slice(0, EXCERPT_LENGTH).join("");

export default async function NewCasePage({
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
  const here = localePath(locale, `/projects/${slug}/cases/new`);
  const me = await requireMember(locale, here);
  const t = await getTranslations("Cases");
  const tProjects = await getTranslations("Projects");
  const tFeedback = await getTranslations("Feedback");

  const result = await platformCall<Project>(async () =>
    (await getPlatformClient()).GET("/v1/projects/{slug}", {
      params: { path: { slug } },
      signal: AbortSignal.timeout(PLATFORM_TIMEOUT_MS),
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
            href={`/projects/${encodeURIComponent(project.slug)}`}
            className={buttonClasses({ variant: "secondary" })}
          >
            {tProjects("backToProject")}
          </Link>
        }
      />
    );
  }

  // A case starts from answered feedback and may point at updates.
  const [answered, updates] = await Promise.all([
    platformCall<FeedbackPage>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}/feedback", {
        params: { path: { slug }, query: { state: "answered", limit: PAGE_SIZE } },
        signal: AbortSignal.timeout(PLATFORM_TIMEOUT_MS),
      }),
    ),
    platformCall<PostPage>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}/posts", {
        params: { path: { slug }, query: { kind: "update", limit: PAGE_SIZE } },
        signal: AbortSignal.timeout(PLATFORM_TIMEOUT_MS),
      }),
    ),
  ]);
  for (const call of [answered, updates]) {
    if (call.ok) continue;
    if (call.status === 404) notFound();
    if (call.code === "unreachable") return <StateMessage kind="unreachable" />;
    if (call.status === 401 && call.code === "session_required") {
      redirect(expiredPath(locale, here));
    }
    throw new Error("platform error: " + call.code);
  }
  if (!answered.ok || !updates.ok) return null;

  if (answered.data.items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="m-0 text-title-1 text-ink">{t("newTitle")}</h1>
        <StateMessage
          kind="empty"
          title={t("feedbackLinkedEmpty")}
          action={
            <Link
              href={`/projects/${encodeURIComponent(project.slug)}/cases`}
              className={buttonClasses({ variant: "secondary" })}
            >
              {t("allCases")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-title-1 text-ink">{t("newTitle")}</h1>
      <CaseForm
        mode="create"
        action={createCase.bind(null, locale, slug)}
        limits={{
          titleMax: LIMITS.caseTitleMax,
          feedbackStoryMax: LIMITS.caseFeedbackStoryMax,
          changeMax: LIMITS.caseChangeMax,
          resultMax: LIMITS.caseResultMax,
          oneNumberMax: LIMITS.caseOneNumberMax,
        }}
        feedbackOptions={answered.data.items.map((item) => ({
          feedbackId: item.id,
          excerpt: cut(item.body),
          authorName: item.author?.displayName ?? tFeedback("unknownMember"),
        }))}
        postOptions={updates.data.items.map((post) => ({
          postId: post.id,
          date: formatDate(post.createdAt, locale),
          excerpt: cut(post.whatChanged ?? ""),
        }))}
        probation={probationView(me.probation, locale)}
      />
    </div>
  );
}
