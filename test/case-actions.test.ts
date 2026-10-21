import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as caseActions from "@/app/[locale]/projects/[slug]/cases/actions";
import {
  createCase,
  setCredit,
  updateCase,
} from "@/app/[locale]/projects/[slug]/cases/actions";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";
import { LIMITS, validateCase } from "@/lib/validation";

type Answer = { data?: unknown; error?: unknown; response: Response } | Error;
type Pairs = [string, string][];

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

const CASE_ID = "0199f1a2-7c3e-7a10-8000-000000000601";
const CASE_PATH = `/projects/daftar/cases/${CASE_ID}`;
const F = (n: number) => `0199f1a2-7c3e-7a10-8000-0000000002${String(n).padStart(2, "0")}`;
const P = (n: number) => `0199f1a2-7c3e-7a10-8000-0000000001${String(n).padStart(2, "0")}`;
const range = (make: (n: number) => string, to: number) =>
  Array.from({ length: to }, (_, index) => make(index + 1));

function ok(data: unknown, status = 200): Answer {
  return { data, response: new Response(null, { status }) };
}

function fail(status: number, code: string): Answer {
  return {
    error: { error: { code, message: "ignored" } },
    response: new Response(null, { status }),
  };
}

function formWith(pairs: Pairs) {
  const form = new FormData();
  for (const [name, value] of pairs) form.append(name, value);
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

// What a failed state holds: every string field as submitted, a repeated name
// joined by ",".
function valuesOf(pairs: Pairs): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of pairs) {
    values[name] = name in values ? `${values[name]},${value}` : value;
  }

  return values;
}

// The smallest form CaseForm submits; a change replaces every pair of that name.
const base: Pairs = [
  ["title", "Shorter sign-up"],
  ["feedbackStory", "People said sign-up took too long."],
  ["change", "I cut the form to two fields."],
  ["result", "Sign-up got faster."],
  ["oneNumber", ""],
  ["visibility", "inherit"],
  ["feedbackIds", F(1)],
];

function pairs(change: Record<string, string | string[] | null> = {}): Pairs {
  const names = new Set(Object.keys(change));
  const kept = base.filter(([name]) => !names.has(name));
  const added: Pairs = [];
  for (const [name, value] of Object.entries(change)) {
    if (value === null) continue;
    for (const one of Array.isArray(value) ? value : [value]) added.push([name, one]);
  }

  return [...kept, ...added];
}

const baseBody = {
  title: "Shorter sign-up",
  feedbackStory: "People said sign-up took too long.",
  change: "I cut the form to two fields.",
  result: "Sign-up got faster.",
  feedbackIds: [F(1)],
  postIds: [],
  visibility: "inherit",
};

const createBody = (extra: object = {}) => ({ ...baseBody, ...extra });
const updateBody = (extra: object = {}) => ({ ...baseBody, oneNumber: "", ...extra });

const CHOOSE_ONE = { key: "chooseOne" };

afterEach(() => {
  expect(revalidatePath).not.toHaveBeenCalled();
});

beforeEach(() => {
  h.calls = [];
  h.answer = undefined;
  h.deleted = [];
  vi.mocked(revalidatePath).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the case limits", () => {
  it("are the platform's numbers", () => {
    const {
      caseTitleMax,
      caseFeedbackStoryMax,
      caseChangeMax,
      caseResultMax,
      caseOneNumberMax,
      caseFeedbackMin,
      caseFeedbackMax,
      casePostsMax,
    } = LIMITS;

    expect({
      caseTitleMax,
      caseFeedbackStoryMax,
      caseChangeMax,
      caseResultMax,
      caseOneNumberMax,
      caseFeedbackMin,
      caseFeedbackMax,
      casePostsMax,
    }).toStrictEqual({
      caseTitleMax: 120,
      caseFeedbackStoryMax: 3000,
      caseChangeMax: 3000,
      caseResultMax: 3000,
      caseOneNumberMax: 200,
      caseFeedbackMin: 1,
      caseFeedbackMax: 10,
      casePostsMax: 10,
    });
  });
});

