"use client";

// Changes: the files and the commit composer on the left (~300px), the diff of
// the selected file on the right.

import { useCallback, useState } from "react";
import { api } from "@/lib/bridge";
import { countChanges } from "@/lib/changes";
import type { GitFile } from "@/lib/types";
import { Composer } from "./composer";
import { DiffPane } from "./diff-pane";
import { FileList } from "./file-list";
import { useGitChanges } from "./use-git-changes";

export function ChangesPane({
  path,
  branch,
  rev,
  onChanged,
  onCount,
  onOpen,
}: {
  path: string;
  branch: string;
  rev: number;
  onChanged: () => void;
  onCount: (n: number) => void;
  onOpen: (file: string) => void;
}) {
  const { files, busy, note, act } = useGitChanges(path, rev, onChanged, onCount);
  const [sel, setSel] = useState<string | null>(null);
  // Lines added and removed per file, filled in as each diff is read.
  const [stats, setStats] = useState<Record<string, [number, number]>>({});
  const onStats = useCallback((file: string, added: number, removed: number) => {
    setStats((s) => (s[file]?.[0] === added && s[file]?.[1] === removed ? s : { ...s, [file]: [added, removed] }));
  }, []);

  const counts = countChanges(files);
  const current = files.find((f) => f.path === sel) ?? files[0] ?? null;

  const toggle = (f: GitFile) =>
    void act(() => (f.staged && !f.unstaged ? api.gitUnstage(path, [f.path]) : api.gitStage(path, [f.path])));
  const stageAll = () => void act(() => api.gitStage(path, []));
  const unstageAll = () => void act(() => api.gitUnstage(path, []));
  const discardAll = () => void act(() => api.gitDiscard(path, []));

  return (
    <div className="gbody">
      <div className="gleft">
        <FileList
          files={files}
          counts={counts}
          selected={current?.path ?? null}
          stats={stats}
          busy={busy}
          onSelect={setSel}
          onToggle={toggle}
          onStageAll={stageAll}
          onUnstageAll={unstageAll}
          onDiscardAll={discardAll}
        />
        {note && (
          <p className="hint px-3" role="status">
            {note}
          </p>
        )}
        <Composer path={path} branch={branch} staged={counts.staged} total={counts.total} busy={busy} act={act} />
      </div>
      <DiffPane
        path={path}
        file={current}
        rev={rev}
        busy={busy}
        onStats={onStats}
        onChanged={onChanged}
        onOpen={onOpen}
      />
    </div>
  );
}
