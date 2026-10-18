"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formErrorFor, formFailure, resolveLocale, valuesOf } from "@/lib/actions";
import { SESSION_COOKIE } from "@/lib/cookies";
import { localePath, signInPath } from "@/lib/session";
import type { FormState } from "@/lib/form-state";
import { validateProfile } from "@/lib/validation";

type Member = components["schemas"]["Member"];

const PAGE = "/me/edit";

export async function updateProfile(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  const checked = validateProfile(form);
  if (!checked.ok) return checked.state;

  const result = await platformCall<Member>(async () =>
    (await getPlatformClient()).PATCH("/v1/me", { body: checked.body }),
  );
  if (result.ok) {
    redirect(localePath(lang, `/members/${encodeURIComponent(result.data.handle)}`));
  }
  if (result.status === 401) {
    if (result.code !== "session_required") {
      return formFailure(form, "internal_error");
    }
    // A server action cannot use /auth/expired: Next follows an action's
    // redirect on the server and drops its Set-Cookie, so the cookie is
    // deleted here instead.
    (await cookies()).delete(SESSION_COOKIE);
    redirect(
      signInPath(lang, {
        error: "session_required",
        next: localePath(lang, PAGE),
      }),
    );
  }
  if (result.code === "handle_taken") {
    return {
      errors: { handle: { key: "handleTaken" } },
      values: valuesOf(form),
    };
  }

  return formFailure(form, formErrorFor(result.code));
}
