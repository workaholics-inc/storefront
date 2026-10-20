import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PostForm, type ActedOnOption } from "@/components/post/post-form";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import { editPost } from "../../actions";

type PostThread = components["schemas"]["PostThread"];
type FeedbackPage = components["schemas"]["FeedbackPage"];

const PLATFORM_TIMEOUT_MS = 5000;
// The platform counts an excerpt in code points, so the form does too.
const EXCERPT_LENGTH = 140;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPostPage({
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
  if (!UUID.test(id)) notFound();
  const here = localePath(locale, `/projects/${slug}/posts/${id}/edit`);
  const me = await requireMember(locale, here);
  const t = await getTranslations("Posts");
  const tErrors = await getTranslations("Errors");
  const tFeedback = await getTranslations("Feedback");

  const result = await platformCall<PostThread>(async () =>
    (await getPlatformClient()).GET("/v1/posts/{id}", {
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

  const { post } = result.data;
  // The post's own address names its project.
  if (post.project.slug !== slug) {
    redirect(
      localePath(
        locale,
        `/projects/${encodeURIComponent(post.project.slug)}/posts/${encodeURIComponent(post.id)}/edit`,
      ),
    );
  }

  const back = (
    <Link
      href={`/projects/${encodeURIComponent(post.project.slug)}/posts/${encodeURIComponent(post.id)}`}
      className={buttonClasses({ variant: "secondary" })}
    >
      {t("backToPost")}
    </Link>
  );
  if (post.author?.handle !== me.handle) {
    return <StateMessage kind="error" title={tErrors("not_author")} action={back} />;
  }
  if (post.editableUntil === null) {
    return <StateMessage kind="error" title={t("editClosed")} action={back} />;
  }

  // An update names the answered feedback it acted on. The options start with
  // the links the post already has, so saving never drops one that is not on
  // the first page.
  const options: ActedOnOption[] = post.actedOn.map((item) => ({
    feedbackId: item.feedbackId,
    excerpt: item.excerpt,
    authorName: item.author?.displayName ?? tFeedback("unknownMember"),
  }));
  if (post.kind === "update") {
    const answered = await platformCall<FeedbackPage>(async () =>
      (await getPlatformClient()).GET("/v1/projects/{slug}/feedback", {
        params: { path: { slug }, query: { state: "answered" } },
        signal: AbortSignal.timeout(PLATFORM_TIMEOUT_MS),
      }),
    );
    if (!answered.ok) {
      if (answered.status === 404) notFound();
      if (answered.code === "unreachable") return <StateMessage kind="unreachable" />;
      if (answered.status === 401 && answered.code === "session_required") {
        redirect(expiredPath(locale, here));
      }
      throw new Error("platform error: " + answered.code);
    }
    const present = new Set(options.map((option) => option.feedbackId));
    for (const item of answered.data.items) {
      if (present.has(item.id)) continue;
      options.push({
        feedbackId: item.id,
        excerpt: Array.from(item.body).slice(0, EXCERPT_LENGTH).join(""),
        authorName: item.author?.displayName ?? tFeedback("unknownMember"),
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-title-1 text-ink">{t("editTitle")}</h1>
      <PostForm
        mode="edit"
        action={editPost.bind(null, locale, slug, id)}
        limits={{
          postBodyMax: LIMITS.postBodyMax,
          questionsMax: LIMITS.questionsMax,
          questionMax: LIMITS.questionMax,
          selfCritiqueMax: LIMITS.selfCritiqueMax,
          whatChangedMax: LIMITS.whatChangedMax,
          actedOnMax: LIMITS.actedOnMax,
          rejectedAndWhyMax: LIMITS.rejectedAndWhyMax,
          oneNumberMax: LIMITS.oneNumberMax,
        }}
        actedOnOptions={options}
        initial={post}
      />
    </div>
  );
}
