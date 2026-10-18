import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/app/auth/auth-forms";
import { getSignedInUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Plain Theory to manage your consent banners, regions, trackers and consent log.",
  alternates: { canonical: "/auth/login" },
};

export default async function LoginPage(props: PageProps<"/auth/login">) {
  if (await getSignedInUser()) redirect("/app");
  const { next, reset, confirmed } = await props.searchParams;
  const notice = reset === "1" ? "Password updated. Sign in with your new password." : confirmed === "1" ? "Email confirmed. Sign in to continue." : undefined;
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Sign in</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Manage your banners, regions and consent records.</p>
      {/* Local development (npm run dev:local) keeps its own accounts; production ones don't exist here. */}
      {process.env.NODE_ENV !== "production" && process.env.AUTH_DRIVER !== "cognito" ? (
        <p className="mb-6 rounded-md bg-info-wash px-3.5 py-2.5 text-sm text-ink-2 ring-1 ring-inset ring-info/30">
          <span className="font-semibold text-info">Local development.</span> This server uses its own test accounts in <code className="font-mono text-xs">.data/</code>, not
          your live account. Create an account here to sign in locally.
        </p>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : undefined} notice={notice} />
    </>
  );
}
