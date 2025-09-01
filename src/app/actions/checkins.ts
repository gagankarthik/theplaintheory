// app/actions/checkins.ts
"use server";

import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCheckin(habitId: string, day: string) {
  const supabase = await createClientServer(cookies());
  
  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Verify the habit belongs to the user
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();

  if (habitError || !habit) {
    throw new Error("Habit not found or access denied");
  }

  // Validate day format (YYYY-MM-DD)
  const dayRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dayRegex.test(day)) {
    throw new Error("Invalid day format. Use YYYY-MM-DD");
  }

  // Insert checkin (will fail if duplicate due to unique constraint)
  const { error: insertError } = await supabase
    .from("checkins")
    .insert({
      habit_id: habitId,
      user_id: user.id,
      day: day
    });

  if (insertError) {
    // If it's a duplicate, that's actually fine - user is just re-checking
    if (insertError.code !== '23505') { // 23505 is unique_violation
      throw new Error(`Failed to create checkin: ${insertError.message}`);
    }
  }

  // Revalidate paths that show this data
  revalidatePath("/dashboard");
  revalidatePath(`/habit/${habitId}`);
}

export async function deleteCheckin(habitId: string, day: string) {
  const supabase = await createClientServer(cookies());
  
  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Verify the habit belongs to the user
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();

  if (habitError || !habit) {
    throw new Error("Habit not found or access denied");
  }

  // Validate day format
  const dayRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dayRegex.test(day)) {
    throw new Error("Invalid day format. Use YYYY-MM-DD");
  }

  // Delete checkin
  const { error: deleteError } = await supabase
    .from("checkins")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", user.id)
    .eq("day", day);

  if (deleteError) {
    throw new Error(`Failed to delete checkin: ${deleteError.message}`);
  }

  // Revalidate paths that show this data
  revalidatePath("/dashboard");
  revalidatePath(`/habit/${habitId}`);
}

// Bulk checkin operation (useful for future features)
export async function bulkCreateCheckins(checkins: Array<{ habitId: string; day: string }>) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Validate all inputs
  const dayRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const checkin of checkins) {
    if (!dayRegex.test(checkin.day)) {
      throw new Error(`Invalid day format for ${checkin.day}. Use YYYY-MM-DD`);
    }
  }

  // Get all habit IDs to verify ownership
  const habitIds = [...new Set(checkins.map(c => c.habitId))];
  const { data: habits, error: habitsError } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", user.id)
    .in("id", habitIds);

  if (habitsError || habits.length !== habitIds.length) {
    throw new Error("One or more habits not found or access denied");
  }

  // Prepare checkin data
  const checkinData = checkins.map(checkin => ({
    habit_id: checkin.habitId,
    user_id: user.id,
    day: checkin.day
  }));

  // Insert all checkins (ignoring duplicates)
  const { error: insertError } = await supabase
    .from("checkins")
    .upsert(checkinData, { 
      onConflict: 'habit_id,day',
      ignoreDuplicates: true 
    });

  if (insertError) {
    throw new Error(`Failed to create checkins: ${insertError.message}`);
  }

  // Revalidate dashboard
  revalidatePath("/dashboard");
  
  // Revalidate individual habit pages
  habitIds.forEach(habitId => {
    revalidatePath(`/habit/${habitId}`);
  });
}

// Get checkin stats (useful for analytics)
export async function getCheckinStats(habitId?: string) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  let query = supabase
    .from("checkins")
    .select("habit_id, day")
    .eq("user_id", user.id);

  if (habitId) {
    // Verify habit ownership
    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("id")
      .eq("id", habitId)
      .eq("user_id", user.id)
      .single();

    if (habitError || !habit) {
      throw new Error("Habit not found or access denied");
    }

    query = query.eq("habit_id", habitId);
  }

  const { data: checkins, error } = await query;

  if (error) {
    throw new Error(`Failed to get checkin stats: ${error.message}`);
  }

  // Calculate stats
  const total = checkins.length;
  const last30Days = checkins.filter(c => {
    const checkinDate = new Date(c.day);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return checkinDate >= thirtyDaysAgo;
  }).length;

  const last7Days = checkins.filter(c => {
    const checkinDate = new Date(c.day);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return checkinDate >= sevenDaysAgo;
  }).length;

  return {
    total,
    last30Days,
    last7Days,
    checkins: checkins.map(c => ({ habitId: c.habit_id, day: c.day }))
  };
}