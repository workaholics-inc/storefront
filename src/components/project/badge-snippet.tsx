"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { TextAreaField } from "../ui/form-field";

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function badgeEmbedCode({
  pageUrl,
  imageUrl,
  alt,
}: {
  pageUrl: string;
  imageUrl: string;
  alt: string;
}): string {
  return `<a href="${escapeAttribute(pageUrl)}"><img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(alt)}"></a>`;
}

export function BadgeSnippet({
  pageUrl,
  imageUrl,
}: {
  pageUrl: string;
  imageUrl: string;
}) {
  const t = useTranslations("Badge");
  const [copied, setCopied] = useState(false);
  const section = useRef<HTMLElement>(null);
  const code = badgeEmbedCode({ pageUrl, imageUrl, alt: t("text") });

  function selectCode() {
    section.current?.querySelector("textarea")?.select();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // No clipboard (or it refused): leave the code selected to copy by hand.
      selectCode();
    }
  }

  return (
    <section
      ref={section}
      aria-labelledby="badge-snippet-title"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2
        id="badge-snippet-title"
        className="m-0 text-label font-bold text-ink-muted"
      >
        {t("snippetTitle")}
      </h2>
      <p className="m-0 text-small text-ink-muted">{t("snippetHint")}</p>
      <TextAreaField
        id="badge-snippet-code"
        label={t("snippetLabel")}
        readOnly
        dir="ltr"
        rows={3}
        value={code}
        className="font-mono text-small"
        onFocus={selectCode}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {t("copy")}
        </Button>
        <span role="status" className="text-small text-ink-muted">
          {copied ? t("copied") : ""}
        </span>
      </div>
    </section>
  );
}
