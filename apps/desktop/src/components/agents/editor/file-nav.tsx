"use client";

import type { TreeEntry } from "@/lib/types";
import { Ic } from "../../icon";
import type { Tab } from "./tab";

/** The project tree on the left. */
export function FileNav({
  tree,
  active,
  onOpen,
}: {
  tree: TreeEntry[];
  active: string | null;
  onOpen: (path: string) => void;
}) {
  return (
    <nav className="ed-tree" aria-label="Files">
      <span className="ed-head">Files</span>
      {tree.map((e) => (
        <button
          key={e.path}
          type="button"
          className="ed-node"
          data-dir={e.dir}
          data-active={e.path === active}
          style={{ paddingLeft: 8 + (e.path.split("/").length - 1) * 12 }}
          disabled={e.dir}
          onClick={() => onOpen(e.path)}
        >
          <Ic name={e.dir ? "folder" : "file"} size={12} />
          <span className="truncate">{e.path.split("/").pop()}</span>
        </button>
      ))}
    </nav>
  );
}

/** Open files, with an unsaved dot and a close button each. */
export function EditorTabs({
  tabs,
  active,
  onPick,
  onClose,
}: {
  tabs: Tab[];
  active: string | null;
  onPick: (path: string) => void;
  onClose: (path: string) => void;
}) {
  return (
    <nav className="ed-tabs" aria-label="Open files">
      {tabs.map((t) => (
        <span key={t.path} className="ed-tab" data-active={t.path === active}>
          <button type="button" aria-current={t.path === active ? "page" : undefined} onClick={() => onPick(t.path)}>
            <Ic name="file" size={11} />
            {t.path.split("/").pop()}
            {t.dirty && <span className="ed-dot" role="img" aria-label="unsaved" />}
          </button>
          <button type="button" aria-label={`Close ${t.path}`} onClick={() => onClose(t.path)}>
            <Ic name="x" size={10} />
          </button>
        </span>
      ))}
    </nav>
  );
}
