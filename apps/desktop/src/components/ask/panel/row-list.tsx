// The rows under the input, grouped, with the key that runs the active one.

import { motion, useReducedMotion } from "motion/react";
import { staggerChild, staggerChildReduced, staggerParent } from "@/lib/ui-motion";
import { scrollIfActive } from "../parts";
import type { Item } from "./item";

export function RowList(p: {
  items: Item[];
  active: number;
  asking: boolean;
  slash: boolean;
  outsideChat: boolean;
  maxHeight: number;
  onHover: (i: number) => void;
  onRun: (i: number) => void;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const { asking, slash, outsideChat, active } = p;
  return (
    <motion.ul
      key={slash ? "slash" : asking ? "typing" : "start"}
      className="ak-list ak-scroll"
      style={{ maxHeight: p.maxHeight }}
      initial="hidden"
      animate="show"
      variants={staggerParent}
    >
      {p.items.map((it, i) => (
        <motion.li
          key={it.id}
          ref={scrollIfActive(active === i)}
          variants={reducedMotion ? staggerChildReduced : staggerChild}
        >
          {(it.group ?? (outsideChat && !asking && !slash && i === 0 ? "Try" : undefined)) && (
            <p className="ak-group">{it.group ?? "Try"}</p>
          )}
          <button
            type="button"
            data-sel={active === i}
            onMouseMove={() => p.onHover(i)}
            onClick={() => p.onRun(i)}
            className="ak-row"
          >
            <span className="ak-ico">{it.icon}</span>
            {outsideChat && !asking ? (
              <span className="ak-two min-w-0 flex-1">
                <span className="block truncate">{it.label}</span>
                {it.hint && <span className="ak-sub block truncate">{it.hint}</span>}
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.hint && <span className="ak-hint">{it.hint}</span>}
              </>
            )}
            {it.key ? (
              <kbd className="ak-key">{it.key}</kbd>
            ) : (
              asking &&
              active === i &&
              (it.ctrlRun ? (
                <span className="ak-keys">
                  <kbd className="ak-key">Enter</kbd>
                  <kbd className="ak-key">Ctrl Enter</kbd>
                </span>
              ) : (
                <kbd className="ak-key">Enter</kbd>
              ))
            )}
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}
