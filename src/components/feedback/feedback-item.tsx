import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { buttonClasses } from "../ui/button";
import { answerChip, stateChip } from "./chips";
import { ResponseChip } from "./response-chip";

type FeedbackItemData = components["schemas"]["FeedbackItem"];

export type FeedbackNotice = "feedback" | "answer" | "reply" | "edit";

export type FeedbackControls = {
  answer?: ReactNode;
  editAnswer?: ReactNode;
  reply?: ReactNode;
  edit?: ReactNode;
  editReplies?: Record<string, ReactNode>;
};

const NOTICE_KEY = {
  feedback: "savedFeedback",
  answer: "savedAnswer",
  reply: "savedReply",
  edit: "savedEdit",
} as const;

const SUMMARY = `${buttonClasses({ variant: "secondary", size: "sm" })} list-none [&::-webkit-details-marker]:hidden`;
const QUIET_SUMMARY = `${buttonClasses({ variant: "quiet", size: "sm" })} list-none [&::-webkit-details-marker]:hidden`;
const BYLINE = "flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small text-ink-muted";

// A control the page built (a form), opened in place under its summary.
function Disclosure({
  summary,
  summaryClasses = SUMMARY,
  children,
}: {
  summary: string;
  summaryClasses?: string;
  children: ReactNode;
}) {
  return (
    <details className="flex flex-col gap-3">
      <summary className={summaryClasses}>{summary}</summary>
      {children}
    </details>
  );
}

// One piece of feedback with what happened to it. The empty answer slot is the
// open loop made visible: it is never hidden and never replaced by a count.
export function FeedbackItem({
  item,
  locale,
  notice,
  controls = {},
}: {
  item: FeedbackItemData;
  locale: Locale;
  notice?: FeedbackNotice;
  controls?: FeedbackControls;
}) {
  const t = useTranslations("Feedback");
  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
  const nameOf = (member: { displayName: string } | null) =>
    member ? member.displayName : t("unknownMember");
  const response = item.response;
  const chip = response ? answerChip(response) : null;
  const replies = [...item.replies].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );

  return (
    <article
      id={`feedback-${item.id}`}
      className="flex min-w-0 scroll-mt-24 flex-col gap-3 rounded-md border border-rule bg-sheet p-4 sm:p-5"
    >
      {notice ? (
        <p
          role="status"
          className="m-0 rounded-sm bg-sunken px-3 py-2 text-small text-ink"
        >
          {notice === "answer"
            ? t.rich("savedAnswer", { name: nameOf(item.author), n: bdi })
            : t(NOTICE_KEY[notice])}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className={`m-0 ${BYLINE}`}>
          <span className="font-semibold text-ink">
            <bdi>{nameOf(item.author)}</bdi>
          </span>
          <span>{formatDate(item.createdAt, locale)}</span>
          {item.editedAt ? <span>{t("edited")}</span> : null}
        </p>
        <ResponseChip {...stateChip(item.responseState)} />
      </div>
      {item.question ? (
        <p className="m-0 text-small text-ink-muted">
          {t.rich("about", { question: item.question, n: bdi })}
        </p>
      ) : null}
      <p className="m-0 max-w-read whitespace-pre-line">
        <bdi>{item.body}</bdi>
      </p>
      {controls.edit ? (
        <Disclosure summary={t("edit")} summaryClasses={QUIET_SUMMARY}>
          {controls.edit}
        </Disclosure>
      ) : null}

      <div className="ms-1 flex flex-col gap-3 border-s-2 border-rule ps-4">
        {response ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {chip ? <ResponseChip {...chip} /> : null}
            </div>
            <p className="m-0 max-w-read whitespace-pre-line">
              <bdi>{response.reason}</bdi>
            </p>
            <p className={`m-0 ${BYLINE}`}>
              <span>
                {t.rich("answerBy", {
                  name: nameOf(response.responder),
                  date: formatDate(response.createdAt, locale),
                  n: bdi,
                })}
              </span>
              {response.editedAt ? <span>{t("edited")}</span> : null}
            </p>
            {controls.editAnswer ? (
              <Disclosure summary={t("edit")} summaryClasses={QUIET_SUMMARY}>
                {controls.editAnswer}
              </Disclosure>
            ) : null}
            {controls.answer ? (
              <Disclosure summary={t("reportBack")}>{controls.answer}</Disclosure>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-sm border border-dashed border-rule-strong px-4 py-3 text-small text-ink-muted">
            <p className="m-0">{t("noAnswerYet")}</p>
            {controls.answer ? (
              <Disclosure summary={t("answer")}>{controls.answer}</Disclosure>
            ) : null}
          </div>
        )}

        {replies.map((reply) => (
          <div key={reply.id} className="flex flex-col gap-1">
            <p className={`m-0 ${BYLINE}`}>
              <span className="font-semibold text-ink">
                <bdi>{nameOf(reply.author)}</bdi>
              </span>
              <span>{formatDate(reply.createdAt, locale)}</span>
              {reply.editedAt ? <span>{t("edited")}</span> : null}
            </p>
            <p className="m-0 max-w-read whitespace-pre-line">
              <bdi>{reply.body}</bdi>
            </p>
            {controls.editReplies?.[reply.id] ? (
              <Disclosure summary={t("edit")} summaryClasses={QUIET_SUMMARY}>
                {controls.editReplies[reply.id]}
              </Disclosure>
            ) : null}
          </div>
        ))}

        {controls.reply ? (
          <Disclosure summary={t("reply")} summaryClasses={QUIET_SUMMARY}>
            {controls.reply}
          </Disclosure>
        ) : null}
      </div>
    </article>
  );
}
