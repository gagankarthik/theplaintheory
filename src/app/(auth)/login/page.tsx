"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [useOTP, setUseOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendMagicLink() {
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `https://theplaintheory.in/callback`,
      },
    });
    if (error) throw error;
    setSent(true);
  }

  async function sendOTPCode() {
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
    setSent(true);
  }

  async function verifyOTP() {
    const { error } = await createClient().auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (error) throw error;
    // Redirect to dashboard
    window.location.href = '/dashboard';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!sent) {
        // Send magic link or OTP
        if (useOTP) {
          await sendOTPCode();
        } else {
          await sendMagicLink();
        }
      } else {
        // Verify OTP if using OTP method
        if (useOTP) {
          await verifyOTP();
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-white text-black dark:bg-black dark:text-white">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/15 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        
        {sent && !useOTP ? (
          <div className="mt-6 text-sm">
            <p>Magic link sent to</p>
            <p className="mt-1 font-medium">{email}</p>
            <p className="mt-2 text-xs opacity-70">
              Having trouble? <button onClick={() => setUseOTP(true)} className="underline">Try OTP code instead</button>
            </p>
          </div>
        ) : sent && useOTP ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <p className="text-sm">Enter the 6-digit code sent to {email}</p>
            <input
              type="text"
              placeholder="123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-transparent px-4 py-3 outline-none text-center text-2xl tracking-widest"
            />
            <button type="submit" disabled={loading || otp.length !== 6} className="w-full rounded-xl px-4 py-3 bg-black text-white dark:bg-white dark:text-black disabled:opacity-50">
              {loading ? "Verifying..." : "Verify Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <p className="mt-2 text-sm opacity-70">
              {useOTP ? "We'll send you a 6-digit code." : "We'll email you a sign‑in link."}
            </p>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-transparent px-4 py-3 outline-none"
            />
            <button type="submit" disabled={loading} className="w-full rounded-xl px-4 py-3 bg-black text-white dark:bg-white dark:text-black disabled:opacity-50">
              {loading ? "Sending..." : useOTP ? "Send Code" : "Send Link"}
            </button>
            
            <p className="text-center text-sm">
              <button type="button" onClick={() => setUseOTP(!useOTP)} className="underline opacity-70">
                {useOTP ? "Use magic link instead" : "Use code instead"}
              </button>
            </p>
            
            {err && <p className="text-sm text-red-500">{err}</p>}
          </form>
        )}
      </div>
    </main>
  );
}