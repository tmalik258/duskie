"use client";

// One-shot accent wash on the island shell when something completes.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { MascotState } from "@/lib/types";
import { WASH_MS, washReduced, washTransition } from "@/lib/ui-motion";

export function IslandWash({
  simple,
  mascot,
  donePill,
}: {
  simple: boolean;
  mascot: MascotState;
  donePill: string | null;
}) {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(false);
  const prevMascot = useRef(mascot);
  const prevDone = useRef(donePill);

  useEffect(() => {
    if (simple) {
      setActive(false);
      prevMascot.current = mascot;
      prevDone.current = donePill;
      return;
    }
    const successEdge = mascot === "success" && prevMascot.current !== "success";
    const doneEdge = !!donePill && donePill !== prevDone.current;
    prevMascot.current = mascot;
    prevDone.current = donePill;
    if (!successEdge && !doneEdge) return;
    setActive(true);
    const id = window.setTimeout(() => setActive(false), WASH_MS);
    return () => window.clearTimeout(id);
  }, [simple, mascot, donePill]);

  if (simple) return null;

  const t = reduced ? washReduced : washTransition;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="island-wash"
          className="island-shell__wash"
          aria-hidden
          initial={reduced ? { opacity: 0 } : { opacity: 0, transform: "scale(0.98)" }}
          animate={reduced ? { opacity: 0.18 } : { opacity: 0.18, transform: "scale(1)" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, transform: "scale(0.98)" }}
          transition={t}
        />
      )}
    </AnimatePresence>
  );
}
