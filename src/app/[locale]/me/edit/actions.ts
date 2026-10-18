"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { SESSION_COOKIE } from "@/lib/cookies";
import { localePath, signInPath } from "@/lib/session";
import type { FormState } from "@/lib/form-state";
import { validateProfile } from "@/lib/validation";
import errorMessages from "../../../../../messages/en.json";

type Member = components["schemas"]["Member"];

const PAGE = "/me/edit";

// The bound argument comes back from the browser, so it is untrusted.
function resolveLocale(locale: string): Locale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

function valuesOf(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === "string") values[name] = value;
  }

  return values;
}

function formFailure(form: FormData, formError: string): FormState {
  return { errors: {}, formError, values: valuesOf(form) };
}

function formErrorFor(code: string): string {
  if (code === "unreachable" || code === "validation_failed") return code;

  return code in errorMessages.Errors ? code : "internal_error";
}

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
