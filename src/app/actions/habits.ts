// /app/actions/habits.ts
"use server";

import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// CREATE
export async function createHabit(data: {
  title: string;
  emoji: string;
  isPublic?: boolean;
}) {
  const supabase = await createClientServer(cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect("/login");
  }

  // validate
  const title = (data.title ?? "").trim();
  if (!title) throw new Error("Habit title is required");
  if (title.length > 40) throw new Error("Habit title must be 40 characters or less");
  if (title.length < 2) throw new Error("Habit title must be at least 2 characters");

  const { data: inserted, error: insertError } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      title,
      emoji: data.emoji || "✅",
      is_public: !!data.isPublic,
      cadence: "daily",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating habit:", insertError);
    throw new Error("Failed to create habit. Please try again.");
  }

  revalidatePath("/dashboard");
  return inserted!.id as string;
}

// PUBLIC (no auth required to read public habits)
export async function getPublicHabit(habitId: string) {
  const supabase = await createClientServer(cookies());

  // Read the public habit (include user_id so we can fetch profile)
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, title, emoji, created_at, user_id")
    .eq("id", habitId)
    .eq("is_public", true)
    .single();

  if (habitError || !habit) {
    throw new Error("Public habit not found");
  }

  // Fetch profile separately (no FK from habits -> profiles in your SQL)
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji")
    .eq("id", habit.user_id)
    .single();

  // Last 7 days checkins
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: checkins } = await supabase
    .from("checkins")
    .select("day")
    .eq("habit_id", habitId)
    .gte("day", sevenDaysAgo.toISOString().split("T")[0])
    .order("day", { ascending: false });

  // Public streak (max 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: streakCheckins } = await supabase
    .from("checkins")
    .select("day")
    .eq("habit_id", habitId)
    .gte("day", thirtyDaysAgo.toISOString().split("T")[0])
    .order("day", { ascending: false });

  let currentStreak = 0;
  if (streakCheckins?.length) {
    const days = new Set(streakCheckins.map((c) => c.day as string));
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const s = d.toISOString().split("T")[0];
      if (days.has(s)) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
  }

  return {
    habit: {
      id: habit.id,
      title: habit.title,
      emoji: habit.emoji,
      created_at: habit.created_at,
      owner: {
        display_name: profile?.display_name ?? null,
        avatar_emoji: profile?.avatar_emoji ?? "👋",
      },
    },
    checkins: checkins ?? [],
    currentStreak,
  };
}

// AUTH UTIL
export async function getCurrentUser() {
  const supabase = await createClientServer(cookies());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }
  return user;
}

// UPDATE
export async function updateHabit(
  habitId: string,
  data: { title?: string; emoji?: string; isPublic?: boolean }
) {
  const supabase = await createClientServer(cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: owned, error: ownErr } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();
  if (ownErr || !owned) throw new Error("Habit not found or access denied");

  const patch: Record<string, any> = {};
  if (data.title !== undefined) {
    const t = data.title.trim();
    if (!t) throw new Error("Habit title is required");
    if (t.length > 40) throw new Error("Habit title must be 40 characters or less");
    if (t.length < 2) throw new Error("Habit title must be at least 2 characters");
    patch.title = t;
  }
  if (data.emoji !== undefined) patch.emoji = data.emoji || "✅";
  if (data.isPublic !== undefined) patch.is_public = !!data.isPublic;

  const { error: updErr } = await supabase
    .from("habits")
    .update(patch)
    .eq("id", habitId)
    .eq("user_id", user.id);
  if (updErr) throw new Error("Failed to update habit");

  revalidatePath("/dashboard");
  revalidatePath(`/habit/${habitId}`);
}

// DELETE
export async function deleteHabit(habitId: string) {
  const supabase = await createClientServer(cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: owned, error: ownErr } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();
  if (ownErr || !owned) throw new Error("Habit not found or access denied");

  const { error: delErr } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", user.id);
  if (delErr) throw new Error("Failed to delete habit");

  revalidatePath("/dashboard");
}

// DETAILS
export async function getHabitDetails(habitId: string) {
  const supabase = await createClientServer(cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: habit, error } = await supabase
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();
  if (error || !habit) throw new Error("Habit not found or access denied");
  return habit;
}

// DETAILS + STATS
export async function getHabitWithStats(habitId: string) {
  const supabase = await createClientServer(cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: habit, error: habitErr } = await supabase
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();
  if (habitErr || !habit) throw new Error("Habit not found or access denied");

  const d = new Date();
  d.setDate(d.getDate() - 30);
  const since = d.toISOString().split("T")[0];

  const { data: checkins } = await supabase
    .from("checkins")
    .select("day")
    .eq("habit_id", habitId)
    .eq("user_id", user.id)
    .gte("day", since)
    .order("day", { ascending: false });

  // streak
  let currentStreak = 0;
  if (checkins?.length) {
    const set = new Set(checkins.map((c) => c.day as string));
    const cur = new Date();
    for (let i = 0; i < 365; i++) {
      const s = cur.toISOString().split("T")[0];
      if (set.has(s)) {
        currentStreak++;
        cur.setDate(cur.getDate() - 1);
      } else break;
    }
  }

  return {
    habit,
    checkins: checkins ?? [],
    stats: {
      currentStreak,
      totalCheckins: checkins?.length ?? 0,
      last30Days: checkins?.length ?? 0,
    },
  };
}

// BULK (kept intact, just returns ids)
export async function bulkCreateHabits(
  habits: Array<{ title: string; emoji: string; isPublic?: boolean }>
) {
  const supabase = await createClientServer(cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  for (const h of habits) {
    const t = (h.title ?? "").trim();
    if (!t) throw new Error("All habit titles are required");
    if (t.length > 40) throw new Error("All habit titles must be 40 characters or less");
  }

  const payload = habits.map((h) => ({
    user_id: user.id,
    title: h.title.trim(),
    emoji: h.emoji || "✅",
    is_public: !!h.isPublic,
    cadence: "daily",
  }));

  const { data: created, error } = await supabase
    .from("habits")
    .insert(payload)
    .select("id");
  if (error) throw new Error("Failed to create habits");

  revalidatePath("/dashboard");
  return created?.map((r) => r.id) ?? [];
}
