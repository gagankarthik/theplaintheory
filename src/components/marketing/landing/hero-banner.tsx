"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Choice = "rejected" | "accepted" | null;

/**
 * A working consent banner in the first screen, in the brand: white card, soot type, Reject and Accept
 * as equal lime stems, Choose quieter. Pressing one seals the choice into a receipt, the way the real
 * banner does, and "Show again" brings it back. A sample: the site and receipt values are examples.
 */
export function HeroBanner() {
  const [choice, setChoice] = useState<Choice>(null);
  // the pressed button leaves the page, so focus follows the change: to the result, or back to Reject
  const result = useRef<HTMLParagraphElement>(null);
  const reject = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    (choice ? result.current : reject.current)?.focus({ preventScroll: true });
  }, [choice]);
  const choose = (c: Choice) => {
    moved.current = true;
    setChoice(c);
  };
  const stem = "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-[0.9375rem] font-medium transition-[background-color,transform] duration-150 active:scale-[0.97]";
  return (
    <div
      data-ui
      className="mk-up w-full max-w-[400px] rounded-[22px] bg-white p-5 text-soot shadow-[0_32px_64px_-24px_rgb(0_0_0/0.6)] sm:p-6"
      style={{ "--d": "520ms" } as React.CSSProperties}
    >
      <p className="inline-flex items-center gap-2 text-[0.8125rem] text-mute-ink">
        <span aria-hidden className="size-2.5 rounded-full border-[2.5px] border-soot" />
        shop.example.com
      </p>
      <div aria-live="polite">
        {choice ? (
          <div key={choice} className="mk-swap mt-4">
            <p ref={result} tabIndex={-1} className="flex items-center gap-2.5 text-[1.0625rem] font-semibold tracking-[-0.015em] outline-none">
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-lime">
                <svg viewBox="0 0 12 12" className="size-3">
                  <path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {choice === "accepted" ? "Accepted. Analytics and ads run now." : "Rejected. Nothing extra will load."}
            </p>
            <dl className="mt-3 rounded-[14px] bg-chalk px-4 py-3 text-[0.8125rem]">
              <div className="flex justify-between gap-4 py-0.5">
                <dt className="text-mute-ink">Receipt</dt>
                <dd className="font-[family-name:var(--font-data)]">9f2c 41e0 … a71e</dd>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <dt className="text-mute-ink">Chained to</dt>
                <dd className="font-[family-name:var(--font-data)]">41b0 7d2a … c93d</dd>
              </div>
            </dl>
            <button type="button" onClick={() => choose(null)} className="mk-link mt-3 inline-flex min-h-11 cursor-pointer items-center text-[0.9375rem] font-medium">
              Show the banner again
            </button>
          </div>
        ) : (
          <div key="ask" className="mk-swap mt-4">
            <p className="text-[1.0625rem] font-semibold tracking-[-0.015em]">We use cookies for analytics and ads.</p>
            <p className="mt-1.5 text-[0.9375rem] leading-[1.5] text-mute-ink">Choose what runs on this site. You can change it any time.</p>
            {/* Reject and Accept always carry equal weight */}
            <div className="mt-4 flex gap-2">
              <button ref={reject} type="button" onClick={() => choose("rejected")} className={`${stem} bg-lime hover:bg-lime-deep`}>
                Reject
              </button>
              <button type="button" onClick={() => choose("accepted")} className={`${stem} bg-lime hover:bg-lime-deep`}>
                Accept
              </button>
              <Link href="/cookie-consent" className={`${stem} flex-none bg-chalk hover:bg-[#e6e6e1]`}>
                Choose
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
