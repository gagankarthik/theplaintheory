"use client";

import { useState, useTransition } from "react";
import { sendBuddyInvite } from "@/app/actions/buddies";

export function BuddyInviteForm() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search for users as they type
  const handleUsernameSearch = async (searchTerm) => {
    setUsername(searchTerm);
    setError("");
    
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults(data.users || []);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectUser = (user) => {
    setUsername(user.username);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (username.length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }

    setError("");
    setSuccess("");

    startTransition(async () => {
      try {
        await sendBuddyInvite(username.trim(), message.trim());
        setSuccess(`Buddy invitation sent to @${username}! They'll receive a notification to accept or decline.`);
        setUsername("");
        setMessage("");
        setSearchResults([]);
      } catch (err) {
        setError(err.message || "Failed to send buddy invitation");
      }
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Username Search */}
        <div className="relative">
          <label htmlFor="username" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Find User by Username
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameSearch(e.target.value)}
              placeholder="Search by username..."
              className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-500 transition-all duration-200"
              disabled={isPending}
              autoComplete="off"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>
          
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectUser(user)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.avatar_emoji || user.display_name?.charAt(0) || "👤"}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      @{user.username}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {user.display_name || "No display name"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Type at least 2 characters to search for users
          </p>
        </div>

        {/* Optional Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Personal Message <span className="text-gray-400">(Optional)</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hey! Want to be accountability buddies? It'll help us both stay motivated with our habits!"
            rows={3}
            maxLength={200}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-500 transition-all duration-200 resize-none"
            disabled={isPending}
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Add a personal touch to your invitation
            </p>
            <span className="text-xs text-gray-400">{message.length}/200</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <span>❌</span>
              {error}
            </p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
              <span>✅</span>
              {success}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending || !username.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Sending Invitation...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>🔔</span>
              Send Buddy Request
            </span>
          )}
        </button>
      </form>

      {/* How It Works */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          <span>ℹ️</span>
          How Buddy Requests Work
        </h4>
        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-6">
          <li>• Search for users by their username</li>
          <li>• Send them an in-app notification request</li>
          <li>• They can accept or decline from their notifications</li>
          <li>• Once accepted, you'll be connected as accountability buddies</li>
        </ul>
      </div>
    </div>
  );
}