import { NextResponse, type NextRequest } from "next/server";
import { routing, type Locale } from "@/i18n/routing";
import { FLOW_COOKIE, flowCookieOptions, safeNextPath } from "@/lib/cookies";
import { authEnv } from "@/lib/env";
import { authorizeUrl, encodeFlow, newPkce, newState } from "@/lib/oidc";
import { signInPath } from "@/lib/session";
import { readInviteCode } from "@/lib/validation";

function localeFrom(value: unknown): Locale {
  return routing.locales.find((locale) => locale === value) ?? routing.defaultLocale;
}

export async function POST(request: NextRequest) {
  const env = authEnv();
  if (request.headers.get("origin") !== env.siteUrl) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // A body that is not a form is the same as an empty form.
  const form = await request.formData().catch(() => new FormData());
  const locale = localeFrom(form.get("locale"));
  const next = safeNextPath(form.get("next"));
  const invite = readInviteCode(form.get("invite"));

  if (invite === null) {
    return NextResponse.redirect(
      new URL(signInPath(locale, { error: "invite_invalid", next }), env.siteUrl),
      303,
    );
  }

  const { verifier, challenge } = newPkce();
  const state = newState();
  const response = NextResponse.redirect(authorizeUrl(env, { state, challenge }), 303);
  response.cookies.set(
    FLOW_COOKIE,
    encodeFlow({ state, verifier, locale, next, invite }),
    flowCookieOptions(),
  );

  return response;
}
