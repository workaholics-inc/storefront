import { describe, expect, it } from "vitest";
import { authEnv, serverEnv, siteUrl } from "@/lib/env";

const validKey = "k".repeat(32);

describe("serverEnv", () => {
  it("returns the platform URL and key for valid values", () => {
    expect(
      serverEnv({
        PLATFORM_URL: "http://127.0.0.1:8787",
        STOREFRONT_API_KEY: validKey,
      }),
    ).toEqual({
      platformUrl: "http://127.0.0.1:8787",
      storefrontApiKey: validKey,
    });
  });

  it.each([
    ["missing", undefined],
    ["not http", "ftp://platform.test"],
    ["not a URL", "platform"],
  ])("throws naming PLATFORM_URL when it is %s", (_label, value) => {
    expect(() =>
      serverEnv({ PLATFORM_URL: value, STOREFRONT_API_KEY: validKey }),
    ).toThrow(/PLATFORM_URL/);
  });

  it("throws for a 31-character key without leaking it", () => {
    const shortKey = "s".repeat(31);
    let message = "";
    try {
      serverEnv({ PLATFORM_URL: "https://platform.test", STOREFRONT_API_KEY: shortKey });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("STOREFRONT_API_KEY");
    expect(message).not.toContain(shortKey);
  });
});

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return "";
}

describe("siteUrl", () => {
  it("returns the origin of SITE_URL, with no path or trailing slash", () => {
    expect(siteUrl({ SITE_URL: "https://example.org/some/path/" })).toBe(
      "https://example.org",
    );
  });

  it("needs nothing but SITE_URL", () => {
    expect(siteUrl({ SITE_URL: "http://localhost:3000" })).toBe(
      "http://localhost:3000",
    );
  });

  it("throws naming SITE_URL when it is missing", () => {
    expect(() => siteUrl({})).toThrow(/SITE_URL/);
  });
});

describe("authEnv", () => {
  const valid = { SITE_URL: "https://example.org/", TELEGRAM_CLIENT_ID: "123456" };

  it("returns the site origin, the client id and the default authorize URL", () => {
    expect(authEnv(valid)).toEqual({
      siteUrl: "https://example.org",
      telegramClientId: "123456",
      telegramAuthorizeUrl: "https://oauth.telegram.org/auth",
    });
  });

  it("uses TELEGRAM_AUTHORIZE_URL when it is set", () => {
    expect(
      authEnv({ ...valid, TELEGRAM_AUTHORIZE_URL: "http://127.0.0.1:4010/auth" })
        .telegramAuthorizeUrl,
    ).toBe("http://127.0.0.1:4010/auth");
  });

  it.each([
    ["SITE_URL is missing", { TELEGRAM_CLIENT_ID: "123456" }, "SITE_URL", undefined],
    ["TELEGRAM_CLIENT_ID is missing", { SITE_URL: "https://example.org" }, "TELEGRAM_CLIENT_ID", undefined],
    [
      "TELEGRAM_CLIENT_ID is not digits",
      { ...valid, TELEGRAM_CLIENT_ID: "bot1" },
      "TELEGRAM_CLIENT_ID",
      "bot1",
    ],
    [
      "TELEGRAM_AUTHORIZE_URL is not http",
      { ...valid, TELEGRAM_AUTHORIZE_URL: "ftp://x" },
      "TELEGRAM_AUTHORIZE_URL",
      "ftp://x",
    ],
  ])("throws naming the variable when %s", (_label, source, name, value) => {
    const message = messageOf(() => authEnv(source));

    expect(message).toContain(name);
    if (value) expect(message).not.toContain(value);
  });
});
