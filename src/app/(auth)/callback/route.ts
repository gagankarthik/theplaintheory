import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
const { searchParams } = new URL(request.url);
const code = searchParams.get("code");
const next = searchParams.get("next") ?? "/dashboard";
if (code) {


const supabase = await createClientServer(cookies());
await supabase.auth.exchangeCodeForSession(code);
}
return NextResponse.redirect(new URL(next, request.url));
}

