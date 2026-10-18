import { NextResponse, type NextRequest } from "next/server";
import { routing, type Locale } from "@/i18n/routing";
import { SESSION_COOKIE, safeNextPath } from "@/lib/cookies";
import { siteUrl } from "@/lib/env";
import { signInPath } from "@/lib/session";

function isLocale(value: string | null): value is Locale {
  return routing.locales.some((locale) => locale === value);
}

// A page that finds the session expired redirects here, because a page render
// cannot clear a cookie itself. Absolute URLs, built on SITE_URL: request.url
// can carry an internal host behind a proxy.
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requested = searchParams.get("locale");
  const locale = isLocale(requested) ? requested : routing.defaultLocale;
  const next = safeNextPath(searchParams.get("next"));

  const response = NextResponse.redirect(
    new URL(signInPath(locale, { error: "session_required", next }), siteUrl()),
    303,
  );
  response.cookies.delete({ name: SESSION_COOKIE, path: "/" });

  return response;
}
