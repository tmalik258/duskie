"use client";

import type { FileChange } from "@/lib/types";
import { Ic } from "../../icon";
import { keyOf, letter, split } from "./hunk";

/** Files grouped by folder, with progress and the key hints. */
export function FileTree({
  done,
  total,
  groups,
  kept,
  fileAt,
  goFile,
}: {
  done: number;
  total: number;
  groups: { dir: string; items: { f: FileChange; i: number }[] }[];
  kept: Set<string>;
  fileAt: number;
  goFile: (i: number) => void;
}) {
  return (
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
  );
}
