import { useEffect } from "react";
import type { FileChange } from "@/lib/types";

/** Y keep, N drop, J K next and back, [ ] files, C comment, Alt 1 / Alt 2 all. */
export function useReviewKeys({
  file,
  fileAt,
  hunkAt,
  setHunkAt,
  yes,
  no,
  goFile,
  acceptRemaining,
  dropAll,
  onComment,
}: {
  file: FileChange | undefined;
  fileAt: number;
  hunkAt: number;
  setHunkAt: (i: number) => void;
  yes: () => void;
  no: () => void;
  goFile: (i: number) => void;
  acceptRemaining: () => void;
  dropAll: () => void;
  onComment: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.altKey && !e.ctrlKey && (e.key === "1" || e.key === "2")) {
        e.preventDefault();
        if (e.key === "1") acceptRemaining();
        else dropAll();
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
        c: onComment,
      };
      const f = act[k];
      if (!f) return;
      e.preventDefault();
      f();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, fileAt, hunkAt, setHunkAt, yes, no, goFile, acceptRemaining, dropAll, onComment]);
}
