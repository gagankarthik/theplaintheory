"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/app/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const forbidden = /role doesn't allow/i.test(error.message);
  return (
    <div role="alert" className="max-w-xl py-10">
      <h1 className="text-xl font-semibold">{forbidden ? "You don't have access to this" : "This page didn't load"}</h1>
      <p className="mt-2 text-base text-ink-2">
        {forbidden ? error.message : "Something failed on our side while loading this page. Your data is safe. Try again, and if it keeps happening, contact support with the reference below."}
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-ink-3">Reference {error.digest}</p> : null}
      <div className="mt-6 flex gap-2">
        {forbidden ? null : <Button onClick={reset}>Try again</Button>}
        <ButtonLink variant="ghost" href="/app">
          Go to sites
        </ButtonLink>
      </div>
    </div>
  );
}
