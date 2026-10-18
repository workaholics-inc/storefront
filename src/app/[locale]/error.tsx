"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("State");

  // `retry` re-fetches the server content; `reset` would re-render the same
  // failed result.
  return (
    <StateMessage
      kind="error"
      code={error.digest}
      action={
        <Button variant="secondary" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
