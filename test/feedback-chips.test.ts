import { describe, expect, it } from "vitest";
import { answerChip, stateChip } from "@/components/feedback/chips";
import type { components } from "@/lib/api/schema";
import contract from "../contract/openapi.json";

type FeedbackItem = components["schemas"]["FeedbackItem"];
type ResponseState = components["schemas"]["ResponseState"];

const items = contract.components.schemas.FeedbackPage.example
  .items as FeedbackItem[];

// The contract's example page, in its order: awaiting, overdue, accepted
// (answered the same day), rejected (with a reply) and testing.
function example(index: number): FeedbackItem {
  const item = items[index];

  if (!item) {
    throw new Error(`the contract's FeedbackPage example has no item ${index}`);
  }

  return item;
}

function responseOf(index: number) {
  const { response } = example(index);

  if (!response) {
    throw new Error(`example item ${index} has no response`);
  }

  return response;
}

describe("stateChip", () => {
  it("is the awaiting chip for feedback still inside its window", () => {
    expect(example(0).responseState.state).toBe("awaiting");
    expect(stateChip(example(0).responseState)).toEqual({ kind: "awaiting" });
  });

  it("carries the platform's overdue days for overdue feedback", () => {
    expect(stateChip(example(1).responseState)).toEqual({
      kind: "overdue",
      days: 5,
    });
  });

  it("says answered in zero days for feedback answered the same day", () => {
    expect(stateChip(example(2).responseState)).toEqual({
      kind: "answered",
      days: 0,
    });
  });

  it.each([3, 4])("carries the days it took for answered example %i", (index) => {
    expect(stateChip(example(index).responseState)).toEqual({
      kind: "answered",
      days: 2,
    });
  });

  it("reads zero days when an answered state has no answeredInDays", () => {
    const state: ResponseState = {
      state: "answered",
      ageDays: 3,
      overdue: false,
      overdueDays: 0,
      answeredInDays: null,
    };

    expect(stateChip(state)).toEqual({ kind: "answered", days: 0 });
  });

  it("never shows an answered item as overdue", () => {
    const state: ResponseState = {
      state: "answered",
      ageDays: 30,
      overdue: true,
      overdueDays: 20,
      answeredInDays: 25,
    };

    expect(stateChip(state)).toEqual({ kind: "answered", days: 25 });
  });
});

describe("answerChip", () => {
  it("names the status of the answer in the examples", () => {
    expect(answerChip(responseOf(2))).toEqual({ kind: "accepted" });
    expect(answerChip(responseOf(3))).toEqual({ kind: "rejected" });
  });

  it("carries the report-back date of a testing answer", () => {
    expect(answerChip(responseOf(4))).toEqual({
      kind: "testing",
      recheckOn: "2026-11-15",
    });
  });

  it("has no chip for a testing answer without a date", () => {
    expect(answerChip({ status: "testing", recheckOn: null })).toBeNull();
  });

  it("ignores a date on an answer that is not testing", () => {
    expect(answerChip({ status: "accepted", recheckOn: "2026-11-15" })).toEqual({
      kind: "accepted",
    });
    expect(answerChip({ status: "rejected", recheckOn: "2026-11-15" })).toEqual({
      kind: "rejected",
    });
  });
});
