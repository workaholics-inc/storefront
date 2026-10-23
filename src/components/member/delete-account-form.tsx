"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button } from "../ui/button";
import { TextField } from "../ui/form-field";
import { StateMessage } from "../ui/state-message";

// The projects the platform named when the member is their only owner.
export function soleOwnerProjects(state: FormState): string[] {
  const projects = state.values.projects;
  if (state.formError !== "sole_owner" || !projects) return [];

  return projects.split(",");
}

export function SoleOwnerProjects({ slugs }: { slugs: string[] }) {
  const t = useTranslations("Deletion");

  if (slugs.length === 0) return null;

  return (
    <section aria-labelledby="delete-sole-owner" className="flex flex-col gap-2">
      <h2 id="delete-sole-owner" className="m-0 text-title-3 text-ink">
        {t("soleOwnerTitle")}
      </h2>
      <p className="m-0 text-ink">{t("soleOwnerBody")}</p>
      <ul className="m-0 flex flex-col gap-1 ps-5">
        {slugs.map((slug) => (
          <li key={slug}>
            <Link
              href={`/projects/${encodeURIComponent(slug)}/edit`}
              className="font-medium text-link"
            >
              <bdi dir="ltr">{slug}</bdi>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DeleteAccountForm({
  action,
  handle,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  handle: string;
}) {
  const t = useTranslations("Deletion");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const message = (error: FieldError | undefined) =>
    error
      ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 })
      : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.formError ? (
        <>
          <StateMessage kind="error" title={tMessages(state.formError)} />
          <SoleOwnerProjects slugs={soleOwnerProjects(state)} />
        </>
      ) : null}
      <p id="delete-confirm-how" className="m-0 text-ink">
        {t.rich("confirmHint", {
          handle,
          n: (chunks) => (
            <bdi dir="ltr" className="font-semibold">
              {chunks}
            </bdi>
          ),
        })}
      </p>
      <TextField
        id="delete-confirm"
        name="confirm"
        label={t("confirmLabel")}
        aria-describedby="delete-confirm-how"
        dir="ltr"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="max-w-xs"
        defaultValue={state.values.confirm ?? ""}
        error={message(state.errors.confirm)}
      />
      <div>
        <Button type="submit" variant="primary" busy={pending} busyLabel={t("submitting")}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
