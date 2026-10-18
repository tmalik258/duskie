"use client";

// The left column of Changes: files grouped by folder, each with a stage
// checkbox, its status letter, its name and a bar of lines added and removed.

import { baseName, type Counts, groupByFolder } from "@/lib/changes";
import type { GitFile } from "@/lib/types";
import { Ic } from "../../Icon";

function letter(kind: string): string {
  return kind === "?" ? "A" : kind;
}

function ChangeBar({ stat }: { stat?: [number, number] }) {
  if (!stat || stat[0] + stat[1] === 0) return <span className="cbar" aria-hidden="true" />;
  const total = stat[0] + stat[1];
  return (
    <span className="cbar" role="img" aria-label={`${stat[0]} added, ${stat[1]} removed`}>
      <i className="ad" style={{ width: `${(stat[0] / total) * 100}%` }} />
      <i className="de" style={{ width: `${(stat[1] / total) * 100}%` }} />
    </span>
  );
}

export function FileList({
  files,
  counts,
  selected,
  stats,
  busy,
  onSelect,
  onToggle,
  onToggleAll,
}: {
  files: GitFile[];
  counts: Counts;
  selected: string | null;
  stats: Record<string, [number, number]>;
  busy: boolean;
  onSelect: (path: string) => void;
  onToggle: (f: GitFile) => void;
  onToggleAll: () => void;
}) {
  return (
    <>
      <div className="fhead">
        <span>Changes</span>
        <span className="mono">
          {counts.staged}/{counts.total}
        </span>
        <span className="acts">
          <button type="button" className="btn ghost sm" disabled={busy || counts.total === 0} onClick={onToggleAll}>
            {counts.all ? "Unstage all" : "Stage all"}
          </button>
        </span>
      </div>
      <div className="files" role="listbox" aria-label="Changed files">
        {files.length === 0 && <p className="gempty">Nothing has changed.</p>}
        {groupByFolder(files).map((g) => (
          <div key={g.folder}>
            <p className="fdir">
              <Ic name="folder" size={11} />
              <span>{g.folder}</span>
            </p>
            {g.files.map((f) => (
              <div
                key={f.path}
                role="option"
                tabIndex={0}
                aria-selected={selected === f.path}
                className="frow"
                onClick={() => onSelect(f.path)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(f.path);
                  }
                }}
              >
                <button
                  type="button"
                  aria-pressed={f.staged && !f.unstaged}
                  aria-label={`Stage ${f.path}`}
                  className="stg"
                  disabled={busy || f.kind === "U"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(f);
                  }}
                >
                  <Ic name="check" size={11} weight={2} />
                </button>
                <span className={`st ${letter(f.kind)}`}>{letter(f.kind)}</span>
                <span className="fpath" title={f.path}>
                  {baseName(f.path)}
                </span>
                <ChangeBar stat={stats[f.path]} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
