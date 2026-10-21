import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getPlatformClient } from "./api/client";
import { platformCall } from "./api/errors";
import type { components } from "./api/schema";
import { SESSION_COOKIE } from "./cookies";

export type Member = components["schemas"]["Me"];

export type CurrentMember =
  | { state: "signed-out" }
  | { state: "expired" }
  | { state: "member"; member: Member }
  | { state: "unavailable"; code: string };

const ME_TIMEOUT_MS = 5000;

export const getCurrentMember = cache(async (): Promise<CurrentMember> => {
  const cookieStore = await cookies();
  if (!cookieStore.get(SESSION_COOKIE)) {
    return { state: "signed-out" };
  }

  const result = await platformCall<Member>(async () =>
    (await getPlatformClient()).GET("/v1/me", {
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    }),
  );
  if (result.ok) {
    return { state: "member", member: result.data };
  }
  // Only session_required means the session is over; any other 401 (such as a
  // wrong storefront key) is a configuration problem, not a reason to sign out.
  if (result.status === 401 && result.code === "session_required") {
    return { state: "expired" };
  }

  return { state: "unavailable", code: result.code };
});

export function localePath(locale: Locale, href: string): string {
  return getPathname({ locale, href });
}

export function signInPath(
  locale: Locale,
  params: { next?: string; error?: string } = {},
): string {
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.next) query.set("next", params.next);
  const queryString = query.toString();
  const path = localePath(locale, "/sign-in");

  return queryString ? `${path}?${queryString}` : path;
}

// Outside [locale], so no locale prefix. Page renders only: a server action
// cannot clear a cookie through a redirect.
export function expiredPath(locale: Locale, next?: string): string {
  const query = new URLSearchParams({ locale });
  if (next) query.set("next", next);

  return `/auth/expired?${query.toString()}`;
}

export async function requireMember(
  locale: Locale,
  next: string,
): Promise<Member> {
  const current = await getCurrentMember();
  switch (current.state) {
    case "member":
      return current.member;
    case "signed-out":
      return redirect(signInPath(locale, { next }));
    case "expired":
      return redirect(expiredPath(locale, next));
    case "unavailable":
      throw new Error("platform unavailable: " + current.code);
  }
}

export type Viewer = { kind: "member"; member: Member } | { kind: "visitor" };

// For pages that serve members and visitors at one address. A visitor is
// someone with no session cookie at all; an expired session is not a visitor,
// so a member never sees the public view of their own members-only work.
export async function getViewer(locale: Locale, next: string): Promise<Viewer> {
  const current = await getCurrentMember();
  switch (current.state) {
    case "member":
      return { kind: "member", member: current.member };
    case "signed-out":
      return { kind: "visitor" };
    case "expired":
      return redirect(expiredPath(locale, next));
    case "unavailable":
      throw new Error("platform unavailable: " + current.code);
  }
}
