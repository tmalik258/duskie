import { type Dispatch, type SetStateAction, useEffect } from "react";
import { useAgents } from "@/lib/agents";
import { useDuskie } from "@/lib/store";

/** While choosing an agent: 1–9 / arrows pick, [ ] cycle project. */
export function useAgentKeys({
  on,
  list,
  pickedPath,
  ready,
  highlight,
  setHighlight,
  setAgent,
  setPath,
}: {
  on: boolean;
  list: { name: string; path: string }[];
  pickedPath: string;
  ready: [string, string, boolean][];
  highlight: number;
  setHighlight: Dispatch<SetStateAction<number>>;
  setAgent: (id: string) => void;
  setPath: (path: string) => void;
}) {
  useEffect(() => {
    if (!on) return;
    const moveProject = (dir: 1 | -1) => {
      if (list.length === 0) return;
      const i = Math.max(
        0,
        list.findIndex((p) => p.path === pickedPath),
      );
      const next = list[(i + dir + list.length) % list.length];
      setPath(next.path);
      useAgents.setState({ draftPath: next.path });
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        useDuskie.getState().overlayHit ||
        (e.target instanceof Element && e.target.closest("[data-project-picker]"))
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "[" || e.key === "ArrowUp") {
        e.preventDefault();
        moveProject(-1);
        return;
      }
      if (e.key === "]" || e.key === "ArrowDown") {
        e.preventDefault();
        moveProject(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setHighlight((h) => (h + ready.length - 1) % Math.max(ready.length, 1));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % Math.max(ready.length, 1));
        return;
      }
      if (e.key === "Enter") {
        const id = ready[highlight]?.[0];
        if (!id || !pickedPath) return;
        e.preventDefault();
        setAgent(id);
        return;
      }
      const num = Number(e.key);
      if (num >= 1 && num <= ready.length) {
        e.preventDefault();
        if (pickedPath) setAgent(ready[num - 1][0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, ready, pickedPath, highlight, list, setHighlight, setAgent, setPath]);
}
