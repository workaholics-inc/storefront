import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { telegramBotUsername } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { markAllRead, openNotification } from "./actions";

type NotificationPage = components["schemas"]["NotificationPage"];

const PAGE_SIZE = 20;
const LIST_TIMEOUT_MS = 5000;

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const here = localePath(locale, "/me/notifications");
  const me = await requireMember(locale, here);
  const t = await getTranslations("Notifications");
  const tFeedback = await getTranslations("Feedback");
  const tState = await getTranslations("State");

  const { cursor: rawCursor } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;

  const result = await platformCall<NotificationPage>(async () =>
    (await getPlatformClient()).GET("/v1/me/notifications", {
      params: { query: { cursor, limit: PAGE_SIZE } },
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    }),
  );

  let body;
  if (!result.ok) {
    if (result.code === "unreachable") {
      body = <StateMessage kind="unreachable" />;
    } else if (result.status === 400) {
      // A cursor the platform does not accept: offer the way back.
      body = (
        <StateMessage
          kind="error"
          action={
            <Link
              href="/me/notifications"
              className={buttonClasses({ variant: "secondary" })}
            >
              {tState("retry")}
            </Link>
          }
        />
      );
    } else if (result.status === 401 && result.code === "session_required") {
      // The session ended between the check above and this call.
      redirect(expiredPath(locale, here));
    } else {
      throw new Error("platform error: " + result.code);
    }
  } else if (result.data.items.length === 0) {
    body = <StateMessage kind="empty" title={t("empty")} />;
  } else {
    const { items, nextCursor } = result.data;
    body = (
      <>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((notification) => {
            const unread = notification.readAt === null;

            return (
              <li key={notification.id}>
                <form
                  action={openNotification.bind(
                    null,
                    locale,
                    notification.id,
                    notification.project.slug,
                    notification.post.id,
                    notification.feedbackId ?? "",
                    notification.caseId ?? "",
                  )}
                >
                  <button
                    type="submit"
                    className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-md border border-rule bg-sheet p-4 text-start text-ink hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:p-5"
                  >
                    <span className={unread ? "font-semibold" : undefined}>
                      {unread ? <span className="sr-only">{t("unread")} </span> : null}
                      {t.rich(notification.kind, {
                        actor: notification.actor?.displayName ?? tFeedback("unknownMember"),
                        project: notification.project.name,
                        n: (chunks) => <bdi>{chunks}</bdi>,
                      })}
                    </span>
                    <span className="text-small font-normal text-ink-muted">
                      {formatDate(notification.createdAt, locale)}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        {nextCursor ? (
          <div>
            <Link
              href={`/me/notifications?cursor=${encodeURIComponent(nextCursor)}`}
              className={buttonClasses({ variant: "secondary" })}
            >
              {t("older")}
            </Link>
          </div>
        ) : null}
      </>
    );
  }

  const bot = telegramBotUsername();
  const hasUnread = result.ok && result.data.hasUnread;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
        {hasUnread ? (
          <form action={markAllRead.bind(null, locale)}>
            <Button type="submit" variant="secondary" size="sm">
              {t("markAllRead")}
            </Button>
          </form>
        ) : null}
      </div>
      {body}
      {me.telegramDmEnabled || bot !== null ? (
        <section className="flex max-w-read flex-col gap-2 rounded-md bg-sunken p-4 sm:p-5">
          <h2 className="m-0 text-label font-bold text-ink-muted">{t("telegramTitle")}</h2>
          {me.telegramDmEnabled ? (
            <p className="m-0">{t("telegramOn")}</p>
          ) : (
            <>
              <p className="m-0">{t("telegramBody")}</p>
              <p className="m-0">
                <a
                  href={`https://t.me/${bot}`}
                  rel="noopener"
                  className="inline-flex items-center gap-1 font-medium text-link"
                >
                  {t("telegramLink")}
                  <Icon name="external-link" size={16} />
                </a>
              </p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
