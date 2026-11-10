"use client";

// The open slot on the board: start a session here, or resume a paused one.

import { useEffect, useRef, useState } from "react";
import { type Session, startSession, useAgents } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useDuskie } from "@/lib/store";
import type { Agents } from "@/lib/types";
import { AgentMark } from "../marks";
import { folderName, ProjectPicker } from "../project-picker";
import { AgentChoices } from "./agent-choices";
import { useAgentKeys } from "./use-agent-keys";

export function EmptySlot({
  recent,
  openSignal = 0,
  onDismiss,
}: {
  recent: Session[];
  /** Parent bumps this (Ctrl N) to open the new-session picker. */
  openSignal?: number;
  /** After the picker closes, put focus back on the board composer. */
  onDismiss?: () => void;
}) {
  const { data: agents } = useCached<Agents>("agents", api.agentsStatus);
  const { data: projects } = useCached<{ name: string; path: string }[]>("projects", api.projectsList, 30_000);
  const draftPath = useAgents((s) => s.draftPath);
  const [picking, setPicking] = useState(false);
  const [agent, setAgent] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [path, setPath] = useState(draftPath ?? "");
  const [highlight, setHighlight] = useState(0);
  const pickRoot = useRef<HTMLDivElement>(null);
  const list = projects ?? [];
  const pickedPath = path || list[0]?.path || "";
  const project = list.find((p) => p.path === pickedPath);
  const choosePath = (next: string) => {
    setPath(next);
    useAgents.setState({ draftPath: next });
  };
  const closePick = () => {
    setAgent(null);
    setPicking(false);
    setPrompt("");
    setHighlight(0);
    onDismiss?.();
  };
  // Latest closePick for the Esc listener, so it never calls a stale onDismiss.
  const closePickRef = useRef(closePick);
  closePickRef.current = closePick;

  // Use a discovered project only when a folder has not been selected.
  useEffect(() => {
    if (!list.length) return;
    if (pickedPath && pickedPath !== path) setPath(pickedPath);
  }, [list, pickedPath, path]);
  // Ctrl N (from Board) opens this picker.
  useEffect(() => {
    if (openSignal === 0) return;
    setAgent(null);
    setPrompt("");
    setHighlight(0);
    setPicking(true);
    // Drop composer focus so 1–3 / arrows land on the picker, not the chat box.
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      pickRoot.current?.focus({ preventScroll: true });
    });
  }, [openSignal]);
  // Esc closes the picker (or steps back), not the island, AskPanel also
  // listens for Esc on window; capture + preventDefault wins that race.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        useDuskie.getState().overlayHit ||
        (e.target instanceof Element && e.target.closest("[data-project-picker]"))
      )
        return;
      if (e.key !== "Escape" || e.repeat) return;
      // Project menu is open: let Select take Esc first.
      if (useDuskie.getState().overlayHit) return;
      e.preventDefault();
      e.stopPropagation();
      if (agent) {
        setAgent(null);
        setPrompt("");
      } else closePickRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [picking, agent]);
  const kinds: [string, string, boolean][] = [
    ["claude_code", "Claude Code", !!agents?.claudeCode],
    ["codex", "Codex", !!agents?.codex],
    ["local", "Local", true],
  ];
  const ready = kinds.filter((k) => k[2]);
  const picked = ready.find(([id]) => id === agent);
  useAgentKeys({ on: picking && !agent, list, pickedPath, ready, highlight, setHighlight, setAgent, setPath });
  const projectPicker = (
    <span className="ak-pickproj">
      <span className="ak-pickproj-l">In</span>
      <ProjectPicker menuWidth={300} path={pickedPath} onChange={choosePath} projects={list} />
    </span>
  );

  if (!picking && !agent) {
    return (
      <button type="button" className="ak-tile ak-empty" onClick={() => setPicking(true)}>
        <span className="ak-plus" aria-hidden="true">
          +
        </span>
        <span className="ak-empty-t">Start or bring back</span>
        {recent.length > 0 ? (
          <span className="ak-empty-s">
            {recent.length} paused · {ready.length} ready
          </span>
        ) : (
          <span className="ak-empty-s">{ready.map(([, name]) => name).join(" · ")}</span>
        )}
        <span className="ak-tkey">Ctrl N</span>
      </button>
    );
  }

  return (
    <div ref={pickRoot} className="ak-tile ak-pickslot" tabIndex={-1}>
      {agent && picked ? (
        <>
          <div className="ak-pickhead">
            <AgentMark agent={agent} />
            <span className="min-w-0">
              <b>{picked[1]}</b>
              {projectPicker}
            </span>
            <button type="button" className="ak-pickback" onClick={() => setAgent(null)}>
              Back
            </button>
          </div>
          <input
            // biome-ignore lint/a11y/noAutofocus: picked a moment ago
            autoFocus
            className="ak-pickq"
            value={prompt}
            placeholder="What should it do?"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && prompt.trim() && pickedPath)
                void startSession(agent, pickedPath, prompt.trim(), "edit").then(() => {
                  useAgents.setState({ layout: "board", draftPath: pickedPath });
                  closePick();
                });
            }}
          />
          <p className="ak-pickhint">
            {pickedPath
              ? `Enter to start in ${project?.name ?? folderName(pickedPath)} · Esc back`
              : "Select a folder above first"}
          </p>
        </>
      ) : (
        <AgentChoices
          ready={ready}
          recent={recent}
          highlight={highlight}
          pickedPath={pickedPath}
          projectPicker={projectPicker}
          onHighlight={setHighlight}
          onAgent={setAgent}
          onClose={closePick}
        />
      )}
    </div>
  );
}
