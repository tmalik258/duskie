"use client";

// The branch picker: lists local branches, switches to one, or creates a
// new branch from the current one.

import { useState } from "react";
import type { GitBranch } from "@/lib/types";
import { Ic } from "../../icon";
import { GitMenu } from "./git-menu";

export function BranchPicker({
  current,
  branches,
  busy,
  onSwitch,
  onCreate,
}: {
  current: string;
  branches: GitBranch[];
  busy: boolean;
  onSwitch: (name: string) => void;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = () => {
    const n = name.trim();
    if (!n) return;
    setOpen(false);
    setName("");
    onCreate(n);
  };
  return (
    <span className="gpop">
      <button
        type="button"
        className="gpick"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        <Ic name="branch" size={14} />
        <span className="min-w-0">
          <small>Branch</small>
          <span className="b mono block">{current || "no branch"}</span>
        </span>
        <Ic name="chev" size={12} />
      </button>
      {open && (
        <GitMenu label="Branches" onClose={() => setOpen(false)}>
          {branches.map((b) => (
            <button
              key={b.name}
              type="button"
              role="menuitem"
              className="menu-item"
              aria-current={b.current}
              onClick={() => {
                setOpen(false);
                if (!b.current) onSwitch(b.name);
              }}
            >
              <span className="mono truncate">{b.name}</span>
              {b.current ? (
                <Ic name="check" size={12} />
              ) : (
                <span className="cnt">
                  {b.ahead > 0 && `↑${b.ahead} `}
                  {b.behind > 0 && `↓${b.behind}`}
                </span>
              )}
            </button>
          ))}
          <div className="gmenu-new">
            <input
              className="field mono"
              value={name}
              placeholder="New branch name"
              aria-label="New branch name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
            />
            <button type="button" className="btn primary sm" disabled={!name.trim()} onClick={create}>
              Create
            </button>
          </div>
        </GitMenu>
      )}
    </span>
  );
}
