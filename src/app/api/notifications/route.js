
// app/api/notifications/route.js

import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const supabase = await createClientServer(cookies());
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit")) || 20;
    const offset = parseInt(searchParams.get("offset")) || 0;

    // Get notifications for the user
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Notifications fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (countError) {
      console.error("Unread count error:", countError);
    }

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
      total: notifications?.length || 0
    });

  } catch (error) {
    console.error("Notifications API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const supabase = await createClientServer(cookies());
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notification_id, action } = body;

    if (action === "mark_read") {
      const { error } = await supabase
        .from("notifications")
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", notification_id)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to mark notification as read" },
          { status: 500 }
        );
      }
    } else if (action === "mark_all_read") {
      const { error } = await supabase
        .from("notifications")
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        return NextResponse.json(
          { error: "Failed to mark all notifications as read" },
          { status: 500 }
        );
      }
    } else if (action === "delete") {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notification_id)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to delete notification" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}