describe('validateCase(form, "create")', () => {
  const create = (change: Record<string, string | string[] | null> = {}) =>
    validateCase(formWith(pairs(change)), "create");
  const refused = (change: Record<string, string | string[] | null>, errors: object) => ({
    ok: false,
    state: { errors, values: valuesOf(pairs(change)) },
  });

  it("accepts the smallest form and leaves oneNumber out", () => {
    const result = create();

    expect(result).toStrictEqual({ ok: true, body: createBody() });
    expect("oneNumber" in (result as { body: object }).body).toBe(false);
  });

  it("trims the text", () => {
    expect(create({ title: "  Shorter sign-up  " })).toStrictEqual({
      ok: true,
      body: createBody(),
    });
  });

  it.each(["title", "feedbackStory", "change", "result"])("requires %s, empty or blank", (field) => {
    for (const value of ["", "   "]) {
      expect(create({ [field]: value })).toStrictEqual(
        refused({ [field]: value }, { [field]: { key: "required" } }),
      );
    }
  });

  it.each([
    ["title", "caseTitleMax"],
    ["feedbackStory", "caseFeedbackStoryMax"],
    ["change", "caseChangeMax"],
    ["result", "caseResultMax"],
    ["oneNumber", "caseOneNumberMax"],
  ] as const)("limits %s to %s units after the trim", (field, key) => {
    const max = LIMITS[key];
    const exact = "x".repeat(max);

    expect(create({ [field]: exact })).toStrictEqual({
      ok: true,
      body: createBody({ [field]: exact }),
    });
    expect(create({ [field]: `${exact}x` })).toStrictEqual(
      refused({ [field]: `${exact}x` }, { [field]: { key: "tooLong", max } }),
    );
    expect(create({ [field]: ` ${exact} ` })).toStrictEqual({
      ok: true,
      body: createBody({ [field]: exact }),
    });
  });

  it("counts UTF-16 units, not code points", () => {
    const half = "😀".repeat(LIMITS.caseTitleMax / 2);

    expect(create({ title: half })).toStrictEqual({
      ok: true,
      body: createBody({ title: half }),
    });
    expect(create({ title: `${half}😀` })).toStrictEqual(
      refused({ title: `${half}😀` }, { title: { key: "tooLong", max: LIMITS.caseTitleMax } }),
    );
  });

  it.each([
    ["an empty one number", ""],
    ["a blank one number", "   "],
  ])("leaves oneNumber out for %s", (_name, value) => {
    const result = create({ oneNumber: value });

    expect(result).toStrictEqual({ ok: true, body: createBody() });
    expect("oneNumber" in (result as { body: object }).body).toBe(false);
  });

  it("keeps a one number", () => {
    expect(create({ oneNumber: "5 minutes to 2" })).toStrictEqual({
      ok: true,
      body: createBody({ oneNumber: "5 minutes to 2" }),
    });
  });

  it.each(["inherit", "members", "public"])("sends visibility %s", (visibility) => {
    expect(create({ visibility })).toStrictEqual({
      ok: true,
      body: createBody({ visibility }),
    });
  });

  it.each([
    ["no visibility field", null],
    ["an empty visibility", ""],
  ])("leaves visibility out for %s", (_name, visibility) => {
    const result = create({ visibility });

    const withoutVisibility = Object.fromEntries(
      Object.entries(createBody()).filter(([name]) => name !== "visibility"),
    );

    expect(result).toStrictEqual({ ok: true, body: withoutVisibility });
    expect("visibility" in (result as { body: object }).body).toBe(false);
  });

  it.each(["everyone", "Public"])("refuses the visibility %s", (visibility) => {
    expect(create({ visibility })).toStrictEqual(
      refused({ visibility }, { visibility: CHOOSE_ONE }),
    );
  });

  describe("feedbackIds", () => {
    it.each([
      ["none", null],
      ["only values that are not ids", ["nope", `${F(1)}x`]],
    ])("needs at least one: %s", (_name, ids) => {
      expect(create({ feedbackIds: ids })).toStrictEqual(
        refused({ feedbackIds: ids }, { feedbackIds: CHOOSE_ONE }),
      );
    });

    it("keeps one, trimmed", () => {
      expect(create({ feedbackIds: [F(1)] })).toStrictEqual({ ok: true, body: createBody() });
      expect(create({ feedbackIds: [` ${F(1)} `] })).toStrictEqual({
        ok: true,
        body: createBody(),
      });
    });

    it("keeps ten in order and cuts an eleventh without an error", () => {
      expect(create({ feedbackIds: range(F, 10) })).toStrictEqual({
        ok: true,
        body: createBody({ feedbackIds: range(F, 10) }),
      });
      expect(create({ feedbackIds: range(F, 11) })).toStrictEqual({
        ok: true,
        body: createBody({ feedbackIds: range(F, 10) }),
      });
    });

    it("drops duplicates before the cut and keeps the first", () => {
      expect(create({ feedbackIds: [F(1), ...range(F, 10)] })).toStrictEqual({
        ok: true,
        body: createBody({ feedbackIds: range(F, 10) }),
      });
      expect(create({ feedbackIds: [F(2), F(1), F(2)] })).toStrictEqual({
        ok: true,
        body: createBody({ feedbackIds: [F(2), F(1)] }),
      });
    });

    it("joins the submitted ids with a comma in a failed state", () => {
      const change = { feedbackIds: [F(1), F(2)], title: "" };

      expect(create(change)).toStrictEqual(
        refused(change, { title: { key: "required" } }),
      );
      expect(valuesOf(pairs(change)).feedbackIds).toBe(`${F(1)},${F(2)}`);
    });
  });

  describe("postIds", () => {
    it("are optional", () => {
      expect(create({ postIds: null })).toStrictEqual({ ok: true, body: createBody() });
    });

    it("keeps ten in order and cuts an eleventh without an error", () => {
      expect(create({ postIds: range(P, 10) })).toStrictEqual({
        ok: true,
        body: createBody({ postIds: range(P, 10) }),
      });
      expect(create({ postIds: range(P, 11) })).toStrictEqual({
        ok: true,
        body: createBody({ postIds: range(P, 10) }),
      });
    });

    it("drops values that are not ids", () => {
      expect(create({ postIds: ["nope", P(1)] })).toStrictEqual({
        ok: true,
        body: createBody({ postIds: [P(1)] }),
      });
    });
  });

  it("reports every missing field at once, with no form error", () => {
    const change = { title: "", feedbackStory: "", change: "", result: "", feedbackIds: null };
    const result = create(change);

    expect(result).toStrictEqual(
      refused(change, {
        title: { key: "required" },
        feedbackStory: { key: "required" },
        change: { key: "required" },
        result: { key: "required" },
        feedbackIds: CHOOSE_ONE,
      }),
    );
    expect("formError" in (result as { state: object }).state).toBe(false);
  });
});

