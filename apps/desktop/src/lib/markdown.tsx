// A small Markdown renderer for chat answers: paragraphs, headings, bullet
// and numbered lists (one level of nesting), quotes, simple tables, fenced
// code (with a copy button), inline code, bold, italics and links. No HTML is
// ever injected; everything renders as React elements. Links to files,
// folders and pages open through Duskie, never in this window; files and
// folders show as chips.
//
// Built for streaming: partial input renders sensibly (an open fence, a list
// still growing), and finished blocks are memoized so only the last one
// re-renders as words arrive.

import { memo } from "react";
import { CodeBlock, inline } from "./markdown/link";
import { type Block, splitBlocks } from "./markdown/list-item";

function BlockView({ block }: { block: Block; sig: string }) {
  switch (block.kind) {
    case "code":
      return <CodeBlock lang={block.lang} text={block.text} />;
    case "heading":
      return (
        <p
          className={`mt-3 mb-1 font-semibold tracking-[-0.01em] text-white first:mt-0 ${
            block.level <= 1 ? "text-[15px]" : "text-[14px]"
          }`}
        >
          {inline(block.text)}
        </p>
      );
    case "list":
      // Bullets and numbers are drawn, not list markers, so they line up
      // with the text and look the same everywhere.
      return (
        <ul className="my-1.5 flex flex-col gap-1">
          {block.items.map((it, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items only ever append while streaming
            <li key={n} className="flex gap-2">
              {block.ordered ? (
                <span className="w-4 shrink-0 text-right text-white/45 tabular-nums">{block.start + n}.</span>
              ) : (
                <span aria-hidden="true" className="mt-[0.62em] ml-1.5 size-[5px] shrink-0 rounded-full bg-white/45" />
              )}
              <span className="min-w-0 flex-1">
                {inline(it.text)}
                {it.sub.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {it.sub.map((s, m) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: items only ever append while streaming
                      <li key={m} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-[0.62em] size-[5px] shrink-0 rounded-full border border-white/40"
                        />
                        <span className="min-w-0 flex-1">{inline(s)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="my-1.5 border-l-2 border-white/20 pl-3 whitespace-pre-wrap text-white/70">
          {inline(block.text)}
        </blockquote>
      );
    case "table":
      return (
        <div className="my-2 overflow-x-auto rounded-xl bg-white/[0.05]">
          <table className="w-full border-collapse text-[12.5px]">
            {block.head && (
              <thead>
                <tr>
                  {block.head.map((c, n) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns have no identity beyond order
                    <th key={n} className="border-b border-white/10 px-3 py-1.5 text-left font-medium text-white/60">
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((r, n) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows only ever append while streaming
                <tr key={n} className="border-b border-white/[0.06] last:border-0">
                  {r.map((c, m) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns have no identity beyond order
                    <td key={m} className="px-3 py-1.5 align-top tabular-nums">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <p className="my-1.5 whitespace-pre-wrap">{inline(block.text)}</p>;
  }
}

/** Finished blocks keep their signature while an answer streams, so they
 * skip re-rendering; only the last one updates. */
const Memo = memo(BlockView, (a, b) => a.sig === b.sig);

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {splitBlocks(text).map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no identity beyond order
        <Memo key={i} block={b} sig={JSON.stringify(b)} />
      ))}
    </>
  );
}
