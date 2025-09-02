"use client";

export function HabitStats({ 
  currentStreak, 
  bestStreak, 
  totalCheckins, 
  last7Rate, 
  last30Rate, 
  daysSinceCreated 
}) {
  const stats = [
    {
      title: "Current Streak",
      value: currentStreak,
      unit: currentStreak === 1 ? "day" : "days",
      icon: "🔥",
      color: "from-orange-500 to-red-500",
      bgColor: "from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20",
      borderColor: "border-orange-200 dark:border-orange-800/50"
    },
    {
      title: "Best Streak",
      value: bestStreak,
      unit: bestStreak === 1 ? "day" : "days",
      icon: "🏆",
      color: "from-yellow-500 to-orange-500",
      bgColor: "from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20",
      borderColor: "border-yellow-200 dark:border-yellow-800/50"
    },
    {
      title: "Total Check-ins",
      value: totalCheckins,
      unit: totalCheckins === 1 ? "time" : "times",
      icon: "✅",
      color: "from-green-500 to-emerald-500",
      bgColor: "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20",
      borderColor: "border-green-200 dark:border-green-800/50"
    },
    {
      title: "7-Day Rate",
      value: last7Rate,
      unit: "%",
      icon: "📈",
      color: "from-blue-500 to-indigo-500",
      bgColor: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
      borderColor: "border-blue-200 dark:border-blue-800/50"
    }
  ];

  return (
    <>
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`bg-gradient-to-br ${stat.bgColor} border ${stat.borderColor} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">{stat.icon}</span>
            <div className={`w-8 h-8 bg-gradient-to-br ${stat.color} rounded-full opacity-20`}></div>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {stat.title}
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {stat.unit}
              </span>
            </div>
          </div>

          {/* Additional context */}
          {stat.title === "7-Day Rate" && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400">30-day rate</span>
                <span className={`font-medium ${
                  last30Rate >= 70 ? 'text-green-600 dark:text-green-400' : 
                  last30Rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 
                  'text-red-600 dark:text-red-400'
                }`}>
                  {last30Rate}%
                </span>
              </div>
            </div>
          )}

          {stat.title === "Total Check-ins" && daysSinceCreated > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400">Overall rate</span>
                <span className={`font-medium ${
                  Math.round((totalCheckins / daysSinceCreated) * 100) >= 70 ? 'text-green-600 dark:text-green-400' : 
                  Math.round((totalCheckins / daysSinceCreated) * 100) >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 
                  'text-red-600 dark:text-red-400'
                }`}>
                  {Math.round((totalCheckins / daysSinceCreated) * 100)}%
                </span>
              </div>
            </div>
          )}

          {stat.title === "Current Streak" && bestStreak > currentStreak && bestStreak > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {currentStreak === 0 
                  ? `Your best was ${bestStreak} days`
                  : `${bestStreak - currentStreak} away from your best`
                }
              </div>
            </div>
          )}

          {stat.title === "Best Streak" && bestStreak > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {bestStreak >= 21 
                  ? "Habit fully formed! 🧠"
                  : bestStreak >= 7
                  ? "Weekly rhythm built 📅"
                  : "Building momentum 💪"
                }
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}