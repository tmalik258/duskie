// The chat's header: its editable name and a New chat button.

import type { RefObject } from "react";
import { Ic } from "../../icon";
import { IconButton } from "./icon-button";

export function ChatHead(p: {
  name: string;
  onName: (name: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  alt: boolean;
  onNewChat: () => void;
}) {
  return (
    <div className="ak-head">
      <input
        aria-label="Chat name"
        value={p.name}
        onChange={(e) => p.onName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            p.inputRef.current?.focus();
          }
        }}
        spellCheck={false}
        className="ak-title ak-cname"
      />
      <IconButton label="New chat (Ctrl N)" keys={p.alt} hint="Ctrl N" onClick={p.onNewChat}>
        <Ic name="plus" size={15} />
      </IconButton>
    </div>
  );
}
