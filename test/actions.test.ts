import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfile } from "@/app/[locale]/me/edit/actions";
import {
  addOwner,
  createProject,
  removeOwner,
  updateProject,
} from "@/app/[locale]/projects/actions";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;

const h = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; init: unknown }[],
  answer: undefined as unknown,
  deleted: [] as string[],
  current: { state: "signed-out" } as unknown,
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

vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  getCurrentMember: async () => h.current,
}));

function ok(data: unknown, status = 200): Answer {
  return { data, response: new Response(null, { status }) };
}

function fail(status: number, code: string): Answer {
  return {
    error: { error: { code, message: "ignored" } },
    response: new Response(null, { status }),
  };
}

function formOf(fields: Record<string, string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

type Outcome = { state: FormState } | { redirect: string };

async function outcome(run: Promise<FormState>): Promise<Outcome> {
  try {
    return { state: await run };
  } catch (error) {
    if (error instanceof Error && "path" in error) {
      return { redirect: String(error.path) };
    }
    throw error;
  }
}

function stateOf(result: Outcome): FormState {
  if (!("state" in result)) throw new Error(`redirected to ${result.redirect}`);
  return result.state;
}

beforeEach(() => {
  h.calls = [];
  h.answer = undefined;
  h.deleted = [];
  h.current = { state: "signed-out" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const profile = {
  handle: " Sara_Dev ",
  displayName: "Sara",
  bio: "Builds things",
  "links.0.label": "Site",
  "links.0.url": "https://sara.example",
};

describe("updateProfile", () => {
  it.each([
    ["fa", "/members/sara_dev"],
    ["en", "/en/members/sara_dev"],
  ])("sends all four fields and redirects to the profile in %s", async (locale, path) => {
    h.answer = ok({ handle: "sara_dev" });

    const result = await outcome(updateProfile(locale, initialFormState, formOf(profile)));

    expect(result).toEqual({ redirect: path });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "PATCH", path: "/v1/me" });
    expect((h.calls[0]?.init as { body: unknown }).body).toEqual({
      handle: "sara_dev",
      displayName: "Sara",
      bio: "Builds things",
      links: [{ label: "Site", url: "https://sara.example" }],
    });
  });

  it("returns field errors for invalid input without calling the platform", async () => {
    const result = await outcome(
      updateProfile("fa", initialFormState, formOf({ ...profile, handle: "no" })),
    );

    expect(stateOf(result).errors.handle).toEqual({ key: "handlePattern" });
    expect(h.calls).toHaveLength(0);
  });

  it("maps a taken handle to a field error and returns the submitted values", async () => {
    h.answer = fail(409, "handle_taken");

    const state = stateOf(
      await outcome(updateProfile("fa", initialFormState, formOf(profile))),
    );

    expect(state.errors.handle?.key).toBe("handleTaken");
    expect(state.values).toMatchObject({ handle: " Sara_Dev ", displayName: "Sara" });
  });
});

describe("session handling and bound arguments", () => {
  const edit = formOf({ name: "Daftar" });

  it("deletes the session cookie and redirects to sign-in on session_required", async () => {
    h.answer = fail(401, "session_required");

    const result = await outcome(updateProject("en", "daftar", initialFormState, edit));

    expect(h.deleted).toEqual(["wh_session"]);
    expect(result).toEqual({
      redirect:
        "/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fedit",
    });
  });

  it("redirects to the Persian sign-in without a prefix", async () => {
    h.answer = fail(401, "session_required");

    const result = await outcome(updateProject("fa", "daftar", initialFormState, edit));

    expect(result).toEqual({
      redirect: "/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fedit",
    });
  });

  it("treats any other 401 as an internal error and keeps the cookie", async () => {
    h.answer = fail(401, "storefront_key_invalid");

    const state = stateOf(
      await outcome(updateProject("fa", "daftar", initialFormState, edit)),
    );

    expect(state.formError).toBe("internal_error");
    expect(h.deleted).toEqual([]);
  });

  it("reports an unreachable platform", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    const state = stateOf(
      await outcome(updateProject("fa", "daftar", initialFormState, edit)),
    );

    expect(state.formError).toBe("unreachable");
  });

  it("treats a bound locale that is not a locale as the default", async () => {
    h.answer = ok({ slug: "daftar" }, 201);

    const result = await outcome(
      createProject("/evil.example", initialFormState, formOf({ name: "Daftar", slug: "daftar" })),
    );

    expect(result).toEqual({ redirect: "/projects/daftar" });
  });

  it("rejects a bound slug that is not a slug without calling the platform", async () => {
    const state = stateOf(
      await outcome(updateProject("fa", "../x", initialFormState, edit)),
    );

    expect(state.formError).toBe("not_found");
    expect(h.calls).toHaveLength(0);
  });
});

describe("createProject", () => {
  const form = { name: "Daftar", slug: "Daftar-2" };

  it.each([
    ["fa", "/projects/daftar-2"],
    ["en", "/en/projects/daftar-2"],
  ])("posts the project and redirects to its page in %s", async (locale, path) => {
    h.answer = ok({ slug: "daftar-2" }, 201);

    const result = await outcome(createProject(locale, initialFormState, formOf(form)));

    expect(result).toEqual({ redirect: path });
    expect(h.calls[0]).toMatchObject({ method: "POST", path: "/v1/projects" });
    expect((h.calls[0]?.init as { body: unknown }).body).toMatchObject({
      slug: "daftar-2",
      name: "Daftar",
      stage: "idea",
      visibility: "members",
    });
  });

  it("maps a taken slug to a field error", async () => {
    h.answer = fail(409, "slug_taken");

    const state = stateOf(
      await outcome(createProject("fa", initialFormState, formOf(form))),
    );

    expect(state.errors.slug?.key).toBe("slugTaken");
    expect(state.values.slug).toBe("Daftar-2");
  });

  it("returns field errors without calling the platform", async () => {
    const state = stateOf(
      await outcome(createProject("fa", initialFormState, formOf({ name: "" }))),
    );

    expect(state.errors.name?.key).toBe("required");
    expect(state.errors.slug?.key).toBe("required");
    expect(h.calls).toHaveLength(0);
  });
});

describe("updateProject", () => {
  const form = formOf({ name: "Daftar", stage: "building" });

  it("patches the project and redirects to its page", async () => {
    h.answer = ok({ slug: "daftar" });

    const result = await outcome(updateProject("en", "daftar", initialFormState, form));

    expect(result).toEqual({ redirect: "/en/projects/daftar" });
    expect(h.calls[0]).toMatchObject({
      method: "PATCH",
      path: "/v1/projects/{slug}",
      init: { params: { path: { slug: "daftar" } } },
    });
  });

  it("maps 403 to not_project_owner and 404 to not_found", async () => {
    h.answer = fail(403, "not_project_owner");
    expect(
      stateOf(await outcome(updateProject("fa", "daftar", initialFormState, form))).formError,
    ).toBe("not_project_owner");

    h.answer = fail(404, "not_found");
    expect(
      stateOf(await outcome(updateProject("fa", "daftar", initialFormState, form))).formError,
    ).toBe("not_found");
  });
});

describe("addOwner", () => {
  it("posts the lower-cased handle and redirects to the edit page", async () => {
    h.answer = ok({ slug: "daftar" });

    const result = await outcome(
      addOwner("en", "daftar", initialFormState, formOf({ handle: "Reza_Dev" })),
    );

    expect(result).toEqual({ redirect: "/en/projects/daftar/edit" });
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      path: "/v1/projects/{slug}/owners",
      init: { params: { path: { slug: "daftar" } }, body: { handle: "reza_dev" } },
    });
  });

  it("maps a missing member to a field error", async () => {
    h.answer = fail(404, "member_not_found");

    const state = stateOf(
      await outcome(addOwner("fa", "daftar", initialFormState, formOf({ handle: "reza_dev" }))),
    );

    expect(state.errors.handle?.key).toBe("memberNotFound");
  });

  it("maps 403 to not_project_owner", async () => {
    h.answer = fail(403, "not_project_owner");

    const state = stateOf(
      await outcome(addOwner("fa", "daftar", initialFormState, formOf({ handle: "reza_dev" }))),
    );

    expect(state.formError).toBe("not_project_owner");
  });

  it("returns a field error for an invalid handle without calling the platform", async () => {
    const state = stateOf(
      await outcome(addOwner("fa", "daftar", initialFormState, formOf({ handle: "x" }))),
    );

    expect(state.errors.handle?.key).toBe("handlePattern");
    expect(h.calls).toHaveLength(0);
  });
});

