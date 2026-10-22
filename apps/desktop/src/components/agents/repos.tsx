"use client";

// The Repos tab: every repo with its branch, and only what needs you
// coloured (behind, failing checks, reviews). A row opens to its actions:
// a failed check says what failed and offers the fix right there. Changes
// opens the Git dock for that repo (stage, commit, amend).

import { useEffect, useState } from "react";
import { setDock, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow } from "@/lib/hooks";
import { dockTotal, readSeam, stacked } from "@/lib/seam";
import type { RepoRow, ReposOverview } from "@/lib/types";
import { Tip } from "../tip";
import { GitDock } from "./git-dock";
import { ReposLoading } from "./repos/loading";
import { RepoItem } from "./repos/repo-item";

function since(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}

export function Repos({ maxHeight }: { maxHeight?: number }) {
  const { data, refreshing, refresh, set } = useCached<ReposOverview>(
    "repos",
    () => api.reposOverview(false),
    60_000,
    true,
  );
  const [checked, setChecked] = useState(() => Date.now());
  const now = useNow(10_000);
  const [open, setOpen] = useState<string | null>(null);
  const dock = useAgents((s) => s.dock ?? null);
  const screenW = typeof window === "undefined" ? 1920 : window.screen.availWidth;
  const side = !stacked(screenW);
  const total = dockTotal(screenW);
  // Ctrl G with no repo chosen: the one with changes, else the first.
  const gitPath = dock === "first" ? ((data?.repos.find((r) => r.changed > 0) ?? data?.repos[0])?.path ?? null) : dock;
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      set(await api.reposOverview(true));
    } catch (e) {
      setError(String(e));
    } finally {
      setChecking(false);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new answer means a fresh check
  useEffect(() => setChecked(Date.now()), [data]);
  const gitRepo = data?.repos.find((r) => r.path === gitPath) ?? null;
  // Keep listW while the dock is open (even if this tab unmounts). Island owns
  // listW; closeDock() tears it down when the dock closes.
  const wide = Boolean(dock) && side;
  useEffect(() => {
    if (!wide) return;
    const cur = useAgents.getState().listW;
    if (cur != null) return;
    useAgents.setState({ listW: readSeam(total) });
  }, [wide, total]);
  // Resolve "first" once repos are known so the path stays stable.
  useEffect(() => {
    if (dock !== "first" || !gitPath) return;
    setDock(gitPath);
  }, [dock, gitPath]);
  // Narrow screens: the dock replaces the list (no room beside).
  if (gitPath && !side) {
    return (
      <div className="ak-repos flex min-h-0 flex-col gap-2">
        <GitDock path={gitPath} repo={gitRepo} repos={data?.repos} onPickRepo={setDock} onClose={() => setDock(null)} />
      </div>
    );
  }
  if (!data) return <ReposLoading />;
  if (data.repos.length === 0) {
    return (
      <section className="ak-repos">
        <p className="ak-rempty">No repos found in your code folders. Check your code folders in Settings.</p>
        <button type="button" className="ak-rcheck" disabled={checking || refreshing} onClick={() => void check()}>
          {checking || refreshing ? "Checking..." : "Check again"}
        </button>
        {error && (
          <p className="ak-rnote" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }
  const say = (path: string, text: string) => setNote((n) => ({ ...n, [path]: text }));
  const pull = (r: RepoRow, stash: boolean) =>
    void api
      .repoPull(r.path, stash)
      .then((m) => {
        say(r.path, m);
        void refresh?.();
      })
      .catch((e: unknown) => say(r.path, String(e)));
  const via =
    data.via === "gh"
      ? "GitHub connected"
      : data.via === "composio"
        ? "GitHub through Composio"
        : "GitHub not connected";
  const stash = (r: RepoRow) =>
    void api
      .gitStashPush(r.path)
      .then((m) => {
        say(r.path, m);
        void refresh?.();
      })
      .catch((e: unknown) => say(r.path, String(e)));
  const list = (
    <section className={`ak-repos${wide ? " ag-narrow" : ""}`} aria-label="Repos">
      {error && (
        <p className="ak-rnote" role="alert">
          {error}
        </p>
      )}
      {data.via === "none" && <p className="ak-rnote">Sign in with gh auth login to see PRs and checks.</p>}
      <div className="ak-scroll ak-rlist" style={{ maxHeight: maxHeight ? maxHeight - 48 : undefined }}>
        {data.repos.map((r) => {
          const expanded = open === r.path;
          return (
            <RepoItem
              key={r.path}
              r={r}
              expanded={expanded}
              current={wide && r.path === gitPath}
              note={note[r.path]}
              onToggle={() => {
                if (wide) setDock(r.path);
                else setOpen(expanded ? null : r.path);
              }}
              onPull={(stashFirst) => pull(r, stashFirst)}
              onStash={() => stash(r)}
            />
          );
        })}
      </div>
      <div className="ak-rfoot">
        <Tip label="Check now: fetch every repo and look for new commits and PRs">
          <button type="button" className="ak-rcheck" disabled={checking} onClick={() => void check()}>
            {checking ? "Checking..." : `Fetched ${since(checked, now)}`}
          </button>
        </Tip>
        <span>{via}</span>
      </div>
    </section>
  );
  // Side-by-side Git is rendered as a sibling of the island shell (island.tsx).
  return list;
}
