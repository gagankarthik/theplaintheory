import { redirect, notFound } from "next/navigation";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { HabitHeader } from "@/components/HabitHeader";
import { HabitProgress } from "@/components/HabitProgress";
import { HabitCalendar } from "@/components/HabitCalendar";
import { HabitStats } from "@/components/HabitStats";
import { HabitActions } from "@/components/HabitActions";

// Helper function to calculate streak
function calculateStreak(checkins) {
  if (!checkins || checkins.length === 0) return 0;
  
  const sortedDays = checkins
    .map(c => c.day)
    .sort((a, b) => new Date(b) - new Date(a));
  
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);
  
  for (let i = 0; i < 365; i++) { // Max 365 day check
    const dateStr = checkDate.toISOString().split('T')[0];
    if (sortedDays.includes(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

// Helper function to get date ranges
function getDateRanges() {
  const today = new Date();
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  return {
    today: today.toISOString().split('T')[0],
    last7Days: last7Days.toISOString().split('T')[0],
    last30Days: last30Days.toISOString().split('T')[0]
  };
}

export default async function HabitDetailPage({ params }) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const habitId = params.id;
  const { today, last7Days, last30Days } = getDateRanges();

  // Get habit details
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();

  if (habitError || !habit) {
    notFound();
  }

  // Get all checkins for this habit (last 90 days for calendar view)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: checkins } = await supabase
    .from("checkins")
    .select("day, created_at")
    .eq("habit_id", habitId)
    .eq("user_id", user.id)
    .gte("day", ninetyDaysAgo.toISOString().split('T')[0])
    .order("day", { ascending: false });

  // Get user profile for display
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji")
    .eq("id", user.id)
    .single();

  // Calculate statistics
  const currentStreak = calculateStreak(checkins || []);
  const totalCheckins = checkins?.length || 0;
  const last7Checkins = checkins?.filter(c => c.day >= last7Days).length || 0;
  const last30Checkins = checkins?.filter(c => c.day >= last30Days).length || 0;
  const todayChecked = checkins?.some(c => c.day === today) || false;

  // Calculate best streak
  let bestStreak = 0;
  let tempStreak = 0;
  const allDays = checkins?.map(c => c.day).sort() || [];
  
  for (let i = 0; i < allDays.length; i++) {
    if (i === 0 || new Date(allDays[i]).getTime() - new Date(allDays[i-1]).getTime() === 24 * 60 * 60 * 1000) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  // Calculate completion rates
  const last7Rate = Math.round((last7Checkins / 7) * 100);
  const last30Rate = Math.round((last30Checkins / 30) * 100);

  // Get habit creation date
  const createdAt = new Date(habit.created_at);
  const daysSinceCreated = Math.floor((new Date().getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm"
          aria-label="Back to dashboard"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        
        <div className="flex-1">
          <HabitHeader 
            habit={habit}
            currentStreak={currentStreak}
            todayChecked={todayChecked}
          />
        </div>
      </div>

      {/* Today's Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <HabitProgress
          habitId={habitId}
          today={today}
          todayChecked={todayChecked}
          currentStreak={currentStreak}
          checkins={checkins}
        />
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HabitStats
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          totalCheckins={totalCheckins}
          last7Rate={last7Rate}
          last30Rate={last30Rate}
          daysSinceCreated={daysSinceCreated}
        />
      </div>

      {/* Calendar View */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📅</span>
            Progress Calendar
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last 90 days
          </div>
        </div>
        
        <HabitCalendar 
          checkins={checkins || []}
          habitId={habitId}
        />
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>💡</span>
          Insights
        </h2>
        
        <div className="space-y-4">
          {currentStreak > 0 && (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                🔥 <strong>Great momentum!</strong> You're on a {currentStreak}-day streak. 
                {currentStreak >= 7 ? " You've built this into a weekly habit!" : " Keep going to build consistency!"}
              </p>
            </div>
          )}
          
          {last7Rate >= 80 && (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                ⭐ <strong>Excellent consistency!</strong> You've completed this habit {last7Rate}% of the time this week.
              </p>
            </div>
          )}
          
          {last30Rate < 50 && daysSinceCreated > 7 && (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                💪 <strong>Room for improvement.</strong> Try setting a specific time of day for this habit, or reducing the difficulty to build momentum.
              </p>
            </div>
          )}
          
          {bestStreak > currentStreak && bestStreak > 3 && (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                🎯 <strong>You can do it again!</strong> Your best streak was {bestStreak} days. You've proven you can maintain this habit consistently.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <HabitActions 
        habit={habit}
        checkins={checkins || []}
        currentStreak={currentStreak}
        totalCheckins={totalCheckins}
      />

      {/* Sharing */}
      {habit.is_public && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>🔗</span>
            Public Sharing
          </h2>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                <strong>Your habit is public!</strong>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Others can see your progress and streak
              </p>
            </div>
            
            <button
              onClick={() => {
                const url = `${window.location.origin}/u/${profile?.display_name || user.id}/habit/${habitId}`;
                navigator.clipboard.writeText(url);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Created {createdAt.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })} • {daysSinceCreated} day{daysSinceCreated === 1 ? '' : 's'} ago
        </p>
      </div>
    </div>
  );
}