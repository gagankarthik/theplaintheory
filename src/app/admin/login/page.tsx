import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffLoginForm } from "@/components/admin/staff-auth-forms";
import { getStaffSession } from "@/lib/auth/staff";
import { safeStaffNext } from "@/lib/auth/staff-token";

export const metadata: Metadata = { title: "Staff sign-in" };

export default async function StaffLoginPage(props: PageProps<"/admin/login">) {
  if (await getStaffSession()) redirect("/admin");
  const { next, expired, signed_out } = await props.searchParams;
  const notice = expired === "1" ? { error: "That sign-in took too long or was interrupted. Sign in again." } : signed_out === "1" ? { ok: "You're signed out of the staff console." } : undefined;
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Staff sign-in</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Sign in with your Plain Theory staff account and authenticator app.</p>
      <StaffLoginForm next={typeof next === "string" ? safeStaffNext(next) : undefined} notice={notice} />
    </>
  );
}
