import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { IconCheck, IconClock, IconMail, type IconProps } from "@/components/icons";
import { Breadcrumbs } from "../page-hero";

/**
 * Two-column frame for a request form: on small screens the intro, then the form, then the aside;
 * from lg the form sits on the right and the intro and aside share the left column.
 */
export function RequestLayout({
  title,
  lead,
  crumb,
  icon: Icon,
  responseTime,
  next,
  email,
  links,
  children,
}: {
  title: string;
  lead: ReactNode;
  /** last breadcrumb, after Home and Contact */
  crumb: { name: string; href: string };
  icon: ComponentType<IconProps>;
  responseTime: string;
  next: string[];
  email: { address: string; note: string };
  links: { href: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="bg-paper">
      <div className="container-page grid gap-10 py-12 md:py-20 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Contact", href: "/contact" },
              crumb,
            ]}
          />
          <span aria-hidden className="mt-8 grid size-12 place-items-center rounded-[14px] bg-white text-brand ring-1 ring-inset ring-line">
            <Icon size={24} />
          </span>
          <h1 id="page-title" className="display mt-5 text-[2.25rem] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-ink-2">{lead}</p>

          {/* Aside content: shown under the intro on large screens, after the form on small ones */}
          <div className="hidden lg:block">
            <RequestAside responseTime={responseTime} next={next} email={email} links={links} />
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <div className="rounded-[var(--radius-xl)] bg-white p-5 shadow-[var(--shadow-lift)] ring-1 ring-line sm:p-8">{children}</div>
        </div>

        <div className="lg:hidden">
          <RequestAside responseTime={responseTime} next={next} email={email} links={links} />
        </div>
      </div>
    </section>
  );
}

function RequestAside({ responseTime, next, email, links }: { responseTime: string; next: string[]; email: { address: string; note: string }; links: { href: string; label: string }[] }) {
  return (
    <aside aria-label="About this request" className="mt-0 space-y-8 border-t border-line pt-8 lg:mt-10">
      <div className="flex gap-3">
        <IconClock size={20} className="mt-0.5 shrink-0 text-ink" />
        <div>
          <h2 className="text-sm font-semibold">Response time</h2>
          <p className="mt-1 text-[15px] text-ink-2">{responseTime}</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">What happens next</h2>
        <ul className="mt-3 space-y-3">
          {next.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[15px] text-ink-2">
              <IconCheck size={18} className="mt-0.5 shrink-0 text-ink" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-3">
        <IconMail size={20} className="mt-0.5 shrink-0 text-ink" />
        <div>
          <h2 className="text-sm font-semibold">Prefer email?</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            <a href={`mailto:${email.address}`} className="font-medium text-ink underline underline-offset-4 hover:text-brand">
              {email.address}
            </a>
            . {email.note}
          </p>
        </div>
      </div>
      {links.length ? (
        <div>
          <h2 className="text-sm font-semibold">Related</h2>
          <ul className="mt-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center text-[15px] font-medium text-brand underline-offset-4 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
