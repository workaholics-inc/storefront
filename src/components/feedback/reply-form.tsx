"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button } from "../ui/button";
import { TextAreaField } from "../ui/form-field";
import { StateMessage } from "../ui/state-message";

// A reply under an answer. The same form edits a reply (`initial` set) within
// the window the platform allows.
export function ReplyForm({
  idPrefix,
  action,
  bodyMax,
  initial,
}: {
  idPrefix: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  bodyMax: number;
  initial?: { body: string };
}) {
  const t = useTranslations("Feedback");
  const tForms = useTranslations("Forms");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const message = (error: FieldError | undefined) =>
    error
      ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 })
      : undefined;
  const editing = initial !== undefined;

  return (
    <form action={formAction} noValidate className="flex max-w-read flex-col gap-4">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <TextAreaField
        id={`${idPrefix}-body`}
        name="body"
        label={t("replyBody")}
        maxLength={bodyMax}
        defaultValue={state.values.body ?? initial?.body ?? ""}
        error={message(state.errors.body)}
      />
      <div>
        <Button
          type="submit"
          variant="primary"
          busy={pending}
          busyLabel={editing ? tForms("saving") : t("sending")}
        >
          {editing ? tForms("save") : t("send")}
        </Button>
      </div>
    </form>
  );
}
