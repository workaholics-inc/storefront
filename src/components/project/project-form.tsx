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
import { SelectField, TextField } from "../ui/form-field";
import { LinksField, type LinkRow } from "../ui/links-field";
import { StateMessage } from "../ui/state-message";

type Project = components["schemas"]["Project"];

const STAGES = ["idea", "building", "launched"] as const;
const VISIBILITIES = ["members", "public"] as const;

function linksFromValues(values: Record<string, string>, max: number): LinkRow[] {
  return Array.from({ length: max }, (_, i) => ({
    label: values[`links.${i}.label`] ?? "",
    url: values[`links.${i}.url`] ?? "",
  }));
}

export function ProjectForm({
  mode,
  project,
  linksMax,
  action,
}: {
  mode: "create" | "update";
  project?: Project;
  linksMax: number;
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const t = useTranslations("Projects");
  const tForms = useTranslations("Forms");
  const tErrors = useTranslations("Forms.errors");
  const tMessages = useTranslations("Errors");
  const tBadge = useTranslations("PublicBadge");
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const submitted = Object.keys(state.values).length > 0;
  const value = (name: string, fallback: string) => state.values[name] ?? fallback;
  const message = (error: FieldError | undefined) =>
    error ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 }) : undefined;
  const links = submitted
    ? linksFromValues(state.values, linksMax)
    : (project?.links ?? []);
  const creating = mode === "create";

  return (
    <form action={formAction} noValidate className="flex max-w-read flex-col gap-6">
      {state.formError ? (
        <StateMessage kind="error" title={tMessages(state.formError)} />
      ) : null}
      <TextField
        id="project-name"
        name="name"
        label={t("name")}
        defaultValue={value("name", project?.name ?? "")}
        error={message(state.errors.name)}
      />
      {creating ? (
        <TextField
          id="project-slug"
          name="slug"
          label={t("slug")}
          hint={t("slugHint")}
          dir="ltr"
          autoComplete="off"
          defaultValue={value("slug", "")}
          error={message(state.errors.slug)}
        />
      ) : null}
      <TextField
        id="project-one-liner"
        name="oneLiner"
        label={t("oneLiner")}
        optionalLabel={tForms("optional")}
        defaultValue={value("oneLiner", project?.oneLiner ?? "")}
        error={message(state.errors.oneLiner)}
      />
      <SelectField
        id="project-stage"
        name="stage"
        label={t("stage")}
        defaultValue={value("stage", project?.stage ?? "idea")}
        error={message(state.errors.stage)}
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {t(`stages.${stage}`)}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="project-visibility"
        name="visibility"
        label={t("visibility")}
        hint={t("visibilityHint")}
        defaultValue={value("visibility", project?.visibility ?? "members")}
        error={message(state.errors.visibility)}
      >
        {VISIBILITIES.map((visibility) => (
          <option key={visibility} value={visibility}>
            {tBadge(visibility)}
          </option>
        ))}
      </SelectField>
      <LinksField
        links={links}
        errors={state.errors}
        idPrefix="project-links"
        max={linksMax}
      />
      <div>
        <Button
          type="submit"
          variant="primary"
          busy={pending}
          busyLabel={creating ? t("creating") : tForms("saving")}
        >
          {creating ? t("create") : tForms("save")}
        </Button>
      </div>
    </form>
  );
}
