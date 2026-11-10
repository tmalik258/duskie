"use client";

// The Git dock's top bar: repo and branch pickers, fetch/pull/push with
// ahead and behind counts, the pull request chip, a more menu, and close.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { fetchGitCached, gitCacheKey, invalidateGitPath, peekGitCache } from "@/lib/git-cache";
import type { GitBranch, RepoRow } from "@/lib/types";
import { Ic } from "../../Icon";
import { Tip } from "../../Tip";
import { BranchPicker } from "./BranchPicker";
import { GitMenu } from "./GitMenu";
import { RepoPicker } from "./RepoPicker";
import { SyncGroup } from "./SyncGroup";

const CI_COLOR = { pass: "var(--ok)", fail: "var(--err)", pending: "var(--warn)", none: "var(--ink-4)" } as const;

interface GitBarProps {
  path: string;
  repo?: RepoRow | null;
  repos?: RepoRow[];
  onPickRepo?: (path: string) => void;
  /** Bumps whenever something changed, so panes reload. */
  rev: number;
  onChanged: () => void;
  onPr: () => void;
  onFull: () => void;
  onClose: () => void;
}

export function GitBar({ path, repo, repos, onPickRepo, rev, onChanged, onPr, onFull, onClose }: GitBarProps) {
  const key = gitCacheKey("branches", path);
  const [branches, setBranches] = useState<GitBranch[]>(() => peekGitCache<GitBranch[]>(key) ?? []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const load = useCallback(() => {
    void fetchGitCached(key, () => api.gitBranches(path))
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [key, path]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: rev means something changed, so read the branches again
  useEffect(() => {
    const hit = peekGitCache<GitBranch[]>(key);
    if (hit) setBranches(hit);
    load();
  }, [load, rev, key]);

  const run = useCallback(
    async (work: () => Promise<string>) => {
      setBusy(true);
      setNote(null);
      try {
        setNote(await work());
      } catch (e) {
        setNote(String(e));
      } finally {
        setBusy(false);
        invalidateGitPath(path);
        onChanged();
      }
    },
    [onChanged, path],
  );

  const current = branches.find((b) => b.current);
  const branch = current?.name ?? repo?.branch ?? "";
  const ahead = current?.ahead ?? repo?.ahead ?? 0;
  const behind = current?.behind ?? repo?.behind ?? 0;
  const upstream = current?.upstream ?? true;
  const pr = repo?.prs.find((p) => p.branch === branch) ?? null;
  const web = pr?.url ?? (repo?.slug ? `https://github.com/${repo.slug}` : null);

  return (
    <div className="gbar">
      <RepoPicker path={path} repo={repo} repos={repos} onPick={onPickRepo} />
      <span className="gsep" />
      <BranchPicker
        current={branch}
        branches={branches}
        busy={busy}
        onSwitch={(name) => void run(() => api.gitSwitchBranch(path, name))}
        onCreate={(name) => void run(() => api.gitCreateBranch(path, name))}
      />
      <span className="gsep" />
      <SyncGroup path={path} ahead={ahead} behind={behind} upstream={upstream} busy={busy} run={(w) => void run(w)} />
      {pr && (
        <button type="button" className="prchip" onClick={onPr} aria-label={`Pull request ${pr.number}`}>
          <Ic name="pr" size={13} />
          <span className="mono">#{pr.number}</span>
          <span className="rd-dot" style={{ background: CI_COLOR[pr.ci] }} />
        </button>
      )}
      {note && (
        <span className="ghint" role="status" title={note}>
          {note}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Tip label="Full screen">
          <button type="button" className="btn ghost icon sm" aria-label="Full screen" onClick={onFull}>
            <Ic name="open" size={14} />
          </button>
        </Tip>
        <span className="gpop">
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
          >
            <Ic name="more" size={14} />
          </button>
          {more && (
            <GitMenu right label="More" onClose={() => setMore(false)}>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setMore(false);
                  onChanged();
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setMore(false);
                  void api.repoOpen(path).catch(() => {});
                }}
              >
                Open folder
              </button>
              {web && (
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setMore(false);
                    void api.aiOpenLink(web).catch(() => {});
                  }}
                >
                  Open on GitHub
                </button>
              )}
            </GitMenu>
          )}
        </span>
        <button type="button" className="btn ghost icon sm" aria-label="Close Git" onClick={onClose}>
          <Ic name="x" size={12} />
        </button>
      </div>
    </div>
  );
}
