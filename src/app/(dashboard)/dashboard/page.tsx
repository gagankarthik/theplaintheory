import Link from "next/link";
import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import WeekStrip from "@/components/WeekStrip";
import { CheckinToggle } from "@/components/CheckinToggle";

interface Habit {
  id: string;
  title: string;
  emoji: string | null;
  created_at: string;
}

interface Profile {
  display_name: string | null;
  avatar_emoji: string | null;
}

interface Checkin {
  habit_id: string;
  day: string;
}

interface BuddyProfile {
  display_name: string | null;
  avatar_emoji: string | null;
}

interface Buddy {
  buddy_id: string;
  profiles: BuddyProfile[];
}

// Helper function to calculate streak with proper TypeScript types
function calculateStreak(checkins: Checkin[], habitId: string): number {
  if (!checkins || checkins.length === 0) return 0;

  const habitCheckins = checkins
    .filter(c => c.habit_id === habitId)
    .map(c => c.day)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (habitCheckins.length === 0) return 0;
  
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);
  
  for (let i = 0; i < 365; i++) { // Prevent infinite loops
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
function getLast7Days(): string[] {
  const days: string[] = [];
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

  // Get buddy info with proper typing
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

  // Type-safe data processing
  const habitsData: Habit[] = habits || [];
  const checkinsData: Checkin[] = checkins || [];
  const profileData: Profile | null = profile;
  const buddyData: Buddy | null = buddy;

  const today = new Date().toISOString().split('T')[0];
  const todaysCheckins = checkinsData.filter(c => c.day === today);
  const completedToday = todaysCheckins.length;
  const totalHabits = habitsData.length;
  
  // Calculate total streak (sum of all habit streaks)
  const totalStreak = habitsData.reduce((sum, habit) => {
    return sum + calculateStreak(checkinsData, habit.id);
  }, 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">
                {profileData?.avatar_emoji || "👋"}
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
                Welcome back, {profileData?.display_name || user.email?.split('@')[0] || 'there'}!
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/habit/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]"
            >
              + New Habit
            </Link>
            <form action="/logout" method="post">
              <button className="text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 underline transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
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
            <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: totalHabits > 0 ? `${(completedToday / totalHabits) * 100}%` : '0%' 
                }}
              />
            </div>
            {totalHabits > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {Math.round((completedToday / totalHabits) * 100)}% complete
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Streaks</p>
                <p className="text-3xl font-bold text-orange-500">
                  🔥 {totalStreak}
                </p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {totalStreak === 1 ? 'day total' : 'days total'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Habits</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {totalHabits}
                </p>
              </div>
              <div className="text-3xl">🎯</div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {totalHabits === 1 ? 'habit tracked' : 'habits tracked'}
            </p>
          </div>
        </div>

        {/* Buddy Section */}
        {buddyData && buddyData.profiles && buddyData.profiles.length > 0 && (
          <div className="mb-8 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {buddyData.profiles[0]?.avatar_emoji || "👤"}
                </span>
                <div>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400">Accountability Buddy</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {buddyData.profiles[0]?.display_name || "Anonymous"}
                  </p>
                </div>
              </div>
              <div className="text-2xl animate-pulse">👏</div>
            </div>
          </div>
        )}

        {/* Habits List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Your Habits
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              Last 7 days
            </div>
          </div>

          {habitsData.length > 0 ? (
            <div className="grid gap-4">
              {habitsData.map(habit => {
                const habitCheckins = checkinsData.filter(c => c.habit_id === habit.id);
                const streak = calculateStreak(checkinsData, habit.id);
                const todayChecked = habitCheckins.some(c => c.day === today);
                
                return (
                  <div
                    key={habit.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      
                      {/* Habit Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{habit.emoji || "✅"}</span>
                          <div>
                            <Link 
                              href={`/habit/${habit.id}`}
                              className="text-lg font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {habit.title}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              {streak > 0 ? (
                                <span className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full">
                                  🔥 {streak} day{streak === 1 ? '' : 's'}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                                  No streak yet
                                </span>
                              )}
                              {todayChecked && (
                                <span className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                                  ✓ Done today
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Week Strip and Check-in */}
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <WeekStrip 
                          habitId={habit.id}
                          checkins={habitCheckins}
                          className="hidden sm:flex"
                          size="md"
                        />
                        
                        <CheckinToggle
                          habitId={habit.id}
                          day={today}
                          checked={todayChecked}
                          size="lg"
                        />
                      </div>
                    </div>

                    {/* Mobile Week Strip */}
                    <div className="mt-4 sm:hidden flex justify-center">
                      <WeekStrip 
                        habitId={habit.id}
                        checkins={habitCheckins}
                        size="md"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600">
              <div className="text-8xl mb-6">🎯</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Ready to build lasting habits?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto text-lg">
                Start your journey today. Create your first habit and begin building the life you want.
              </p>
              <Link 
                href="/habit/new"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                <span>✨</span>
                Create your first habit
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {habitsData.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-4 justify-center">
            <Link 
              href="/habit/new"
              className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
            >
              ➕ Add Habit
            </Link>
            
            {!buddyData && (
              <Link 
                href="/buddies"
                className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                🤝 Add Accountability Buddy
              </Link>
            )}
            
            <Link 
              href="/settings"
              className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
            >
              ⚙️ Settings
            </Link>
          </div>
        )}

        {/* Motivational Section */}
        <div className="mt-12 text-center bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-2xl p-8 border border-indigo-100 dark:border-indigo-800/30">
          <div className="text-4xl mb-4">
            {completedToday === totalHabits && totalHabits > 0 
              ? "🎉" 
              : completedToday > 0 
                ? "💪"
                : "✨"
            }
          </div>
          <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
            {completedToday === totalHabits && totalHabits > 0 
              ? "Perfect day! You've completed all your habits." 
              : completedToday > 0 
                ? "Great progress! Keep up the momentum."
                : "Every expert was once a beginner. Start today!"
            }
          </p>
          {totalHabits === 0 && (
            <Link 
              href="/habit/new"
              className="inline-block mt-4 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium underline"
            >
              Create your first habit →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}