"use client";

// Files matching what follows an @ at the end of the text.

import { useEffect, useState } from "react";

export function useMentionFiles(text: string, list: ((query: string) => Promise<string[]>) | null, key: string) {
  const [files, setFiles] = useState<string[]>([]);
  const mention = /(^|\s)@([^\s@]*)$/.exec(text);
  const query = mention?.[2] ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the source; `list` is a fresh closure each render
  useEffect(() => {
    if (query === null || !list) {
      setFiles([]);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      void list(query)
        .then((f) => live && setFiles(f))
        .catch(() => undefined);
    }, 80);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [query, key]);
  /** Text with the trailing @query swapped for the picked file. */
  const pick = (f: string) => (mention ? `${text.slice(0, text.length - mention[2].length - 1)}@${f} ` : text);
  return { files: query === null ? [] : files, mention, query, pick };
}
