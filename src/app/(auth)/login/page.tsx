import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/app/auth/auth-forms";
import { getSignedInUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Plain Theory to manage your consent banners, regions, trackers and consent log.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getSignedInUser()) redirect("/app");
  const { next, reset, confirmed } = await props.searchParams;
  const notice = reset === "1" ? "Password updated. Sign in with your new password." : confirmed === "1" ? "Email confirmed. Sign in to continue." : undefined;
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Sign in</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Manage your banners, regions and consent records.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} notice={notice} />
    </>
  );
}
