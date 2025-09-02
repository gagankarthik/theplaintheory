import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // use anon if you only want public access
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const habitId = searchParams.get("habitId");
  if (!habitId) {
    return NextResponse.json({ error: "habitId required" }, { status: 400 });
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("habit_id", habitId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { habitId, day } = await req.json();
  if (!habitId || !day) {
    return NextResponse.json({ error: "habitId and day required" }, { status: 400 });
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("checkins")
    .insert({ habit_id: habitId, day })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const { habitId, day } = await req.json();
  if (!habitId || !day) {
    return NextResponse.json({ error: "habitId and day required" }, { status: 400 });
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from("checkins")
    .delete()
    .eq("habit_id", habitId)
    .eq("day", day);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
