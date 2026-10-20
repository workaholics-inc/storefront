import type { components } from "@/lib/api/schema";
import type { ResponseChipProps } from "./response-chip";

type ResponseState = components["schemas"]["ResponseState"];
type ResponseStatus = components["schemas"]["ResponseStatus"];

// The platform derives the state; this only picks the chip that shows it.
export function stateChip(state: ResponseState): ResponseChipProps {
  if (state.state === "awaiting") {
    return state.overdue
      ? { kind: "overdue", days: state.overdueDays }
      : { kind: "awaiting" };
  }

  return { kind: "answered", days: state.answeredInDays ?? 0 };
}

// A testing answer without a report-back date has no chip: the tag needs it.
export function answerChip(answer: {
  status: ResponseStatus;
  recheckOn: string | null;
}): ResponseChipProps | null {
  if (answer.status === "testing") {
    return answer.recheckOn === null
      ? null
      : { kind: "testing", recheckOn: answer.recheckOn };
  }

  return { kind: answer.status };
}
