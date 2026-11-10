"use client";

// The left column of Changes: Staged on top, the rest under Changes, each
// grouped by folder with a stage checkbox, status letter, name and line counts.

import { useState } from "react";
import { baseName, type Counts, groupByFolder } from "@/lib/changes";
import type { GitFile } from "@/lib/types";
import { Ic } from "../../icon";

function letter(kind: string): string {
  return kind === "?" ? "A" : kind;
}

function ChangeBar({ stat }: { stat?: [number, number] }) {
  if (!stat || stat[0] + stat[1] === 0) return <span className="cbar" aria-hidden="true" />;
  const total = stat[0] + stat[1];
  return (
    <span className="cnums mono" role="img" aria-label={`${stat[0]} added, ${stat[1]} removed`}>
      <span className="cbar" aria-hidden="true">
        <i className="ad" style={{ width: `${(stat[0] / total) * 100}%` }} />
        <i className="de" style={{ width: `${(stat[1] / total) * 100}%` }} />
      </span>
      {stat[0] > 0 && <span className="a">+{stat[0]}</span>}
      {stat[1] > 0 && <span className="d">-{stat[1]}</span>}
    </span>
  );
}

export function FileList({
  files,
  selected,
  stats,
  busy,
  onSelect,
  onToggle,
  onStageAll,
  onUnstageAll,
  onDiscardAll,
}: {
  files: GitFile[];
  counts: Counts;
  selected: string | null;
  stats: Record<string, [number, number]>;
  busy: boolean;
  onSelect: (path: string) => void;
  onToggle: (f: GitFile) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onDiscardAll: () => void;
}) {
  const [sure, setSure] = useState(false);
  const staged = files.filter((f) => f.staged && !f.unstaged);
  const rest = files.filter((f) => !(f.staged && !f.unstaged));
  const rows = (list: GitFile[]) =>
    groupByFolder(list).map((g) => (
      <div key={g.folder}>
        <p className="fdir">
          <Ic name="folder" size={11} />
          <span>{g.folder}</span>
        </p>
        {g.files.map((f) => {
          const on = f.staged && !f.unstaged;
          const canStage = !busy && f.kind !== "U";
          return (
            <div
              key={f.path}
              role="option"
              tabIndex={0}
              aria-selected={selected === f.path}
              aria-checked={on}
              aria-label={`${baseName(f.path)}, ${on ? "staged" : "unstaged"}`}
              className="frow"
              onClick={() => onSelect(f.path)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSelect(f.path);
                } else if (e.key === " " && canStage) {
                  e.preventDefault();
                  onToggle(f);
                }
              }}
            >
              {/* Decorative: staging is aria-checked on the option; Space toggles it. */}
              <span
                className="stg"
                aria-hidden="true"
                data-on={on ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canStage) onToggle(f);
                }}
              >
                <Ic name="check" size={11} weight={2} />
              </span>
              <span className={`st ${letter(f.kind)}`}>{letter(f.kind)}</span>
              <span className="fpath" title={f.path}>
                {baseName(f.path)}
              </span>
              <ChangeBar stat={stats[f.path]} />
            </div>
          );
        })}
      </div>
    ));
  return (
    <div className="files" role="listbox" aria-label="Changed files" aria-multiselectable="true">
      {files.length === 0 && <p className="gempty">Nothing has changed.</p>}
      {staged.length > 0 && (
        <>
          <div className="fhead">
            <span>Staged</span>
            <span className="mono">{staged.length}</span>
            <span className="acts">
              <button type="button" className="btn ghost sm" disabled={busy} onClick={onUnstageAll}>
                <Ic name="minus" size={11} /> Unstage all
              </button>
            </span>
          </div>
          {rows(staged)}
        </>
      )}
      {rest.length > 0 && (
        <>
          <div className="fhead">
            <span>Changes</span>
            <span className="mono">{rest.length}</span>
            <span className="acts">
              <button type="button" className="btn ghost sm" disabled={busy} onClick={onStageAll}>
                <Ic name="plus" size={11} /> Stage all
              </button>
              <button
                type="button"
                className="btn ghost sm danger"
                disabled={busy}
                onBlur={() => setSure(false)}
                onClick={() => {
                  if (!sure) return setSure(true);
                  setSure(false);
                  onDiscardAll();
                }}
                title="Discarded changes go to Stashes, so you can put them back"
              >
                {sure ? `Discard ${rest.length}? Click again` : "Discard all"}
              </button>
            </span>
          </div>
          {rows(rest)}
        </>
      )}
    </div>
  );
}
