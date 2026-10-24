"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { failureState, formFailure, resolveLocale } from "@/lib/actions";
import type { Locale } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { formatDate } from "@/lib/format";
import { localePath } from "@/lib/session";

const PAGE = "/me/invites";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The invite link is the sign-in page with the code filled in.
function inviteLink(lang: Locale, code: string): string {
  return `${siteUrl()}${localePath(lang, "/sign-in")}?invite=${encodeURIComponent(code)}`;
}

// The code appears only in the platform's answer, so it is shown once, from
// the state this returns, and never travels in a URL, a cookie or a log.
export async function createInvite(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);

  const result = await platformCall<components["schemas"]["CreatedInvite"]>(async () =>
    (await getPlatformClient()).POST("/v1/invites"),
  );
  if (!result.ok) return failureState(result, form, lang, PAGE);

  const { code, expiresAt } = result.data;
  // The date is formatted here, so the client never formats it against its own clock.
  const values = {
    code,
    link: inviteLink(lang, code),
    validUntil: formatDate(expiresAt, lang),
  };
  // The list below the form shows the new open invite in the same round trip.
  revalidatePath("/[locale]/me/invites", "page");

  return { errors: {}, values };
}

// The bound id comes back from the browser, so it is untrusted.
export async function revokeInvite(
  locale: string,
  inviteId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!UUID.test(inviteId)) return formFailure(form, "not_found");

  const result = await platformCall<undefined>(async () =>
    (await getPlatformClient()).DELETE("/v1/invites/{id}", {
      params: { path: { id: inviteId } },
    }),
  );
  if (!result.ok) return failureState(result, form, lang, PAGE);

  redirect(localePath(lang, PAGE) + "?revoked=1");
}
