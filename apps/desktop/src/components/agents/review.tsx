"use client";

// Keep or drop what an agent changed, one change at a time. Files on the
// left, the open file's changes on the right. Dropping undoes the change on
// disk at once; the review closes on its own once every change is decided.
// Keys: Y keep, N drop, J K next and back, [ ] files, C comment, Alt 1 / Alt 2 all.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markReviewed, type Session, sendToSession } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { FileTree } from "./review/file-tree";
import { groupByDir, keyOf, letter, rows } from "./review/hunk";
import { HunkView } from "./review/hunk-view";
import { ReviewLoading } from "./review/loading";
import { ReviewError } from "./review/review-error";
import { ReviewFoot } from "./review/review-foot";
import { useReviewCursor } from "./review/use-review-cursor";
import { useReviewFiles } from "./review/use-review-files";
import { useReviewKeys } from "./review/use-review-keys";
import { useKept, useReviewFinish } from "./review/use-review-progress";

export { ReviewLoading } from "./review/loading";

export function Review({ session, maxHeight, onDone }: { session: Session; maxHeight: number; onDone: () => void }) {
  const { files, finished, error, setError, slow, load } = useReviewFiles(session.id);
  // Kept changes by "path:header"; dropped ones leave the diff, so only their count stays.
  const [kept, setKept] = useKept(session.id, session.turnAt);
  const list = files ?? [];
  const { fileAt, hunkAt, setHunkAt, advance, goFile } = useReviewCursor(list, kept);
  const [dropped, setDropped] = useState(0);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [comment, setComment] = useState<string | null>(null);
  const diffRef = useRef<HTMLDivElement>(null);

  // Nothing to review: leave at once.
  useEffect(() => {
    if (finished && files !== null && files.length === 0 && dropped === 0 && !error) {
      markReviewed(session.id, 0);
      onDone();
    }
  }, [finished, files, dropped, error, onDone, session.id]);

  const file = list[Math.min(fileAt, list.length - 1)];
  const total = list.reduce((n, f) => n + f.hunks.length, 0) + dropped;
  const done = kept.size + dropped;
  const left = total - done;
  const filesLeft = list.filter((f) => f.hunks.some((h) => !kept.has(keyOf(f, h)))).length;

  const drop = useCallback(
    (path: string | null, hunk: number | null, count: number) =>
      void api
        .agentUndo(session.id, path, hunk)
        .then(() => setDropped((d) => d + count))
        .then(load)
        .catch((e: unknown) => setError(String(e))),
    [session.id, load, setError],
  );
  const keep = (keys: string[]) => setKept((k) => new Set([...k, ...keys]));

  const yes = useCallback(() => {
    const h = file?.hunks[hunkAt];
    if (!file || !h) return;
    const next = new Set(kept).add(keyOf(file, h));
    setKept(next);
    advance(fileAt, hunkAt + 1, next);
  }, [file, hunkAt, kept, setKept, fileAt, advance]);
  const no = useCallback(() => {
    if (!file?.hunks[hunkAt]) return;
    drop(file.path, hunkAt, 1);
  }, [file, hunkAt, drop]);
  useReviewFinish(session.id, finished, total, left, onDone);
  const acceptRemaining = useCallback(() => {
    setKept((k) => new Set([...k, ...list.flatMap((f) => f.hunks.map((h) => keyOf(f, h)))]));
  }, [list, setKept]);

  // Keep the current change in view.
  useEffect(() => {
    diffRef.current?.querySelector(`[data-hunk-i="${hunkAt}"]`)?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [hunkAt]);

  useReviewKeys({
    file,
    fileAt,
    hunkAt,
    setHunkAt,
    yes,
    no,
    goFile,
    acceptRemaining,
    dropAll: () => drop(null, null, left),
    onComment: () => setComment(""),
  });

  const groups = useMemo(() => groupByDir(list), [list]);

  if (files === null && !error) return <ReviewLoading slow={slow} />;

  if (error && list.length === 0) return <ReviewError error={error} onRetry={load} onClose={onDone} />;

  const sendComment = (text: string) => {
    const h = file?.hunks[hunkAt];
    const line = h ? (rows(h).find((r) => r.kind !== "ctx")?.n ?? rows(h)[0]?.n) : null;
    if (file && text.trim())
      sendToSession(session.id, `In ${file.path}${line ? ` near line ${line}` : ""}: ${text.trim()}`);
    setComment(null);
  };

  return (
    <div className="rv" style={{ height: maxHeight }}>
      <FileTree done={done} total={total} groups={groups} kept={kept} fileAt={fileAt} goFile={goFile} />

      <section className="rv-pane">
        {file ? (
          <>
            <div className="rv-dhead">
              <span className={`rv-st ${letter(file)}`}>{letter(file)}</span>
              <span className="p mono" title={file.path}>
                {file.path}
              </span>
              <span className="add-n mono">+{file.added}</span>
              {file.removed > 0 && <span className="del-n mono">-{file.removed}</span>}
              <span className="acts">
                <button
                  type="button"
                  className="rv-btn danger"
                  onClick={() => drop(file.path, null, file.hunks.filter((h) => !kept.has(keyOf(file, h))).length)}
                >
                  Reject file
                </button>
                <button type="button" className="rv-btn" onClick={() => keep(file.hunks.map((h) => keyOf(file, h)))}>
                  Accept file
                </button>
                <span className="rv-seg">
                  {(["unified", "split"] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                      {m === "unified" ? "Unified" : "Split"}
                    </button>
                  ))}
                </span>
              </span>
            </div>
            {error && <p className="ak-err rv-errline">{error}</p>}
            <div className="rv-diff" ref={diffRef}>
              {file.hunks.map((h, hi) => {
                const key = keyOf(file, h);
                return (
                  <HunkView
                    key={h.header}
                    file={file}
                    h={h}
                    hi={hi}
                    ok={kept.has(key)}
                    current={hunkAt === hi}
                    mode={mode}
                    comment={comment}
                    onPick={() => setHunkAt(hi)}
                    onUndo={() =>
                      setKept((k) => {
                        const next = new Set(k);
                        next.delete(key);
                        return next;
                      })
                    }
                    onDrop={() => {
                      setHunkAt(hi);
                      drop(file.path, hi, 1);
                    }}
                    onKeep={() => {
                      const next = new Set(kept).add(key);
                      setKept(next);
                      advance(fileAt, hi + 1, next);
                    }}
                    setComment={setComment}
                    sendComment={sendComment}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <p className="rv-empty">Everything reviewed.</p>
        )}
        <ReviewFoot
          left={left}
          filesLeft={filesLeft}
          finished={finished}
          fileAt={fileAt}
          fileCount={list.length}
          goFile={goFile}
          acceptRemaining={acceptRemaining}
        />
      </section>
    </div>
  );
}
