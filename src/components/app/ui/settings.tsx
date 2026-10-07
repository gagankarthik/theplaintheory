import type { ReactNode } from "react";
import { IconAlert } from "@/components/icons";
import { Card, CardFooter, CardHeader } from "./card";

/** Group of settings rows in one Card: heading on top, rows separated by hairlines, actions in the footer. */
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
  return (
    <Card id={id} tone={tone} className="mb-6 scroll-mt-20">
      <CardHeader title={title} description={description} icon={tone === "danger" ? <IconAlert size={18} /> : undefined} />
      <div className="divide-y divide-line px-5 sm:px-6">{children}</div>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
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
