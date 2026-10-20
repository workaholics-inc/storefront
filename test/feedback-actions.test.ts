import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  editFeedback,
  editReply,
  editResponse,
  giveFeedback,
  reply,
  respond,
} from "@/app/[locale]/projects/[slug]/posts/[id]/actions";
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const POST_ID = "0199f1a2-7c3e-7a10-8000-000000000101";
const FEEDBACK = "0199f1a2-7c3e-7a10-8000-000000000201";
const OTHER = "0199f1a2-7c3e-7a10-8000-000000000301";
const NEW_ITEM = "0199f1a2-7c3e-7a10-8000-000000000999";
const THREAD = `/projects/daftar/posts/${POST_ID}`;

// The report-back date is checked against today, so the clock is fixed.
const NOW = new Date("2026-10-19T09:00:00Z");
const A_WEEK_ON = "2026-10-26";

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

function bodyOf(index = 0): unknown {
  return (h.calls[index]?.init as { body: unknown }).body;
}

function paramsOf(index = 0): unknown {
  return (h.calls[index]?.init as { params: unknown }).params;
}

// The thread, back at the item the member touched, with what they did.
function savedAt(saved: string, item: string, prefix = ""): string {
  return `${prefix}${THREAD}?saved=${saved}&item=${item}#feedback-${item}`;
}

beforeEach(() => {
  h.calls = [];
  h.answer = undefined;
  h.deleted = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const feedback = { body: "The retry loop looks too eager.", questionIndex: "1" };
const answer = { status: "accepted", reason: "Fair, I will back it off." };
const testing = {
  status: "testing",
  reason: "Trying a longer wait first.",
  recheckPick: A_WEEK_ON,
};
const replyForm = { body: "Thanks, that helped." };

// Every action with the bound ids it takes and a form it accepts, so the
// cases that hold for all six are written once.
type Case = {
  name: string;
  run: (
    locale: string,
    slug: string,
    ids: { post: string; feedback: string; child: string },
  ) => Promise<FormState>;
  fields: Record<string, string>;
  ids: ("post" | "feedback" | "child")[];
  status: number;
  saved: string;
  item: string;
};

const ALL: Case[] = [
  {
    name: "giveFeedback",
    run: (locale, slug, ids) =>
      giveFeedback(locale, slug, ids.post, initialFormState, formOf(feedback)),
    fields: feedback,
    ids: ["post"],
    status: 201,
    saved: "feedback",
    item: NEW_ITEM,
  },
  {
    name: "editFeedback",
    run: (locale, slug, ids) =>
      editFeedback(locale, slug, ids.post, ids.feedback, initialFormState, formOf(feedback)),
    fields: feedback,
    ids: ["post", "feedback"],
    status: 200,
    saved: "edit",
    item: FEEDBACK,
  },
  {
    name: "respond",
    run: (locale, slug, ids) =>
      respond(locale, slug, ids.post, ids.feedback, initialFormState, formOf(answer)),
    fields: answer,
    ids: ["post", "feedback"],
    status: 201,
    saved: "answer",
    item: FEEDBACK,
  },
  {
    name: "editResponse",
    run: (locale, slug, ids) =>
      editResponse(
        locale,
        slug,
        ids.post,
        ids.feedback,
        ids.child,
        initialFormState,
        formOf(answer),
      ),
    fields: answer,
    ids: ["post", "feedback", "child"],
    status: 200,
    saved: "edit",
    item: FEEDBACK,
  },
  {
    name: "reply",
    run: (locale, slug, ids) =>
      reply(locale, slug, ids.post, ids.feedback, initialFormState, formOf(replyForm)),
    fields: replyForm,
    ids: ["post", "feedback"],
    status: 201,
    saved: "reply",
    item: FEEDBACK,
  },
  {
    name: "editReply",
    run: (locale, slug, ids) =>
      editReply(
        locale,
        slug,
        ids.post,
        ids.feedback,
        ids.child,
        initialFormState,
        formOf(replyForm),
      ),
    fields: replyForm,
    ids: ["post", "feedback", "child"],
    status: 200,
    saved: "edit",
    item: FEEDBACK,
  },
];

const GOOD = { post: POST_ID, feedback: FEEDBACK, child: OTHER };

describe("giveFeedback", () => {
  it.each([
    ["fa", ""],
    ["en", "/en"],
  ])("posts it to the post and returns to the new item in %s", async (locale, prefix) => {
    h.answer = ok({ id: NEW_ITEM }, 201);

    const result = await outcome(
      giveFeedback(locale, "daftar", POST_ID, initialFormState, formOf(feedback)),
    );

    expect(result).toEqual({ redirect: savedAt("feedback", NEW_ITEM, prefix) });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "POST", path: "/v1/posts/{id}/feedback" });
    expect(paramsOf()).toEqual({ path: { id: POST_ID } });
    expect(bodyOf()).toEqual({ body: feedback.body, questionIndex: 1 });
  });

  it("sends general feedback without a question", async () => {
    h.answer = ok({ id: NEW_ITEM }, 201);

    await outcome(
      giveFeedback(
        "fa",
        "daftar",
        POST_ID,
        initialFormState,
        formOf({ body: feedback.body, questionIndex: "" }),
      ),
    );

    expect(bodyOf()).toEqual({ body: feedback.body });
  });

  it("returns field errors without calling the platform", async () => {
    const state = stateOf(
      await outcome(
        giveFeedback("fa", "daftar", POST_ID, initialFormState, formOf({ body: "  " })),
      ),
    );

    expect(state.errors.body).toEqual({ key: "required" });
    expect(h.calls).toHaveLength(0);
  });

  it("shows a 403 own_project as that form error and keeps the submitted values", async () => {
    h.answer = fail(403, "own_project");

    const state = stateOf(
      await outcome(
        giveFeedback("fa", "daftar", POST_ID, initialFormState, formOf(feedback)),
      ),
    );

    expect(state.formError).toBe("own_project");
    expect(state.values).toMatchObject({ body: feedback.body, questionIndex: "1" });
  });

  it("encodes an id the platform sends back", async () => {
    h.answer = ok({ id: "a/b?c#d" }, 201);

    const result = await outcome(
      giveFeedback("fa", "daftar", POST_ID, initialFormState, formOf(feedback)),
    );

    expect(result).toEqual({ redirect: savedAt("feedback", "a%2Fb%3Fc%23d") });
  });
});

