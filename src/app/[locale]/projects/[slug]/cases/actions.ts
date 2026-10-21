"use server";

import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { failureState, formFailure, resolveLocale } from "@/lib/actions";
import type { FormState } from "@/lib/form-state";
import { localePath } from "@/lib/session";
import { LIMITS, validateCase } from "@/lib/validation";

type Case = components["schemas"]["Case"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bound slugs and ids come back from the browser, so they are untrusted.
function bound(slug: string, ...ids: string[]): boolean {
  return LIMITS.slugPattern.test(slug) && ids.every((id) => UUID.test(id));
}

function consentOf(form: FormData): "given" | "declined" | null {
  const consent = form.get("consent");

  return consent === "given" || consent === "declined" ? consent : null;
}

export async function createCase(
  locale: string,
  slug: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug)) return formFailure(form, "not_found");
  const checked = validateCase(form, "create");
  if (!checked.ok) return checked.state;

  const result = await platformCall<Case>(async () =>
    (await getPlatformClient()).POST("/v1/projects/{slug}/cases", {
      params: { path: { slug } },
      body: checked.body,
    }),
  );
  if (!result.ok) {
    return failureState(result, form, lang, `/projects/${slug}/cases/new`);
  }

  return redirect(
    localePath(lang, `/projects/${slug}/cases/${encodeURIComponent(result.data.id)}`) +
      "?saved=case",
  );
}

export async function updateCase(
  locale: string,
  slug: string,
  caseId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, caseId)) return formFailure(form, "not_found");
  const checked = validateCase(form, "update");
  if (!checked.ok) return checked.state;

  const result = await platformCall<Case>(async () =>
    (await getPlatformClient()).PATCH("/v1/cases/{id}", {
      params: { path: { id: caseId } },
      body: checked.body,
    }),
  );
  if (!result.ok) {
    return failureState(result, form, lang, `/projects/${slug}/cases/${caseId}/edit`);
  }

  return redirect(localePath(lang, `/projects/${slug}/cases/${caseId}`) + "?saved=case");
}

export async function setCredit(
  locale: string,
  slug: string,
  caseId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);
  if (!bound(slug, caseId)) return formFailure(form, "not_found");
  const consent = consentOf(form);
  if (consent === null) return formFailure(form, "validation_failed");

  const result = await platformCall<Case>(async () =>
    (await getPlatformClient()).PUT("/v1/cases/{id}/credit", {
      params: { path: { id: caseId } },
      body: { consent },
    }),
  );
  if (!result.ok) {
    return failureState(result, form, lang, `/projects/${slug}/cases/${caseId}`);
  }

  return redirect(localePath(lang, `/projects/${slug}/cases/${caseId}`) + "?saved=credit");
}
