import { IconChain, IconLock, IconRegion } from "@/components/icons";

const POINTS = [
  { icon: IconLock, title: "Free for one site", body: "No card needed. Upgrade only when you add more." },
  { icon: IconRegion, title: "Your data stays in India", body: "Accounts and consent records are stored in Mumbai." },
  { icon: IconChain, title: "Proof you can show", body: "Every consent decision is a tamper-evident receipt." },
];

/**
 * What someone gets by signing up, under the form.
 */
export function AuthTrust({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  return (
    <ul aria-label="What you get" className={`grid gap-4 ${className}`}>
      {POINTS.map(({ icon: Icon, title, body }) => (
        <li key={title} className={`flex gap-3 ${dark ? "" : "sm:flex-col sm:gap-2.5"}`}>
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-[10px] ring-1 ring-inset ${dark ? "bg-white/[0.07] text-brand-on-ink ring-white/10" : "bg-brand-wash text-brand ring-brand/15"}`}
          >
            <Icon size={18} />
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-semibold ${dark ? "text-white" : "text-ink"}`}>{title}</span>
            <span className={`block text-xs leading-snug ${dark ? "text-white/65" : "text-ink-3"}`}>{body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
