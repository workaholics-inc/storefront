"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { failureState, resolveLocale } from "@/lib/actions";
import type { Locale } from "@/i18n/routing";
import { localePath } from "@/lib/session";
import { LIMITS } from "@/lib/validation";

type MarkReadRequest = components["schemas"]["MarkReadRequest"];

const PAGE = "/me/notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marking read never stops the member from going on: only an expired session
// is acted on (it ends at sign-in), anything else is left for the next visit.
async function markRead(
  body: MarkReadRequest,
  form: FormData,
  lang: Locale,
): Promise<void> {
  const result = await platformCall<undefined>(async () =>
    (await getPlatformClient()).POST("/v1/me/notifications/read", { body }),
  );
  if (!result.ok && result.status === 401) {
    await failureState(result, form, lang, PAGE);
  }
}

// The bound ids and slug come back from the browser, so they are untrusted,
// and the target is built only from the parts that passed. `feedbackId` is ""
// when the notification belongs to the post and not to one item; `caseId` is ""
// for every kind but a credit request, which opens the case, where the member
// decides.
export async function openNotification(
  locale: string,
  id: string,
  slug: string,
  postId: string,
  feedbackId: string,
  caseId: string,
  form: FormData,
): Promise<void> {
  const lang = resolveLocale(locale);
  const valid =
    UUID.test(id) &&
    LIMITS.slugPattern.test(slug) &&
    UUID.test(postId) &&
    (feedbackId === "" || UUID.test(feedbackId)) &&
    (caseId === "" || UUID.test(caseId));
  if (!valid) redirect(localePath(lang, PAGE));

  await markRead({ ids: [id] }, form, lang);
  if (caseId !== "") {
    redirect(localePath(lang, `/projects/${slug}/cases/${caseId}`));
  }
  const target = localePath(lang, `/projects/${slug}/posts/${postId}`);

  redirect(feedbackId === "" ? target : `${target}#feedback-${feedbackId}`);
}

export async function markAllRead(
  locale: string,
  form: FormData,
): Promise<void> {
  const lang = resolveLocale(locale);

  await markRead({ all: true }, form, lang);
  revalidatePath("/[locale]/me/notifications", "page");
  redirect(localePath(lang, PAGE));
}
