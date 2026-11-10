"use client";

// The repo picker at the left of the Git bar: names the repo, and when the
// host gives a list and a handler, switches the dock to another repo.

import { useState } from "react";
import { baseName } from "@/lib/changes";
import type { RepoRow } from "@/lib/types";
import { Ic } from "../../icon";
import { GitMenu } from "./git-menu";

export function RepoPicker({
  path,
  repo,
  repos,
  onPick,
}: {
  path: string;
  repo?: RepoRow | null;
  repos?: RepoRow[];
  onPick?: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const name = repo?.name ?? baseName(path);
  const label = (
    <>
      <Ic name="folder" size={14} />
      <span className="min-w-0">
        <small>Repository</small>
        <span className="b block">{name}</span>
      </span>
    </>
  );
  if (!onPick || !repos || repos.length < 2) return <span className="gpick">{label}</span>;
  return (
    <span className="gpop">
      <button
        type="button"
        className="gpick"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <Ic name="chev" size={12} />
      </button>
      {open && (
        <GitMenu label="Repositories" onClose={() => setOpen(false)}>
          {repos.map((r) => (
            <button
              key={r.path}
              type="button"
              role="menuitem"
              className="menu-item"
              aria-current={r.path === path}
              onClick={() => {
                setOpen(false);
                if (r.path !== path) onPick(r.path);
              }}
            >
              <span className="truncate">{r.name}</span>
              <span className="mono cnt">{r.branch}</span>
            </button>
          ))}
        </GitMenu>
      )}
    </span>
  );
}
