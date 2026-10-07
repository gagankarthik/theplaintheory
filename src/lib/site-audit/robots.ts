/**
 * robots.txt, read the way Google documents it (RFC 9309): the most specific user-agent group
 * that names us wins over "*", and within a group the longest matching rule wins, Allow on a tie.
 */

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

export function parseRobots(txt: string, agent = "plaintheoryscanner"): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" && value) current.allow.push(value);
    if (key === "disallow" && value) current.disallow.push(value);
  }
  const ours = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes("*"));
  return { allow: chosen.flatMap((g) => g.allow), disallow: chosen.flatMap((g) => g.disallow) };
}

function ruleMatches(rule: string, path: string) {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Whether `pathWithQuery` (e.g. "/privacy?x=1") may be fetched. */
export function robotsAllows(rules: RobotsRules, pathWithQuery: string): boolean {
  let best = { len: -1, allow: true };
  for (const r of rules.disallow) if (ruleMatches(r, pathWithQuery) && r.length > best.len) best = { len: r.length, allow: false };
  for (const r of rules.allow) if (ruleMatches(r, pathWithQuery) && r.length >= best.len) best = { len: r.length, allow: true };
  return best.allow;
}
