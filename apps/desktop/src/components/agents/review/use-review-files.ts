import { useCallback, useEffect, useRef, useState } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";
import type { FileChange } from "@/lib/types";
import { upsertFile } from "./hunk";

/** The session's changed files, streamed in, with a reload after each drop. */
export function useReviewFiles(sessionId: string) {
  const [files, setFiles] = useState<FileChange[] | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    setFinished(false);
    setError(null);
    setSlow(false);
    return api
      .agentChanges(sessionId)
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
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    setFiles(null);
    void (async () => {
      const offFile = await listen(EVENTS.reviewFile, (p) => {
        if (p.session !== sessionId || cancelled) return;
        setFiles((prev) => upsertFile(prev ?? [], p.file));
      });
      const offDone = await listen(EVENTS.reviewDone, (p) => {
        if (p.session !== sessionId || cancelled) return;
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
  }, [sessionId, load]);

  useEffect(() => {
    if (files !== null || error) return;
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, [files, error]);
  return { files, finished, error, setError, slow, load };
}