describe("editFeedback", () => {
  it.each([
    ["fa", ""],
    ["en", "/en"],
  ])("puts the item at its address and returns to it in %s", async (locale, prefix) => {
    h.answer = ok({ id: FEEDBACK });

    const result = await outcome(
      editFeedback(
        locale,
        "daftar",
        POST_ID,
        FEEDBACK,
        initialFormState,
        formOf({ body: "Reworded.", questionIndex: "" }),
      ),
    );

    expect(result).toEqual({ redirect: savedAt("edit", FEEDBACK, prefix) });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "PUT", path: "/v1/feedback/{id}" });
    expect(paramsOf()).toEqual({ path: { id: FEEDBACK } });
    expect(bodyOf()).toEqual({ body: "Reworded.", questionIndex: null });
  });
});

describe("respond", () => {
  it.each([
    ["fa", ""],
    ["en", "/en"],
  ])("sends a report-back date with a testing answer and returns to the item in %s", async (locale, prefix) => {
    h.answer = ok({ id: FEEDBACK }, 201);

    const result = await outcome(
      respond(locale, "daftar", POST_ID, FEEDBACK, initialFormState, formOf(testing)),
    );

    expect(result).toEqual({ redirect: savedAt("answer", FEEDBACK, prefix) });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      path: "/v1/feedback/{id}/responses",
    });
    expect(paramsOf()).toEqual({ path: { id: FEEDBACK } });
    expect(bodyOf()).toEqual({
      status: "testing",
      reason: testing.reason,
      recheckOn: A_WEEK_ON,
    });
  });

  it.each([
    ["en", { recheckYear: "2026", recheckMonth: "11", recheckDay: "15" }],
    ["fa", { recheckYear: "1405", recheckMonth: "8", recheckDay: "24" }],
  ])("reads another date in the %s calendar", async (locale, parts) => {
    h.answer = ok({ id: FEEDBACK }, 201);

    await outcome(
      respond(
        locale,
        "daftar",
        POST_ID,
        FEEDBACK,
        initialFormState,
        formOf({ ...testing, recheckPick: "other", ...parts }),
      ),
    );

    expect(bodyOf()).toEqual({
      status: "testing",
      reason: testing.reason,
      recheckOn: "2026-11-15",
    });
  });

  it("sends an answer that is not testing without a date", async () => {
    h.answer = ok({ id: FEEDBACK }, 201);

    await outcome(
      respond(
        "fa",
        "daftar",
        POST_ID,
        FEEDBACK,
        initialFormState,
        formOf({ ...answer, recheckPick: A_WEEK_ON }),
      ),
    );

    expect(bodyOf()).toEqual({ status: "accepted", reason: answer.reason });
  });

  it("asks for a reason and does not call the platform", async () => {
    const state = stateOf(
      await outcome(
        respond(
          "fa",
          "daftar",
          POST_ID,
          FEEDBACK,
          initialFormState,
          formOf({ ...testing, reason: "" }),
        ),
      ),
    );

    expect(state.errors.reason).toEqual({ key: "reasonRequired" });
    expect(h.calls).toHaveLength(0);
  });

  it("asks to choose an answer and does not call the platform", async () => {
    const state = stateOf(
      await outcome(
        respond(
          "fa",
          "daftar",
          POST_ID,
          FEEDBACK,
          initialFormState,
          formOf({ reason: answer.reason }),
        ),
      ),
    );

    expect(state.errors.status).toEqual({ key: "chooseOne" });
    expect(h.calls).toHaveLength(0);
  });

  it.each([
    ["no date chosen", { recheckPick: "" }, "chooseOne"],
    ["today", { recheckPick: "2026-10-19" }, "dateInvalid"],
    ["a date past the range", { recheckPick: "2999-01-01" }, "dateInvalid"],
    ["something that is not a date", { recheckPick: "next week" }, "dateInvalid"],
    [
      "another date with nothing filled in",
      { recheckPick: "other", recheckYear: "", recheckMonth: "", recheckDay: "" },
      "dateInvalid",
    ],
  ])("refuses a testing answer with %s without calling the platform", async (_name, fields, key) => {
    const state = stateOf(
      await outcome(
        respond(
          "en",
          "daftar",
          POST_ID,
          FEEDBACK,
          initialFormState,
          formOf({ ...testing, ...fields }),
        ),
      ),
    );

    expect(state.errors.recheckOn).toEqual({ key });
    expect(h.calls).toHaveLength(0);
  });

  it("shows a 400 recheck_required on the date", async () => {
    h.answer = fail(400, "recheck_required");

    const state = stateOf(
      await outcome(
        respond("fa", "daftar", POST_ID, FEEDBACK, initialFormState, formOf(answer)),
      ),
    );

    expect(state.errors.recheckOn).toEqual({ key: "chooseOne" });
    expect(state.formError).toBeUndefined();
    expect(state.values).toMatchObject({ reason: answer.reason });
  });

  it("shows a 403 not_author as that form error", async () => {
    h.answer = fail(403, "not_author");

    const state = stateOf(
      await outcome(
        respond("fa", "daftar", POST_ID, FEEDBACK, initialFormState, formOf(answer)),
      ),
    );

    expect(state.formError).toBe("not_author");
  });
});

