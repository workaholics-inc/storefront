import "server-only";
import { z } from "zod";

export type ServerEnv = { platformUrl: string; storefrontApiKey: string };

const schema = z.object({
  PLATFORM_URL: z.url({ protocol: /^https?$/ }),
  STOREFRONT_API_KEY: z.string().min(32),
});

export function serverEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const parsed = schema.safeParse({
    PLATFORM_URL: source.PLATFORM_URL,
    STOREFRONT_API_KEY: source.STOREFRONT_API_KEY,
  });
  if (!parsed.success) {
    // Name the variables only: a value must never reach an error message.
    const names = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(`Invalid server environment: ${names.join(", ")}`);
  }

  return {
    platformUrl: parsed.data.PLATFORM_URL,
    storefrontApiKey: parsed.data.STOREFRONT_API_KEY,
  };
}
