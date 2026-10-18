import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "md" | "sm";

const BASE = [
  "inline-flex items-center justify-center gap-2 whitespace-nowrap",
  "rounded-sm border cursor-pointer no-underline leading-tight",
  "transition-colors duration-100 ease-in-out",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:border-rule disabled:bg-sunken disabled:text-ink-muted disabled:no-underline",
  "aria-disabled:cursor-not-allowed aria-disabled:border-rule aria-disabled:bg-sunken aria-disabled:text-ink-muted aria-disabled:no-underline",
  "aria-busy:cursor-progress",
].join(" ");

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-brand text-on-brand not-disabled:not-aria-disabled:hover:bg-brand-hover",
  secondary:
    "border-rule-strong bg-sheet text-ink not-disabled:not-aria-disabled:hover:bg-sunken",
  quiet:
    "border-transparent bg-transparent text-link not-disabled:not-aria-disabled:hover:underline not-disabled:not-aria-disabled:hover:underline-offset-[0.25em]",
};

const SIZES: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { md: "h-10 px-4 text-body-strong", sm: "h-8 px-3 text-small font-semibold" },
  secondary: { md: "h-10 px-4 text-body-strong", sm: "h-8 px-3 text-small font-semibold" },
  quiet: { md: "h-10 px-2 text-body-strong", sm: "h-8 px-2 text-small font-semibold" },
};

export function buttonClasses({
  variant = "secondary",
  size = "md",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
} = {}): string {
  return [BASE, VARIANTS[variant], SIZES[variant][size]].join(" ");
}

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  busy?: boolean;
  busyLabel?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant,
  size,
  icon,
  busy = false,
  busyLabel,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [buttonClasses({ variant, size }), className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy ? "true" : undefined}
      className={classes}
    >
      {busy ? (
        <Icon name="rotate-cw" className="motion-safe:animate-spin" />
      ) : icon ? (
        <Icon name={icon} />
      ) : null}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
