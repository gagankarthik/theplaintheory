"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const origin = window.location.origin;
       const { error } = await createClient().auth.signInWithOtp({
           email,
           options: {
             emailRedirectTo: `${origin}/callback`,
           },
         });

      // Simulate API call for demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setSent(false);
    setEmail("");
    setErr(null);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-white text-black dark:bg-black dark:text-white">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/15 p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm opacity-70">
            We'll email you a secure sign‑in link for instant access.
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            
            <h2 className="text-lg font-medium mb-2">Check your email</h2>
            <div className="text-sm opacity-70 mb-6">
              <p>We sent a magic link to</p>
              <p className="mt-1 font-medium text-black dark:text-white">{email}</p>
              <p className="mt-2">Click the link to sign in instantly.</p>
            </div>

            <button
              onClick={resetForm}
              className="text-sm opacity-70 hover:opacity-100 underline"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <div onSubmit={onSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-transparent px-4 py-3 outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              onClick={onSubmit}
              disabled={loading || !email}
              className="w-full rounded-xl px-4 py-3 bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending link...
                </>
              ) : (
                "Send magic link"
              )}
            </button>

            {err && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-black/10 dark:border-white/15">
          <p className="text-xs text-center opacity-60">
            By continuing, you agree to our Terms of Service and Privacy Policy.
            <br />
            New to our platform? You'll automatically get an account.
          </p>
        </div>
      </div>
    </main>
  );
}