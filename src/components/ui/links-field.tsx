import { useTranslations } from "next-intl";
import type { FieldError } from "@/lib/form-state";
import { TextField } from "./form-field";

export type LinkRow = { label: string; url: string };

export type LinksFieldProps = {
  links: LinkRow[];
  errors: Record<string, FieldError>;
  idPrefix: string;
  max: number;
};

export function LinksField({ links, errors, idPrefix, max }: LinksFieldProps) {
  const t = useTranslations("Links");
  const tErrors = useTranslations("Forms.errors");

  const message = (error: FieldError | undefined) =>
    error ? tErrors(error.key, { max: error.max ?? 0, min: error.min ?? 0 }) : undefined;

  const hintId = `${idPrefix}-hint`;

  return (
    <fieldset
      aria-describedby={hintId}
      className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
    >
      <legend className="p-0 text-label text-ink">{t("legend")}</legend>
      <p id={hintId} className="m-0 text-small text-ink-muted">
        {t("hint", { max })}
      </p>
      {Array.from({ length: max }, (_, i) => {
        const row = links[i];
        const label = row?.label ?? "";
        const url = row?.url ?? "";
        // A half-filled row has one error for the row; show it on the empty field.
        const rowError = message(errors[`links.${i}`]);
        const labelError =
          message(errors[`links.${i}.label`]) ?? (label === "" ? rowError : undefined);
        const urlError =
          message(errors[`links.${i}.url`]) ??
          (label !== "" && url === "" ? rowError : undefined);

        return (
          <div
            key={i}
            className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
          >
            <TextField
              id={`${idPrefix}-${i}-label`}
              name={`links.${i}.label`}
              label={t("label", { n: i + 1 })}
              defaultValue={label}
              error={labelError}
            />
            <TextField
              id={`${idPrefix}-${i}-url`}
              name={`links.${i}.url`}
              label={t("url", { n: i + 1 })}
              type="url"
              dir="ltr"
              inputMode="url"
              defaultValue={url}
              error={urlError}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
