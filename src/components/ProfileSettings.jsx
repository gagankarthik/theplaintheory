"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions/settings";

export function ProfileSettings({ user, profile }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarEmoji, setAvatarEmoji] = useState(profile?.avatar_emoji || "👤");
  const [bio, setBio] = useState(profile?.bio || "");
  const [isPublic, setIsPublic] = useState(profile?.is_public || false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const emojiOptions = [
    "👤", "😊", "😎", "🚀", "💪", "🌟", "🎯", "🔥", 
    "⚡", "🌈", "🦄", "🎨", "📚", "🌱", "🏆", "💎"
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    if (displayName.length > 50) {
      setError("Display name must be 50 characters or less");
      return;
    }

    if (bio.length > 200) {
      setError("Bio must be 200 characters or less");
      return;
    }

    startTransition(async () => {
      try {
        await updateProfile({
          display_name: displayName.trim(),
          avatar_emoji: avatarEmoji,
          bio: bio.trim(),
          is_public: isPublic
        });
        setSuccess("Profile updated successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.message || "Failed to update profile");
      }
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            maxLength={50}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isPending}
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This is how others will see you
            </p>
            <span className="text-xs text-gray-400">{displayName.length}/50</span>
          </div>
        </div>

        {/* Avatar Emoji */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Avatar Emoji
          </label>
          <div className="grid grid-cols-8 gap-2">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatarEmoji(emoji)}
                className={`w-10 h-10 text-2xl rounded-lg border-2 transition-all ${
                  avatarEmoji === emoji
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 scale-110"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
                disabled={isPending}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bio <span className="text-gray-400">(Optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell others about yourself..."
            maxLength={200}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            disabled={isPending}
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Visible on your public profile
            </p>
            <span className="text-xs text-gray-400">{bio.length}/200</span>
          </div>
        </div>

        {/* Public Profile */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Public Profile
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Allow others to find and view your profile
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPublic ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
            disabled={isPending}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isPublic ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </form>

      {/* Email Display */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Email Address
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
          {user.email}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Contact support to change your email address
        </p>
      </div>
    </div>
  );
}