"use client";

// Starting a session: pick an agent, a project and a mode, with a note
// for agents that are not ready yet.

import { useEffect, useRef, useState } from "react";
import {
  readNewPrefs,
  readUsualAgent,
  runningCount,
  type Session,
  SLOTS,
  startSession,
  usageLine,
  useAgents,
  writeNewPrefs,
  writeUsualAgent,
} from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { setAsk } from "@/lib/store";
import type { AgentInfo, AgentMode, Agents, CursorChat } from "@/lib/types";
import { Ic } from "../Icon";
import { ChatControls, DEFAULT_EFFORT, defaultModel, ModeChip } from "./Controls";
import { AgentMark, agentMarkId } from "./marks";
import { MODES, nextAgentMode } from "./modes";
import { ProjectPicker } from "./ProjectPicker";
import { SessionChips, SessionList } from "./SessionList";

export function NewSession({ sessions, cursor }: { sessions: Session[]; cursor: CursorChat[] }) {
  const { data: agents, refreshing, refresh } = useCached<Agents>("agents", api.agentsStatus);
  const { data: projects } = useCached<{ name: string; path: string }[]>("projects", api.projectsList, 30_000);
  const prefs = useRef(readNewPrefs()).current;
  // Last session's agent fills the gap before usual-cache / prefs exist.
  const lastAgentId = sessions[0] ? agentMarkId(sessions[0].agent) : null;
  const lastModel = sessions[0]?.model ?? null;
  const lastEffort = sessions[0]?.effort ?? null;
  const [agent, setAgent] = useState<string>(prefs.agent ?? "");
  const draftPath = useAgents((s) => s.draftPath);
  const [path, setPath] = useState(draftPath ?? "");
  const [mode, setMode] = useState<AgentMode>(prefs.mode ?? "edit");
  const draftPrompt = useAgents((s) => s.draftPrompt);
  const [prompt, setPrompt] = useState(draftPrompt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seedAgent = prefs.agent || readUsualAgent() || lastAgentId || "";
  const seedTune = (seedAgent && prefs.byAgent?.[seedAgent]) || prefs;
  const [model, setModel] = useState<string | null>(
    seedTune.model ?? (seedAgent === lastAgentId ? lastModel : null) ?? null,
  );
  const [effort, setEffort] = useState<string | null>(
    seedTune.effort ?? (seedAgent === lastAgentId ? lastEffort : null) ?? null,
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Ready agents first; the rest stay listed with what they need.
  const all = agents?.list ?? [];
  const choices = [...all.filter(ready), ...all.filter((a) => !ready(a) && a.installed)];
  const missing = all.filter((a) => !a.installed);
  const pickedPath = path || projects?.[0]?.path || "";
  // Seed from cache / last session so the first paint matches usual (no Claude→Codex flash).
  const [usual, setUsual] = useState<string | null>(() => readUsualAgent(pickedPath || undefined) || lastAgentId);
  // biome-ignore lint/correctness/useExhaustiveDependencies: path drives refresh; usual seed is sync
  useEffect(() => {
    if (!pickedPath) return;
    let live = true;
    const cached = readUsualAgent(pickedPath);
    if (cached && cached !== usual) setUsual(cached);
    void api
      .agentUsual(pickedPath)
      .then((id) => {
        writeUsualAgent(pickedPath, id);
        if (live) setUsual(id);
      })
      .catch(() => live && setUsual(null));
    return () => {
      live = false;
    };
  }, [pickedPath]);
  const usualChoice = choices.find((c) => c.id === usual && ready(c))?.id;
  const pickedAgent = agent || usualChoice || choices[0]?.id || "";
  const picked = all.find((a) => a.id === pickedAgent);
  const pickAgent = (id: string) => {
    setAgent(id);
    const tune = readNewPrefs().byAgent?.[id];
    if (tune) {
      if (tune.model !== undefined) setModel(tune.model ?? null);
      if (tune.effort !== undefined) setEffort(tune.effort ?? null);
    }
    writeNewPrefs({ agent: id, model: tune?.model ?? model, effort: tune?.effort ?? effort, mode });
  };
  const pickModel = (m: string | null) => {
    setModel(m);
    writeNewPrefs({ agent: pickedAgent || agent || null, model: m, effort, mode });
  };
  const pickEffort = (e: string | null) => {
    setEffort(e);
    writeNewPrefs({ agent: pickedAgent || agent || null, model, effort: e, mode });
  };
  const pickMode = (m: AgentMode) => {
    setMode(m);
    writeNewPrefs({ agent: pickedAgent || agent || null, model, effort, mode: m });
  };
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, []);
  const full = runningCount(sessions) >= SLOTS;
  const go = () => {
    if (!prompt.trim() || !pickedPath || busy || (picked && !ready(picked))) return;
    setBusy(true);
    setError(null);
    // Confirm readiness right before start; avoid refresh on every open.
    void refresh().catch(() => undefined);
    writeNewPrefs({ agent: pickedAgent, model, effort, mode });
    writeUsualAgent(pickedPath, pickedAgent);
    startSession(
      pickedAgent,
      pickedPath,
      prompt.trim(),
      mode,
      model ?? defaultModel(pickedAgent),
      effort ?? (pickedAgent.toLowerCase() === "local" ? effort : DEFAULT_EFFORT),
    )
      .then(() => setPrompt(""))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setBusy(false));
  };
  return (
    <>
      {sessions.length > 0 ? (
        <SessionList sessions={sessions} />
      ) : (
        <>
          <div className="ak-head">
            <span className="ak-title">New session</span>
          </div>
          <SessionChips sessions={sessions} current={null} cursor={cursor} />
        </>
      )}
      {!agents || (refreshing && choices.length === 0) ? (
        <NewSessionLoading />
      ) : choices.length === 0 ? (
        <NoAgentsReady sessions={sessions.length} cursor={cursor.length} missing={missing} />
      ) : (
        <>
          {picked && !ready(picked) && <FixLine agent={picked} />}
          {picked?.local && ready(picked) && (
            <p className="ak-local">
              <strong>On this PC.</strong> Nothing leaves it. Slower; best for small, clear changes. Every edit waits in
              Review.
            </p>
          )}
          <div className="ag-comp">
            <div className="ag-comp-top">
              <fieldset className="ag-tabs" aria-label="Agent">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={pickedAgent === c.id}
                    onClick={() => pickAgent(c.id)}
                    title={pickerNote(c) || c.name}
                  >
                    <AgentMark agent={c.name} sm />
                    {c.name === "Local (Ollama)" ? "Local" : c.name}
                  </button>
                ))}
              </fieldset>
              <span className="ag-proj">
                <ProjectPicker
                  projects={projects ?? []}
                  path={pickedPath}
                  onChange={(next) => {
                    setPath(next);
                    useAgents.setState({ draftPath: next });
                  }}
                />
              </span>
            </div>
            <textarea
              ref={inputRef}
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === ".") {
                  e.preventDefault();
                  pickMode(nextAgentMode(mode));
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  go();
                }
              }}
              placeholder="What should it do? / for commands, @ for files"
            />
            <div className="ag-comp-foot">
              <ChatControls
                agent={pickedAgent}
                model={model}
                effort={effort}
                onModel={pickModel}
                onEffort={pickEffort}
                lead={<ModeChip mode={mode} onChange={pickMode} />}
                tail={
                  <>
                    <span className="ag-note">
                      {busy
                        ? "Starting..."
                        : full
                          ? `${SLOTS} running, this one queues`
                          : MODES.find((m) => m.id === mode)?.note}
                    </span>
                    <button
                      type="button"
                      className="ag-send"
                      aria-label={full ? "Queue" : "Start"}
                      title={full ? "Queue (Enter)" : "Start (Enter)"}
                      disabled={busy || !prompt.trim()}
                      onClick={go}
                    >
                      <Ic name="send" size={13} />
                    </button>
                  </>
                }
              />
            </div>
          </div>
          {error && <p className="ak-err">{error}</p>}
        </>
      )}
    </>
  );
}

