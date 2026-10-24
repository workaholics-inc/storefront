import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InviteCreate, RevokeInviteForm } from "@/components/member/invite-forms";
import { InviteList } from "@/components/member/invite-list";
import { StateMessage } from "@/components/ui/state-message";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { createInvite, revokeInvite } from "./actions";

type MyInviteList = components["schemas"]["MyInviteList"];

const LIST_TIMEOUT_MS = 5000;

export default async function InvitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ revoked?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const here = localePath(locale, "/me/invites");
  const me = await requireMember(locale, here);
  const t = await getTranslations("Invites");

  const { revoked: rawRevoked } = await searchParams;
  const revoked = (Array.isArray(rawRevoked) ? rawRevoked[0] : rawRevoked) === "1";

  const result = await platformCall<MyInviteList>(async () =>
    (await getPlatformClient()).GET("/v1/me/invites", {
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    }),
  );

  let body;
  let hasItems = false;
  if (!result.ok) {
    if (result.code === "unreachable") {
      body = <StateMessage kind="unreachable" />;
    } else if (result.status === 401 && result.code === "session_required") {
      // The session ended between the check above and this call.
      redirect(expiredPath(locale, here));
    } else {
      throw new Error("platform error: " + result.code);
    }
  } else if (result.data.items.length === 0) {
    body = <StateMessage kind="empty" title={t("empty")} />;
  } else {
    const { items } = result.data;
    const revoke: Record<string, ReactNode> = {};
    for (const invite of items) {
      if (invite.status === "open") {
        revoke[invite.id] = (
          <RevokeInviteForm action={revokeInvite.bind(null, locale, invite.id)} />
        );
      }
    }
    hasItems = true;
    body = <InviteList invites={items} locale={locale} revoke={revoke} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
        <p className="m-0 max-w-read text-ink-muted">{t("intro")}</p>
      </div>
      {revoked ? (
        <p
          role="status"
          className="m-0 max-w-read rounded-sm bg-sunken px-3 py-2 text-small text-ink"
        >
          {t("revoked")}
        </p>
      ) : null}
      {me.probation !== null ? (
        <p className="m-0 max-w-read rounded-sm bg-sunken px-3 py-2 text-small text-ink">
          {t("probationNote")}
        </p>
      ) : (
        <InviteCreate action={createInvite.bind(null, locale)} />
      )}
      <section aria-labelledby="invites-list" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="invites-list" className="m-0 text-title-2 text-ink">
            {t("listTitle")}
          </h2>
          {hasItems ? (
            <span className="text-small text-ink-muted">{t("listOrder")}</span>
          ) : null}
        </div>
        {body}
      </section>
    </div>
  );
}
