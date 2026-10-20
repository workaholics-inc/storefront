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
import { LIMITS, validatePost } from "@/lib/validation";

type Post = components["schemas"]["Post"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The bound slug and id come back from the browser, so they are untrusted.
function validSlug(slug: string): boolean {
  return LIMITS.slugPattern.test(slug);
}

function validId(id: string): boolean {
  return UUID.test(id);
}

function kindOf(form: FormData): "wip" | "update" | null {
  const kind = form.get("kind");

  return kind === "wip" || kind === "update" ? kind : null;
}

// The platform's own refusals of the post's content read as form errors.
async function refused(
  result: Extract<PlatformResult<unknown>, { ok: false }>,
  form: FormData,
  lang: Locale,
  page: string,
): Promise<FormState> {
  if (
    result.status === 400 &&
    (result.code === "acted_on_invalid" || result.code === "validation_failed")
  ) {
    return formFailure(form, result.code);
  }

  return failureState(result, form, lang, page);
}

export async function createPost(
  locale: string,
  slug: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!validSlug(slug)) return formFailure(form, "not_found");
  const page = `/projects/${slug}/posts/new`;
  const kind = kindOf(form);
  if (kind === null) return fieldFailure(form, "kind", { key: "chooseOne" });
  const checked = validatePost(form, kind);
  if (!checked.ok) return checked.state;

  const result = await platformCall<Post>(async () =>
    (await getPlatformClient()).POST("/v1/projects/{slug}/posts", {
      params: { path: { slug } },
      body: checked.body,
    }),
  );
  if (result.ok) {
    redirect(
      localePath(
        lang,
        `/projects/${slug}/posts/${encodeURIComponent(result.data.id)}`,
      ),
    );
  }

  return refused(result, form, lang, page);
}

export async function editPost(
  locale: string,
  slug: string,
  postId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!validSlug(slug) || !validId(postId)) return formFailure(form, "not_found");
  const thread = `/projects/${slug}/posts/${postId}`;
  const page = `${thread}/edit`;
  const kind = kindOf(form);
  if (kind === null) return fieldFailure(form, "kind", { key: "chooseOne" });
  const checked = validatePost(form, kind);
  if (!checked.ok) return checked.state;

  const result = await platformCall<Post>(async () =>
    (await getPlatformClient()).PUT("/v1/posts/{id}", {
      params: { path: { id: postId } },
      body: checked.body,
    }),
  );
  if (result.ok) redirect(localePath(lang, thread));

  return refused(result, form, lang, page);
}
