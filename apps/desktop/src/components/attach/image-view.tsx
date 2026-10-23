"use client";

// A thumbnail that opens the image large on click; Esc or a click closes it.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Thumb({ url, name, size = 22 }: { url: string; name: string; size?: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="ak-thumb"
        aria-label={`View ${name}`}
        style={{ width: size, height: size }}
        onClick={() => setOpen(true)}
      >
        <img src={url} alt="" />
      </button>
      {open &&
        createPortal(
          <button type="button" className="ak-lightbox" aria-label="Close image" onClick={() => setOpen(false)}>
            <img src={url} alt={name} />
          </button>,
          document.body,
        )}
    </>
  );
}
