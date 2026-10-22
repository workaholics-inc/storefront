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

export type ReportKind = "post" | "feedback" | "reply";

// A sent report and an already-reported item both end the form with a calm notice.
export function reportNotice(state: FormState): "sent" | "already_reported" | null {
  if (state.values.report === "sent") return "sent";
  if (state.formError === "already_reported") return "already_reported";

  return null;
}

const REASON_LABEL = {
  post: "reasonPost",
  feedback: "reasonFeedback",
  reply: "reasonReply",
} as const;

// A report on a post, a piece of feedback or a reply. It hides nothing by
// itself, so the form says so and never says who else reported.
export function ReportForm({
  idPrefix,
  action,
  kind,
  reasonMax,
}: {
  idPrefix: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  kind: ReportKind;
  reasonMax: number;
}) {
  const t = useTranslations("Reports");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const message = (error: FieldError | undefined) =>
    error
      ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 })
      : undefined;
  const notice = reportNotice(state);

  if (notice !== null) {
    return (
      <p role="status" className="m-0 rounded-sm bg-sunken px-3 py-2 text-small text-ink">
        {notice === "sent" ? t("sent") : tMessages("already_reported")}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex max-w-read flex-col gap-4">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <TextAreaField
        id={`${idPrefix}-reason`}
        name="reason"
        label={t(REASON_LABEL[kind])}
        hint={t("reasonHint")}
        maxLength={reasonMax}
        defaultValue={state.values.reason ?? ""}
        error={message(state.errors.reason)}
      />
      <p className="m-0 text-small text-ink-muted">{t("note")}</p>
      <div>
        <Button type="submit" variant="primary" busy={pending} busyLabel={t("sending")}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
