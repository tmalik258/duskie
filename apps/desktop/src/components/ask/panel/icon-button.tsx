// A round header button with its key badge while Alt is held.

import type { ReactNode } from "react";
import { Tip } from "../../tip";
import { KeyHint } from "../parts";

export function IconButton({
  label,
  hint,
  keys,
  pressed,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  keys: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span className="relative shrink-0">
      <Tip label={label}>
        <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className="ak-ibtn chip">
          {children}
        </button>
      </Tip>
      <KeyHint show={keys}>{hint}</KeyHint>
    </span>
  );
}
