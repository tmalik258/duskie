"use client";

// History: the last commits down a lane of dots, and the one picked on the right.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import type { CommitRow } from "@/lib/types";

export function HistoryPane({ path, branch, rev }: { path: string; branch: string; rev: number }) {
  const [rows, setRows] = useState<CommitRow[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rev means something changed, so read the log again
  useEffect(() => {
    let live = true;
    void api
      .gitLog(path)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [path, rev]);

  if (!rows) {
    return (
      <div className="gbody single">
        <p className="gempty shimmer-text">Reading the history</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="gbody single">
        <p className="gempty">No commits yet.</p>
      </div>
    );
  }
  const current = rows.find((c) => c.hash === sel) ?? rows[0];
  const copy = (hash: string) => {
    void navigator.clipboard
      ?.writeText(hash)
      .then(() => setCopied(true))
      .catch(() => {});
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="gbody">
      <div className="gleft">
        <div className="hist" role="listbox" aria-label="Commits">
          {rows.map((c, i) => (
            <button
              key={c.hash}
              type="button"
              role="option"
              aria-selected={current?.hash === c.hash}
              className="crow-h"
              onClick={() => setSel(c.hash)}
            >
              <span className="lane">
                <i className={i === 0 ? "head" : undefined} />
              </span>
              <span className="cbody">
                <b>
                  {i === 0 && branch && <span className="reftag">{branch}</span>}
                  {c.subject}
                </b>
                <small>
                  <span className="mono">{c.hash}</span>
                  <span className="truncate">{c.author}</span>
                  <span>{c.when}</span>
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>
      {current && (
        <div className="cdetail">
          <h4>{current.subject}</h4>
          <div className="kv">
            <span>Commit</span>
            <span className="mono">{current.hash}</span>
            <span>Author</span>
            <span>{current.author}</span>
            <span>When</span>
            <span>{current.when}</span>
          </div>
          <div>
            <button type="button" className="btn sm" onClick={() => copy(current.hash)}>
              {copied ? "Copied" : "Copy hash"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
