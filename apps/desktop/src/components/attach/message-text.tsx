"use client";

// A sent message with its @references shown as name chips, like the box
// they were picked in, instead of long paths.

import { Ic } from "../icon";
import { Tip } from "../tip";
import { fromPick, parents } from "./context";

const REF = /@"([^"]+)"|@(\S+[\\/]\S*)/g;

export function MessageText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(REF)) {
    const path = m[1] ?? m[2];
    const before = text.slice(at, m.index);
    if (before.trim()) parts.push(before.replace(/\s+$/, " "));
    const item = fromPick(path);
    parts.push(
      <Tip key={m.index} label={parents(path)} className="inline-flex min-w-0 align-middle">
        <span className="ak-att ak-att-sent">
          <Ic name={item.folder ? "folder" : "file"} size={11} />
          <span className="truncate">{item.name}</span>
        </span>
      </Tip>,
    );
    at = (m.index ?? 0) + m[0].length;
  }
  if (!parts.length) return <>{text}</>;
  const rest = text.slice(at);
  if (rest.trim()) parts.push(rest);
  return <>{parts}</>;
}
