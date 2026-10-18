import { describe, expect, it } from "vitest";
import {
  LIMITS,
  validateFeedback,
  validatePost,
  validateReply,
  validateResponse,
  type FormState,
} from "@/lib/validation";

function formOf(fields: Record<string, string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

function formWith(pairs: [string, string][]) {
  const form = new FormData();
  for (const [name, value] of pairs) form.append(name, value);
  return form;
}

function failureOf(result: { ok: boolean; state?: FormState }): FormState {
  if (result.ok || !result.state) throw new Error("expected a failed result");
  return result.state;
}

function bodyOf<T>(result: { ok: boolean; body?: T }): T {
  if (!result.ok || !result.body) throw new Error("expected a valid result");
  return result.body;
}

// 21 October in Tehran, still the 20th in UTC: the allowed report-back dates
// run from 2026-10-21 to 2027-04-18.
const now = new Date("2026-10-20T22:00:00Z");
const firstId = "123e4567-e89b-42d3-a456-426614174000";
const secondId = "223e4567-e89b-42d3-a456-426614174000";

describe("LIMITS from the contract", () => {
  it("reads the practice limits", () => {
    expect(LIMITS.reasonMax).toBe(1000);
    expect(LIMITS.questionsMax).toBe(5);
    expect(LIMITS.questionMax).toBe(280);
  });
});

describe("validatePost, work in progress", () => {
  const wip = { body: "Here is my draft", question0: "Is it clear?" };

  it("sends the trimmed body and questions with the kind", () => {
    const body = bodyOf(
      validatePost(formOf({ ...wip, body: "  Here is my draft  " }), "wip"),
    );

    expect(body).toEqual({
      kind: "wip",
      body: "Here is my draft",
      feedbackWanted: ["Is it clear?"],
    });
  });

  it("drops empty questions and keeps the order of the rest", () => {
    const body = bodyOf(
      validatePost(
        formOf({ ...wip, question0: "", question1: "  ", question3: "Second?", question4: "Third?" }),
        "wip",
      ),
    );

    expect(body).toMatchObject({ feedbackWanted: ["Second?", "Third?"] });
  });

  it("needs at least one question", () => {
    const state = failureOf(validatePost(formOf({ body: "Draft", question0: " " }), "wip"));

    expect(state.errors.question0).toEqual({ key: "required" });
  });

  it("flags a question that is too long on that field", () => {
    const state = failureOf(
      validatePost(
        formOf({ ...wip, question2: "x".repeat(LIMITS.questionMax + 1) }),
        "wip",
      ),
    );

    expect(state.errors.question2).toEqual({ key: "tooLong", max: LIMITS.questionMax });
    expect(state.errors.question0).toBeUndefined();
    expect(state.values.question2).toHaveLength(LIMITS.questionMax + 1);
  });

  it("accepts a question of exactly the limit", () => {
    const body = bodyOf(
      validatePost(formOf({ ...wip, question0: "x".repeat(LIMITS.questionMax) }), "wip"),
    );

    expect(body).toMatchObject({ kind: "wip" });
  });

  it("needs a body", () => {
    const state = failureOf(validatePost(formOf({ body: " ", question0: "Q?" }), "wip"));

    expect(state.errors.body).toEqual({ key: "required" });
  });

  it("leaves an empty self-critique out and sends a written one", () => {
    expect(
      "selfCritique" in bodyOf(validatePost(formOf({ ...wip, selfCritique: "  " }), "wip")),
    ).toBe(false);
    expect(
      bodyOf(validatePost(formOf({ ...wip, selfCritique: " Too long " }), "wip")),
    ).toMatchObject({ selfCritique: "Too long" });
  });
});

describe("validatePost, update", () => {
  const update = { whatChanged: "I rewrote the intro", oneNumber: "3 of 5 finished" };

  it("sends an empty body as an empty string and leaves out what is not written", () => {
    const body = bodyOf(validatePost(formOf(update), "update"));

    expect(body).toEqual({
      kind: "update",
      body: "",
      whatChanged: "I rewrote the intro",
      actedOn: [],
      oneNumber: "3 of 5 finished",
    });
  });

  it("sends rejectedAndWhy when it is written", () => {
    expect(
      bodyOf(validatePost(formOf({ ...update, rejectedAndWhy: " Too big " }), "update")),
    ).toMatchObject({ rejectedAndWhy: "Too big" });
  });

  it("keeps only UUIDs in actedOn and drops duplicates", () => {
    const body = bodyOf(
      validatePost(
        formWith([
          ["whatChanged", "Changed"],
          ["oneNumber", "1"],
          ["actedOn", firstId],
          ["actedOn", "not-an-id"],
          ["actedOn", firstId],
          ["actedOn", secondId],
        ]),
        "update",
      ),
    );

    expect(body).toMatchObject({ actedOn: [firstId, secondId] });
  });

  it("keeps at most the limit of actedOn ids", () => {
    const ids = Array.from(
      { length: LIMITS.actedOnMax + 3 },
      (_, index) => `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`,
    );
    const body = bodyOf(
      validatePost(
        formWith([["whatChanged", "Changed"], ["oneNumber", "1"], ...ids.map((id): [string, string] => ["actedOn", id])]),
        "update",
      ),
    );

    expect((body as { actedOn: string[] }).actedOn).toEqual(ids.slice(0, LIMITS.actedOnMax));
  });

  it("returns every checked actedOn id, joined by commas, after a failed submit", () => {
    const state = failureOf(
      validatePost(
        formWith([
          ["whatChanged", "Changed"],
          ["actedOn", firstId],
          ["actedOn", secondId],
        ]),
        "update",
      ),
    );

    expect(state.values.actedOn).toBe(`${firstId},${secondId}`);
  });

  it("needs oneNumber and whatChanged", () => {
    const state = failureOf(validatePost(formOf({ whatChanged: " " }), "update"));

    expect(state.errors.oneNumber).toEqual({ key: "required" });
    expect(state.errors.whatChanged).toEqual({ key: "required" });
  });

  it("flags a oneNumber that is too long", () => {
    const state = failureOf(
      validatePost(formOf({ ...update, oneNumber: "x".repeat(LIMITS.oneNumberMax + 1) }), "update"),
    );

    expect(state.errors.oneNumber).toEqual({ key: "tooLong", max: LIMITS.oneNumberMax });
  });
});

describe("validateFeedback", () => {
  it("leaves questionIndex out when giving general feedback", () => {
    const body = bodyOf(validateFeedback(formOf({ body: " Nice ", questionIndex: "" }), "give"));

    expect(body).toEqual({ body: "Nice" });
  });

  it("sends null for questionIndex when editing general feedback", () => {
    const body = bodyOf(validateFeedback(formOf({ body: "Nice", questionIndex: "" }), "edit"));

    expect(body).toEqual({ body: "Nice", questionIndex: null });
  });

  it.each(["0", "4"])("sends question %s as a number", (index) => {
    expect(
      bodyOf(validateFeedback(formOf({ body: "Nice", questionIndex: index }), "give")),
    ).toEqual({ body: "Nice", questionIndex: Number(index) });
    expect(
      bodyOf(validateFeedback(formOf({ body: "Nice", questionIndex: index }), "edit")),
    ).toEqual({ body: "Nice", questionIndex: Number(index) });
  });

  it.each(["7", "5", "-1", "1.5", "first"])("rejects questionIndex %s with chooseOne", (index) => {
    const form = formOf({ body: "Nice", questionIndex: index });

    expect(failureOf(validateFeedback(form, "give")).errors.questionIndex).toEqual({
      key: "chooseOne",
    });
    expect(failureOf(validateFeedback(form, "edit")).errors.questionIndex).toEqual({
      key: "chooseOne",
    });
  });

  it("needs a body, no longer than the limit", () => {
    expect(failureOf(validateFeedback(formOf({ body: " " }), "give")).errors.body).toEqual({
      key: "required",
    });
    expect(
      failureOf(validateFeedback(formOf({ body: "x".repeat(LIMITS.feedbackBodyMax + 1) }), "edit"))
        .errors.body,
    ).toEqual({ key: "tooLong", max: LIMITS.feedbackBodyMax });
  });
});

describe("validateResponse", () => {
  const testing = { status: "testing", reason: "I will try it" };

  it("needs a status", () => {
    const state = failureOf(validateResponse(formOf({ reason: "Because" }), now, "en"));

    expect(state.errors.status).toEqual({ key: "chooseOne" });
  });

  it("needs a status that is one of the three", () => {
    const state = failureOf(
      validateResponse(formOf({ status: "maybe", reason: "Because" }), now, "en"),
    );

    expect(state.errors.status).toEqual({ key: "chooseOne" });
  });

  it("needs a reason, whatever the status", () => {
    for (const status of ["accepted", "rejected"]) {
      const state = failureOf(validateResponse(formOf({ status, reason: "  " }), now, "en"));

      expect(state.errors.reason).toEqual({ key: "reasonRequired" });
    }
  });

  it("flags a reason that is too long", () => {
    const state = failureOf(
      validateResponse(
        formOf({ status: "accepted", reason: "x".repeat(LIMITS.reasonMax + 1) }),
        now,
        "en",
      ),
    );

    expect(state.errors.reason).toEqual({ key: "tooLong", max: LIMITS.reasonMax });
  });

  it.each(["accepted", "rejected"])("sends no recheckOn when %s", (status) => {
    const body = bodyOf(
      validateResponse(
        formOf({ status, reason: " Why ", recheckPick: "2026-10-27" }),
        now,
        "en",
      ),
    );

    expect(body).toEqual({ status, reason: "Why" });
  });

  it("sends a quick pick's date as recheckOn", () => {
    const body = bodyOf(
      validateResponse(formOf({ ...testing, recheckPick: "2026-10-27" }), now, "fa"),
    );

    expect(body).toEqual({ status: "testing", reason: "I will try it", recheckOn: "2026-10-27" });
  });

  it.each(["2026-10-21", "2027-04-18"])("accepts the edge date %s", (iso) => {
    expect(
      bodyOf(validateResponse(formOf({ ...testing, recheckPick: iso }), now, "en")),
    ).toMatchObject({ recheckOn: iso });
  });

  it.each([
    ["today in UTC", "2026-10-20"],
    ["past the range", "2027-04-19"],
    ["not a real day", "2026-11-45"],
    ["a day its month does not have", "2026-11-31"],
    ["not a date", "soon"],
  ])("rejects a quick pick that is %s with dateInvalid", (_label, pick) => {
    const state = failureOf(
      validateResponse(formOf({ ...testing, recheckPick: pick }), now, "en"),
    );

    expect(state.errors.recheckOn).toEqual({ key: "dateInvalid" });
  });

  it("reads another date from three selects in the Persian calendar", () => {
    const body = bodyOf(
      validateResponse(
        formOf({ ...testing, recheckPick: "other", recheckYear: "1405", recheckMonth: "8", recheckDay: "12" }),
        now,
        "fa",
      ),
    );

    expect(body).toMatchObject({ recheckOn: "2026-11-03" });
  });

  it("reads another date in the Gregorian calendar for en", () => {
    const body = bodyOf(
      validateResponse(
        formOf({ ...testing, recheckPick: "other", recheckYear: "2026", recheckMonth: "11", recheckDay: "3" }),
        now,
        "en",
      ),
    );

    expect(body).toMatchObject({ recheckOn: "2026-11-03" });
  });

  it("rejects 30 February as another date with dateInvalid", () => {
    const state = failureOf(
      validateResponse(
        formOf({ ...testing, recheckPick: "other", recheckYear: "2027", recheckMonth: "2", recheckDay: "30" }),
        now,
        "en",
      ),
    );

    expect(state.errors.recheckOn).toEqual({ key: "dateInvalid" });
  });

  it("rejects unfilled selects for another date with dateInvalid", () => {
    const state = failureOf(
      validateResponse(formOf({ ...testing, recheckPick: "other" }), now, "en"),
    );

    expect(state.errors.recheckOn).toEqual({ key: "dateInvalid" });
  });

  it("asks to choose when testing has no pick", () => {
    const state = failureOf(validateResponse(formOf(testing), now, "en"));

    expect(state.errors.recheckOn).toEqual({ key: "chooseOne" });
    expect(state.values.reason).toBe("I will try it");
  });
});

describe("validateReply", () => {
  it("needs a body", () => {
    expect(failureOf(validateReply(formOf({ body: "  " }))).errors.body).toEqual({
      key: "required",
    });
  });

  it("flags a body that is too long", () => {
    expect(
      failureOf(validateReply(formOf({ body: "x".repeat(LIMITS.replyBodyMax + 1) }))).errors.body,
    ).toEqual({ key: "tooLong", max: LIMITS.replyBodyMax });
  });

  it("sends the trimmed body", () => {
    expect(bodyOf(validateReply(formOf({ body: " Thanks " })))).toEqual({ body: "Thanks" });
  });
});
