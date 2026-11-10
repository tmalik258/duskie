"use client";

// One setup checklist row: status, Run / Add for me / Set up, and inline guides.

import { memo, type ReactNode, useState } from "react";
import { stopWaiting } from "@/lib/store";
import type { SetupItem } from "@/lib/types";
import {
  Code,
  CopyCommand,
  ONE_CLICK,
  oneClickLabel,
  SetupStatusMark,
  SmallButton,
  TAB_LABELS,
} from "./setup-checklist-row/parts";
import { useSetupActions } from "./setup-checklist-row/use-setup-actions";
import { ItemGuide } from "./setup-guides";

export { SetupSpinner, SetupStatusMark, SmallButton } from "./setup-checklist-row/parts";

/** Memoized: re-renders only when this row's own data or open state changes. */
export const SetupRow = memo(function SetupRow({
  item,
  onRun,
  onOpenTab,
  inlineGuides,
  guideOpen,
  onToggleGuide,
  onDone,
  checking = false,
  children,
}: {
  item: SetupItem;
  onRun: (id: string) => void;
  onOpenTab?: (tab: string) => void;
  inlineGuides?: boolean;
  guideOpen: boolean;
  onToggleGuide: (id: string) => void;
  onDone: () => void;
  /** Pulse glyph while probes are in flight. */
  checking?: boolean;
  /** Shown under the row, done or not (the Composio row's apps). */
  children?: ReactNode;
}) {
  const { busy, actionError, runDirect, run, isWaiting, isDirect, justDone, rowRef } = useSetupActions(
    item,
    onRun,
    onDone,
    onToggleGuide,
  );
  // The command is there for those who want it, not the first thing you see.
  const [showCommand, setShowCommand] = useState(false);
  const multiline = item.command?.includes("\n") ?? false;
  const oneClick = ONE_CLICK.has(item.id);
  const needsGuide = (Boolean(item.tab) && !item.runnable) || oneClick;
  const showInline = Boolean(inlineGuides && needsGuide);
  const showOpenTab = Boolean(!inlineGuides && needsGuide && onOpenTab && item.tab);
  const showRun = Boolean(item.runnable && item.id !== "claude_hooks");

  return (
    <div
      ref={rowRef}
      className={`flex flex-col gap-2 rounded-2xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-inset transition-[box-shadow,background-color] duration-[250ms] ease-out hover:bg-white/[0.08] ${
        justDone ? "ring-[#30d158]/70" : "ring-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        <SetupStatusMark checking={checking} done={item.done} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">
            {item.title}{" "}
            {!(inlineGuides && item.id === "browser") && (
              <span
                className={`font-normal transition-opacity duration-300 ${checking ? "opacity-0" : "opacity-100"} ${
                  item.done ? "text-[#30d158]" : "text-[rgb(235_235_245/0.62)]"
                }`}
              >
                {item.status}
              </span>
            )}
          </p>
          <p className="text-[11.5px] leading-snug text-[rgb(235_235_245/0.62)]">{item.why}</p>
        </div>
        {isWaiting && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-[12px] text-[rgb(235_235_245/0.6)]">Waiting…</span>
            <SmallButton onClick={() => (isDirect ? runDirect() : run())}>Open again</SmallButton>
            <SmallButton onClick={stopWaiting}>Cancel</SmallButton>
          </div>
        )}
        {!checking && !item.done && !isWaiting && (
          <div className="flex shrink-0 gap-1.5">
            {item.command && !oneClick && !item.opensTerminal && (
              <SmallButton onClick={() => setShowCommand((v) => !v)}>
                {showCommand ? "Hide command" : "Command"}
              </SmallButton>
            )}
            {showRun && (
              <SmallButton primary={!showInline && !isDirect} onClick={run}>
                {item.action}
              </SmallButton>
            )}
            {showInline && (
              <SmallButton
                primary
                disabled={busy}
                onClick={() => {
                  if (isDirect) runDirect();
                  else onToggleGuide(item.id);
                }}
              >
                {busy ? "…" : guideOpen ? "Hide" : oneClickLabel(item.id)}
              </SmallButton>
            )}
            {!showInline && isDirect && (
              <SmallButton primary disabled={busy} onClick={runDirect}>
                {busy ? "…" : oneClickLabel(item.id)}
              </SmallButton>
            )}
            {showOpenTab && !isDirect && (
              <SmallButton primary={!item.command} onClick={() => onOpenTab?.(item.tab as string)}>
                {TAB_LABELS[item.tab as string] ? `Open ${TAB_LABELS[item.tab as string]}` : "Open"}
              </SmallButton>
            )}
            {showOpenTab && isDirect && onOpenTab && item.tab && (
              <SmallButton onClick={() => onOpenTab(item.tab as string)}>
                {TAB_LABELS[item.tab] ? `Open ${TAB_LABELS[item.tab]}` : "Open"}
              </SmallButton>
            )}
          </div>
        )}
      </div>
      {actionError && <p className="text-[11px] text-[#ff453a]">{actionError}</p>}
      {!checking && !item.done && item.command && !oneClick && !item.opensTerminal && showCommand && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] leading-snug text-[rgb(235_235_245/0.62)]">
            Paste in PowerShell or Terminal. Swap in your key, press Enter, then come back here.
          </p>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <Code text={multiline ? item.command.split("\n")[0] : item.command} />
            </div>
            <CopyCommand text={item.command} />
          </div>
        </div>
      )}
      {!checking && !item.done && showInline && guideOpen && <ItemGuide id={item.id} onDone={onDone} />}
      {children}
    </div>
  );
});
