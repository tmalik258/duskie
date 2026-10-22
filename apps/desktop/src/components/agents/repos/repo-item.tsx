// One repo in the Repos tab: its checks, branch and status line, and when
// opened, what failed, reviews, PRs and the actions for it.

import { setDock, setTab, startHere, startSession } from "@/lib/agents";
import { api } from "@/lib/bridge";
import type { RepoRow } from "@/lib/types";
import { Tip } from "../../tip";

const CI_COLOR = { pass: "#30d158", fail: "#ff453a", pending: "#ff9f0a", none: "rgb(255 255 255 / 0.25)" } as const;
const CI_LABEL = { pass: "Checks pass", fail: "Checks failing", pending: "Checks running", none: "No checks" } as const;

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

export function RepoItem({
  r,
  expanded,
  current,
  note,
  onToggle,
  onPull,
  onStash,
}: {
  r: RepoRow;
  expanded: boolean;
  current: boolean;
  note: string | undefined;
  onToggle: () => void;
  onPull: (stashFirst: boolean) => void;
  onStash: () => void;
}) {
  const failing = r.prs.find((p) => p.failing && p.mine) ?? r.prs.find((p) => p.failing);
  const review = r.prs.find((p) => p.reviewRequested);
  return (
    <div className="ak-repo" data-open={expanded}>
      <div className="ak-rrow">
        <Tip label={CI_LABEL[r.ci]} className="inline-flex shrink-0">
          <span className="ak-rdot" style={{ background: CI_COLOR[r.ci] }} role="img" aria-label={CI_LABEL[r.ci]} />
        </Tip>
        <button
          type="button"
          className="ak-rmain"
          aria-expanded={expanded}
          aria-current={current ? "true" : undefined}
          onClick={onToggle}
        >
          <span className="ak-rt">
            <span className="ak-rn">{r.name}</span>
            <span className="ak-rb">{r.branch}</span>
          </span>
          <span className="ak-rs">{statusLine(r)}</span>
        </button>
        <span className="ak-racts">
          <button type="button" className="ak-rbtn" disabled={r.behind === 0} onClick={() => onPull(r.changed > 0)}>
            Pull
          </button>
          <button type="button" className="ak-rbtn" disabled={r.changed === 0} onClick={onStash}>
            Stash
          </button>
        </span>
      </div>
      {!expanded && note && <p className="ak-rnote">{note}</p>}
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
              <button key={p.number} type="button" className="ak-rline" onClick={() => void api.aiOpenLink(p.url)}>
                #{p.number} {p.title}
              </button>
            ))}
          <div className="ak-rbtns">
            <button type="button" className="ak-chip primary chip" onClick={() => setDock(r.path)}>
              Changes
            </button>
            {r.behind > 0 && (
              <button type="button" className="ak-chip chip" onClick={() => onPull(r.changed > 0)}>
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
          {note && <p className="ak-rnote">{note}</p>}
        </div>
      )}
    </div>
  );
}
