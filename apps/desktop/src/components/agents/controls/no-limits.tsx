/** Local models run on this PC, so there is no plan to watch. */
export function NoLimits() {
  return (
    <span className="ak-cchip ak-cquiet">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      On this PC {"\u00b7"} no limits
    </span>
  );
}