describe("removeOwner", () => {
  const remove = (handle: string, locale = "fa") =>
    outcome(removeOwner(locale, "daftar", initialFormState, formOf({ handle })));

  beforeEach(() => {
    h.current = { state: "member", member: { handle: "sara" } };
  });

  it("maps the last owner to last_owner", async () => {
    h.answer = fail(409, "last_owner");

    expect(stateOf(await remove("sara")).formError).toBe("last_owner");
  });

  it("sends the request to the owner's address", async () => {
    h.answer = ok({ slug: "daftar" });

    await remove("reza_dev");

    expect(h.calls[0]).toMatchObject({
      method: "DELETE",
      path: "/v1/projects/{slug}/owners/{handle}",
      init: { params: { path: { slug: "daftar", handle: "reza_dev" } } },
    });
  });

  it("redirects to the edit page after removing another owner", async () => {
    h.answer = ok({ slug: "daftar" });

    expect(await remove("reza_dev")).toEqual({ redirect: "/projects/daftar/edit" });
    expect(await remove("reza_dev", "en")).toEqual({
      redirect: "/en/projects/daftar/edit",
    });
  });

  it("redirects to the project page after removing oneself", async () => {
    h.answer = ok({ slug: "daftar" });

    expect(await remove("sara")).toEqual({ redirect: "/projects/daftar" });
    expect(await remove("sara", "en")).toEqual({ redirect: "/en/projects/daftar" });
  });

  it("treats an invalid handle as not found without calling the platform", async () => {
    expect(stateOf(await remove("../x")).formError).toBe("not_found");
    expect(h.calls).toHaveLength(0);
  });

  it("maps 403 to not_project_owner", async () => {
    h.answer = fail(403, "not_project_owner");

    expect(stateOf(await remove("reza_dev")).formError).toBe("not_project_owner");
  });
});
