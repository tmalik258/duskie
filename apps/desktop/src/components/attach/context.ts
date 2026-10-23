// Context added to a message as chips: project files and folders picked
// with @, and uploads. The box shows only names; full paths go out with
// the message.

export interface ContextItem {
  /** What the chip shows: the file or folder name. */
  name: string;
  /** Project-relative for @ picks, absolute for uploads. */
  path: string;
  folder: boolean;
  /** A thumbnail for images. */
  url?: string | null;
}

/** "src/components/agents/" -> { name: "agents", folder: true }. */
export function fromPick(path: string): ContextItem {
  const folder = path.endsWith("/");
  const parts = path.replace(/\/+$/, "").split(/[\\/]/);
  const last = parts[parts.length - 1] || path;
  // Uploads are saved as "<id>-name"; show just the name.
  const name = /duskie-attachments/.test(path) ? last.replace(/^[0-9A-Z]+-/, "") : last;
  return { name, path, folder };
}

/** The last three folders above an item, for its hover tip. */
export function parents(path: string): string {
  const parts = path
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .slice(0, -1)
    .filter(Boolean);
  const shown = parts.slice(-3).join("/");
  return parts.length > 3 ? `…/${shown}` : shown || "Project root";
}

const refOf = (path: string) => (/\s/.test(path) ? `@"${path}"` : `@${path}`);

/** The message as sent: what was typed, then a reference per chip. */
export function withRefs(text: string, items: ContextItem[]): string {
  const t = text.trim();
  if (!items.length) return t;
  return `${t}${t ? "\n\n" : ""}${items.map((i) => refOf(i.path)).join(" ")}`;
}

/** Text with a trailing "@query" removed, once its pick became a chip. */
export const dropMention = (text: string) => text.replace(/(^|\s)@[^\s@]*$/, "$1");
