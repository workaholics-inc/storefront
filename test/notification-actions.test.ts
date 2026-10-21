import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  markAllRead,
  openNotification,
} from "@/app/[locale]/me/notifications/actions";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const h = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; init: unknown }[],
  answer: undefined as unknown,
  deleted: [] as string[],
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getPlatformClient: async () => {
    const call = (method: string) => async (path: string, init: unknown) => {
      h.calls.push({ method, path, init });
      if (h.answer instanceof Error) throw h.answer;
      return h.answer;
    };
    return {
      GET: call("GET"),
      PATCH: call("PATCH"),
      POST: call("POST"),
      PUT: call("PUT"),
      DELETE: call("DELETE"),
    };
  },
}));

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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const NOTIFICATION = "0199f1a2-7c3e-7a10-8000-000000000501";
const POST_ID = "0199f1a2-7c3e-7a10-8000-000000000101";
const FEEDBACK = "0199f1a2-7c3e-7a10-8000-000000000201";
const THREAD = `/projects/daftar/posts/${POST_ID}`;

function ok(): Answer {
  return { data: undefined, response: new Response(null, { status: 204 }) };
}

function fail(status: number, code: string): Answer {
  return {
    error: { error: { code, message: "ignored" } },
    response: new Response(null, { status }),
  };
}

// Both actions end in a redirect; a run that returns instead is a failure.
async function redirectedTo(run: Promise<void>): Promise<string> {
  try {
    await run;
  } catch (error) {
    if (error instanceof Error && "path" in error) return String(error.path);
    throw error;
  }
  throw new Error("did not redirect");
}

function bodyOf(index = 0): unknown {
  return (h.calls[index]?.init as { body: unknown }).body;
}

const form = new FormData();

beforeEach(() => {
  h.calls = [];
  h.answer = ok();
  h.deleted = [];
  vi.mocked(revalidatePath).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("openNotification", () => {
  it.each([
    ["fa", `${THREAD}#feedback-${FEEDBACK}`],
    ["en", `/en${THREAD}#feedback-${FEEDBACK}`],
  ])("marks it read and opens the item in the thread in %s", async (locale, path) => {
    const target = await redirectedTo(
      openNotification(locale, NOTIFICATION, "daftar", POST_ID, FEEDBACK, "", form),
    );

    expect(target).toBe(path);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      path: "/v1/me/notifications/read",
    });
    expect(bodyOf()).toEqual({ ids: [NOTIFICATION] });
  });

  it.each([
    ["fa", THREAD],
    ["en", `/en${THREAD}`],
  ])("opens the thread without a hash when there is no item in %s", async (locale, path) => {
    const target = await redirectedTo(
      openNotification(locale, NOTIFICATION, "daftar", POST_ID, "", "", form),
    );

    expect(target).toBe(path);
    expect(bodyOf()).toEqual({ ids: [NOTIFICATION] });
  });

  it.each([
    ["a server error", fail(500, "internal_error")],
    ["a refusal", fail(403, "forbidden")],
    ["a notification that is gone", fail(404, "not_found")],
    ["a key the platform rejects", fail(401, "storefront_key_invalid")],
    ["an unreachable platform", new Error("connect ECONNREFUSED")],
  ])("still opens the item after %s", async (_name, answer) => {
    h.answer = answer;

    const target = await redirectedTo(
      openNotification("fa", NOTIFICATION, "daftar", POST_ID, FEEDBACK, "", form),
    );

    expect(target).toBe(`${THREAD}#feedback-${FEEDBACK}`);
    expect(h.deleted).toEqual([]);
  });

  it.each([
    ["fa", "/sign-in?error=session_required&next=%2Fme%2Fnotifications"],
    ["en", "/en/sign-in?error=session_required&next=%2Fen%2Fme%2Fnotifications"],
  ])(
    "deletes the session cookie and redirects to sign-in on session_required in %s",
    async (locale, path) => {
      h.answer = fail(401, "session_required");

      const target = await redirectedTo(
        openNotification(locale, NOTIFICATION, "daftar", POST_ID, FEEDBACK, "", form),
      );

      expect(target).toBe(path);
      expect(h.deleted).toEqual(["wh_session"]);
    },
  );

  it.each([
    ["an id that is not a UUID", ["nope", "daftar", POST_ID, FEEDBACK]],
    ["a slug that is not a slug", [NOTIFICATION, "../x", POST_ID, FEEDBACK]],
    ["a slug that is a host", [NOTIFICATION, "//evil.example", POST_ID, FEEDBACK]],
    ["a post id that is not a UUID", [NOTIFICATION, "daftar", "nope", FEEDBACK]],
    ["a post id with a path in it", [NOTIFICATION, "daftar", `${POST_ID}/../x`, FEEDBACK]],
    ["an item id that is not a UUID", [NOTIFICATION, "daftar", POST_ID, "nope"]],
    ["an item id with a hash in it", [NOTIFICATION, "daftar", POST_ID, `${FEEDBACK}#x`]],
  ])(
    "goes to the notifications page and sends nothing for %s",
    async (_name, [id, slug, postId, feedbackId]) => {
      expect(
        await redirectedTo(
          openNotification("fa", id!, slug!, postId!, feedbackId!, "", form),
        ),
      ).toBe("/me/notifications");
      expect(
        await redirectedTo(
          openNotification("en", id!, slug!, postId!, feedbackId!, "", form),
        ),
      ).toBe("/en/me/notifications");
      expect(h.calls).toHaveLength(0);
    },
  );

  it("treats a bound locale that is not a locale as the default", async () => {
    const target = await redirectedTo(
      openNotification("//evil.example", NOTIFICATION, "daftar", POST_ID, "", "", form),
    );

    expect(target).toBe(THREAD);
  });
});

