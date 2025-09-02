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
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Accountability Buddy
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Stay motivated with quiet, supportive accountability
          </p>
        </div>
        
        <Link
          href="/dashboard"
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Current Buddy Status */}
      {currentBuddy ? (
        <div className="space-y-6">
          {/* Buddy Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🤝</span>
                Your Accountability Buddy
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
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
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {currentBuddy.profiles?.display_name || "Your buddy"}'s Habits
                </h3>
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
          {/* Explanation Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🤝</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Add an Accountability Buddy
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Invite one trusted person to see your habit progress. They'll see your check-ins (✓/✗) 
                and streaks—nothing more. Perfect for gentle, pressure-free accountability.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span>💡</span>
              How It Works
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">1️⃣</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Invite</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send an invite to one trusted person via email
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">2️⃣</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Connect</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  They join and you're automatically connected
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">3️⃣</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Support</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Share progress and give each other gentle encouragement
                </p>
              </div>
            </div>
          </div>

          {/* Invite Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Invite Your Buddy
            </h3>
            <BuddyInviteForm />
          </div>
        </div>
      )}

      {/* Someone has you as buddy */}
      {buddyOf && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>👁️</span>
            Watching Your Progress
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            <strong>{buddyOf.profiles?.display_name || "Someone"}</strong> has added you as their accountability buddy.
            They can see your habit check-ins and streaks.
          </p>
          
          <BuddyCard
            buddy={buddyOf.profiles}
            relationship="watching"
            showActions={false}
          />
        </div>
      )}

      {/* Recent Vibes */}
      {recentVibes && recentVibes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span>👏</span>
            Recent Encouragement
          </h3>
          
          <div className="space-y-3">
            {recentVibes.map((vibe, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-2xl">{vibe.profiles?.avatar_emoji || "👤"}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
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
                <span className="text-2xl animate-pulse">👏</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <span>🔒</span>
          Privacy & Control
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>• Your buddy only sees habit names, check-ins (✓/✗), and streak counts</p>
          <p>• No personal details, notes, or other data is shared</p>
          <p>• You can remove your buddy connection at any time</p>
          <p>• Only one buddy allowed per account for focused accountability</p>
        </div>
      </div>
    </div>
  );
}