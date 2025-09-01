import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NewHabitForm } from "@/components/NewHabitForm";
import Link from "next/link";

export default async function NewHabitPage() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's current habit count for display
  const { data: habits, count } = await supabase
    .from("habits")
    .select("id", { count: "exact" })
    .eq("user_id", user.id);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-slate-800">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link 
              href="/dashboard"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Create New Habit
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {count === 0 
                  ? "Start your streak journey" 
                  : `Add to your ${count} existing habit${count === 1 ? '' : 's'}`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg p-8">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Step 1 of 1</span>
              <span>Almost there!</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full w-full transition-all duration-500"></div>
            </div>
          </div>

          {/* Form */}
          <NewHabitForm />

          {/* Tips Section */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              Tips for Success
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/50">
                <div className="text-blue-600 dark:text-blue-400 font-medium mb-1">Start Small</div>
                <div className="text-blue-700 dark:text-blue-300">Begin with 5-10 minutes daily. Consistency beats intensity.</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/50">
                <div className="text-green-600 dark:text-green-400 font-medium mb-1">Be Specific</div>
                <div className="text-green-700 dark:text-green-300">"Read 20 minutes" works better than "Read more".</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/50">
                <div className="text-purple-600 dark:text-purple-400 font-medium mb-1">Stack Habits</div>
                <div className="text-purple-700 dark:text-purple-300">Attach new habits to existing routines.</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-orange-100 dark:border-orange-800/50">
                <div className="text-orange-600 dark:text-orange-400 font-medium mb-1">Track Progress</div>
                <div className="text-orange-700 dark:text-orange-300">Your streaks will motivate you to keep going.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Links */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Need inspiration? Check out our{" "}
            <Link href="/habit-ideas" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              habit ideas
            </Link>{" "}
            or learn about{" "}
            <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              privacy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}