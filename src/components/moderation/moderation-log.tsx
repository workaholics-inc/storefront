import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";

type Entry = components["schemas"]["ModerationLogEntry"];

const ACTOR = { admin: "actorAdmin", moderator: "actorModerator" } as const;
const ROLE = { admin: "roleAdmin", moderator: "roleModerator" } as const;
const ITEM = {
  post: "itemPost",
  feedback: "itemFeedback",
  reply: "itemReply",
} as const;

// What the moderators did, newest first as the platform sends it. An entry
// names the role that acted and never a person.
export function ModerationLog({
  entries,
  locale,
}: {
  entries: Entry[];
  locale: Locale;
}) {
  const t = useTranslations("ModerationLog");
  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

  const sentence = (entry: Entry): string | null => {
    if (entry.action === "role_granted" || entry.action === "role_revoked") {
      const key = entry.action === "role_granted" ? "roleGranted" : "roleRevoked";

      return t(key, { role: t(ROLE[entry.role]) });
    }
    // A hide or a restore always has an item; a role target cannot occur here.
    if (entry.targetKind === "role") return null;

    return t(entry.action, {
      actor: t(ACTOR[entry.role]),
      item: t(ITEM[entry.targetKind]),
    });
  };

  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {entries.map((entry) => {
        const text = sentence(entry);
        if (text === null) return null;

        return (
          <li
            key={entry.id}
            className="flex flex-col gap-1 rounded-md border border-rule bg-sheet p-4 sm:p-5"
          >
            <p className="m-0 text-ink">{text}</p>
            {entry.reason !== "" ? (
              <p className="m-0 max-w-read text-small text-ink">
                {t.rich("reason", { reason: entry.reason, n: bdi })}
              </p>
            ) : null}
            <p className="m-0 flex flex-wrap gap-x-3 text-small text-ink-muted">
              {entry.project ? (
                <Link href={`/projects/${encodeURIComponent(entry.project.slug)}`}>
                  {t.rich("onProject", { project: entry.project.name, n: bdi })}
                </Link>
              ) : null}
              <span>{formatDate(entry.at, locale)}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
