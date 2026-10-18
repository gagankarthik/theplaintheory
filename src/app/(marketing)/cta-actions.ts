"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ipRateKey, id } from "@/lib/crypto";
import { dailyIpHash } from "@/lib/ip-hash";
import { MAX_PER_WINDOW } from "@/lib/leads";
import { getStore } from "@/lib/store";
import type { Lead } from "@/lib/types";

const Email = z.email().max(254);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The "Start free as [email] today" call to action. The address is kept as a "Sign-up interest"
 * lead in the staff console's Contact requests (so the team can follow up if sign-up isn't
 * finished), then the visitor continues to sign-up with it filled in, exactly as before.
 *
 * Never in the visitor's way: an invalid address, the per-network abuse limit or a store problem
 * only skips the record; sign-up always opens. One lead per address per day, however often it's sent.
 */
export async function startSignup(form: FormData) {
  const parsed = Email.safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  const email = parsed.success ? parsed.data : null;
  if (email) {
    try {
      const store = await getStore();
      const h = await headers();
      const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip");
      const abuseKey = ipRateKey(ip);
      const now = Date.now();
      const sameAddressToday = await store.hitWindow(`cta:${createHash("sha256").update(email).digest("base64url").slice(0, 32)}`, Math.floor(now / DAY) * DAY, DAY);
      const busyNetwork = (await store.countRecentLeads(abuseKey, new Date(now - HOUR).toISOString())) >= MAX_PER_WINDOW;
      if (sameAddressToday === 1 && !busyNetwork) {
        const lead: Lead = {
          id: id("lead"),
          topic: "signup",
          status: "new",
          name: "",
          email,
          subject: "Left their email in Start free",
          details: { source: "Footer call to action" },
          ipHash: await dailyIpHash(ip),
          createdAt: new Date(now).toISOString(),
        };
        await store.createLead(lead, abuseKey);
      }
    } catch (e) {
      console.error("[cta] couldn't record the sign-up interest", e);
    }
  }
  redirect(email ? `/auth/signup?email=${encodeURIComponent(email)}` : "/auth/signup");
}
