"use client";
import type { SearchHit } from "@/lib/types";
import { Ic } from "../icon";
import { Kbd, Snippet, SOURCE_LABELS, scrollIfActive } from "./parts";

export function Results({
  query,
  items,
  loading,
  onBack,
  active,
  onHover,
  onOpen,
}: {
  query: string;
  items: SearchHit[];
  loading: boolean;
  onBack: () => void;
  active: number;
  onHover: (i: number) => void;
  onOpen: (hit: SearchHit) => void;
}) {
  const head = (
    <div className="flex items-center gap-2 px-1.5 pt-1 text-[12px] text-[rgb(235_235_245/0.6)]">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-white/75 hover:bg-white/[0.08] hover:text-white"
      >
        <Ic name="chevl" size={11} />
        Back
      </button>
      <span className="min-w-0 flex-1 truncate" aria-live="polite">
        {loading ? `Searching for "${query}"...` : `Results for "${query}"`}
      </span>
      <Kbd>Esc</Kbd>
    </div>
  );
  if (loading)
    return (
      <>
        {head}
        <ul className="py-1" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="ak-skel mx-1.5 my-1.5 h-9 rounded-[12px]" />
          ))}
        </ul>
      </>
    );
  if (items.length === 0)
    return (
      <>
        {head}
        <p className="px-1.5 py-2 text-[13px] text-[rgb(235_235_245/0.6)]">
          Nothing found for &quot;{query}&quot;. Add folders under Settings &gt; Search to find your files.
        </p>
      </>
    );
  return (
    <>
      {head}
      <ul className="py-1">
        {items.map((h, i) => {
          const opens = ["file", "download", "screenshot", "page"].includes(h.source);
          return (
            <li key={`${h.source}|${h.reference}`} ref={scrollIfActive(i === active)}>
              <button
                type="button"
                disabled={!opens}
                aria-current={i === active}
                onMouseMove={() => onHover(i)}
                onClick={() => onOpen(h)}
                className={`flex w-full flex-col gap-0.5 rounded-[14px] px-1.5 py-1.5 text-left transition-colors duration-100 ${
                  i === active ? "bg-white/[0.14] ring-1 ring-inset ring-white/25" : "enabled:hover:bg-white/[0.08]"
                }`}
              >
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="rounded-full bg-white/[0.12] px-1.5 py-px text-[10.5px] text-white/70">
                    {SOURCE_LABELS[h.source] ?? h.source}
                  </span>
                  <span className="truncate text-white/90">{h.title || h.reference}</span>
                </span>
                <span className="line-clamp-2 text-[12px] text-[rgb(235_235_245/0.62)]">
                  <Snippet text={h.snippet} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
