import type { Metadata } from "next";
import { AuthFrame } from "@/components/app/auth/auth-frame";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Account pages (sign up, verify, sign in, password reset): one form beside the brand panel. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
