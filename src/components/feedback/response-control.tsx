"use client";

import { useActionState, useState } from "react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { partsOf, type RecheckChoices } from "@/lib/recheck";
import { Button } from "../ui/button";
import { SelectField, TextAreaField } from "../ui/form-field";
import { Icon } from "../ui/icon";
import { StateMessage } from "../ui/state-message";

export type ResponseInitial = {
  status: "accepted" | "rejected" | "testing";
  reason: string;
  recheckOn: string | null;
};

// The order is fixed and nothing is preselected: an answer is chosen, never
// defaulted. Each option keeps the colour of the tag it produces.
const STATUSES = [
  {
    option: "accepted",
    icon: "circle-check",
    meaning: "acceptedMeaning",
    tone: "text-accepted",
  },
  {
    option: "rejected",
    icon: "circle-minus",
    meaning: "rejectedMeaning",
    tone: "text-rejected",
  },
  {
    option: "testing",
    icon: "flask-conical",
    meaning: "testingMeaning",
    tone: "text-testing",
  },
] as const;

const TILE = [
  "flex cursor-pointer items-start gap-3 rounded-md border-2 border-rule bg-sheet p-3",
  "has-checked:border-brand has-checked:bg-brand-soft",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
].join(" ");

const RADIO = "mt-1 size-4 shrink-0 accent-brand";
const LEGEND = "p-0 text-label text-ink";
const GROUP = "m-0 flex min-w-0 flex-col gap-3 border-0 p-0";

function FieldMessage({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="m-0 flex items-start gap-1 text-small text-danger">
      <Icon name="circle-alert" size={16} className="mt-[0.2em] shrink-0" />
      <span>{message}</span>
    </p>
  );
}

// The owner's answer to one piece of feedback: accepted, rejected or testing,
// a reason, and for testing the date they will report back.
export function ResponseControl({
  idPrefix,
  action,
  giverName,
  choices,
  reasonMax,
  initial,
}: {
  idPrefix: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  giverName: string;
  choices: RecheckChoices;
  reasonMax: number;
  initial?: ResponseInitial;
}) {
  const t = useTranslations("Answer");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const current = useLocale();
  const locale = hasLocale(routing.locales, current)
    ? current
    : routing.defaultLocale;
  const [state, formAction, pending] = useActionState(action, initialFormState);

  // What the form starts from: the answer being edited, whose date is read in
  // the member's calendar and shown under "another date".
  const parts = initial?.recheckOn ? partsOf(initial.recheckOn, locale) : null;
  const seed: Record<string, string> = {
    status: initial?.status ?? "",
    reason: initial?.reason ?? "",
    recheckPick: parts ? "other" : "",
    recheckDay: parts ? String(parts.day) : "",
    recheckMonth: parts ? String(parts.month) : "",
    recheckYear: parts ? String(parts.year) : "",
  };
  const submitted = Object.keys(state.values).length > 0;
  const value = (name: string) =>
    (submitted ? state.values[name] : seed[name]) ?? "";
  const message = (error: FieldError | undefined) =>
    error
      ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 })
      : undefined;

  // The two choices that decide what else is shown. The radios stay
  // uncontrolled (so the form resets to them after an action); these only
  // follow what the member picked.
  const [status, setStatus] = useState(value("status"));
  const [pick, setPick] = useState(value("recheckPick"));

  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const statusError = message(state.errors.status);
  const recheckError = message(state.errors.recheckOn);
  const hintId = `${idPrefix}-reason-hint`;

  return (
    <form action={formAction} noValidate className="flex max-w-read flex-col gap-6">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}

      <fieldset
        role="radiogroup"
        aria-describedby={statusError ? `${idPrefix}-status-error` : undefined}
        aria-invalid={statusError ? "true" : undefined}
        className={GROUP}
      >
        <legend className={LEGEND}>{t("legend")}</legend>
        {STATUSES.map(({ option, icon, meaning, tone }) => {
          const id = `${idPrefix}-status-${option}`;

          return (
            <label key={option} htmlFor={id} className={TILE}>
              <input
                type="radio"
                id={id}
                name="status"
                value={option}
                defaultChecked={status === option}
                onChange={() => setStatus(option)}
                className={RADIO}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="inline-flex items-center gap-2 text-body-strong text-ink">
                  <Icon name={icon} size={16} className={tone} />
                  {t(option)}
                </span>
                <span className="text-small text-ink-muted">{t(meaning)}</span>
              </span>
            </label>
          );
        })}
        <FieldMessage id={`${idPrefix}-status-error`} message={statusError} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <p id={hintId} className="m-0 text-small text-ink-muted">
          {t.rich("reasonHint", {
            name: giverName,
            n: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
        <TextAreaField
          id={`${idPrefix}-reason`}
          name="reason"
          label={t("reason")}
          aria-describedby={hintId}
          maxLength={reasonMax}
          defaultValue={value("reason")}
          error={message(state.errors.reason)}
        />
      </div>

      {status === "testing" ? (
        <fieldset
          aria-describedby={recheckError ? `${idPrefix}-recheck-error` : undefined}
          className={GROUP}
        >
          <legend className={LEGEND}>{t("recheck")}</legend>
          {[
            ...choices.quick.map(({ pick: key, iso }) => ({
              key,
              value: iso,
              label: t(key, { date: formatDate(iso, locale) }),
            })),
            { key: "other", value: "other", label: t("other") },
          ].map((choice) => {
            const id = `${idPrefix}-pick-${choice.key}`;

            return (
              <label key={choice.key} htmlFor={id} className={TILE}>
                <input
                  type="radio"
                  id={id}
                  name="recheckPick"
                  value={choice.value}
                  defaultChecked={pick === choice.value}
                  onChange={() => setPick(choice.value)}
                  className={RADIO}
                />
                <span className="text-body text-ink">{choice.label}</span>
              </label>
            );
          })}
          {pick === "other" ? (
            <div className="grid grid-cols-3 gap-3">
              {/* A select ignores a defaultValue that changes after its first
                  render, and React resets the form after the action: remount
                  each one to keep the submitted choice. */}
              <SelectField
                key={`day-${value("recheckDay")}`}
                id={`${idPrefix}-day`}
                name="recheckDay"
                label={t("day")}
                defaultValue={value("recheckDay")}
              >
                <option value="">—</option>
                {choices.days.map((day) => (
                  <option key={day} value={String(day)}>
                    {number.format(day)}
                  </option>
                ))}
              </SelectField>
              <SelectField
                key={`month-${value("recheckMonth")}`}
                id={`${idPrefix}-month`}
                name="recheckMonth"
                label={t("monthField")}
                defaultValue={value("recheckMonth")}
              >
                <option value="">—</option>
                {choices.months.map((month) => (
                  <option key={month.value} value={String(month.value)}>
                    {month.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                key={`year-${value("recheckYear")}`}
                id={`${idPrefix}-year`}
                name="recheckYear"
                label={t("year")}
                defaultValue={value("recheckYear")}
              >
                <option value="">—</option>
                {choices.years.map((year) => (
                  <option key={year} value={String(year)}>
                    {number.format(year)}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}
          <FieldMessage id={`${idPrefix}-recheck-error`} message={recheckError} />
        </fieldset>
      ) : null}

      <div>
        <Button
          type="submit"
          variant="primary"
          disabled={status === ""}
          busy={pending}
          busyLabel={t("submitting")}
        >
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
