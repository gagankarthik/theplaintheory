"use client";

import { useState } from "react";

/** What an analytics category typically holds: the scripts and cookies waiting on this one switch. */
const HELD = ["Google Analytics 4 (_ga, _gid)", "Microsoft Clarity (_clck, _clsk)", "Hotjar (_hjSessionUser)"];

/**
 * The control the whole product turns on, at poster size: the visitor's analytics switch from the
 * consent banner. It works. Turning it on releases the held scripts: the field turns from white to
 * lime and the heading says so. Without JavaScript it reads as the held state.
 */
export function ConsentSwitch() {
  const [on, setOn] = useState(false);
  const [touched, setTouched] = useState(false);
  return (
    <section
      id="blocking"
      aria-labelledby="switch-title"
      className={`on-light scroll-mt-16 transition-colors duration-300 ${on ? "bg-lime" : "bg-white"}`}
    >
      <div className="mx-auto grid max-w-[calc(1440px+4rem)] items-start gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 md:gap-12 md:py-24 xl:pb-0">
        {/* The banner's own switch row, built in em and enlarged, at the top where it's seen first. */}
        <div
          data-ui
          className="text-[min(10vw,42px)] md:order-last md:justify-self-end md:text-[min(5.6vw,84px)] xl:flex xl:w-fit xl:flex-col xl:self-stretch"
        >
          <div className="flex w-fit items-center gap-[0.55em] rounded-[0.5em] bg-soot px-[0.55em] py-[0.45em] text-white xl:rounded-b-none">
            <div className="min-w-0">
              <p className="text-[0.62em] font-semibold leading-none tracking-[-0.04em]">Analytics</p>
              {/* phones: larger and allowed to wrap so it stays readable (≥12px); desktop: one line */}
              <p className="mt-[0.18em] max-w-[11em] text-[0.34em] leading-tight text-mute md:max-w-none md:whitespace-nowrap md:text-[0.24em]">{on ? "On" : "Off"} · measures visits and pages</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label="Analytics"
              onClick={() => {
                setOn((v) => !v);
                setTouched(true);
              }}
              className={`relative h-[1.5em] w-[2.7em] shrink-0 cursor-pointer rounded-full ring-1 ring-inset transition-colors duration-300 ${on ? "bg-lime ring-lime" : "bg-soot-3 ring-white/45"} ${touched ? "" : "mk-ping"}`}
            >
              <span
                className={`absolute top-[0.15em] block size-[1.2em] rounded-full bg-white transition-transform duration-300 ease-[var(--ease-spring)] ${
                  on ? "translate-x-[1.35em]" : "translate-x-[0.15em]"
                }`}
              />
              <span className="sr-only">{on ? "On" : "Off"}</span>
            </button>
          </div>
          {/* From xl the card runs on as a black stem, its full width, down to the receipt strip. */}
          <div aria-hidden className="hidden flex-1 bg-soot xl:block" />
        </div>

        <div className="xl:pb-24">
          <h2 id="switch-title" className="text-[clamp(2.25rem,4.2vw,3.75rem)]" aria-live="polite">
            Analytics is{" "}
            <span key={String(on)} className={`mk-swap inline-block rounded-[0.18em] px-[0.12em] -mx-[0.12em] ${on ? "bg-soot text-lime" : ""}`}>
              {on ? "released." : "held."}
            </span>
          </h2>
          {touched ? null : (
            <p className="mt-3 text-[1rem] text-mute-ink md:hidden" aria-hidden>
              Try the switch above.
            </p>
          )}
          <p className="mt-5 max-w-[30rem] text-[1.125rem] leading-[1.55] text-soot">
            {on
              ? "The visitor said yes, so these run now, and their decision is written to the consent log:"
              : "Until a visitor turns a category on, every script in it waits where it is. Nothing loads, nothing is set:"}
          </p>
          <ul className="mt-4 space-y-2 text-[1.125rem] text-soot">
            {HELD.map((h, i) => (
              <li key={h} className="flex items-center gap-3">
                {/* the ring (off) fills and takes a tick (on), one after another */}
                <span aria-hidden className="relative grid size-[1.15em] shrink-0 place-items-center">
                  <span className={`absolute inset-0 rounded-full border-[0.2em] border-soot transition-colors duration-300 ${on ? "bg-soot" : ""}`} style={{ transitionDelay: `${i * 90}ms` }} />
                  <svg
                    viewBox="0 0 12 12"
                    className={`relative size-[0.62em] text-lime transition-[transform,opacity] duration-300 ease-[var(--ease-spring)] ${on ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
                    style={{ transitionDelay: `${i * 90 + 120}ms` }}
                  >
                    <path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className={`transition-opacity duration-300 ${on ? "" : "opacity-70"}`} style={{ transitionDelay: `${i * 90}ms` }}>
                  {h}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
