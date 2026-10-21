"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";
import { initialFormState, type FormState } from "@/lib/form-state";
import { Button } from "../ui/button";
import { StateMessage } from "../ui/state-message";

type Consent = NonNullable<components["schemas"]["Case"]["myConsent"]>;

const STATE = {
  pending: "statePending",
  given: "stateGiven",
  declined: "stateDeclined",
} as const;

// A member credited in a case chooses, at any time, whether the case names
// them. Two submit buttons and no fields: the pressed button's value is the choice.
export function CreditConsent({
  action,
  consent,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  consent: Consent;
}) {
  const t = useTranslations("Credits");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <section aria-labelledby="credit-consent-title" className="flex flex-col gap-3">
      <h2 id="credit-consent-title" className="m-0 text-label font-bold text-ink-muted">
        {t("consentTitle")}
      </h2>
      <p className="m-0 max-w-read">{t("consentBody")}</p>
      <p className="m-0 text-body-strong text-ink">{t(STATE[consent])}</p>
      <form action={formAction} className="flex flex-col gap-3">
        {state.formError ? (
          <StateMessage kind="error" title={tMessages(state.formError)} />
        ) : null}
        <div className="flex flex-wrap gap-3">
          {consent !== "given" ? (
            <Button
              type="submit"
              variant="secondary"
              name="consent"
              value="given"
              disabled={pending}
            >
              {t("give")}
            </Button>
          ) : null}
          {consent !== "declined" ? (
            <Button
              type="submit"
              variant="secondary"
              name="consent"
              value="declined"
              disabled={pending}
            >
              {t("decline")}
            </Button>
          ) : null}
        </div>
        <p className="m-0 text-small text-ink-muted">{t("changeAnyTime")}</p>
      </form>
    </section>
  );
}
