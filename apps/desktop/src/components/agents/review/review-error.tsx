"use client";

/** Loading the changes failed and nothing is shown yet. */
export function ReviewError({ error, onRetry, onClose }: { error: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div className="ak-tl ak-in">
      <div className="ak-rv-head">
        <b>Review changes</b>
      </div>
      <p className="ak-err">{error}</p>
      <div className="ak-chips">
        <button type="button" onClick={onRetry} className="ak-chip primary chip">
          Retry
        </button>
        <button type="button" onClick={onClose} className="ak-chip chip">
          Close
        </button>
      </div>
    </div>
  );
}
