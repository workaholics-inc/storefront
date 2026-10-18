import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import "../globals.css";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { getCurrentMember } from "@/lib/session";

const vazirmatn = localFont({
  src: "../../../node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-vazirmatn",
});

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const current = await getCurrentMember();

  return (
    <html
      lang={locale}
      dir={locale === "fa" ? "rtl" : "ltr"}
      className={vazirmatn.variable}
    >
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <SiteHeader
            locale={locale}
            member={
              current.state === "member"
                ? { displayName: current.member.displayName }
                : undefined
            }
          />
          <main className="mx-auto max-w-page px-4 py-8 md:py-12">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
