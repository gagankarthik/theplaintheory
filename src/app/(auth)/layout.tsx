import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptFragment } from "@/components/app/auth/receipt-fragment";
import { Logo } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Two-column auth layout locked to the viewport height on desktop: each column fits the screen and,
 * only if a screen is genuinely too short, scrolls on its own. Short screens compress spacing
 * (`short:` / `shorter:` variants) before anything scrolls.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-10 lg:order-2 lg:min-h-0 lg:overflow-y-auto lg:py-8 short:lg:py-5 shorter:lg:py-3">
        <Link href="/" className="flex min-h-11 w-fit items-center lg:hidden" aria-label="Plain Theory home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10 short:py-6 shorter:py-4">{children}</div>
        <nav aria-label="Legal" className="flex justify-center gap-5 pt-2 text-xs text-ink-3">
          <Link href="/legal/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/security" className="hover:text-ink">
            Security
          </Link>
        </nav>
      </main>

      <aside className="relative hidden overflow-hidden bg-ink text-white lg:order-1 lg:flex lg:min-h-0 lg:flex-col lg:justify-between lg:p-12 short:lg:p-9 xl:p-16 short:xl:p-10">
        <Link href="/" className="flex min-h-11 w-fit items-center" aria-label="Plain Theory home">
          <Logo reverse />
        </Link>
        <div className="space-y-8 short:space-y-6">
          <p className="max-w-[22ch] text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] short:text-[1.625rem]">
            Every choice a visitor makes leaves a receipt you can show an auditor.
          </p>
          <div className="shorter:hidden">
            <ReceiptFragment />
          </div>
        </div>
        <p className="max-w-[44ch] text-sm text-white/55">Built for GDPR in Europe, CCPA in California and the DPDP Act in India.</p>
      </aside>
    </div>
  );
}