describe("editResponse", () => {
  it.each([
    ["fa", ""],
    ["en", "/en"],
  ])("puts the answer at its address and returns to its item in %s", async (locale, prefix) => {
    h.answer = ok({ id: FEEDBACK });

    const result = await outcome(
      editResponse(
        locale,
        "daftar",
        POST_ID,
        FEEDBACK,
        OTHER,
        initialFormState,
        formOf(testing),
      ),
    );

    expect(result).toEqual({ redirect: savedAt("edit", FEEDBACK, prefix) });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "PUT", path: "/v1/responses/{id}" });
    expect(paramsOf()).toEqual({ path: { id: OTHER } });
    expect(bodyOf()).toEqual({
      status: "testing",
      reason: testing.reason,
      recheckOn: A_WEEK_ON,
    });
  });

  it.each([
    ["en", { recheckYear: "2026", recheckMonth: "11", recheckDay: "15" }],
    ["fa", { recheckYear: "1405", recheckMonth: "8", recheckDay: "24" }],
  ])("reads another date in the %s calendar", async (locale, parts) => {
    h.answer = ok({ id: FEEDBACK });

    await outcome(
      editResponse(
        locale,
        "daftar",
        POST_ID,
        FEEDBACK,
        OTHER,
        initialFormState,
        formOf({ ...testing, recheckPick: "other", ...parts }),
      ),
    );

    expect(bodyOf()).toEqual({
      status: "testing",
      reason: testing.reason,
      recheckOn: "2026-11-15",
    });
  });

  it("shows a 409 not_current_response as that form error and keeps the values", async () => {
    h.answer = fail(409, "not_current_response");

    const state = stateOf(
      await outcome(
        editResponse(
          "fa",
          "daftar",
          POST_ID,
          FEEDBACK,
          OTHER,
          initialFormState,
          formOf(answer),
        ),
      ),
    );

    expect(state.formError).toBe("not_current_response");
    expect(state.values).toMatchObject({ reason: answer.reason });
  });

  it("checks the answer like a new one", async () => {
    const state = stateOf(
      await outcome(
        editResponse(
          "fa",
          "daftar",
          POST_ID,
          FEEDBACK,
          OTHER,
          initialFormState,
          formOf({ ...answer, reason: "" }),
        ),
      ),
    );

    expect(state.errors.reason).toEqual({ key: "reasonRequired" });
    expect(h.calls).toHaveLength(0);
  });
});

