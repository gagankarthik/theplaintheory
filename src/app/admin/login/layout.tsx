import Link from "next/link";
import { IconShieldCheck, Logo } from "@/components/icons";

/**
 * Staff sign-in frame: the console's ink top bar (so it never reads as the customer sign-in), one
 * centred card, and a line on what the console is.
 */
export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <a
        href="#main"
        className="sr-only z-[100] rounded-full bg-brand px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <header className="bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Plain Theory home" className="inline-flex min-h-11 items-center rounded-[8px]">
            <Logo reverse size={22} />
          </Link>
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-amber-bright px-2.5 text-xs font-bold text-ink">
            <IconShieldCheck size={14} />
            Staff console
          </span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 justify-center px-4 py-10 outline-none sm:py-16">
        <div className="w-full max-w-[520px]">
          <div className="rounded-[24px] bg-surface p-6 shadow-[var(--shadow-float)] ring-1 ring-line sm:p-10">{children}</div>
          <p className="mt-6 text-center text-xs leading-5 text-ink-3">
            For Plain Theory staff only. Customers sign in at{" "}
            <Link href="/login" className="underline underline-offset-2 hover:text-ink">
              theplaintheory.in/login
            </Link>
            . Every sign-in and console action is audited.
          </p>
        </div>
      </main>
    </div>
  );
}
