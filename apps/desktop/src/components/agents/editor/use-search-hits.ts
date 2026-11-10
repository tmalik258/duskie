import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import type { EditorHit } from "@/lib/types";

/** Project search, run 200 ms after typing stops. */
export function useSearchHits(root: string, find: string | null) {
  const [hits, setHits] = useState<EditorHit[]>([]);
  useEffect(() => {
    if (!find) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(
      () =>
        void api
          .editorSearch(root, find)
          .then(setHits)
          .catch(() => setHits([])),
      200,
    );
    return () => window.clearTimeout(t);
  }, [find, root]);
  return hits;
}
