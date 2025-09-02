"use client";

import { CompactWeekStrip } from "@/components/WeekStrip";

// Helper function to calculate streak from checkins
function calculateStreak(checkins, habitId) {
  if (!checkins || checkins.length === 0) return 0;
  
  const habitCheckins = checkins
    .filter(c => c.habit_id === habitId)
    .map(c => c.day)
    .sort((a, b) => new Date(b) - new Date(a));
  
  if (habitCheckins.length === 0) return 0;
  
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);
  
  for (let i = 0; i < habitCheckins.length; i++) {
    const currentDateStr = checkDate.toISOString().split('T')[0];
    if (habitCheckins.includes(currentDateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

export function BuddyHabitsView({ habits, checkins, buddyId }) {
  if (!habits || habits.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
        <div className="text-4xl mb-3">📝</div>
        <p className="text-gray-600 dark:text-gray-400">
          Your buddy hasn't created any habits yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {habits.map((habit) => {
        const habitCheckins = checkins?.filter(c => c.habit_id === habit.id) || [];
        const streak = calculateStreak(checkins, habit.id);
        const today = new Date().toISOString().split('T')[0];
        const completedToday = habitCheckins.some(c => c.day === today);

        return (
          <div
            key={habit.id}
            className="bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-4 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              {/* Habit Info */}
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{habit.emoji || "✅"}</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {habit.title}
                  </h4>
                  <div className="flex items-center space-x-4 mt-1">
                    {/* Current Status */}
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      completedToday
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {completedToday ? '✓ Done today' : '○ Not done today'}
                    </span>
                    
                    {/* Streak */}
                    {streak > 0 && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                        🔥 {streak} day{streak === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Week Strip */}
              <div className="hidden sm:block">
                <CompactWeekStrip
                  habitId={habit.id}
                  checkins={habitCheckins}
                />
              </div>
            </div>

            {/* Mobile Week Strip */}
            <div className="sm:hidden mt-4 flex justify-center">
              <CompactWeekStrip
                habitId={habit.id}
                checkins={habitCheckins}
              />
            </div>
          </div>
        );
      })}

      {/* Summary Stats */}
      <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {habits.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Active Habits
            </div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {checkins?.filter(c => c.day === new Date().toISOString().split('T')[0]).length || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Done Today
            </div>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {habits.reduce((total, habit) => total + calculateStreak(checkins, habit.id), 0)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Total Streak Days
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="text-center mt-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
          <span>🔒</span>
          You can only see habit names, check-ins, and streaks
        </p>
      </div>
    </div>
  );
}