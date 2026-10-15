/**
 * Shared by the signups chart and its lazily loaded plot. Two neutral inks rather than hues: lime is
 * reserved for "on" and jade/amber/rose for states, and both inks clear 3:1 on the card in either
 * theme. The legend, the tooltip and the table view carry the series names too.
 */
export const SERIES = [
  { key: "users", label: "New users", color: "var(--color-ink)" },
  { key: "orgs", label: "New organizations", color: "var(--color-ink-3)" },
] as const;

export interface Day {
  day: string;
  users: number;
  orgs: number;
}
