"use client";

// One-shot accent wash on the island shell when something completes under Atelier.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ATELIER_WASH_MS, atelierWashReduced, atelierWashTransition } from "@/lib/atelier-motion";
import type { MascotState } from "@/lib/types";

export function AtelierWash({
  enabled,
  simple,
  mascot,
  donePill,
}: {
  enabled: boolean;
  simple: boolean;
  mascot: MascotState;
  donePill: string | null;
}) {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(false);
  const prevMascot = useRef(mascot);
  const prevDone = useRef(donePill);

  useEffect(() => {
    if (!enabled || simple) {
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
    const id = window.setTimeout(() => setActive(false), ATELIER_WASH_MS);
    return () => window.clearTimeout(id);
  }, [enabled, simple, mascot, donePill]);

  if (!enabled || simple) return null;

  const t = reduced ? atelierWashReduced : atelierWashTransition;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="atelier-wash"
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
