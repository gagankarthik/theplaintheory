// app/api/users/search/route.js

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
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({
        users: [],
        message: "Query must be at least 2 characters"
      });
    }

    // Search for users by username or display name
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji")
      .or(`display_name.ilike.%${query}%`)
      .neq("id", user.id) // Exclude current user
      .limit(10);

    if (error) {
      console.error("User search error:", error);
      return NextResponse.json(
        { error: "Failed to search users" },
        { status: 500 }
      );
    }

    // Filter out users who already have buddies (optional)
    const usersWithBuddyStatus = await Promise.all(
      users.map(async (searchUser) => {
        const { data: hasBuddy } = await supabase
          .from("buddies")
          .select("id")
          .eq("owner_id", searchUser.id)
          .single();

        return {
          ...searchUser,
          has_buddy: !!hasBuddy
        };
      })
    );

    return NextResponse.json({
      users: usersWithBuddyStatus,
      total: users.length
    });

  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

