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

export type AuthEnv = {
  siteUrl: string;
  telegramClientId: string;
  telegramAuthorizeUrl: string;
};

const DEFAULT_TELEGRAM_AUTHORIZE_URL = "https://oauth.telegram.org/auth";

const siteSchema = z.object({
  SITE_URL: z.url({ protocol: /^https?$/ }),
});

const authSchema = siteSchema.extend({
  TELEGRAM_CLIENT_ID: z.string().regex(/^\d+$/),
  TELEGRAM_AUTHORIZE_URL: z.url({ protocol: /^https?$/ }).optional(),
});

function invalidEnvironment(error: z.ZodError): Error {
  // Name the variables only: a value must never reach an error message.
  const names = [...new Set(error.issues.map((issue) => String(issue.path[0])))];
  return new Error(`Invalid server environment: ${names.join(", ")}`);
}

export function siteUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  const parsed = siteSchema.safeParse({ SITE_URL: source.SITE_URL });
  if (!parsed.success) throw invalidEnvironment(parsed.error);

  return new URL(parsed.data.SITE_URL).origin;
}

export function authEnv(
  source: Record<string, string | undefined> = process.env,
): AuthEnv {
  const parsed = authSchema.safeParse({
    SITE_URL: source.SITE_URL,
    TELEGRAM_CLIENT_ID: source.TELEGRAM_CLIENT_ID,
    TELEGRAM_AUTHORIZE_URL: source.TELEGRAM_AUTHORIZE_URL,
  });
  if (!parsed.success) throw invalidEnvironment(parsed.error);

  return {
    siteUrl: siteUrl(source),
    telegramClientId: parsed.data.TELEGRAM_CLIENT_ID,
    telegramAuthorizeUrl:
      parsed.data.TELEGRAM_AUTHORIZE_URL ?? DEFAULT_TELEGRAM_AUTHORIZE_URL,
  };
}

// The bot's username is public, but it differs per deployment, so it is a
// setting. Without it the notifications page hides the link to the bot.
const botSchema = z.object({
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{1,28}bot$/i),
});

export function telegramBotUsername(
  source: Record<string, string | undefined> = process.env,
): string | null {
  const value = source.TELEGRAM_BOT_USERNAME;
  if (value === undefined || value === "") return null;

  const parsed = botSchema.safeParse({ TELEGRAM_BOT_USERNAME: value });
  if (!parsed.success) throw invalidEnvironment(parsed.error);

  return parsed.data.TELEGRAM_BOT_USERNAME;
}
