"use server";

import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function updateProfile(profileData) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Update or insert profile
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        ...profileData,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Profile update error:", error);
    throw new Error(error.message || "Failed to update profile");
  }
}

export async function updateNotificationSettings(settings) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Update or insert user preferences
    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Notification settings update error:", error);
    throw new Error(error.message || "Failed to update notification settings");
  }
}

export async function updatePrivacySettings(settings) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Update user preferences
    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Privacy settings update error:", error);
    throw new Error(error.message || "Failed to update privacy settings");
  }
}

export async function updateThemeSettings(settings) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Update user preferences
    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Theme settings update error:", error);
    throw new Error(error.message || "Failed to update theme settings");
  }
}

export async function exportData() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Get all user data
    const [
      { data: profile },
      { data: habits },
      { data: checkins },
      { data: preferences },
      { data: buddies }
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("habits").select("*").eq("user_id", user.id),
      supabase.from("checkins").select("*").eq("user_id", user.id),
      supabase.from("user_preferences").select("*").eq("user_id", user.id).single(),
      supabase.from("buddies").select("*").or(`owner_id.eq.${user.id},buddy_id.eq.${user.id}`)
    ]);

    const exportData = {
      export_date: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: profile || null,
      preferences: preferences || null,
      habits: habits || [],
      checkins: checkins || [],
      buddies: buddies || [],
      total_habits: habits?.length || 0,
      total_checkins: checkins?.length || 0
    };

    return exportData;
  } catch (error) {
    console.error("Data export error:", error);
    throw new Error(error.message || "Failed to export data");
  }
}

export async function deleteAllData() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Delete all user data (order matters due to foreign key constraints)
    await Promise.all([
      supabase.from("buddy_vibes").delete().eq("from_user_id", user.id),
      supabase.from("buddy_vibes").delete().eq("to_user_id", user.id),
      supabase.from("checkins").delete().eq("user_id", user.id),
      supabase.from("buddies").delete().eq("owner_id", user.id),
      supabase.from("buddies").delete().eq("buddy_id", user.id),
      supabase.from("habits").delete().eq("user_id", user.id),
      supabase.from("user_preferences").delete().eq("user_id", user.id),
      supabase.from("profiles").delete().eq("id", user.id)
    ]);

    // Delete the user account
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("User deletion error:", deleteError);
      // Continue anyway as data is already deleted
    }

    return { success: true };
  } catch (error) {
    console.error("Data deletion error:", error);
    throw new Error(error.message || "Failed to delete data");
  }
}

export async function updatePassword(currentPassword, newPassword) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Password update error:", error);
    throw new Error(error.message || "Failed to update password");
  }
}

export async function deleteAccount() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // First delete all data
    await deleteAllData();
    
    // Sign out the user
    await supabase.auth.signOut();
    
    return { success: true };
  } catch (error) {
    console.error("Account deletion error:", error);
    throw new Error(error.message || "Failed to delete account");
  }
}