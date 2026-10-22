import { useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";
import { SelectField } from "./form-field";
import { ProbationNotice, type ProbationView } from "./probation-notice";

type ItemVisibility = components["schemas"]["ItemVisibility"];

const OPTIONS = ["inherit", "members", "public"] as const satisfies readonly ItemVisibility[];

export function VisibilityField({
  name,
  value,
  kind,
  error,
  probation,
}: {
  name: string;
  value?: string;
  kind: "post" | "case";
  error?: string;
  probation?: ProbationView | null;
}) {
  const t = useTranslations("Visibility");
  const current = OPTIONS.find((option) => option === value) ?? "inherit";
  const id = `${kind}-visibility`;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SelectField
        key={`${name}-${current}`}
        id={id}
        name={name}
        label={t(kind === "post" ? "postLabel" : "caseLabel")}
        defaultValue={current}
        error={error}
        aria-describedby={`${id}-options ${id}-note${probation ? ` ${id}-probation` : ""}`}
      >
        {OPTIONS.map((option) => (
          // A selected option that is disabled is never submitted, so an item that is
          // already public keeps its value.
          <option key={option} value={option} disabled={probation && option === "public" && current !== "public" ? true : undefined}>
            {t(option)}
          </option>
        ))}
      </SelectField>
      <ul id={`${id}-options`} className="m-0 flex list-none flex-col gap-2 p-0">
        {OPTIONS.map((option) => (
          <li key={option}>
            <span className="block text-small font-semibold text-ink">{t(option)}</span>
            <span className="block text-small text-ink-muted">{t(`${option}Hint`)}</span>
          </li>
        ))}
      </ul>
      <p id={`${id}-note`} className="m-0 text-small text-ink-muted">
        {t("feedbackNote")}
      </p>
      {probation ? <ProbationNotice id={`${id}-probation`} probation={probation} /> : null}
    </div>
  );
}
