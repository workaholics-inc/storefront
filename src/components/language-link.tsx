"use client";

import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export function LanguageLink({
  targetLocale,
  label,
  className,
}: {
  targetLocale: Locale;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <Link
      href={pathname}
      locale={targetLocale}
      lang={targetLocale}
      hrefLang={targetLocale}
      className={className}
    >
      {label}
    </Link>
  );
}
