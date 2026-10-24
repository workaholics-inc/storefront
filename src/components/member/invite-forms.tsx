"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { Button } from "../ui/button";
import { TextField } from "../ui/form-field";
import { StateMessage } from "../ui/state-message";

export type CreatedInviteView = { code: string; link: string; validUntil: string };

// The code, its link and the date they are good until, once the platform has
// made an invite; null for every other state.
export function createdInvite(state: FormState): CreatedInviteView | null {
  if (state.formError !== undefined) return null;
  const { code, link, validUntil } = state.values;
  if (!code || !link || !validUntil) return null;

  return { code, link, validUntil };
}

function CopyRow({
  id,
  label,
  value,
  copyLabel,
}: {
  id: string;
  label: string;
  value: string;
  copyLabel: string;
}) {
  const t = useTranslations("Invites");
  const [copied, setCopied] = useState(false);
  const row = useRef<HTMLDivElement>(null);

  function select() {
    row.current?.querySelector("input")?.select();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // No clipboard (or it refused): leave the text selected to copy by hand.
      select();
    }
  }

  return (
    <div ref={row} className="flex flex-col gap-2">
      <TextField
        id={id}
        label={label}
        readOnly
        dir="ltr"
        value={value}
        className="font-mono"
        onFocus={select}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copyLabel}
        </Button>
        <span role="status" className="text-small text-ink-muted">
          {copied ? t("copied") : ""}
        </span>
      </div>
    </div>
  );
}

export function CreatedInvite({ code, link, validUntil }: CreatedInviteView) {
  const t = useTranslations("Invites");

  return (
    <div className="flex max-w-read flex-col gap-3 rounded-md border border-rule bg-sheet p-4 sm:p-5">
      <h2 className="m-0 text-title-3 text-ink">{t("createdTitle")}</h2>
      <p className="m-0 text-small text-ink">{t("createdOnce")}</p>
      <CopyRow id="invite-code" label={t("codeLabel")} value={code} copyLabel={t("copyCode")} />
      <CopyRow id="invite-link" label={t("linkLabel")} value={link} copyLabel={t("copyLink")} />
      <p className="m-0 text-small text-ink-muted">{t("validUntil", { date: validUntil })}</p>
    </div>
  );
}

export function InviteCreate({
  action,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const t = useTranslations("Invites");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const created = createdInvite(state);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {created ? <CreatedInvite {...created} /> : null}
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <form action={formAction} className="flex flex-col items-start gap-2">
        <p className="m-0 max-w-read text-small text-ink-muted">{t("limitNote")}</p>
        <Button type="submit" variant="primary" busy={pending} busyLabel={t("creating")}>
          {t("create")}
        </Button>
      </form>
    </div>
  );
}

export function RevokeInviteForm({
  action,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const t = useTranslations("Invites");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <Button type="submit" variant="secondary" size="sm" busy={pending} busyLabel={t("revoking")}>
        {t("revoke")}
      </Button>
      <p className="m-0 text-small text-ink-muted">{t("revokeHint")}</p>
    </form>
  );
}
