export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0 animate-spin" role={label ? "img" : undefined} aria-hidden={label ? undefined : true}>
      {label ? <title>{label}</title> : null}
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
