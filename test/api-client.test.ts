import { describe, expect, it } from "vitest";
import { clientIpFrom, createPlatformClient } from "@/lib/api/client";

const health = { status: "ok", version: "0.1.0", time: "2026-10-17T08:30:00.000Z" };

function recordingFetch() {
  const requests: Request[] = [];
  const fakeFetch = async (input: Request) => {
    requests.push(input);
    return new Response(JSON.stringify(health), {
      headers: { "content-type": "application/json" },
    });
  };
  return { requests, fakeFetch: fakeFetch as unknown as typeof fetch };
}

describe("createPlatformClient", () => {
  it("sends GET /v1/health to the base URL with the storefront key", async () => {
    const { requests, fakeFetch } = recordingFetch();
    const client = createPlatformClient({
      baseUrl: "http://platform.test",
      storefrontKey: "key-for-tests",
      fetch: fakeFetch,
    });

    await client.GET("/v1/health");

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.url).toBe("http://platform.test/v1/health");
    expect(requests[0]?.headers.get("X-Storefront-Key")).toBe("key-for-tests");
  });

  it("sends X-Client-IP and the bearer token only when given", async () => {
    const withBoth = recordingFetch();
    await createPlatformClient({
      baseUrl: "http://platform.test",
      storefrontKey: "key-for-tests",
      clientIp: "203.0.113.5",
      sessionToken: "session-token",
      fetch: withBoth.fakeFetch,
    }).GET("/v1/health");

    const request = withBoth.requests[0];
    expect(request?.headers.get("X-Client-IP")).toBe("203.0.113.5");
    expect(request?.headers.get("Authorization")).toBe("Bearer session-token");

    const withNeither = recordingFetch();
    await createPlatformClient({
      baseUrl: "http://platform.test",
      storefrontKey: "key-for-tests",
      fetch: withNeither.fakeFetch,
    }).GET("/v1/health");

    const bare = withNeither.requests[0];
    expect(bare?.headers.has("X-Client-IP")).toBe(false);
    expect(bare?.headers.has("Authorization")).toBe(false);
  });
});

describe("clientIpFrom", () => {
  it("takes the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(clientIpFrom(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(clientIpFrom(headers)).toBe("198.51.100.7");
  });

  it("returns undefined when neither header is present", () => {
    expect(clientIpFrom(new Headers())).toBeUndefined();
  });
});
