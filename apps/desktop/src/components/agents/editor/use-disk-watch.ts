import type * as MonacoNs from "monaco-editor";
import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback, useEffect } from "react";
import { api } from "@/lib/bridge";
import type { Tab } from "./tab";

const POLL_MS = 2000;

/** Reload clean tabs changed on disk; mark dirty ones stale. Returns reload. */
export function useDiskWatch(
  root: string,
  tabsRef: MutableRefObject<Tab[]>,
  setTabs: Dispatch<SetStateAction<Tab[]>>,
  models: MutableRefObject<Map<string, MonacoNs.editor.ITextModel>>,
) {
  const reload = useCallback(
    async (path: string) => {
      const file = await api.editorRead(root, path);
      models.current.get(path)?.setValue(file.text);
      setTabs((ts) => ts.map((t) => (t.path === path ? { ...t, stamp: file.stamp, dirty: false, stale: false } : t)));
    },
    [root, setTabs, models],
  );

  // Notice files changed on disk by an agent or another app.
  useEffect(() => {
    const id = window.setInterval(() => {
      for (const t of tabsRef.current) {
        if (t.stale) continue;
        api
          .editorChanged(root, t.path, t.stamp)
          .then((changed) => {
            if (!changed) return;
            if (t.dirty) setTabs((ts) => ts.map((x) => (x.path === t.path ? { ...x, stale: true } : x)));
            else void reload(t.path);
          })
          .catch(() => {});
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [root, reload, tabsRef, setTabs]);
  return reload;
}
