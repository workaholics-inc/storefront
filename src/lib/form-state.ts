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
    | "memberNotFound";
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
