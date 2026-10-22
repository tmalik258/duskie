"use client";

// Fetch, then only what applies: Pull when behind, Push when ahead (or to
// publish a new branch), Sync when both, like an editor's status bar.

import { api } from "@/lib/bridge";
import { Ic } from "../../Icon";
import { Tip } from "../../Tip";

const commits = (n: number) => `${n} commit${n > 1 ? "s" : ""}`;

export function SyncGroup({
  path,
  ahead,
  behind,
  upstream,
  busy,
  run,
}: {
  path: string;
  ahead: number;
  behind: number;
  upstream: boolean;
  busy: boolean;
  run: (work: () => Promise<string>) => void;
}) {
  const both = ahead > 0 && behind > 0;
  const canPush = ahead > 0 || !upstream;
  return (
    <div className="sync">
      <Tip label="Fetch from the remote">
        <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => api.gitFetch(path))}>
          <Ic name="refresh" size={13} />
          Fetch
        </button>
      </Tip>
      {both ? (
        <Tip label={`Pull ${commits(behind)}, then push ${commits(ahead)}`}>
          <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => api.gitSync(path))}>
            <Ic name="refresh" size={13} />
            Sync
            <span className="cnt">
              {behind}↓ {ahead}↑
            </span>
          </button>
        </Tip>
      ) : (
        <>
          <Tip label={behind > 0 ? `Pull ${commits(behind)}` : "Nothing to pull"}>
            <button
              type="button"
              className="btn sm"
              disabled={busy || behind === 0}
              onClick={() => run(() => api.repoPull(path, true))}
            >
              <Ic name="down" size={13} />
              Pull
              {behind > 0 && <span className="cnt">{behind}</span>}
            </button>
          </Tip>
          <Tip label={!upstream ? "Publish this branch" : ahead > 0 ? `Push ${commits(ahead)}` : "Nothing to push"}>
            <button
              type="button"
              className="btn sm"
              disabled={busy || !canPush}
              onClick={() => run(() => api.gitPush(path))}
            >
              <Ic name="up" size={13} />
              {upstream ? "Push" : "Publish"}
              {ahead > 0 && <span className="cnt">{ahead}</span>}
            </button>
          </Tip>
        </>
      )}
    </div>
  );
}
