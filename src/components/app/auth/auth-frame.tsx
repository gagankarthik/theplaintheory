import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { IconChain, IconHeld, IconServer, IconShieldCheck } from "@/components/icons";
import { ThemeScope } from "@/components/theme/theme";
import { ThemeScript } from "@/components/theme/theme-script";
import { switzer } from "@/app/fonts/switzer";
import "@/app/auth.css";

const CUSTOMER_POINTS = [
  { icon: IconHeld, title: "Tracking waits for a yes", body: "Analytics and advertising tags stay off until visitors agree." },
  { icon: IconChain, title: "Proof you can show", body: "Every choice is kept as a tamper-evident consent record." },
  { icon: IconServer, title: "Stored in India", body: "Accounts and consent records live in Mumbai by default." },
];

const STAFF_POINTS = [
  { icon: IconShieldCheck, title: "Two-factor required", body: "Every staff sign-in needs an authenticator code." },
  { icon: IconChain, title: "Every action audited", body: "Sign-ins and console actions are written to the platform audit log." },
];

/**
 * Frame for every sign-in page: the form column on the left (mark top-left, legal links at the foot) and a
 * calm brand panel on the right with what is true of the product. One column on phones. Follows the
 * dashboard's light or dark theme.
 */
export function AuthFrame({ staff = false, children }: { staff?: boolean; children: React.ReactNode }) {
  const points = staff ? STAFF_POINTS : CUSTOMER_POINTS;
  return (
    <div className={`auth ${switzer.variable} grid min-h-dvh bg-surface text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]`}>
      <ThemeScript />
      <ThemeScope />
      <a href="#main" className="sr-only z-[100] rounded-full bg-brand-solid px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Plain Theory home" className="inline-flex min-h-11 items-center gap-2.5">
            <BrandMark size={26} variant="mono" />
            <span className="text-[1.0625rem] font-semibold tracking-[-0.035em]">Plain Theory</span>
          </Link>
          {staff ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-amber-bright px-2.5 text-xs font-bold text-[#10131f]">
              <IconShieldCheck size={14} />
              Staff console
            </span>
          ) : null}
        </div>
        <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center py-10 outline-none">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 text-[0.8125rem] text-ink-3">
          <Link href="/legal/privacy" className="inline-flex min-h-11 items-center hover:text-ink">
            Privacy
          </Link>
          <Link href="/legal/terms" className="inline-flex min-h-11 items-center hover:text-ink">
            Terms
          </Link>
          <Link href="/contact?topic=support" className="inline-flex min-h-11 items-center hover:text-ink">
            Help
          </Link>
          {staff ? (
            <Link href="/login" className="inline-flex min-h-11 items-center hover:text-ink">
              Customer sign-in
            </Link>
          ) : null}
        </nav>
      </div>

      <aside aria-label={staff ? "About the staff console" : "About Plain Theory"} className="relative hidden overflow-hidden bg-[#0f0f0f] text-white lg:block">
        <svg aria-hidden viewBox="0 0 166 180" className="absolute -bottom-[14%] -right-[20%] h-[48%] w-auto">
          <rect x="0" y="0" width="36" height="180" rx="18" fill="#262626" />
          <path d="M166 60a60 60 0 1 1-120 0 60 60 0 1 1 120 0z M132 60a26 26 0 1 0-52 0 26 26 0 1 0 52 0z" fill="#dafa9c" fillRule="evenodd" />
        </svg>
        <div className="relative flex h-full max-w-[480px] flex-col justify-center px-12 py-16">
          <p className="text-[clamp(2.25rem,3.6vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.045em]">{staff ? "Staff console" : "Consent, made plain."}</p>
          <ul className="mt-10 space-y-6">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#1a1a1a] text-[#dafa9c]">
                  <Icon size={20} />
                </span>
                <span>
                  <span className="block text-[1rem] font-semibold">{title}</span>
                  <span className="mt-0.5 block text-[0.9375rem] leading-[1.5] text-white/75">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
