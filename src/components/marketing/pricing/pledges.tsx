import type { ReactNode } from "react";

/**
 * Billing promises, each answering a recurring complaint about CMP vendors (per-domain fees,
 * banners switched off at a cap, surprise charges, hard cancellation, lock-in, review nagging).
 */
const PLEDGES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Priced per account, not per domain",
    body: "Add a site, a staging domain or a client microsite and your bill stays the same until you reach the plan's site count.",
    icon: <path d="M4 7.5h16M4 12h16M4 16.5h10" />,
  },
  {
    title: "Your banner never switches off",
    body: "Go over your banner views and consent keeps working. Usage is on your Billing page, you get 30 days to decide, and going over never charges you automatically.",
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </>
    ),
  },
  {
    title: "No surprise upgrades",
    body: "We never move you to a bigger plan automatically. Plan changes happen when you click the button, not before.",
    icon: (
      <>
        <path d="M12 4v10" />
        <path d="M8 10l4 4 4-4" />
        <path d="M5 19h14" />
      </>
    ),
  },
  {
    title: "Cancel in one click",
    body: "Cancel or downgrade from Billing in the dashboard. No call, no email chain, no retention offer in the way.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </>
    ),
  },
  {
    title: "Your records leave with you",
    body: "Export the full consent log, the chain proof and the Evidence Pack at any time, including for 30 days after you cancel.",
    icon: (
      <>
        <path d="M12 4v10M8 10l4 4 4-4" />
        <path d="M4.5 15.5V18a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
      </>
    ),
  },
  {
    title: "No nagging",
    body: "No pop-ups asking for a review, no upsell banners in your dashboard, no features quietly moved behind a paywall.",
    icon: (
      <>
        <path d="M5 17V9a7 7 0 0 1 14 0v8" />
        <path d="M3.5 17h17M10 20h4" />
        <path d="M4 4l16 16" />
      </>
    ),
  },
];

export function Pledges() {
  return (
    <ul className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
      {PLEDGES.map((p) => (
        <li key={p.title} className="bg-ink p-6 sm:p-7">
          <svg
            aria-hidden
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-on-ink"
          >
            {p.icon}
          </svg>
          <h3 className="mt-5 text-base font-semibold text-white">{p.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-white/75">{p.body}</p>
        </li>
      ))}
    </ul>
  );
}
