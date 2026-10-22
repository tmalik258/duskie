"use client";

// Part of ai-tab: splitArgs, joinArgs, Ranking, VoiceTest.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import { updateSettings, useDuskie } from "@/lib/store";
import type { AiSettings } from "@/lib/types";
import { Tip } from "../../tip";
import { Button, Field, Select, TextField, Toggle } from "../ui";

/** Splits a command line into arguments, honouring double quotes. */
function splitArgs(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
}

function joinArgs(args: string[]): string {
  return args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
}

export function Ranking({ ai, onError }: { ai: AiSettings; onError: (e: string) => void }) {
  const save = (next: Partial<AiSettings>) =>
    updateSettings({ ai: { ...ai, ...next } }).catch((e: unknown) => onError(String(e)));
  return (
    <>
      <Toggle
        label="Rank suggestion options"
        checked={ai.decisions}
        onChange={(decisions) => void save({ decisions })}
      />
      <Toggle
        label="Use SemIf"
        checked={ai.semif.enabled}
        onChange={(enabled) => void save({ semif: { ...ai.semif, enabled } })}
      />
      {ai.semif.enabled && (
        <>
          <Field label="Command" hint="e.g. wsl.exe -d Ubuntu-22.04 -- /home/me/semif/.venv/bin/semif-score">
            <TextField
              label="Command"
              value={joinArgs(ai.semif.command)}
              mono
              className="w-64"
              onCommit={(line) => save({ semif: { ...ai.semif, command: splitArgs(line) } })}
            />
          </Field>
          <Field label="Backend">
            <Select
              label="Backend"
              value={ai.semif.backend}
              options={[
                ["llamacpp", "llama.cpp (GGUF)"],
                ["torch", "PyTorch"],
                ["mlx", "MLX"],
              ]}
              onChange={(backend) => void save({ semif: { ...ai.semif, backend } })}
            />
          </Field>
          <Field label="Model">
            <TextField
              label="Model"
              value={ai.semif.model}
              mono
              className="w-64"
              onCommit={(model) => save({ semif: { ...ai.semif, model } })}
            />
          </Field>
          {ai.semif.backend === "llamacpp" && (
            <Field label="GGUF file" hint="Path as SemIf sees it">
              <TextField
                label="GGUF file"
                value={ai.semif.gguf}
                mono
                className="w-64"
                onCommit={(gguf) => save({ semif: { ...ai.semif, gguf } })}
              />
            </Field>
          )}
        </>
      )}
    </>
  );
}

/** Speaker → spinner while the voice prepares → stop while audio plays. */
export function VoiceTest({ onError }: { onError: (e: string) => void }) {
  const speaking = useDuskie((s) => s.speaking);
  const [phase, setPhase] = useState<"idle" | "loading" | "playing">("idle");
  const gen = useRef(0);

  useEffect(() => {
    if (phase === "loading" && speaking) setPhase("playing");
  }, [speaking, phase]);

  // Speaker::busy can flicker false between pieces; don't drop Stop for that.
  useEffect(() => {
    if (phase !== "playing" || speaking) return;
    const t = window.setTimeout(() => {
      setPhase((p) => (p === "playing" ? "idle" : p));
    }, 280);
    return () => clearTimeout(t);
  }, [phase, speaking]);

  const label = phase === "loading" ? "Loading voice" : phase === "playing" ? "Stop" : "Test voice";
  const busy = phase !== "idle";

  return (
    <Tip label={label}>
      <Button
        small
        aria-label={label}
        active={busy}
        onClick={() => {
          if (busy) {
            gen.current += 1;
            setPhase("idle");
            void api.voiceStop();
            return;
          }
          const id = ++gen.current;
          setPhase("loading");
          api
            .voiceTest()
            .then(() => {
              // Invoke can finish before the speaking event; keep the spinner
              // until audio starts, or idle if nothing plays.
              window.setTimeout(() => {
                if (gen.current !== id) return;
                setPhase((p) => (p === "loading" ? "idle" : p));
              }, 2000);
            })
            .catch((e) => {
              if (gen.current !== id) return;
              setPhase("idle");
              onError(String(e));
            });
        }}
      >
        {phase === "loading" ? (
          <span
            aria-hidden="true"
            className="block size-3 animate-spin rounded-full border border-current border-r-transparent"
          />
        ) : phase === "playing" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
          </svg>
        )}
      </Button>
    </Tip>
  );
}
