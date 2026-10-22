"use client";

// The island: a black capsule that morphs like Apple's Dynamic Island. One
// Orb instance lives inside and travels between the compact and expanded
// layouts, so its gaze and blink never reset. The shell size is spring driven
// and interruptible; content cross-fades through a short blur.

import { IslandView } from "./island/island-view";
import { useIslandFace } from "./island/use-island-face";
import { useIslandHover } from "./island/use-island-hover";
import { useIslandShape } from "./island/use-island-shape";
import { useIslandStore } from "./island/use-island-store";
import { useIslandWork } from "./island/use-island-work";

export function Island() {
  const store = useIslandStore();
  const work = useIslandWork(store);
  const hover = useIslandHover({ ...store, ...work });
  const face = useIslandFace({ ...store, ...work, ...hover });
  const shape = useIslandShape({ ...store, ...work, ...hover, ...face });
  if (!store.ready) return null;
  return <IslandView {...store} {...work} {...hover} {...face} {...shape} />;
}
