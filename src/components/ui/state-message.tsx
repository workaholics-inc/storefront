import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type StateMessageProps = {
  kind: "empty" | "error" | "unreachable" | "members-only";
  title?: string;
  body?: string;
  code?: string;
  action?: ReactNode;
  icon?: IconName;
};

const FRAME: Record<StateMessageProps["kind"], string> = {
  empty: "border-dashed border-rule-strong bg-paper",
  error: "border-solid border-danger bg-danger-soft",
  unreachable: "border-solid border-rule-strong bg-sheet",
  "members-only": "border-solid border-rule bg-paper",
};

const ICON_BOX: Record<StateMessageProps["kind"], string> = {
  empty: "bg-sunken text-ink-muted",
  error: "bg-sheet text-danger",
  unreachable: "bg-sunken text-ink-muted",
  "members-only": "bg-sunken text-ink-muted",
};

const DEFAULT_ICON: Record<StateMessageProps["kind"], IconName> = {
  empty: "inbox",
  error: "circle-alert",
  unreachable: "cloud-off",
  "members-only": "lock",
};

export function StateMessage({
  kind,
  title,
  body,
  code,
  action,
  icon,
}: StateMessageProps) {
  const t = useTranslations("State");

  const defaults =
    kind === "unreachable"
      ? { title: t("unreachableTitle"), body: t("unreachableBody") }
      : kind === "error"
        ? { title: t("errorTitle"), body: t("errorBody") }
        : { title: undefined, body: undefined };
  const shownTitle = title ?? defaults.title;
  const shownBody = body ?? defaults.body;

  return (
    <div
      className={`flex min-w-0 flex-col items-start gap-3 rounded-md border p-4 sm:flex-row sm:gap-4 sm:p-6 ${FRAME[kind]}`}
    >
      <div
        className={`grid size-11 shrink-0 place-items-center rounded-sm ${ICON_BOX[kind]}`}
      >
        <Icon name={icon ?? DEFAULT_ICON[kind]} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {shownTitle ? (
          <h3 className="m-0 text-title-3 text-ink">{shownTitle}</h3>
        ) : null}
        {shownBody ? (
          <p className="m-0 max-w-[36rem] text-ink">{shownBody}</p>
        ) : null}
        {kind === "error" && code ? (
          <p
            dir="ltr"
            className="m-0 font-mono text-small text-ink-muted [unicode-bidi:isolate]"
          >
            {t("code", { code })}
          </p>
        ) : null}
        {action ? <div className="mt-2 self-start">{action}</div> : null}
      </div>
    </div>
  );
}
