import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "./ui/icon";
import { LanguageLink } from "./language-link";
import { Logo } from "./logo";
import { buttonClasses } from "./ui/button";

export type HeaderSection =
  | "projects"
  | "members"
  | "rules"
  | "practice"
  | "manifesto";

// "members" is a HeaderSection but not listed: there is no member list to link to yet.
const SECTIONS: readonly HeaderSection[] = [
  "projects",
  "rules",
  "practice",
  "manifesto",
];

const NO_MARKER = "list-none [&::-webkit-details-marker]:hidden";

const MENU_ITEM = "rounded-sm p-3 text-ink no-underline";

// One treatment for nav links wherever they render: the current page is ink,
// weight 600 and underlined in the brand colour, the others are muted.
function navLinkClasses(isCurrent: boolean, layout: string) {
  return `${layout} border-b-2 no-underline hover:text-ink ${
    isCurrent
      ? "border-brand font-semibold text-ink"
      : "border-transparent font-medium text-ink-muted"
  }`;
}

function SignOutForm({ label, className }: { label: string; className: string }) {
  return (
    <form method="post" action="/sign-out">
      <button
        type="submit"
        className={`w-full cursor-pointer bg-transparent text-start ${className}`}
      >
        {label}
      </button>
    </form>
  );
}

export function SiteHeader({
  locale,
  current,
  member,
}: {
  locale: Locale;
  current?: HeaderSection;
  member?: { displayName: string };
}) {
  const t = useTranslations("Nav");
  const otherLocale: Locale = locale === "fa" ? "en" : "fa";
  const initial = member ? Array.from(member.displayName.trim())[0] : undefined;

  const languageLink = (className: string) => (
    <LanguageLink
      targetLocale={otherLocale}
      label={t("otherLanguage")}
      className={className}
    />
  );

  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex h-14 max-w-page items-center gap-3 px-4 md:h-16 md:gap-6 md:px-6">
        <Link href="/" className="inline-flex flex-none items-center text-ink no-underline">
          <Logo />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-stretch gap-1 self-stretch md:flex">
          {SECTIONS.map((section) => (
            <Link
              key={section}
              href={`/${section}`}
              aria-current={section === current ? "page" : undefined}
              className={navLinkClasses(
                section === current,
                "inline-flex items-center px-3 text-body",
              )}
            >
              {t(section)}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex flex-none items-center gap-3">
          {languageLink(
            "hidden items-center text-small font-medium text-ink-muted no-underline hover:text-ink md:inline-flex",
          )}

          {member ? (
            <details className="relative hidden md:block">
              <summary
                className={`inline-flex cursor-pointer items-center gap-2 text-ink ${NO_MARKER}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-grid size-8 flex-none place-items-center rounded-full bg-sunken text-label font-bold text-ink"
                >
                  {initial}
                </span>
                <bdi>{member.displayName}</bdi>
                <Icon name="chevron-down" size={16} />
              </summary>
              <div className="absolute end-0 top-full z-10 mt-2 flex w-48 flex-col rounded-md bg-sheet p-2 shadow-float">
                <Link href="/me" className={`${MENU_ITEM} hover:bg-sunken`}>
                  {t("myPage")}
                </Link>
                <Link href="/me/awaiting" className={`${MENU_ITEM} hover:bg-sunken`}>
                  {t("awaiting")}
                </Link>
                <Link href="/me/notifications" className={`${MENU_ITEM} hover:bg-sunken`}>
                  {t("notifications")}
                </Link>
                <Link href="/me/invites" className={`${MENU_ITEM} hover:bg-sunken`}>
                  {t("invites")}
                </Link>
                <Link href="/moderation" className={`${MENU_ITEM} hover:bg-sunken`}>
                  {t("moderationLog")}
                </Link>
                <Link href="/me/account" className={`${MENU_ITEM} hover:bg-sunken`}>
                  {t("account")}
                </Link>
                <SignOutForm
                  label={t("signOut")}
                  className={`${MENU_ITEM} hover:bg-sunken`}
                />
              </div>
            </details>
          ) : (
            <Link
              href="/sign-in"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("signIn")}
            </Link>
          )}

          <details className="relative md:hidden">
            <summary
              className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-sm text-ink ${NO_MARKER}`}
              aria-label={t("menu")}
            >
              <Icon name="menu" />
            </summary>
            <div className="absolute end-0 top-full z-10 mt-2 flex w-64 flex-col rounded-md bg-sheet p-2 shadow-float">
              {SECTIONS.map((section) => (
                <Link
                  key={section}
                  href={`/${section}`}
                  aria-current={section === current ? "page" : undefined}
                  className={navLinkClasses(section === current, "rounded-sm p-3")}
                >
                  {t(section)}
                </Link>
              ))}
              <hr className="my-2 w-full border-0 border-t border-rule" />
              {languageLink(MENU_ITEM)}
              {member ? (
                <>
                  <Link href="/me" className={MENU_ITEM}>
                    {t("myPage")}
                  </Link>
                  <Link href="/me/awaiting" className={MENU_ITEM}>
                    {t("awaiting")}
                  </Link>
                  <Link href="/me/notifications" className={MENU_ITEM}>
                    {t("notifications")}
                  </Link>
                  <Link href="/me/invites" className={MENU_ITEM}>
                    {t("invites")}
                  </Link>
                  <Link href="/moderation" className={MENU_ITEM}>
                    {t("moderationLog")}
                  </Link>
                  <Link href="/me/account" className={MENU_ITEM}>
                    {t("account")}
                  </Link>
                  <SignOutForm label={t("signOut")} className={MENU_ITEM} />
                </>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
