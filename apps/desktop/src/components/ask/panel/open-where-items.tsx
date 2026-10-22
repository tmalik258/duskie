// Rows for a file with no default app: open it in the editor, show it in
// its folder, pick an app, or go back.

import { Ic } from "../../Icon";
import type { OpenHow } from "./file-open";
import type { Item } from "./item";

export function openWhereItems(
  where: { name: string; path: string },
  editorName: string | null,
  openFile: (path: string, how: OpenHow) => void,
  back: () => void,
): Item[] {
  const { name, path } = where;
  const group = `Open ${name}`;
  const items: Item[] = [];
  if (editorName) {
    items.push({
      id: "open-editor",
      group,
      icon: <Ic name="file" size={12} />,
      label: `Open in ${editorName}`,
      hint: "No default app",
      run: () => openFile(path, "editor"),
      stay: true,
      keepText: true,
    });
  }
  items.push(
    {
      id: "open-reveal",
      group: editorName ? undefined : group,
      icon: <Ic name="folder" size={12} />,
      label: "Show in folder",
      hint: editorName ? undefined : "No default app",
      run: () => openFile(path, "reveal"),
      stay: true,
      keepText: true,
    },
    {
      id: "open-default",
      icon: <Ic name="file" size={12} />,
      label: "Open with…",
      hint: "Windows",
      run: () => openFile(path, "default"),
      stay: true,
      keepText: true,
    },
    {
      id: "open-back",
      icon: <span className="text-[11px]">←</span>,
      label: "Back",
      run: back,
      stay: true,
      keepText: true,
    },
  );
  return items;
}
