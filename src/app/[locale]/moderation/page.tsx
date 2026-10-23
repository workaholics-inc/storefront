import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModerationLog } from "@/components/moderation/moderation-log";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";

type ModerationLogPage = components["schemas"]["ModerationLogPage"];

const PAGE_SIZE = 20;
const LIST_TIMEOUT_MS = 5000;

export default async function ModerationPage({
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

  const here = localePath(locale, "/moderation");
  await requireMember(locale, here);
  const t = await getTranslations("ModerationLog");
  const tState = await getTranslations("State");

  const { cursor: rawCursor } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;

  const result = await platformCall<ModerationLogPage>(async () =>
    (await getPlatformClient()).GET("/v1/moderation/log", {
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
              href="/moderation"
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
        <ModerationLog entries={items} locale={locale} />
        {nextCursor ? (
          <div>
            <Link
              href={`/moderation?cursor=${encodeURIComponent(nextCursor)}`}
              className={buttonClasses({ variant: "secondary" })}
            >
              {t("older")}
            </Link>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
      <p className="m-0 max-w-read text-ink-muted">{t("intro")}</p>
      {body}
    </div>
  );
}
