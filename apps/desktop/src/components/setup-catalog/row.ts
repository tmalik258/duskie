// One static setup row, painted before setup_status returns.

import type { SetupGroup } from "@/lib/types";

export interface CatalogRow {
  id: string;
  group: SetupGroup;
  title: string;
  why: string;
  recommended: boolean;
}
