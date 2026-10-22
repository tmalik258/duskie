"use client";

// Part of ai-tab: VoiceSection.

import { useEffect, useState } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";
import { updateSettings, useAssistantName, useDuskie } from "@/lib/store";
import type { VoiceDownload, VoiceSettings } from "@/lib/types";
import { Button, Field, Segmented, Select, TextField, Toggle } from "../ui";
import { VoiceEnroll } from "../voice-enroll";
import { VoiceTest } from "./split-args";

export function VoiceSection({ voice, onError }: { voice: VoiceSettings; onError: (e: string) => void }) {
  const name = useAssistantName();
  const status = useDuskie((s) => s.voiceStatus);
  const [progress, setProgress] = useState<VoiceDownload | null>(null);
  useEffect(() => {
    void api.voiceStatus().then((voiceStatus) => useDuskie.setState({ voiceStatus }));
    const off = listen(EVENTS.voiceDownload, (p) => {
      setProgress(p.finished ? null : p);
      if (p.error) onError(`Voice download: ${p.error}`);
    });
    return () => {
      void off.then((f) => f());
    };
  }, [onError]);
  const set = (patch: Partial<VoiceSettings>) =>
    updateSettings({ voice: { ...voice, ...patch } }).catch((e) => onError(String(e)));
  const missing = status?.missingBytes ?? 0;
  const downloading = status?.downloading || progress !== null;
  const mb = (n: number) => `${Math.round(n / 1_000_000)} MB`;

  return (
    <>
      <Toggle
        label={`Talk to ${name}`}
        hint={voice.wakeWord ? `Say "${name}"` : "Use the mic button or the Talk shortcut"}
        checked={voice.enabled}
        onChange={(enabled) => {
          void set({ enabled });
          if (enabled && missing > 0 && !downloading) api.voiceDownload().catch((e) => onError(String(e)));
        }}
      />
      {missing > 0 && (
        <div className="flex items-center justify-between gap-4 text-[13px]">
          <span className="min-w-0">
            {downloading && progress
              ? `Downloading ${progress.label}: ${mb(progress.done)} of ${mb(progress.total)}`
              : `Speech models are not downloaded yet (${mb(missing)}, once).`}
            {downloading && progress && (
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-(--surface)">
                <span
                  className="block h-full rounded-full bg-(--accent) transition-[width] duration-300"
                  style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
                />
              </span>
            )}
          </span>
          {downloading ? (
            <Button small onClick={() => void api.voiceCancelDownload()}>
              Cancel
            </Button>
          ) : (
            <Button small onClick={() => api.voiceDownload().catch((e) => onError(String(e)))}>
              Download
            </Button>
          )}
        </div>
      )}
      {voice.enabled && missing === 0 && (
        <p className="text-[12px] text-(--muted)">
          {status?.listening
            ? voice.wakeWord
              ? `Listening for "${name}".`
              : "Ready. Use the mic button or the Talk shortcut."
            : "Starting the microphone..."}
        </p>
      )}
      {status?.error && <p className="text-[12px] text-red-400">{status.error}</p>}
      <Toggle
        label="Wake word"
        hint="Off: only the mic button listens"
        checked={voice.wakeWord}
        onChange={(wakeWord) => void set({ wakeWord })}
      />
      {voice.enabled && voice.wakeWord && missing === 0 && (
        <VoiceEnroll name={name} voice={voice} set={(p) => void set(p)} onError={onError} />
      )}
      <div className="flex items-center justify-between gap-4 text-[14px]">
        <div className="min-w-0">
          <p>While you talk</p>
          <p className="text-[12px] text-(--muted)">
            Compact is one slim line with your latest words. Full shows a waveform and your words in larger text. Both
            open Ask when the answer is ready.
          </p>
        </div>
        <Segmented
          label="While you talk"
          value={voice.listeningStyle ?? "compact"}
          options={[
            ["compact", "Compact"],
            ["full", "Full"],
          ]}
          onChange={(listeningStyle) => void set({ listeningStyle })}
        />
      </div>
      <Toggle
        label="Speak replies"
        hint="Also the speaker button next to the mic, Alt S."
        checked={voice.speakAnswers}
        onChange={(speakAnswers) => void set({ speakAnswers })}
      />
      <Toggle
        label="Interrupt by talking"
        hint="Talk over an answer to stop it. Works best with headphones."
        checked={voice.interrupt}
        onChange={(interrupt) => void set({ interrupt })}
      />
      <Field label="Words voice gets wrong" hint="Comma separated. Duskie fixes them as you talk.">
        <TextField
          label="Words voice gets wrong"
          value={voice.fixes ?? ""}
          placeholder="horsepot = hotspot, sidekik = Duskie"
          onCommit={(fixes) => void set({ fixes })}
        />
      </Field>
      <Toggle
        label="Keep the conversation going"
        hint="Listen for your reply after an answer"
        checked={voice.conversation}
        onChange={(conversation) => void set({ conversation })}
      />
      {voice.conversation && (
        <Segmented
          label="End after silence"
          value={String(voice.replyWait ?? 8)}
          options={[
            ["5", "5 s"],
            ["8", "8 s"],
            ["15", "15 s"],
          ]}
          onChange={(v) => void set({ replyWait: Number(v) })}
        />
      )}
      <Toggle
        label="Read suggestions aloud"
        hint='Answer with "open" or "not now"'
        checked={voice.speakSuggestions}
        onChange={(speakSuggestions) => void set({ speakSuggestions })}
      />
      <Toggle
        label="Keep voice answers in history"
        hint="Saved as text in Ask history. Audio is never kept."
        checked={voice.liveHistory ?? true}
        onChange={(liveHistory) => void set({ liveHistory })}
      />
      <Field label="Voice">
        <div className="flex items-center gap-2">
          <Select
            label="Voice"
            value={voice.voice}
            options={(status?.voices ?? []).map((v) => [v.id, v.label])}
            onChange={(v) => void set({ voice: v })}
            menuWidth={240}
          />
          <VoiceTest onError={onError} />
        </div>
      </Field>
      <Field label={`Speed ${voice.speed.toFixed(1)}x`}>
        <input
          type="range"
          min={0.7}
          max={1.5}
          step={0.1}
          value={voice.speed}
          aria-label="Speech speed"
          onChange={(e) => void set({ speed: Number(e.target.value) })}
          className="w-36 accent-(--accent)"
        />
      </Field>
    </>
  );
}
