"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import WeekStrip from "@/components/WeekStrip"; // adjust path if needed

// define a type for checkins
type Checkin = {
  habit_id: string;
  day: string;
};

export default function HabitPage() {
  const params = useParams();
  const habitId = params?.id as string;

  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch checkins for this habit
  useEffect(() => {
    async function fetchCheckins() {
      const res = await fetch(`/api/checkin?habitId=${habitId}`);
      const data: Checkin[] = await res.json();
      setCheckins(data);
    }
    if (habitId) fetchCheckins();
  }, [habitId]);

  // Toggle checkin for a given day
  async function toggleCheckin(day: string) {
    setLoading(true);

    const isChecked = checkins.some(
      (c) => c.habit_id === habitId && c.day === day
    );

    // optimistic update
    setCheckins((prev) =>
      isChecked
        ? prev.filter((c) => !(c.habit_id === habitId && c.day === day))
        : [...prev, { habit_id: habitId, day }]
    );

    await fetch(`/api/checkin`, {
      method: isChecked ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId, day }),
    });

    setLoading(false);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Habit {habitId}</h1>
      <WeekStrip
        habitId={habitId}
        checkins={checkins}
        showLabels
        size="md"
        onDayClick={toggleCheckin}
      />
      {loading && <p className="text-sm text-gray-500 mt-2">Updating...</p>}
    </div>
  );
}