describe("reply", () => {
  it.each([
    ["fa", ""],
    ["en", "/en"],
  ])("posts it to the item and returns to it in %s", async (locale, prefix) => {
    h.answer = ok({ id: FEEDBACK }, 201);

    const result = await outcome(
      reply(locale, "daftar", POST_ID, FEEDBACK, initialFormState, formOf(replyForm)),
    );

    expect(result).toEqual({ redirect: savedAt("reply", FEEDBACK, prefix) });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      path: "/v1/feedback/{id}/replies",
    });
    expect(paramsOf()).toEqual({ path: { id: FEEDBACK } });
    expect(bodyOf()).toEqual({ body: replyForm.body });
  });

  it("shows a 403 reply_not_allowed as that form error and keeps the values", async () => {
    h.answer = fail(403, "reply_not_allowed");

    const state = stateOf(
      await outcome(
        reply("fa", "daftar", POST_ID, FEEDBACK, initialFormState, formOf(replyForm)),
      ),
    );

    expect(state.formError).toBe("reply_not_allowed");
    expect(state.values).toMatchObject({ body: replyForm.body });
  });

  it("returns a field error without calling the platform", async () => {
    const state = stateOf(
      await outcome(
        reply("fa", "daftar", POST_ID, FEEDBACK, initialFormState, formOf({ body: "" })),
      ),
    );

    expect(state.errors.body).toEqual({ key: "required" });
    expect(h.calls).toHaveLength(0);
  });
});

describe("editReply", () => {
  it.each([
    ["fa", ""],
    ["en", "/en"],
  ])("puts the reply at its address and returns to its item in %s", async (locale, prefix) => {
    h.answer = ok({ id: FEEDBACK });

    const result = await outcome(
      editReply(
        locale,
        "daftar",
        POST_ID,
        FEEDBACK,
        OTHER,
        initialFormState,
        formOf({ body: "Reworded." }),
      ),
    );

    expect(result).toEqual({ redirect: savedAt("edit", FEEDBACK, prefix) });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "PUT", path: "/v1/replies/{id}" });
    expect(paramsOf()).toEqual({ path: { id: OTHER } });
    expect(bodyOf()).toEqual({ body: "Reworded." });
  });
});

