export const SESSION_COOKIE = "wh_session";
export const FLOW_COOKIE = "wh_oidc";
export const SESSION_MAX_AGE_SECONDS = 2_592_000;
export const FLOW_MAX_AGE_SECONDS = 600;

// Secure by default: only a plain-http SITE_URL (local development) turns it off.
export function cookieSecure(): boolean {
  return !process.env.SITE_URL?.startsWith("http://");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function flowCookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/auth/telegram",
    maxAge: FLOW_MAX_AGE_SECONDS,
  };
}

const MAX_NEXT_PATH_LENGTH = 512;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

// A same-site path to return to, or undefined: never an absolute or
// protocol-relative address, so a crafted `next` cannot leave the site.
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length > MAX_NEXT_PATH_LENGTH) return undefined;
  if (!value.startsWith("/")) return undefined;
  if (value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (CONTROL_CHARACTERS.test(value)) return undefined;

  return value;
}
