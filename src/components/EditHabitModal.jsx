"use client";

import { useState, useTransition } from "react";
import { updateHabit } from "@/app/actions/habits";

const POPULAR_EMOJIS = [
  "💧", "🏃", "📚", "🧘", "💤", "🥗", "💪", "🎵", 
  "✍️", "🧠", "🏠", "📱", "🌱", "🎯", "☀️", "🌙",
  "🎨", "🍎", "🚶", "💻", "📝", "🎪", "🔥", "⭐"
];

export function EditHabitModal({ habit, onClose }) {
  const [title, setTitle] = useState(habit.title);
  const [emoji, setEmoji] = useState(habit.emoji);
  const [isPublic, setIsPublic] = useState(habit.is_public);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [isPending, startTransition] = useTransition();

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
        await updateHabit(habit.id, {
          title: title.trim(),
          emoji: emoji,
          isPublic: isPublic
        });
        onClose();
        // Page will refresh due to revalidatePath in the server action
      } catch (error) {
        setErrors({ submit: error.message || "Failed to update habit. Please try again." });
      }
    });
  };

  const handleEmojiClick = (selectedEmoji) => {
    setEmoji(selectedEmoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Habit
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Emoji Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              Emoji
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-16 h-16 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 bg-white dark:bg-gray-700 flex items-center justify-center text-3xl hover:scale-105 transition-all duration-200 shadow-sm"
              >
                {emoji}
              </button>
              
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-lg z-20 w-72">
                  <div className="grid grid-cols-8 gap-2 mb-4">
                    {POPULAR_EMOJIS.map((emojiOption, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleEmojiClick(emojiOption)}
                        className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-xl transition-colors"
                      >
                        {emojiOption}
                      </button>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      placeholder="Or type any emoji..."
                      className="w-full px-3 py-2 text-center text-xl border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Habit Title
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
              className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all duration-200 ${
                errors.title 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-200 dark:border-gray-600 focus:border-indigo-300 dark:focus:border-indigo-500'
              }`}
              disabled={isPending}
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
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  id="isPublic"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={isPending}
                  className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="isPublic" className="text-sm font-medium text-gray-900 dark:text-white">
                  Make this habit public
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Others can view your progress and streak via a shareable link
                </p>
                {isPublic && (
                  <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                      <span>🔗</span>
                      Public link will be available after saving
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <span>❌</span>
                {errors.submit}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>

          {/* Help Text */}
          <div className="text-center pt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Changes will be saved immediately and visible across all your devices
            </p>
          </div>
        </form>
      </div>

      {/* Click outside to close emoji picker */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}