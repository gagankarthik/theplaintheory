// app/actions/buddies.ts
"use server";

import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function inviteBuddy(email: string, message?: string) {
  const supabase = await createClientServer(cookies());
  
  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji")
    .eq("id", user.id)
    .single();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Please enter a valid email address");
  }

  // Check if user already has a buddy
  const { data: existingBuddy } = await supabase
    .from("buddies")
    .select("buddy_id")
    .eq("owner_id", user.id)
    .single();

  if (existingBuddy) {
    throw new Error("You already have an accountability buddy. Remove your current buddy first.");
  }

  // Check if trying to invite themselves
  if (email.toLowerCase() === user.email?.toLowerCase()) {
    throw new Error("You cannot invite yourself as a buddy");
  }

  // Check if the invited person exists in the system by looking in profiles
  // Since we can't use auth.admin.listUsers in client-side code, we'll check profiles table
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id) // This is a workaround - in reality you'd need to store email in profiles or use a different approach
    .single();

  // For now, we'll implement a simpler approach where users need to know each other's profile ID
  // In a real app, you'd implement an invitation system with email tokens
  
  // Since we can't easily check if an email exists without admin access,
  // we'll create an invitation record that can be claimed later
  const { error: invitationError } = await supabase
    .from("buddy_invitations") // You'll need to create this table
    .insert({
      inviter_id: user.id,
      invited_email: email,
      message: message || "",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    });

  if (invitationError) {
    console.error("Error creating invitation:", invitationError);
    throw new Error("Failed to send invitation. Please try again.");
  }

  console.log(`Invitation created for: ${email}`);
  console.log(`From: ${profile?.display_name || user.email}`);
  console.log(`Message: ${message || "Default invitation message"}`);

  // Revalidate the buddies page
  revalidatePath("/buddies");
  revalidatePath("/dashboard");
}

// Alternative function for direct buddy connection by user ID
export async function connectBuddy(buddyUserId: string) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Check if user already has a buddy
  const { data: existingBuddy } = await supabase
    .from("buddies")
    .select("buddy_id")
    .eq("owner_id", user.id)
    .single();

  if (existingBuddy) {
    throw new Error("You already have an accountability buddy. Remove your current buddy first.");
  }

  // Check if trying to add themselves
  if (buddyUserId === user.id) {
    throw new Error("You cannot add yourself as a buddy");
  }

  // Verify the buddy user exists
  const { data: buddyProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", buddyUserId)
    .single();

  if (!buddyProfile) {
    throw new Error("User not found");
  }

  // Check if they already have each other as buddies
  const { data: existingConnection } = await supabase
    .from("buddies")
    .select("*")
    .or(`and(owner_id.eq.${user.id},buddy_id.eq.${buddyUserId}),and(owner_id.eq.${buddyUserId},buddy_id.eq.${user.id})`)
    .single();

  if (existingConnection) {
    throw new Error("You're already connected as buddies with this person");
  }

  // Create the buddy relationship
  const { error: buddyError } = await supabase
    .from("buddies")
    .insert({
      owner_id: user.id,
      buddy_id: buddyUserId
    });

  if (buddyError) {
    console.error("Error creating buddy relationship:", buddyError);
    throw new Error("Failed to connect as buddies. Please try again.");
  }

  // Revalidate pages
  revalidatePath("/buddies");
  revalidatePath("/dashboard");
}

