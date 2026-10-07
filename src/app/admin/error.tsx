"use client";

import { useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/components/app/ui/button";

/** Error boundary for every console page. Retry re-fetches the segment (Next 16.3 `retry`). */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    console.error(error);
    heading.current?.focus();
  }, [error]);
  const forbidden = /staff role doesn't allow/i.test(error.message);
  return (
    <div role="alert" className="max-w-xl py-10">
      <h1 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">
        {forbidden ? "Your staff role can't open this" : "This console page didn't load"}
      </h1>
      <p className="mt-2 text-base text-ink-2">
        {forbidden ? error.message : "Something failed while loading platform data. Nothing was changed. Try again, and if it keeps failing, send the reference below to engineering."}
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-ink-3">Reference {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {forbidden ? null : <Button onClick={() => retry()}>Try again</Button>}
        <ButtonLink variant="ghost" href="/admin">
          Console overview
        </ButtonLink>
      </div>
    </div>
  );
}
