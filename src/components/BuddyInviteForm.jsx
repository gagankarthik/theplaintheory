"use client";

import { useState, useTransition } from "react";
import { inviteBuddy } from "@/app/actions/buddies";

export function BuddyInviteForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setSuccess("");

    startTransition(async () => {
      try {
        await inviteBuddy(email.trim(), message.trim());
        setSuccess("Invitation sent! Your buddy will receive an email with instructions to join.");
        setEmail("");
        setMessage("");
      } catch (err) {
        setError(err.message || "Failed to send invitation. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Input */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Buddy's Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          placeholder="friend@example.com"
          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-500 transition-all duration-200"
          disabled={isPending}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          They'll need to create an account if they don't have one
        </p>
      </div>

      {/* Optional Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Personal Message <span className="text-gray-400">(Optional)</span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hey! Want to be accountability buddies on Streaks? It'll help us both stay motivated with our habits!"
          rows={3}
          maxLength={200}
          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-500 transition-all duration-200 resize-none"
          disabled={isPending}
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Add a personal touch to your invitation
          </p>
          <span className="text-xs text-gray-400">{message.length}/200</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <span>❌</span>
            {error}
          </p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
            <span>✅</span>
            {success}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || !email.trim()}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Sending Invitation...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span>📧</span>
            Send Buddy Invitation
          </span>
        )}
      </button>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Your buddy will receive an email with a link to join and connect with you
        </p>
      </div>
    </form>
  );
}