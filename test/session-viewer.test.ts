import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import contract from "../contract/openapi.json";
import { getViewer } from "@/lib/session";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  answer: undefined as unknown,
  gets: 0,
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
      state.gets += 1;
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

const member = contract.components.schemas.Me.example;

const pages = [
  { locale: "fa", next: "/projects/daftar", expired: "/auth/expired?locale=fa&next=%2Fprojects%2Fdaftar" },
  { locale: "en", next: "/en/projects/daftar", expired: "/auth/expired?locale=en&next=%2Fen%2Fprojects%2Fdaftar" },
] as const;

function respond(status: number, body?: unknown): Answer {
  const response = new Response(null, { status });
  if (status >= 200 && status < 300) return { data: body, response };
  return { error: body, response };
}

function errorBody(code: string) {
  return { error: { code, message: "ignored" } };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  state.cookie = undefined;
  state.answer = undefined;
  state.gets = 0;
  vi.restoreAllMocks();
});

describe("getViewer", () => {
  it.each(pages)("is a visitor without a session cookie and asks the platform nothing ($locale)", async ({ locale, next }) => {
    await expect(getViewer(locale, next)).resolves.toEqual({ kind: "visitor" });
    expect(state.gets).toBe(0);
  });

  it.each(pages)("is the member when the platform answers 200 ($locale)", async ({ locale, next }) => {
    state.cookie = "token";
    state.answer = respond(200, member);

    await expect(getViewer(locale, next)).resolves.toEqual({ kind: "member", member });
    expect(state.gets).toBe(1);
  });

  it.each(pages)("sends an expired member through /auth/expired, never to the visitor view ($locale)", async ({ locale, next, expired }) => {
    state.cookie = "token";
    state.answer = respond(401, errorBody("session_required"));

    await expect(getViewer(locale, next)).rejects.toMatchObject({ path: expired });
    expect(state.gets).toBe(1);
  });

  it("throws, and does not redirect, when the storefront key is rejected", async () => {
    state.cookie = "token";
    state.answer = respond(401, errorBody("storefront_key_invalid"));

    const rejection = await getViewer("fa", "/projects/daftar").then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe("platform unavailable: storefront_key_invalid");
    expect(rejection).not.toHaveProperty("path");
  });

  it("throws on a 500 that is not an error body", async () => {
    state.cookie = "token";
    state.answer = respond(500, "not json");

    await expect(getViewer("fa", "/projects/daftar")).rejects.toThrow(
      "platform unavailable: internal_error",
    );
  });

  it("throws when the platform cannot be reached", async () => {
    state.cookie = "token";
    state.answer = new Error("connect ECONNREFUSED");

    await expect(getViewer("fa", "/projects/daftar")).rejects.toThrow(
      "platform unavailable: unreachable",
    );
  });
});