/** No CLI is ready: past sessions can still be opened; setup goes through Settings. */
function NoAgentsReady({ sessions, cursor, missing }: { sessions: number; cursor: number; missing: AgentInfo[] }) {
  const hasPast = sessions > 0 || cursor > 0;
  return (
    <div className="ak-group flex flex-col gap-2 py-1 text-[13px]">
      {hasPast ? (
        <p>
          No coding agent is ready on this PC right now. Open a session above to review it, or set one up in Settings.
        </p>
      ) : (
        <p>Add Claude Code, Codex, Copilot, or Cursor to start a session here.</p>
      )}
      {missing.slice(0, 3).map((a) => (
        <FixLine key={a.id} agent={a} />
      ))}
      <button
        type="button"
        className="ak-chip chip self-start"
        onClick={() => setAsk({ view: "settings", settingsTab: "ai" })}
      >
        Open Settings → AI
      </button>
    </div>
  );
}

/** Skeleton of the new-session form while agents are detected (same idea as ReposLoading). */
function NewSessionLoading() {
  return (
    <div className="ak-nload" role="status" aria-busy="true" aria-label="Finding coding agents">
      <div className="ak-meta ak-rskel" aria-hidden="true">
        <i className="ak-npill" style={{ width: 92 }} />
        <i className="ak-npill" style={{ width: 108 }} />
        <i className="ak-npill" style={{ width: 74 }} />
      </div>
      <div className="ak-composer ak-two ak-rskel" aria-hidden="true">
        <div className="ak-row">
          <i className="ak-nbar" />
        </div>
        <div className="ak-nctrls">
          <i className="ak-npill" style={{ width: 58 }} />
          <i className="ak-npill" style={{ width: 48 }} />
          <i className="ak-npill" style={{ width: 44 }} />
        </div>
      </div>
      <p className="ak-nload-msg">
        <span className="shimmer-text">Finding coding agents</span>
      </p>
    </div>
  );
}

