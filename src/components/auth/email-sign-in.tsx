"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  initialFormState,
  sentAddress,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button } from "../ui/button";
import { TextField } from "../ui/form-field";
import { StateMessage } from "../ui/state-message";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

function EmailSteps({
  next,
  addressMax,
  start,
  verify,
  onRestart,
}: {
  next?: string;
  addressMax: number;
  start: Action;
  verify: Action;
  onRestart: () => void;
}) {
  const t = useTranslations("Auth");
  const tMessages = useTranslations("Errors");
  const tFields = useTranslations("Forms.errors");
  const [started, startAction, starting] = useActionState(start, initialFormState);
  const [verified, verifyAction, verifying] = useActionState(verify, initialFormState);
  const address = sentAddress(started);

  const message = (error: FieldError | undefined) =>
    error ? tFields(error.key, { max: error.max ?? 0, min: error.min ?? 0 }) : undefined;
  const errorTitle = (code: string) =>
    code === "sign_in_method_unavailable" ? t("emailUnavailable") : tMessages(code);

  if (address === null) {
    return (
      <form action={startAction} noValidate className="flex flex-col items-start gap-3">
        {started.formError ? (
          <StateMessage kind="error" title={errorTitle(started.formError)} body="" />
        ) : null}
        <TextField
          id="sign-in-email"
          name="address"
          type="email"
          label={t("emailLabel")}
          dir="ltr"
          autoComplete="email"
          spellCheck={false}
          maxLength={addressMax}
          defaultValue={started.values.address ?? ""}
          error={message(started.errors.address)}
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" busy={starting} busyLabel={t("emailSending")}>
          {t("emailSend")}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyAction} noValidate className="flex flex-col items-start gap-3">
      <p role="status" className="m-0 text-ink">
        {t("emailSent")}
      </p>
      <p className="m-0 text-small text-ink-muted">{t.rich("emailFor", { address, n: bdi })}</p>
      {verified.formError ? (
        <StateMessage kind="error" title={errorTitle(verified.formError)} body="" />
      ) : null}
      <input type="hidden" name="address" value={address} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField
        id="sign-in-code"
        name="code"
        label={t("codeLabel")}
        dir="ltr"
        inputMode="numeric"
        autoComplete="one-time-code"
        spellCheck={false}
        defaultValue={verified.values.code ?? ""}
        error={message(verified.errors.code)}
        className="max-w-xs"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" busy={verifying} busyLabel={t("codeSubmitting")}>
          {t("codeSubmit")}
        </Button>
        <Button type="button" variant="quiet" onClick={onRestart}>
          {t("emailOther")}
        </Button>
      </div>
    </form>
  );
}

// Email sign-in for a member who can't reach Telegram: the address, then the
// code sent to it. A new `key` on the steps starts over.
export function EmailSignIn({
  next,
  addressMax,
  start,
  verify,
}: {
  next?: string;
  addressMax: number;
  start: Action;
  verify: Action;
}) {
  const [round, setRound] = useState(0);

  return (
    <EmailSteps
      key={round}
      next={next}
      addressMax={addressMax}
      start={start}
      verify={verify}
      onRestart={() => setRound((n) => n + 1)}
    />
  );
}
