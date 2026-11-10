"use client";

// Pull request: the branch's open PR, its checks and review state.

import { api } from "@/lib/bridge";
import type { RepoRow } from "@/lib/types";

type Pr = RepoRow["prs"][number];

const CI = {
  pass: { text: "Checks pass", cls: "" },
  fail: { text: "Checks failing", cls: " bad" },
  pending: { text: "Checks running", cls: " warn" },
  none: { text: "No checks", cls: "" },
} as const;

function CheckRow({ pr }: { pr: Pr }) {
  const ci = CI[pr.ci];
  const dot = { pass: "var(--ok)", fail: "var(--err)", pending: "var(--warn)", none: "var(--ink-4)" }[pr.ci];
  return (
    <div className="ck">
      {pr.ci === "pending" ? (
        <i className="spin" aria-hidden="true" />
      ) : (
        <span className="rd-dot" style={{ background: dot }} />
      )}
      <span className="t">
        {ci.text}
        {pr.failing && <small>{pr.failing[0]}</small>}
      </span>
      {pr.failing && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => void api.aiOpenLink(pr.failing?.[1] ?? pr.url).catch(() => {})}
        >
          View
        </button>
      )}
    </div>
  );
}

export function PrPane({ pr, branch }: { pr: Pr | null; branch: string | null }) {
  if (!pr) {
    return (
      <div className="gbody single">
        <p className="gempty">{branch ? `No open pull request for ${branch}.` : "No open pull request."}</p>
      </div>
    );
  }
  return (
    <div className="gbody single">
      <div className="pr">
        <div className="pr-head">
          <h4>{pr.title}</h4>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono cnt">#{pr.number}</span>
            <span className={`pill-st${CI[pr.ci].cls}`}>{CI[pr.ci].text}</span>
            <span className="mono cnt">{pr.branch}</span>
          </div>
        </div>
        <div className="checks">
          <CheckRow pr={pr} />
          {pr.reviewRequested && (
            <div className="ck">
              <span className="rd-dot" style={{ background: "var(--warn)" }} />
              <span className="t">Your review is requested</span>
            </div>
          )}
        </div>
        <div>
          <button type="button" className="btn primary" onClick={() => void api.aiOpenLink(pr.url).catch(() => {})}>
            Open on GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
