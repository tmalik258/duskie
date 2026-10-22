"use client";

// The Repos tab: every repo with its branch, and only what needs you
// coloured (behind, failing checks, reviews). A row opens to its actions:
// a failed check says what failed and offers the fix right there. Changes
// opens the Git dock for that repo (stage, commit, amend).

import { useEffect, useState } from "react";
import { setDock, setTab, startHere, startSession, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow } from "@/lib/hooks";
import { dockTotal, readSeam, stacked } from "@/lib/seam";
import type { RepoRow, ReposOverview } from "@/lib/types";
import { Tip } from "../tip";
import { GitDock } from "./git-dock";

const CI_COLOR = { pass: "#30d158", fail: "#ff453a", pending: "#ff9f0a", none: "rgb(255 255 255 / 0.25)" } as const;
const CI_LABEL = { pass: "Checks pass", fail: "Checks failing", pending: "Checks running", none: "No checks" } as const;

function since(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}

/** One plain line: what to push and pull, then the PR or checks that need you. */
function statusLine(r: RepoRow): string {
  const parts: string[] = [];
  const sync = [r.ahead > 0 && `${r.ahead} to push`, r.behind > 0 && `${r.behind} to pull`].filter(Boolean).join(", ");
  parts.push(sync ? `${sync[0].toUpperCase()}${sync.slice(1)}` : "Up to date");
  const failing = r.prs.find((p) => p.failing);
  if (failing) parts.push(`PR #${failing.number}: ${failing.failing?.[0] ?? "check"} failing`);
  else if (r.reviews > 0) parts.push(`${r.reviews} to review`);
  else if (r.ci === "pending") parts.push("Checks running");
  if (r.changed > 0) parts.push(`${r.changed} changed`);
  return parts.join(". ");
}

// Placeholder rows shaped like the real ones, so the list does not jump
// when the repos arrive.
const SKELETON = [
  [46, 30, 2],
  [62, 22, 1],
  [38, 26, 0],
] as const;

function ReposLoading() {
  return (
    <section className="ak-repos" aria-label="Repos" aria-busy="true">
      <div className="ak-rh">
        <span className="shimmer-text">Finding your repos and checking GitHub</span>
      </div>
      {SKELETON.map(([name, branch, tags], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
        <div key={i} className="ak-rrow ak-rskel" aria-hidden="true" style={{ animationDelay: `${i * 120}ms` }}>
          <i className="ak-rdot" />
          <span className="min-w-0">
            <i className="ak-rbar" style={{ width: `${name}%` }} />
            <i className="ak-rbar ak-rbar-s" style={{ width: `${branch}%` }} />
          </span>
          <span className="ak-rtags">
            {Array.from({ length: tags }, (_, t) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder tags
              <i key={t} className="ak-rbar ak-rbar-t" />
            ))}
          </span>
        </div>
      ))}
    </section>
  );
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
          const current = wide && r.path === gitPath;
          const failing = r.prs.find((p) => p.failing && p.mine) ?? r.prs.find((p) => p.failing);
          const review = r.prs.find((p) => p.reviewRequested);
          return (
            <div key={r.path} className="ak-repo" data-open={expanded}>
              <div className="ak-rrow">
                <Tip label={CI_LABEL[r.ci]} className="inline-flex shrink-0">
                  <span
                    className="ak-rdot"
                    style={{ background: CI_COLOR[r.ci] }}
                    role="img"
                    aria-label={CI_LABEL[r.ci]}
                  />
                </Tip>
                <button
                  type="button"
                  className="ak-rmain"
                  aria-expanded={expanded}
                  aria-current={current ? "true" : undefined}
                  onClick={() => {
                    if (wide) setDock(r.path);
                    else setOpen(expanded ? null : r.path);
                  }}
                >
                  <span className="ak-rt">
                    <span className="ak-rn">{r.name}</span>
                    <span className="ak-rb">{r.branch}</span>
                  </span>
                  <span className="ak-rs">{statusLine(r)}</span>
                </button>
                <span className="ak-racts">
                  <button
                    type="button"
                    className="ak-rbtn"
                    disabled={r.behind === 0}
                    onClick={() => pull(r, r.changed > 0)}
                  >
                    Pull
                  </button>
                  <button type="button" className="ak-rbtn" disabled={r.changed === 0} onClick={() => stash(r)}>
                    Stash
                  </button>
                </span>
              </div>
              {!expanded && note[r.path] && <p className="ak-rnote">{note[r.path]}</p>}
              {expanded && (
                <div className="ak-rx ak-in">
                  {failing?.failing && (
                    <div className="ak-rci">
                      <span>
                        <b>CI failed</b> on PR #{failing.number} · {failing.failing[0]}
                      </span>
                      <div className="ak-rbtns">
                        <button
                          type="button"
                          className="ak-chip chip"
                          onClick={() => void api.aiOpenLink(failing.failing?.[1] ?? failing.url)}
                        >
                          Open logs
                        </button>
                        <button
                          type="button"
                          className="ak-chip primary chip"
                          onClick={() =>
                            void startSession(
                              "claude_code",
                              r.path,
                              `The "${failing.failing?.[0]}" check failed on PR #${failing.number} (${failing.branch}). Find out why from ${failing.failing?.[1] ?? failing.url} and fix it.`,
                              "edit",
                            ).then(() => setTab("agents"))
                          }
                        >
                          Ask Claude Code to fix
                        </button>
                      </div>
                    </div>
                  )}
                  {review && (
                    <button type="button" className="ak-rline" onClick={() => void api.aiOpenLink(review.url)}>
                      Review requested on #{review.number} · {review.title}
                    </button>
                  )}
                  {r.prs
                    .filter((p) => p !== failing && p !== review)
                    .map((p) => (
                      <button
                        key={p.number}
                        type="button"
                        className="ak-rline"
                        onClick={() => void api.aiOpenLink(p.url)}
                      >
                        #{p.number} {p.title}
                      </button>
                    ))}
                  <div className="ak-rbtns">
                    <button type="button" className="ak-chip primary chip" onClick={() => setDock(r.path)}>
                      Changes
                    </button>
                    {r.behind > 0 && (
                      <button type="button" className="ak-chip chip" onClick={() => pull(r, r.changed > 0)}>
                        {r.changed > 0 ? "Stash, pull, put back" : "Pull"}
                      </button>
                    )}
                    <button type="button" className="ak-chip chip" onClick={() => void api.repoOpen(r.path)}>
                      Open in editor
                    </button>
                    {r.slug && (
                      <button
                        type="button"
                        className="ak-chip chip"
                        onClick={() => void api.aiOpenLink(`https://github.com/${r.slug}`)}
                      >
                        Open on GitHub
                      </button>
                    )}
                    <button type="button" className="ak-chip chip" onClick={() => startHere(r.path)}>
                      Start an agent here
                    </button>
                  </div>
                  {note[r.path] && <p className="ak-rnote">{note[r.path]}</p>}
                </div>
              )}
            </div>
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
