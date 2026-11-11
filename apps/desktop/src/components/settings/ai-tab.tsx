"use client";

// AI: provider order, explicit model choices, local model discovery, SemIf, and voice.

import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { updateSettings, useDuskie } from "@/lib/store";
import { Providers } from "./ai-tab/providers";
import { Ranking } from "./ai-tab/split-args";
import { VoiceSection } from "./ai-tab/voice-section";
import { Section, Toggle } from "./ui";

export function AiTab({ onError, part }: { onError: (e: string) => void; part?: "models" | "voice" }) {
  const on = (p: "models" | "voice") => !part || part === p;
  const ai = useDuskie((s) => s.settings.ai);
  const voice = useDuskie((s) => s.settings.voice);
  const { data: gpu } = useCached<number | null>("gpu-memory", api.gpuMemory);
  return (
    <>
      {on("models") && gpu !== undefined && gpu !== null && gpu < 4096 && (
        <p className="text-[13px] text-(--muted)" role="note">
          This PC has no graphics card with about 4 GB of memory, so local chat and Live mode use a cloud provider. Add
          a key below or sign in to Claude Code.
        </p>
      )}
      {on("models") && (
        <Section
          title="Models"
          hint="Ask tries them top to bottom. Drag to reorder."
          keywords="ai claude codex ollama anthropic local model provider order qwen hooks mcp coding agent"
        >
          <Providers ai={ai} onError={onError} />
        </Section>
      )}
      {on("models") && (
        <Section
          title="Privacy"
          hint="Chats on this PC only use Ollama and are never handed to Claude Code, Codex or the web."
          keywords="private local only ollama offline this pc lock cloud"
        >
          <Toggle
            label="New chats on this PC only"
            hint="Each chat can still turn it off with the lock in Ask (Alt P)."
            checked={ai.localOnly}
            onChange={(localOnly) =>
              void updateSettings({ ai: { ...ai, localOnly } }).catch((e: unknown) => onError(String(e)))
            }
          />
        </Section>
      )}
      {on("voice") && (
        <Section
          title="Voice"
          hint="Runs on this PC. Audio is never saved or sent."
          keywords="microphone speak talk wake word hey duskie supertonic conversation"
        >
          <VoiceSection voice={voice} onError={onError} />
        </Section>
      )}
      {on("models") && (
        <Section
          collapsible
          summary={ai.decisions ? "Best option first" : "Off"}
          title="Ranking"
          keywords="semif decisions t1 order options"
        >
          <Ranking ai={ai} onError={onError} />
        </Section>
      )}
    </>
  );
}
