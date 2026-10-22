// Static setup rows so the checklist paints before setup_status returns.
// Titles mirror apps/desktop/src-tauri/src/setup.rs.

import type { SetupItem } from "@/lib/types";
import { AI_ROWS } from "./setup-catalog/ai";
import { CONNECT_ROWS } from "./setup-catalog/connect";
import type { CatalogRow } from "./setup-catalog/row";
import { TOOL_ROWS } from "./setup-catalog/tools";

export const SETUP_CATALOG: CatalogRow[] = [...AI_ROWS, ...CONNECT_ROWS, ...TOOL_ROWS];

export function skeletonItem(entry: CatalogRow): SetupItem {
  return {
    id: entry.id,
    group: entry.group,
    title: entry.title,
    why: entry.why,
    done: false,
    status: "",
    command: null,
    runnable: false,
    action: "Install",
    opensApp: false,
    opensTerminal: false,
    tab: null,
    recommended: entry.recommended,
  };
}
