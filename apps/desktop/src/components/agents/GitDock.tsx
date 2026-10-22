"use client";

// The Git dock host: the bar, the tabs and the active pane. Full screen opens
// the editor; Esc closes the dock (or an open menu first).

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { fetchGitCached, gitCacheKey, invalidateGitPath, peekGitCache } from "@/lib/git-cache";
import type { MergeState, RepoRow, StashRow } from "@/lib/types";
import { Editor } from "./Editor";
import { ChangesPane } from "./gitdock/ChangesPane";
import { GitBar } from "./gitdock/GitBar";
import { type GitTab, GitTabs } from "./gitdock/GitTabs";
import { HistoryPane } from "./gitdock/HistoryPane";
import { MergePane } from "./gitdock/MergePane";
import { PrPane } from "./gitdock/PrPane";
import { StashesPane } from "./gitdock/StashesPane";

export function GitDock({
  path,
  repo,
  onClose,
  repos,
  onPickRepo,
}: {
  path: string;
  repo?: RepoRow | null;
  onClose: () => void;
  repos?: RepoRow[];
  onPickRepo?: (path: string) => void;
}) {
  const [tab, setTab] = useState<GitTab>("changes");
  const stashKey = gitCacheKey("stashes", path);
  const [stashes, setStashes] = useState<StashRow[]>(() => peekGitCache<StashRow[]>(stashKey) ?? []);
  const [changed, setChanged] = useState(0);
  const [full, setFull] = useState(false);
  const [at, setAt] = useState<{ path: string; atChange?: boolean } | null>(null);
  // Bumps when anything changed, so every pane reads git again.
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => {
    invalidateGitPath(path);
    setRev((r) => r + 1);
  }, [path]);

  // Stashes load only when that tab is open - not on every Changes open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rev means something changed, so read stashes again
  useEffect(() => {
    if (tab !== "stashes") return;
    const hit = peekGitCache<StashRow[]>(stashKey);
    if (hit) setStashes(hit);
    void fetchGitCached(stashKey, () => api.gitStashes(path))
      .then(setStashes)
      .catch(() => {});
  }, [tab, path, rev, stashKey]);

  // A pull that stopped on conflicts opens the Merge tab; it goes once solved.
  const [merge, setMerge] = useState<MergeState | null>(null);
  const hadMerge = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: rev means something changed, so read conflicts again
  useEffect(() => {
    let live = true;
    void api
      .mergeState(path)
      .then((m) => {
        if (!live) return;
        const open = m.files.length > 0 ? m : null;
        setMerge(open);
        if (open && !hadMerge.current) setTab("merge");
        if (!open) setTab((t) => (t === "merge" ? "changes" : t));
        hadMerge.current = open !== null;
      })
      .catch(() => live && setMerge(null));
    return () => {
      live = false;
    };
  }, [path, rev]);

  // Esc closes the dock; the editor and an open menu handle their own Esc.
  useEffect(() => {
    if (full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[data-gmenu]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, full]);

  if (full) {
    return (
      <Editor
        root={path}
        initial={at}
        onClose={() => {
          setFull(false);
          setAt(null);
        }}
      />
    );
  }

  const branch = repo?.branch ?? "";
  const pr = repo?.prs.find((p) => p.branch === branch) ?? null;
  return (
    <section className="gd-dock-panel" aria-label="Git">
      <div className="gwin">
        <GitBar
          path={path}
          repo={repo}
          repos={repos}
          onPickRepo={onPickRepo}
          rev={rev}
          onChanged={bump}
          onPr={() => setTab("pr")}
          onFull={() => {
            setAt(null);
            setFull(true);
          }}
          onClose={onClose}
        />
        <GitTabs
          tab={tab}
          onTab={setTab}
          changes={changed}
          stashes={stashes.length}
          conflicts={merge?.files.length ?? 0}
        />
        {tab === "merge" && merge && (
          <MergePane
            path={path}
            state={merge}
            onChanged={bump}
            onOpen={(file) => {
              setAt({ path: file });
              setFull(true);
            }}
          />
        )}
        {tab === "changes" && (
          <ChangesPane
            path={path}
            branch={branch}
            rev={rev}
            onChanged={bump}
            onCount={setChanged}
            onOpen={(file) => {
              setAt({ path: file, atChange: true });
              setFull(true);
            }}
          />
        )}
        {tab === "history" && <HistoryPane path={path} branch={branch} rev={rev} />}
        {tab === "pr" && <PrPane pr={pr} branch={branch || null} />}
        {tab === "stashes" && <StashesPane path={path} stashes={stashes} reload={bump} />}
      </div>
    </section>
  );
}
