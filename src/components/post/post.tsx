import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { answerChip } from "../feedback/chips";
import { ResponseChip } from "../feedback/response-chip";
import { buttonClasses } from "../ui/button";
import { Icon } from "../ui/icon";

type PostData = components["schemas"]["Post"];

const SECTION_HEADING = "m-0 text-label font-bold text-ink-muted";

// One post on a project: work in progress asks for feedback, an update says
// what changed because of it. The page decides how much of it to show.
export function Post({
  post,
  locale,
  variant,
  showThreadLink,
  canGiveFeedback,
  now,
}: {
  post: PostData;
  locale: Locale;
  variant: "full" | "compact";
  showThreadLink: boolean;
  canGiveFeedback: boolean;
  now: Date;
}) {
  const t = useTranslations("Posts");
  const f = useTranslations("Feedback");
  const projectPath = `/projects/${encodeURIComponent(post.project.slug)}`;
  const threadPath = `${projectPath}/posts/${encodeURIComponent(post.id)}`;
  const editable =
    post.editableUntil !== null && new Date(post.editableUntil) > now;
  const isWip = post.kind === "wip";

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-md border border-rule bg-sheet p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1 text-label font-bold text-ink">
          <Icon
            name={isWip ? "file-pen-line" : "file-diff"}
            size={16}
            className="text-ink-muted"
          />
          {isWip ? t("wip") : t("update")}
        </span>
        <span className="text-small text-ink-muted">
          {post.author ? <bdi>{post.author.displayName}</bdi> : f("unknownMember")}
        </span>
        <span className="text-small text-ink-muted">
          {formatDate(post.createdAt, locale)}
        </span>
        {post.editedAt ? (
          <span className="text-small text-ink-muted">{t("edited")}</span>
        ) : null}
        {editable ? (
          <Link
            href={`${threadPath}/edit`}
            className="text-small font-semibold text-link"
          >
            {t("edit")}
          </Link>
        ) : null}
      </div>

      {post.body !== "" ? (
        <p className="m-0 max-w-read whitespace-pre-line">
          <bdi>{post.body}</bdi>
        </p>
      ) : null}

      {isWip ? (
        <>
          <section className="flex flex-col gap-2 rounded-sm bg-sunken p-4">
            <h4 className={SECTION_HEADING}>{t("feedbackWanted")}</h4>
            <ol className="m-0 flex list-decimal flex-col gap-1 ps-5">
              {post.feedbackWanted.map((question, index) => (
                <li key={index}>
                  <bdi>{question}</bdi>
                </li>
              ))}
            </ol>
          </section>
          {variant === "full" && post.selfCritique ? (
            <section className="flex flex-col gap-2">
              <h4 className={SECTION_HEADING}>{t("selfCritique")}</h4>
              <p className="m-0 max-w-read whitespace-pre-line">
                <bdi>{post.selfCritique}</bdi>
              </p>
            </section>
          ) : null}
          {variant === "compact" && post.hasUnansweredFeedback ? (
            <div>
              <ResponseChip kind="has-unanswered" />
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-4 border-t border-rule pt-4">
          {post.whatChanged ? (
            <section className="flex flex-col gap-2">
              <h4 className={SECTION_HEADING}>{t("whatChanged")}</h4>
              <p className="m-0 max-w-read whitespace-pre-line">
                <bdi>{post.whatChanged}</bdi>
              </p>
            </section>
          ) : null}
          {post.actedOn.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h4 className={SECTION_HEADING}>{t("actedOn")}</h4>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {post.actedOn.map((item) => {
                  const chip = answerChip(item);

                  return (
                    <li
                      key={item.feedbackId}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                    >
                      <bdi>{item.excerpt}</bdi>
                      <span className="text-small text-ink-muted">
                        {item.author ? (
                          <bdi>{item.author.displayName}</bdi>
                        ) : (
                          f("unknownMember")
                        )}
                      </span>
                      {chip ? <ResponseChip {...chip} /> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {post.rejectedAndWhy ? (
            <section className="flex flex-col gap-2">
              <h4 className={SECTION_HEADING}>{t("rejectedAndWhy")}</h4>
              <p className="m-0 max-w-read whitespace-pre-line">
                <bdi>{post.rejectedAndWhy}</bdi>
              </p>
            </section>
          ) : null}
          {post.oneNumber ? (
            <section className="flex flex-col gap-2">
              <h4 className={SECTION_HEADING}>{t("oneNumber")}</h4>
              <p className="m-0 max-w-read">
                <bdi>{post.oneNumber}</bdi>
              </p>
            </section>
          ) : null}
        </div>
      )}

      {showThreadLink || canGiveFeedback ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
          {showThreadLink ? (
            <Link
              href={threadPath}
              className={buttonClasses({ variant: "quiet", size: "sm" })}
            >
              {t("openThread")}
            </Link>
          ) : (
            <span />
          )}
          {canGiveFeedback ? (
            <Link
              href={`${threadPath}#give-feedback`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("giveFeedback")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
