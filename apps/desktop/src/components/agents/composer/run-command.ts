// What each slash command does: send it to the agent, open it in a terminal,
// switch the mode, or run one of Duskie's own controls.

import type { AgentCommand } from "@/lib/agent-commands";
import {
  renameSession,
  resumeSession,
  type Session,
  sendToSession,
  setSessionMode,
  tuneSession,
  useAgents,
} from "@/lib/agents";
import { api } from "@/lib/bridge";
import type { AgentMode } from "@/lib/types";

const MODES = ["plan", "ask", "edit", "debug", "full"];
const EFFORTS = ["off", "low", "medium", "high", "max", "xhigh", "default"];

export interface CommandContext {
  session: Session;
  working: boolean;
  setNotice: (notice: string | null) => void;
  setTerminal: (command: string) => void;
  setPanel: (panel: { name: string; at: number }) => void;
  onClear: () => void;
  onRewind: () => void;
  onReview: () => void;
}

export function runCommand(c: AgentCommand, args: string, ctx: CommandContext) {
  const { session: s, setNotice } = ctx;
  setNotice(null);
  if (c.execution === "terminal") {
    ctx.setTerminal(`${c.name}${args ? ` ${args}` : ""}`);
    return;
  }
  if (c.execution === "provider") {
    sendToSession(s.id, `${c.name}${args ? ` ${args}` : ""}`);
    return;
  }
  const mode = c.name.slice(1) as AgentMode;
  if (MODES.includes(mode)) {
    void setSessionMode(s.id, mode);
    return;
  }
  const fail = (e: unknown) => setNotice(String(e));
  switch (c.name) {
    case "/clear":
      ctx.onClear();
      break;
    case "/new":
      useAgents.setState({ current: null });
      break;
    case "/rewind":
      ctx.onRewind();
      break;
    case "/diff":
      ctx.onReview();
      break;
    case "/permissions":
      if (MODES.includes(args)) void setSessionMode(s.id, args as AgentMode);
      else
        setNotice(
          `Selected: ${s.mode}. Use the mode buttons above or Ctrl+. to cycle. Codex Edit allows workspace commands and asks for escalation; Full disables the sandbox.`,
        );
      break;
    case "/model":
      if (args) tuneSession(s.id, args === "default" ? null : args, s.effort ?? null);
      else ctx.setPanel({ name: "model", at: Date.now() });
      break;
    case "/effort":
      if (args && EFFORTS.includes(args)) tuneSession(s.id, s.model ?? null, args === "default" ? null : args);
      else if (args) setNotice("Unsupported effort. Choose off, low, medium, high, max, or default.");
      else ctx.setPanel({ name: "effort", at: Date.now() });
      break;
    case "/usage":
      ctx.setPanel({ name: "usage", at: Date.now() });
      break;
    case "/status":
      setNotice(
        `${s.agent} · ${s.status} · selected mode ${s.mode} · model ${s.model ?? "default"} · effort ${s.effort ?? "default"} · session ${s.id}`,
      );
      break;
    case "/rename":
      if (args) renameSession(s.id, args);
      else setNotice("Use /rename followed by a title, or edit the session title above.");
      break;
    case "/copy": {
      const e = [...s.entries].reverse().find((e) => e.kind === "text");
      if (e?.kind === "text")
        void navigator.clipboard
          .writeText(e.text)
          .then(() => setNotice("Response copied"))
          .catch(fail);
      break;
    }
    case "/resume":
      void resumeSession(s.id).catch(fail);
      break;
    case "/compact":
      if (ctx.working) {
        setNotice("Wait for the current turn to finish before compacting.");
        break;
      }
      if (s.agent === "Codex") void api.agentControl(s.id, "thread/compact/start").catch(fail);
      else if (s.agent === "Claude Code") sendToSession(s.id, "/compact");
      else setNotice("Compaction is not supported by this provider.");
      break;
    default:
      setNotice(`Unsupported control: ${c.name}`);
  }
}
