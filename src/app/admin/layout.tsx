import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, type AdminNavId } from "@/components/admin/admin-shell";
import { ButtonLink } from "@/components/app/ui/button";
import { IconShieldCheck, Logo } from "@/components/icons";
import { PLATFORM_ROLE_INFO, canPlatform } from "@/lib/auth/platform";
import { getStaffContext, staffMetadata } from "@/lib/auth/staff";

export const generateMetadata = (): Promise<Metadata> => staffMetadata();

/**
 * Staff console gate. Anyone who isn't Plain Theory staff (signed out, customer, revoked staff) gets
 * the ordinary 404, so the console's existence isn't revealed. Every page and action checks again.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();
  if (ctx.status === "none") notFound();

  if (ctx.status === "mfa") {
    // Production only: staff must enrol in two-factor and sign in with it before the console opens.
    return (
      <div className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
            <Logo />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-2xl px-4 py-12">
          <section role="alert" className="panel p-6 sm:p-8">
            <span className="grid size-11 place-items-center rounded-full bg-amber-wash text-amber" aria-hidden>
              <IconShieldCheck size={22} />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">Two-factor sign-in required</h1>
            <p className="mt-2 text-base text-ink-2">
              {ctx.problem === "enroll"
                ? "The staff console can see every customer's data, so it needs two-factor authentication. Turn it on in your account, then sign in again."
                : "This session didn't pass two-factor. Sign out and sign in again with your authenticator code to open the staff console."}
            </p>
            <ButtonLink className="mt-6" href="/app/account">
              {ctx.problem === "enroll" ? "Turn on two-factor" : "Go to account"}
            </ButtonLink>
          </section>
        </main>
      </div>
    );
  }

  const nav: AdminNavId[] = [
    "overview",
    "orgs",
    "users",
    "staff",
    ...(canPlatform(ctx.role, "platform:audit") ? (["audit"] as const) : []),
  ];

  return (
    <AdminShell user={{ name: ctx.user.name, email: ctx.user.email }} roleLabel={PLATFORM_ROLE_INFO[ctx.role].label} nav={nav}>
      {children}
    </AdminShell>
  );
}
