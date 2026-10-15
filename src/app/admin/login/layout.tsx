import { AuthFrame } from "@/components/app/auth/auth-frame";

/** Staff sign-in: the same frame as customer sign-in, marked as the staff console so it never reads as the customer one. */
export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame staff>{children}</AuthFrame>;
}
