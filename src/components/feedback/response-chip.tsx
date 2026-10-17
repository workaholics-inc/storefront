import { useFormatter, useTranslations } from "next-intl";
import { Icon, type IconName } from "../ui/icon";

export type ResponseChipProps =
  | { kind: "awaiting" }
  | { kind: "overdue"; days: number }
  | { kind: "answered"; days: number }
  | { kind: "accepted" }
  | { kind: "rejected" }
  | { kind: "testing"; recheckOn: string }
  | { kind: "has-unanswered" };

const ICONS: Record<ResponseChipProps["kind"], IconName> = {
  awaiting: "circle-dashed",
  overdue: "clock-alert",
  answered: "rotate-ccw-clock",
  accepted: "circle-check",
  rejected: "circle-minus",
  testing: "flask-conical",
  "has-unanswered": "circle-dashed",
};

const FILLS: Record<ResponseChipProps["kind"], string> = {
  awaiting: "bg-marker text-marker-ink px-2",
  "has-unanswered": "bg-marker text-marker-ink px-2",
  overdue: "bg-marker-strong text-marker-strong-ink px-2",
  answered: "text-ink-muted font-normal px-0",
  accepted: "bg-accepted-soft text-accepted px-2",
  rejected: "bg-rejected-soft text-rejected px-2",
  testing: "bg-testing-soft text-testing px-2",
};

export function ResponseChip(props: ResponseChipProps) {
  const t = useTranslations("ResponseChip");
  const format = useFormatter();

  let text: string;
  switch (props.kind) {
    case "awaiting":
      text = t("awaiting");
      break;
    case "has-unanswered":
      text = t("hasUnanswered");
      break;
    case "overdue":
      text = t("overdue", { days: props.days });
      break;
    case "answered":
      text =
        props.days === 0
          ? t("answeredSameDay")
          : t("answered", { days: props.days });
      break;
    case "accepted":
      text = t("accepted");
      break;
    case "rejected":
      text = t("rejected");
      break;
    case "testing":
      text = t("testing", {
        date: format.dateTime(new Date(props.recheckOn), {
          day: "numeric",
          month: "long",
          timeZone: "Asia/Tehran",
        }),
      });
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm py-0.5 text-label ${FILLS[props.kind]}`}
    >
      <Icon name={ICONS[props.kind]} size={16} />
      {text}
    </span>
  );
}
