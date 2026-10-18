import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { routing, type Locale } from "@/i18n/routing";
import { safeNextPath } from "@/lib/cookies";
import type { AuthEnv } from "@/lib/env";
import { LIMITS } from "@/lib/validation";

const RANDOM_BYTES = 32;

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(RANDOM_BYTES).toString("base64url");

  return { verifier, challenge: pkceChallenge(verifier) };
}

export function newState(): string {
  return randomBytes(RANDOM_BYTES).toString("base64url");
}

export type Flow = {
  state: string;
  verifier: string;
  locale: Locale;
  next?: string;
  invite?: string;
};

const flowSchema = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
  locale: z.enum(routing.locales),
  next: z
    .string()
    .refine((value) => safeNextPath(value) !== undefined)
    .optional(),
  invite: z.string().max(LIMITS.inviteCodeMax).optional(),
});

export function encodeFlow(flow: Flow): string {
  return Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
}

// Anything that does not decode to a well-formed flow is null, so a tampered
// cookie can never carry an off-site redirect.
export function decodeFlow(value: string | undefined): Flow | null {
  if (!value) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = flowSchema.safeParse(json);

  return parsed.success ? parsed.data : null;
}

export function callbackUrl(env: AuthEnv): string {
  return env.siteUrl + "/auth/telegram/callback";
}

export function authorizeUrl(
  env: AuthEnv,
  p: { state: string; challenge: string },
): string {
  const url = new URL(env.telegramAuthorizeUrl);
  url.search = new URLSearchParams({
    client_id: env.telegramClientId,
    redirect_uri: callbackUrl(env),
    response_type: "code",
    scope: "openid profile",
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
  }).toString();

  return url.toString();
}
