"use client";

import { useState, useTransition } from "react";
import { exportData, deleteAllData } from "@/app/actions/settings";

export function DataSettings({ userStats }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleExportData = () => {
    startTransition(async () => {
      try {
        setError("");
        const data = await exportData();
        
        // Create and download the file
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setSuccess("Data exported successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.message || "Failed to export data");
      }
    });
  };

  const handleDeleteAllData = () => {
    if (deleteConfirmText !== "DELETE ALL MY DATA") {
      setError("Please type 'DELETE ALL MY DATA' to confirm");
      return;
    }

    startTransition(async () => {
      try {
        setError("");
        await deleteAllData();
        setSuccess("All data has been deleted. You will be redirected to login.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } catch (err) {
        setError(err.message || "Failed to delete data");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Data Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {userStats.totalHabits}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Habits</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {userStats.totalCheckins}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Check-ins</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {userStats.hasBuddy ? "1" : "0"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Buddy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round((userStats.totalCheckins * 0.1) * 10) / 10}KB
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Est. Size</div>
        </div>
      </div>

      {/* Export Data */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Export Your Data
        </h4>
        
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Download All Data
              </h5>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Export all your habits, check-ins, and profile data as JSON. This includes everything associated with your account.
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>• All habit information and settings</li>
                <li>• Complete check-in history</li>
                <li>• Profile and preferences</li>
                <li>• Buddy connections (if any)</li>
              </ul>
            </div>
            <button
              onClick={handleExportData}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Exporting...
                </>
              ) : (
                <>
                  <span>📥</span>
                  Export Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Data Retention Info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Data Retention Policy
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>• Your data is stored securely and is never shared with third parties</p>
          <p>• Habit check-ins are kept indefinitely to maintain streak history</p>
          <p>• Deleted habits and their check-ins are permanently removed</p>
          <p>• Account deletion removes all data within 30 days</p>
        </div>
      </div>

      {/* Delete All Data */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">
          Danger Zone
        </h4>
        
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="space-y-4">
            <div>
              <h5 className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                Delete All Data
              </h5>
              <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                This will permanently delete all your habits, check-ins, profile data, and buddy connections. 
                This action cannot be undone.
              </p>
            </div>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete All My Data
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-red-900 dark:text-red-100 mb-2">
                    Type "DELETE ALL MY DATA" to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => {
                      setDeleteConfirmText(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="DELETE ALL MY DATA"
                    className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    disabled={isPending}
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAllData}
                    disabled={isPending || deleteConfirmText !== "DELETE ALL MY DATA"}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {isPending ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                      setError("");
                    }}
                    disabled={isPending}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <span>❌</span>
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
            <span>✅</span>
            {success}
          </p>
        </div>
      )}
    </div>
  );
}