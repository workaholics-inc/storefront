import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPlatformClient } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { routing } from "@/i18n/routing";

async function fetchHealth() {
  try {
    const client = await getPlatformClient();
    const { data } = await client.GET("/v1/health", {
      signal: AbortSignal.timeout(3000),
    });
    return data;
  } catch {
    return undefined;
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const tHealth = await getTranslations("Health");
  const health = await fetchHealth();

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("tagline")}</p>
      <section>
        <h2>{tHealth("title")}</h2>
        {health ? (
          <>
            <p>{tHealth("ok")}</p>
            <p>{tHealth("version", { version: health.version })}</p>
            <p>
              {tHealth("checkedAt", {
                time: formatDateTime(health.time, locale),
              })}
            </p>
          </>
        ) : (
          <p>{tHealth("unreachable")}</p>
        )}
      </section>
    </main>
  );
}
