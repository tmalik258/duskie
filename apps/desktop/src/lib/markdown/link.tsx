// Part of markdown: Link, inline, CodeBlock.

import { type ReactNode, useState } from "react";
import { Icon } from "@/components/icon";
import { Tip } from "@/components/tip";
import { api } from "../bridge";
import { INLINE, linkTarget } from "./list-item";

function Link({ label, target }: { label: string; target: string }) {
  const [error, setError] = useState<string | null>(null);
  const web = /^https?:/i.test(target);
  const open = () => {
    setError(null);
    api.aiOpenLink(target).catch((e: unknown) => setError(String(e)));
  };
  if (!web) {
    // A file or folder: a chip that opens it.
    const folder = /[\\/]$/.test(target) || !/\.[a-z0-9]{1,8}$/i.test(target.replace(/[\\/]+$/, ""));
    return (
      <Tip label={error ?? `Open ${target}`}>
        <button
          type="button"
          onClick={open}
          className={`chip inline-flex max-w-full items-center gap-1 rounded-md bg-white/[0.1] px-1.5 py-px align-baseline text-[0.92em] hover:bg-white/[0.16] ${
            error ? "text-[#ffb4ae]" : "text-white"
          }`}
        >
          <Icon name={folder ? "folder" : "file"} size={12} className="shrink-0 text-white/60" />
          <span className="truncate">{label}</span>
        </button>
      </Tip>
    );
  }
  return (
    <Tip label={error ?? target}>
      <button
        type="button"
        onClick={open}
        className={`inline rounded-sm text-left underline decoration-white/35 underline-offset-2 hover:decoration-white ${
          error ? "text-[#ffb4ae]" : "text-[#64d2ff]"
        }`}
      >
        {label}
      </button>
    </Tip>
  );
}

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const tok = m[0];
    if (tok.startsWith("[")) {
      const link = tok.match(/^\[([^\]]+)\]\(([^)\s]+)/);
      const target = link ? linkTarget(link[2]) : null;
      if (link && target) out.push(<Link key={k++} label={link[1]} target={target} />);
      else out.push(link ? link[1] : tok);
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={k++} className="rounded-[5px] bg-white/10 px-1 py-px font-mono text-[0.86em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(
        <strong key={k++} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be refused; nothing to do.
    }
  };
  return (
    <div className="group relative my-2 overflow-hidden rounded-xl bg-white/[0.07]">
      <div className="flex items-center justify-between px-3 pt-2 text-[11px] text-white/40">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-1.5 py-0.5 text-white/55 transition-colors duration-150 hover:bg-white/10 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 pt-1 pb-3 font-mono text-[12.5px] leading-relaxed text-white/90">{text}</pre>
    </div>
  );
}
