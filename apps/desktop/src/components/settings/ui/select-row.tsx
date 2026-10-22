// One choice in a Select menu: icon or image, label and line under it, and a tick.

import { Tip } from "../../tip";
import type { Row } from "./row";

export function SelectRow({
  r,
  selected,
  highlighted,
  filtering,
  onHover,
  onPick,
}: {
  r: Row;
  selected: boolean;
  highlighted: boolean;
  filtering: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const option = (
    <div
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      onMouseEnter={onHover}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onPick();
      }}
      className={`grid w-full cursor-default items-center gap-2.5 rounded-[9px] px-[9px] py-1.5 text-left text-[13px] transition-colors duration-100 ${
        r.icon || r.image ? "grid-cols-[24px_1fr_auto]" : "grid-cols-[1fr_auto]"
      } ${highlighted ? "bg-(--hover) text-(--text)" : "text-(--text)/85 hover:bg-(--surface)"}`}
    >
      {r.image ? (
        <span className="grid size-6 place-items-center overflow-hidden rounded-[7px]" aria-hidden="true">
          <img src={r.image} alt="" className="size-5 object-contain" draggable={false} />
        </span>
      ) : (
        r.icon && (
          <span
            className="grid size-6 place-items-center rounded-[7px] text-[10.5px] font-bold text-white shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.12)]"
            style={{ background: r.color ?? "#2b2b30" }}
            aria-hidden="true"
          >
            {r.icon}
          </span>
        )
      )}
      <span className="grid min-w-0">
        <span className={`truncate ${r.sub ? "font-medium" : ""}`}>{r.label}</span>
        {r.sub && <span className="truncate text-[11.5px] text-(--muted)">{r.sub}</span>}
      </span>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={`size-3.5 text-(--accent) transition-opacity duration-100 ${selected ? "opacity-100" : "opacity-0"}`}
      >
        <path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
  return (
    <div>
      {r.sepBefore && !filtering && <div className="mx-[9px] my-[5px] h-px scale-y-50 bg-(--border)" />}
      {r.title ? (
        <Tip label={r.title} className="block w-full">
          {option}
        </Tip>
      ) : (
        option
      )}
    </div>
  );
}
