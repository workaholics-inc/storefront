import "server-only";
import { cookies, headers } from "next/headers";
import createClient from "openapi-fetch";
import { serverEnv } from "../env";
import type { paths } from "./schema";

export const SESSION_COOKIE = "wh_session";

export type PlatformClientOptions = {
  baseUrl: string;
  storefrontKey: string;
  clientIp?: string;
  sessionToken?: string;
  fetch?: typeof fetch;
};

export function createPlatformClient(options: PlatformClientOptions) {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    headers: {
      "X-Storefront-Key": options.storefrontKey,
      ...(options.clientIp ? { "X-Client-IP": options.clientIp } : {}),
      ...(options.sessionToken
        ? { Authorization: `Bearer ${options.sessionToken}` }
        : {}),
    },
  });
}

export type PlatformClient = ReturnType<typeof createPlatformClient>;

export function clientIpFrom(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }
  return headers.get("x-real-ip")?.trim() || undefined;
}

export async function getPlatformClient(): Promise<PlatformClient> {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const env = serverEnv();

  return createPlatformClient({
    baseUrl: env.platformUrl,
    storefrontKey: env.storefrontApiKey,
    clientIp: clientIpFrom(requestHeaders),
    sessionToken: cookieStore.get(SESSION_COOKIE)?.value,
  });
}
