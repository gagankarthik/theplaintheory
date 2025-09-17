"use server";

import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function markNotificationRead(notificationId) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ 
        is_read: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Mark notification read error:", error);
    throw new Error(error.message || "Failed to mark notification as read");
  }
}

export async function markAllNotificationsRead() {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ 
        is_read: true,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    throw new Error(error.message || "Failed to mark all notifications as read");
  }
}

export async function deleteNotification(notificationId) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Delete notification error:", error);
    throw new Error(error.message || "Failed to delete notification");
  }
}

export async function respondToBuddyRequest(invitationId, response) {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  if (!['accept', 'decline'].includes(response)) {
    throw new Error("Invalid response");
  }

  try {
    // Get current user's profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_emoji")
      .eq("id", user.id)
      .single();

    // Get the invitation details
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
      // Check if either user already has a buddy
      const [{ data: inviterBuddy }, { data: inviteeBuddy }] = await Promise.all([
        supabase.from("buddies").select("id").eq("owner_id", invitation.inviter_id).single(),
        supabase.from("buddies").select("id").eq("owner_id", user.id).single()
      ]);

      if (inviterBuddy || inviteeBuddy) {
        throw new Error("One of you already has a buddy. Please try again.");
      }

      // Create mutual buddy relationships
      const { error: buddyError } = await supabase
        .from("buddies")
        .insert([
          {
            owner_id: invitation.inviter_id,
            buddy_id: user.id,
            created_at: new Date().toISOString()
          },
          {
            owner_id: user.id,
            buddy_id: invitation.inviter_id,
            created_at: new Date().toISOString()
          }
        ]);

      if (buddyError) throw buddyError;

      // Notify the inviter that their request was accepted
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: invitation.inviter_id,
          type: 'buddy_accepted',
          title: `@${userProfile?.username} accepted your buddy request!`,
          message: `You're now accountability buddies and can see each other's progress.`,
          data: {
            buddy_id: user.id,
            buddy_username: userProfile?.username,
            buddy_display_name: userProfile?.display_name,
            buddy_avatar: userProfile?.avatar_emoji
          },
          is_read: false
        });

      if (notificationError) {
        console.error("Failed to create acceptance notification:", notificationError);
      }
    }

    return { success: true, response };

  } catch (error) {
    console.error("Buddy response error:", error);
    throw new Error(error.message || `Failed to ${response} buddy request`);
  }
}

// Helper function to create various types of notifications
export async function createNotification(userId, type, title, message = null, data = null) {
  const supabase = await createClientServer(cookies());

  try {
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        is_read: false,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Create notification error:", error);
    throw new Error(error.message || "Failed to create notification");
  }
}

// Function to send encouragement to buddy
export async function sendBuddyEncouragement(buddyId, message = "Keep it up! 👏") {
  const supabase = await createClientServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    // Verify buddy relationship
    const { data: buddyRelation } = await supabase
      .from("buddies")
      .select("id")
      .eq("owner_id", user.id)
      .eq("buddy_id", buddyId)
      .single();

    if (!buddyRelation) {
      throw new Error("Not authorized to send encouragement to this user");
    }

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_emoji")
      .eq("id", user.id)
      .single();

    // Create encouragement notification
    await createNotification(
      buddyId,
      'buddy_encouragement',
      `@${senderProfile?.username} sent you encouragement!`,
      message,
      {
        from_user_id: user.id,
        from_username: senderProfile?.username,
        from_display_name: senderProfile?.display_name,
        from_avatar: senderProfile?.avatar_emoji
      }
    );

    // Also store in buddy_vibes table if you have one
    const { error: vibeError } = await supabase
      .from("buddy_vibes")
      .insert({
        from_user_id: user.id,
        to_user_id: buddyId,
        day: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });

    // Don't throw on vibe error, just log it
    if (vibeError) {
      console.error("Failed to store buddy vibe:", vibeError);
    }

    return { success: true };
  } catch (error) {
    console.error("Send encouragement error:", error);
    throw new Error(error.message || "Failed to send encouragement");
  }
}