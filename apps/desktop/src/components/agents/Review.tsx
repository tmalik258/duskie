"use client";

// Keep or drop what an agent changed, one change at a time. Files on the
// left, the open file's changes on the right. Keeping is local until Finish;
// dropping undoes the change on disk at once.
// Keys: Y keep, N drop, J K next and back, [ ] files, C comment, Alt 1 / Alt 2 all.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Session, sendToSession } from "@/lib/agents";
import { api, EVENTS, listen } from "@/lib/bridge";
import type { FileChange } from "@/lib/types";
import { Ic } from "../Icon";

type Hunk = FileChange["hunks"][number];
type Row = { o: number | null; n: number | null; kind: "add" | "del" | "ctx"; text: string };

/** Lines of a hunk with their old and new line numbers. */
function rows(h: Hunk): Row[] {
  const m = h.header.match(/-(\d+)(?:,\d+)? \+(\d+)/);
  let old = m ? Number(m[1]) : 1;
  let now = m ? Number(m[2]) : 1;
  const out: Row[] = [];
  for (const l of h.lines) {
    if (l.startsWith("\\")) continue;
    if (l.startsWith("+")) out.push({ o: null, n: now++, kind: "add", text: l.slice(1) });
    else if (l.startsWith("-")) out.push({ o: old++, n: null, kind: "del", text: l.slice(1) });
    else out.push({ o: old++, n: now++, kind: "ctx", text: l.slice(1) });
  }
  return out;
}

/** Side by side: each run of removed lines faces the added lines after it. */
function pairs(rs: Row[]): [Row | null, Row | null][] {
  const out: [Row | null, Row | null][] = [];
  for (let i = 0; i < rs.length; ) {
    if (rs[i].kind === "ctx") {
      out.push([rs[i], rs[i]]);
      i++;
      continue;
    }
    const del: Row[] = [];
    const add: Row[] = [];
    while (i < rs.length && rs[i].kind === "del") del.push(rs[i++]);
    while (i < rs.length && rs[i].kind === "add") add.push(rs[i++]);
    for (let k = 0; k < Math.max(del.length, add.length); k++) out.push([del[k] ?? null, add[k] ?? null]);
  }
  return out;
}

const split = (path: string) => {
  const i = path.lastIndexOf("/");
  return i < 0 ? ["", path] : [path.slice(0, i + 1), path.slice(i + 1)];
};
const letter = (f: FileChange) => (f.status === "added" ? "A" : f.status === "deleted" ? "D" : "M");
const keyOf = (f: FileChange, h: Hunk) => `${f.path}:${h.header}`;

