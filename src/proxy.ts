import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "./lib/cookies";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  // Slide the cookie's 30 days on every page load. Only GET: a server action
  // that deletes the cookie must not have it set again by this response.
  if (request.method === "GET") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|auth/|sign-out|_next|_vercel|.*\\..*).*)"],
};
