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

  // Check if the invited person exists in the system
  const { data: invitedUser } = await supabase.auth.admin.listUsers({
    filter: `email.eq.${email}`
  });

  if (invitedUser?.users && invitedUser.users.length > 0) {
    const buddyUserId = invitedUser.users[0].id;
    
    // Check if they already have each other as buddies
    const { data: existingConnection } = await supabase
      .from("buddies")
      .select("*")
      .or(`owner_id.eq.${user.id},owner_id.eq.${buddyUserId}`)
      .or(`buddy_id.eq.${user.id},buddy_id.eq.${buddyUserId}`)
      .single();

    if (existingConnection) {
      throw new Error("You're already connected as buddies with this person");
    }

    // Create the buddy relationship directly
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

    // Send notification email to the buddy (you'll need to implement this with your email service)
    // For now, we'll just log it
    console.log(`Buddy connection created: ${user.email} -> ${email}`);

  } else {
    // User doesn't exist, send invitation email
    // This would integrate with your email service (Resend, SendGrid, etc.)
    // For now, we'll simulate the invitation
    
    // In a real implementation, you'd:
    // 1. Generate an invitation token
    // 2. Store the invitation in a separate table
    // 3. Send an email with a signup link that includes the invitation
    
    console.log(`Invitation email would be sent to: ${email}`);
    console.log(`From: ${profile?.display_name || user.email}`);
    console.log(`Message: ${message || "Default invitation message"}`);
    
    // For demo purposes, throw an error suggesting they need to sign up first
    throw new Error(`${email} needs to create an account first. Ask them to sign up at your app URL, then try inviting them again.`);
  }

  // Revalidate the buddies page
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
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .or(`from_user_id.eq.${buddyId},to_user_id.eq.${buddyId}`);

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
  const { data: mutualBuddies } = await supabase
    .from("buddies")
    .select(`
      buddy_id,
      profiles!buddies_buddy_id_fkey (
        id,
        display_name,
        avatar_emoji
      )
    `)
    .eq("owner_id", user.id)
    .in("buddy_id", supabase.from("buddies").select("owner_id").eq("buddy_id", user.id)
    );

  return mutualBuddies || [];
}