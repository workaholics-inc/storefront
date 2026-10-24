import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type MemberNameKey = "unknownMember" | "formerMember" | "formerMemberStart";

// A former member deleted their account: the contract sends an empty
// displayName for them. A name made of spaces is not empty.
export function isFormerMember(member: { displayName: string }): boolean {
  return member.displayName === "";
}

// The one rule for showing a MemberRef's name. `t` is the Feedback translator.
export function memberName(
  member: { displayName: string } | null,
  t: (key: MemberNameKey) => string,
  position: "inline" | "start" = "inline",
): string {
  if (member === null) return t("unknownMember");
  if (isFormerMember(member)) {
    return position === "start" ? t("formerMemberStart") : t("formerMember");
  }
  return member.displayName;
}

export function MemberLink({
  member,
  className,
}: {
  member: { handle: string; displayName: string };
  className?: string;
}) {
  const t = useTranslations("Feedback");

  if (isFormerMember(member)) return <span>{t("formerMember")}</span>;

  return (
    <Link href={`/members/${encodeURIComponent(member.handle)}`} className={className}>
      <bdi>{member.displayName}</bdi>
    </Link>
  );
}
