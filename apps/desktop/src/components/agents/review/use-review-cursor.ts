import { useCallback, useState } from "react";
import type { FileChange } from "@/lib/types";
import { keyOf } from "./hunk";

/** Which file and change are open, and moving between them. */
export function useReviewCursor(list: FileChange[], kept: Set<string>) {
  const [fileAt, setFileAt] = useState(0);
  const [hunkAt, setHunkAt] = useState(0);
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
  const goFile = useCallback(
    (i: number) => {
      if (i < 0 || i >= list.length) return;
      setFileAt(i);
      const first = list[i].hunks.findIndex((h) => !kept.has(keyOf(list[i], h)));
      setHunkAt(Math.max(0, first));
    },
    [list, kept],
  );
  return { fileAt, hunkAt, setHunkAt, advance, goFile };
}
