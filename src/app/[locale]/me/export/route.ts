import type { NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { siteUrl } from "@/lib/env";
import {
  expiredPath,
  getCurrentMember,
  localePath,
  signInPath,
} from "@/lib/session";

type MemberExport = components["schemas"]["MemberExport"];

// The export reads every list a member has, so it gets longer than a page does.
const EXPORT_TIMEOUT_MS = 15000;

// Absolute, built on SITE_URL (request.url can carry an internal host behind a
// proxy), and 303 so the browser follows with a GET.
function redirectTo(path: string): Response {
  return Response.redirect(new URL(path, siteUrl()), 303);
}

// The member's whole record as one JSON file, served from the storefront so the
// browser still talks only to it. Never cached, never logged.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return new Response(null, { status: 404 });
  }

  // After signing in the member lands on the page that holds the link, not on a
  // download starting from the sign-in callback.
  const next = localePath(locale, "/me");
  // The session-over answer sends the member through /auth/expired, which
  // clears the cookie: this route deletes none, because the proxy sets
  // wh_session again on every GET it handles.
  const sessionOver = () => redirectTo(expiredPath(locale, next));

  const current = await getCurrentMember();
  switch (current.state) {
    case "signed-out":
      return redirectTo(signInPath(locale, { next }));
    case "expired":
      return sessionOver();
    case "unavailable":
      throw new Error("platform unavailable: " + current.code);
    case "member":
      break;
  }
  const { handle } = current.member;

  const result = await platformCall<MemberExport>(async () =>
    (await getPlatformClient()).GET("/v1/me/export", {
      signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
    }),
  );
  if (!result.ok) {
    // The session ended between the two calls.
    if (result.status === 401 && result.code === "session_required") {
      return sessionOver();
    }

    return redirectTo(
      localePath(locale, "/members/" + encodeURIComponent(handle)) +
        "?export=failed#export",
    );
  }

  // The date is the file's own, so the name matches the time inside it.
  const date = result.data.exportedAt.slice(0, 10);

  return new Response(JSON.stringify(result.data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="workaholics-export-${handle}-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
