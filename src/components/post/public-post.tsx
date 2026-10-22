import { hasLocale, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { isFormerMember, memberName } from "../member/member-name";
import { Icon } from "../ui/icon";

type PublicPostData = components["schemas"]["PublicPost"];

const SECTION_HEADING = "m-0 text-label font-bold text-ink-muted";

// One public post: only the owner's own words, and nothing for a visitor to act on.
export function PublicPost({
  post,
  variant,
  href,
}: {
  post: PublicPostData;
  variant: "full" | "compact";
  href?: string;
}) {
  const t = useTranslations("Posts");
  const f = useTranslations("Feedback");
  const current = useLocale();
  const locale = hasLocale(routing.locales, current)
    ? current
    : routing.defaultLocale;
  const isWip = post.kind === "wip";
  const date = formatDate(post.createdAt, locale);

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
          {post.author && !isFormerMember(post.author) ? (
            <bdi>{post.author.displayName}</bdi>
          ) : (
            memberName(post.author, f, "start")
          )}
        </span>
        {href ? (
          <Link
            href={href}
            className="text-small text-ink-muted no-underline hover:underline"
          >
            {date}
          </Link>
        ) : (
          <span className="text-small text-ink-muted">{date}</span>
        )}
        {post.editedAt ? (
          <span className="text-small text-ink-muted">{t("edited")}</span>
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
    </article>
  );
}
