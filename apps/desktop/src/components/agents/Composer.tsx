"use client";

// The message box under a session: slash commands, @files, the mode and
// model chips, and the queue.

import { Fragment, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type AgentCommand, commandCatalog } from "@/lib/agent-commands";
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
import { setOverlayHit } from "@/lib/store";
import type { AgentMode } from "@/lib/types";
import { scrollIfActive } from "../ask/parts";
import { ChatControls, ModeChip } from "./Controls";
import { nextAgentMode } from "./modes";

type Slash = AgentCommand;

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
  const [commands, setCommands] = useState<Slash[]>(commandCatalog(s.agent, []));
  const [panel, setPanel] = useState<{ name: string; at: number }>();
  const [notice, setNotice] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [float, setFloat] = useState<{ left: number; bottom: number; maxWidth: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    void api
      .agentCommands(s.id)
      .then((cmds) => setCommands(commandCatalog(s.agent, cmds)))
      .catch(() => setCommands(commandCatalog(s.agent, [])));
  }, [s.id, s.agent]);
  const slash = text.startsWith("/") && !text.includes(" ");
  const mention = /(^|\s)@([^\s@]*)$/.exec(text);
  const query = mention?.[2] ?? null;
  useEffect(() => {
    if (query === null) {
      setFiles([]);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      void api
        .agentFiles(s.id, query)
        .then((f) => live && setFiles(f))
        .catch(() => undefined);
    }, 80);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [query, s.id]);
  const shownCommands = slash ? commands.filter((c) => c.name.startsWith(text.toLowerCase())) : [];
  const count = slash ? shownCommands.length : query !== null ? files.length : 0;
  const at = Math.min(sel, Math.max(count - 1, 0));
  const placePop = () => {
    const el = wrapRef.current;
    if (!el || count === 0) {
      setFloat(null);
      setOverlayHit(null);
      return;
    }
    const r = el.getBoundingClientRect();
    // Cap at the composer / viewport; actual width comes from content.
    const maxWidth = Math.max(200, Math.min(r.width, window.innerWidth - 16));
    const left = Math.min(Math.max(8, r.left), window.innerWidth - maxWidth - 8);
    const bottom = window.innerHeight - r.top + 6;
    const want = Math.min(200, 28 + count * 36);
    setFloat((prev) =>
      prev && prev.left === left && prev.bottom === bottom && prev.maxWidth === maxWidth
        ? prev
        : { left, bottom, maxWidth },
    );
    // Estimate until the pop mounts and the next effect measures it.
    setOverlayHit({
      x: left,
      y: Math.max(8, r.top - 6 - want),
      width: maxWidth,
      height: want + 8,
    });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-place when the typed text or the list changes
  useLayoutEffect(() => {
    placePop();
    if (count === 0) return;
    // Composer sits outside the timeline scroller; only the viewport size
    // moves it. Listening to scroll re-placed the pop on every wheel tick
    // inside the menu and fought the list.
    window.addEventListener("resize", placePop);
    return () => {
      window.removeEventListener("resize", placePop);
      setOverlayHit(null);
    };
  }, [count, slash, query, text]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the list length changes
  useLayoutEffect(() => {
    if (!float || !popRef.current) return;
    const r = popRef.current.getBoundingClientRect();
    const hit = { x: r.left, y: r.top, width: r.width, height: r.height };
    setOverlayHit(hit);
  }, [float, count]);
  const runCommand = (c: Slash, args = "") => {
    setText("");
    setNotice(null);
    if (c.execution === "terminal") {
      setTerminal(`${c.name}${args ? ` ${args}` : ""}`);
      return;
    }
    if (c.execution === "provider") {
      sendToSession(s.id, `${c.name}${args ? ` ${args}` : ""}`);
      return;
    }
    const mode = c.name.slice(1) as AgentMode;
    if (["plan", "ask", "edit", "debug", "full"].includes(mode)) {
      void setSessionMode(s.id, mode);
      return;
    }
    const fail = (e: unknown) => setNotice(String(e));
    switch (c.name) {
      case "/clear":
        onClear();
        break;
      case "/new":
        useAgents.setState({ current: null });
        break;
      case "/rewind":
        onRewind();
        break;
      case "/diff":
        onReview();
        break;
      case "/permissions":
        if (["plan", "ask", "edit", "debug", "full"].includes(args)) void setSessionMode(s.id, args as AgentMode);
        else
          setNotice(
            `Selected: ${s.mode}. Use the mode buttons above or Ctrl+. to cycle. Codex Edit allows workspace commands and asks for escalation; Full disables the sandbox.`,
          );
        break;
      case "/model":
        if (args) tuneSession(s.id, args === "default" ? null : args, s.effort ?? null);
        else setPanel({ name: "model", at: Date.now() });
        break;
      case "/effort":
        if (args && ["off", "low", "medium", "high", "max", "xhigh", "default"].includes(args))
          tuneSession(s.id, s.model ?? null, args === "default" ? null : args);
        else if (args) setNotice("Unsupported effort. Choose off, low, medium, high, max, or default.");
        else setPanel({ name: "effort", at: Date.now() });
        break;
      case "/usage":
        setPanel({ name: "usage", at: Date.now() });
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
        if (working) {
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
  };
  const submit = () => {
    const match = /^\/(\S+)(?:\s+(.*))?$/.exec(text.trim());
    if (!match) {
      onSend();
      return;
    }
    const command = commands.find((c) => c.name === `/${match[1].toLowerCase()}`);
    if (command) runCommand(command, match[2] ?? "");
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
        if (c) runCommand(c);
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
  let lastGroup = "";
  const pop =
    count > 0 && float
      ? createPortal(
          <div
            ref={popRef}
            className="ak-pop ak-pop-float ak-in"
            role="listbox"
            aria-label={slash ? "Commands" : "Files"}
            style={{
              position: "fixed",
              left: float.left,
              bottom: float.bottom,
              width: "max-content",
              maxWidth: float.maxWidth,
              zIndex: 100,
            }}
          >
            {slash ? (
              shownCommands.map((c, i) => {
                const head = c.group !== lastGroup;
                lastGroup = c.group;
                return (
                  <Fragment key={c.name}>
                    {head && <p className="g">{c.group}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === at}
                      data-sel={i === at}
                      ref={scrollIfActive(i === at)}
                      onMouseMove={() => setSel(i)}
                      onClick={() => runCommand(c)}
                      className="it"
                    >
                      <span className="c mono">{c.name}</span>
                      <span className="d">{c.description}</span>
                    </button>
                  </Fragment>
                );
              })
            ) : (
              <>
                <p className="g">Files in {s.project}</p>
                {files.map((f, i) => (
                  <button
                    key={f}
                    type="button"
                    role="option"
                    aria-selected={i === at}
                    data-sel={i === at}
                    ref={scrollIfActive(i === at)}
                    onMouseMove={() => setSel(i)}
                    onClick={() => pickFile(f)}
                    className="it"
                  >
                    <span className="c mono">{f.split("/").pop()}</span>
                    <span className="d">{f.split("/").slice(0, -1).join("/")}</span>
                  </button>
                ))}
              </>
            )}
          </div>,
          document.body,
        )
      : null;
  return (
    <>
      {pop}
      {notice && (
        <p role="status" className="ak-note">
          {notice}
        </p>
      )}
      {terminal && (
        <div className="ak-chips">
          <span className="ak-note">
            Terminal only: <code className="mono">{terminal}</code>
          </span>
          <button
            type="button"
            className="ak-chip chip"
            onClick={() => void api.agentTerminal(s.id).catch((e) => setNotice(String(e)))}
          >
            Open in terminal
          </button>
          <button
            type="button"
            className="ak-chip chip"
            onClick={() => void navigator.clipboard.writeText(terminal).catch((e) => setNotice(String(e)))}
          >
            Copy command
          </button>
        </div>
      )}
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
              ? () => runCommand({ name: "/compact", description: "", group: "Duskie", execution: "control" })
              : undefined
          }
          keys={working ? "Esc interrupt" : "Enter send"}
        />
      </div>
    </>
  );
}
