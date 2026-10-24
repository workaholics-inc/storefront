import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { HiddenPlaceholder } from "../ui/hidden-placeholder";
import { answerChip, stateChip } from "./chips";
import { ResponseChip } from "./response-chip";

type FeedbackItem = components["schemas"]["FeedbackItem"];

// One piece of feedback in a list: it links to its place in the thread.
export function FeedbackSummary({
  item,
  locale,
  showProject,
}: {
  item: FeedbackItem;
  locale: Locale;
  showProject: boolean;
}) {
  const t = useTranslations("Feedback");
  const answer = item.response ? answerChip(item.response) : null;
  const href = `/projects/${encodeURIComponent(item.project.slug)}/posts/${encodeURIComponent(item.post.id)}#feedback-${encodeURIComponent(item.id)}`;

  return (
    <article className="min-w-0 rounded-md border border-rule bg-sheet hover:border-rule-strong">
      <Link
        href={href}
        className="flex flex-col gap-2 rounded-md p-4 text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:p-5"
      >
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small text-ink-muted">
          {showProject ? (
            <span>
              {t.rich("onProject", {
                project: item.project.name,
                n: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </span>
          ) : null}
          <span>{formatDate(item.createdAt, locale)}</span>
        </span>
        <span className="line-clamp-3 block max-w-read text-ink">
          {item.hidden !== null ? (
            <HiddenPlaceholder hidden={item.hidden} locale={locale} variant="inline" />
          ) : (
            <bdi>{item.body}</bdi>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <ResponseChip {...stateChip(item.responseState)} />
          {answer ? <ResponseChip {...answer} /> : null}
        </span>
      </Link>
    </article>
  );
}
