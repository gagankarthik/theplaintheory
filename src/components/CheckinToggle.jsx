"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

// Server action imports (you'll need to create these)
import { createCheckin, deleteCheckin } from "@/app/actions/checkins";

export function CheckinToggle({ 
  habitId, 
  day, 
  checked = false, 
  size = "md",
  disabled = false,
  className = "",
  onToggle = null // Optional callback for optimistic updates
}) {
  const [isChecked, setIsChecked] = useState(checked);
  const [isPending, startTransition] = useTransition();

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg"
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  const handleToggle = async () => {
    if (disabled || isPending) return;

    // Optimistic update
    const newCheckedState = !isChecked;
    setIsChecked(newCheckedState);
    
    // Call optional callback for parent component updates
    if (onToggle) {
      onToggle(habitId, day, newCheckedState);
    }

    startTransition(async () => {
      try {
        if (newCheckedState) {
          await createCheckin(habitId, day);
        } else {
          await deleteCheckin(habitId, day);
        }
      } catch (error) {
        // Revert optimistic update on error
        setIsChecked(!newCheckedState);
        if (onToggle) {
          onToggle(habitId, day, !newCheckedState);
        }
        console.error('Failed to toggle checkin:', error);
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || isPending}
      className={cn(
        "rounded-full border-2 flex items-center justify-center font-medium transition-all duration-300 relative overflow-hidden group",
        currentSize,
        {
          // Checked state
          "bg-green-500 border-green-500 text-white shadow-lg hover:bg-green-600 hover:border-green-600 hover:scale-105": isChecked,
          
          // Unchecked state  
          "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-green-400 dark:hover:border-green-400 hover:text-green-500 dark:hover:text-green-400 hover:scale-105": !isChecked,
          
          // Disabled state
          "opacity-50 cursor-not-allowed hover:scale-100": disabled,
          
          // Pending state
          "cursor-wait": isPending,
        },
        className
      )}
      title={isChecked ? "Mark as incomplete" : "Mark as complete"}
      aria-pressed={isChecked}
      aria-label={`${isChecked ? 'Uncheck' : 'Check'} habit for ${day}`}
    >
      {/* Loading spinner */}
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn(
            "animate-spin rounded-full border-2 border-current border-t-transparent",
            size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
          )} />
        </div>
      )}

      {/* Check mark or plus icon */}
      {!isPending && (
        <>
          {isChecked ? (
            <svg 
              className={cn(
                "fill-current transform transition-transform duration-200 group-hover:scale-110",
                size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
              )} 
              viewBox="0 0 20 20"
            >
              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
            </svg>
          ) : (
            <svg 
              className={cn(
                "fill-current transform transition-transform duration-200 group-hover:scale-110",
                size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
              )} 
              viewBox="0 0 20 20"
            >
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
          )}
        </>
      )}

      {/* Success animation */}
      {isChecked && !isPending && (
        <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-30" 
             style={{ animationDuration: '0.6s', animationIterationCount: 1 }} 
        />
      )}
    </button>
  );
}

// Minimal version for tight spaces
export function MiniCheckinToggle({ 
  habitId, 
  day, 
  checked = false, 
  disabled = false,
  className = "",
  onToggle = null
}) {
  const [isChecked, setIsChecked] = useState(checked);
  const [isPending, startTransition] = useTransition();

  const handleToggle = async () => {
    if (disabled || isPending) return;

    const newCheckedState = !isChecked;
    setIsChecked(newCheckedState);
    
    if (onToggle) {
      onToggle(habitId, day, newCheckedState);
    }

    startTransition(async () => {
      try {
        if (newCheckedState) {
          await createCheckin(habitId, day);
        } else {
          await deleteCheckin(habitId, day);
        }
      } catch (error) {
        setIsChecked(!newCheckedState);
        if (onToggle) {
          onToggle(habitId, day, !newCheckedState);
        }
        console.error('Failed to toggle checkin:', error);
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || isPending}
      className={cn(
        "w-6 h-6 rounded border flex items-center justify-center transition-all duration-200",
        {
          "bg-green-500 border-green-500 text-white": isChecked,
          "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-green-400": !isChecked,
          "opacity-50 cursor-not-allowed": disabled || isPending,
        },
        className
      )}
      title={isChecked ? "Uncheck" : "Check"}
    >
      {isPending ? (
        <div className="w-3 h-3 animate-spin rounded-full border border-current border-t-transparent" />
      ) : isChecked ? (
        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
        </svg>
      ) : (
        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
          <path d="M10 3a1 1 0 011 1v5h5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
        </svg>
      )}
    </button>
  );
}