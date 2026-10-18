"use client";

// Fetch, Pull and Push in one group, with how far ahead or behind the branch is.

import { api } from "@/lib/bridge";
import { Ic } from "../../Icon";
import { Tip } from "../../Tip";

export function SyncGroup({
  path,
  ahead,
  behind,
  busy,
  run,
}: {
  path: string;
  ahead: number;
  behind: number;
  busy: boolean;
  run: (work: () => Promise<string>) => void;
}) {
  return (
    <div className="sync">
      <Tip label="Fetch from the remote">
        <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => api.gitFetch(path))}>
          <Ic name="refresh" size={13} />
          Fetch
        </button>
      </Tip>
      <Tip label={behind > 0 ? `Pull ${behind} new commit${behind > 1 ? "s" : ""}` : "Pull from the remote"}>
        <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => api.repoPull(path, false))}>
          <Ic name="down" size={13} />
          Pull
          {behind > 0 && <span className="cnt">{behind}</span>}
        </button>
      </Tip>
      <Tip label={ahead > 0 ? `Push ${ahead} commit${ahead > 1 ? "s" : ""}` : "Push to the remote"}>
        <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => api.gitPush(path))}>
          <Ic name="up" size={13} />
          Push
          {ahead > 0 && <span className="cnt">{ahead}</span>}
        </button>
      </Tip>
    </div>
  );
}
