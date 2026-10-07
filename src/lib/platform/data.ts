import "server-only";
import { cache } from "react";
import { isLocked } from "../auth/lockout";
import { sessionProblem } from "../auth/session";
import { PLANS, planById } from "../plans";
import { getStore } from "../store";
import type { Organization, PlanId, Role, User } from "../types";

/**
 * Read models for the staff console. Everything is derived from the store's own records; nothing here
 * is cached across requests, so the console always shows the current state.
 */

const DAY = 864e5;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export interface OrgSummary {
  id: string;
  name: string;
  plan: PlanId;
  kind: "personal" | "organization";
  members: number;
  sites: number;
  region: Organization["dataRegion"];
  createdAt: string;
  suspended: boolean;
  owners: string[];
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  orgs: { id: string; name: string; role: Role }[];
  mfa: boolean;
  lastActiveAt?: string;
  locked: boolean;
  createdAt: string;
}

/** One pass over orgs, members, sites and users, shared by every console page in a request. */
export const loadSnapshot = cache(async () => {
  const store = await getStore();
  const [orgs, users] = await Promise.all([store.listOrgs(), store.listUsers()]);
  const perOrg = await Promise.all(orgs.map(async (o) => ({ org: o, members: await store.listMembers(o.id), sites: await store.listProperties(o.id) })));
  const userOrgs = new Map<string, UserSummary["orgs"]>();
  for (const { org, members } of perOrg) {
    for (const m of members) {
      const list = userOrgs.get(m.userId) ?? [];
      list.push({ id: org.id, name: org.name, role: m.role });
      userOrgs.set(m.userId, list);
    }
  }
  const orgSummaries: OrgSummary[] = perOrg.map(({ org, members, sites }) => ({
    id: org.id,
    name: org.name,
    plan: org.plan,
    kind: org.kind ?? "organization",
    members: members.length,
    sites: sites.length,
    region: org.dataRegion,
    createdAt: org.createdAt,
    suspended: Boolean(org.suspendedAt),
    owners: members.filter((m) => m.role === "owner").map((m) => m.user?.email ?? m.userId),
  }));
  const now = Date.now();
  const userSummaries: UserSummary[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    orgs: userOrgs.get(u.id) ?? [],
    mfa: Boolean(u.mfa),
    lastActiveAt: u.lastActiveAt,
    locked: isLocked(u, now),
    createdAt: u.createdAt,
  }));
  return { orgs, users, perOrg, orgSummaries, userSummaries };
});

/** Monthly recurring revenue at list price, USD. Suspended and free orgs don't count; enterprise is custom. */
export function estimateMrr(orgs: Pick<Organization, "plan" | "suspendedAt">[]) {
  let usd = 0;
  let custom = 0;
  for (const o of orgs) {
    if (o.suspendedAt || o.plan === "free") continue;
    const price = planById(o.plan).priceMonthly;
    if (price === null) custom += 1;
    else usd += price;
  }
  return { usd, custom };
}

export interface SignupDay {
  day: string;
  users: number;
  orgs: number;
}

/** Users and organizations created per UTC day, oldest first, zero-filled. */
export function signupsByDay(users: Pick<User, "createdAt">[], orgs: Pick<Organization, "createdAt">[], days: number, now = Date.now()): SignupDay[] {
  const start = new Date(now - (days - 1) * DAY);
  start.setUTCHours(0, 0, 0, 0);
  const rows = new Map<string, SignupDay>();
  for (let i = 0; i < days; i++) {
    const d = dayKey(new Date(start.getTime() + i * DAY));
    rows.set(d, { day: d, users: 0, orgs: 0 });
  }
  for (const u of users) {
    const row = rows.get(u.createdAt.slice(0, 10));
    if (row) row.users += 1;
  }
  for (const o of orgs) {
    const row = rows.get(o.createdAt.slice(0, 10));
    if (row) row.orgs += 1;
  }
  return [...rows.values()];
}

export async function loadOverview() {
  const store = await getStore();
  const { orgs, users, perOrg, userSummaries } = await loadSnapshot();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const fromDay = dayKey(new Date(now - 29 * DAY));
  const toDay = dayKey(new Date(now));
  const sites = perOrg.flatMap((p) => p.sites);
  // Decisions = banner views that didn't bounce, from the daily counters (no receipt scan).
  const counters = await Promise.all(sites.map((s) => store.listCounters(s.id, fromDay, toDay)));
  const decisions30 = counters.flat().reduce((sum, c) => sum + Math.max(0, c.views - c.bounces), 0);
  const paid = orgs.filter((o) => o.plan !== "free" && !o.suspendedAt);
  const planMix = PLANS.map((p) => ({ plan: p.id, name: p.name, orgs: orgs.filter((o) => o.plan === p.id).length }));
  const recent = [...userSummaries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  return {
    totals: {
      orgs: orgs.length,
      users: users.length,
      sites: sites.length,
      liveSites: sites.filter((s) => s.publishedVersion > 0).length,
      signups30: users.filter((u) => u.createdAt >= since30).length,
      orgs30: orgs.filter((o) => o.createdAt >= since30).length,
      paidOrgs: paid.length,
      suspended: orgs.filter((o) => o.suspendedAt).length,
      decisions30,
    },
    mrr: estimateMrr(orgs),
    planMix,
    signups: signupsByDay(users, orgs, 90, now),
    recent,
  };
}

export async function loadOrgDetail(orgId: string) {
  const store = await getStore();
  const org = await store.getOrg(orgId);
  if (!org) return null;
  const [members, sites, invites, audit] = await Promise.all([store.listMembers(orgId), store.listProperties(orgId), store.listInvites(orgId), store.listAudit(orgId, { limit: 15 })]);
  return { org, members, sites, invites, audit };
}

export async function loadUserDetail(userId: string) {
  const store = await getStore();
  const user = await store.getUser(userId);
  if (!user) return null;
  const [memberships, sessions] = await Promise.all([store.listMemberships(userId), store.listUserSessions(userId)]);
  const orgs = await Promise.all(memberships.map(async (m) => ({ membership: m, org: await store.getOrg(m.orgId) })));
  const now = Date.now();
  return { user, orgs, sessions: sessions.map((s) => ({ ...s, problem: sessionProblem(s, now) })), locked: isLocked(user, now) };
}
