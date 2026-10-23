import { useTranslations } from "next-intl";
import { MemberLink, isFormerMember } from "./member-name";

type Invitee = { handle: string; displayName: string } | null;

// The members this member invited, in the order they joined. The tree is
// visible to members, and nothing on it is counted.
export function InviteeList({
  invitees,
  isSelf,
}: {
  invitees: Invitee[];
  isSelf: boolean;
}) {
  const t = useTranslations("Profile");
  const f = useTranslations("Feedback");

  return (
    <section
      id="invited"
      aria-labelledby="invited-title"
      className="mt-6 flex flex-col gap-2"
    >
      <h2 id="invited-title" className="m-0 text-label font-bold text-ink-muted">
        {isSelf ? t("invitedTitleSelf") : t("invitedTitle")}
      </h2>
      {invitees.length === 0 ? (
        <p className="m-0 text-small">
          {isSelf ? t("invitedEmptySelf") : t("invitedEmpty")}
        </p>
      ) : (
        <>
          <p className="m-0 text-small text-ink-muted">{t("invitedOrder")}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {invitees.map((member, index) => (
              <li key={member?.handle ?? `unknown-${index}`} className="text-small">
                {member === null ? (
                  <span>{f("unknownMember")}</span>
                ) : isFormerMember(member) ? (
                  <span>{f("formerMemberStart")}</span>
                ) : (
                  <MemberLink
                    member={member}
                    className="font-semibold text-ink no-underline hover:underline"
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