/** Placeholder rows while diffs stream in. */
export function ReviewLoading({ slow }: { slow?: boolean }) {
  return (
    <div className="ak-rv-load" role="status" aria-busy="true" aria-label="Reading changes">
      <div className="ak-rv-head">
        <b>Review changes</b>
        <span className="shimmer-text">{slow ? "Still reading diffs..." : "Reading diffs"}</span>
      </div>
      {[72, 54, 63].map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
        <div key={i} className="ak-rv-file ak-rskel" aria-hidden="true" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="ak-rv-fh">
            <i className="ak-rbar" style={{ width: `${w}%` }} />
          </div>
          <div className="ak-rv-hunk">
            <div className="ak-rv-skel-lines">
              <i className="ak-rbar" style={{ width: "88%" }} />
              <i className="ak-rbar" style={{ width: "64%" }} />
              <i className="ak-rbar" style={{ width: "76%" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function upsertFile(list: FileChange[], file: FileChange): FileChange[] {
  const i = list.findIndex((f) => f.path === file.path);
  if (i < 0) return [...list, file];
  const next = list.slice();
  next[i] = file;
  return next;
}

export function Review({ session, maxHeight, onDone }: { session: Session; maxHeight: number; onDone: () => void }) {
  const [files, setFiles] = useState<FileChange[] | null>(null);
  const [finished, setFinished] = useState(false);
  const [fileAt, setFileAt] = useState(0);
  const [hunkAt, setHunkAt] = useState(0);
  // Kept changes by "path:header"; dropped ones leave the diff, so only their count stays.
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [dropped, setDropped] = useState(0);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [comment, setComment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const loadSeq = useRef(0);
  const diffRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    setFinished(false);
    setError(null);
    setSlow(false);
    return api
      .agentChanges(session.id)
      .then((f) => {
        if (seq !== loadSeq.current) return;
        setFiles(f);
        setFinished(true);
      })
      .catch((e: unknown) => {
        if (seq !== loadSeq.current) return;
        setError(String(e));
        setFiles((prev) => prev ?? []);
        setFinished(true);
      });
  }, [session.id]);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    setFiles(null);
    void (async () => {
      const offFile = await listen(EVENTS.reviewFile, (p) => {
        if (p.session !== session.id || cancelled) return;
        setFiles((prev) => upsertFile(prev ?? [], p.file));
      });
      const offDone = await listen(EVENTS.reviewDone, (p) => {
        if (p.session !== session.id || cancelled) return;
        setFinished(true);
        setFiles((prev) => prev ?? []);
      });
      if (cancelled) {
        offFile();
        offDone();
        return;
      }
      unsubs.push(offFile, offDone);
      void load();
    })();
    return () => {
      cancelled = true;
      loadSeq.current++;
      for (const off of unsubs) off();
    };
  }, [session.id, load]);

  useEffect(() => {
    if (files !== null || error) return;
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, [files, error]);

  // Nothing to review: leave at once.
  useEffect(() => {
    if (finished && files !== null && files.length === 0 && dropped === 0 && !error) onDone();
  }, [finished, files, dropped, error, onDone]);

  const list = files ?? [];
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
    [session.id, load],
  );
  const keep = (keys: string[]) => setKept((k) => new Set([...k, ...keys]));

  /** The next change still waiting, from the current one on, across files. */
  const advance = useCallback(
    (fromFile: number, fromHunk: number, keptNow: Set<string>) => {
      for (let fi = fromFile; fi < list.length; fi++) {
        const hs = list[fi].hunks;
        for (let hi = fi === fromFile ? fromHunk : 0; hi < hs.length; hi++) {
          if (!keptNow.has(keyOf(list[fi], hs[hi]))) {
            setFileAt(fi);
            setHunkAt(hi);
            return;
          }
        }
      }
    },
    [list],
  );

  const yes = useCallback(() => {
    const h = file?.hunks[hunkAt];
    if (!file || !h) return;
    const next = new Set(kept).add(keyOf(file, h));
    setKept(next);
    advance(fileAt, hunkAt + 1, next);
  }, [file, hunkAt, kept, fileAt, advance]);
  const no = useCallback(() => {
    if (!file || !file.hunks[hunkAt]) return;
    drop(file.path, hunkAt, 1);
  }, [file, hunkAt, drop]);
  const finish = useCallback(() => onDone(), [onDone]);
  const acceptRemaining = useCallback(() => {
    setKept((k) => new Set([...k, ...list.flatMap((f) => f.hunks.map((h) => keyOf(f, h)))]));
  }, [list]);
  const goFile = useCallback(
    (i: number) => {
      if (i < 0 || i >= list.length) return;
      setFileAt(i);
      const first = list[i].hunks.findIndex((h) => !kept.has(keyOf(list[i], h)));
      setHunkAt(Math.max(0, first));
    },
    [list, kept],
  );

  // Keep the current change in view.
  useEffect(() => {
    diffRef.current?.querySelector(`[data-hunk-i="${hunkAt}"]`)?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [hunkAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.altKey && !e.ctrlKey && (e.key === "1" || e.key === "2")) {
        e.preventDefault();
        if (e.key === "1") acceptRemaining();
        else drop(null, null, left);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || !file) return;
      const k = e.key.toLowerCase();
      const n = file.hunks.length;
      const act: Record<string, () => void> = {
        y: yes,
        n: no,
        u: no,
        j: () => (hunkAt + 1 < n ? setHunkAt(hunkAt + 1) : goFile(fileAt + 1)),
        arrowdown: () => (hunkAt + 1 < n ? setHunkAt(hunkAt + 1) : goFile(fileAt + 1)),
        k: () => (hunkAt > 0 ? setHunkAt(hunkAt - 1) : goFile(fileAt - 1)),
        arrowup: () => (hunkAt > 0 ? setHunkAt(hunkAt - 1) : goFile(fileAt - 1)),
        "]": () => goFile(fileAt + 1),
        "[": () => goFile(fileAt - 1),
        c: () => setComment(""),
      };
      const f = act[k];
      if (!f) return;
      e.preventDefault();
      f();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, fileAt, hunkAt, yes, no, goFile, acceptRemaining, drop, left]);

  const groups = useMemo(() => {
    const g: { dir: string; items: { f: FileChange; i: number }[] }[] = [];
    list.forEach((f, i) => {
      const [dir] = split(f.path);
      const last = g[g.length - 1];
      if (last && last.dir === dir) last.items.push({ f, i });
      else g.push({ dir, items: [{ f, i }] });
    });
    return g;
  }, [list]);

  if (files === null && !error) return <ReviewLoading slow={slow} />;

  if (error && list.length === 0) {
    return (
      <div className="ak-tl ak-in">
        <div className="ak-rv-head">
          <b>Review changes</b>
        </div>
        <p className="ak-err">{error}</p>
        <div className="ak-chips">
          <button type="button" onClick={load} className="ak-chip primary chip">
            Retry
          </button>
          <button type="button" onClick={onDone} className="ak-chip chip">
            Close
          </button>
        </div>
      </div>
    );
  }

  const sendComment = (text: string) => {
    const h = file?.hunks[hunkAt];
    const line = h ? (rows(h).find((r) => r.kind !== "ctx")?.n ?? rows(h)[0]?.n) : null;
    if (file && text.trim())
      sendToSession(session.id, `In ${file.path}${line ? ` near line ${line}` : ""}: ${text.trim()}`);
    setComment(null);
  };

  return (
    <div className="rv" style={{ height: maxHeight }}>
      <aside className="rv-tree">
        <div className="rv-side-h">
          <b>
            {done} of {total}
          </b>
          <span>changes reviewed</span>
        </div>
        <div className="rv-prog" aria-hidden>
          <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="rv-tree-l">
          {groups.map((g) => (
            <div key={g.dir || "./"}>
              <div className="rv-dir mono">
                <Ic name="folder" size={12} /> {g.dir || "./"}
              </div>
              {g.items.map(({ f, i }) => {
                const k = f.hunks.filter((h) => kept.has(keyOf(f, h))).length;
                const st = f.hunks.length === 0 || k === f.hunks.length ? "ok" : k > 0 ? "part" : "";
                return (
                  <button
                    type="button"
                    key={f.path}
                    className="rv-tf"
                    aria-current={i === fileAt}
                    onClick={() => goFile(i)}
                  >
                    <span className={`rv-st ${letter(f)}`}>{letter(f)}</span>
                    <span className="p">{split(f.path)[1]}</span>
                    <span className="add-n mono">+{f.added}</span>
                    <span className={`rvs ${st}`}>{st === "ok" && <Ic name="check" size={10} />}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="rv-keys">
          <span>
            <kbd>Y</kbd> yes, keep
          </span>
          <span>
            <kbd>N</kbd> no, drop
          </span>
          <span>
            <kbd>J</kbd>
            <kbd>K</kbd> next, back
          </span>
          <span>
            <kbd>]</kbd> next file
          </span>
          <span>
            <kbd>C</kbd> comment
          </span>
        </div>
      </aside>

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
                const ok = kept.has(keyOf(file, h));
                const rs = rows(h);
                return (
                  <div key={h.header} className={`rv-hunk${ok ? " ok" : ""}`} data-hunk-i={hi}>
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: J and K move between changes */}
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: a click picks the change */}
                    <div className={`rv-hunk-h${hunkAt === hi ? " cur" : ""}`} onClick={() => setHunkAt(hi)}>
                      <span className="n">
                        Change {hi + 1} of {file.hunks.length}
                      </span>
                      <span className="mono hd">{h.header.match(/@@[^@]*@@/)?.[0] ?? h.header}</span>
                      <span className="acts">
                        {ok ? (
                          <>
                            <span className="rv-ok">
                              <Ic name="check" size={12} /> Kept
                            </span>
                            <button
                              type="button"
                              className="rv-btn ghost"
                              onClick={() =>
                                setKept((k) => {
                                  const next = new Set(k);
                                  next.delete(keyOf(file, h));
                                  return next;
                                })
                              }
                            >
                              Undo
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="rv-ico danger"
                              aria-label="Drop this change, N"
                              title="Drop (N)"
                              onClick={() => {
                                setHunkAt(hi);
                                drop(file.path, hi, 1);
                              }}
                            >
                              <Ic name="x" size={12} />
                            </button>
                            <button
                              type="button"
                              className="rv-yes"
                              aria-label="Keep this change, Y"
                              title="Keep (Y)"
                              onClick={() => {
                                const next = new Set(kept).add(keyOf(file, h));
                                setKept(next);
                                advance(fileAt, hi + 1, next);
                              }}
                            >
                              <Ic name="check" size={12} />
                              <kbd>Y</kbd>
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    <div className={`rv-body mono${mode === "split" ? " split" : ""}`}>
                      {mode === "unified"
                        ? rs.slice(0, 400).map((r, ri) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: lines of one hunk
                            <div key={ri} className={`dl ${r.kind}`}>
                              <span className="ln">{r.o ?? ""}</span>
                              <span className="ln">{r.n ?? ""}</span>
                              <span className="sg">{r.kind === "add" ? "+" : r.kind === "del" ? "-" : ""}</span>
                              <span className="c">{r.text || " "}</span>
                            </div>
                          ))
                        : pairs(rs)
                            .slice(0, 400)
                            .map(([a, b], ri) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: lines of one hunk
                              <div key={ri} className="dl2">
                                <span className="ln">{a?.o ?? ""}</span>
                                <span className={`c ${a?.kind === "del" ? "del" : a ? "" : "nil"}`}>
                                  {a?.text || " "}
                                </span>
                                <span className="ln">{b?.n ?? ""}</span>
                                <span className={`c ${b?.kind === "add" ? "add" : b ? "" : "nil"}`}>
                                  {b?.text || " "}
                                </span>
                              </div>
                            ))}
                    </div>
                    {comment !== null && hunkAt === hi && (
                      <form
                        className="rv-comment"
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendComment(comment);
                        }}
                      >
                        <input
                          // biome-ignore lint/a11y/noAutofocus: opened by the C key for typing right away
                          autoFocus
                          value={comment}
                          placeholder="Tell the agent what to change here"
                          onChange={(e) => setComment(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setComment(null);
                            }
                          }}
                        />
                        <button type="submit" className="rv-btn">
                          Send
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="rv-empty">Everything reviewed.</p>
        )}
        <div className="rv-foot">
          <span className="sum">
            {left > 0
              ? `${left} ${left === 1 ? "change" : "changes"} left in ${filesLeft} ${filesLeft === 1 ? "file" : "files"}`
              : "Everything reviewed"}
            {!finished && <span className="shimmer-text"> · loading</span>}
          </span>
          <button
            type="button"
            className="rv-ico"
            aria-label="Previous file"
            title="Previous file ([)"
            disabled={fileAt === 0}
            onClick={() => goFile(fileAt - 1)}
          >
            <span className="flip">
              <Ic name="chevr" size={13} />
            </span>
          </button>
          <button
            type="button"
            className="rv-ico"
            aria-label="Next file"
            title="Next file (])"
            disabled={fileAt >= list.length - 1}
            onClick={() => goFile(fileAt + 1)}
          >
            <Ic name="chevr" size={13} />
          </button>
          <button type="button" className="rv-btn" disabled={left === 0} onClick={acceptRemaining}>
            Accept all remaining
          </button>
          <button type="button" className="rv-btn primary" disabled={left > 0} onClick={finish}>
            Finish review
          </button>
        </div>
      </section>
    </div>
  );
}
