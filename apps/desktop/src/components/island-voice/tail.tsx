"use client";

// Part of island-voice: tail, voiceLabel, FullVoice, statusMeasureCanvas, statusTextWidth, statusChrome, voiceShellWidth, statusNeedsTruncate, openBoard, DOT, AgentRing.

import { useState } from "react";
import { useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";
import { COMPACT, SHELL_COMPACT } from "../island-layout";
import { Activity } from "../island-parts/activity";
import { Tip } from "../tip";

export function tail(text: string): string {
  return text.length > 38 ? `...${text.slice(-38).replace(/^\S*\s/, "")}` : text;
}

export function voiceLabel(text: string, thinking: boolean, working?: boolean): string {
  if (working) return text;
  if (thinking) return `Thinking: ${text}`;
  return text.trim() ? tail(text) : "Listening...";
}

/** Full listening style: a waveform, a timer and Stop on the first line,
 * then your words a size larger (grey until final) and what happens next. */
export function FullVoice({ text, thinking }: { text: string; thinking: boolean }) {
  const [start] = useState(() => Date.now());
  const now = useNow(1000);
  const secs = Math.max(0, Math.floor((now - start) / 1000));
  const words = text.trim();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-9 items-center gap-2.5">
        {thinking ? (
          <span className="flex-1">
            <Activity />
          </span>
        ) : (
          <span className="voice-wave min-w-0 flex-1" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars
              <i key={i} style={{ animationDelay: `${-((i * 0.37) % 0.9).toFixed(2)}s` }} />
            ))}
          </span>
        )}
        <span className="min-w-[2.6em] text-right font-mono text-[11.5px] text-white/45 tabular-nums">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
        <Tip label="Stop (Esc)">
          <button
            type="button"
            aria-label="Stop listening"
            onClick={() => void api.voiceStop()}
            className="chip grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.09] hover:bg-white/[0.15]"
          >
            <span className="size-[9px] rounded-[2.5px] bg-white" />
          </button>
        </Tip>
      </div>
      <p
        className={`min-h-[1.45em] px-1 text-[16.5px] leading-[1.45] tracking-[-0.005em] ${
          words ? "text-white" : "text-white/45"
        }`}
      >
        {words || "Listening..."}
      </p>
      <p className="flex items-center gap-[7px] px-1 pb-0.5 text-[11.5px] text-white/45">
        {thinking ? (
          <span className="shimmer-text">Thinking</span>
        ) : (
          <>
            <span className="voice-live size-1.5 rounded-full bg-white" aria-hidden="true" />
            Listening · pause to send ·
            <kbd className="rounded-[4px] bg-white/[0.09] px-[5px] py-px font-mono text-[10.5px] text-white/62">
              Esc
            </kbd>
            cancel
          </>
        )}
      </p>
    </div>
  );
}

/** Pixel width of the compact status label (avoids a stretch gap from char guesses). */
let statusMeasureCanvas: HTMLCanvasElement | null = null;

export function statusTextWidth(label: string): number {
  if (typeof document === "undefined") return Math.ceil([...label].length * 7.2);
  if (!statusMeasureCanvas) statusMeasureCanvas = document.createElement("canvas");
  const ctx = statusMeasureCanvas.getContext("2d");
  if (!ctx) return Math.ceil([...label].length * 7.2);
  ctx.font = '500 12.5px ui-sans-serif, system-ui, "Segoe UI", sans-serif';
  return Math.ceil(ctx.measureText(label).width);
}

/** Orb column + trailing controls for a compact status pill (gap-1.5 + pr-2). */
export function statusChrome(opts?: { cancel?: boolean; indicator?: boolean }): number {
  // Mascot column is the prototype's 48px (SHELL_COMPACT.padLeft).
  let chrome = SHELL_COMPACT.padLeft + 8;
  if (opts?.indicator) chrome += 6 + 12;
  if (opts?.cancel) chrome += 6 + 24;
  return chrome;
}

/** Compact listening shell: tight when empty, grows with speech up to voiceWidth. */
export function voiceShellWidth(
  text: string,
  thinking: boolean,
  opts?: { status?: boolean; cancel?: boolean; indicator?: boolean },
): number {
  const status = !!opts?.status;
  const label = voiceLabel(text, thinking, status);
  // Status: orb + gap + label + optional indicator/cancel + right pad.
  // Charge only for chrome that is actually on screen (Focus has no spinner).
  if (status) {
    return Math.min(COMPACT.statusMaxWidth, Math.max(120, statusChrome(opts) + statusTextWidth(label)));
  }
  const textPx = Math.ceil([...label].length * 7.2);
  // Orb column, gaps, green bars, stop button, right pad.
  const chrome = COMPACT.height + 4 + 10 + 20 + 28 + 14;
  return Math.min(COMPACT.voiceWidth, Math.max(COMPACT.voiceMinWidth, chrome + textPx));
}

export function statusNeedsTruncate(label: string, opts?: { cancel?: boolean; indicator?: boolean }): boolean {
  return statusChrome(opts) + statusTextWidth(label) > COMPACT.statusMaxWidth;
}

/** Voice in the compact island: green bars and the words as they come
 * while listening, then "Thinking" with the question until the answer. */
/** The compact agents pill opens Agents on the board. */
export function openBoard() {
  useAgents.setState({ tab: "agents", layout: "board" });
  void api.askOpen();
}

export const DOT: Record<string, string> = { working: "#64d2ff", waiting: "#ff9f0a" };

// One arc per running agent around a slow-turning ring: blue works, orange waits.
export function AgentRing({ states }: { states: string[] }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const gap = 2.2;
  const seg = c / states.length - gap;
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 animate-[spin_3s_linear_infinite] motion-reduce:animate-none"
      role="img"
      aria-label={`${states.length} agents`}
    >
      {states.map((d, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: one arc per agent, in order
          key={i}
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke={DOT[d] ?? "rgb(255 255 255 / 0.3)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${seg} ${c - seg}`}
          strokeDashoffset={-i * (seg + gap)}
        />
      ))}
    </svg>
  );
}
