/**
 * A real product fragment for the auth panel: one consent receipt as it appears in the log.
 * Rendered as HTML (not an illustration) so it reads like the product, not decoration.
 */
export function ReceiptFragment() {
  const rows: [string, string][] = [
    ["Site", "shop.acme.in"],
    ["Notice", "DPDPA, India"],
    ["Recorded", "6 Oct 2026, 14:02:37 IST"],
  ];
  const cats: [string, boolean][] = [
    ["Essential", true],
    ["Analytics", true],
    ["Marketing", false],
  ];
  return (
    <figure className="w-full max-w-[380px] rounded-lg border border-white/12 bg-white/[.03] text-[13px]">
      <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <span className="font-bold text-paper">Consent receipt 4,182</span>
        <span className="text-white/60">Chose some</span>
      </div>
      <dl className="space-y-1.5 px-4 py-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-white/60">{k}</dt>
            <dd className="text-right text-paper">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-wrap gap-1.5 border-t border-white/10 px-4 py-3">
        {cats.map(([c, on]) => (
          <li
            key={c}
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${on ? "border-[1.5px] border-jade-bright text-jade-bright" : "border-[1.5px] border-dashed border-amber-bright text-amber-bright"}`}
          >
            {c}: {on ? "allowed" : "held"}
          </li>
        ))}
      </ul>
      <figcaption className="border-t border-white/10 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-white/60">
        <span className="text-white/80">hash</span> 9f2c41e0…b3e71a
        <br />
        <span className="text-white/80">prev</span> 51b0d97a…4c07cd
      </figcaption>
    </figure>
  );
}
