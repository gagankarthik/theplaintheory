"use client";

import { useState } from "react";

/** What an analytics category typically holds: the scripts and cookies waiting on this one switch. */
const HELD = ["Google Analytics 4 (_ga, _gid)", "Microsoft Clarity (_clck, _clsk)", "Hotjar (_hjSessionUser)"];

/**
 * The visitor's analytics switch from the consent banner, working. Turning it on releases the held
 * scripts: the panel turns lime and says so. Without JavaScript it reads as the held state.
 */
export function ConsentSwitch() {
  const [on, setOn] = useState(false);
  return (
    <div
      id="blocking"
      className={`on-light scroll-mt-4 rounded-[22px] p-5 text-soot transition-colors duration-300 sm:p-7 ${on ? "bg-lime" : "bg-white"}`}
    >
      <p className="text-[1rem] font-medium text-mute-ink">Try the switch your visitors see</p>
      <div data-ui className="mt-4 flex items-center gap-4 rounded-[16px] bg-soot px-5 py-4 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-[1.75rem] font-semibold leading-none tracking-[-0.04em]">Analytics</p>
          <p className="mt-1.5 text-[0.9375rem] leading-tight text-mute">{on ? "On" : "Off"} · measures visits and pages</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Analytics"
          onClick={() => setOn((v) => !v)}
          className={`relative h-11 w-[4.75rem] shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-lime" : "bg-soot-3"}`}
        >
          <span className={`absolute top-1 block size-9 rounded-full bg-white transition-transform duration-300 ${on ? "translate-x-[2.25rem]" : "translate-x-1"}`} />
        </button>
      </div>
      <h2 className="mt-6 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em]" aria-live="polite">
        Analytics is {on ? "released." : "held."}
      </h2>
      <p className="mt-2 text-[1rem] leading-[1.55]">
        {on
          ? "The visitor agreed, so these now run, and the decision is saved to your consent records:"
          : "Until a visitor agrees, every script in this category stays off. Nothing loads and no cookie is set:"}
      </p>
      <ul className="mk-rings mt-3 space-y-1 text-[1rem]">
        {HELD.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
