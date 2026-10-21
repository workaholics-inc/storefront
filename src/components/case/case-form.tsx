"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";
import {
  initialFormState,
  type FieldError,
  type FormState,
} from "@/lib/form-state";
import type { ActedOnOption } from "../post/post-form";
import { Button } from "../ui/button";
import { TextAreaField, TextField } from "../ui/form-field";
import { Icon } from "../ui/icon";
import { StateMessage } from "../ui/state-message";
import { VisibilityField } from "../ui/visibility-field";

type Case = components["schemas"]["Case"];

export type CaseFormLimits = {
  titleMax: number;
  feedbackStoryMax: number;
  changeMax: number;
  resultMax: number;
  oneNumberMax: number;
};

// `date` is formatted on the server, so the client never formats a date
// against its own clock.
export type CasePostOption = {
  postId: string;
  date: string;
  excerpt: string;
};

const TILE = [
  "flex cursor-pointer items-start gap-3 rounded-md border-2 border-rule bg-sheet p-3",
  "has-checked:border-brand has-checked:bg-brand-soft",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
].join(" ");

const CONTROL = "mt-1 size-4 shrink-0 accent-brand";
const LEGEND = "p-0 text-label text-ink";
const GROUP = "m-0 flex min-w-0 flex-col gap-3 border-0 p-0";
const HINT = "m-0 text-small text-ink-muted";

// A case: the answered feedback it started from, what changed and what
// happened. The same form edits a case at any time, so `mode` changes nothing
// the member sees: both modes read "Save case".
export function CaseForm({
  action,
  limits,
  feedbackOptions,
  postOptions,
  initial,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  mode: "create" | "edit";
  limits: CaseFormLimits;
  feedbackOptions: ActedOnOption[];
  postOptions: CasePostOption[];
  initial?: Case;
}) {
  const t = useTranslations("Cases");
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
  // After a failed submit the checked ids come back joined by ",".
  const checkedIds = (name: "feedbackIds" | "postIds", fallback: string[]) =>
    new Set(
      submitted
        ? (state.values[name] ?? "").split(",").filter((id) => id !== "")
        : fallback,
    );
  const checkedFeedback = checkedIds(
    "feedbackIds",
    (initial?.feedback ?? []).map((item) => item.id),
  );
  const checkedPosts = checkedIds(
    "postIds",
    (initial?.posts ?? []).map((post) => post.id),
  );
  const feedbackError = message(state.errors.feedbackIds);

  return (
    <form action={formAction} noValidate className="flex max-w-read flex-col gap-6">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}

      <TextField
        id="case-title"
        name="title"
        label={t("caseTitle")}
        hint={t("caseTitleHint")}
        maxLength={limits.titleMax}
        defaultValue={value("title", initial?.title ?? "")}
        error={message(state.errors.title)}
      />

      <fieldset
        aria-describedby={`case-feedback-hint${feedbackError ? " case-feedback-error" : ""}`}
        className={GROUP}
      >
        <legend className={LEGEND}>{t("feedbackLinked")}</legend>
        <p id="case-feedback-hint" className={HINT}>
          {t("feedbackLinkedHint")}
        </p>
        {feedbackOptions.length === 0 ? (
          <p className="m-0 text-small text-ink-muted">{t("feedbackLinkedEmpty")}</p>
        ) : (
          feedbackOptions.map((option) => {
            const id = `case-feedback-${option.feedbackId}`;

            return (
              <label key={option.feedbackId} htmlFor={id} className={TILE}>
                <input
                  type="checkbox"
                  id={id}
                  name="feedbackIds"
                  value={option.feedbackId}
                  defaultChecked={checkedFeedback.has(option.feedbackId)}
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
        {feedbackError ? (
          <p
            id="case-feedback-error"
            className="m-0 flex items-start gap-1 text-small text-danger"
          >
            <Icon name="circle-alert" size={16} className="mt-[0.2em] shrink-0" />
            <span>{feedbackError}</span>
          </p>
        ) : null}
        <p className={HINT}>{t("creditNote")}</p>
      </fieldset>

      <TextAreaField
        id="case-feedback-story"
        name="feedbackStory"
        label={t("feedbackStory")}
        hint={t("feedbackStoryHint")}
        maxLength={limits.feedbackStoryMax}
        defaultValue={value("feedbackStory", initial?.feedbackStory ?? "")}
        error={message(state.errors.feedbackStory)}
      />
      <TextAreaField
        id="case-change"
        name="change"
        label={t("change")}
        hint={t("changeHint")}
        maxLength={limits.changeMax}
        defaultValue={value("change", initial?.change ?? "")}
        error={message(state.errors.change)}
      />
      <TextAreaField
        id="case-result"
        name="result"
        label={t("result")}
        hint={t("resultHint")}
        maxLength={limits.resultMax}
        defaultValue={value("result", initial?.result ?? "")}
        error={message(state.errors.result)}
      />
      <TextField
        id="case-one-number"
        name="oneNumber"
        label={t("oneNumber")}
        optionalLabel={tForms("optional")}
        hint={t("oneNumberHint")}
        maxLength={limits.oneNumberMax}
        defaultValue={value("oneNumber", initial?.oneNumber ?? "")}
        error={message(state.errors.oneNumber)}
      />

      <fieldset aria-describedby="case-posts-hint" className={GROUP}>
        <legend className={LEGEND}>
          {t("postsLinked")}
          <span className="ms-1 font-normal text-ink-muted">{tForms("optional")}</span>
        </legend>
        <p id="case-posts-hint" className={HINT}>
          {t("postsLinkedHint")}
        </p>
        {postOptions.length === 0 ? (
          <p className="m-0 text-small text-ink-muted">{t("postsLinkedEmpty")}</p>
        ) : (
          postOptions.map((option) => {
            const id = `case-post-${option.postId}`;

            return (
              <label key={option.postId} htmlFor={id} className={TILE}>
                <input
                  type="checkbox"
                  id={id}
                  name="postIds"
                  value={option.postId}
                  defaultChecked={checkedPosts.has(option.postId)}
                  className={CONTROL}
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-body-strong text-ink">
                    {t("update", { date: option.date })}
                  </span>
                  <span className="text-small text-ink-muted">
                    <bdi>{option.excerpt}</bdi>
                  </span>
                </span>
              </label>
            );
          })
        )}
      </fieldset>

      <VisibilityField
        name="visibility"
        kind="case"
        value={value("visibility", initial?.visibility ?? "inherit")}
        error={message(state.errors.visibility)}
      />

      <div>
        <Button type="submit" variant="primary" busy={pending} busyLabel={t("saving")}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
