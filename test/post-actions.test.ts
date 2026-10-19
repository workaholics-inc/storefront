import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPost,
  editPost,
} from "@/app/[locale]/projects/[slug]/posts/actions";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";

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

const POST_ID = "0199f1a2-7c3e-7a10-8000-000000000101";
const ACTED_ON = "0199f1a2-7c3e-7a10-8000-000000000201";

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

function without(fields: Record<string, string>, name: string) {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => key !== name));
}

function bodyOf(index = 0): unknown {
  return (h.calls[index]?.init as { body: unknown }).body;
}

function paramsOf(index = 0): unknown {
  return (h.calls[index]?.init as { params: unknown }).params;
}

beforeEach(() => {
  h.calls = [];
  h.answer = undefined;
  h.deleted = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const wip = {
  kind: "wip",
  body: "A first pass at the importer.",
  question0: "Is the retry loop too eager?",
  question1: "",
  question2: "Does the naming read well?",
  selfCritique: "",
};

const update = {
  kind: "update",
  body: "",
  whatChanged: "Retries now back off.",
  oneNumber: "3 of 5",
  rejectedAndWhy: "",
};

describe("createPost", () => {
  it.each([
    ["fa", `/projects/daftar/posts/${POST_ID}`],
    ["en", `/en/projects/daftar/posts/${POST_ID}`],
  ])(
    "sends the work in progress with its non-empty questions and redirects to the post in %s",
    async (locale, path) => {
      h.answer = ok({ id: POST_ID }, 201);

      const result = await outcome(
        createPost(locale, "daftar", initialFormState, formOf(wip)),
      );

      expect(result).toEqual({ redirect: path });
      expect(h.calls).toHaveLength(1);
      expect(h.calls[0]).toMatchObject({
        method: "POST",
        path: "/v1/projects/{slug}/posts",
      });
      expect(paramsOf()).toEqual({ path: { slug: "daftar" } });
      expect(bodyOf()).toEqual({
        kind: "wip",
        body: wip.body,
        feedbackWanted: [wip.question0, wip.question2],
      });
    },
  );

  it("sends the self-critique when there is one", async () => {
    h.answer = ok({ id: POST_ID }, 201);

    await outcome(
      createPost(
        "fa",
        "daftar",
        initialFormState,
        formOf({ ...wip, selfCritique: "The retry loop is a guess." }),
      ),
    );

    expect(bodyOf()).toMatchObject({ selfCritique: "The retry loop is a guess." });
  });

  it("sends an update with the posts it acted on", async () => {
    h.answer = ok({ id: POST_ID }, 201);
    const form = formOf(update);
    form.append("actedOn", ACTED_ON);

    const result = await outcome(createPost("fa", "daftar", initialFormState, form));

    expect(result).toEqual({ redirect: `/projects/daftar/posts/${POST_ID}` });
    expect(bodyOf()).toEqual({
      kind: "update",
      body: "",
      whatChanged: update.whatChanged,
      actedOn: [ACTED_ON],
      oneNumber: update.oneNumber,
    });
  });

  it.each([["missing", {}], ["unknown", { kind: "essay" }]])(
    "asks to choose a kind when it is %s, without calling the platform",
    async (_name, kind) => {
      const state = stateOf(
        await outcome(
          createPost(
            "fa",
            "daftar",
            initialFormState,
            formOf({ ...without(wip, "kind"), ...kind }),
          ),
        ),
      );

      expect(state.errors.kind).toEqual({ key: "chooseOne" });
      expect(h.calls).toHaveLength(0);
    },
  );

  it("returns field errors for invalid input without calling the platform", async () => {
    const state = stateOf(
      await outcome(
        createPost(
          "fa",
          "daftar",
          initialFormState,
          formOf({ ...wip, question0: "", question2: "" }),
        ),
      ),
    );

    expect(state.errors.question0).toEqual({ key: "required" });
    expect(state.values).toMatchObject({ body: wip.body });
    expect(h.calls).toHaveLength(0);
  });

  it.each(["acted_on_invalid", "validation_failed"])(
    "shows a 400 %s as that form error and keeps the submitted values",
    async (code) => {
      h.answer = fail(400, code);

      const state = stateOf(
        await outcome(createPost("fa", "daftar", initialFormState, formOf(wip))),
      );

      expect(state.formError).toBe(code);
      expect(state.values).toMatchObject({ body: wip.body });
    },
  );

  it("keeps the platform's own refusal of a non-owner", async () => {
    h.answer = fail(403, "not_project_owner");

    const state = stateOf(
      await outcome(createPost("fa", "daftar", initialFormState, formOf(wip))),
    );

    expect(state.formError).toBe("not_project_owner");
  });

  it("reads an unknown project as not found", async () => {
    h.answer = fail(404, "project_not_found");

    const state = stateOf(
      await outcome(createPost("fa", "daftar", initialFormState, formOf(wip))),
    );

    expect(state.formError).toBe("not_found");
  });

  it("reports an unreachable platform", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    const state = stateOf(
      await outcome(createPost("fa", "daftar", initialFormState, formOf(wip))),
    );

    expect(state.formError).toBe("unreachable");
  });

  it.each([
    ["fa", "/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fposts%2Fnew"],
    [
      "en",
      "/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fposts%2Fnew",
    ],
  ])(
    "deletes the session cookie and redirects to sign-in on session_required in %s",
    async (locale, path) => {
      h.answer = fail(401, "session_required");

      const result = await outcome(
        createPost(locale, "daftar", initialFormState, formOf(wip)),
      );

      expect(h.deleted).toEqual(["wh_session"]);
      expect(result).toEqual({ redirect: path });
    },
  );

  it.each(["../x", "//evil.example", "Daftar", ""])(
    "rejects the bound slug %j without calling the platform",
    async (slug) => {
      const state = stateOf(
        await outcome(createPost("fa", slug, initialFormState, formOf(wip))),
      );

      expect(state.formError).toBe("not_found");
      expect(h.calls).toHaveLength(0);
    },
  );

  it("treats a bound locale that is not a locale as the default", async () => {
    h.answer = ok({ id: POST_ID }, 201);

    const result = await outcome(
      createPost("//evil.example", "daftar", initialFormState, formOf(wip)),
    );

    expect(result).toEqual({ redirect: `/projects/daftar/posts/${POST_ID}` });
  });

  it("builds the redirect from an encoded id", async () => {
    h.answer = ok({ id: "a/../b?c#d" }, 201);

    const result = await outcome(
      createPost("fa", "daftar", initialFormState, formOf(wip)),
    );

    expect(result).toEqual({
      redirect: "/projects/daftar/posts/a%2F..%2Fb%3Fc%23d",
    });
  });
});

describe("editPost", () => {
  it.each([
    ["fa", `/projects/daftar/posts/${POST_ID}`],
    ["en", `/en/projects/daftar/posts/${POST_ID}`],
  ])("sends the post to its address and redirects to it in %s", async (locale, path) => {
    h.answer = ok({ id: POST_ID });
    const form = formOf(update);
    form.append("actedOn", ACTED_ON);

    const result = await outcome(
      editPost(locale, "daftar", POST_ID, initialFormState, form),
    );

    expect(result).toEqual({ redirect: path });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "PUT", path: "/v1/posts/{id}" });
    expect(paramsOf()).toEqual({ path: { id: POST_ID } });
    expect(bodyOf()).toEqual({
      kind: "update",
      body: "",
      whatChanged: update.whatChanged,
      actedOn: [ACTED_ON],
      oneNumber: update.oneNumber,
    });
  });

  it("sends an edited work in progress", async () => {
    h.answer = ok({ id: POST_ID });

    await outcome(editPost("fa", "daftar", POST_ID, initialFormState, formOf(wip)));

    expect(h.calls[0]).toMatchObject({ method: "PUT", path: "/v1/posts/{id}" });
    expect(bodyOf()).toEqual({
      kind: "wip",
      body: wip.body,
      feedbackWanted: [wip.question0, wip.question2],
    });
  });

  it.each(["edit_window_closed", "not_author"])(
    "shows a refused edit (%s) as that form error and keeps the submitted values",
    async (code) => {
      h.answer = fail(code === "not_author" ? 403 : 409, code);

      const state = stateOf(
        await outcome(
          editPost("fa", "daftar", POST_ID, initialFormState, formOf(wip)),
        ),
      );

      expect(state.formError).toBe(code);
      expect(state.values).toMatchObject({ body: wip.body });
    },
  );

  it("shows a 400 acted_on_invalid as that form error", async () => {
    h.answer = fail(400, "acted_on_invalid");

    const state = stateOf(
      await outcome(
        editPost("fa", "daftar", POST_ID, initialFormState, formOf(update)),
      ),
    );

    expect(state.formError).toBe("acted_on_invalid");
  });

  it("asks to choose a kind when it is missing, without calling the platform", async () => {
    const state = stateOf(
      await outcome(
        editPost(
          "fa",
          "daftar",
          POST_ID,
          initialFormState,
          formOf(without(wip, "kind")),
        ),
      ),
    );

    expect(state.errors.kind).toEqual({ key: "chooseOne" });
    expect(h.calls).toHaveLength(0);
  });

  it.each([
    ["an id that is not a UUID", "daftar", "nope"],
    ["an id with a path in it", "daftar", `${POST_ID}/../x`],
    ["a slug that is not a slug", "../x", POST_ID],
  ])("rejects %s without calling the platform", async (_name, slug, id) => {
    const state = stateOf(
      await outcome(editPost("fa", slug, id, initialFormState, formOf(wip))),
    );

    expect(state.formError).toBe("not_found");
    expect(h.calls).toHaveLength(0);
  });

  it.each([
    [
      "fa",
      `/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}%2Fedit`,
    ],
    [
      "en",
      `/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}%2Fedit`,
    ],
  ])(
    "returns to the edit page after signing in again in %s",
    async (locale, path) => {
      h.answer = fail(401, "session_required");

      const result = await outcome(
        editPost(locale, "daftar", POST_ID, initialFormState, formOf(wip)),
      );

      expect(h.deleted).toEqual(["wh_session"]);
      expect(result).toEqual({ redirect: path });
    },
  );
});
