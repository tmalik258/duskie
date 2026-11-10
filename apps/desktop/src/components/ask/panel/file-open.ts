// Opening a file or a search hit from Ask.

import { api } from "@/lib/bridge";
import { runOpen, showDone } from "@/lib/store";

export type OpenHow = "editor" | "reveal" | "default";
export type OpenWhere = { name: string; path: string } | null;

/** Opens a file; with no `how` and no default app, asks where to open it. */
export function openFile(
  path: string,
  how: OpenHow | undefined,
  setOpenWhere: (w: OpenWhere) => void,
  onProbe: { noApp: () => void; failed: (e: string) => void },
) {
  const name = path.split(/[\\/]/).pop() ?? path;
  // No how yet: probe without Closing Ask so the "Open with" picker can show.
  if (!how) {
    void api.fileOpen(path).then(
      (r) => {
        if (!r.opened) {
          onProbe.noApp();
          setOpenWhere({ name, path });
          return;
        }
        setOpenWhere(null);
        void api.askClose();
        showDone(`Opened ${name}`);
      },
      (e: unknown) => onProbe.failed(String(e)),
    );
    return;
  }
  setOpenWhere(null);
  void runOpen(async () => {
    const r = await api.fileOpen(path, how);
    return r.opened;
  }, `Opened ${name}`);
}

export function openHit(source: string, reference: string, title?: string) {
  const label =
    title?.trim() ||
    (source === "page" ? reference.replace(/^https?:\/\//, "").split("/")[0] : undefined) ||
    reference.split(/[\\/]/).pop() ||
    reference;
  void runOpen(async () => {
    await api.openReference(source, reference);
    return true;
  }, `Opened ${label}`);
}
