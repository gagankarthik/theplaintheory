"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteHabit } from "@/app/actions/habits";

export function HabitActions({ habit, checkins, currentStreak, totalCheckins }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteHabit(habit.id);
        router.push("/dashboard");
      } catch (error) {
        console.error("Error deleting habit:", error);
      }
    });
  };

  const handleExportCSV = () => {
    const csvContent = [
      ["Date", "Completed", "Day of Week"],
      ...checkins.map(checkin => [
        checkin.day,
        "Yes",
        new Date(checkin.day).toLocaleDateString('en-US', { weekday: 'long' })
      ])
    ];

    const csv = csvContent.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${habit.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_checkins.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    setShowExportOptions(false);
  };

  const handleShareLink = async () => {
    const url = `${window.location.origin}/habit/${habit.id}`;
    try {
      await navigator.clipboard.writeText(url);
      // You could show a toast here
      console.log("Link copied to clipboard");
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <span>⚙️</span>
        Actions
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Export Data */}
        <div className="relative">
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Data
          </button>

          {showExportOptions && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10">
              <button
                onClick={handleExportCSV}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-xl"
              >
                📊 Export as CSV
              </button>
              <button
                onClick={() => {
                  const data = {
                    habit: habit.title,
                    emoji: habit.emoji,
                    totalCheckins,
                    currentStreak,
                    checkins: checkins.map(c => c.day)
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${habit.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_data.json`;
                  link.click();
                  window.URL.revokeObjectURL(url);
                  setShowExportOptions(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-xl"
              >
                📄 Export as JSON
              </button>
            </div>
          )}
        </div>

        {/* Share Link */}
        <button
          onClick={handleShareLink}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Copy Link
        </button>

        {/* Reset Progress */}
        <button
          onClick={() => {
            if (confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
              // You would implement a reset action here
              console.log("Reset progress");
            }
          }}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Progress
        </button>

        {/* Delete Habit */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Habit
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md mx-4 shadow-xl">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Delete "{habit.title}"?
              </h3>
              <div className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
                <p>This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{totalCheckins} check-in{totalCheckins === 1 ? '' : 's'}</li>
                  <li>Your {currentStreak}-day current streak</li>
                  <li>All historical data and analytics</li>
                </ul>
                <p className="font-medium text-red-600 dark:text-red-400 mt-3">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Deleting..." : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close export options */}
      {showExportOptions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowExportOptions(false)}
        />
      )}
    </div>
  );
}