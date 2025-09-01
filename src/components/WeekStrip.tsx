"use client";

import { cn } from "@/lib/utils";

// Helper function to get last 7 days
function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push({
      date: date.toISOString().split("T")[0],
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: date.getDate(),
      isToday: i === 0,
    });
  }
  return days;
}

export default function WeekStrip({
  habitId,
  checkins = [],
  className = "",
  size = "md",
  showLabels = false,
}) {
  const days = getLast7Days();

  // Create a Set of checked days for O(1) lookup
  const checkedDays = new Set(
    checkins
      .filter((checkin) => checkin.habit_id === habitId)
      .map((checkin) => checkin.day)
  );

  const sizeClasses: Record<string, string> = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {showLabels && (
        <div className="flex gap-1 mb-2">
          {days.map((day) => (
            <div
              key={day.date}
              className={cn(
                "text-xs text-gray-500 dark:text-gray-400 text-center",
                currentSize.split(" ")[0] // keep same width as circles
              )}
            >
              {day.dayName}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1">
        {days.map((day) => {
          const isChecked = checkedDays.has(day.date);
          const isToday = day.isToday;

          return (
            <div
              key={day.date}
              className={cn(
                "rounded-full flex items-center justify-center font-medium transition-all duration-300 border-2",
                currentSize,
                {
                  // Checked state
                  "bg-green-500 border-green-500 text-white shadow-sm": isChecked,

                  // Unchecked states
                  "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500":
                    !isChecked && !isToday,

                  // Today (unchecked)
                  "bg-white dark:bg-gray-800 border-indigo-300 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-100 dark:ring-indigo-900":
                    !isChecked && isToday,

                  // Hover
                  "hover:scale-105": true,
                }
              )}
              title={`${day.dayName}, ${day.dayNumber}${
                isToday ? " (Today)" : ""
              } - ${isChecked ? "Completed" : "Not completed"}`}
            >
              {isChecked ? (
                <svg
                  className={cn(
                    "fill-current",
                    size === "sm"
                      ? "w-3 h-3"
                      : size === "lg"
                      ? "w-5 h-5"
                      : "w-4 h-4"
                  )}
                  viewBox="0 0 20 20"
                >
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                </svg>
              ) : (
                <span
                  className={cn(
                    "font-medium",
                    size === "sm"
                      ? "text-[10px]"
                      : size === "lg"
                      ? "text-sm"
                      : "text-xs"
                  )}
                >
                  {day.dayNumber}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {showLabels && (
        <div className="flex gap-1 mt-2">
          {days.map((day) => (
            <div
              key={day.date}
              className={cn(
                "text-xs text-gray-400 dark:text-gray-500 text-center",
                currentSize.split(" ")[0]
              )}
            >
              {day.dayNumber}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Alternative compact version for mobile/small spaces
export function CompactWeekStrip({
  habitId,
  checkins = [],
  className = "",
}) {
  const days = getLast7Days();
  const checkedDays = new Set(
    checkins
      .filter((checkin) => checkin.habit_id === habitId)
      .map((checkin) => checkin.day)
  );

  return (
    <div className={cn("flex gap-0.5", className)}>
      {days.map((day) => {
        const isChecked = checkedDays.has(day.date);
        const isToday = day.isToday;

        return (
          <div
            key={day.date}
            className={cn(
              "w-4 h-4 rounded-sm transition-all duration-200",
              {
                "bg-green-500": isChecked,
                "bg-gray-200 dark:bg-gray-600": !isChecked && !isToday,
                "bg-indigo-200 dark:bg-indigo-700 ring-1 ring-indigo-400":
                  !isChecked && isToday,
              }
            )}
            title={`${day.dayName} - ${
              isChecked ? "Completed" : "Not completed"
            }`}
          />
        );
      })}
    </div>
  );
}
