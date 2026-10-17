import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "./ui/icon";
import { LanguageLink } from "./language-link";
import { Logo } from "./logo";
import { buttonClasses } from "./ui/button";

export type HeaderSection = "projects" | "members" | "rules" | "manifesto";

const SECTIONS: readonly HeaderSection[] = [
  "projects",
  "members",
  "rules",
  "manifesto",
];

const NO_MARKER = "list-none [&::-webkit-details-marker]:hidden";

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
  const sections = SECTIONS.filter((s) => s !== "members" || member);
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
          {sections.map((section) => (
            <Link
              key={section}
              href={`/${section}`}
              aria-current={section === current ? "page" : undefined}
              className={`inline-flex items-center border-b-2 px-3 text-body no-underline hover:text-ink ${
                section === current
                  ? "border-brand font-semibold text-ink"
                  : "border-transparent font-medium text-ink-muted"
              }`}
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
                <Link href="/me" className="rounded-sm p-3 text-ink no-underline hover:bg-sunken">
                  {t("myPage")}
                </Link>
                <Link href="/sign-out" className="rounded-sm p-3 text-ink no-underline hover:bg-sunken">
                  {t("signOut")}
                </Link>
              </div>
            </details>
          ) : (
            <Link
              href="/sign-in"
              className={`hidden md:inline-flex ${buttonClasses({ variant: "secondary", size: "sm" })}`}
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
              {sections.map((section) => (
                <Link
                  key={section}
                  href={`/${section}`}
                  aria-current={section === current ? "page" : undefined}
                  className={`rounded-sm p-3 no-underline ${
                    section === current
                      ? "bg-brand-soft font-semibold text-link"
                      : "text-ink"
                  }`}
                >
                  {t(section)}
                </Link>
              ))}
              <hr className="my-2 w-full border-0 border-t border-rule" />
              {languageLink("rounded-sm p-3 text-ink no-underline")}
              {member ? (
                <>
                  <Link href="/me" className="rounded-sm p-3 text-ink no-underline">
                    {t("myPage")}
                  </Link>
                  <Link href="/sign-out" className="rounded-sm p-3 text-ink no-underline">
                    {t("signOut")}
                  </Link>
                </>
              ) : (
                <Link href="/sign-in" className="rounded-sm p-3 text-ink no-underline">
                  {t("signIn")}
                </Link>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
