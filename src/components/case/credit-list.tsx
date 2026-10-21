import { useTranslations } from "next-intl";

export type Credit = { member: { handle: string; displayName: string } | null };

// A credit without consent has no member: it reads "a member", never a name.
export function CreditList({ credits }: { credits: readonly Credit[] }) {
  const t = useTranslations("Credits");

  if (credits.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h4 className="m-0 text-label font-bold text-ink-muted">{t("title")}</h4>
      <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
        {credits.map((credit, index) => (
          <li key={index}>
            {credit.member ? <bdi>{credit.member.displayName}</bdi> : t("aMember")}
          </li>
        ))}
      </ul>
    </section>
  );
}
