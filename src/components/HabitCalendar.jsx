"use client";

import { useState } from "react";
import { CheckinToggle } from "@/components/CheckinToggle";

export function HabitCalendar({ checkins, habitId }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Create a set of checked days for O(1) lookup
  const checkedDays = new Set(checkins.map(c => c.day));
  
  // Get calendar data for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get first day of month and how many days in month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  
  // Get previous month's last few days to fill the calendar
  const prevMonth = new Date(year, month - 1, 0);
  const prevMonthDays = prevMonth.getDate();
  
  // Generate calendar grid
  const calendarDays = [];
  
  // Previous month's days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const date = new Date(year, month - 1, day);
    const dateString = date.toISOString().split('T')[0];
    calendarDays.push({
      day,
      date: dateString,
      isCurrentMonth: false,
      isToday: false,
      isChecked: checkedDays.has(dateString)
    });
  }
  
  // Current month's days
  const today = new Date().toISOString().split('T')[0];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().split('T')[0];
    const isToday = dateString === today;
    
    calendarDays.push({
      day,
      date: dateString,
      isCurrentMonth: true,
      isToday,
      isChecked: checkedDays.has(dateString),
      isFuture: date > new Date()
    });
  }
  
  // Next month's days to fill remaining slots
  const remainingSlots = 42 - calendarDays.length; // 6 rows × 7 days
  for (let day = 1; day <= remainingSlots; day++) {
    const date = new Date(year, month + 1, day);
    const dateString = date.toISOString().split('T')[0];
    calendarDays.push({
      day,
      date: dateString,
      isCurrentMonth: false,
      isToday: false,
      isChecked: checkedDays.has(dateString)
    });
  }
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {monthNames[month]} {year}
        </h3>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
          >
            Today
          </button>
          
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((calendarDay, index) => (
          <div
            key={index}
            className={`aspect-square flex items-center justify-center relative ${
              !calendarDay.isCurrentMonth 
                ? 'text-gray-300 dark:text-gray-600' 
                : calendarDay.isToday
                  ? 'font-bold'
                  : ''
            }`}
          >
            {/* Day number */}
            <span className={`text-sm z-10 ${
              calendarDay.isToday 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : calendarDay.isCurrentMonth
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-600'
            }`}>
              {calendarDay.day}
            </span>
            
            {/* Background for checked days */}
            {calendarDay.isChecked && (
              <div className="absolute inset-1 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-400 rounded-lg" />
            )}
            
            {/* Today indicator */}
            {calendarDay.isToday && !calendarDay.isChecked && (
              <div className="absolute inset-1 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg" />
            )}
            
            {/* Interactive toggle for current month days */}
            {calendarDay.isCurrentMonth && !calendarDay.isFuture && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckinToggle
                  habitId={habitId}
                  day={calendarDay.date}
                  checked={calendarDay.isChecked}
                  size="sm"
                  className="opacity-0 hover:opacity-100 transition-opacity"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-400 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-indigo-300 dark:border-indigo-600 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Not completed</span>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {checkins.filter(c => {
              const checkinDate = new Date(c.day);
              return checkinDate.getMonth() === month && checkinDate.getFullYear() === year;
            }).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {Math.round((checkins.filter(c => {
              const checkinDate = new Date(c.day);
              return checkinDate.getMonth() === month && checkinDate.getFullYear() === year;
            }).length / daysInMonth) * 100) || 0}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {daysInMonth - checkins.filter(c => {
              const checkinDate = new Date(c.day);
              return checkinDate.getMonth() === month && checkinDate.getFullYear() === year;
            }).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
        </div>
      </div>
    </div>
  );
}