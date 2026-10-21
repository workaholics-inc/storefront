import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  CaseForm,
  type CasePostOption,
} from "@/components/case/case-form";
import type { ActedOnOption } from "@/components/post/post-form";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import { updateCase } from "../../actions";

type CaseData = components["schemas"]["Case"];
type FeedbackPage = components["schemas"]["FeedbackPage"];
type PostPage = components["schemas"]["PostPage"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const PLATFORM_TIMEOUT_MS = 5000;
// A case often reaches back past the newest items: the routes' maximum.
const PAGE_SIZE = 100;
// The platform counts an excerpt in code points, so the form does too.
const EXCERPT_LENGTH = 140;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cut = (text: string) => Array.from(text).slice(0, EXCERPT_LENGTH).join("");

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
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
  const here = localePath(locale, `/projects/${slug}/cases/${id}/edit`);
  const me = await requireMember(locale, here);
  const t = await getTranslations("Cases");
  const tFeedback = await getTranslations("Feedback");

  const result = await platformCall<CaseData>(async () =>
    (await getPlatformClient()).GET("/v1/cases/{id}", {
      params: { path: { id } },
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

  const kase = result.data;
  // The case's own address names its project.
  if (kase.project.slug !== slug) {
    redirect(
      localePath(
        locale,
        `/projects/${encodeURIComponent(kase.project.slug)}/cases/${encodeURIComponent(kase.id)}/edit`,
      ),
    );
  }

  const owners = kase.project.owners.filter(
    (owner): owner is Owner => owner !== null,
  );
  if (!owners.some((owner) => owner.handle === me.handle)) {
    return (
      <StateMessage
        kind="error"
        title={t("onlyOwners")}
        action={
          <Link
            href={`/projects/${encodeURIComponent(kase.project.slug)}/cases/${encodeURIComponent(kase.id)}`}
            className={buttonClasses({ variant: "secondary" })}
          >
            {t("backToCase")}
          </Link>
        }
      />
    );
  }

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

  // The options start with the links the case already has, so saving never
  // drops one that is not on the first page.
  const feedbackOptions: ActedOnOption[] = kase.feedback.map((item) => ({
    feedbackId: item.id,
    excerpt: item.excerpt,
    authorName: item.author?.displayName ?? tFeedback("unknownMember"),
  }));
  const presentFeedback = new Set(feedbackOptions.map((option) => option.feedbackId));
  for (const item of answered.data.items) {
    if (presentFeedback.has(item.id)) continue;
    feedbackOptions.push({
      feedbackId: item.id,
      excerpt: cut(item.body),
      authorName: item.author?.displayName ?? tFeedback("unknownMember"),
    });
  }

  const pageOption = (post: PostPage["items"][number]): CasePostOption => ({
    postId: post.id,
    date: formatDate(post.createdAt, locale),
    excerpt: cut(post.whatChanged ?? ""),
  });
  const onPage = new Map(updates.data.items.map((post) => [post.id, post]));
  // A linked update past the first page has no excerpt: no extra call for it.
  const postOptions: CasePostOption[] = kase.posts.map((post) => {
    const found = onPage.get(post.id);

    return found
      ? pageOption(found)
      : {
          postId: post.id,
          date: formatDate(post.createdAt, locale),
          excerpt: "",
        };
  });
  const presentPosts = new Set(postOptions.map((option) => option.postId));
  for (const post of updates.data.items) {
    if (!presentPosts.has(post.id)) postOptions.push(pageOption(post));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-title-1 text-ink">{t("editTitle")}</h1>
      <p className="m-0 max-w-read text-small text-ink-muted">{t("editNote")}</p>
      <CaseForm
        mode="edit"
        action={updateCase.bind(null, locale, slug, id)}
        limits={{
          titleMax: LIMITS.caseTitleMax,
          feedbackStoryMax: LIMITS.caseFeedbackStoryMax,
          changeMax: LIMITS.caseChangeMax,
          resultMax: LIMITS.caseResultMax,
          oneNumberMax: LIMITS.caseOneNumberMax,
        }}
        feedbackOptions={feedbackOptions}
        postOptions={postOptions}
        initial={kase}
      />
    </div>
  );
}
