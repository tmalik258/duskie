import type * as MonacoNs from "monaco-editor";
import { type MutableRefObject, type RefObject, useEffect, useState } from "react";
import { loadMonaco } from "@/lib/monaco";
import { createEditor } from "./setup";

/** Monaco, loaded on first open; disposes the editor and its models on unmount. */
export function useMonaco(
  {
    host,
    monaco,
    editor,
    models,
  }: {
    host: RefObject<HTMLDivElement | null>;
    monaco: MutableRefObject<typeof MonacoNs | null>;
    editor: MutableRefObject<MonacoNs.editor.IStandaloneCodeEditor | null>;
    models: MutableRefObject<Map<string, MonacoNs.editor.ITextModel>>;
  },
  onError: (e: string) => void,
) {
  const [ready, setReady] = useState(false);
  // Monaco loads on first open only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable; load once on mount
  useEffect(() => {
    let gone = false;
    loadMonaco()
      .then((m) => {
        if (gone || !host.current) return;
        monaco.current = m;
        editor.current = createEditor(m, host.current);
        setReady(true);
      })
      .catch((e) => onError(String(e)));
    const owned = models.current;
    return () => {
      gone = true;
      editor.current?.dispose();
      for (const model of owned.values()) model.dispose();
      owned.clear();
    };
  }, []);
  return ready;
}
