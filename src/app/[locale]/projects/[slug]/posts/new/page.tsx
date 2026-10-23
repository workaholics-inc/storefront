import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PostForm } from "@/components/post/post-form";
import { buttonClasses } from "@/components/ui/button";
import { probationView } from "@/components/ui/probation-notice";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import { createPost } from "../actions";

type Project = components["schemas"]["Project"];
type FeedbackPage = components["schemas"]["FeedbackPage"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const PLATFORM_TIMEOUT_MS = 5000;
// The platform counts an excerpt in code points, so the form does too.
const EXCERPT_LENGTH = 140;

export default async function NewPostPage({
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
  const here = localePath(locale, `/projects/${slug}/posts/new`);
  const me = await requireMember(locale, here);
  const t = await getTranslations("Posts");
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

  // An update names the answered feedback it acted on; the first page is
  // what the form offers.
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-title-1 text-ink">{t("newTitle")}</h1>
      <PostForm
        mode="create"
        action={createPost.bind(null, locale, slug)}
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
        actedOnOptions={answered.data.items.map((item) => ({
          feedbackId: item.id,
          excerpt: Array.from(item.body).slice(0, EXCERPT_LENGTH).join(""),
          authorName: item.author?.displayName ?? tFeedback("unknownMember"),
        }))}
        probation={probationView(me.probation, locale)}
      />
    </div>
  );
}
