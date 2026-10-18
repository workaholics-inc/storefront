import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { platformCall } from "@/lib/api/errors";
import {
  FLOW_COOKIE,
  SESSION_COOKIE,
  cookieSecure,
  flowCookieOptions,
  safeNextPath,
  sessionCookieOptions,
} from "@/lib/cookies";
import {
  getCurrentMember,
  requireMember,
  signInPath,
} from "@/lib/session";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  answer: undefined as unknown,
}));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({
    get: (name: string) =>
      name === "wh_session" && state.cookie ? { name, value: state.cookie } : undefined,
  }),
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getPlatformClient: async () => ({
    GET: async () => {
      if (state.answer instanceof Error) throw state.answer;
      return state.answer;
    },
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (path: string) => {
    throw Object.assign(new Error("redirect"), { path });
  },
}));

const member = {
  handle: "sara",
  displayName: "Sara",
  bio: "",
  links: [],
  invitedBy: { handle: "ali", displayName: "Ali" },
  joinedAt: "2026-10-01T08:00:00.000Z",
};

function respond(status: number, body?: unknown): Answer {
  const response = new Response(null, { status });
  if (status >= 200 && status < 300) return { data: body, response };
  return { error: body, response };
}

function errorBody(code: string) {
  return { error: { code, message: "ignored" } };
}

afterEach(() => {
  vi.unstubAllEnvs();
  state.cookie = undefined;
  state.answer = undefined;
});

describe("cookies", () => {
  it("is not secure only for an http SITE_URL", () => {
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    expect(cookieSecure()).toBe(false);

    vi.stubEnv("SITE_URL", "https://example.org");
    expect(cookieSecure()).toBe(true);

    vi.stubEnv("SITE_URL", "");
    expect(cookieSecure()).toBe(true);
  });

  it("is secure when SITE_URL is unset", () => {
    vi.stubEnv("SITE_URL", undefined);

    expect(cookieSecure()).toBe(true);
  });

  it("gives the session cookie its flags", () => {
    vi.stubEnv("SITE_URL", "https://example.org");

    expect(SESSION_COOKIE).toBe("wh_session");
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 2592000,
    });
  });

  it("scopes the flow cookie to the Telegram routes for ten minutes", () => {
    vi.stubEnv("SITE_URL", "https://example.org");

    expect(FLOW_COOKIE).toBe("wh_oidc");
    expect(flowCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/auth/telegram",
      maxAge: 600,
    });
  });
});

describe("safeNextPath", () => {
  it.each(["/projects?cursor=a", "/en/members/sara"])("keeps %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["a protocol-relative address", "//evil.example"],
    ["a backslash address", "/\\evil.example"],
    ["an absolute URL", "https://evil.example"],
    ["a relative path", "projects"],
    ["a 513-character path", "/" + "a".repeat(512)],
    ["a path with a newline", "/projects\nSet-Cookie: x=1"],
    ["a number", 5],
    ["undefined", undefined],
    ["an array", ["/projects"]],
  ])("rejects %s", (_label, value) => {
    expect(safeNextPath(value)).toBeUndefined();
  });

  it("keeps a 512-character path", () => {
    const path = "/" + "a".repeat(511);

    expect(safeNextPath(path)).toBe(path);
  });
});

describe("platformCall", () => {
  it("returns the data of a 200", async () => {
    const result = await platformCall(async () => respond(200, { id: 1 }) as never);

    expect(result).toEqual({ ok: true, status: 200, data: { id: 1 } });
  });

  it("is ok for a 204 without a body", async () => {
    const result = await platformCall(async () => respond(204) as never);

    expect(result).toMatchObject({ ok: true, status: 204 });
  });

  it("returns the code of an error body", async () => {
    const result = await platformCall(
      async () => respond(409, errorBody("slug_taken")) as never,
    );

    expect(result).toEqual({ ok: false, status: 409, code: "slug_taken" });
  });

  it("falls back to internal_error for a body that is not an error", async () => {
    const result = await platformCall(
      async () => respond(500, "Internal Server Error") as never,
    );

    expect(result).toEqual({ ok: false, status: 500, code: "internal_error" });
  });

  it("reports an unreachable platform and logs only the message, once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await platformCall(async () => {
      throw new Error("connect ECONNREFUSED");
    });

    expect(result).toEqual({ ok: false, status: 0, code: "unreachable" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("connect ECONNREFUSED");
    log.mockRestore();
  });
});

describe("getCurrentMember and requireMember", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is signed out without a session cookie, and requireMember sends the visitor to sign-in", async () => {
    expect(await getCurrentMember()).toEqual({ state: "signed-out" });
    await expect(requireMember("fa", "/projects")).rejects.toMatchObject({
      path: "/sign-in?next=%2Fprojects",
    });
  });

  it("uses the locale prefix in the sign-in path", async () => {
    await expect(requireMember("en", "/en/projects")).rejects.toMatchObject({
      path: "/en/sign-in?next=%2Fen%2Fprojects",
    });
  });

  it("treats a 401 session_required as expired and redirects through /auth/expired", async () => {
    state.cookie = "token";
    state.answer = respond(401, errorBody("session_required"));

    expect(await getCurrentMember()).toEqual({ state: "expired" });
    await expect(requireMember("fa", "/projects")).rejects.toMatchObject({
      path: "/auth/expired?locale=fa&next=%2Fprojects",
    });
  });

  it("does not treat a 401 storefront_key_invalid as expired", async () => {
    state.cookie = "token";
    state.answer = respond(401, errorBody("storefront_key_invalid"));

    expect(await getCurrentMember()).toEqual({
      state: "unavailable",
      code: "storefront_key_invalid",
    });
    await expect(requireMember("fa", "/projects")).rejects.toThrow(
      "platform unavailable: storefront_key_invalid",
    );
  });

  it("returns the member for a 200", async () => {
    state.cookie = "token";
    state.answer = respond(200, member);

    expect(await getCurrentMember()).toEqual({ state: "member", member });
    expect(await requireMember("fa", "/projects")).toEqual(member);
  });

  it("is unavailable when the platform cannot be reached, and requireMember throws", async () => {
    state.cookie = "token";
    state.answer = new Error("connect ECONNREFUSED");

    expect(await getCurrentMember()).toEqual({
      state: "unavailable",
      code: "unreachable",
    });
    await expect(requireMember("fa", "/projects")).rejects.toThrow(
      "platform unavailable: unreachable",
    );
  });
});

describe("signInPath", () => {
  it("puts error first, then next, encoded", () => {
    expect(
      signInPath("en", { next: "/en/projects", error: "session_required" }),
    ).toBe("/en/sign-in?error=session_required&next=%2Fen%2Fprojects");
  });

  it("leaves out absent parameters", () => {
    expect(signInPath("fa")).toBe("/sign-in");
    expect(signInPath("fa", { error: "rate_limited" })).toBe(
      "/sign-in?error=rate_limited",
    );
  });
});
