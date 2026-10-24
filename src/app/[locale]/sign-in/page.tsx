import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { safeNextPath } from "@/lib/cookies";
import { getCurrentMember, localePath } from "@/lib/session";
import { LIMITS, readInviteCode } from "@/lib/validation";
import { startEmailSignIn, verifyEmailSignIn } from "./actions";

const SIGN_IN_ERRORS = [
  "invite_required",
  "invite_invalid",
  "invite_expired",
  "telegram_signature_invalid",
  "telegram_cancelled",
  "sign_in_failed",
  "rate_limited",
  "session_required",
  "unreachable",
] as const;

type SignInError = (typeof SIGN_IN_ERRORS)[number];

function signInError(value: unknown): SignInError | undefined {
  return SIGN_IN_ERRORS.find((code) => code === value);
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    invite?: string | string[];
  }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const query = await searchParams;
  const next = safeNextPath(query.next);
  const error = signInError(query.error);
  const invite = readInviteCode(Array.isArray(query.invite) ? query.invite[0] : query.invite);

  const current = await getCurrentMember();
  if (current.state === "member") {
    redirect(next ?? localePath(locale, "/projects"));
  }

  const t = await getTranslations("Auth");
  const tErrors = await getTranslations("Errors");

  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 className="m-0 text-title-1 text-ink">{t("signInTitle")}</h1>
      {error ? (
        // An empty body: the generic "something went wrong" default would
        // contradict the specific message in the title.
        <StateMessage kind="error" title={tErrors(error)} body="" />
      ) : null}
      <form method="post" action="/auth/telegram" className="flex flex-col gap-2">
        {hidden}
        <Button type="submit" variant="primary" icon="log-in" className="w-full">
          {t("signInWithTelegram")}
        </Button>
        <p className="m-0 text-small text-ink-muted">{t("signInHint")}</p>
      </form>
      <div className="flex items-center gap-3 text-small text-ink-muted">
        <hr className="m-0 h-px flex-1 border-0 bg-rule" />
        <span>{t("haveInvite")}</span>
        <hr className="m-0 h-px flex-1 border-0 bg-rule" />
      </div>
      <form
        method="post"
        action="/auth/telegram"
        className="flex flex-col items-start gap-3"
      >
        {hidden}
        <TextField
          id="sign-in-invite"
          name="invite"
          label={t("inviteLabel")}
          hint={t("inviteHint")}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          defaultValue={typeof invite === "string" ? invite : undefined}
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary">
          {t("continue")}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-small text-ink-muted">
        <hr className="m-0 h-px flex-1 border-0 bg-rule" />
        <span>{t("orEmail")}</span>
        <hr className="m-0 h-px flex-1 border-0 bg-rule" />
      </div>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-small text-ink-muted">{t("emailHint")}</p>
        <EmailSignIn
          next={next}
          addressMax={LIMITS.emailAddressMax}
          start={startEmailSignIn}
          verify={verifyEmailSignIn.bind(null, locale)}
        />
      </div>
      <p className="m-0 text-small text-ink-muted">
        {t("notMember")}{" "}
        <Link href="/manifesto" className="font-medium text-link">
          {t("readManifesto")}
        </Link>
      </p>
    </div>
  );
}
