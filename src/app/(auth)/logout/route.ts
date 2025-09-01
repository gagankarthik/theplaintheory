import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabase/server";
export async function POST() {
	const supabase = await createClientServer(cookies());
	await supabase.auth.signOut();
	return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
}

function cookies(): Promise<import("next/dist/server/web/spec-extension/adapters/request-cookies").ReadonlyRequestCookies> {
    throw new Error("Function not implemented.");
}
