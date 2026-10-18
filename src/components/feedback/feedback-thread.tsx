import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { components } from "@/lib/api/schema";
import { StateMessage } from "../ui/state-message";

type FeedbackItem = components["schemas"]["FeedbackItem"];

export type ThreadTab = "all" | "awaiting" | "answered";

const TABS: readonly ThreadTab[] = ["all", "awaiting", "answered"];

const TAB_LABEL = {
  all: "tabAll",
  awaiting: "tabAwaiting",
  answered: "tabAnswered",
} as const;

const EMPTY_MESSAGE = {
  all: "emptyAll",
  awaiting: "emptyAwaiting",
  answered: "emptyAnswered",
} as const;

// A post's feedback in the platform's order, filtered by tab. Nothing here is
// counted: the tabs and the list say how they are ordered, never how many.
export function FeedbackThread({
  items,
  tab,
  tabHref,
  renderItem,
}: {
  items: FeedbackItem[];
  tab: ThreadTab;
  tabHref: (tab: ThreadTab) => string;
  renderItem: (item: FeedbackItem) => ReactNode;
}) {
  const t = useTranslations("Feedback");
  const shown =
    tab === "all"
      ? items
      : items.filter((item) => item.responseState.state === tab);

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-title-2 text-ink">{t("title")}</h2>
        <p className="m-0 text-small text-ink-muted">{t("order")}</p>
      </div>
      <nav aria-label={t("tabsLabel")}>
        <ul className="m-0 flex list-none flex-wrap gap-4 border-b border-rule p-0">
          {TABS.map((name) => {
            const isCurrent = name === tab;

            return (
              <li key={name}>
                <Link
                  href={tabHref(name)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 py-2 no-underline hover:text-ink ${
                    isCurrent
                      ? "border-brand font-semibold text-ink"
                      : "border-transparent font-medium text-ink-muted"
                  }`}
                >
                  {t(TAB_LABEL[name])}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {shown.length === 0 ? (
        <StateMessage kind="empty" title={t(EMPTY_MESSAGE[tab])} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {shown.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
