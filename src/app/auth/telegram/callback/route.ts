import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { clientIpFrom, createPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import {
  FLOW_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/cookies";
import { authEnv, serverEnv } from "@/lib/env";
import { callbackUrl, decodeFlow } from "@/lib/oidc";
import { localePath, signInPath } from "@/lib/session";

type SignInResponse = components["schemas"]["SignInResponse"];

const SIGN_IN_TIMEOUT_MS = 15_000;

// Platform failures the sign-in page shows as they are; any other failure
// is shown as a general "did not complete".
const SHOWN_ERRORS = new Set([
  "invite_required",
  "invite_invalid",
  "invite_expired",
  "telegram_signature_invalid",
  "rate_limited",
  "unreachable",
]);

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const env = authEnv();
  const flow = decodeFlow(request.cookies.get(FLOW_COOKIE)?.value);
  const locale = flow?.locale ?? routing.defaultLocale;
  const next = flow?.next;

  // The one-time flow ends here whatever the outcome.
  const redirectTo = (path: string, token?: string) => {
    const response = NextResponse.redirect(new URL(path, env.siteUrl), 303);
    response.cookies.delete({ name: FLOW_COOKIE, path: "/auth/telegram" });
    if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

    return response;
  };
  const failWith = (error: string) => redirectTo(signInPath(locale, { error, next }));

  const params = request.nextUrl.searchParams;
  if (params.has("error")) return failWith("telegram_cancelled");

  const code = params.get("code");
  const state = params.get("state");
  if (!flow || !code || state === null || !sameValue(state, flow.state)) {
    return failWith("sign_in_failed");
  }

  const result = await platformCall<SignInResponse>(async () => {
    const platform = serverEnv();
    const client = createPlatformClient({
      baseUrl: platform.platformUrl,
      storefrontKey: platform.storefrontApiKey,
      clientIp: clientIpFrom(request.headers),
    });

    return client.POST("/v1/auth/telegram", {
      body: {
        code,
        codeVerifier: flow.verifier,
        redirectUri: callbackUrl(env),
        inviteCode: flow.invite,
      },
      signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS),
    });
  });

  if (!result.ok) {
    return failWith(SHOWN_ERRORS.has(result.code) ? result.code : "sign_in_failed");
  }

  const { session, joined } = result.data;
  const destination = joined
    ? localePath(locale, "/me/edit") + "?welcome=1"
    : (next ?? localePath(locale, "/projects"));

  return redirectTo(destination, session.token);
}
