"use server";

import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function sendBuddyInvite(username, message = "") {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Get current user's profile for the invitation
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("display_name, avatar_emoji, username")
      .eq("id", user.id)
      .single();

    // Check if the target user exists
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .eq("username", username)
      .single();

    if (userError || !targetUser) {
      throw new Error("User not found. Please check the username and try again.");
    }

    // Check if user is trying to invite themselves
    if (targetUser.id === user.id) {
      throw new Error("You cannot send a buddy request to yourself.");
    }

    // Check if they already have a buddy
    const { data: existingBuddy } = await supabase
      .from("buddies")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (existingBuddy) {
      throw new Error("You already have an accountability buddy. Remove your current buddy first.");
    }

    // Check if target user already has a buddy
    const { data: targetHasBuddy } = await supabase
      .from("buddies")
      .select("id")
      .eq("owner_id", targetUser.id)
      .single();

    if (targetHasBuddy) {
      throw new Error("This user already has an accountability buddy.");
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from("buddy_invitations")
      .select("id, status")
      .eq("inviter_id", user.id)
      .eq("invitee_username", username)
      .single();

    if (existingInvite && existingInvite.status === 'pending') {
      throw new Error("You already have a pending invitation to this user.");
    }

    // Create buddy invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("buddy_invitations")
      .insert({
        inviter_id: user.id,
        invitee_username: username,
        message: message,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Create notification for the target user
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: targetUser.id,
        type: 'buddy_request',
        title: `@${inviterProfile?.username || user.email} wants to be your accountability buddy`,
        message: message || 'No message included',
        data: {
          invitation_id: invitation.id,
          inviter_id: user.id,
          inviter_username: inviterProfile?.username,
          inviter_display_name: inviterProfile?.display_name,
          inviter_avatar: inviterProfile?.avatar_emoji
        },
        is_read: false
      });

    if (notificationError) throw notificationError;

    return { success: true, invitation_id: invitation.id };

  } catch (error) {
    console.error("Buddy invitation error:", error);
    throw new Error(error.message || "Failed to send buddy invitation");
  }
}

export async function respondToBuddyRequest(invitationId, response) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  if (!['accept', 'decline'].includes(response)) {
    throw new Error("Invalid response. Must be 'accept' or 'decline'.");
  }

  try {
    // Get current user's profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_emoji")
      .eq("id", user.id)
      .single();

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("buddy_invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("invitee_username", userProfile?.username)
      .eq("status", 'pending')
      .single();

    if (inviteError || !invitation) {
      throw new Error("Invitation not found or already processed");
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("This invitation has expired");
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from("buddy_invitations")
      .update({ 
        status: response === 'accept' ? 'accepted' : 'declined',
        updated_at: new Date().toISOString()
      })
      .eq("id", invitationId);

    if (updateError) throw updateError;

    if (response === 'accept') {
      // Create buddy relationship
      const { error: buddyError } = await supabase
        .from("buddies")
        .insert({
          owner_id: invitation.inviter_id,
          buddy_id: user.id,
          created_at: new Date().toISOString()
        });

      if (buddyError) throw buddyError;

      // Create mutual buddy relationship (both can see each other)
      const { error: mutualBuddyError } = await supabase
        .from("buddies")
        .insert({
          owner_id: user.id,
          buddy_id: invitation.inviter_id,
          created_at: new Date().toISOString()
        });

      if (mutualBuddyError) throw mutualBuddyError;

      // Notify the inviter that their request was accepted
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: invitation.inviter_id,
          type: 'buddy_accepted',
          title: `@${userProfile?.username} accepted your buddy request!`,
          message: `You're now accountability buddies. You can see each other's habit progress.`,
          data: {
            buddy_id: user.id,
            buddy_username: userProfile?.username,
            buddy_display_name: userProfile?.display_name,
            buddy_avatar: userProfile?.avatar_emoji
          },
          is_read: false
        });

      if (notificationError) console.error("Failed to create acceptance notification:", notificationError);
    }

    return { success: true, response };

  } catch (error) {
    console.error("Buddy response error:", error);
    throw new Error(error.message || `Failed to ${response} buddy request`);
  }
}

export async function removeBuddy(buddyId) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Remove both buddy relationships
    await Promise.all([
      supabase
        .from("buddies")
        .delete()
        .eq("owner_id", user.id)
        .eq("buddy_id", buddyId),
      
      supabase
        .from("buddies")
        .delete()
        .eq("owner_id", buddyId)
        .eq("buddy_id", user.id)
    ]);

    // Optionally notify the other user
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: buddyId,
        type: 'buddy_removed',
        title: `@${userProfile?.username} ended your buddy connection`,
        message: `You're no longer accountability buddies.`,
        data: {
          removed_by: user.id,
          removed_by_username: userProfile?.username
        },
        is_read: false
      });

    if (notificationError) console.error("Failed to create removal notification:", notificationError);

    return { success: true };

  } catch (error) {
    console.error("Remove buddy error:", error);
    throw new Error(error.message || "Failed to remove buddy");
  }
}