"use client";

import { useState } from "react";
import { EditHabitModal } from "@/components/EditHabitModal";

export function HabitHeader({ habit, currentStreak, todayChecked }) {
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Habit Info */}
        <div className="flex items-center gap-4">
          <div className="text-5xl">{habit.emoji || "✅"}</div>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {habit.title}
            </h1>
            
            <div className="flex items-center gap-4 mt-2">
              {/* Current Status */}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                todayChecked
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {todayChecked ? (
                  <>
                    <span>✅</span>
                    Done today
                  </>
                ) : (
                  <>
                    <span>⏳</span>
                    Not done today
                  </>
                )}
              </span>

              {/* Streak */}
              {currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                  <span>🔥</span>
                  {currentStreak} day streak
                </span>
              )}

              {/* Public Badge */}
              {habit.is_public && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                  <span>🌐</span>
                  Public
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditHabitModal
          habit={habit}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
}