import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Staff console", template: "%s | Staff console" },
  robots: { index: false, follow: false },
};

/**
 * /admin: the Plain Theory staff console. Two halves with their own layouts:
 * - login/ is the staff sign-in (staff Cognito pool, TOTP required), open to anyone;
 * - (console)/ is the console itself, gated on a staff session in its layout, every page and every action.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
