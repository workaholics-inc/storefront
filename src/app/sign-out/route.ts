import { NextResponse, type NextRequest } from "next/server";
import { routing, type Locale } from "@/i18n/routing";
import { clientIpFrom, createPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import { SESSION_COOKIE } from "@/lib/cookies";
import { serverEnv, siteUrl } from "@/lib/env";
import { localePath } from "@/lib/session";

const LOGOUT_TIMEOUT_MS = 5000;

function localeFromReferer(referer: string | null): Locale {
  if (referer) {
    try {
      const { pathname } = new URL(referer);
      if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
    } catch {
      // An unparsable Referer is the same as none: use the default locale.
    }
  }

  return routing.defaultLocale;
}

export async function POST(request: NextRequest) {
  const site = siteUrl();
  if (request.headers.get("origin") !== site) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    // The result is ignored: when the platform cannot be reached, or the
    // configuration is wrong, the browser is still signed out below.
    await platformCall(async () => {
      const env = serverEnv();
      const client = createPlatformClient({
        baseUrl: env.platformUrl,
        storefrontKey: env.storefrontApiKey,
        clientIp: clientIpFrom(request.headers),
        sessionToken: token,
      });

      return client.POST("/v1/auth/logout", {
        signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
      });
    });
  }

  const locale = localeFromReferer(request.headers.get("referer"));
  const response = NextResponse.redirect(
    new URL(localePath(locale, "/"), site),
    303,
  );
  response.cookies.delete({ name: SESSION_COOKIE, path: "/" });

  return response;
}