describe('validateCase(form, "update")', () => {
  const update = (change: Record<string, string | string[] | null> = {}) =>
    validateCase(formWith(pairs(change)), "update");
  const refused = (change: Record<string, string | string[] | null>, errors: object) => ({
    ok: false,
    state: { errors, values: valuesOf(pairs(change)) },
  });

  it("always sends oneNumber and postIds", () => {
    expect(update()).toStrictEqual({ ok: true, body: updateBody() });
  });

  it("sends an empty oneNumber when the field is missing", () => {
    expect(update({ oneNumber: null })).toStrictEqual({ ok: true, body: updateBody() });
  });

  it("sends a one number", () => {
    expect(update({ oneNumber: "5 minutes to 2" })).toStrictEqual({
      ok: true,
      body: updateBody({ oneNumber: "5 minutes to 2" }),
    });
  });

  it("requires the title and at least one feedback item", () => {
    expect(update({ title: "" })).toStrictEqual(
      refused({ title: "" }, { title: { key: "required" } }),
    );
    expect(update({ feedbackIds: null })).toStrictEqual(
      refused({ feedbackIds: null }, { feedbackIds: CHOOSE_ONE }),
    );
  });

  it("limits the title and refuses a visibility that is not a choice", () => {
    const long = "x".repeat(LIMITS.caseTitleMax + 1);

    expect(update({ title: long })).toStrictEqual(
      refused({ title: long }, { title: { key: "tooLong", max: LIMITS.caseTitleMax } }),
    );
    expect(update({ visibility: "everyone" })).toStrictEqual(
      refused({ visibility: "everyone" }, { visibility: CHOOSE_ONE }),
    );
  });
});

