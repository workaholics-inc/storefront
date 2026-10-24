"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import {
  initialFormState,
  sentAddress,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button } from "../ui/button";
import { TextField } from "../ui/form-field";
import { StateMessage } from "../ui/state-message";

type IdentitySummary = components["schemas"]["IdentitySummary"];
type Action = (state: FormState, form: FormData) => Promise<FormState>;

const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

// The two steps of connecting an email address: the address, then the code
// that was sent to it. A new `key` on this component starts over.
function AddEmail({
  addressMax,
  startAdd,
  verifyAdd,
  onRestart,
}: {
  addressMax: number;
  startAdd: Action;
  verifyAdd: Action;
  onRestart: () => void;
}) {
  const t = useTranslations("SignInMethods");
  const tMessages = useTranslations("Errors");
  const tFields = useTranslations("Forms.errors");
  const [started, startAction, starting] = useActionState(startAdd, initialFormState);
  const [verified, verifyAction, verifying] = useActionState(verifyAdd, initialFormState);
  const sent = sentAddress(started);

  const message = (error: FieldError | undefined) =>
    error ? tFields(error.key, { max: error.max ?? 0, min: error.min ?? 0 }) : undefined;
  const errorTitle = (code: string) =>
    code === "sign_in_method_unavailable" ? t("unavailable") : tMessages(code);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-title-3 text-ink">{t("addTitle")}</h3>
      <p className="m-0 text-small text-ink-muted">{t("addHint")}</p>
      {sent === null ? (
        <form action={startAction} noValidate className="flex flex-col items-start gap-3">
          {started.formError ? (
            <StateMessage kind="error" title={errorTitle(started.formError)} />
          ) : null}
          <TextField
            id="add-email-address"
            name="address"
            type="email"
            label={t("addressLabel")}
            dir="ltr"
            autoComplete="email"
            spellCheck={false}
            maxLength={addressMax}
            defaultValue={started.values.address ?? ""}
            error={message(started.errors.address)}
            className="max-w-xs"
          />
          <Button type="submit" variant="secondary" busy={starting} busyLabel={t("sendingCode")}>
            {t("sendCode")}
          </Button>
        </form>
      ) : (
        <form action={verifyAction} noValidate className="flex flex-col items-start gap-3">
          <p role="status" className="m-0 text-ink">
            {t.rich("codeSent", { address: sent, n: bdi })}
          </p>
          {verified.formError ? (
            <StateMessage kind="error" title={errorTitle(verified.formError)} />
          ) : null}
          <TextField
            id="add-email-code"
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
            <Button type="submit" variant="primary" busy={verifying} busyLabel={t("confirming")}>
              {t("confirm")}
            </Button>
            <Button type="button" variant="quiet" onClick={onRestart}>
              {t("otherAddress")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// How the member can sign in, in the order the platform sends the methods.
// Telegram is the way they joined and has no control.
export function SignInMethods({
  items,
  locale,
  notice,
  addressMax,
  startAdd,
  verifyAdd,
  remove,
}: {
  items: IdentitySummary[];
  locale: Locale;
  notice: "added" | "removed" | null;
  addressMax: number;
  startAdd: Action;
  verifyAdd: Action;
  remove: Action;
}) {
  const t = useTranslations("SignInMethods");
  const tMessages = useTranslations("Errors");
  const [removeState, removeAction, removing] = useActionState(remove, initialFormState);
  const [round, setRound] = useState(0);

  return (
    <section aria-labelledby="sign-in-methods-title" className="flex max-w-read flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="sign-in-methods-title" className="m-0 text-title-2 text-ink">
          {t("title")}
        </h2>
        <p className="m-0 text-small text-ink-muted">{t("intro")}</p>
      </div>
      {notice ? (
        <p role="status" className="m-0 rounded-sm bg-sunken px-3 py-2 text-small text-ink">
          {t(notice)}
        </p>
      ) : null}
      {removeState.formError ? (
        <StateMessage kind="error" title={tMessages(removeState.formError)} />
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li
            key={item.provider}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-rule bg-sheet px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="m-0 font-semibold text-ink">
                {item.provider === "telegram"
                  ? t("telegram")
                  : t.rich("email", { address: item.address ?? "", n: bdi })}
              </p>
              <p className="m-0 text-small text-ink-muted">
                {t("connectedOn", { date: formatDate(item.connectedAt, locale) })}
                <span aria-hidden="true"> · </span>
                {t("lastUsed", { date: formatDate(item.lastUsedAt, locale) })}
              </p>
              {item.provider === "telegram" ? (
                <p className="m-0 text-small text-ink-muted">{t("telegramNote")}</p>
              ) : null}
            </div>
            {item.provider === "email" ? (
              items.length >= 2 ? (
                <form action={removeAction}>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    busy={removing}
                    busyLabel={t("removing")}
                  >
                    {t("remove")}
                  </Button>
                </form>
              ) : (
                <p className="m-0 text-small text-ink-muted">{tMessages("last_identity")}</p>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {items.some((item) => item.provider === "email") ? null : (
        <AddEmail
          key={round}
          addressMax={addressMax}
          startAdd={startAdd}
          verifyAdd={verifyAdd}
          onRestart={() => setRound((n) => n + 1)}
        />
      )}
    </section>
  );
}
