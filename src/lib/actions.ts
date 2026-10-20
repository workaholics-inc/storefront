import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import type { PlatformResult } from "@/lib/api/errors";
import { SESSION_COOKIE } from "@/lib/cookies";
import type { FieldError, FormState } from "@/lib/form-state";
import { localePath, signInPath } from "@/lib/session";
import errorMessages from "../../messages/en.json";

// The bound arguments come back from the browser, so they are untrusted.
export function resolveLocale(locale: string): Locale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

// A name that repeats (a group of checkboxes) keeps every value, joined by ",".
export function valuesOf(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value !== "string") continue;
    values[name] = Object.hasOwn(values, name)
      ? `${values[name]},${value}`
      : value;
  }

  return values;
}

export function fieldFailure(
  form: FormData,
  field: string,
  error: FieldError,
): FormState {
  return { errors: { [field]: error }, values: valuesOf(form) };
}

export function formFailure(form: FormData, formError: string): FormState {
  return { errors: {}, formError, values: valuesOf(form) };
}

export function formErrorFor(code: string): string {
  if (code === "unreachable" || code === "validation_failed") return code;

  return code in errorMessages.Errors ? code : "internal_error";
}

// Maps a failed platform call to a form state. An expired session redirects
// to sign-in: a server action cannot use /auth/expired, because Next follows
// an action's redirect on the server and drops its Set-Cookie, so the cookie
// is deleted here instead. A 403 keeps its own code when `Errors` has a
// message for it (own_project, not_author, reply_not_allowed, ...) and reads
// as not_project_owner otherwise.
export async function failureState(
  failure: Extract<PlatformResult<unknown>, { ok: false }>,
  form: FormData,
  locale: Locale,
  page: string,
): Promise<FormState> {
  if (failure.status === 401) {
    if (failure.code !== "session_required") {
      return formFailure(form, "internal_error");
    }
    (await cookies()).delete(SESSION_COOKIE);
    redirect(signInPath(locale, { error: "session_required", next: localePath(locale, page) }));
  }
  if (failure.status === 403) {
    return formFailure(
      form,
      Object.hasOwn(errorMessages.Errors, failure.code)
        ? failure.code
        : "not_project_owner",
    );
  }
  if (failure.status === 404) return formFailure(form, "not_found");

  return formFailure(form, formErrorFor(failure.code));
}
