"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { failureState, fieldFailure, resolveLocale } from "@/lib/actions";
import type { Locale } from "@/i18n/routing";
import { codeSent, type FormState } from "@/lib/form-state";
import { localePath } from "@/lib/session";
import { validateEmailAddress, validateEmailCode } from "@/lib/validation";

type IdentityList = components["schemas"]["IdentityList"];

const PAGE = "/me/account";

// The page shows the notice from the one word in the query. The address is
// personal data and never goes into the address bar.
async function done(lang: Locale, notice: "added" | "removed"): Promise<never> {
  revalidatePath("/[locale]/me/account", "page");
  redirect(localePath(lang, PAGE) + "?email=" + notice);
}

// Step one: the platform sends a code to the address. Nothing changes on the
// site yet, so the form moves on to its code step and the page stays as it is.
export async function startAddEmail(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);

  const checked = validateEmailAddress(form);
  if (!checked.ok) return checked.state;

  const result = await platformCall<undefined>(async () =>
    (await getPlatformClient()).POST("/v1/me/identities/email", { body: checked.body }),
  );
  if (result.ok) return codeSent(checked.body.address);

  // An address the platform refuses is the same field error as a bad shape.
  if (result.status === 400) return fieldFailure(form, "address", { key: "emailInvalid" });

  return failureState(result, form, lang, PAGE);
}

// Step two: the code the member typed connects the address.
export async function verifyAddEmail(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);

  const checked = validateEmailCode(form);
  if (!checked.ok) return checked.state;

  const result = await platformCall<IdentityList>(async () =>
    (await getPlatformClient()).POST("/v1/me/identities/email/verify", {
      body: checked.body,
    }),
  );
  // The returned list is not read: the page reads the methods again.
  if (result.ok) return done(lang, "added");

  if (result.status === 400 && result.code !== "email_code_invalid") {
    return fieldFailure(form, "code", { key: "codePattern" });
  }

  return failureState(result, form, lang, PAGE);
}

export async function removeEmail(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);

  const result = await platformCall<IdentityList>(async () =>
    (await getPlatformClient()).DELETE("/v1/me/identities/email"),
  );
  if (result.ok) return done(lang, "removed");

  return failureState(result, form, lang, PAGE);
}
