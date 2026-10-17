import { describe, expect, it } from "vitest";
import { serverEnv } from "@/lib/env";

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
