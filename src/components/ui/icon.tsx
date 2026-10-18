import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  ClockAlert,
  CloudOff,
  Eye,
  ExternalLink,
  FileDiff,
  FilePenLine,
  FlaskConical,
  Inbox,
  KeyRound,
  Languages,
  Lock,
  LogIn,
  Menu,
  MessageSquareText,
  Plus,
  Reply,
  RotateCcwClock,
  RotateCw,
  ScrollText,
  Send,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

export const ICON_NAMES = [
  "circle-dashed",
  "clock-alert",
  "rotate-ccw-clock",
  "circle-check",
  "circle-minus",
  "flask-conical",
  "eye",
  "lock",
  "calendar",
  "file-pen-line",
  "file-diff",
  "message-square-text",
  "reply",
  "plus",
  "log-in",
  "send",
  "key-round",
  "languages",
  "menu",
  "x",
  "chevron-down",
  "arrow-left",
  "arrow-right",
  "external-link",
  "rotate-cw",
  "inbox",
  "circle-alert",
  "cloud-off",
  "user",
  "users",
  "scroll-text",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const MIRRORED_ICONS: ReadonlySet<IconName> = new Set<IconName>([
  "reply",
  "log-in",
  "send",
  "arrow-left",
  "arrow-right",
  "external-link",
]);

const ICONS: Record<IconName, LucideIcon> = {
  "circle-dashed": CircleDashed,
  "clock-alert": ClockAlert,
  "rotate-ccw-clock": RotateCcwClock,
  "circle-check": CircleCheck,
  "circle-minus": CircleMinus,
  "flask-conical": FlaskConical,
  eye: Eye,
  lock: Lock,
  calendar: Calendar,
  "file-pen-line": FilePenLine,
  "file-diff": FileDiff,
  "message-square-text": MessageSquareText,
  reply: Reply,
  plus: Plus,
  "log-in": LogIn,
  send: Send,
  "key-round": KeyRound,
  languages: Languages,
  menu: Menu,
  x: X,
  "chevron-down": ChevronDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "external-link": ExternalLink,
  "rotate-cw": RotateCw,
  inbox: Inbox,
  "circle-alert": CircleAlert,
  "cloud-off": CloudOff,
  user: User,
  users: Users,
  "scroll-text": ScrollText,
};

export function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName;
  size?: 16 | 20;
  label?: string;
  className?: string;
}) {
  const Component = ICONS[name];
  const classes = [className, MIRRORED_ICONS.has(name) && "rtl:-scale-x-100"]
    .filter(Boolean)
    .join(" ");

  return (
    <Component
      size={size}
      strokeWidth={2}
      className={classes || undefined}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    />
  );
}
