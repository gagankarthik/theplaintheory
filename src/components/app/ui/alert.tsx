import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo } from "@/components/icons";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONE: Record<AlertTone, { box: string; icon: string; title: string }> = {
  info: { box: "border-line-strong bg-surface", icon: "text-ink-2", title: "text-ink" },
  success: { box: "border-success/35 bg-success-wash", icon: "text-success", title: "text-success" },
  warning: { box: "border-warning/35 bg-warning-wash", icon: "text-warning", title: "text-warning" },
  danger: { box: "border-destructive/35 bg-destructive-wash", icon: "text-destructive", title: "text-destructive" },
};
const ICON: Record<AlertTone, typeof IconInfo> = { info: IconInfo, success: IconCheck, warning: IconAlert, danger: IconAlert };

/**
 * A notice on the page: an icon, an optional title, body text and optional actions. Meaning is in
 * the words and the icon; the colour reinforces it. role="alert" for danger (announced at once),
 * role="status" for the rest. Errors belong inline, next to what failed; success goes to a toast.
 */
export function Alert({ tone = "info", title, children, actions, className = "" }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; actions?: ReactNode; className?: string }) {
  const t = TONE[tone];
  const Icon = ICON[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${t.box} ${className}`}>
      <Icon size={18} aria-hidden className={`mt-0.5 shrink-0 ${t.icon}`} />
      <div className="min-w-0 flex-1">
        {title ? <p className={`font-semibold ${t.title}`}>{title}</p> : null}
        {children ? <div className={`text-ink-2 ${title ? "mt-0.5" : ""}`}>{children}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
