import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInMethods } from "@/components/member/sign-in-methods";
import { buttonClasses } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { expiredPath, localePath, requireMember } from "@/lib/session";
import { LIMITS } from "@/lib/validation";
import { removeEmail, startAddEmail, verifyAddEmail } from "./actions";

const IDENTITIES_TIMEOUT_MS = 5000;

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const here = localePath(locale, "/me/account");
  await requireMember(locale, here);
  const t = await getTranslations("Account");
  const tExport = await getTranslations("Export");

  const { email: rawEmail } = await searchParams;
  const first = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const notice = first === "added" || first === "removed" ? first : null;

  const result = await platformCall<components["schemas"]["IdentityList"]>(async () =>
    (await getPlatformClient()).GET("/v1/me/identities", {
      signal: AbortSignal.timeout(IDENTITIES_TIMEOUT_MS),
    }),
  );

  let methods;
  if (result.ok) {
    methods = (
      <SignInMethods
        items={result.data.items}
        locale={locale}
        notice={notice}
        addressMax={LIMITS.emailAddressMax}
        startAdd={startAddEmail.bind(null, locale)}
        verifyAdd={verifyAddEmail.bind(null, locale)}
        remove={removeEmail.bind(null, locale)}
      />
    );
  } else if (result.code === "unreachable") {
    methods = <StateMessage kind="unreachable" />;
  } else if (result.status === 401 && result.code === "session_required") {
    // The session ended between the check above and this call.
    redirect(expiredPath(locale, here));
  } else {
    throw new Error("platform error: " + result.code);
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
        <p className="m-0 max-w-read text-ink-muted">{t("intro")}</p>
      </div>
      {methods}
      <section aria-labelledby="account-data-title" className="flex max-w-read flex-col gap-3">
        <h2 id="account-data-title" className="m-0 text-title-2 text-ink">
          {tExport("title")}
        </h2>
        <p className="m-0 text-ink">{tExport("body")}</p>
        <div>
          {/* A plain link, not `Link`: a prefetch GET would run the export. */}
          <a
            href={localePath(locale, "/me/export")}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {tExport("download")}
          </a>
        </div>
      </section>
      <section aria-labelledby="account-delete-title" className="flex max-w-read flex-col gap-3">
        <h2 id="account-delete-title" className="m-0 text-title-2 text-ink">
          {t("deleteTitle")}
        </h2>
        <p className="m-0 text-ink">{t("deleteHint")}</p>
        <div>
          <Link
            href="/me/delete"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {t("deleteLink")}
          </Link>
        </div>
      </section>
    </div>
  );
}
