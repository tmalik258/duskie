"use client";

// The message box under a session: slash commands, @files, the mode and
// model chips, and the queue.

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { AgentCommand } from "@/lib/agent-commands";
import { type Session, setSessionMode, tuneSession } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { ChatControls, ModeChip } from "./Controls";
import { ComposerPop } from "./composer/ComposerPop";
import { runCommand } from "./composer/run-command";
import { useComposerLists } from "./composer/use-composer-lists";
import { usePopPlace } from "./composer/use-pop-place";
import { nextAgentMode } from "./modes";

/** Where you type to the agent: / lists commands, @ finds files in the project. */
export function Composer({
  session: s,
  working,
  text,
  setText,
  editFocus = 0,
  onSend,
  onClear,
  onReview,
  onRewind,
  onBlur,
}: {
  session: Session;
  working: boolean;
  text: string;
  setText: (t: string) => void;
  /** After rewind: focus the box and select the restored draft (Cursor-style edit). */
  editFocus?: number;
  onSend: () => void;
  onClear: () => void;
  onReview: () => void;
  onRewind: () => void;
  onBlur?: () => void;
}) {
  const [panel, setPanel] = useState<{ name: string; at: number }>();
  const [notice, setNotice] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { commands, shownCommands, files, slash, mention, count } = useComposerLists(s, text);
  const { float, popRef } = usePopPlace(wrapRef, count, text);
  const at = Math.min(sel, Math.max(count - 1, 0));
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus again when the session changes
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [s.id]);
  useEffect(() => {
    if (!editFocus) return;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    });
  }, [editFocus]);
  const run = (c: AgentCommand, args = "") => {
    setText("");
    runCommand(c, args, { session: s, working, setNotice, setTerminal, setPanel, onClear, onRewind, onReview });
  };
  const submit = () => {
    const match = /^\/(\S+)(?:\s+(.*))?$/.exec(text.trim());
    if (!match) {
      onSend();
      return;
    }
    const command = commands.find((c) => c.name === `/${match[1].toLowerCase()}`);
    if (command) run(command, match[2] ?? "");
    else setNotice(`Unsupported command /${match[1]}. Use / to see supported controls.`);
  };
  const pickFile = (f: string) => {
    if (!mention) return;
    setText(`${text.slice(0, text.length - mention[2].length - 1)}@${f} `);
    inputRef.current?.focus({ preventScroll: true });
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === ".") {
      e.preventDefault();
      e.stopPropagation();
      void setSessionMode(s.id, nextAgentMode(s.mode));
      return;
    }
    if (count && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setSel((at + (e.key === "ArrowDown" ? 1 : -1) + count) % count);
    } else if (count && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault();
      if (slash) {
        const c = shownCommands[at];
        if (c) run(c);
      } else if (files[at]) pickFile(files[at]);
      setSel(0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && count) {
      e.preventDefault();
      setText(slash ? "" : text.replace(/(^|\s)@[^\s@]*$/, "$1"));
      setSel(0);
    }
  };
  return (
    <>
      {count > 0 && float && (
        <ComposerPop
          popRef={popRef}
          float={float}
          slash={slash}
          commands={shownCommands}
          files={files}
          project={s.project}
          at={at}
          onHover={setSel}
          onCommand={(c) => run(c)}
          onFile={pickFile}
        />
      )}
      {notice && (
        <p role="status" className="ak-note">
          {notice}
        </p>
      )}
      {terminal && <TerminalOnly id={s.id} command={terminal} onError={setNotice} />}
      <div ref={wrapRef} className="ak-composer ak-two relative">
        <div className="ak-row">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSel(0);
            }}
            onBlur={() => onBlur?.()}
            onKeyDown={onKey}
            placeholder={working ? "Steer it, it reads this next" : "Ask for more, / for commands, @ for files"}
          />
        </div>
        <ChatControls
          agent={s.agent}
          model={s.model}
          effort={s.effort}
          onModel={(m) => tuneSession(s.id, m, s.effort ?? null)}
          onEffort={(e) => tuneSession(s.id, s.model ?? null, e)}
          lead={<ModeChip mode={s.mode} onChange={(mode) => void setSessionMode(s.id, mode)} />}
          usage={s.usage}
          panel={panel}
          onRefresh={
            s.agent === "Codex"
              ? () => void api.agentControl(s.id, "account/rateLimits/read").catch((e) => setNotice(String(e)))
              : undefined
          }
          localModel={s.localModel}
          limit={s.limit}
          onCompact={
            (s.agent === "Claude Code" || s.agent === "Codex") && !working
              ? () => run({ name: "/compact", description: "", group: "Duskie", execution: "control" })
              : undefined
          }
          keys={working ? "Esc interrupt" : "Enter send"}
        />
      </div>
    </>
  );
}

/** A command only the agent's own terminal can run: open it there, or copy it. */
function TerminalOnly({ id, command, onError }: { id: string; command: string; onError: (e: string) => void }) {
  return (
    <div className="ak-chips">
      <span className="ak-note">
        Terminal only: <code className="mono">{command}</code>
      </span>
      <button
        type="button"
        className="ak-chip chip"
        onClick={() => void api.agentTerminal(id).catch((e) => onError(String(e)))}
      >
        Open in terminal
      </button>
      <button
        type="button"
        className="ak-chip chip"
        onClick={() => void navigator.clipboard.writeText(command).catch((e) => onError(String(e)))}
      >
        Copy command
      </button>
    </div>
  );
}
