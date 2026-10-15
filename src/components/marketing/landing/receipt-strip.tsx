type Stage = 0 | 1 | 2 | 3;

const FIELDS: { clause: string; bg: string; text: string }[] = [
  { clause: "First the notice appears.", bg: "bg-soot", text: "text-white" },
  { clause: "Then the visitor chooses.", bg: "bg-lime", text: "text-soot" },
  { clause: "Then it is sealed into the chain.", bg: "bg-soot-2", text: "text-white" },
  { clause: "Then anyone can check it.", bg: "bg-white", text: "text-soot" },
];

const CHOICES: [string, boolean][] = [
  ["Essential", true],
  ["Preferences", true],
  ["Analytics", false],
  ["Marketing", false],
];

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px]">
      <dt className="text-[13px] text-[#6b6b6b]">{k}</dt>
      <dd className={`text-right text-[13px] tabular-nums ${strong ? "font-semibold text-soot" : "text-soot"}`}>{v}</dd>
    </div>
  );
}

/** One consent receipt, further along in each field. A believable product fragment, sample values. */
function ReceiptCard({ stage }: { stage: Stage }) {
  return (
    <div data-ui className="w-[260px] rounded-[14px] bg-white p-4 text-soot ring-1 ring-black/10 transition-transform duration-150 ease-out group-hover:-translate-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold">Consent receipt</p>
        <p className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${stage === 3 ? "bg-lime text-soot" : stage === 2 ? "bg-soot text-white" : "bg-[#efefec] text-[#555]"}`}>
          {stage === 0 ? "Shown" : stage === 1 ? "Decided" : stage === 2 ? "Sealed" : "Verified"}
        </p>
      </div>
      <dl className="mt-3">
        <Row k="Site" v="shop.example.com" />
        <Row k="Notice" v="Version 12, English" />
        <Row k="Time" v="15 Oct 2026, 10:42 UTC" />
      </dl>
      <div className="mt-2 rounded-[10px] bg-[#f4f4f1] px-3 py-2">
        {stage === 0 ? (
          <p className="py-1 text-[13px] text-[#6b6b6b]">Waiting for the visitor…</p>
        ) : (
          <dl>
            {CHOICES.map(([k, on]) => (
              <Row key={k} k={k} v={on ? "On" : "Off"} strong={on} />
            ))}
          </dl>
        )}
      </div>
      {stage >= 2 ? (
        <dl className="mt-2">
          <Row k="This receipt" v="9f2c 41e0 … a71e" />
          <Row k="Previous" v="41b0 7d2a … c93d" />
        </dl>
      ) : null}
      {stage === 3 ? <p className="mt-2 text-[13px] font-medium text-soot">Chain intact: 2,481 receipts, none changed.</p> : null}
    </div>
  );
}

/**
 * How it works: the same consent receipt in four butted colour fields, one step further in each:
 * shown, decided, sealed into the chain, verified.
 */
export function ReceiptStrip() {
  return (
    <section id="how" aria-labelledby="how-title" className="grid scroll-mt-20 md:grid-cols-2 xl:grid-cols-4">
      {FIELDS.map((f, i) => (
        <div key={f.clause} className={`group relative flex min-h-[480px] flex-col px-5 pb-8 pt-10 md:min-h-[560px] md:px-7 ${f.bg} ${f.text}`}>
          {i === 0 ? (
            <h2 id="how-title" className="text-[clamp(1.375rem,2vw,1.8rem)]">
              One decision, kept.
            </h2>
          ) : null}
          <div className="flex flex-1 items-start justify-start pt-8 md:items-center md:justify-center md:pt-0">
            <ReceiptCard stage={i as Stage} />
          </div>
          <p className="mt-8 max-w-[14ch] text-[clamp(1.375rem,2vw,1.8rem)] font-semibold leading-[1.05] tracking-[-0.03em]">{f.clause}</p>
        </div>
      ))}
    </section>
  );
}
