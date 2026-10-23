"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import {
  failureState,
  fieldFailure,
  formFailure,
  resolveLocale,
  valuesOf,
} from "@/lib/actions";
import { SESSION_COOKIE } from "@/lib/cookies";
import type { FormState } from "@/lib/form-state";
import { localePath } from "@/lib/session";
import { LIMITS, validateHandle } from "@/lib/validation";

const PAGE = "/me/delete";

// The slugs the platform names in a `sole_owner` refusal. `platformCall` keeps
// only the code, so the action reads the body itself.
function slugsFrom(body: unknown): string[] {
  if (typeof body !== "object" || body === null || !("error" in body)) return [];
  const { error } = body;
  if (typeof error !== "object" || error === null || !("details" in error)) return [];
  const { details } = error;
  if (typeof details !== "object" || details === null || !("projects" in details)) return [];
  const { projects } = details;
  if (!Array.isArray(projects)) return [];

  return projects.filter(
    (slug): slug is string => typeof slug === "string" && LIMITS.slugPattern.test(slug),
  );
}

// The account is gone: the session no longer works, so the cookie goes too and
// the member lands on the confirmation. No logout call: the platform says the
// session is already over.
async function leave(lang: ReturnType<typeof resolveLocale>): Promise<never> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect(localePath(lang, PAGE) + "?deleted=1");
}

export async function deleteAccount(
  locale: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const lang = resolveLocale(locale);

  const checked = validateHandle(form.get("confirm"));
  if (!checked.ok) {
    // A value that is not shaped like a handle can never be the member's own.
    return checked.error.key === "required"
      ? fieldFailure(form, "confirm", { key: "required" })
      : formFailure(form, "confirm_mismatch");
  }

  let errorBody: unknown;
  const result = await platformCall<undefined>(async () => {
    const answer = await (await getPlatformClient()).DELETE("/v1/me", {
      body: { confirm: checked.handle },
    });
    errorBody = answer.error;

    return answer;
  });
  if (result.ok) return leave(lang);

  if (result.code === "sole_owner") {
    return {
      errors: {},
      formError: "sole_owner",
      values: { ...valuesOf(form), projects: slugsFrom(errorBody).join(",") },
    };
  }
  // Already gone, for example a double submit.
  if (result.code === "not_found") return leave(lang);

  return failureState(result, form, lang, PAGE);
}
