"use client";

// A thumbnail that opens the image large on click; Esc or a click closes it.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Thumb({ url, name, size = 22 }: { url: string; name: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
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
  if (failedUrl === url) {
    return (
      <span className="ak-att ak-att-sent" title={`${name} (preview unavailable)`}>
        {name}
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        className="ak-thumb"
        aria-label={`View ${name}`}
        style={{ width: size, height: size }}
        onClick={() => setOpen(true)}
      >
        <img
          src={url}
          alt=""
          onError={() => {
            setFailedUrl(url);
            setOpen(false);
          }}
        />
      </button>
      {open &&
        createPortal(
          <button type="button" className="ak-lightbox" aria-label="Close image" onClick={() => setOpen(false)}>
            <img
              src={url}
              alt={name}
              onError={() => {
                setFailedUrl(url);
                setOpen(false);
              }}
            />
          </button>,
          document.body,
        )}
    </>
  );
}
