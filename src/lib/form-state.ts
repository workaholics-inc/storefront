// No imports from the contract: client components import this file, and the
// contract must stay out of the browser bundle.

export type FieldError = {
  key:
    | "required"
    | "tooLong"
    | "tooShort"
    | "handlePattern"
    | "slugPattern"
    | "urlInvalid"
    | "linkIncomplete"
    | "handleTaken"
    | "slugTaken"
    | "memberNotFound"
    | "chooseOne"
    | "dateInvalid"
    | "reasonRequired"
    | "emailInvalid"
    | "codePattern";
  max?: number;
  min?: number;
};

export type FormState = {
  errors: Record<string, FieldError>;
  // An `Errors` message key.
  formError?: string;
  // What was submitted, so a failed form renders filled in.
  values: Record<string, string>;
};

export const initialFormState: FormState = { errors: {}, values: {} };

// The state after a code went out to `address`: the form shows its code step.
export function codeSent(address: string): FormState {
  return { errors: {}, values: { step: "code", address } };
}

// The address a code went out to, or null when the form is still on its first step.
export function sentAddress(state: FormState): string | null {
  const { step, address } = state.values;

  return step === "code" && typeof address === "string" && address !== "" ? address : null;
}