describe("openNotification with a case", () => {
  const CASE = "0199f1a2-7c3e-7a10-8000-000000000601";
  const CASE_PAGE = `/projects/daftar/cases/${CASE}`;

  it.each([
    ["fa", CASE_PAGE],
    ["en", `/en${CASE_PAGE}`],
  ])("marks it read and opens the case, not the thread, in %s", async (locale, path) => {
    const target = await redirectedTo(
      openNotification(locale, NOTIFICATION, "daftar", POST_ID, FEEDBACK, CASE, form),
    );

    expect(target).toBe(path);
    expect(target).not.toContain("#");
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      path: "/v1/me/notifications/read",
    });
    expect(bodyOf()).toEqual({ ids: [NOTIFICATION] });
  });

  it.each([
    ["fa", CASE_PAGE],
    ["en", `/en${CASE_PAGE}`],
  ])("opens the same case page when there is no item in %s", async (locale, path) => {
    const target = await redirectedTo(
      openNotification(locale, NOTIFICATION, "daftar", POST_ID, "", CASE, form),
    );

    expect(target).toBe(path);
  });

  it.each([
    ["a server error", fail(500, "internal_error")],
    ["a key the platform rejects", fail(401, "storefront_key_invalid")],
    ["an unreachable platform", new Error("connect ECONNREFUSED")],
  ])("still opens the case after %s", async (_name, answer) => {
    h.answer = answer;

    const target = await redirectedTo(
      openNotification("fa", NOTIFICATION, "daftar", POST_ID, FEEDBACK, CASE, form),
    );

    expect(target).toBe(CASE_PAGE);
    expect(h.deleted).toEqual([]);
  });

  it("deletes the session cookie and redirects to sign-in on session_required", async () => {
    h.answer = fail(401, "session_required");

    const target = await redirectedTo(
      openNotification("fa", NOTIFICATION, "daftar", POST_ID, FEEDBACK, CASE, form),
    );

    expect(target).toBe("/sign-in?error=session_required&next=%2Fme%2Fnotifications");
    expect(h.deleted).toEqual(["wh_session"]);
  });

  it.each([
    ["a case id that is not a UUID", "nope"],
    ["a case id with a path in it", `${CASE}/../x`],
    ["a case id with a hash in it", `${CASE}#x`],
  ])("goes to the notifications page and sends nothing for %s", async (_name, caseId) => {
    expect(
      await redirectedTo(
        openNotification("fa", NOTIFICATION, "daftar", POST_ID, FEEDBACK, caseId, form),
      ),
    ).toBe("/me/notifications");
    expect(
      await redirectedTo(
        openNotification("en", NOTIFICATION, "daftar", POST_ID, FEEDBACK, caseId, form),
      ),
    ).toBe("/en/me/notifications");
    expect(h.calls).toHaveLength(0);
  });
});

describe("markAllRead", () => {
  it.each([
    ["fa", "/me/notifications"],
    ["en", "/en/me/notifications"],
  ])("marks everything read, refreshes the page and goes back to it in %s", async (locale, path) => {
    const target = await redirectedTo(markAllRead(locale, form));

    expect(target).toBe(path);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      path: "/v1/me/notifications/read",
    });
    expect(bodyOf()).toEqual({ all: true });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/me/notifications", "page");
  });

  it.each([
    ["a server error", fail(500, "internal_error")],
    ["an unreachable platform", new Error("connect ECONNREFUSED")],
  ])("still goes back to the page after %s", async (_name, answer) => {
    h.answer = answer;

    const target = await redirectedTo(markAllRead("fa", form));

    expect(target).toBe("/me/notifications");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["fa", "/sign-in?error=session_required&next=%2Fme%2Fnotifications"],
    ["en", "/en/sign-in?error=session_required&next=%2Fen%2Fme%2Fnotifications"],
  ])(
    "deletes the session cookie and redirects to sign-in on session_required in %s",
    async (locale, path) => {
      h.answer = fail(401, "session_required");

      const target = await redirectedTo(markAllRead(locale, form));

      expect(target).toBe(path);
      expect(h.deleted).toEqual(["wh_session"]);
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("treats a bound locale that is not a locale as the default", async () => {
    const target = await redirectedTo(markAllRead("//evil.example", form));

    expect(target).toBe("/me/notifications");
  });
});
