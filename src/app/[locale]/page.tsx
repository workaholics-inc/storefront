import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StateMessage } from "@/components/ui/state-message";
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-ink">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("tagline")}</p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-title-3 text-ink">{tHealth("title")}</h2>
        {health ? (
          <div className="flex flex-col gap-1 rounded-md border border-rule bg-sheet p-4">
            <p className="text-body-strong text-ink">{tHealth("ok")}</p>
            <p className="text-small text-ink-muted">
              {tHealth("version", { version: health.version })}
            </p>
            <p className="text-small text-ink-muted">
              {tHealth("checkedAt", {
                time: formatDateTime(health.time, locale),
              })}
            </p>
          </div>
        ) : (
          <StateMessage kind="unreachable" />
        )}
      </section>
    </div>
  );
}
