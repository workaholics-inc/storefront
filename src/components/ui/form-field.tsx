import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon } from "./icon";

export type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
};

const CONTROL = [
  "box-border w-full rounded-sm border bg-sheet px-3 py-2 text-start text-body text-ink",
  "placeholder:text-ink-muted placeholder:opacity-100",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:border-rule disabled:bg-sunken disabled:text-ink-muted",
].join(" ");

function controlClasses(size: string, error: string | undefined, className?: string) {
  const border = error
    ? "border-danger"
    : "border-rule-strong focus-visible:border-focus";
  return [CONTROL, size, border, className].filter(Boolean).join(" ");
}

function describedBy(
  { id, hint, error }: Pick<FieldProps, "id" | "hint" | "error">,
  extra?: string,
) {
  return (
    [extra, hint && `${id}-hint`, error && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

function Shell({
  id,
  label,
  hint,
  error,
  optionalLabel,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {optionalLabel ? (
          <span className="ms-1 font-normal text-ink-muted">{optionalLabel}</span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="m-0 flex items-start gap-1 text-small text-danger">
          <Icon name="circle-alert" size={16} className="mt-[0.2em] shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  "aria-describedby": extraDescribedBy,
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      <input
        {...rest}
        id={id}
        aria-describedby={describedBy({ id, hint, error }, extraDescribedBy)}
        aria-invalid={error ? "true" : undefined}
        className={controlClasses("h-11", error, className)}
      />
    </Shell>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  "aria-describedby": extraDescribedBy,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      <textarea
        {...rest}
        id={id}
        aria-describedby={describedBy({ id, hint, error }, extraDescribedBy)}
        aria-invalid={error ? "true" : undefined}
        className={controlClasses("min-h-30 resize-y", error, className)}
      />
    </Shell>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  "aria-describedby": extraDescribedBy,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      <select
        {...rest}
        id={id}
        aria-describedby={describedBy({ id, hint, error }, extraDescribedBy)}
        aria-invalid={error ? "true" : undefined}
        className={controlClasses("h-11", error, className)}
      />
    </Shell>
  );
}
