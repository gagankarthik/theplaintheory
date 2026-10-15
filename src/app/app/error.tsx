"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/app/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const forbidden = /role doesn't allow/i.test(error.message);
  return (
    <div role="alert" className="max-w-xl py-12 sm:py-16">
      <p className="eyebrow">{forbidden ? "No access" : "Something went wrong"}</p>
      <h1 className="mt-3 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{forbidden ? "You don't have access to this" : "This page didn't load"}</h1>
      <p className="mt-2 text-sm text-ink-2">
        {forbidden ? error.message : "Something failed on our side while loading this page. Your data is safe. Try again, and if it keeps happening, contact support with the reference below."}
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-ink-3">Reference {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {forbidden ? null : <Button onClick={reset}>Try again</Button>}
        <ButtonLink variant={forbidden ? "primary" : "secondary"} href="/app">
          Go to sites
        </ButtonLink>
      </div>
    </div>
  );
}
