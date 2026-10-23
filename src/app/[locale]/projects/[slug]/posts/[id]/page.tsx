import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import {
  FeedbackItem,
  type FeedbackControls,
  type FeedbackNotice,
} from "@/components/feedback/feedback-item";
import {
  FeedbackThread,
  type ThreadTab,
} from "@/components/feedback/feedback-thread";
import { ReplyForm } from "@/components/feedback/reply-form";
import { ResponseControl } from "@/components/feedback/response-control";
import { memberName } from "@/components/member/member-name";
import { ReportForm, type ReportKind } from "@/components/moderation/report-form";
import { Post } from "@/components/post/post";
import { PublicPost } from "@/components/post/public-post";
import { VisibilityForm } from "@/components/post/visibility-form";
import { probationView } from "@/components/ui/probation-notice";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { recheckChoices } from "@/lib/recheck";
import {
  expiredPath,
  getCurrentMember,
  getViewer,
  localePath,
  signInPath,
} from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import {
  editFeedback,
  editReply,
  editResponse,
  fileReport,
  giveFeedback,
  reply,
  respond,
  setPostVisibility,
} from "./actions";

type PostThread = components["schemas"]["PostThread"];
type PublicPostData = components["schemas"]["PublicPost"];
type FeedbackItemData = components["schemas"]["FeedbackItem"];
type Owner = NonNullable<components["schemas"]["MemberRef"]>;

const THREAD_TIMEOUT_MS = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTICES: readonly FeedbackNotice[] = ["feedback", "answer", "reply", "edit"];

const ASIDE_HEADING = "m-0 text-label font-bold text-ink-muted";

