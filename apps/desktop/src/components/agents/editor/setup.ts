import type * as MonacoNs from "monaco-editor";
import { lineMarks } from "@/lib/linediff";
import { DUSKIE_THEME } from "@/lib/monaco";

/** The dock editor: Duskie theme, no minimap, calmer motion when asked. */
export function createEditor(m: typeof MonacoNs, host: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  m.editor.defineTheme("duskie", DUSKIE_THEME);
  return m.editor.create(host, {
    theme: "duskie",
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: '"JetBrains Mono", "Cascadia Code", ui-monospace, Consolas, monospace',
    fontLigatures: true,
    lineHeight: 21,
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: "line",
    lineNumbersMinChars: 3,
    glyphMargin: false,
    folding: false,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    guides: { indentation: true },
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
    cursorBlinking: reduced ? "solid" : "smooth",
    smoothScrolling: !reduced,
    cursorSmoothCaretAnimation: reduced ? "off" : "on",
    scrollBeyondLastLine: false,
  });
}

/** Gutter marks for lines added, changed or removed against HEAD. */
export function changeDecorations(m: typeof MonacoNs, head: string, text: string) {
  const marks = lineMarks(head, text);
  const range = (line: number) => new m.Range(line, 1, line, 1);
  return [
    ...marks.added.map((l) => ({
      range: range(l),
      options: { isWholeLine: true, linesDecorationsClassName: "ed-add" },
    })),
    ...marks.changed.map((l) => ({
      range: range(l),
      options: { isWholeLine: true, linesDecorationsClassName: "ed-chg" },
    })),
    ...marks.removed.map((l) => ({ range: range(Math.max(1, l)), options: { linesDecorationsClassName: "ed-del" } })),
  ];
}
