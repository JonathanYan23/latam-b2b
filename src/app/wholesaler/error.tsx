"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/ui/states";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[wholesaler error]", error);
  }, [error]);

  return <ErrorPanel error={error} reset={reset} homeHref="/wholesaler" />;
}
