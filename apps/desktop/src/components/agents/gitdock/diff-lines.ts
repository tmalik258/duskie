// Turns one diff hunk into lines that carry the number each has in its file.

import type { FileChange } from "@/lib/types";

export type Hunk = FileChange["hunks"][number];

export interface DiffLine {
  n: number;
  kind: "add" | "del" | "ctx";
  /** The line without its leading +, - or space. */
  text: string;
}

export function numberLines(h: Hunk): DiffLine[] {
  const m = h.header.match(/-(\d+)(?:,\d+)? \+(\d+)/);
  let old = m ? Number(m[1]) : 1;
  let now = m ? Number(m[2]) : 1;
  const out: DiffLine[] = [];
  for (const l of h.lines) {
    if (l.startsWith("\\")) continue;
    if (l.startsWith("+")) {
      out.push({ n: now, kind: "add", text: l.slice(1) });
      now += 1;
    } else if (l.startsWith("-")) {
      out.push({ n: old, kind: "del", text: l.slice(1) });
      old += 1;
    } else {
      out.push({ n: now, kind: "ctx", text: l.slice(1) });
      old += 1;
      now += 1;
    }
  }
  return out;
}
