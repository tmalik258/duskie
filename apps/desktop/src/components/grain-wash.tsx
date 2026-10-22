"use client";

// A slow grain gradient that retints on a spring when something happens and
// sends a soft ring out from `origin`. It draws a still frame when idle and
// hidden, and only runs the animation loop while something is moving.

import { animate } from "motion/react";
import type { Ref } from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useReduced } from "@/lib/use-reduced";
import { channels, PALETTES, type WashEvent } from "@/lib/wash";
import { setupProgram } from "./grain-wash/gl";

export interface GrainWashHandle {
  /** Retints to the event and sends a ring; transient events settle back to `base`. */
  fire: (event: WashEvent) => void;
}

/** Seconds a ring needs to fade out; the loop can stop after this. */
const RING_SECONDS = 3.2;
const COLOR_SPRING = { type: "spring", stiffness: 49, damping: 12.6, mass: 1 } as const;
const COLOR_FADE = { duration: 0.3 } as const;

export function GrainWash({
  base,
  origin = { x: 0.5, y: 0.06 },
  grain = 0.45,
  className,
  handle,
}: {
  /** The tint to hold between events. */
  base: WashEvent;
  /** Where rings start, as fractions of the width and height. */
  origin?: { x: number; y: number };
  grain?: number;
  className?: string;
  handle?: Ref<GrainWashHandle>;
}) {
  const reduced = useReduced();
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ fire: (e: WashEvent) => void; setBase: (e: WashEvent) => void } | null>(null);
  const baseRef = useRef(base);
  const originRef = useRef(origin);
  originRef.current = origin;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useImperativeHandle(handle, () => ({ fire: (e) => live.current?.fire(e) }), []);

  useEffect(() => {
    baseRef.current = base;
    live.current?.setBase(base);
  }, [base]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const gl = cv.getContext("webgl", {
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const u = setupProgram(gl);
    if (!u) return;

    // Current animated values.
    const col = channels(PALETTES[baseRef.current]);
    let energy = PALETTES[baseRef.current].energy;
    let ring = { t0: -1e6, s: 0 };
    let time = 0;
    let running = false;
    let raf = 0;
    let settle = 0;
    let moving = 0; // animations in flight

    const draw = (now: number) => {
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(u.r, cv.width, cv.height);
      gl.uniform1f(u.t, time);
      gl.uniform3f(u.a, col[0], col[1], col[2]);
      gl.uniform3f(u.b, col[3], col[4], col[5]);
      gl.uniform3f(u.c, col[6], col[7], col[8]);
      gl.uniform1f(u.e, energy);
      const age = reducedRef.current ? 99 : (now - ring.t0) / 1000;
      const o = originRef.current;
      gl.uniform4f(u.pu, o.x, o.y, age, ring.s);
      gl.uniform1f(u.g, grain * 0.16);
      gl.uniform1f(u.gt, reducedRef.current ? 0 : Math.floor(now / 42) % 97);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const w = Math.max(2, Math.round(cv.clientWidth * 0.5));
      const h = Math.max(2, Math.round(cv.clientHeight * 0.5));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      draw(performance.now());
    };

    // The loop only runs while the page is visible, motion is allowed and
    // something is moving: a color change, or a ring still fading.
    const needsLoop = (now: number) =>
      !document.hidden && !reducedRef.current && (moving > 0 || (now - ring.t0) / 1000 < RING_SECONDS);

    const frame = (now: number) => {
      raf = 0;
      if (!running) return;
      time += 0.016 * (0.25 + 0.4 * 1.9);
      draw(now);
      if (needsLoop(now)) raf = requestAnimationFrame(frame);
      else running = false;
    };
    const wake = () => {
      if (running || !needsLoop(performance.now())) {
        if (!running) draw(performance.now());
        return;
      }
      running = true;
      raf = requestAnimationFrame(frame);
    };

    const paint = (name: WashEvent, fast: boolean) => {
      const p = PALETTES[name];
      const target = channels(p);
      const transition = reducedRef.current || fast ? COLOR_FADE : COLOR_SPRING;
      moving++;
      let left = target.length + 1;
      const done = () => {
        if (--left === 0) moving--;
      };
      target.forEach((to, i) => {
        animate(col[i], to, {
          ...transition,
          onUpdate: (v) => {
            col[i] = v;
          },
          onComplete: done,
        });
      });
      animate(energy, p.energy, {
        ...transition,
        onUpdate: (v) => {
          energy = v;
        },
        onComplete: done,
      });
      wake();
    };

    live.current = {
      setBase: (name) => {
        window.clearTimeout(settle);
        paint(name, false);
        if (PALETTES[name].ring > 0) ring = { t0: performance.now(), s: PALETTES[name].ring };
      },
      fire: (name) => {
        window.clearTimeout(settle);
        paint(name, false);
        ring = { t0: performance.now(), s: PALETTES[name].ring };
        wake();
        const back = PALETTES[name].settleMs;
        if (back > 0) settle = window.setTimeout(() => paint(baseRef.current, false), back);
      },
    };

    const observer = new ResizeObserver(resize);
    observer.observe(cv);
    const onVisible = () => wake();
    document.addEventListener("visibilitychange", onVisible);
    resize();
    // The first frame is the base tint, drawn without animating in.
    draw(performance.now());

    return () => {
      window.clearTimeout(settle);
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      live.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [grain]);

  return <canvas ref={canvas} aria-hidden className={className} style={{ width: "100%", height: "100%" }} />;
}
