"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHabit } from "@/app/actions/habits";

const POPULAR_EMOJIS = [
  "💧", "🏃", "📚", "🧘", "💤", "🥗", "💪", "🎵", 
  "✍️", "🧠", "🏠", "📱", "🌱", "🎯", "☀️", "🌙",
  "🎨", "🍎", "🚶", "💻", "📝", "🎪", "🔥", "⭐"
];

const HABIT_SUGGESTIONS = [
  { emoji: "💧", title: "Drink 8 glasses of water" },
  { emoji: "🏃", title: "Morning run" },
  { emoji: "📚", title: "Read for 20 minutes" },
  { emoji: "🧘", title: "Meditate for 10 minutes" },
  { emoji: "💤", title: "Sleep by 10 PM" },
  { emoji: "🥗", title: "Eat a healthy lunch" },
  { emoji: "💪", title: "Do 20 push-ups" },
  { emoji: "✍️", title: "Write in journal" },
];

export function NewHabitForm() {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const [isPublic, setIsPublic] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [errors, setErrors] = useState({});
  const [isPending, startTransition] = useTransition();
  
  const router = useRouter();

  const validateForm = () => {
    const newErrors = {};
    
    if (!title.trim()) {
      newErrors.title = "Habit title is required";
    } else if (title.trim().length > 40) {
      newErrors.title = "Title must be 40 characters or less";
    } else if (title.trim().length < 2) {
      newErrors.title = "Title must be at least 2 characters";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    startTransition(async () => {
      try {
        const habitId = await createHabit({
          title: title.trim(),
          emoji: emoji,
          isPublic: isPublic
        });
        
        // Redirect to the new habit page
        router.push(`/habit/${habitId}`);
      } catch (error) {
        setErrors({ submit: error.message || "Failed to create habit. Please try again." });
      }
    });
  };

  const handleSuggestionClick = (suggestion) => {
    setTitle(suggestion.title);
    setEmoji(suggestion.emoji);
    setShowSuggestions(false);
  };

  const handleEmojiClick = (selectedEmoji) => {
    setEmoji(selectedEmoji);
    setShowEmojiPicker(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Quick Suggestions */}
      {showSuggestions && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Start
            </h3>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Skip suggestions
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {HABIT_SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex items-center gap-3 p-4 text-left bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {suggestion.emoji}
                </span>
                <span className="text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {suggestion.title}
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Or create your own custom habit below
            </p>
          </div>
        </div>
      )}

      {/* Emoji Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
          Choose an emoji
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-20 h-20 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 bg-white dark:bg-gray-700 flex items-center justify-center text-4xl hover:scale-105 transition-all duration-200 shadow-sm"
          >
            {emoji}
          </button>
          
          {showEmojiPicker && (
            <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-xl z-10 w-80">
              <div className="grid grid-cols-8 gap-2">
                {POPULAR_EMOJIS.map((emojiOption, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleEmojiClick(emojiOption)}
                    className="w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-xl transition-colors"
                  >
                    {emojiOption}
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Or type any emoji..."
                  className="w-full px-3 py-2 text-center text-2xl border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value && /\p{Emoji}/u.test(value.charAt(0))) {
                      setEmoji(value.charAt(0));
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title Input */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
          Habit title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) {
              setErrors({ ...errors, title: null });
            }
          }}
          placeholder="e.g., Drink 8 glasses of water"
          maxLength={40}
          className={`w-full px-4 py-4 text-lg border rounded-2xl bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all duration-200 ${
            errors.title 
              ? 'border-red-300 dark:border-red-600' 
              : 'border-gray-200 dark:border-gray-600 focus:border-indigo-300 dark:focus:border-indigo-500'
          }`}
        />
        <div className="flex justify-between items-center mt-2">
          {errors.title && (
            <p className="text-sm text-red-600 dark:text-red-400">{errors.title}</p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
            {title.length}/40
          </p>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center h-5 mt-0.5">
            <input
              id="isPublic"
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-5 h-5 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="isPublic" className="text-sm font-medium text-gray-900 dark:text-white">
              Make this habit public
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Others can see your streak and progress. You can change this later.
            </p>
            {isPublic && (
              <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <p className="text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <span>🔗</span>
                  You'll get a shareable link after creating this habit
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errors.submit && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-6 py-4 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-2xl font-semibold hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="flex-1 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating...
            </span>
          ) : (
            "Create Habit"
          )}
        </button>
      </div>

      {/* Bottom Help */}
      <div className="text-center pt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Don't worry, you can always edit or delete this habit later
        </p>
      </div>
    </form>
  );
}