"use client";

// Shared Ask / Agents / Git chrome: one .ak wrapper and one tab row that stay
// mounted across tab switches so the selected pill can slide.

import type { ReactNode } from "react";
import { type PanelTab, PanelTabs } from "./panel-tabs";

export function PanelShell({
  children,
  current,
  onPick,
  coder,
  working = 0,
  alt = false,
  extra,
  enter = false,
  chat = false,
}: {
  children: ReactNode;
  current: PanelTab;
  onPick: (tab: PanelTab) => void;
  coder: boolean;
  working?: number;
  alt?: boolean;
  extra?: ReactNode;
  /** Agents staged reveal (head → timeline → composer). */
  enter?: boolean;
  /** Ask chat layout (`data-chat`). */
  chat?: boolean;
}) {
  return (
    <div className={enter ? "ak ak-enter" : "ak"} data-chat={chat || undefined}>
      <div className="ak-tabs-enter">
        <PanelTabs current={current} onPick={onPick} coder={coder} working={working} alt={alt} extra={extra} />
      </div>
      {children}
    </div>
  );
}
