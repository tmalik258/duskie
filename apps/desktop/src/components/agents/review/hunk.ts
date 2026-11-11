"use client";

// Part of review: Hunk, Row, rows, pairs, split, letter, keyOf, upsertFile.

import type { FileChange } from "@/lib/types";

type Hunk = FileChange["hunks"][number];

type Row = { o: number | null; n: number | null; kind: "add" | "del" | "ctx"; text: string };

/** Lines of a hunk with their old and new line numbers. */
export function rows(h: Hunk): Row[] {
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
export function pairs(rs: Row[]): [Row | null, Row | null][] {
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

export const split = (path: string) => {
  const i = path.lastIndexOf("/");
  return i < 0 ? ["", path] : [path.slice(0, i + 1), path.slice(i + 1)];
};

export const letter = (f: FileChange) => (f.status === "added" ? "A" : f.status === "deleted" ? "D" : "M");

export const keyOf = (f: FileChange, h: Hunk) => `${f.path}:${h.header}`;

export function upsertFile(list: FileChange[], file: FileChange): FileChange[] {
  const i = list.findIndex((f) => f.path === file.path);
  if (i < 0) return [...list, file];
  const next = list.slice();
  next[i] = file;
  return next;
}

/** Files grouped by folder, in list order. */
export function groupByDir(list: FileChange[]) {
  const g: { dir: string; items: { f: FileChange; i: number }[] }[] = [];
  list.forEach((f, i) => {
    const [dir] = split(f.path);
    const last = g[g.length - 1];
    if (last && last.dir === dir) last.items.push({ f, i });
    else g.push({ dir, items: [{ f, i }] });
  });
  return g;
}
