import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import proxy, { config } from "@/proxy";
import { GET as expired } from "@/app/auth/expired/route";
import { POST as signOut } from "@/app/sign-out/route";

const SITE = "https://workaholics.example";
const PLATFORM = "http://platform.test";
const KEY = "k".repeat(32);

const fetchStub = vi.fn();

beforeEach(() => {
  vi.stubEnv("SITE_URL", SITE);
  vi.stubEnv("PLATFORM_URL", PLATFORM);
  vi.stubEnv("STOREFRONT_API_KEY", KEY);
  vi.stubEnv("TELEGRAM_CLIENT_ID", undefined);
  vi.stubEnv("TELEGRAM_AUTHORIZE_URL", undefined);
  fetchStub.mockReset();
  fetchStub.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchStub);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function request(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest(new URL(path, SITE), init);
}

function setCookies(response: Response) {
  return response.headers.getSetCookie();
}

function sessionCookie(response: Response) {
  return setCookies(response).find((cookie) => cookie.startsWith("wh_session="));
}

function clearsSession(response: Response) {
  return /^wh_session=;/.test(sessionCookie(response) ?? "");
}

function target(response: Response) {
  const url = new URL(response.headers.get("location") ?? "");
  return {
    origin: url.origin,
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams),
  };
}

describe("proxy", () => {
  it("sets the session cookie again with 30 days on a GET", async () => {
    const response = await proxy(
      request("/projects", { headers: { cookie: "wh_session=token-1" } }),
    );
    const cookie = sessionCookie(response) ?? "";

    expect(cookie).toContain("wh_session=token-1");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Path=/");
  });

  it("sets no session cookie without one on the request", async () => {
    const response = await proxy(request("/projects"));

    expect(sessionCookie(response)).toBeUndefined();
  });

  it("sets no session cookie on a POST", async () => {
    const response = await proxy(
      request("/projects", {
        method: "POST",
        headers: { cookie: "wh_session=token-1" },
      }),
    );

    expect(sessionCookie(response)).toBeUndefined();
  });
});

describe("proxy matcher", () => {
  const matcher = new RegExp("^" + (config.matcher[0] ?? "") + "$");

  it.each(["/", "/projects", "/en/members/sara"])("matches %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each([
    "/auth/telegram",
    "/auth/telegram/callback",
    "/auth/expired",
    "/sign-out",
    "/api/x",
    "/icon.svg",
  ])("does not match %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});

describe("GET /auth/expired", () => {
  it("redirects to sign-in with the expiry error and the next path, clearing the session", () => {
    const response = expired(
      request("/auth/expired?locale=en&next=/en/projects"),
    );

    expect(response.status).toBe(303);
    expect(target(response)).toEqual({
      origin: SITE,
      pathname: "/en/sign-in",
      query: { error: "session_required", next: "/en/projects" },
    });
    expect(response.headers.get("location")).toContain(
      "next=%2Fen%2Fprojects",
    );
    expect(clearsSession(response)).toBe(true);
  });

  it("drops a next path that leaves the site", () => {
    const response = expired(request("/auth/expired?next=//evil.example"));

    expect(target(response).query).toEqual({ error: "session_required" });
  });

  it("falls back to the default locale for an unknown one", () => {
    const response = expired(request("/auth/expired?locale=de&next=/projects"));

    expect(target(response)).toEqual({
      origin: SITE,
      pathname: "/sign-in",
      query: { error: "session_required", next: "/projects" },
    });
  });
});

describe("POST /sign-out", () => {
  const withCookie = { cookie: "wh_session=token-9" };

  it.each([
    ["no Origin", {}],
    ["a foreign Origin", { origin: "https://evil.example" }],
  ])("answers 403 for %s, without a platform call or a cookie change", async (_label, headers) => {
    const response = await signOut(
      request("/sign-out", { method: "POST", headers: { ...withCookie, ...headers } }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
    expect(fetchStub).not.toHaveBeenCalled();
    expect(setCookies(response)).toEqual([]);
  });

  it("works without any Telegram variable set", async () => {
    const response = await signOut(
      request("/sign-out", { method: "POST", headers: { origin: SITE } }),
    );

    expect(response.status).toBe(303);
  });

  it("revokes the session on the platform, clears the cookie and goes home", async () => {
    const response = await signOut(
      request("/sign-out", {
        method: "POST",
        headers: { origin: SITE, ...withCookie },
      }),
    );

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const sent = fetchStub.mock.calls[0]?.[0] as Request;
    expect(sent.method).toBe("POST");
    expect(sent.url).toBe(`${PLATFORM}/v1/auth/logout`);
    expect(sent.headers.get("authorization")).toBe("Bearer token-9");
    expect(sent.headers.get("x-storefront-key")).toBe(KEY);
    expect(response.status).toBe(303);
    expect(target(response)).toMatchObject({ origin: SITE, pathname: "/" });
    expect(clearsSession(response)).toBe(true);
  });

  it("goes to the English home when the Referer is an English page", async () => {
    const response = await signOut(
      request("/sign-out", {
        method: "POST",
        headers: {
          origin: SITE,
          referer: `${SITE}/en/projects`,
          ...withCookie,
        },
      }),
    );

    expect(target(response)).toMatchObject({ origin: SITE, pathname: "/en" });
  });

  it("does not call the platform when there is no session cookie", async () => {
    await signOut(
      request("/sign-out", { method: "POST", headers: { origin: SITE } }),
    );

    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("still signs out when the platform cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchStub.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const response = await signOut(
      request("/sign-out", {
        method: "POST",
        headers: { origin: SITE, ...withCookie },
      }),
    );

    expect(response.status).toBe(303);
    expect(clearsSession(response)).toBe(true);
  });

  it("still signs out when the storefront key is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STOREFRONT_API_KEY", undefined);
    const response = await signOut(
      request("/sign-out", {
        method: "POST",
        headers: { origin: SITE, ...withCookie },
      }),
    );

    expect(fetchStub).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(clearsSession(response)).toBe(true);
  });
});
