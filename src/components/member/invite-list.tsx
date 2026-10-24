import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { MemberLink, isFormerMember, memberName } from "./member-name";

type Invite = components["schemas"]["MyInvite"];

const BADGE = "inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-label";
const STATUS_CLASS: Record<Invite["status"], string> = {
  open: `${BADGE} bg-brand-soft text-link`,
  redeemed: `${BADGE} border border-rule text-ink-muted`,
  expired: `${BADGE} border border-rule text-ink-muted`,
  revoked: `${BADGE} border border-rule text-ink-muted`,
};

// The invites a member made, newest first as the platform sends them. An
// invite never shows its code, and nothing here counts them.
export function InviteList({
  invites,
  locale,
  revoke,
}: {
  invites: Invite[];
  locale: Locale;
  revoke: Record<string, ReactNode>;
}) {
  const t = useTranslations("Invites");
  const f = useTranslations("Feedback");

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {invites.map((invite) => {
        const invitee = invite.invitee;

        return (
          <li
            key={invite.id}
            className="flex flex-col gap-2 rounded-md border border-rule bg-sheet p-4 sm:p-5"
          >
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-muted">
              <span className={STATUS_CLASS[invite.status]}>{t(`status.${invite.status}`)}</span>
              <span>{t("createdOn", { date: formatDate(invite.createdAt, locale) })}</span>
              {invite.status === "open" ? (
                <span>{t("validUntil", { date: formatDate(invite.expiresAt, locale) })}</span>
              ) : null}
            </p>
            {invite.status === "redeemed" && invitee ? (
              <p className="m-0 text-ink">
                {t.rich("joined", {
                  name: memberName(invitee, f, "start"),
                  n: (chunks) =>
                    isFormerMember(invitee) ? (
                      chunks
                    ) : (
                      <MemberLink
                        member={invitee}
                        className="font-semibold text-ink no-underline hover:underline"
                      />
                    ),
                })}
              </p>
            ) : null}
            {invite.status === "open" ? revoke[invite.id] : null}
          </li>
        );
      })}
    </ul>
  );
}