export async function removeBuddy(buddyId: string) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Remove the buddy relationship
  const { error: removeError } = await supabase
    .from("buddies")
    .delete()
    .eq("owner_id", user.id)
    .eq("buddy_id", buddyId);

  if (removeError) {
    console.error("Error removing buddy:", removeError);
    throw new Error("Failed to remove buddy connection. Please try again.");
  }

  // Also remove any buddy vibes between them
  await supabase
    .from("buddy_vibes")
    .delete()
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${buddyId}),and(from_user_id.eq.${buddyId},to_user_id.eq.${user.id})`);

  // Revalidate pages
  revalidatePath("/buddies");
  revalidatePath("/dashboard");
}

export async function sendVibe(buddyId: string) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Verify buddy relationship exists
  const { data: buddyRelation, error: relationError } = await supabase
    .from("buddies")
    .select("*")
    .eq("owner_id", user.id)
    .eq("buddy_id", buddyId)
    .single();

  if (relationError || !buddyRelation) {
    throw new Error("Buddy relationship not found");
  }

  const today = new Date().toISOString().split('T')[0];

  // Check if vibe already sent today
  const { data: existingVibe } = await supabase
    .from("buddy_vibes")
    .select("id")
    .eq("from_user_id", user.id)
    .eq("to_user_id", buddyId)
    .eq("day", today)
    .single();

  if (existingVibe) {
    throw new Error("You've already sent encouragement today!");
  }

  // Send the vibe
  const { error: vibeError } = await supabase
    .from("buddy_vibes")
    .insert({
      from_user_id: user.id,
      to_user_id: buddyId,
      day: today
    });

  if (vibeError) {
    console.error("Error sending vibe:", vibeError);
    throw new Error("Failed to send encouragement. Please try again.");
  }

  // Revalidate pages
  revalidatePath("/buddies");
  revalidatePath("/dashboard");
}

export async function acceptBuddyInvitation(invitationToken: string) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // In a real implementation, you'd:
  // 1. Verify the invitation token
  // 2. Get the inviter's user ID from the token
  // 3. Create the buddy relationship
  // 4. Clean up the invitation record
  
  // This is a placeholder for the full invitation system
  throw new Error("Invitation system not fully implemented yet");
}

export async function getBuddyStats(buddyId: string) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Verify buddy relationship
  const { data: buddyRelation } = await supabase
    .from("buddies")
    .select("*")
    .eq("owner_id", user.id)
    .eq("buddy_id", buddyId)
    .single();

  if (!buddyRelation) {
    throw new Error("Buddy relationship not found");
  }

  // Get buddy's habit count
  const { data: habits, count: habitCount } = await supabase
    .from("habits")
    .select("id", { count: "exact" })
    .eq("user_id", buddyId);

  // Get buddy's recent checkins (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: checkins, count: checkinCount } = await supabase
    .from("checkins")
    .select("day", { count: "exact" })
    .eq("user_id", buddyId)
    .gte("day", thirtyDaysAgo.toISOString().split('T')[0]);

  // Get today's checkins
  const today = new Date().toISOString().split('T')[0];
  const { data: todayCheckins, count: todayCount } = await supabase
    .from("checkins")
    .select("id", { count: "exact" })
    .eq("user_id", buddyId)
    .eq("day", today);

  return {
    totalHabits: habitCount || 0,
    totalCheckins: checkinCount || 0,
    todayCheckins: todayCount || 0,
    completionRate: habitCount ? Math.round(((todayCount || 0) / habitCount) * 100) : 0
  };
}

// Utility function to get mutual buddy relationships
export async function getMutualBuddies() {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  // Get users who have you as buddy AND you have them as buddy
  // First get all your buddies
  const { data: yourBuddies } = await supabase
    .from("buddies")
    .select("buddy_id")
    .eq("owner_id", user.id);

  if (!yourBuddies || yourBuddies.length === 0) {
    return [];
  }

  const buddyIds = yourBuddies.map(b => b.buddy_id);

  // Then check which of your buddies also have you as their buddy
  const { data: mutualBuddies } = await supabase
    .from("buddies")
    .select(`
      owner_id,
      profiles!buddies_owner_id_fkey (
        id,
        display_name,
        avatar_emoji
      )
    `)
    .eq("buddy_id", user.id)
    .in("owner_id", buddyIds);

  return mutualBuddies || [];
}

// Get pending invitations sent by the user
export async function getPendingInvitations() {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  const { data: invitations } = await supabase
    .from("buddy_invitations")
    .select("*")
    .eq("inviter_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return invitations || [];
}

// Cancel a pending invitation
export async function cancelInvitation(invitationId: string) {
  const supabase = await createClientServer(cookies());
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("buddy_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("inviter_id", user.id);

  if (error) {
    throw new Error("Failed to cancel invitation");
  }

  revalidatePath("/buddies");
}