import { redirect, notFound } from "next/navigation";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { HabitHeader } from "@/components/HabitHeader";
import { HabitProgress } from "@/components/HabitProgress";
import { HabitCalendar } from "@/components/HabitCalendar";
import { HabitStats } from "@/components/HabitStats";
import { HabitActions } from "@/components/HabitActions";
import { ShareButton } from "@/components/ShareButton";

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

// Server component for insights (no client-side interaction needed)
function InsightsSection({ currentStreak, last7Rate, last30Rate, daysSinceCreated, bestStreak }) {
  const insights = [];

  if (currentStreak > 0) {
    insights.push({
      emoji: "🔥",
      title: "Great momentum!",
      message: `You're on a ${currentStreak}-day streak. ${currentStreak >= 7 ? "You've built this into a weekly habit!" : "Keep going to build consistency!"}`
    });
  }

  if (last7Rate >= 80) {
    insights.push({
      emoji: "⭐",
      title: "Excellent consistency!",
      message: `You've completed this habit ${last7Rate}% of the time this week.`
    });
  }

  if (last30Rate < 50 && daysSinceCreated > 7) {
    insights.push({
      emoji: "💪",
      title: "Room for improvement.",
      message: "Try setting a specific time of day for this habit, or reducing the difficulty to build momentum."
    });
  }

  if (bestStreak > currentStreak && bestStreak > 3) {
    insights.push({
      emoji: "🎯",
      title: "You can do it again!",
      message: `Your best streak was ${bestStreak} days. You've proven you can maintain this habit consistently.`
    });
  }

  if (insights.length === 0) {
    insights.push({
      emoji: "🌱",
      title: "Keep growing!",
      message: "Every day you work on this habit is a step toward building a better you."
    });
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200 dark:border-purple-800/50 p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <span>💡</span>
        Insights & Motivation
      </h2>
      
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div key={index} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-xl p-4 border border-white/50 dark:border-gray-700/50 shadow-sm">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <span className="text-base mr-2">{insight.emoji}</span>
              <strong className="text-gray-900 dark:text-white">{insight.title}</strong> {insight.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function HabitDetailPage({ params }) {
  // Fix: Await params before using
  const resolvedParams = await params;
  const habitId = resolvedParams.id;
  
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              href="/dashboard"
              className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 shadow-sm hover:shadow-md"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            
            <div className="flex-1 min-w-0">
              <HabitHeader 
                habit={habit}
                currentStreak={currentStreak}
                todayChecked={todayChecked}
              />
            </div>
          </div>

          {/* Today's Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <HabitProgress
              habitId={habitId}
              today={today}
              todayChecked={todayChecked}
              currentStreak={currentStreak}
              checkins={checkins}
            />
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-xl sm:text-2xl">📅</span>
                Progress Calendar
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                Last 90 days
              </div>
            </div>
            
            <HabitCalendar 
              checkins={checkins || []}
              habitId={habitId}
            />
          </div>

          {/* Insights */}
          <InsightsSection 
            currentStreak={currentStreak}
            last7Rate={last7Rate}
            last30Rate={last30Rate}
            daysSinceCreated={daysSinceCreated}
            bestStreak={bestStreak}
          />

          {/* Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <HabitActions 
              habit={habit}
              checkins={checkins || []}
              currentStreak={currentStreak}
              totalCheckins={totalCheckins}
            />
          </div>

          {/* Sharing - Client Component */}
          <ShareButton 
            habitId={habitId}
            displayName={profile?.display_name}
            userId={user.id}
            isPublic={habit.is_public}
          />

          {/* Footer */}
          <div className="text-center py-6 sm:py-8">
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 inline-block">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">Created</span> {createdAt.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })} • <span className="font-medium">{daysSinceCreated}</span> day{daysSinceCreated === 1 ? '' : 's'} ago
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}