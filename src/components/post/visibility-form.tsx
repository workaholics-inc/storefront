"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button } from "../ui/button";
import type { ProbationView } from "../ui/probation-notice";
import { PublicBadge } from "../ui/public-badge";
import { StateMessage } from "../ui/state-message";
import { VisibilityField } from "../ui/visibility-field";

type ItemVisibility = components["schemas"]["ItemVisibility"];

// Who can see a post, for its owners. Changing it is not an edit, so it works
// at any time; the state line shows what visitors see right now.
export function VisibilityForm({
  action,
  visibility,
  isPublic,
  postKind,
  probation,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  visibility: ItemVisibility;
  isPublic: boolean;
  postKind: "wip" | "update";
  probation?: ProbationView | null;
}) {
  const t = useTranslations("Visibility");
  const tForms = useTranslations("Forms");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const message = (error: FieldError | undefined) =>
    error
      ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 })
      : undefined;
  // Only the success state of the action has values and no error.
  const saved =
    state.formError === undefined &&
    Object.keys(state.errors).length === 0 &&
    state.values.visibility !== undefined;

  return (
    <section id="visibility" className="flex min-w-0 scroll-mt-24 flex-col gap-3">
      <p className="m-0 flex flex-wrap items-center gap-2 text-small text-ink">
        {isPublic ? (
          <>
            <PublicBadge visibility="public" />
            {t("effectivePublic")}
          </>
        ) : (
          t("effectiveMembers")
        )}
      </p>
      {saved ? (
        <p
          role="status"
          className="m-0 rounded-sm bg-sunken px-3 py-2 text-small text-ink"
        >
          {t("saved")}
        </p>
      ) : null}
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <form action={formAction} noValidate className="flex flex-col gap-3">
        <VisibilityField
          name="visibility"
          kind="post"
          value={state.values.visibility ?? visibility}
          error={message(state.errors.visibility)}
          probation={probation ?? null}
        />
        <p className="m-0 text-small text-ink-muted">{t("changeAnyTime")}</p>
        {postKind === "update" ? (
          <p className="m-0 text-small text-ink-muted">{t("channelNote")}</p>
        ) : null}
        <div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            busy={pending}
            busyLabel={tForms("saving")}
          >
            {tForms("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