describe("the case actions", () => {
  it("export exactly the three actions", () => {
    expect(Object.keys(caseActions).sort()).toStrictEqual([
      "createCase",
      "setCredit",
      "updateCase",
    ]);
  });
});

describe("createCase", () => {
  const filled = pairs({
    feedbackIds: [F(1), F(2)],
    postIds: [P(1)],
    oneNumber: "5 minutes to 2",
    visibility: "public",
  });
  const sentBody = createBody({
    feedbackIds: [F(1), F(2)],
    postIds: [P(1)],
    oneNumber: "5 minutes to 2",
    visibility: "public",
  });
  const run = (locale = "fa", slug = "daftar", form: Pairs = filled) =>
    outcome(createCase(locale, slug, initialFormState, formWith(form)));
  const failed = (formError: string, form: Pairs = filled) => ({
    state: { errors: {}, formError, values: valuesOf(form) },
  });

  it.each([
    ["fa", `${CASE_PATH}?saved=case`],
    ["en", `/en${CASE_PATH}?saved=case`],
  ])("creates the case and redirects to it in %s", async (locale, path) => {
    h.answer = ok({ id: CASE_ID }, 201);

    expect(await run(locale)).toStrictEqual({ redirect: path });
    expect(h.calls).toStrictEqual([
      {
        method: "POST",
        path: "/v1/projects/{slug}/cases",
        init: { params: { path: { slug: "daftar" } }, body: sentBody },
      },
    ]);
  });

  it("sends the smallest form without a one number", async () => {
    h.answer = ok({ id: CASE_ID }, 201);

    await run("fa", "daftar", base);

    expect(h.calls).toStrictEqual([
      {
        method: "POST",
        path: "/v1/projects/{slug}/cases",
        init: { params: { path: { slug: "daftar" } }, body: createBody() },
      },
    ]);
    expect("oneNumber" in (h.calls[0]?.init as { body: object }).body).toBe(false);
  });

  it("encodes the id the platform returns", async () => {
    h.answer = ok({ id: "a/../b?c#d" }, 201);

    expect(await run()).toStrictEqual({
      redirect: "/projects/daftar/cases/a%2F..%2Fb%3Fc%23d?saved=case",
    });
  });

  it("treats a bound locale that is not a locale as the default", async () => {
    h.answer = ok({ id: CASE_ID }, 201);

    expect(await run("//evil.example")).toStrictEqual({ redirect: `${CASE_PATH}?saved=case` });
  });

  it.each(["../x", "//evil.example", "Daftar", ""])(
    "answers not_found without a call for the slug %j",
    async (slug) => {
      h.answer = ok({ id: CASE_ID }, 201);

      expect(await run("fa", slug)).toStrictEqual(failed("not_found"));
      expect(h.calls).toStrictEqual([]);
    },
  );

  it("sends nothing when the form is not valid", async () => {
    const form = pairs({ feedbackIds: null });

    expect(await run("fa", "daftar", form)).toStrictEqual({
      state: { errors: { feedbackIds: CHOOSE_ONE }, values: valuesOf(form) },
    });
    expect(h.calls).toStrictEqual([]);
  });

  it.each([
    [400, "case_feedback_invalid", "case_feedback_invalid"],
    [400, "case_post_invalid", "case_post_invalid"],
    [400, "validation_failed", "validation_failed"],
    [400, "acted_on_invalid", "acted_on_invalid"],
    [400, "no_such_code", "internal_error"],
    [401, "storefront_key_invalid", "internal_error"],
    [403, "not_project_owner", "not_project_owner"],
    [403, "own_project", "own_project"],
    [403, "forbidden", "not_project_owner"],
    [404, "not_found", "not_found"],
    [404, "project_not_found", "not_found"],
  ])("maps a %s %s to %s and keeps the form", async (status, code, formError) => {
    h.answer = fail(status, code);

    expect(await run()).toStrictEqual(failed(formError));
    expect(h.calls).toHaveLength(1);
    expect(h.deleted).toStrictEqual([]);
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    expect(await run()).toStrictEqual(failed("unreachable"));
    expect(h.deleted).toStrictEqual([]);
  });

  it.each([
    ["fa", "/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fcases%2Fnew"],
    ["en", "/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fcases%2Fnew"],
  ])("deletes the session cookie and redirects to sign-in on session_required in %s", async (locale, path) => {
    h.answer = fail(401, "session_required");

    expect(await run(locale)).toStrictEqual({ redirect: path });
    expect(h.deleted).toStrictEqual(["wh_session"]);
  });
});

