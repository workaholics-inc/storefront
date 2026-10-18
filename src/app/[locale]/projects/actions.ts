"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall, type PlatformResult } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { SESSION_COOKIE } from "@/lib/cookies";
import { getCurrentMember, localePath, signInPath } from "@/lib/session";
import type { FieldError, FormState } from "@/lib/form-state";
import {
  LIMITS,
  validateHandle,
  validateProject,
} from "@/lib/validation";
import errorMessages from "../../../../messages/en.json";

type Project = components["schemas"]["Project"];

// The bound arguments come back from the browser, so they are untrusted.
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

function fieldFailure(
  form: FormData,
  field: string,
  error: FieldError,
): FormState {
  return { errors: { [field]: error }, values: valuesOf(form) };
}

function formFailure(form: FormData, formError: string): FormState {
  return { errors: {}, formError, values: valuesOf(form) };
}

function formErrorFor(code: string): string {
  if (code === "unreachable" || code === "validation_failed") return code;

  return code in errorMessages.Errors ? code : "internal_error";
}

// Maps a failed platform call to a form state. An expired session redirects
// to sign-in: a server action cannot use /auth/expired, because Next follows
// an action's redirect on the server and drops its Set-Cookie, so the cookie
// is deleted here instead.
async function failureState(
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
  if (failure.status === 403) return formFailure(form, "not_project_owner");
  if (failure.status === 404) return formFailure(form, "not_found");

  return formFailure(form, formErrorFor(failure.code));
}

function validSlug(slug: string): boolean {
  return LIMITS.slugPattern.test(slug);
}

export async function createProject(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  const page = "/projects/new";
  const checked = validateProject(form, "create");
  if (!checked.ok) return checked.state;

  const result = await platformCall<Project>(async () =>
    (await getPlatformClient()).POST("/v1/projects", { body: checked.body }),
  );
  if (result.ok) {
    redirect(localePath(lang, `/projects/${encodeURIComponent(result.data.slug)}`));
  }
  if (result.code === "slug_taken") {
    return fieldFailure(form, "slug", { key: "slugTaken" });
  }

  return failureState(result, form, lang, page);
}

export async function updateProject(
  locale: string,
  slug: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!validSlug(slug)) return formFailure(form, "not_found");
  const page = `/projects/${slug}/edit`;
  const checked = validateProject(form, "update");
  if (!checked.ok) return checked.state;

  const result = await platformCall<Project>(async () =>
    (await getPlatformClient()).PATCH("/v1/projects/{slug}", {
      params: { path: { slug } },
      body: checked.body,
    }),
  );
  if (result.ok) redirect(localePath(lang, `/projects/${slug}`));

  return failureState(result, form, lang, page);
}

export async function addOwner(
  locale: string,
  slug: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!validSlug(slug)) return formFailure(form, "not_found");
  const page = `/projects/${slug}/edit`;
  const checked = validateHandle(form.get("handle"));
  if (!checked.ok) return fieldFailure(form, "handle", checked.error);

  const result = await platformCall<Project>(async () =>
    (await getPlatformClient()).POST("/v1/projects/{slug}/owners", {
      params: { path: { slug } },
      body: { handle: checked.handle },
    }),
  );
  if (result.ok) redirect(localePath(lang, page));
  if (result.status === 404) {
    return fieldFailure(form, "handle", { key: "memberNotFound" });
  }

  return failureState(result, form, lang, page);
}

export async function removeOwner(
  locale: string,
  slug: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!validSlug(slug)) return formFailure(form, "not_found");
  const page = `/projects/${slug}/edit`;
  const checked = validateHandle(form.get("handle"));
  if (!checked.ok) return formFailure(form, "not_found");

  const result = await platformCall<Project>(async () =>
    (await getPlatformClient()).DELETE("/v1/projects/{slug}/owners/{handle}", {
      params: { path: { slug, handle: checked.handle } },
    }),
  );
  if (result.ok) {
    // A member who removes themself can no longer edit: send them to the page.
    const current = await getCurrentMember();
    const removedSelf =
      current.state === "member" && current.member.handle === checked.handle;
    redirect(localePath(lang, removedSelf ? `/projects/${slug}` : page));
  }
  if (result.code === "last_owner") return formFailure(form, "last_owner");

  return failureState(result, form, lang, page);
}
