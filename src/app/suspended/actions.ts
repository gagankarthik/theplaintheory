"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, setActiveOrg } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

/**
 * Switch to another organization from the suspension notice. Can't reuse switchOrg in /app/actions:
 * that one starts with requireUser(), which sends a suspended org straight back here.
 */
export async function switchFromSuspended(form: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const orgId = z.string().min(1).max(64).safeParse(form.get("orgId"));
  if (!orgId.success) redirect("/suspended");
  const store = await getStore();
  const [membership, org] = await Promise.all([store.getMembership(orgId.data, session.userId), store.getOrg(orgId.data)]);
  if (!membership || !org || org.suspendedAt) redirect("/suspended");
  await setActiveOrg(org.id);
  redirect("/app");
}
