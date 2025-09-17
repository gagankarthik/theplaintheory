"use client";

export function ShareButton({ habitId, displayName, userId, isPublic }) {
  const handleCopyLink = () => {
    const url = `${window.location.origin}/u/${displayName || userId}/habit/${habitId}`;
    navigator.clipboard.writeText(url).then(() => {
      // You could add a toast notification here
      alert('Link copied to clipboard!');
    });
  };

  if (!isPublic) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <span>🔗</span>
        Public Sharing
      </h2>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-200 dark:border-green-800/50">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            🌟 Your habit is public!
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Others can see your progress and get inspired by your streak
          </p>
        </div>
        
        <button
          onClick={handleCopyLink}
          className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          📋 Copy Link
        </button>
      </div>
    </div>
  );
}