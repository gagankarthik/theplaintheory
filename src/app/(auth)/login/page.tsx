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
  const { next } = await props.searchParams;
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Sign in</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Manage your banners, regions and consent records.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      {process.env.STORE_DRIVER !== "dynamodb" ? (
        <p className="mt-8 rounded-md border short:mt-5 border-dashed border-line-strong px-3 py-2.5 text-xs text-ink-3">
          Local demo: run <code className="font-mono text-ink-2">npm run seed</code>, then sign in as{" "}
          <span className="font-mono text-ink-2">demo@theplaintheory.com</span> / <span className="font-mono text-ink-2">plain-demo-2026</span>
        </p>
      ) : null}
    </>
  );
}
