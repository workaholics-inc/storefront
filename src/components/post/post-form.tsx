"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import { Button } from "../ui/button";
import { TextAreaField, TextField } from "../ui/form-field";
import { Icon } from "../ui/icon";
import { StateMessage } from "../ui/state-message";

type Post = components["schemas"]["Post"];
type Kind = Post["kind"];

export type PostFormLimits = {
  postBodyMax: number;
  questionsMax: number;
  questionMax: number;
  selfCritiqueMax: number;
  whatChangedMax: number;
  actedOnMax: number;
  rejectedAndWhyMax: number;
  oneNumberMax: number;
};

export type ActedOnOption = {
  feedbackId: string;
  excerpt: string;
  authorName: string;
};

const KINDS = [
  { option: "wip", icon: "file-pen-line", hint: "kindWipHint" },
  { option: "update", icon: "file-diff", hint: "kindUpdateHint" },
] as const;

const TILE = [
  "flex cursor-pointer items-start gap-3 rounded-md border-2 border-rule bg-sheet p-3",
  "has-checked:border-brand has-checked:bg-brand-soft",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
].join(" ");

const CONTROL = "mt-1 size-4 shrink-0 accent-brand";
const LEGEND = "p-0 text-label text-ink";
const GROUP = "m-0 flex min-w-0 flex-col gap-3 border-0 p-0";
const HINT = "m-0 text-small text-ink-muted";

// A post on a project: work in progress (up to five questions) or an update
// that follows the template. The same form edits a post within the window the
// platform allows; its kind is then fixed.
export function PostForm({
  action,
  mode,
  limits,
  actedOnOptions,
  initial,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  mode: "create" | "edit";
  limits: PostFormLimits;
  actedOnOptions: ActedOnOption[];
  initial?: Post;
}) {
  const t = useTranslations("Posts");
  const tForms = useTranslations("Forms");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const submitted = Object.keys(state.values).length > 0;
  const value = (name: string, fallback: string) => state.values[name] ?? fallback;
  const message = (error: FieldError | undefined) =>
    error
      ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 })
      : undefined;
  const creating = mode === "create";
  // The radios stay uncontrolled (so the form resets to them after an action);
  // this only follows what was picked, to decide which fields to show.
  const [chosen, setChosen] = useState<Kind>(
    state.values.kind === "update" ? "update" : (initial?.kind ?? "wip"),
  );
  const kind = creating ? chosen : (initial?.kind ?? "wip");
  // After a failed submit the checked ids come back joined by ",".
  const checked = new Set(
    submitted
      ? (state.values.actedOn ?? "").split(",").filter((id) => id !== "")
      : (initial?.actedOn ?? []).map((item) => item.feedbackId),
  );

  return (
    <form action={formAction} noValidate className="flex max-w-read flex-col gap-6">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}

      {creating ? (
        <fieldset className={GROUP}>
          <legend className={LEGEND}>{t("kind")}</legend>
          {KINDS.map(({ option, icon, hint }) => {
            const id = `post-kind-${option}`;

            return (
              <label key={option} htmlFor={id} className={TILE}>
                <input
                  type="radio"
                  id={id}
                  name="kind"
                  value={option}
                  defaultChecked={chosen === option}
                  onChange={() => setChosen(option)}
                  className={CONTROL}
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="inline-flex items-center gap-2 text-body-strong text-ink">
                    <Icon name={icon} size={16} className="text-ink-muted" />
                    {t(option)}
                  </span>
                  <span className="text-small text-ink-muted">{t(hint)}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}

      {kind === "wip" ? (
        <>
          <TextAreaField
            id="post-body"
            name="body"
            label={t("body")}
            maxLength={limits.postBodyMax}
            defaultValue={value("body", initial?.body ?? "")}
            error={message(state.errors.body)}
          />
          <fieldset aria-describedby="post-questions-hint" className={GROUP}>
            <legend className={LEGEND}>{t("feedbackWanted")}</legend>
            <p id="post-questions-hint" className={HINT}>
              {t("questionsHint")}
            </p>
            {Array.from({ length: limits.questionsMax }, (_, index) => (
              <TextField
                key={index}
                id={`post-question-${index}`}
                name={`question${index}`}
                label={t("question", { n: index + 1 })}
                optionalLabel={index === 0 ? undefined : tForms("optional")}
                maxLength={limits.questionMax}
                defaultValue={value(
                  `question${index}`,
                  initial?.feedbackWanted[index] ?? "",
                )}
                error={message(state.errors[`question${index}`])}
              />
            ))}
          </fieldset>
          <TextAreaField
            id="post-self-critique"
            name="selfCritique"
            label={t("selfCritique")}
            optionalLabel={tForms("optional")}
            hint={t("selfCritiqueHint")}
            maxLength={limits.selfCritiqueMax}
            defaultValue={value("selfCritique", initial?.selfCritique ?? "")}
            error={message(state.errors.selfCritique)}
          />
        </>
      ) : (
        <>
          <TextAreaField
            id="post-what-changed"
            name="whatChanged"
            label={t("whatChanged")}
            hint={t("whatChangedHint")}
            maxLength={limits.whatChangedMax}
            defaultValue={value("whatChanged", initial?.whatChanged ?? "")}
            error={message(state.errors.whatChanged)}
          />
          <fieldset aria-describedby="post-acted-on-hint" className={GROUP}>
            <legend className={LEGEND}>{t("actedOn")}</legend>
            <p id="post-acted-on-hint" className={HINT}>
              {t("actedOnHint")}
            </p>
            {actedOnOptions.length === 0 ? (
              <p className="m-0 text-small text-ink-muted">{t("actedOnEmpty")}</p>
            ) : (
              actedOnOptions.map((option) => {
                const id = `post-acted-on-${option.feedbackId}`;

                return (
                  <label key={option.feedbackId} htmlFor={id} className={TILE}>
                    <input
                      type="checkbox"
                      id={id}
                      name="actedOn"
                      value={option.feedbackId}
                      defaultChecked={checked.has(option.feedbackId)}
                      className={CONTROL}
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-body text-ink">
                        <bdi>{option.excerpt}</bdi>
                      </span>
                      <span className="text-small text-ink-muted">
                        <bdi>{option.authorName}</bdi>
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </fieldset>
          <TextAreaField
            id="post-rejected-and-why"
            name="rejectedAndWhy"
            label={t("rejectedAndWhy")}
            optionalLabel={tForms("optional")}
            maxLength={limits.rejectedAndWhyMax}
            defaultValue={value("rejectedAndWhy", initial?.rejectedAndWhy ?? "")}
            error={message(state.errors.rejectedAndWhy)}
          />
          <TextField
            id="post-one-number"
            name="oneNumber"
            label={t("oneNumber")}
            hint={t("oneNumberHint")}
            maxLength={limits.oneNumberMax}
            defaultValue={value("oneNumber", initial?.oneNumber ?? "")}
            error={message(state.errors.oneNumber)}
          />
          <TextAreaField
            id="post-body"
            name="body"
            label={t("bodyUpdate")}
            optionalLabel={tForms("optional")}
            maxLength={limits.postBodyMax}
            defaultValue={value("body", initial?.body ?? "")}
            error={message(state.errors.body)}
          />
        </>
      )}

      <div>
        <Button
          type="submit"
          variant="primary"
          busy={pending}
          busyLabel={creating ? t("publishing") : tForms("saving")}
        >
          {creating ? t("publish") : tForms("save")}
        </Button>
      </div>
    </form>
  );
}
