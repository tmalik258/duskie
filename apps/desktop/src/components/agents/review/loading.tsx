"use client";

/** Placeholder rows while diffs stream in. */
export function ReviewLoading({ slow }: { slow?: boolean }) {
  return (
    <div className="ak-rv-load" role="status" aria-busy="true" aria-label="Reading changes">
      <div className="ak-rv-head">
        <b>Review changes</b>
        <span className="shimmer-text">{slow ? "Still reading diffs..." : "Reading diffs"}</span>
      </div>
      {[72, 54, 63].map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
        <div key={i} className="ak-rv-file ak-rskel" aria-hidden="true" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="ak-rv-fh">
            <i className="ak-rbar" style={{ width: `${w}%` }} />
          </div>
          <div className="ak-rv-hunk">
            <div className="ak-rv-skel-lines">
              <i className="ak-rbar" style={{ width: "88%" }} />
              <i className="ak-rbar" style={{ width: "64%" }} />
              <i className="ak-rbar" style={{ width: "76%" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