describe("updateCase", () => {
  const run = (locale = "fa", slug = "daftar", id = CASE_ID, form: Pairs = base) =>
    outcome(updateCase(locale, slug, id, initialFormState, formWith(form)));
  const failed = (formError: string) => ({
    state: { errors: {}, formError, values: valuesOf(base) },
  });

  it.each([
    ["fa", `${CASE_PATH}?saved=case`],
    ["en", `/en${CASE_PATH}?saved=case`],
  ])("saves the case and redirects to it in %s", async (locale, path) => {
    h.answer = ok({ id: CASE_ID });

    expect(await run(locale)).toStrictEqual({ redirect: path });
    expect(h.calls).toStrictEqual([
      {
        method: "PATCH",
        path: "/v1/cases/{id}",
        init: { params: { path: { id: CASE_ID } }, body: updateBody() },
      },
    ]);
  });

  it.each([
    ["a slug with a path in it", "../x", CASE_ID],
    ["a slug in capitals", "Daftar", CASE_ID],
    ["an id that is not a UUID", "daftar", "nope"],
    ["an id with a path in it", "daftar", `${CASE_ID}/../x`],
  ])("answers not_found without a call for %s", async (_name, slug, id) => {
    h.answer = ok({ id: CASE_ID });

    expect(await run("fa", slug, id)).toStrictEqual(failed("not_found"));
    expect(h.calls).toStrictEqual([]);
  });

  it("sends nothing when the title is empty", async () => {
    const form = pairs({ title: "" });

    expect(await run("fa", "daftar", CASE_ID, form)).toStrictEqual({
      state: { errors: { title: { key: "required" } }, values: valuesOf(form) },
    });
    expect(h.calls).toStrictEqual([]);
  });

  it.each([
    [400, "case_post_invalid", "case_post_invalid"],
    [403, "not_project_owner", "not_project_owner"],
    [404, "not_found", "not_found"],
  ])("maps a %s %s to %s and keeps the form", async (status, code, formError) => {
    h.answer = fail(status, code);

    expect(await run()).toStrictEqual(failed(formError));
    expect(h.deleted).toStrictEqual([]);
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    expect(await run()).toStrictEqual(failed("unreachable"));
  });

  it.each([
    [
      "fa",
      `/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fcases%2F${CASE_ID}%2Fedit`,
    ],
    [
      "en",
      `/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fcases%2F${CASE_ID}%2Fedit`,
    ],
  ])("deletes the session cookie and redirects to sign-in on session_required in %s", async (locale, path) => {
    h.answer = fail(401, "session_required");

    expect(await run(locale)).toStrictEqual({ redirect: path });
    expect(h.deleted).toStrictEqual(["wh_session"]);
  });
});

