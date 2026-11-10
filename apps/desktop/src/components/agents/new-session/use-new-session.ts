"use client";

// The new-session form's state: which agent, project, mode, model and effort,
// seeded from saved prefs and the usual agent for the project, and Start.

import { useEffect, useRef, useState } from "react";
import {
  readNewPrefs,
  readUsualAgent,
  runningCount,
  type Session,
  SLOTS,
  startSession,
  useAgents,
  writeNewPrefs,
  writeUsualAgent,
} from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import type { AgentMode, Agents } from "@/lib/types";
import { DEFAULT_EFFORT, defaultModel } from "../controls/levels";
import { agentMarkId } from "../marks";
import { ready } from "./agent-status";

export function useNewSession(sessions: Session[]) {
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
  const pickPath = (next: string) => {
    setPath(next);
    useAgents.setState({ draftPath: next });
  };
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
  return {
    agents,
    refreshing,
    projects,
    choices,
    missing,
    picked,
    pickedAgent,
    pickedPath,
    mode,
    model,
    effort,
    prompt,
    setPrompt,
    error,
    busy,
    full,
    pickAgent,
    pickModel,
    pickEffort,
    pickMode,
    pickPath,
    go,
  };
}
