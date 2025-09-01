import Link from "next/link";
import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import WeekStrip from "@/components/WeekStrip";
import { CheckinToggle } from "@/components/CheckinToggle";

// Helper function to calculate streak
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

// Helper function to get last 7 days
function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}

export default async function Dashboard() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji")
    .eq("id", user.id)
    .single();

  // Get habits with more details
  const { data: habits } = await supabase
    .from("habits")
    .select("id, title, emoji, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Get all check-ins for the last 7 days
  const last7Days = getLast7Days();
  const { data: checkins } = await supabase
    .from("checkins")
    .select("habit_id, day")
    .eq("user_id", user.id)
    .gte("day", last7Days[0])
    .lte("day", last7Days[6]);

  // Get buddy info
  const { data: buddy } = await supabase
    .from("buddies")
    .select(`
      buddy_id,
      profiles!buddies_buddy_id_fkey (
        display_name,
        avatar_emoji
      )
    `)
    .eq("owner_id", user.id)
    .single();

  const today = new Date().toISOString().split('T')[0];
  const todaysCheckins = checkins?.filter(c => c.day === today) || [];
  const completedToday = todaysCheckins.length;
  const totalHabits = habits?.length || 0;
  
  // Calculate total streak (sum of all habit streaks)
  const totalStreak = habits?.reduce((sum, habit) => {
    return sum + calculateStreak(checkins, habit.id);
  }, 0) || 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-2xl">
                {profile?.avatar_emoji || "👋"}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Welcome back, {profile?.display_name || user.email?.split('@')[0] || 'there'}!
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/habit/new"
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-sm"
            >
               ➕ New Habit
            </Link>
            <form action="/logout" method="post">
              <button className="text-sm text-red-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Today's Progress</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {completedToday}/{totalHabits}
                </p>
              </div>
              <div className="text-3xl">
                {completedToday === totalHabits && totalHabits > 0 ? "🎉" : "📊"}
              </div>
            </div>
            <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: totalHabits > 0 ? `${(completedToday / totalHabits) * 100}%` : '0%' 
                }}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Streaks</p>
                <p className="text-3xl font-bold text-orange-500">
                  🔥 {totalStreak}
                </p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Habits</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {totalHabits}
                </p>
              </div>
              <div className="text-3xl">🎯</div>
            </div>
          </div>
        </div>

        {/* Buddy Section */}
        {buddy && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {buddy.profiles?.avatar_emoji || "👤"}
                </span>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Accountability Buddy</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {buddy.profiles?.display_name || "Anonymous"}
                  </p>
                </div>
              </div>
              <div className="text-2xl animate-pulse">👏</div>
            </div>
          </div>
        )}

        {/* Habits List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Your Habits
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Last 7 days
            </div>
          </div>

          {habits && habits.length > 0 ? (
            <div className="grid gap-4">
              {habits.map(habit => {
                const habitCheckins = checkins?.filter(c => c.habit_id === habit.id) || [];
                const streak = calculateStreak(checkins, habit.id);
                const todayChecked = habitCheckins.some(c => c.day === today);
                
                return (
                  <div
                    key={habit.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      
                      {/* Habit Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{habit.emoji || "✅"}</span>
                          <div>
                            <Link 
                              href={`/habit/${habit.id}`}
                              className="text-lg font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {habit.title}
                            </Link>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Week Strip */}
                      <div className="flex items-center gap-4">
                        <WeekStrip 
                          habitId={habit.id}
                          checkins={habitCheckins}
                          className="hidden sm:flex"
                        />
                        
                        {/* Today's Check-in Toggle */}
                        <CheckinToggle
                          habitId={habit.id}
                          day={today}
                          checked={todayChecked}
                          size="lg"
                        />
                      </div>
                    </div>

                    {/* Mobile Week Strip */}
                    <div className="mt-4 sm:hidden">
                      <WeekStrip 
                        habitId={habit.id}
                        checkins={habitCheckins}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No habits yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Start building better habits today. Create your first habit and begin your streak journey.
              </p>
              <Link 
                href="/new"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm"
              >
                <span>✨</span>
                Create your first habit
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {habits && habits.length > 0 && (
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/habit/new"
              className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm"
            >
              ➕ Add Habit
            </Link>
            
            {!buddy && (
              <Link 
                href="/buddy"
                className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm"
              >
                🤝 Add Accountability Buddy
              </Link>
            )}
            
            <Link 
              href="/settings"
              className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm"
            >
              ⚙️ Settings
            </Link>
          </div>
        )}

        {/* Motivational Quote */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            {completedToday === totalHabits && totalHabits > 0 
              ? "Perfect day! 🎉 You've completed all your habits." 
              : completedToday > 0 
                ? "Great progress! Keep up the momentum. 💪"
                : "Every expert was once a beginner. Start today! ✨"
            }
          </p>
        </div>
      </div>
    </main>
  );
}