describe("setCredit", () => {
  const given: Pairs = [["consent", "given"]];
  const run = (locale = "fa", slug = "daftar", id = CASE_ID, form: Pairs = given) =>
    outcome(setCredit(locale, slug, id, initialFormState, formWith(form)));
  const failed = (formError: string, form: Pairs = given) => ({
    state: { errors: {}, formError, values: valuesOf(form) },
  });

  it.each([
    ["fa", "given", `${CASE_PATH}?saved=credit`],
    ["fa", "declined", `${CASE_PATH}?saved=credit`],
    ["en", "given", `/en${CASE_PATH}?saved=credit`],
    ["en", "declined", `/en${CASE_PATH}?saved=credit`],
  ])("records the choice in %s with %s and redirects to the case", async (locale, consent, path) => {
    h.answer = ok({ id: CASE_ID });

    expect(await run(locale, "daftar", CASE_ID, [["consent", consent]])).toStrictEqual({
      redirect: path,
    });
    expect(h.calls).toStrictEqual([
      {
        method: "PUT",
        path: "/v1/cases/{id}/credit",
        init: { params: { path: { id: CASE_ID } }, body: { consent } },
      },
    ]);
  });

  it("sends only the consent, whatever else is submitted", async () => {
    h.answer = ok({ id: CASE_ID });

    await run("fa", "daftar", CASE_ID, [
      ["consent", "given"],
      ["title", "ignored"],
    ]);

    expect(h.calls).toStrictEqual([
      {
        method: "PUT",
        path: "/v1/cases/{id}/credit",
        init: { params: { path: { id: CASE_ID } }, body: { consent: "given" } },
      },
    ]);
  });

  it.each([
    ["no field", []],
    ["an empty value", [["consent", ""]]],
    ["pending", [["consent", "pending"]]],
    ["a capital letter", [["consent", "Given"]]],
    ["spaces around it", [["consent", " given "]]],
  ] as [string, Pairs][])("refuses %s as validation_failed without a call", async (_name, form) => {
    h.answer = ok({ id: CASE_ID });

    expect(await run("fa", "daftar", CASE_ID, form)).toStrictEqual(
      failed("validation_failed", form),
    );
    expect(h.calls).toStrictEqual([]);
  });

  it.each([
    ["a slug with a path in it", "../x", CASE_ID],
    ["an id that is not a UUID", "daftar", "nope"],
  ])("answers not_found without a call for %s", async (_name, slug, id) => {
    h.answer = ok({ id: CASE_ID });

    expect(await run("fa", slug, id)).toStrictEqual(failed("not_found"));
    expect(h.calls).toStrictEqual([]);
  });

  it.each([
    [404, "not_found", "not_found"],
    [400, "validation_failed", "validation_failed"],
    [401, "storefront_key_invalid", "internal_error"],
  ])("maps a %s %s to %s and keeps the form", async (status, code, formError) => {
    h.answer = fail(status, code);

    expect(await run()).toStrictEqual(failed(formError));
    expect(h.deleted).toStrictEqual([]);
  });

  it("maps a call that throws to unreachable", async () => {
    h.answer = new Error("connect ECONNREFUSED");

    expect(await run()).toStrictEqual(failed("unreachable"));
  });

  it.each([
    ["fa", `/sign-in?error=session_required&next=%2Fprojects%2Fdaftar%2Fcases%2F${CASE_ID}`],
    [
      "en",
      `/en/sign-in?error=session_required&next=%2Fen%2Fprojects%2Fdaftar%2Fcases%2F${CASE_ID}`,
    ],
  ])("deletes the session cookie and redirects to sign-in on session_required in %s", async (locale, path) => {
    h.answer = fail(401, "session_required");

    expect(await run(locale)).toStrictEqual({ redirect: path });
    expect(h.deleted).toStrictEqual(["wh_session"]);
  });
});
