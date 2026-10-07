import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffVerifyForm } from "@/components/admin/staff-auth-forms";
import { maskEmail } from "@/lib/auth/cognito-errors";
import { getStaffChallenge } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default async function StaffVerifyPage() {
  const challenge = await getStaffChallenge("mfa");
  if (!challenge) redirect("/admin/login?expired=1");
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Check your authenticator</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Enter the current code for {maskEmail(challenge.email)} to open the staff console.</p>
      <StaffVerifyForm />
    </>
  );
}
