"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { fieldFailure, formErrorFor, formFailure, resolveLocale } from "@/lib/actions";
import { SESSION_COOKIE, safeNextPath, sessionCookieOptions } from "@/lib/cookies";
import { codeSent, type FormState } from "@/lib/form-state";
import { localePath } from "@/lib/session";
import { validateEmailAddress, validateEmailCode } from "@/lib/validation";

// Step one: the platform sends a code if a member holds the address. It answers
// the same either way, and so does this action: nothing in the state says which.
export async function startEmailSignIn(_prev: FormState, form: FormData): Promise<FormState> {
  const checked = validateEmailAddress(form);
  if (!checked.ok) return checked.state;

  const result = await platformCall<undefined>(async () =>
    (await getPlatformClient()).POST("/v1/auth/email/start", { body: checked.body }),
  );
  if (result.ok) return codeSent(checked.body.address);

  if (result.status === 400) return fieldFailure(form, "address", { key: "emailInvalid" });
  // The route needs no session, so a 401 is a configuration problem.
  if (result.status === 401) return formFailure(form, "internal_error");

  return formFailure(form, formErrorFor(result.code));
}

// Step two: the address and the code make a session, stored the way the
// Telegram callback stores it. Email never creates a member, so there is no
// invite code here and `joined` is not read.
export async function verifyEmailSignIn(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  // It comes back from the browser.
  const next = safeNextPath(form.get("next"));

  // The address is the code step's hidden field: one that fails here was altered.
  const address = validateEmailAddress(form);
  if (!address.ok) return formFailure(form, "sign_in_failed");
  const code = validateEmailCode(form);
  if (!code.ok) return code.state;

  const result = await platformCall<components["schemas"]["SignInResponse"]>(async () =>
    (await getPlatformClient()).POST("/v1/auth/email/verify", {
      body: { address: address.body.address, code: code.body.code },
    }),
  );
  if (result.ok) {
    (await cookies()).set(SESSION_COOKIE, result.data.session.token, sessionCookieOptions());
    redirect(next ?? localePath(lang, "/projects"));
  }

  if (result.status === 400) {
    return result.code === "email_code_invalid"
      ? formFailure(form, "email_code_invalid")
      : fieldFailure(form, "code", { key: "codePattern" });
  }
  if (result.status === 401) return formFailure(form, "internal_error");

  return formFailure(form, formErrorFor(result.code));
}