/** Ready to start: installed, not known signed out, not out of usage. */
function ready(a: AgentInfo): boolean {
  return a.installed && a.signedIn !== false && !a.limited;
}

/** Where it runs and whether it is ready, in a few words. */
/** Where it runs, then the last plan usage seen when it is ready. */
function pickerNote(a: AgentInfo): string {
  const usage = ready(a) && !a.local ? usageLine(a.name) : null;
  return usage ? `Cloud · ${usage}` : readyNote(a);
}

function readyNote(a: AgentInfo): string {
  if (!a.installed) {
    // Cursor app on PATH is not the agent CLI Duskie runs.
    if (a.id === "cursor") return "Needs agent CLI";
    return "Not installed";
  }
  if (a.local) return "On this PC. Slower, best for small, clear changes.";
  if (a.signedIn === false) return "Cloud · sign in needed";
  if (a.limited) return "Cloud · out of usage for now";
  return a.signedIn ? "Cloud · ready" : "Cloud · installed";
}

/** The one step that makes an agent ready, with Copy when it is a command. */
function FixLine({ agent }: { agent: AgentInfo }) {
  const [copied, setCopied] = useState(false);
  const step = agent.limited && !agent.fix ? null : agent.fix;
  const command = step && !/\s(from|then)\s/.test(step) ? step : null;
  return (
    <p className="ak-note ak-in flex items-center gap-2">
      <span className="min-w-0 flex-1">
        {agent.name}: {readyNote(agent).replace(/^Cloud · /, "")}.
        {step && (
          <>
            {" "}
            {command ? "Run " : ""}
            <code className="mono">{step}</code>
          </>
        )}
      </span>
      {command && (
        <button
          type="button"
          className="ak-chip chip"
          onClick={() => {
            void navigator.clipboard?.writeText(command).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </p>
  );
}
