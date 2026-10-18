"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { components } from "@/lib/api/schema";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button, buttonClasses } from "../ui/button";
import { TextAreaField, TextField } from "../ui/form-field";
import { LinksField, type LinkRow } from "../ui/links-field";
import { StateMessage } from "../ui/state-message";

type Member = components["schemas"]["Member"];

function linksFromValues(values: Record<string, string>, max: number): LinkRow[] {
  return Array.from({ length: max }, (_, i) => ({
    label: values[`links.${i}.label`] ?? "",
    url: values[`links.${i}.url`] ?? "",
  }));
}

export function ProfileForm({
  member,
  linksMax,
  action,
}: {
  member: Member;
  linksMax: number;
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const t = useTranslations("Profile");
  const tForms = useTranslations("Forms");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const submitted = Object.keys(state.values).length > 0;
  const value = (name: string, fallback: string) => state.values[name] ?? fallback;
  const message = (error: FieldError | undefined) =>
    error ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 }) : undefined;
  const links = submitted
    ? linksFromValues(state.values, linksMax)
    : member.links;

  return (
    <form action={formAction} noValidate className="flex max-w-read flex-col gap-6">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <TextField
        id="profile-handle"
        name="handle"
        label={t("handle")}
        hint={t("handleHint")}
        dir="ltr"
        autoComplete="off"
        defaultValue={value("handle", member.handle)}
        error={message(state.errors.handle)}
      />
      <TextField
        id="profile-display-name"
        name="displayName"
        label={t("displayName")}
        defaultValue={value("displayName", member.displayName)}
        error={message(state.errors.displayName)}
      />
      <TextAreaField
        id="profile-bio"
        name="bio"
        label={t("bio")}
        optionalLabel={tForms("optional")}
        hint={t("bioHint")}
        defaultValue={value("bio", member.bio)}
        error={message(state.errors.bio)}
      />
      <LinksField
        links={links}
        errors={state.errors}
        idPrefix="profile-links"
        max={linksMax}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          busy={pending}
          busyLabel={tForms("saving")}
        >
          {tForms("save")}
        </Button>
        <Link
          href={`/members/${encodeURIComponent(member.handle)}`}
          className={buttonClasses({ variant: "quiet" })}
        >
          {tForms("cancel")}
        </Link>
      </div>
    </form>
  );
}
