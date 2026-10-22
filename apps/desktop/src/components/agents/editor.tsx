"use client";

// The full editor in the dock: project tree, tabs, Monaco with change
// markers against HEAD, quick open (Ctrl P) and project search. Saves are
// refused when the file changed on disk since it was opened, and a file an
// agent rewrote asks before reloading.

import type * as MonacoNs from "monaco-editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { lineMarks } from "@/lib/linediff";
import { languageOf } from "@/lib/monaco";
import type { TreeEntry } from "@/lib/types";
import { EditorBar } from "./editor/editor-bar";
import { ProjectSearch, QuickOpen } from "./editor/editor-pops";
import { EditorTabs, FileNav } from "./editor/file-nav";
import { changeDecorations } from "./editor/setup";
import { StaleNote } from "./editor/stale-note";
import type { Tab } from "./editor/tab";
import { useDiskWatch } from "./editor/use-disk-watch";
import { useEditorKeys } from "./editor/use-editor-keys";
import { useMonaco } from "./editor/use-monaco";
import { useSearchHits } from "./editor/use-search-hits";
import { Terminal } from "./terminal";

export function Editor({
  root,
  initial,
  onClose,
}: {
  root: string;
  initial?: { path: string; line?: number; atChange?: boolean } | null;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const monaco = useRef<typeof MonacoNs | null>(null);
  const editor = useRef<MonacoNs.editor.IStandaloneCodeEditor | null>(null);
  const models = useRef(new Map<string, MonacoNs.editor.ITextModel>());
  const ready = useMonaco({ host, monaco, editor, models }, setError);
  const decos = useRef<MonacoNs.editor.IEditorDecorationsCollection | null>(null);
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const [find, setFind] = useState<string | null>(null);
  const [term, setTerm] = useState(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  useEffect(() => {
    api
      .editorTree(root)
      .then(setTree)
      .catch((e) => setError(String(e)));
  }, [root]);

  const mark = useCallback(() => {
    const ed = editor.current;
    const m = monaco.current;
    const tab = tabsRef.current.find((t) => t.path === active);
    if (!ed || !m || !tab) return;
    const all = changeDecorations(m, tab.head, ed.getValue());
    if (decos.current) decos.current.set(all);
    else decos.current = ed.createDecorationsCollection(all);
  }, [active]);

  const open = useCallback(
    async (path: string, line?: number, atChange = false) => {
      const m = monaco.current;
      const ed = editor.current;
      if (!m || !ed) return;
      setError("");
      try {
        if (!models.current.has(path)) {
          const [file, head] = await Promise.all([
            api.editorRead(root, path),
            api.editorHead(root, path).catch(() => ""),
          ]);
          const model = m.editor.createModel(file.text, languageOf(path));
          model.onDidChangeContent(() =>
            setTabs((ts) => ts.map((t) => (t.path === path && !t.dirty ? { ...t, dirty: true } : t))),
          );
          models.current.set(path, model);
          setTabs((ts) => [...ts, { path, stamp: file.stamp, head, dirty: false, stale: false }]);
        }
        const model = models.current.get(path);
        if (model) ed.setModel(model);
        setActive(path);
        if (!line && atChange && model) {
          const head =
            tabsRef.current.find((t) => t.path === path)?.head ?? (await api.editorHead(root, path).catch(() => ""));
          const m2 = lineMarks(head, model.getValue());
          line = [...m2.changed, ...m2.added, ...m2.removed.map((l) => Math.max(1, l))].sort((a, b) => a - b)[0];
        }
        if (line) {
          ed.revealLineInCenter(line);
          ed.setPosition({ lineNumber: line, column: 1 });
        }
        ed.focus();
      } catch (e) {
        setError(String(e));
      }
    },
    [root],
  );

  useEffect(() => {
    if (ready && initial?.path) void open(initial.path, initial.line, initial.atChange);
  }, [ready, initial, open]);

  useEffect(() => {
    const ed = editor.current;
    if (!ed) return;
    mark();
    const sub = ed.onDidChangeModelContent(mark);
    return () => sub.dispose();
  }, [mark]);

  const close = useCallback((path: string) => {
    models.current.get(path)?.dispose();
    models.current.delete(path);
    setTabs((ts) => {
      const left = ts.filter((t) => t.path !== path);
      setActive((a) => (a === path ? (left[left.length - 1]?.path ?? null) : a));
      return left;
    });
  }, []);

  useEffect(() => {
    if (active && editor.current) {
      const model = models.current.get(active);
      if (model && editor.current.getModel() !== model) editor.current.setModel(model);
    }
  }, [active]);

  const save = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.path === active);
    const model = active ? models.current.get(active) : null;
    if (!tab || !model) return;
    try {
      const stamp = await api.editorWrite(root, tab.path, model.getValue(), tab.stamp);
      setTabs((ts) => ts.map((t) => (t.path === tab.path ? { ...t, stamp, dirty: false, stale: false } : t)));
    } catch (e) {
      setError(String(e));
      setTabs((ts) => ts.map((t) => (t.path === tab.path ? { ...t, stale: true } : t)));
    }
  }, [active, root]);

  const reload = useDiskWatch(root, tabsRef, setTabs, models);

  useEditorKeys({ save, onClose, quick, find, setQuick, setFind, setTerm });
  const hits = useSearchHits(root, find);

  const current = tabs.find((t) => t.path === active);

  return (
    <section className="ed flex min-h-0 flex-1 flex-col" aria-label="Editor">
      <EditorBar
        root={root}
        term={term}
        onQuick={() => setQuick("")}
        onFind={() => setFind("")}
        onTerm={() => setTerm((t) => !t)}
        onClose={onClose}
      />
      <div className="ed-main min-h-0 flex-1">
        <FileNav tree={tree} active={active} onOpen={(p) => void open(p)} />
        <div className="ed-pane flex min-w-0 flex-1 flex-col">
          <EditorTabs tabs={tabs} active={active} onPick={setActive} onClose={close} />
          {current?.stale && (
            <StaleNote
              onTheirs={() => void reload(current.path)}
              onMine={() =>
                void api
                  .editorRead(root, current.path)
                  .then((f) =>
                    setTabs((ts) =>
                      ts.map((t) => (t.path === current.path ? { ...t, stamp: f.stamp, stale: false } : t)),
                    ),
                  )
              }
            />
          )}
          {error && (
            <p className="ed-note" role="alert">
              {error}
            </p>
          )}
          {!ready && <p className="gd-empty shimmer-text">Opening the editor</p>}
          {ready && !active && <p className="gd-empty">Pick a file, or press Ctrl P.</p>}
          <div ref={host} className="ed-host min-h-0 flex-1" hidden={!active} />
          {term && <Terminal root={root} />}
        </div>
      </div>
      {quick !== null && <QuickOpen quick={quick} tree={tree} setQuick={setQuick} onOpen={(p) => void open(p)} />}
      {find !== null && <ProjectSearch find={find} hits={hits} setFind={setFind} onOpen={(p, l) => void open(p, l)} />}
    </section>
  );
}
