import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type ProjectSection = "timeline" | "changelog" | "cases";

const SECTIONS = [
  { section: "timeline", path: "" },
  { section: "changelog", path: "/changelog" },
  { section: "cases", path: "/cases" },
] as const;

// The pages under a project, the same three links for members and visitors.
// Nothing is counted: the labels carry no number.
export function ProjectNav({
  slug,
  current,
}: {
  slug: string;
  current: ProjectSection;
}) {
  const t = useTranslations("Projects");
  const tChangelog = useTranslations("Changelog");
  const tCases = useTranslations("Cases");
  const label = {
    timeline: t("timeline"),
    changelog: tChangelog("title"),
    cases: tCases("title"),
  };

  return (
    <nav aria-label={t("sections")}>
      <ul className="m-0 flex list-none flex-wrap gap-4 border-b border-rule p-0">
        {SECTIONS.map(({ section, path }) => {
          const isCurrent = section === current;

          return (
            <li key={section}>
              <Link
                href={`/projects/${encodeURIComponent(slug)}${path}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 py-2 no-underline hover:text-ink ${
                  isCurrent
                    ? "border-brand font-semibold text-ink"
                    : "border-transparent font-medium text-ink-muted"
                }`}
              >
                {label[section]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
