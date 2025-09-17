import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { ProfileSettings } from "@/components/ProfileSettings";
import { AccountSettings } from "@/components/AccountSettings";
import { NotificationSettings } from "@/components/NotificationSettings";

export default async function SettingsPage() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Get user preferences
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Get user statistics for data overview
  const { data: habitsStats } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", user.id);

  const { data: checkinsStats } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id);

  const { data: buddyConnection } = await supabase
    .from("buddies")
    .select("buddy_id")
    .eq("owner_id", user.id)
    .single();

  const userStats = {
    totalHabits: habitsStats?.length || 0,
    totalCheckins: checkinsStats?.length || 0,
    hasBuddy: !!buddyConnection,
    memberSince: new Date(user.created_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                Manage your account, privacy, and preferences
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

          {/* Account Overview */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl">
                {profile?.avatar_emoji || "👤"}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {profile?.display_name || user.email}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {user.email}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">
                  Member since {userStats.memberSince}
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {userStats.totalHabits}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Habits</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {userStats.totalCheckins}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Check-ins</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {userStats.hasBuddy ? "✓" : "—"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Buddy</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Sections */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Profile Settings */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">👤</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Profile
                </h3>
              </div>
              <ProfileSettings user={user} profile={profile} />
            </div>

           

            {/* Notification Settings */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">🔔</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
              </div>
              <NotificationSettings preferences={preferences} />
            </div>

            
         

          
          </div>

          {/* Help & Support */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50/50 dark:from-gray-800/50 dark:to-blue-900/20 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">❓</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Help & Support
              </h3>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Link 
                href="/help" 
                className="flex items-center gap-2 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
              >
                <span>📖</span>
                <span>Help Center</span>
              </Link>
              <Link 
                href="/contact" 
                className="flex items-center gap-2 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
              >
                <span>💬</span>
                <span>Contact Support</span>
              </Link>
              <Link 
                href="/privacy" 
                className="flex items-center gap-2 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
              >
                <span>🛡️</span>
                <span>Privacy Policy</span>
              </Link>
              <Link 
                href="/terms" 
                className="flex items-center gap-2 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
              >
                <span>📋</span>
                <span>Terms of Service</span>
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-6">
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 inline-block">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">App Version:</span> 1.0.0 • 
                <span className="font-medium"> Last Updated:</span> {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}