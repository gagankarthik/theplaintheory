"use client";

import { useState, useTransition } from "react";
import { removeBuddy, sendVibe } from "@/app/actions/buddies";

export function BuddyCard({ 
  buddy, 
  relationship = "buddy", // "buddy" or "watching"
  showActions = true 
}) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [vibeStatus, setVibeStatus] = useState(null);

  const handleRemoveBuddy = () => {
    startTransition(async () => {
      try {
        await removeBuddy(buddy.id);
        // Page will refresh due to revalidatePath in the server action
      } catch (error) {
        console.error("Error removing buddy:", error);
      }
    });
  };

  const handleSendVibe = () => {
    startTransition(async () => {
      try {
        await sendVibe(buddy.id);
        setVibeStatus("sent");
        setTimeout(() => setVibeStatus(null), 3000);
      } catch (error) {
        setVibeStatus("error");
        setTimeout(() => setVibeStatus(null), 3000);
      }
    });
  };

  return (
    <div className="bg-gradient-to-r from-gray-50 to-indigo-50 dark:from-gray-700/50 dark:to-indigo-900/20 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
      <div className="flex items-start justify-between">
        {/* Buddy Info */}
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-800 dark:to-purple-800 rounded-full flex items-center justify-center text-3xl">
            {buddy?.avatar_emoji || "👤"}
          </div>
          
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {buddy?.display_name || "Anonymous Buddy"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {relationship === "buddy" 
                ? "Your accountability buddy" 
                : "Watching your progress"
              }
            </p>
            
            {relationship === "buddy" && (
              <div className="flex items-center space-x-4 mt-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>👁️</span>
                  Can see your check-ins
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>🔥</span>
                  Can see your streaks
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && relationship === "buddy" && (
          <div className="flex items-center space-x-2">
            {/* Send Vibe Button */}
            <button
              onClick={handleSendVibe}
              disabled={isPending || vibeStatus === "sent"}
              className={`p-2 rounded-lg transition-all duration-200 ${
                vibeStatus === "sent"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                  : vibeStatus === "error"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
              title={vibeStatus === "sent" ? "Encouragement sent!" : "Send daily encouragement"}
            >
              {vibeStatus === "sent" ? (
                <span className="text-xl">✅</span>
              ) : vibeStatus === "error" ? (
                <span className="text-xl">❌</span>
              ) : isPending ? (
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span className="text-xl">👏</span>
              )}
            </button>

            {/* Remove Button */}
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-500 text-gray-400 hover:text-red-500 transition-all duration-200"
              title="Remove buddy connection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Vibe Status Messages */}
      {vibeStatus && (
        <div className="mt-4">
          {vibeStatus === "sent" && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <span>👏</span>
                Encouragement sent! They'll see your support.
              </p>
            </div>
          )}
          {vibeStatus === "error" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <span>❌</span>
                Failed to send encouragement. Try again later.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md mx-4 shadow-xl">
            <div className="text-center">
              <div className="text-4xl mb-4">😔</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Remove Buddy Connection?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This will disconnect you from <strong>{buddy?.display_name || "your buddy"}</strong>. 
                They won't be able to see your habits anymore, and you won't see theirs.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveBuddy}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Removing..." : "Remove Buddy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}