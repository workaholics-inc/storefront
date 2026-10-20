"use server";

import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import {
  failureState,
  fieldFailure,
  formFailure,
  resolveLocale,
} from "@/lib/actions";
import { getCurrentMember, localePath } from "@/lib/session";
import type { FormState } from "@/lib/form-state";
import {
  LIMITS,
  validateHandle,
  validateProject,
} from "@/lib/validation";

type Project = components["schemas"]["Project"];

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
