"use client";

import { CheckinToggle } from "@/components/CheckinToggle";
import WeekStrip from "@/components/WeekStrip";

export function HabitProgress({ 
  habitId, 
  today, 
  todayChecked, 
  currentStreak, 
  checkins 
}) {
  return (
    <div className="space-y-6">
      {/* Today's Action */}
      <div className="text-center">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {todayChecked ? "Nice work today! 🎉" : "Ready to continue your streak?"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {todayChecked 
              ? "You've completed this habit for today. Great consistency!"
              : "Mark this habit as complete for today to continue your progress."
            }
          </p>
        </div>

        {/* Large Check-in Toggle */}
        <div className="flex justify-center mb-6">
          <CheckinToggle
            habitId={habitId}
            day={today}
            checked={todayChecked}
            size="lg"
          />
        </div>

        {/* Current Streak Display */}
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl border border-orange-200 dark:border-orange-800/50">
          <span className="text-2xl">🔥</span>
          <div className="text-left">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {currentStreak}
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300">
              day{currentStreak === 1 ? '' : 's'} streak
            </div>
          </div>
        </div>
      </div>

      {/* Week Overview */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            This Week's Progress
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your last 7 days at a glance
          </p>
        </div>

        {/* Week Strip */}
        <div className="flex justify-center">
          <WeekStrip
            habitId={habitId}
            checkins={checkins}
            size="lg"
            showLabels={true}
          />
        </div>

        {/* Week Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {checkins?.filter(c => {
                const checkinDate = new Date(c.day);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return checkinDate >= sevenDaysAgo;
              }).length || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Completed
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(((checkins?.filter(c => {
                const checkinDate = new Date(c.day);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return checkinDate >= sevenDaysAgo;
              }).length || 0) / 7) * 100)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Success Rate
            </div>
          </div>
        </div>
      </div>

      {/* Motivational Message */}
      <div className="text-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
        <p className="text-sm text-indigo-700 dark:text-indigo-300">
          {currentStreak === 0 
            ? "Every journey begins with a single step. Start your streak today! 🌱"
            : currentStreak === 1
            ? "Great start! One day down, keep the momentum going! 💪"
            : currentStreak < 7
            ? `${currentStreak} days strong! You're building a solid habit foundation. 🏗️`
            : currentStreak < 21
            ? `${currentStreak} days of consistency! This is becoming second nature. 🌟`
            : `${currentStreak} days of dedication! You've built an incredible habit. 🏆`
          }
        </p>
      </div>
    </div>
  );
}