import type { ReactNode } from "react";
import { IconAlert } from "@/components/icons";

/** Group of settings rows in one card: heading on top, rows separated by hairlines, actions in the footer. */
export function SettingsSection({
  title,
  description,
  children,
  footer,
  tone = "default",
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "danger" for irreversible actions: rose edge and heading, so it never reads like ordinary settings */
  tone?: "default" | "danger";
  /** anchor for deep links, e.g. /app/settings#dpo */
  id?: string;
}) {
  const danger = tone === "danger";
  return (
    <section id={id} className={`mb-6 scroll-mt-20 overflow-hidden rounded-[16px] border bg-surface ${danger ? "border-rose/40" : "border-line"}`}>
      <div className={`border-b px-5 py-4 sm:px-6 ${danger ? "border-rose/25 bg-rose-wash/60" : "border-line"}`}>
        <h2 className={`flex items-center gap-2 text-base font-semibold ${danger ? "text-rose" : ""}`}>
          {danger ? <IconAlert size={18} /> : null}
          {title}
        </h2>
        {description ? <p className="mt-0.5 max-w-[68ch] text-sm text-ink-3">{description}</p> : null}
      </div>
      <div className="divide-y divide-line px-5 sm:px-6">{children}</div>
      {footer ? <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper/60 px-5 py-3.5 sm:px-6">{footer}</div> : null}
    </section>
  );
}

/** Left label / right control on desktop; stacks on mobile. `htmlFor` links the label to the control. */
export function SettingsRow({ label, description, htmlFor, children }: { label: ReactNode; description?: ReactNode; htmlFor?: string; children: ReactNode }) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className="grid gap-3 py-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-10">
      <div>
        <Label {...(htmlFor ? { htmlFor } : {})} className="text-sm font-medium text-ink">
          {label}
        </Label>
        {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </div>
  );
}
