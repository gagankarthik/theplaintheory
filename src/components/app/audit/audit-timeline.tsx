import { IconAlert, IconBilling, IconBrush, IconDownload, IconLock, IconPlug, IconServer, IconSettings, IconSites, IconTeam, type IconProps } from "@/components/icons";
import { EmptyState } from "@/components/app/ui/empty-state";
import type { AuditRow } from "./audit-view";

type Kind = { icon: (p: IconProps) => React.ReactNode; tone: string };

/**
 * Each family of events gets one icon, so a day's activity can be scanned at a glance. Colour is kept
 * for the events that need a second look (failed sign-ins, removals), which also read as such in words.
 */
function kindOf(action: string): Kind {
  if (action === "auth.login_failed" || action === "auth.locked" || action === "auth.mfa_disabled" || action.endsWith("deleted") || action.endsWith("removed"))
    return { icon: IconAlert, tone: "bg-destructive-wash text-destructive" };
  const quiet = "bg-raised text-ink-2 ring-1 ring-inset ring-line";
  if (action.startsWith("auth.")) return { icon: IconLock, tone: quiet };
  if (action.startsWith("member.") || action.startsWith("access_review.")) return { icon: IconTeam, tone: quiet };
  if (action.startsWith("org.")) return { icon: IconSettings, tone: quiet };
  if (action.startsWith("property.")) return { icon: IconSites, tone: quiet };
  if (/^(banner|regions|notice|tracker|language)\./.test(action)) return { icon: IconBrush, tone: quiet };
  if (action.startsWith("webhook.")) return { icon: IconPlug, tone: quiet };
  if (action.startsWith("billing.")) return { icon: IconBilling, tone: quiet };
  if (action.endsWith("exported") || action.startsWith("logs.") || action.startsWith("evidence.") || action.startsWith("audit.")) return { icon: IconDownload, tone: quiet };
  return { icon: IconServer, tone: quiet };
}

const DAY = 86_400_000;
const dayKey = (iso: string) => iso.slice(0, 10);
function dayLabel(key: string, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - DAY).toISOString().slice(0, 10);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });

/**
 * The audit log as a timeline: events grouped by day (UTC), each with who did it, what they did and to
 * what, the details, and its place in the hash chain. Server-rendered; the rows come from the page.
 */
export function AuditTimeline({ rows, now = new Date(), filtered = false }: { rows: AuditRow[]; now?: Date; filtered?: boolean }) {
  if (!rows.length)
    return (
      <EmptyState icon={<IconServer size={22} />} title={filtered ? "No events match these filters" : "No events yet"}>
        {filtered ? "Try another activity or person, or clear the filters." : "Sign-ins, access changes, settings and exports are recorded here as they happen."}
      </EmptyState>
    );
  const days: { key: string; rows: AuditRow[] }[] = [];
  for (const r of rows) {
    const key = dayKey(r.createdAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.rows.push(r);
    else days.push({ key, rows: [r] });
  }
  return (
    <div className="space-y-6">
      {days.map((d) => (
        <section key={d.key} aria-labelledby={`day-${d.key}`}>
          <h3 id={`day-${d.key}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink">
            {dayLabel(d.key, now)}
            <span className="text-xs font-normal text-ink-3">
              {d.rows.length} event{d.rows.length === 1 ? "" : "s"}
            </span>
          </h3>
          <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {d.rows.map((r) => {
              const { icon: Icon, tone } = kindOf(r.action);
              return (
                <li key={r.seq} className="flex gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-raised sm:gap-4 sm:px-6">
                  <span aria-hidden className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${tone}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <span className={r.system ? "text-ink-3" : "font-medium"}>{r.actor}</span> <span className="text-ink-2">{r.label.toLowerCase()}</span>
                      {r.target ? (
                        <>
                          {" "}
                          <span className="font-medium [overflow-wrap:anywhere]">{r.target}</span>
                        </>
                      ) : null}
                    </p>
                    {r.details ? <p className="mt-0.5 text-xs text-ink-3 [overflow-wrap:anywhere]">{r.details}</p> : null}
                    <p className="mt-1 font-mono text-xs text-ink-3">
                      #{r.seq} · {r.action} ·{" "}
                      <span title={r.hash}>
                        {r.hash.slice(0, 10)}…
                      </span>
                    </p>
                  </div>
                  <time dateTime={r.createdAt} className="shrink-0 pt-0.5 text-xs tabular-nums text-ink-3">
                    {clock(r.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
