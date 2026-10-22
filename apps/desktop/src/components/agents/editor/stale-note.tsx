"use client";

/** The open file changed on disk while it had unsaved edits. */
export function StaleNote({ onTheirs, onMine }: { onTheirs: () => void; onMine: () => void }) {
  return (
    <div className="ed-note" role="alert">
      <span>This file changed on disk while you edited it.</span>
      <button type="button" className="rd-btn chip-s" onClick={onTheirs}>
        Load theirs
      </button>
      <button type="button" className="rd-btn ghost chip-s" onClick={onMine}>
        Keep mine
      </button>
    </div>
  );
}
