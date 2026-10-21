import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PracticeMonths } from "@/components/practice/practice-months";
import { Icon } from "@/components/ui/icon";
import { StateMessage } from "@/components/ui/state-message";
import { routing } from "@/i18n/routing";
import { getPlatformClient } from "@/lib/api/client";
import { platformCall } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

type PracticePage = components["schemas"]["PracticePage"];

const PRACTICE_TIMEOUT_MS = 5000;

// The rules are published in docs/rules.md (README, "Rules are public"); /rules has no page yet.
const RULES_URL =
  "https://github.com/workaholics-inc/storefront/blob/main/docs/rules.md#monthly-practice-numbers";

const RULES = [
  "ruleMonths",
  "ruleMembers",
  "ruleMembersPostingWip",
  "ruleProjectsWithPublicChangelog",
  "ruleFeedbackAnsweredInWindow",
  "ruleCasesWritten",
  "ruleOnce",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Practice" });

  return { title: t("metaTitle") };
}

// The community's monthly numbers: the same page for members and visitors.
export default async function PracticeRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations("Practice");

  const result = await platformCall<PracticePage>(async () =>
    (await getPlatformClient()).GET("/v1/public/practice", {
      signal: AbortSignal.timeout(PRACTICE_TIMEOUT_MS),
    }),
  );
  if (!result.ok && result.code !== "unreachable") {
    throw new Error("platform error: " + result.code);
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-title-1 text-ink">{t("title")}</h1>
        <p className="m-0 max-w-read text-lead text-ink">{t("intro")}</p>
      </div>

      <section aria-labelledby="practice-months" className="flex min-w-0 flex-col gap-4">
        <h2 id="practice-months" className="m-0 text-title-2 text-ink">
          {t("months")}
        </h2>
        {result.ok ? (
          <PracticeMonths snapshots={result.data.items} />
        ) : (
          <StateMessage kind="unreachable" />
        )}
      </section>

      <section aria-labelledby="practice-rules" className="flex max-w-read flex-col gap-3">
        <h2 id="practice-rules" className="m-0 text-title-2 text-ink">
          {t("rulesTitle")}
        </h2>
        <ul className="m-0 flex flex-col gap-2 ps-5">
          {RULES.map((rule) => (
            <li key={rule}>{t(rule)}</li>
          ))}
        </ul>
        <p className="m-0">
          <a
            href={RULES_URL}
            rel="noopener"
            className="inline-flex items-center gap-1 font-medium text-link"
          >
            {t("rulesLink")}
            <Icon name="external-link" size={16} />
          </a>
        </p>
      </section>
    </div>
  );
}
