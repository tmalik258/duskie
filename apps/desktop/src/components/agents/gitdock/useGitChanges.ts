"use client";

// The Changes pane's data: the changed files, and one `act` that runs a git
// action while showing busy and its result, then tells the dock to reload.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { fetchGitCached, gitCacheKey, invalidateGitPath, peekGitCache } from "@/lib/git-cache";
import type { GitFile } from "@/lib/types";

export function useGitChanges(path: string, rev: number, onChanged: () => void, onCount: (n: number) => void) {
  const key = gitCacheKey("status", path);
  const [files, setFiles] = useState<GitFile[]>(() => peekGitCache<GitFile[]>(key) ?? []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void fetchGitCached(key, () => api.gitStatus(path))
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [key, path]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rev means something changed, so read the status again
  useEffect(() => {
    const hit = peekGitCache<GitFile[]>(key);
    if (hit) setFiles(hit);
    refresh();
  }, [refresh, rev, key]);

  useEffect(() => onCount(files.length), [files, onCount]);

  const act = useCallback(
    async (work: () => Promise<string>) => {
      setBusy(true);
      setNote(null);
      try {
        setNote(await work());
      } catch (e) {
        setNote(String(e));
      } finally {
        setBusy(false);
        invalidateGitPath(path);
        onChanged();
      }
    },
    [onChanged, path],
  );

  return { files, busy, note, act };
}
