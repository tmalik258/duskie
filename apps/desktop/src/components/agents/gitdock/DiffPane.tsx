"use client";

// The right column of Changes: the selected file's diff, hunk by hunk, each
// unstaged hunk with its own Stage hunk button.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { fetchGitCached, gitCacheKey, peekGitCache } from "@/lib/git-cache";
import type { FileChange, GitFile } from "@/lib/types";
import { numberLines } from "./diff-lines";

const SIGN = { add: "+", del: "-", ctx: " " } as const;

export function DiffPane({
  path,
  file,
  rev,
  busy,
  onStats,
  onChanged,
  onOpen,
}: {
  path: string;
  file: GitFile | null;
  rev: number;
  busy: boolean;
  onStats: (file: string, added: number, removed: number) => void;
  onChanged: () => void;
  onOpen: (file: string) => void;
}) {
  const filePath = file?.path ?? null;
  // A file that is only staged shows its staged diff; any other shows what is still unstaged.
  const staged = file ? file.staged && !file.unstaged : false;
  const diffKey = filePath ? gitCacheKey("diff", path, filePath, staged ? "1" : "0") : null;
  const [diff, setDiff] = useState<FileChange | null>(() => (diffKey ? peekGitCache<FileChange>(diffKey) : null));
  const [error, setError] = useState<string | null>(null);
  const [staging, setStaging] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rev means something changed, so read the diff again
  useEffect(() => {
    if (!filePath || !diffKey) return;
    let live = true;
    setError(null);
    const hit = peekGitCache<FileChange>(diffKey);
    if (hit) {
      setDiff(hit);
      onStats(filePath, hit.added, hit.removed);
    }
    void fetchGitCached(diffKey, () => api.gitFileDiff(path, filePath, staged))
      .then((d) => {
        if (!live) return;
        setDiff(d);
        onStats(filePath, d.added, d.removed);
      })
      .catch((e) => {
        if (!live) return;
        setDiff(null);
        setError(String(e));
      });
    return () => {
      live = false;
    };
  }, [path, filePath, staged, rev, onStats, diffKey]);

  const stageHunk = async (index: number) => {
    if (!filePath) return;
    setStaging(true);
    try {
      await api.gitStageHunk(path, filePath, index);
    } catch (e) {
      setError(String(e));
    } finally {
      setStaging(false);
      onChanged();
    }
  };

  const shown = diff && diff.path === filePath ? diff : null;
  return (
    <div className="gright">
      <div className="dhead">
        <span className="p" title={filePath ?? undefined}>
          {filePath ?? "No file selected"}
        </span>
        {shown && (
          <span className="fmeta mono">
            <span className="text-(--ok)">+{shown.added}</span> <span className="text-(--err)">-{shown.removed}</span>
          </span>
        )}
        {staged && <span className="pill-st">Staged</span>}
        {file && file.kind !== "D" && (
          <button type="button" className="btn ghost sm" onClick={() => onOpen(file.path)}>
            Open
          </button>
        )}
      </div>
      <div className="diff">
        {!file && <p className="gempty">Pick a file to see what changed.</p>}
        {file && !shown && !error && <p className="gempty shimmer-text">Reading the diff</p>}
        {file && !shown && error && <p className="gempty">{error}</p>}
        {shown?.hunks.map((h, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: hunks have no id, and a header can repeat
          <div key={`${h.header}:${i}`}>
            <div className="hunk-h mono">
              <span className="truncate">{h.header}</span>
              {!staged && (
                <button type="button" className="btn sm" disabled={busy || staging} onClick={() => void stageHunk(i)}>
                  Stage hunk
                </button>
              )}
            </div>
            {numberLines(h).map((l, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines of one hunk never reorder
              <div key={j} className={`dl ${l.kind}`}>
                <span className="n">{l.n}</span>
                <span className="s">{SIGN[l.kind]}</span>
                <span className="c">{l.text}</span>
              </div>
            ))}
          </div>
        ))}
        {shown && shown.hunks.length === 0 && <p className="gempty">No line changes to show.</p>}
      </div>
    </div>
  );
}
