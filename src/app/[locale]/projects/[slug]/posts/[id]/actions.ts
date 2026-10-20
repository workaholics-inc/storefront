"use server";

import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall, type PlatformResult } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import {
  failureState,
  fieldFailure,
  formFailure,
  resolveLocale,
} from "@/lib/actions";
import type { Locale } from "@/i18n/routing";
import { localePath } from "@/lib/session";
import type { FormState } from "@/lib/form-state";
import {
  LIMITS,
  validateFeedback,
  validateReply,
  validateResponse,
} from "@/lib/validation";

type FeedbackItem = components["schemas"]["FeedbackItem"];

// What the thread shows once the member is back on it.
type Saved = "feedback" | "answer" | "reply" | "edit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bound slugs and ids come back from the browser, so they are untrusted.
function bound(slug: string, ...ids: string[]): boolean {
  return LIMITS.slugPattern.test(slug) && ids.every((id) => UUID.test(id));
}

// Back to the item the member just touched, with a short confirmation, so
// answering one item never loses the reader's place.
function savedPath(
  lang: Locale,
  thread: string,
  saved: Saved,
  feedbackId: string,
): string {
  const item = encodeURIComponent(feedbackId);

  return `${localePath(lang, thread)}?saved=${saved}&item=${item}#feedback-${item}`;
}

// The thread is both the place to return to and the page a refusal is shown on.
async function finish(
  result: PlatformResult<FeedbackItem>,
  form: FormData,
  lang: Locale,
  thread: string,
  saved: Saved,
  feedbackId: string | null,
): Promise<FormState> {
  if (result.ok) {
    redirect(savedPath(lang, thread, saved, feedbackId ?? result.data.id));
  }
  // Only an answer can lack its report-back date.
  if (result.status === 400 && result.code === "recheck_required") {
    return fieldFailure(form, "recheckOn", { key: "chooseOne" });
  }

  return failureState(result, form, lang, thread);
}

export async function giveFeedback(
  locale: string,
  slug: string,
  postId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, postId)) return formFailure(form, "not_found");
  const thread = `/projects/${slug}/posts/${postId}`;
  const checked = validateFeedback(form, "give");
  if (!checked.ok) return checked.state;

  const result = await platformCall<FeedbackItem>(async () =>
    (await getPlatformClient()).POST("/v1/posts/{id}/feedback", {
      params: { path: { id: postId } },
      body: checked.body,
    }),
  );

  return finish(result, form, lang, thread, "feedback", null);
}

export async function editFeedback(
  locale: string,
  slug: string,
  postId: string,
  feedbackId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, postId, feedbackId)) return formFailure(form, "not_found");
  const thread = `/projects/${slug}/posts/${postId}`;
  const checked = validateFeedback(form, "edit");
  if (!checked.ok) return checked.state;

  const result = await platformCall<FeedbackItem>(async () =>
    (await getPlatformClient()).PUT("/v1/feedback/{id}", {
      params: { path: { id: feedbackId } },
      body: checked.body,
    }),
  );

  return finish(result, form, lang, thread, "edit", feedbackId);
}

export async function respond(
  locale: string,
  slug: string,
  postId: string,
  feedbackId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, postId, feedbackId)) return formFailure(form, "not_found");
  const thread = `/projects/${slug}/posts/${postId}`;
  const checked = validateResponse(form, new Date(), lang);
  if (!checked.ok) return checked.state;

  const result = await platformCall<FeedbackItem>(async () =>
    (await getPlatformClient()).POST("/v1/feedback/{id}/responses", {
      params: { path: { id: feedbackId } },
      body: checked.body,
    }),
  );

  return finish(result, form, lang, thread, "answer", feedbackId);
}

export async function editResponse(
  locale: string,
  slug: string,
  postId: string,
  feedbackId: string,
  responseId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, postId, feedbackId, responseId)) {
    return formFailure(form, "not_found");
  }
  const thread = `/projects/${slug}/posts/${postId}`;
  const checked = validateResponse(form, new Date(), lang);
  if (!checked.ok) return checked.state;

  const result = await platformCall<FeedbackItem>(async () =>
    (await getPlatformClient()).PUT("/v1/responses/{id}", {
      params: { path: { id: responseId } },
      body: checked.body,
    }),
  );

  return finish(result, form, lang, thread, "edit", feedbackId);
}

export async function reply(
  locale: string,
  slug: string,
  postId: string,
  feedbackId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, postId, feedbackId)) return formFailure(form, "not_found");
  const thread = `/projects/${slug}/posts/${postId}`;
  const checked = validateReply(form);
  if (!checked.ok) return checked.state;

  const result = await platformCall<FeedbackItem>(async () =>
    (await getPlatformClient()).POST("/v1/feedback/{id}/replies", {
      params: { path: { id: feedbackId } },
      body: checked.body,
    }),
  );

  return finish(result, form, lang, thread, "reply", feedbackId);
}

export async function editReply(
  locale: string,
  slug: string,
  postId: string,
  feedbackId: string,
  replyId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, postId, feedbackId, replyId)) {
    return formFailure(form, "not_found");
  }
  const thread = `/projects/${slug}/posts/${postId}`;
  const checked = validateReply(form);
  if (!checked.ok) return checked.state;

  const result = await platformCall<FeedbackItem>(async () =>
    (await getPlatformClient()).PUT("/v1/replies/{id}", {
      params: { path: { id: replyId } },
      body: checked.body,
    }),
  );

  return finish(result, form, lang, thread, "edit", feedbackId);
}
