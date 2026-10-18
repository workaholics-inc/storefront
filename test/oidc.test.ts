import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callback } from "@/app/auth/telegram/callback/route";
import { POST as start } from "@/app/auth/telegram/route";
import { authEnv } from "@/lib/env";
import {
  authorizeUrl,
  decodeFlow,
  encodeFlow,
  newPkce,
  pkceChallenge,
  type Flow,
} from "@/lib/oidc";
import { LIMITS } from "@/lib/validation";

const SITE = "https://workaholics.example";
const PLATFORM = "http://platform.test";
const KEY = "k".repeat(32);
const CALLBACK = `${SITE}/auth/telegram/callback`;
const TOKEN = "mock-session-token-not-a-secret-00000000000";

const fetchStub = vi.fn();

beforeEach(() => {
  vi.stubEnv("SITE_URL", SITE);
  vi.stubEnv("PLATFORM_URL", PLATFORM);
  vi.stubEnv("STOREFRONT_API_KEY", KEY);
  vi.stubEnv("TELEGRAM_CLIENT_ID", "123456");
  vi.stubEnv("TELEGRAM_AUTHORIZE_URL", undefined);
  fetchStub.mockReset();
  vi.stubGlobal("fetch", fetchStub);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The contract's SignInResponse example, with `joined` chosen by the case.
function signInResponse(joined: boolean) {
  return new Response(
    JSON.stringify({
      session: { token: TOKEN, expiresAt: "2026-11-19T10:00:00.000Z" },
      member: {
        handle: "sara",
        displayName: "سارا رحیمی",
        bio: "",
        links: [],
        invitedBy: null,
        joinedAt: "2026-10-20T10:00:00.000Z",
      },
      joined,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function errorResponse(status: number, code: string) {
  return new Response(JSON.stringify({ error: { code, message: "x" } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function target(response: Response) {
  const url = new URL(response.headers.get("location") ?? "");
  return {
    origin: url.origin,
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams),
  };
}

function cookieNamed(response: Response, name: string) {
  return response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
}

function flowCookieValue(response: Response) {
  return /^wh_oidc=([^;]*)/.exec(cookieNamed(response, "wh_oidc") ?? "")?.[1];
}

function startRequest(
  form: Record<string, string>,
  headers: Record<string, string> = { origin: SITE },
) {
  return new NextRequest(new URL("/auth/telegram", SITE), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(form),
  });
}

function callbackRequest(query: Record<string, string>, flowValue?: string) {
  return new NextRequest(
    new URL(`/auth/telegram/callback?${new URLSearchParams(query)}`, SITE),
    { headers: flowValue ? { cookie: `wh_oidc=${flowValue}` } : {} },
  );
}

// A real flow, made by the start route, as the browser would carry it back.
async function begin(form: Record<string, string> = {}) {
  const response = await start(startRequest(form));
  const value = flowCookieValue(response);
  const flow = decodeFlow(value);
  if (!value || !flow) throw new Error("the start route set no readable flow");

  return { value, flow, response };
}

function raw(value: object) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("PKCE", () => {
  it("makes a 43-character URL-safe verifier and its challenge", () => {
    const { verifier, challenge } = newPkce();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(pkceChallenge(verifier));
    expect(newPkce().verifier).not.toBe(verifier);
  });

  it("matches the RFC 7636 S256 example", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("the flow cookie value", () => {
  const flow: Flow = {
    state: "s-1",
    verifier: "v-1",
    locale: "en",
    next: "/en/projects",
    invite: "abc",
  };

  it("survives encoding and decoding", () => {
    expect(decodeFlow(encodeFlow(flow))).toEqual(flow);
    const bare: Flow = { state: "s", verifier: "v", locale: "fa" };
    expect(decodeFlow(encodeFlow(bare))).toEqual(bare);
  });

  it("refuses anything that is not a well-formed flow", () => {
    const base = { state: "s", verifier: "v", locale: "fa" };

    expect(decodeFlow("garbage")).toBeNull();
    expect(decodeFlow(undefined)).toBeNull();
    expect(decodeFlow(raw({ ...base, locale: "de" }))).toBeNull();
    expect(decodeFlow(raw({ ...base, next: "//evil.example" }))).toBeNull();
    expect(decodeFlow(raw({ ...base, next: "https://evil.example" }))).toBeNull();
    expect(decodeFlow(raw({ ...base, invite: "x".repeat(LIMITS.inviteCodeMax + 1) }))).toBeNull();
    expect(decodeFlow(raw({ locale: "fa" }))).toBeNull();
  });
});

describe("authorizeUrl", () => {
  it("carries everything the authorization request needs", () => {
    const url = new URL(authorizeUrl(authEnv(), { state: "st", challenge: "ch" }));

    expect(`${url.origin}${url.pathname}`).toBe("https://oauth.telegram.org/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "123456",
      redirect_uri: CALLBACK,
      response_type: "code",
      scope: "openid profile",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });
});

describe("POST /auth/telegram", () => {
  it.each([
    ["no Origin", {}],
    ["another Origin", { origin: "https://evil.example" }],
  ])("answers 403 with %s", async (_label, headers) => {
    const response = await start(startRequest({ locale: "en" }, headers));

    expect(response.status).toBe(403);
    expect(cookieNamed(response, "wh_oidc")).toBeUndefined();
  });

  it("sends the browser to Telegram and remembers the flow in a cookie", async () => {
    const { response, flow, value } = await begin({
      locale: "en",
      next: "/en/projects",
      invite: "kP3xQ9vL2mTn8RzA",
    });
    const sent = target(response);
    const cookie = cookieNamed(response, "wh_oidc") ?? "";

    expect(response.status).toBe(303);
    expect(sent.origin + sent.pathname).toBe("https://oauth.telegram.org/auth");
    expect(sent.query).toMatchObject({
      client_id: "123456",
      redirect_uri: CALLBACK,
      response_type: "code",
      code_challenge_method: "S256",
      state: flow.state,
      code_challenge: pkceChallenge(flow.verifier),
    });
    expect(flow).toMatchObject({
      locale: "en",
      next: "/en/projects",
      invite: "kP3xQ9vL2mTn8RzA",
    });
    expect(value).not.toContain(flow.verifier);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/auth/telegram");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Secure");
  });

  it("starts a new state and verifier every time", async () => {
    const first = await begin();
    const second = await begin();

    expect(first.flow.state).not.toBe(second.flow.state);
    expect(first.flow.verifier).not.toBe(second.flow.verifier);
  });

  it("uses the default locale and drops a next path that leaves the site", async () => {
    const { flow } = await begin({ locale: "de", next: "//evil.example" });

    expect(flow.locale).toBe("fa");
    expect(flow.next).toBeUndefined();
    expect(flow.invite).toBeUndefined();
  });

  it("sends an over-long invite code back to sign-in without starting a flow", async () => {
    const response = await start(
      startRequest({ locale: "fa", invite: "x".repeat(LIMITS.inviteCodeMax + 1) }),
    );

    expect(response.status).toBe(303);
    expect(target(response)).toEqual({
      origin: SITE,
      pathname: "/sign-in",
      query: { error: "invite_invalid" },
    });
    expect(cookieNamed(response, "wh_oidc")).toBeUndefined();
  });
});

describe("GET /auth/telegram/callback", () => {
  it("rejects a state that differs from the flow's, without calling the platform", async () => {
    const { value } = await begin({ locale: "fa" });
    const response = await callback(callbackRequest({ code: "c", state: "other" }, value));

    expect(response.status).toBe(303);
    expect(target(response)).toEqual({
      origin: SITE,
      pathname: "/sign-in",
      query: { error: "sign_in_failed" },
    });
    expect(fetchStub).not.toHaveBeenCalled();
    expect(cookieNamed(response, "wh_oidc")).toMatch(/^wh_oidc=;.*Path=\/auth\/telegram/);
    expect(cookieNamed(response, "wh_session")).toBeUndefined();
  });

  it.each([
    ["no flow cookie", undefined],
    ["a cookie that is not a flow", "garbage"],
  ])("fails with %s", async (_label, value) => {
    const response = await callback(callbackRequest({ code: "c", state: "s" }, value));

    expect(target(response).query).toEqual({ error: "sign_in_failed" });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("fails without a code", async () => {
    const { value, flow } = await begin();
    const response = await callback(callbackRequest({ state: flow.state }, value));

    expect(target(response).query).toEqual({ error: "sign_in_failed" });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("reports a cancelled Telegram login and ends the flow", async () => {
    const { value } = await begin({ locale: "en", next: "/en/projects" });
    const response = await callback(callbackRequest({ error: "access_denied" }, value));

    expect(target(response)).toEqual({
      origin: SITE,
      pathname: "/en/sign-in",
      query: { error: "telegram_cancelled", next: "/en/projects" },
    });
    expect(fetchStub).not.toHaveBeenCalled();
    expect(cookieNamed(response, "wh_oidc")).toMatch(/^wh_oidc=;/);
  });

  it("signs in: one platform call with the flow's secrets, a session cookie, and /projects", async () => {
    fetchStub.mockImplementation(async () => signInResponse(false));
    const { value, flow } = await begin({ locale: "fa", invite: "kP3xQ9vL2mTn8RzA" });
    const response = await callback(callbackRequest({ code: "the-code", state: flow.state }, value));

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const sent = fetchStub.mock.calls[0]?.[0] as Request;
    expect(sent.method).toBe("POST");
    expect(sent.url).toBe(`${PLATFORM}/v1/auth/telegram`);
    expect(sent.headers.get("authorization")).toBeNull();
    expect(sent.headers.get("x-storefront-key")).toBe(KEY);
    expect(await sent.json()).toEqual({
      code: "the-code",
      codeVerifier: flow.verifier,
      redirectUri: CALLBACK,
      inviteCode: "kP3xQ9vL2mTn8RzA",
    });

    const session = cookieNamed(response, "wh_session") ?? "";
    expect(session).toContain(`wh_session=${TOKEN}`);
    expect(session).toContain("HttpOnly");
    expect(session).toContain("Max-Age=2592000");
    expect(session).toContain("Path=/");
    expect(response.status).toBe(303);
    expect(target(response)).toEqual({ origin: SITE, pathname: "/projects", query: {} });
    expect(cookieNamed(response, "wh_oidc")).toMatch(/^wh_oidc=;/);
  });

  it("sends no invite code when the flow had none", async () => {
    fetchStub.mockImplementation(async () => signInResponse(false));
    const { value, flow } = await begin();
    await callback(callbackRequest({ code: "c", state: flow.state }, value));

    const sent = fetchStub.mock.calls[0]?.[0] as Request;
    expect(Object.keys(await sent.json())).not.toContain("inviteCode");
  });

  it("goes to the flow's next path, or to the English projects page for an English flow", async () => {
    fetchStub.mockImplementation(async () => signInResponse(false));

    const withNext = await begin({ locale: "fa", next: "/projects/daftar" });
    const toNext = await callback(
      callbackRequest({ code: "c", state: withNext.flow.state }, withNext.value),
    );
    const english = await begin({ locale: "en" });
    const toEnglish = await callback(
      callbackRequest({ code: "c", state: english.flow.state }, english.value),
    );

    expect(target(toNext).pathname).toBe("/projects/daftar");
    expect(target(toEnglish).pathname).toBe("/en/projects");
  });

  it("sends a new member to complete the profile", async () => {
    fetchStub.mockImplementation(async () => signInResponse(true));
    const fa = await begin({ locale: "fa", next: "/projects/daftar" });
    const en = await begin({ locale: "en" });
    const toFa = await callback(callbackRequest({ code: "c", state: fa.flow.state }, fa.value));
    const toEn = await callback(callbackRequest({ code: "c", state: en.flow.state }, en.value));

    expect(target(toFa)).toEqual({ origin: SITE, pathname: "/me/edit", query: { welcome: "1" } });
    expect(target(toEn)).toEqual({ origin: SITE, pathname: "/en/me/edit", query: { welcome: "1" } });
    expect(cookieNamed(toFa, "wh_session")).toContain(`wh_session=${TOKEN}`);
  });

  describe("when the platform refuses or fails", () => {
    async function signInWith(platform: () => Promise<Response>) {
      fetchStub.mockImplementation(platform);
      const { value, flow } = await begin({ locale: "fa", next: "/projects/daftar" });
      const response = await callback(callbackRequest({ code: "c", state: flow.state }, value));

      expect(cookieNamed(response, "wh_session")).toBeUndefined();
      expect(cookieNamed(response, "wh_oidc")).toMatch(/^wh_oidc=;/);

      return target(response);
    }

    it.each([
      [403, "invite_required"],
      [403, "invite_invalid"],
      [403, "invite_expired"],
      [401, "telegram_signature_invalid"],
      [429, "rate_limited"],
    ])("shows %i %s as it is and keeps next", async (status, code) => {
      const sent = await signInWith(async () => errorResponse(status, code));

      expect(sent).toEqual({
        origin: SITE,
        pathname: "/sign-in",
        query: { error: code, next: "/projects/daftar" },
      });
    });

    it("shows an unreachable platform as unreachable", async () => {
      const sent = await signInWith(async () => {
        throw new Error("connect ECONNREFUSED");
      });

      expect(sent.query).toEqual({ error: "unreachable", next: "/projects/daftar" });
    });

    it.each([
      ["a 500 with an error body", async () => errorResponse(500, "internal_error")],
      ["a 500 without one", async () => new Response("oops", { status: 500 })],
      ["a code the page does not know", async () => errorResponse(401, "storefront_key_invalid")],
    ])("shows %s as a failed sign-in", async (_label, platform) => {
      const sent = await signInWith(platform);

      expect(sent.query).toEqual({ error: "sign_in_failed", next: "/projects/daftar" });
    });
  });
});
