// Part of markdown: ListItem, Block, FENCE, HEADING, ITEM, QUOTE, TABLE_ROW, TABLE_RULE, cells, splitBlocks, linkTarget, INLINE.

interface ListItem {
  text: string;
  sub: string[];
}

export type Block =
  | { kind: "code"; lang: string; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { kind: "quote"; text: string }
  | { kind: "table"; head: string[] | null; rows: string[][] }
  | { kind: "text"; text: string };

const FENCE = /^\s*```(\S*)/;

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/;

const ITEM = /^(\s*)([-*•+]|\d{1,3}[.)])\s+(.*)$/;

const QUOTE = /^\s*>\s?(.*)$/;

const TABLE_ROW = /^\s*\|.*\|\s*$/;

const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function splitBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.join("").trim()) blocks.push({ kind: "text", text: para.join("\n") });
    para = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(FENCE);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (may be missing while streaming)
      blocks.push({ kind: "code", lang: fence[1] ?? "", text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    const item = line.match(ITEM);
    if (item) {
      flush();
      const ordered = /\d/.test(item[2]);
      const list: Block & { kind: "list" } = {
        kind: "list",
        ordered,
        start: ordered ? Number.parseInt(item[2], 10) : 1,
        items: [],
      };
      const baseIndent = item[1].length;
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(ITEM);
        if (m && m[1].length <= baseIndent + 1 && /\d/.test(m[2]) === ordered) {
          list.items.push({ text: m[3], sub: [] });
        } else if (m && m[1].length > baseIndent + 1 && list.items.length > 0) {
          list.items[list.items.length - 1].sub.push(m[3]);
        } else if (l.trim() && /^\s{2,}\S/.test(l) && list.items.length > 0) {
          // A wrapped line belongs to the item above.
          const last = list.items[list.items.length - 1];
          last.text = `${last.text} ${l.trim()}`;
        } else {
          break;
        }
        i++;
      }
      blocks.push(list);
      continue;
    }
    if (QUOTE.test(line)) {
      flush();
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].match(QUOTE)?.[1] ?? "");
      blocks.push({ kind: "quote", text: body.join("\n") });
      continue;
    }
    if (TABLE_ROW.test(line)) {
      flush();
      const rows: string[] = [];
      while (i < lines.length && (TABLE_ROW.test(lines[i]) || TABLE_RULE.test(lines[i]))) rows.push(lines[i++]);
      const ruled = rows.length > 1 && TABLE_RULE.test(rows[1]);
      const body = rows.filter((_, n) => !(ruled && n === 1)).map(cells);
      blocks.push({ kind: "table", head: ruled ? (body.shift() ?? null) : null, rows: body });
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return blocks;
}

/** A file, folder or web address a link may point at. */
export function linkTarget(raw: string): string | null {
  const t = raw.trim().replace(/^<|>$/g, "");
  if (/^https?:\/\//i.test(t)) return t;
  if (/^file:\/\//i.test(t) || /^\/?[a-z]:[\\/]/i.test(t) || t.startsWith("\\\\") || t.startsWith("~/")) return t;
  return null;
}

export const INLINE =
  /(\[[^\]\n]+\]\([^)\s]+(?: [^)]*)?\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<![\w*])\*(?![\s*])[^*\n]+?\*(?![\w*])|(?<![\w_])_(?![\s_])[^_\n]+?_(?![\w_]))/g;
