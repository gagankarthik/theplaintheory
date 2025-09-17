import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { BuddyInviteForm } from "@/components/BuddyInviteForm";
import { BuddyCard } from "@/components/BuddyCard";
import { BuddyHabitsView } from "@/components/BuddyHabitsView";
import Link from "next/link";

export default async function BuddiesPage() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji")
    .eq("id", user.id)
    .single();

  // Get current buddy (owner perspective)
  const { data: currentBuddy } = await supabase
    .from("buddies")
    .select(`
      buddy_id,
      created_at,
      profiles!buddies_buddy_id_fkey (
        id,
        display_name,
        avatar_emoji
      )
    `)
    .eq("owner_id", user.id)
    .single();

  // Get who has you as buddy (buddy perspective)
  const { data: buddyOf } = await supabase
    .from("buddies")
    .select(`
      owner_id,
      created_at,
      profiles!buddies_owner_id_fkey (
        id,
        display_name,
        avatar_emoji
      )
    `)
    .eq("buddy_id", user.id)
    .single();

  // Get buddy's habits (if you have a buddy)
  let buddyHabits = null;
  let buddyCheckins = null;
  
  if (currentBuddy) {
    const { data: habits } = await supabase
      .from("habits")
      .select("id, title, emoji, created_at")
      .eq("user_id", currentBuddy.buddy_id)
      .order("created_at", { ascending: false });

    if (habits && habits.length > 0) {
      // Get last 7 days of checkins for buddy's habits
      const last7Days = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
      }

      const { data: checkins } = await supabase
        .from("checkins")
        .select("habit_id, day")
        .eq("user_id", currentBuddy.buddy_id)
        .gte("day", last7Days[0])
        .lte("day", last7Days[6]);

      buddyHabits = habits;
      buddyCheckins = checkins || [];
    }
  }

  // Get recent vibes
  const { data: recentVibes } = await supabase
    .from("buddy_vibes")
    .select(`
      day,
      from_user_id,
      to_user_id,
      created_at,
      profiles!buddy_vibes_from_user_id_fkey (
        display_name,
        avatar_emoji
      )
    `)
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .gte("day", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Accountability Buddy
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                Stay motivated with quiet, supportive accountability
              </p>
            </div>
            
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200 backdrop-blur border border-gray-200/50 dark:border-gray-700/50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
          </div>

          {/* Current Buddy Status */}
          {currentBuddy ? (
            <div className="space-y-6">
              {/* Buddy Card */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg">🤝</span>
                    </div>
                    Your Accountability Buddy
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Since {new Date(currentBuddy.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>

                <BuddyCard
                  buddy={currentBuddy.profiles}
                  relationship="buddy"
                  showActions={true}
                />

                {/* Buddy's Habits View */}
                {buddyHabits && buddyHabits.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm">📊</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {currentBuddy.profiles?.display_name || "Your buddy"}'s Habits
                      </h3>
                    </div>
                    <BuddyHabitsView 
                      habits={buddyHabits}
                      checkins={buddyCheckins}
                      buddyId={currentBuddy.buddy_id}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No Buddy - Invitation Flow */
            <div className="space-y-6">
              {/* Hero Card */}
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-8 sm:p-12 text-white shadow-2xl">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-full mb-6">
                    <span className="text-4xl">🤝</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                    Add an Accountability Buddy
                  </h2>
                  <p className="text-lg opacity-90 max-w-2xl mx-auto leading-relaxed">
                    Invite one trusted person to see your habit progress. They'll see your check-ins (✓/✗) 
                    and streaks—nothing more. Perfect for gentle, pressure-free accountability.
                  </p>
                </div>
              </div>

              {/* How It Works */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 sm:p-8 shadow-lg">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">💡</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    How It Works
                  </h3>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  <div className="text-center group">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg">
                      <span className="text-2xl text-white font-bold">1</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">Invite</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      Send an invite to one trusted person via email
                    </p>
                  </div>

                  <div className="text-center group">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg">
                      <span className="text-2xl text-white font-bold">2</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">Connect</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      They join and you're automatically connected
                    </p>
                  </div>

                  <div className="text-center group sm:col-span-2 lg:col-span-1">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200 shadow-lg">
                      <span className="text-2xl text-white font-bold">3</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">Support</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      Share progress and give each other gentle encouragement
                    </p>
                  </div>
                </div>
              </div>

              {/* Invite Form */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 sm:p-8 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">✉️</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Invite Your Buddy
                  </h3>
                </div>
                <BuddyInviteForm />
              </div>
            </div>
          )}

          {/* Someone has you as buddy */}
          {buddyOf && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">👁️</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Watching Your Progress
                </h2>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4 mb-6 border border-orange-200 dark:border-orange-800/50">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong className="text-orange-600 dark:text-orange-400">
                    {buddyOf.profiles?.display_name || "Someone"}
                  </strong> has added you as their accountability buddy.
                  They can see your habit check-ins and streaks.
                </p>
              </div>
              
              <BuddyCard
                buddy={buddyOf.profiles}
                relationship="watching"
                showActions={false}
              />
            </div>
          )}

          {/* Recent Vibes */}
          {recentVibes && recentVibes.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">👏</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Recent Encouragement
                </h3>
              </div>
              
              <div className="grid gap-3 sm:gap-4">
                {recentVibes.map((vibe, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl border border-pink-200 dark:border-pink-800/50 hover:scale-[1.02] transition-all duration-200">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{vibe.profiles?.avatar_emoji || "👤"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        <strong>{vibe.profiles?.display_name || "Someone"}</strong> sent you encouragement
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(vibe.day).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div className="animate-pulse">
                      <span className="text-2xl">👏</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50/50 dark:from-gray-800/50 dark:to-blue-900/20 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🔒</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Privacy & Control
              </h3>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Your buddy only sees habit names, check-ins (✓/✗), and streak counts</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>No personal details, notes, or other data is shared</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>You can remove your buddy connection at any time</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Only one buddy allowed per account for focused accountability</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}