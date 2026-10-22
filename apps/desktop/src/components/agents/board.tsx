"use client";

// Several sessions at once: one tile each, two across (three on wide
// screens), one chat box under them for the tile in focus.

import { useEffect, useRef, useState } from "react";
import {
  openReview,
  type Session,
  sendToSession,
  sessionView,
  setLayout,
  startHere,
  usageLine,
  useAgents,
  wideScreen,
} from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useDuskie } from "@/lib/store";
import { EmptySlot } from "./board/empty-slot";
import { state } from "./board/state";
import { Tile } from "./board/tile";
import { Composer } from "./composer";
import { AgentMark } from "./marks";

export function Board({
  sessions,
  maxHeight,
  active = true,
}: {
  sessions: Session[];
  maxHeight: number;
  /** False while Ask is shown but Agents is kept warm, do not steal Ctrl N. */
  active?: boolean;
}) {
  const focus = useAgents((s) => s.focus);
  const live = sessions;
  const paused = sessions.filter((s) => s.restored && s.status === "ended");
  const target = live.find((s) => s.id === focus) ?? live.find((s) => s.question) ?? live[0] ?? null;
  const targetId = target?.id;
  const [text, setLocalText] = useState("");
  const textRef = useRef("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore draft only when the focused target switches
  useEffect(() => {
    const draft = target?.view?.draft ?? "";
    textRef.current = draft;
    setLocalText(draft);
  }, [targetId]);
  const setText = (draft: string) => {
    textRef.current = draft;
    setLocalText(draft);
  };
  const flushDraft = () => {
    if (targetId) sessionView(targetId, { draft: textRef.current });
  };
  useEffect(
    () => () => {
      if (targetId) sessionView(targetId, { draft: textRef.current });
    },
    [targetId],
  );
  const grid = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(0);
  const [openNew, setOpenNew] = useState(0);
  const focusComposer = () => {
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>(".ak-board .ak-composer input")?.focus({ preventScroll: true }),
    );
  };
  // Ready to type on open, and again when Ctrl 1-9 picks another tile.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus again when the target changes
  useEffect(() => {
    focusComposer();
  }, [targetId]);

  // Ctrl N: new session. Ctrl 1–9: focus a live session tile.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        useDuskie.getState().overlayHit ||
        (e.target instanceof Element && e.target.closest("[data-project-picker]"))
      )
        return;
      if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpenNew((t) => t + 1);
        return;
      }
      const n = Number(e.key);
      if (!n || n > 9 || n > live.length) return;
      e.preventDefault();
      useAgents.setState({ focus: live[n - 1].id });
      grid.current?.children[n - 1]?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, active]);

  const measure = () => {
    const el = grid.current;
    if (!el) return;
    const hidden = Array.from(el.children).filter(
      (c) => (c as HTMLElement).offsetTop >= el.scrollTop + el.clientHeight - 8,
    ).length;
    setBelow(hidden);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: count again when tiles change
  useEffect(measure, [live.length]);

  const send = () => {
    const t = text.trim();
    if (!t || !target) return;
    sendToSession(target.id, t);
    setLocalText("");
    textRef.current = "";
    sessionView(target.id, { draft: "" });
  };

  if (live.length === 0 && paused.length === 0) {
    return (
      <div className="ak-board">
        <div className="ak-grid" style={{ maxHeight }}>
          <EmptySlot recent={[]} openSignal={openNew} />
        </div>
        <button type="button" className="chip self-start" onClick={() => setLayout("one")}>
          Back to one session
        </button>
      </div>
    );
  }

  const working = live.filter((s) => state(s)[0] === "run").length;
  const needs = live.filter((s) => s.question).length;
  const limits = Array.from(new Set(live.map((s) => s.agent)))
    .map((a) => [a, usageLine(a)] as const)
    .filter((x): x is readonly [string, string] => !!x[1] && x[1] !== "ready");
  return (
    <div className="ak-board">
      <div className="ak-btop">
        <span className="ak-bsum">
          <b>
            {live.length} session{live.length === 1 ? "" : "s"}
          </b>
          {working > 0 && (
            <span>
              <i className="ak-bdot" style={{ background: "#64d2ff" }} />
              {working} working
            </span>
          )}
          {needs > 0 && (
            <span>
              <i className="ak-bdot" style={{ background: "#ff9f0a" }} />
              {needs} needs you
            </span>
          )}
        </span>
        {limits.map(([a, line]) => (
          <span key={a} className="ak-blim">
            <AgentMark agent={a} sm />
            {line.split(",")[0]}
          </span>
        ))}
      </div>
      <div className="relative">
        <div
          ref={grid}
          className="ak-grid"
          data-wide={wideScreen()}
          data-more={below > 0}
          style={{ maxHeight }}
          onScroll={measure}
        >
          {live.map((s, i) => (
            <Tile key={s.id} s={s} n={i + 1} focused={s.id === target?.id} />
          ))}
          <EmptySlot recent={paused} openSignal={openNew} onDismiss={focusComposer} />
        </div>
        {below > 0 && <p className="ak-below">{below} more below</p>}
      </div>
      {target && (
        <Composer
          session={target}
          working={target.status === "working" || target.status === "waiting"}
          text={text}
          setText={setText}
          onSend={send}
          onBlur={flushDraft}
          onClear={() =>
            void api.agentProject(target.id).then((path) => {
              setLayout("one");
              startHere(path);
            })
          }
          onReview={() => {
            setLayout("one");
            useAgents.setState({ current: target.id });
            openReview(target.id);
          }}
          onRewind={() => {
            setLayout("one");
            useAgents.setState({ current: target.id });
          }}
        />
      )}
    </div>
  );
}
