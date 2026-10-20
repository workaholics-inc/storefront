import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  failureState,
  formErrorFor,
  resolveLocale,
  valuesOf,
} from "@/lib/actions";
import type { PlatformResult } from "@/lib/api/errors";

type Failure = Extract<PlatformResult<unknown>, { ok: false }>;

const h = vi.hoisted(() => ({ deleted: [] as string[] }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (path: string) => {
    throw Object.assign(new Error("redirect"), { path });
  },
}));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({
    delete: (name: string) => {
      h.deleted.push(name);
    },
    get: () => undefined,
  }),
}));

beforeEach(() => {
  h.deleted = [];
});

function fail(status: number, code: string): Failure {
  return { ok: false, status, code };
}

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

async function redirectOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error) {
    if (error instanceof Error && "path" in error) return String(error.path);
    throw error;
  }
  throw new Error("did not redirect");
}

describe("failureState on a 403", () => {
  const form = formOf({ body: "Hello" });

  it.each(["own_project", "not_author", "reply_not_allowed"])(
    "keeps the platform's code %s as the form error",
    async (code) => {
      const state = await failureState(fail(403, code), form, "fa", "/x");

      expect(state).toEqual({
        errors: {},
        formError: code,
        values: { body: "Hello" },
      });
    },
  );

  it("keeps not_project_owner", async () => {
    const state = await failureState(
      fail(403, "not_project_owner"),
      form,
      "fa",
      "/x",
    );

    expect(state.formError).toBe("not_project_owner");
  });

  it("reads a code with no message as not_project_owner", async () => {
    const state = await failureState(fail(403, "something_new"), form, "fa", "/x");

    expect(state.formError).toBe("not_project_owner");
  });
});

describe("failureState on other statuses", () => {
  const form = formOf({ body: "Hello" });

  it("maps a 409 edit_window_closed to that form error", async () => {
    const state = await failureState(
      fail(409, "edit_window_closed"),
      form,
      "fa",
      "/x",
    );

    expect(state.formError).toBe("edit_window_closed");
    expect(state.values).toEqual({ body: "Hello" });
  });

  it("maps a 404 to not_found", async () => {
    const state = await failureState(fail(404, "not_found"), form, "fa", "/x");

    expect(state.formError).toBe("not_found");
  });

  it("deletes the session cookie and redirects to sign-in with next on a 401 session_required", async () => {
    const path = await redirectOf(
      failureState(fail(401, "session_required"), form, "en", "/projects/a/posts/1"),
    );

    expect(h.deleted).toEqual(["wh_session"]);
    expect(path).toBe(
      "/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fa%2Fposts%2F1",
    );
  });

  it("treats any other 401 as an internal error and keeps the cookie", async () => {
    const state = await failureState(
      fail(401, "storefront_key_invalid"),
      form,
      "fa",
      "/x",
    );

    expect(state.formError).toBe("internal_error");
    expect(h.deleted).toEqual([]);
  });
});

describe("formErrorFor", () => {
  it("passes unreachable and validation_failed through, and known codes", () => {
    expect(formErrorFor("unreachable")).toBe("unreachable");
    expect(formErrorFor("validation_failed")).toBe("validation_failed");
    expect(formErrorFor("recheck_required")).toBe("recheck_required");
  });

  it("reads a code with no message as internal_error", () => {
    expect(formErrorFor("something_new")).toBe("internal_error");
  });
});

describe("resolveLocale", () => {
  it("keeps a locale and treats anything else as the default", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("fa")).toBe("fa");
    expect(resolveLocale("/evil")).toBe("fa");
  });
});

describe("valuesOf", () => {
  it("skips file entries", () => {
    const form = formOf({ title: "Hi" });
    form.set("attachment", new File(["data"], "a.txt"));

    expect(valuesOf(form)).toEqual({ title: "Hi" });
  });

  it("joins two actedOn values as a,b", () => {
    const form = new FormData();
    form.append("actedOn", "a");
    form.append("actedOn", "b");
    form.append("body", "Text");

    expect(valuesOf(form)).toEqual({ actedOn: "a,b", body: "Text" });
  });
});
