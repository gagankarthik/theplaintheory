import type { ReactNode } from "react";

/** Group of settings rows under a heading, separated by hairlines rather than cards. */
export function SettingsSection({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="mb-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {description ? <p className="mt-1 max-w-[68ch] text-sm text-ink-3">{description}</p> : null}
      </div>
      <div className="divide-y divide-line">{children}</div>
      {footer ? <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{footer}</div> : null}
    </section>
  );
}

/** Left label / right control on desktop; stacks on mobile. `htmlFor` links the label to the control. */
export function SettingsRow({ label, description, htmlFor, children }: { label: ReactNode; description?: ReactNode; htmlFor?: string; children: ReactNode }) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className="grid gap-3 py-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-10">
      <div>
        <Label {...(htmlFor ? { htmlFor } : {})} className="text-sm font-bold text-ink">
          {label}
        </Label>
        {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </div>
  );
}
