"use client";

// The one tab row for the open island: Ask, Agents and Repos as words, with
// History and Settings as icons on the right. Ctrl Tab goes through all five.
// The selected background is a shared layout pill that slides between tabs.

import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { AskTab } from "@/lib/agents";
import { useReduced } from "@/lib/use-reduced";
import { KeyHint } from "./ask/parts";
import { Ic } from "./icon";
import { Tip } from "./tip";

export type PanelTab = AskTab | "settings";

/** Critically damped spring; matches GitTabs underline. */
const PILL = { type: "spring", stiffness: 400, damping: 40, mass: 1 } as const;

/** The Ctrl Tab order. Not a coder: no Agents or Repos. */
export function tabOrder(coder: boolean): PanelTab[] {
  return coder ? ["ask", "agents", "repos", "history", "settings"] : ["ask", "history", "settings"];
}

export function nextTab(current: PanelTab, coder: boolean, back: boolean): PanelTab {
  const order = tabOrder(coder);
  const i = Math.max(order.indexOf(current), 0);
  return order[(i + (back ? order.length - 1 : 1)) % order.length];
}

function TabPill() {
  const reduced = useReduced();
  return (
    <motion.span
      layoutId="ak-tab-pill"
      className="ak-tab-pill"
      aria-hidden="true"
      transition={reduced ? { duration: 0 } : PILL}
    />
  );
}

export function PanelTabs({
  current,
  onPick,
  coder,
  working = 0,
  alt = false,
  extra,
}: {
  current: PanelTab;
  onPick: (tab: PanelTab) => void;
  coder: boolean;
  working?: number;
  alt?: boolean;
  /** Shown just before the icons, like the One/Board switch. */
  extra?: ReactNode;
}) {
  const words = (
    [
      ["ask", "Ask", "spark"],
      ["agents", "Agents", "cpu"],
      ["repos", "Git", "branch"],
    ] as const
  ).filter(([id]) => coder || id === "ask");
  return (
    <div className="ak-tabs" role="tablist">
      {words.map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={current === id}
          onClick={() => onPick(id)}
          className="ak-tab chip"
        >
          {current === id && <TabPill />}
          <span className="ak-tab-ic" aria-hidden>
            <Ic name={icon} size={13} />
          </span>
          {label}
          {id === "agents" && working > 0 && <i className="n not-italic">{working}</i>}
        </button>
      ))}
      <span className="ak-tabs-end">
        {extra}
        <span className="relative">
          <Tip label="History (Alt H)">
            <button
              type="button"
              role="tab"
              aria-selected={current === "history"}
              aria-label="History"
              onClick={() => onPick("history")}
              className="ak-tab ak-tabi chip"
            >
              {current === "history" && <TabPill />}
              <Ic name="clock" size={14} />
            </button>
          </Tip>
          <KeyHint show={alt}>Alt H</KeyHint>
        </span>
        <Tip label="Settings">
          <button
            type="button"
            role="tab"
            aria-selected={current === "settings"}
            aria-label="Settings"
            onClick={() => onPick("settings")}
            className="ak-tab ak-tabi chip"
          >
            {current === "settings" && <TabPill />}
            <Ic name="gear" size={14} />
          </button>
        </Tip>
      </span>
    </div>
  );
}
