import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import type { EnrollState, VoiceSettings } from "@/lib/types";
import { Button, Toggle } from "./ui";

/** Teach Duskie your voice: say its name a few times, read three short
 * sentences. Takes stay in memory; only the learned numbers are kept. */
export function VoiceEnroll({
  name,
  voice,
  set,
  onError,
}: {
  name: string;
  voice: VoiceSettings;
  set: (patch: Partial<VoiceSettings>) => void;
  onError: (e: string) => void;
}) {
  const [state, setState] = useState<EnrollState | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState<"recording" | "learning" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api
      .voiceEnrollState()
      .then(setState)
      .catch(() => undefined);
  }, []);

  if (!state) return null;
  const namesLeft = state.nameTakes < state.namesNeeded;
  const sentence = namesLeft ? null : state.sentenceTakes;
  const done = !namesLeft && state.sentenceTakes >= state.sentences.length;
  const total = state.namesNeeded + state.sentences.length;
  const step = state.nameTakes + state.sentenceTakes;

  const record = () => {
    setBusy("recording");
    setNote(null);
    api
      .voiceEnrollRecord(sentence ?? undefined)
      .then((s) => {
        setState(s);
        if (!(s.nameTakes < s.namesNeeded) && s.sentenceTakes >= s.sentences.length) learn();
        else setBusy(null);
      })
      .catch((e) => {
        setNote(String(e));
        setBusy(null);
      });
  };
  const learn = () => {
    setBusy("learning");
    api
      .voiceEnrollFinish()
      .then((s) => {
        setState(s);
        setActive(false);
      })
      .catch((e) => onError(`Teaching your voice: ${e}`))
      .finally(() => setBusy(null));
  };
  const stop = () => {
    setActive(false);
    setNote(null);
    api
      .voiceEnrollReset()
      .then(setState)
      .catch(() => undefined);
  };

  if (!active) {
    return (
      <>
        <div className="flex items-center justify-between gap-4 text-[14px]">
          <div className="min-w-0">
            <p>Teach {name} your voice</p>
            <p className="text-[12px] text-(--muted)">
              {state.taught
                ? `Done. ${name} knows how you say its name.`
                : `Say "${name}" a few times and read three short lines. About a minute. Recordings are never kept.`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {state.taught && (
              <Button
                small
                onClick={() => {
                  set({ onlyMe: false });
                  stop();
                }}
              >
                Forget
              </Button>
            )}
            <Button small primary={!state.taught} onClick={() => setActive(true)}>
              {state.taught ? "Teach again" : "Start"}
            </Button>
          </div>
        </div>
        {state.taught && (
          <Toggle
            label="Only my voice wakes it"
            hint="Others saying the name are ignored. Turn off if it misses you."
            checked={voice.onlyMe ?? false}
            onChange={(onlyMe) => set({ onlyMe })}
          />
        )}
      </>
    );
  }

  return (
    <div className="ve rounded-xl bg-(--surface) p-3 text-[14px]" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-(--muted)">
          Step {Math.min(step + 1, total)} of {total}
        </p>
        <div className="ve-dots" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed list of steps
            <span key={i} className={i < step ? "on" : i === step ? "now" : ""} />
          ))}
        </div>
      </div>
      <p className="mt-2 text-[15px]">
        {busy === "learning"
          ? "Learning your voice..."
          : done
            ? "All set."
            : sentence === null
              ? `Say "${name}"`
              : `Read: "${state.sentences[sentence]}"`}
      </p>
      <p className="mt-1 text-[12px] text-(--muted)">
        {busy === "recording"
          ? "Listening..."
          : busy === "learning"
            ? "This takes a few seconds. The recordings are deleted after."
            : (note ?? (sentence === null ? "Your normal voice, like you would call it." : "At your usual pace."))}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button small onClick={stop} disabled={busy === "learning"}>
          Cancel
        </Button>
        <Button small primary onClick={record} disabled={busy !== null || done}>
          {busy === "recording" ? "Listening" : "Record"}
        </Button>
      </div>
    </div>
  );
}
