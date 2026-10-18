import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { buttonClasses } from "../ui/button";
import { Icon } from "../ui/icon";

type Member = components["schemas"]["Member"];

// The translated sentence with the inviter's name inside it; the name becomes
// a link and the rest stays text, whatever order the language puts them in.
function splitAround(text: string, name: string): [string, string] {
  const at = text.indexOf(name);
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + name.length)];
}

export function MemberHead({
  member,
  locale,
  isSelf,
}: {
  member: Member;
  locale: Locale;
  isSelf: boolean;
}) {
  const t = useTranslations("Profile");
  const initial = Array.from(member.displayName.trim())[0] ?? "";
  const inviter = member.invitedBy;
  const [before, after] = inviter
    ? splitAround(t("invitedBy", { name: inviter.displayName }), inviter.displayName)
    : ["", ""];

  return (
    <div className="flex items-start gap-5">
      <span
        aria-hidden="true"
        className="inline-grid size-[4.5rem] flex-none place-items-center rounded-full bg-sunken text-title-2 font-bold text-ink"
      >
        {initial}
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="m-0 text-title-1 text-ink">
          <bdi>{member.displayName}</bdi>
        </h1>
        <p className="m-0 text-small text-ink-muted">
          <bdi dir="ltr">@{member.handle}</bdi>
        </p>
        {member.bio ? (
          <p className="m-0 max-w-read whitespace-pre-line text-body text-ink">
            {member.bio}
          </p>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-2 text-small text-ink-muted">
          <span>{t("joined", { date: formatDate(member.joinedAt, locale) })}</span>
          <span aria-hidden="true">·</span>
          {inviter ? (
            <span>
              {before}
              <Link
                href={`/members/${encodeURIComponent(inviter.handle)}`}
                className="font-semibold text-ink no-underline hover:underline"
              >
                <bdi>{inviter.displayName}</bdi>
              </Link>
              {after}
            </span>
          ) : (
            <span>{t("founding")}</span>
          )}
        </div>
        {member.links.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
            {member.links.map((link) => (
              <li key={`${link.label}\n${link.url}`}>
                <a
                  href={link.url}
                  rel="nofollow ugc noopener"
                  className="inline-flex items-center gap-1 text-small font-medium text-link"
                >
                  <bdi>{link.label}</bdi>
                  <Icon name="external-link" size={16} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {isSelf ? (
          <div>
            <Link
              href="/me/edit"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("edit")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
