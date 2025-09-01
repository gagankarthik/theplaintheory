"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage() {
const [email, setEmail] = useState("");
const [sent, setSent] = useState(false);
const [err, setErr] = useState<string | null>(null);
async function onSubmit(e: React.FormEvent) {
e.preventDefault();
setErr(null);
try {
const origin = window.location.origin;
const { error } = await createClient().auth.signInWithOtp({
email,
options: { emailRedirectTo: `${origin}/callback` },
});
if (error) throw error;
setSent(true);
} catch (e: any) { setErr(e?.message ?? "Something went wrong"); }
}return (
<main className="min-h-screen flex items-center justify-center px-4 bg-white text-black dark:bg-black dark:text-white">
<div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/15 p-6 sm:p-8">
<h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
<p className="mt-2 text-sm opacity-70">We’ll email you a sign‑in link.</p>
{sent ? (
<div className="mt-6 text-sm">
<p>Link sent to</p>
<p className="mt-1 font-medium">{email}</p>
</div>
) : (
<form onSubmit={onSubmit} className="mt-6 space-y-4">
<input type="email" required placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-transparent px-4 py-3 outline-none" />
<button type="submit" className="w-full rounded-xl px-4 py-3 bg-black text-white dark:bg-white dark:text-black">Send link</button>
{err && <p className="text-sm text-red-500">{err}</p>}
</form>
)}
</div>
</main>
);
}