// A search param is a string, a list of them, or absent.
function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// One platform call per request, shared by the page and its metadata.
const loadPublicPost = cache(async (id: string) =>
  platformCall<PublicPostData>(async () =>
    (await getPlatformClient()).GET("/v1/public/posts/{id}", {
      params: { path: { id } },
      signal: AbortSignal.timeout(THREAD_TIMEOUT_MS),
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

  const result = await loadPublicPost(id);
  if (!result.ok) return {};
  const t = await getTranslations({ locale, namespace: "PublicPages" });

  return { title: t("postMetaTitle", { project: result.data.project.name }) };
}

// What a visitor (no session cookie at all) sees: the owner's public post and
// nothing around it. Every refusal reads as sign-in, so a members-only address
// reveals nothing.
async function PublicPostView({
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
  const t = await getTranslations("Feedback");
  const tPosts = await getTranslations("Posts");
  const tPublic = await getTranslations("PublicPages");

  const result = await loadPublicPost(id);
  if (!result.ok) {
    if (result.status === 404) redirect(signInPath(locale, { next: here }));
    if (result.code === "unreachable") return <StateMessage kind="unreachable" />;
    throw new Error("platform error: " + result.code);
  }

  const post = result.data;
  // The post's own address names its project.
  if (post.project.slug !== slug) {
    redirect(
      localePath(
        locale,
        `/projects/${encodeURIComponent(post.project.slug)}/posts/${encodeURIComponent(post.id)}`,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("breadcrumbs")}>
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-small text-ink-muted">
          <li>
            {post.project.isPublic ? (
              <Link
                href={`/projects/${encodeURIComponent(post.project.slug)}`}
                className="text-ink-muted no-underline hover:underline"
              >
                <bdi>{post.project.name}</bdi>
              </Link>
            ) : (
              <bdi>{post.project.name}</bdi>
            )}
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">
            {post.kind === "wip" ? tPosts("wip") : tPosts("update")} ·{" "}
            {formatDate(post.createdAt, locale)}
          </li>
        </ol>
      </nav>
      <h1 className="m-0 text-title-2 text-ink">
        {tPublic.rich("postOn", {
          project: post.project.name,
          n: (chunks) => <bdi>{chunks}</bdi>,
        })}
      </h1>
      {post.project.isPublic ? null : (
        <p className="m-0 text-small text-ink-muted">{tPublic("projectMembersOnly")}</p>
      )}
      <PublicPost post={post} variant="full" />
      <StateMessage kind="members-only" title={tPublic("feedbackMembersOnly")} />
    </div>
  );
}

export default async function PostThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    saved?: string | string[];
    item?: string | string[];
  }>;
}) {
  const { locale, slug: rawSlug, id: rawId } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const slug = rawSlug.toLowerCase();
  const id = rawId.toLowerCase();
  if (!UUID.test(id)) notFound();
  const here = localePath(locale, `/projects/${slug}/posts/${id}`);
  const viewer = await getViewer(locale, here);
  if (viewer.kind === "visitor") {
    return <PublicPostView locale={locale} slug={slug} id={id} here={here} />;
  }
  const me = viewer.member;
  const t = await getTranslations("Feedback");
  const tPosts = await getTranslations("Posts");

  const query = await searchParams;
  const tabParam = firstOf(query.tab);
  const tab: ThreadTab =
    tabParam === "awaiting" || tabParam === "answered" ? tabParam : "all";
  const savedParam = firstOf(query.saved);
  const saved = NOTICES.find((notice) => notice === savedParam);
  const savedItem = firstOf(query.item);

  const result = await platformCall<PostThread>(async () =>
    (await getPlatformClient()).GET("/v1/posts/{id}", {
      params: { path: { id } },
      signal: AbortSignal.timeout(THREAD_TIMEOUT_MS),
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

  const { post, feedback } = result.data;
  // The post's own address names its project.
  if (post.project.slug !== slug) {
    redirect(
      localePath(
        locale,
        `/projects/${encodeURIComponent(post.project.slug)}/posts/${encodeURIComponent(post.id)}`,
      ),
    );
  }

  const now = new Date();
  const owners = post.project.owners.filter(
    (owner): owner is Owner => owner !== null,
  );
  const isOwner = owners.some((owner) => owner.handle === me.handle);
  const isGiver = (item: FeedbackItemData) => item.author?.handle === me.handle;
  const choices = recheckChoices(now, locale);
  const threadPath = `/projects/${encodeURIComponent(post.project.slug)}/posts/${encodeURIComponent(post.id)}`;

  const reportForm = (kind: ReportKind, targetId: string) => (
    <ReportForm
      idPrefix={`report-${kind}-${targetId}`}
      action={fileReport.bind(null, locale, slug, id, kind, targetId)}
      kind={kind}
      reasonMax={LIMITS.reportReasonMax}
    />
  );

  const renderItem = (item: FeedbackItemData) => {
    const response = item.response;
    const giverName = memberName(item.author, t);
    const controls: FeedbackControls = {};

    // The owner answers, and reports back on a testing answer with a new one.
    if (isOwner && (response === null || response.status === "testing")) {
      controls.answer = (
        <ResponseControl
          idPrefix={`answer-${item.id}`}
          action={respond.bind(null, locale, slug, id, item.id)}
          giverName={giverName}
          choices={choices}
          reasonMax={LIMITS.reasonMax}
        />
      );
    }
    if (response !== null && response.editableUntil !== null) {
      controls.editAnswer = (
        <ResponseControl
          idPrefix={`edit-answer-${response.id}`}
          action={editResponse.bind(null, locale, slug, id, item.id, response.id)}
          giverName={giverName}
          choices={choices}
          reasonMax={LIMITS.reasonMax}
          initial={{
            status: response.status,
            reason: response.reason,
            recheckOn: response.recheckOn,
          }}
        />
      );
    }
    if (response !== null && (isOwner || isGiver(item))) {
      controls.reply = (
        <ReplyForm
          idPrefix={`reply-${item.id}`}
          action={reply.bind(null, locale, slug, id, item.id)}
          bodyMax={LIMITS.replyBodyMax}
        />
      );
    }
    if (item.editableUntil !== null) {
      controls.edit = (
        <FeedbackForm
          idPrefix={`edit-feedback-${item.id}`}
          action={editFeedback.bind(null, locale, slug, id, item.id)}
          questions={post.feedbackWanted}
          bodyMax={LIMITS.feedbackBodyMax}
          mode="edit"
          initial={{ body: item.body, questionIndex: item.questionIndex }}
        />
      );
    }
    const editReplies: Record<string, ReactNode> = {};
    for (const entry of item.replies) {
      if (entry.editableUntil === null) continue;
      editReplies[entry.id] = (
        <ReplyForm
          idPrefix={`edit-reply-${entry.id}`}
          action={editReply.bind(null, locale, slug, id, item.id, entry.id)}
          bodyMax={LIMITS.replyBodyMax}
          initial={{ body: entry.body }}
        />
      );
    }
    if (Object.keys(editReplies).length > 0) controls.editReplies = editReplies;
    if (item.hidden === null && !isGiver(item)) {
      controls.report = reportForm("feedback", item.id);
    }
    const reportReplies: Record<string, ReactNode> = {};
    for (const entry of item.replies) {
      if (entry.hidden !== null || entry.author?.handle === me.handle) continue;
      reportReplies[entry.id] = reportForm("reply", entry.id);
    }
    if (Object.keys(reportReplies).length > 0) controls.reportReplies = reportReplies;

    return (
      <FeedbackItem
        item={item}
        locale={locale}
        notice={saved !== undefined && savedItem === item.id ? saved : undefined}
        controls={controls}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("breadcrumbs")}>
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-small text-ink-muted">
          <li>
            <Link
              href={`/projects/${encodeURIComponent(post.project.slug)}`}
              className="text-ink-muted no-underline hover:underline"
            >
              <bdi>{post.project.name}</bdi>
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">
            {post.kind === "wip" ? tPosts("wip") : tPosts("update")} ·{" "}
            {formatDate(post.createdAt, locale)}
          </li>
        </ol>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_var(--container-aside)] lg:items-start lg:gap-12">
        <div className="flex min-w-0 flex-col gap-8">
          <Post
            post={post}
            locale={locale}
            variant="full"
            showThreadLink={false}
            canGiveFeedback={!isOwner && post.hidden === null}
            now={now}
            report={
              post.hidden === null && post.author?.handle !== me.handle
                ? reportForm("post", post.id)
                : undefined
            }
          />
          <FeedbackThread
            items={feedback}
            tab={tab}
            tabHref={(name) =>
              name === "all" ? threadPath : `${threadPath}?tab=${name}`
            }
            renderItem={renderItem}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          {isOwner ? (
            <>
              <section className="flex flex-col gap-2">
                <h2 className={ASIDE_HEADING}>{t("ruleTitle")}</h2>
                <p className="m-0">{t("ruleBody")}</p>
              </section>
              <VisibilityForm
                action={setPostVisibility.bind(null, locale, slug, id)}
                visibility={post.visibility}
                isPublic={post.isPublic}
                postKind={post.kind}
                probation={probationView(me.probation, locale)}
              />
            </>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h2 className={ASIDE_HEADING}>{t("goodTitle")}</h2>
                <p className="m-0">{t("goodBody")}</p>
              </section>
              {post.hidden === null ? (
                <section className="flex flex-col gap-3">
                  <h2 className={ASIDE_HEADING}>{t("composerTitle")}</h2>
                  <p className="m-0 text-small text-ink-muted">{t("composerHint")}</p>
                  <FeedbackForm
                    idPrefix="give"
                    action={giveFeedback.bind(null, locale, slug, id)}
                    questions={post.feedbackWanted}
                    bodyMax={LIMITS.feedbackBodyMax}
                    mode="give"
                  />
                </section>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
