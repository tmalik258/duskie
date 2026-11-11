export interface Tab {
  path: string;
  stamp: string;
  head: string;
  dirty: boolean;
  /** An agent or another app changed the file on disk. */
  stale: boolean;
}