describe("every action", () => {
  it.each(ALL)("$name returns to the item it touched", async (item) => {
    h.answer = ok({ id: item.item }, item.status);

    const result = await outcome(item.run("fa", "daftar", GOOD));

    expect(result).toEqual({ redirect: savedAt(item.saved, item.item) });
  });

  it.each([
    ["edit_window_closed", 409],
    ["not_author", 403],
  ])("shows a refused change (%s) as that form error", async (code, status) => {
    for (const item of ALL) {
      h.calls = [];
      h.answer = fail(status, code);

      const state = stateOf(await outcome(item.run("fa", "daftar", GOOD)));

      expect(state.formError, item.name).toBe(code);
      expect(state.values, item.name).toMatchObject(item.fields);
      expect(h.calls, item.name).toHaveLength(1);
    }
  });

  it("reads a missing item as not found", async () => {
    for (const item of ALL) {
      h.answer = fail(404, "feedback_not_found");

      const state = stateOf(await outcome(item.run("fa", "daftar", GOOD)));

      expect(state.formError, item.name).toBe("not_found");
    }
  });

  it("reports an unreachable platform", async () => {
    for (const item of ALL) {
      h.answer = new Error("connect ECONNREFUSED");

      const state = stateOf(await outcome(item.run("fa", "daftar", GOOD)));

      expect(state.formError, item.name).toBe("unreachable");
    }
  });

  it.each(ALL.flatMap((item) => item.ids.map((id) => [item.name, id] as const)))(
    "%s rejects a bound %s id that is not a UUID without calling the platform",
    async (name, id) => {
      const item = ALL.find((candidate) => candidate.name === name)!;

      for (const bad of ["nope", `${GOOD[id]}/../x`, `${GOOD[id]}?x=1`, ""]) {
        const state = stateOf(await outcome(item.run("fa", "daftar", { ...GOOD, [id]: bad })));

        expect(state.formError, `${name} ${id} ${bad}`).toBe("not_found");
      }
      expect(h.calls).toHaveLength(0);
    },
  );

  it.each(ALL.map((item) => [item.name] as const))(
    "%s rejects a bound slug that is not a slug without calling the platform",
    async (name) => {
      const item = ALL.find((candidate) => candidate.name === name)!;

      for (const slug of ["../x", "//evil.example", "Daftar", ""]) {
        const state = stateOf(await outcome(item.run("fa", slug, GOOD)));

        expect(state.formError, `${name} ${slug}`).toBe("not_found");
      }
      expect(h.calls).toHaveLength(0);
    },
  );

  it.each([
    ["fa", `/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}`],
    [
      "en",
      `/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fposts%2F${POST_ID}`,
    ],
  ])(
    "deletes the session cookie and returns to the thread after signing in again in %s",
    async (locale, path) => {
      for (const item of ALL) {
        h.deleted = [];
        h.answer = fail(401, "session_required");

        const result = await outcome(item.run(locale, "daftar", GOOD));

        expect(result, item.name).toEqual({ redirect: path });
        expect(h.deleted, item.name).toEqual(["wh_session"]);
      }
    },
  );

  it("treats any other 401 as an internal error and keeps the cookie", async () => {
    for (const item of ALL) {
      h.answer = fail(401, "storefront_key_invalid");

      const state = stateOf(await outcome(item.run("fa", "daftar", GOOD)));

      expect(state.formError, item.name).toBe("internal_error");
    }
    expect(h.deleted).toEqual([]);
  });

  it("treats a bound locale that is not a locale as the default", async () => {
    for (const item of ALL) {
      h.answer = ok({ id: item.item }, item.status);

      const result = await outcome(item.run("//evil.example", "daftar", GOOD));

      expect(result, item.name).toEqual({ redirect: savedAt(item.saved, item.item) });
    }
  });
});
