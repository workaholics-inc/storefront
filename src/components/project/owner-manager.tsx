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
import { Button } from "../ui/button";
import { TextField } from "../ui/form-field";
import { StateMessage } from "../ui/state-message";

type Owner = NonNullable<components["schemas"]["MemberRef"]>;
type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function OwnerManager({
  owners,
  addAction,
  removeAction,
}: {
  owners: Owner[];
  addAction: Action;
  removeAction: Action;
}) {
  const t = useTranslations("Projects");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [addState, addFormAction, adding] = useActionState(addAction, initialFormState);
  const [removeState, removeFormAction, removing] = useActionState(
    removeAction,
    initialFormState,
  );

  const message = (error: FieldError | undefined) =>
    error ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 }) : undefined;
  const formError = removeState.formError ?? addState.formError;

  return (
    <section className="flex max-w-read flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-title-2 text-ink">{t("ownersTitle")}</h2>
        <p className="m-0 text-small text-ink-muted">{t("ownersHint")}</p>
      </div>
      {formError ? <StateMessage kind="error" title={tMessages(formError)} /> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {owners.map((owner) => (
          <li
            key={owner.handle}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-sheet px-4 py-2"
          >
            <Link
              href={`/members/${encodeURIComponent(owner.handle)}`}
              className="font-semibold text-ink no-underline hover:underline"
            >
              <bdi>{owner.displayName}</bdi>
            </Link>
            {owners.length >= 2 ? (
              <form action={removeFormAction}>
                <input type="hidden" name="handle" value={owner.handle} />
                <Button type="submit" variant="quiet" size="sm" disabled={removing}>
                  {t("remove", { name: owner.displayName })}
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <form action={addFormAction} noValidate className="flex flex-col items-start gap-3">
        <TextField
          id="owner-handle"
          name="handle"
          label={t("addOwnerLabel")}
          dir="ltr"
          autoComplete="off"
          defaultValue={addState.values.handle ?? ""}
          error={message(addState.errors.handle)}
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" busy={adding} busyLabel={t("adding")}>
          {t("addOwner")}
        </Button>
      </form>
    </section>
  );
}
