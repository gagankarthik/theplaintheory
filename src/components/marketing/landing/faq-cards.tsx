"use client";

import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { useState } from "react";
import { Words } from "../motion";

export interface FaqCard {
  topic: string;
  q: string;
  a: string;
  link?: { href: string; label: string };
}

const TONES = ["bg-white text-soot", "bg-lime text-soot", "bg-soot text-white"];

/**
 * Questions filed like index cards in a drawer: each card's tab carries its topic, the strip under it
 * the question. One card is open at a time; opening one pushes the others down.
 */
export function FaqCards({ items }: { items: FaqCard[] }) {
  const [open, setOpen] = useState(0);
  return (
    <section aria-labelledby="faq-title" className="on-light bg-chalk px-5 py-16 sm:px-8 md:py-24">
      <div className="mx-auto max-w-[1440px] md:grid md:grid-cols-12">
        <div className="md:col-span-8 md:col-start-3">
          <h2 id="faq-title" data-reveal="words" className="text-[clamp(2.25rem,4.2vw,3.75rem)]">
            <Words text="Asked before buying" />
          </h2>
          <p className="mb-8 mt-3 flex flex-wrap items-center gap-x-3 text-[1.125rem] leading-[1.55] text-mute-ink">
            Something else? Our team replies within one business day.
            <Link href="/contact?topic=sales" className="inline-flex min-h-11 items-center gap-1.5 font-medium text-soot hover:underline hover:underline-offset-4">
              Book a demo
              <IconArrowRight size={16} />
            </Link>
          </p>
          <ol>
            {items.map((item, i) => {
              const on = i === open;
              const tone = TONES[i % TONES.length];
              return (
                <li key={item.q} data-reveal className={`relative ${i ? "-mt-3" : ""}`} style={{ zIndex: i, "--i": i } as React.CSSProperties}>
                  {/* the tab and the card are one filled shape */}
                  <div
                    className={`${tone} w-fit rounded-t-[14px] px-5 pt-2.5 pb-1 text-[1rem] font-medium`}
                    style={{ marginLeft: `min(${i * 9}%, ${i * 150}px, calc(100% - 9rem))` }}
                  >
                    {item.topic}
                  </div>
                  <div className={`${tone} rounded-[18px] rounded-tl-none`}>
                    <h3>
                      <button
                        type="button"
                        aria-expanded={on}
                        aria-controls={`faq-${i}`}
                        onClick={() => setOpen(on ? -1 : i)}
                        className="group/q flex min-h-[5.5rem] w-full cursor-pointer items-center justify-between gap-6 px-5 py-5 text-left text-[clamp(1.375rem,2vw,1.8rem)] font-medium leading-[1.15] tracking-[-0.025em] sm:px-7"
                      >
                        {item.q}
                        <span aria-hidden className={`size-[0.7em] shrink-0 rounded-full border-[0.18em] border-current transition-[transform,background-color] duration-300 ease-[var(--ease-spring)] ${on ? "scale-75 bg-current" : "group-hover/q:scale-110"}`} />
                      </button>
                    </h3>
                    {/* opens by height; inert while closed, so it leaves the tab order and the reading order */}
                    <div id={`faq-${i}`} className="mk-fold" data-open={on || undefined} inert={!on}>
                      <div>
                        <div className="px-5 pb-8 sm:px-7">
                          <p className="max-w-[50ch] text-[1.125rem] leading-[1.55]">{item.a}</p>
                          {item.link ? (
                            <Link href={item.link.href} className="mk-link mt-4 inline-block font-medium">
                              {item.link.label}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
