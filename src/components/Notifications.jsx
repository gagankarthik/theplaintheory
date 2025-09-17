"use client";

import { useState, useEffect } from "react";
import { markNotificationRead, respondToBuddyRequest } from "@/app/actions/notifications";

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    // Set up real-time subscription for notifications
    const interval = setInterval(fetchNotifications, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json();
      
      if (response.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
  };

  const handleBuddyRequest = async (notificationId, invitationId, action) => {
    setLoading(true);
    try {
      await respondToBuddyRequest(invitationId, action);
      
      // Remove the notification from the list
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Refresh to get updated state
      setTimeout(fetchNotifications, 1000);
    } catch (err) {
      console.error(`Failed to ${action} buddy request:`, err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const notificationTime = new Date(dateString);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'buddy_request': return '🤝';
      case 'buddy_accepted': return '✅';
      case 'streak_milestone': return '🔥';
      case 'buddy_encouragement': return '👏';
      default: return '🔔';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V7a6 6 0 016-6h6a6 6 0 016 6v4.5" />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notifications Panel */}
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg z-20 max-h-96 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {unreadCount} unread
                  </span>
                )}
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-80">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-4xl mb-2">🔕</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No notifications yet
                  </p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        !notification.is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </span>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                          )}
                          
                          {/* Buddy Request Actions */}
                          {notification.type === 'buddy_request' && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBuddyRequest(notification.id, notification.data.invitation_id, 'accept');
                                }}
                                disabled={loading}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBuddyRequest(notification.id, notification.data.invitation_id, 'decline');
                                }}
                                disabled={loading}
                                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                        
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to full notifications page
                    window.location.href = '/notifications';
                  }}
                  className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
                >
                  View All Notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Full Notifications Page Component
export function NotificationsPage({ notifications, unreadCount }) {
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [loading, setLoading] = useState(false);

  const handleBuddyRequest = async (notificationId, invitationId, action) => {
    setLoading(true);
    try {
      await respondToBuddyRequest(invitationId, action);
      
      // Remove the notification from the list
      setLocalNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error(`Failed to ${action} buddy request:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadNotifications = localNotifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(n => markNotificationRead(n.id))
      );
      
      setLocalNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const notificationTime = new Date(dateString);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'buddy_request': return '🤝';
      case 'buddy_accepted': return '✅';
      case 'streak_milestone': return '🔥';
      case 'buddy_encouragement': return '👏';
      default: return '🔔';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {localNotifications.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔕</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No notifications
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  You're all caught up! Notifications will appear here when you have them.
                </p>
              </div>
            ) : (
              localNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white dark:bg-gray-800 rounded-2xl border p-6 transition-all hover:shadow-md ${
                    !notification.is_read 
                      ? "border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" 
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {notification.title}
                      </h3>
                      {notification.message && (
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                      )}
                      
                      {/* Buddy Request Actions */}
                      {notification.type === 'buddy_request' && (
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={() => handleBuddyRequest(notification.id, notification.data.invitation_id, 'accept')}
                            disabled={loading}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                          >
                            Accept Request
                          </button>
                          <button
                            onClick={() => handleBuddyRequest(notification.id, notification.data.invitation_id, 'decline')}
                            disabled={loading}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    
                    {!notification.is_read && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}