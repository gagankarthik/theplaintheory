"use client";

import { useState, useTransition } from "react";
import { updateNotificationSettings } from "@/app/actions/settings";

export function NotificationSettings({ preferences }) {
  const [settings, setSettings] = useState({
    daily_reminders: preferences?.daily_reminders ?? true,
    buddy_updates: preferences?.buddy_updates ?? true,
    streak_achievements: preferences?.streak_achievements ?? true,
    weekly_summaries: preferences?.weekly_summaries ?? true,
    reminder_time: preferences?.reminder_time || "09:00",
    reminder_days: preferences?.reminder_days || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const weekDays = [
    { key: "monday", label: "Mon" },
    { key: "tuesday", label: "Tue" },
    { key: "wednesday", label: "Wed" },
    { key: "thursday", label: "Thu" },
    { key: "friday", label: "Fri" },
    { key: "saturday", label: "Sat" },
    { key: "sunday", label: "Sun" }
  ];

  const toggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleDay = (day) => {
    setSettings(prev => ({
      ...prev,
      reminder_days: prev.reminder_days.includes(day)
        ? prev.reminder_days.filter(d => d !== day)
        : [...prev.reminder_days, day]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    startTransition(async () => {
      try {
        await updateNotificationSettings(settings);
        setSuccess("Notification settings updated!");
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.message || "Failed to update settings");
      }
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Notifications */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Email Notifications
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Daily Reminders
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get reminded to check in on your habits
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleSetting('daily_reminders')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.daily_reminders ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
                disabled={isPending}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.daily_reminders ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Buddy Updates
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get notified about your accountability buddy's progress
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleSetting('buddy_updates')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.buddy_updates ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
                disabled={isPending}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.buddy_updates ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Streak Achievements
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Celebrate when you hit streak milestones
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleSetting('streak_achievements')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.streak_achievements ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
                disabled={isPending}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.streak_achievements ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Weekly Summaries
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get a weekly overview of your progress
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleSetting('weekly_summaries')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.weekly_summaries ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
                disabled={isPending}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.weekly_summaries ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Reminder Schedule */}
        {settings.daily_reminders && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Reminder Schedule
            </h4>
            
            {/* Reminder Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reminder Time
              </label>
              <input
                type="time"
                value={settings.reminder_time}
                onChange={(e) => setSettings(prev => ({ ...prev, reminder_time: e.target.value }))}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isPending}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                When to send daily reminders
              </p>
            </div>

            {/* Reminder Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reminder Days
              </label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      settings.reminder_days.includes(day.key)
                        ? "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                        : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                    disabled={isPending}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Select which days to receive reminders
              </p>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <span>❌</span>
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
              <span>✅</span>
              {success}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            "Save Notification Settings"
          )}
        </button>
      </form>

      {/* Browser Notifications */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Browser Notifications
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Get instant notifications in your browser
            </p>
          </div>
          <button
            onClick={() => {
              if ('Notification' in window) {
                Notification.requestPermission().then(permission => {
                  if (permission === 'granted') {
                    new Notification('Notifications enabled!', {
                      body: 'You\'ll now receive browser notifications.',
                      icon: '/icon-192.png'
                    });
                  }
                });
              }
            }}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}