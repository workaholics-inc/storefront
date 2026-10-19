"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button } from "../ui/button";
import { SelectField, TextAreaField } from "../ui/form-field";
import { StateMessage } from "../ui/state-message";

// An option holds text only, so a bdi cannot go around a question: these
// isolate it the same way, so a Latin question never misplaces the punctuation
// of a Persian one beside it.
const ISOLATE_START = "⁨";
const ISOLATE_END = "⁩";

// Feedback on a post, optionally answering one of the post's questions. The
// same form edits it within the window the platform allows.
export function FeedbackForm({
  idPrefix,
  action,
  questions,
  bodyMax,
  mode,
  initial,
}: {
  idPrefix: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  questions: string[];
  bodyMax: number;
  mode: "give" | "edit";
  initial?: { body: string; questionIndex: number | null };
}) {
  const t = useTranslations("Feedback");
  const tForms = useTranslations("Forms");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const value = (name: string, fallback: string) => state.values[name] ?? fallback;
  const message = (error: FieldError | undefined) =>
    error
      ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 })
      : undefined;
  const question = value(
    "questionIndex",
    initial?.questionIndex == null ? "" : String(initial.questionIndex),
  );
  const giving = mode === "give";

  return (
    <form
      id={giving ? "give-feedback" : undefined}
      action={formAction}
      noValidate
      className="flex max-w-read scroll-mt-24 flex-col gap-4"
    >
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <TextAreaField
        id={`${idPrefix}-body`}
        name="body"
        label={t("body")}
        maxLength={bodyMax}
        defaultValue={value("body", initial?.body ?? "")}
        error={message(state.errors.body)}
      />
      {questions.length > 0 ? (
        <SelectField
          // A select ignores a defaultValue that changes after its first render,
          // and React resets the form after the action: remount it to keep the
          // submitted choice.
          key={`question-${question}`}
          id={`${idPrefix}-question`}
          name="questionIndex"
          label={t("questionLabel")}
          defaultValue={question}
          error={message(state.errors.questionIndex)}
        >
          <option value="">{t("questionNone")}</option>
          {questions.map((text, index) => (
            <option key={index} value={String(index)}>
              {`${ISOLATE_START}${text}${ISOLATE_END}`}
            </option>
          ))}
        </SelectField>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="primary"
          busy={pending}
          busyLabel={giving ? t("sending") : tForms("saving")}
        >
          {giving ? t("send") : tForms("save")}
        </Button>
      </div>
    </form>
  );
}
