import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportMe } from "@/app/[locale]/me/export/route";
import { GET as badge } from "@/app/badge/[file]/route";
import { config } from "@/proxy";
import contract from "../contract/openapi.json";
import en from "../messages/en.json";
import fa from "../messages/fa.json";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const h = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  paths: [] as string[],
  answers: {} as Record<string, Answer>,
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getPlatformClient: async () => ({
    GET: async (path: string) => {
      h.paths.push(path);
      const answer = h.answers[path];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) throw new Error("no answer for " + path);
      return answer;
    },
  }),
}));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({
    get: (name: string) =>
      name === "wh_session" && h.cookie ? { name, value: h.cookie } : undefined,
  }),
}));

const SITE = "https://workaholics.example";
const PLATFORM = "http://platform.test";
const KEY = "k".repeat(32);

const ME = contract.components.schemas.Me.example;
const EXPORT = contract.components.schemas.MemberExport.example;
const PROJECT = contract.components.schemas.PublicProject.example;

const fetchStub = vi.fn();

beforeEach(() => {
  h.cookie = undefined;
  h.paths = [];
  h.answers = {};
  vi.stubEnv("SITE_URL", SITE);
  vi.stubEnv("PLATFORM_URL", PLATFORM);
  vi.stubEnv("STOREFRONT_API_KEY", KEY);
  fetchStub.mockReset();
  vi.stubGlobal("fetch", fetchStub);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function answer(status: number, body?: unknown): Answer {
  const response = new Response(null, { status });
  return status < 400
    ? { data: body, response }
    : { error: body, response };
}

function failure(status: number, code: string): Answer {
  return answer(status, { error: { code, message: "x" } });
}

function target(response: Response) {
  const url = new URL(response.headers.get("location") ?? "");
  return {
    origin: url.origin,
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams),
  };
}

function clearsSession(response: Response) {
  return response.headers
    .getSetCookie()
    .some((cookie) => /^wh_session=;/.test(cookie));
}

function exportRequest(locale: string) {
  const path = locale === "fa" ? "/me/export" : `/${locale}/me/export`;

  return exportMe(new NextRequest(new URL(path, SITE)), {
    params: Promise.resolve({ locale }),
  });
}

function badgeRequest(
  file: string,
  init: { query?: string; headers?: Record<string, string> } = {},
) {
  const url = new URL(`/badge/${file}${init.query ?? ""}`, SITE);

  return badge(new NextRequest(url, { headers: init.headers }), {
    params: Promise.resolve({ file }),
  });
}

const FA_EXPORT_FAILED = `${SITE}/members/sara?export=failed#export`;
const EN_EXPORT_FAILED = `${SITE}/en/members/sara?export=failed#export`;

describe("the proxy matcher", () => {
  const matcher = new RegExp("^" + config.matcher[0] + "$");

  it("sends the export through next-intl", () => {
    expect(matcher.test("/me/export")).toBe(true);
    expect(matcher.test("/en/me/export")).toBe(true);
  });

  it("lets the badge pass untouched", () => {
    expect(matcher.test("/badge/daftar.svg")).toBe(false);
  });
});

describe("the export route", () => {
  it.each([
    ["fa", "/sign-in", "/me"],
    ["en", "/en/sign-in", "/en/me"],
  ])("sends a visitor in %s to sign in and back to /me", async (locale, pathname, next) => {
    const response = await exportRequest(locale);

    expect(response.status).toBe(303);
    expect(target(response)).toEqual({ origin: SITE, pathname, query: { next } });
    expect(h.paths).toEqual([]);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it.each(["fa", "en"])("serves the whole record as a file in %s", async (locale) => {
    h.cookie = "token-1";
    h.answers = {
      "/v1/me": answer(200, ME),
      "/v1/me/export": answer(200, EXPORT),
    };

    const response = await exportRequest(locale);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="workaholics-export-sara-2026-11-16.json"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(JSON.stringify(EXPORT, null, 2));
    expect(h.paths).toEqual(["/v1/me", "/v1/me/export"]);
  });

  it.each([
    ["2026-11-16T23:59:59.999Z", "2026-11-16"],
    ["2026-11-17T00:00:00.000Z", "2026-11-17"],
  ])("names the file after the date inside it (%s)", async (exportedAt, date) => {
    h.cookie = "token-1";
    h.answers = {
      "/v1/me": answer(200, ME),
      "/v1/me/export": answer(200, { ...EXPORT, exportedAt }),
    };

    const response = await exportRequest("fa");

    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="workaholics-export-sara-${date}.json"`,
    );
  });

  describe("when the session is over", () => {
    const EXPIRED = [
      ["fa", { locale: "fa", next: "/me" }],
      ["en", { locale: "en", next: "/en/me" }],
    ] as const;

    it.each(EXPIRED)("goes through /auth/expired in %s when /v1/me says so", async (locale, query) => {
      h.cookie = "token-1";
      h.answers = { "/v1/me": failure(401, "session_required") };

      const response = await exportRequest(locale);

      expect(response.status).toBe(303);
      expect(target(response)).toEqual({
        origin: SITE,
        pathname: "/auth/expired",
        query,
      });
      expect(clearsSession(response)).toBe(false);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(h.paths).toEqual(["/v1/me"]);
    });

    it.each(EXPIRED)("does the same in %s when it ends between the two calls", async (locale, query) => {
      h.cookie = "token-1";
      h.answers = {
        "/v1/me": answer(200, ME),
        "/v1/me/export": failure(401, "session_required"),
      };

      const response = await exportRequest(locale);

      expect(response.status).toBe(303);
      expect(target(response)).toEqual({
        origin: SITE,
        pathname: "/auth/expired",
        query,
      });
      expect(clearsSession(response)).toBe(false);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(h.paths).toEqual(["/v1/me", "/v1/me/export"]);
    });
  });

  describe("when the export fails", () => {
    const FAILURES: [string, Answer][] = [
      ["a 500 internal_error", failure(500, "internal_error")],
      ["a 401 storefront_key_invalid", failure(401, "storefront_key_invalid")],
      ["a call that throws", new Error("connect ECONNREFUSED")],
    ];

    it.each(FAILURES)("goes back to the member page with a flag on %s", async (_name, result) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      h.cookie = "token-1";

      for (const [locale, location] of [
        ["fa", FA_EXPORT_FAILED],
        ["en", EN_EXPORT_FAILED],
      ]) {
        h.paths = [];
        h.answers = { "/v1/me": answer(200, ME), "/v1/me/export": result };

        const response = await exportRequest(locale ?? "fa");

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe(location);
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(h.paths).toEqual(["/v1/me", "/v1/me/export"]);
      }
    });
  });

  it("treats session_required as the end of the session only on a 401", async () => {
    h.cookie = "token-1";
    h.answers = {
      "/v1/me": answer(200, ME),
      "/v1/me/export": failure(500, "session_required"),
    };

    const response = await exportRequest("fa");

    expect(response.headers.get("location")).toBe(FA_EXPORT_FAILED);
  });

  it("encodes the handle in the page it goes back to", async () => {
    h.cookie = "token-1";
    h.answers = {
      "/v1/me": answer(200, { ...ME, handle: "a/b?c" }),
      "/v1/me/export": failure(500, "internal_error"),
    };

    const response = await exportRequest("fa");

    expect(response.headers.get("location")).toBe(
      `${SITE}/members/a%2Fb%3Fc?export=failed#export`,
    );
  });

  it("throws when the member cannot be read, and asks for no export", async () => {
    h.cookie = "token-1";
    h.answers = { "/v1/me": failure(500, "internal_error") };

    await expect(exportRequest("fa")).rejects.toThrow(
      "platform unavailable: internal_error",
    );
    expect(h.paths).toEqual(["/v1/me"]);
  });

  it("answers 404 for a locale that does not exist, without a call", async () => {
    h.cookie = "token-1";

    const response = await exportRequest("de");

    expect(response.status).toBe(404);
    expect(h.paths).toEqual([]);
  });
});

describe("the badge route", () => {
  beforeEach(() => {
    fetchStub.mockImplementation(async () => jsonResponse(200, PROJECT));
  });

  it("serves the fa image for a public project", async () => {
    const response = await badgeRequest("daftar.svg");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(body.startsWith("<svg")).toBe(true);
    expect(body.endsWith("</svg>")).toBe(true);
    expect(body).toContain(`<title>${fa.Badge.text}</title>`);
    expect(body).toContain(`aria-label="${fa.Badge.text}"`);
    expect(body).toContain('xml:lang="fa"');
    expect(body).toContain('direction="rtl"');
    expect(body).toContain('role="img"');
    expect(body).toContain('height="28"');
    expect(body).toContain('width="212"');
    expect(/<text [^>]*>([^<]*)<\/text>/.exec(body)?.[1]).toBe(fa.Badge.text);
  });

  it("carries nothing of the project and no number", async () => {
    for (const query of ["", "?lang=en"]) {
      const body = await (await badgeRequest("daftar.svg", { query })).text();

      expect(body).not.toContain("<script");
      expect(body).not.toContain("<style");
      expect(body).not.toContain("href");
      expect(body).not.toContain("daftar");
      expect(body).not.toContain(PROJECT.name);
      expect(body).not.toContain(PROJECT.oneLiner);
      expect(body.replace(/<[^>]*>/g, "")).not.toMatch(/[0-9۰-۹٠-٩]/);
    }
  });

  it("serves the en image for ?lang=en", async () => {
    const body = await (await badgeRequest("daftar.svg", { query: "?lang=en" })).text();

    expect(body).toContain(`<title>${en.Badge.text}</title>`);
    expect(body).toContain('xml:lang="en"');
    expect(body).toContain('direction="ltr"');
    expect(body).toContain('width="240"');
    expect(/<text [^>]*>([^<]*)<\/text>/.exec(body)?.[1]).toBe(en.Badge.text);
  });

  it.each(["?lang=de", ""])("falls back to fa for %j", async (query) => {
    const body = await (await badgeRequest("daftar.svg", { query })).text();

    expect(body).toContain(`<title>${fa.Badge.text}</title>`);
    expect(body).toContain('xml:lang="fa"');
  });

  it("asks the platform once, with the key and no session", async () => {
    await badgeRequest("daftar.svg", {
      headers: {
        cookie: "wh_session=token-1",
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      },
    });

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const sent = fetchStub.mock.calls[0]?.[0] as Request;
    expect(sent.method).toBe("GET");
    expect(sent.url).toBe(`${PLATFORM}/v1/public/projects/daftar`);
    expect(sent.headers.get("x-storefront-key")).toBe(KEY);
    expect(sent.headers.get("authorization")).toBeNull();
    expect(sent.headers.get("cookie")).toBeNull();
    expect(sent.headers.get("x-client-ip")).toBe("203.0.113.7");
  });

  it("lower-cases the file name", async () => {
    const response = await badgeRequest("Daftar.SVG");

    expect(response.status).toBe(200);
    const sent = fetchStub.mock.calls[0]?.[0] as Request;
    expect(sent.url.endsWith("/v1/public/projects/daftar")).toBe(true);
  });

  it.each(["daftar", "daftar.png", ".svg", "daftar.svg.svg", "da_ftar.svg", "-daftar.svg"])(
    "answers 404 for %j without asking the platform",
    async (file) => {
      const response = await badgeRequest(file);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
      expect(fetchStub).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a missing project", jsonResponse(404, { error: { code: "not_found", message: "x" } })],
    ["a refused slug", jsonResponse(400, { error: { code: "validation_failed", message: "x" } })],
  ])("answers an empty, uncached 404 for %s", async (_name, platform) => {
    fetchStub.mockImplementation(async () => platform.clone());

    const response = await badgeRequest("daftar.svg");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  describe("when the platform cannot answer", () => {
    it.each([
      ["a 500", () => jsonResponse(500, { error: { code: "internal_error", message: "x" } })],
      [
        "a 401 storefront_key_invalid",
        () => jsonResponse(401, { error: { code: "storefront_key_invalid", message: "x" } }),
      ],
    ])("answers an empty, uncached 503 on %s", async (_name, platform) => {
      fetchStub.mockImplementation(async () => platform());

      const response = await badgeRequest("daftar.svg");

      expect(response.status).toBe(503);
      expect(await response.text()).toBe("");
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("answers an empty, uncached 503 when the call throws", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      fetchStub.mockRejectedValue(new Error("connect ECONNREFUSED"));

      const response = await badgeRequest("daftar.svg");

      expect(response.status).toBe(503);
      expect(await response.text()).toBe("");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(log).toHaveBeenCalledWith("connect ECONNREFUSED");
    });

    it("answers an empty, uncached 503 without a call when the key is not set", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.stubEnv("STOREFRONT_API_KEY", undefined);

      const response = await badgeRequest("daftar.svg");

      expect(response.status).toBe(503);
      expect(await response.text()).toBe("");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(fetchStub).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
    });
  });
});
