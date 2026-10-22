import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/bridge";
import type { EnrollState, VoiceSettings } from "@/lib/types";
import { Button, Toggle } from "./ui";

/** Teach Duskie your voice: say its name a few times, read three short
 * sentences. Takes stay in memory; only the learned numbers are kept.
 * "Add samples" reads the sentences again to sharpen a taught voice. */
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
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<"recording" | "learning" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Leaving Settings mid-teach drops the takes, which turns the wake word
  // listener back on.
  const activeRef = useRef(false);
  activeRef.current = active;
  useEffect(
    () => () => {
      if (activeRef.current) api.voiceEnrollCancel().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    api
      .voiceEnrollState()
      .then(setState)
      .catch(() => undefined);
  }, []);

  if (!state) return null;
  const namesLeft = !adding && state.nameTakes < state.namesNeeded;
  const sentence = namesLeft ? null : adding ? state.moreTakes : state.sentenceTakes;
  const done = adding
    ? state.moreTakes >= state.sentences.length
    : !namesLeft && state.sentenceTakes >= state.sentences.length;
  const total = adding ? state.sentences.length : state.namesNeeded + state.sentences.length;
  const step = adding ? state.moreTakes : state.nameTakes + state.sentenceTakes;

  const record = () => {
    setBusy("recording");
    setNote(null);
    api
      .voiceEnrollRecord(sentence ?? undefined, adding)
      .then((s) => {
        setState(s);
        const finished = adding
          ? s.moreTakes >= s.sentences.length
          : !(s.nameTakes < s.namesNeeded) && s.sentenceTakes >= s.sentences.length;
        if (finished) learn();
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
      .voiceEnrollFinish(adding)
      .then((s) => {
        setState(s);
        setActive(false);
      })
      .catch((e) => onError(`Teaching your voice: ${e}`))
      .finally(() => setBusy(null));
  };
  const start = (more: boolean) => {
    setAdding(more);
    setNote(null);
    setActive(true);
    api.voiceEnrollOpen().catch(() => undefined);
  };
  // Cancel keeps the taught voice; only the takes in progress go.
  const stop = () => {
    setActive(false);
    setNote(null);
    api
      .voiceEnrollCancel()
      .then(setState)
      .catch(() => undefined);
  };
  const forget = () => {
    set({ onlyMe: false });
    setActive(false);
    setNote(null);
    api
      .voiceEnrollReset()
      .then(setState)
      .catch(() => undefined);
  };

  // Taught under another name: the wake word is not tuned for this one yet.
  const renamed = state.taught && !!state.taughtFor && state.taughtFor.toLowerCase() !== name.toLowerCase();

  if (!active) {
    return (
      <>
        <div className="flex items-center justify-between gap-4 text-[14px]">
          <div className="min-w-0">
            <p>Teach {name} your voice</p>
            <p className={`text-[12px] ${renamed ? "text-amber-300" : "text-(--muted)"}`}>
              {renamed
                ? `Learned for "${state.taughtFor}". Teach it "${name}" so it hears the new name.`
                : state.taught
                  ? `Done. ${name} knows how you say its name. Trained on ${state.samples} ${state.samples === 1 ? "sample" : "samples"}.`
                  : `Say "${name}" a few times and read three short lines. About a minute. Recordings are never kept.`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {state.taught && (
              <Button small onClick={forget}>
                Forget
              </Button>
            )}
            {state.taught && !renamed && (
              <Button small onClick={() => start(true)}>
                Add samples
              </Button>
            )}
            <Button small primary={!state.taught || renamed} onClick={() => start(false)}>
              {state.taught && !renamed ? "Teach again" : "Start"}
            </Button>
          </div>
        </div>
        {state.taught && !renamed && (
          <Toggle
            label="Only answer my voice"
            hint="Questions in other voices are dropped. Turn off if it misses you."
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
          {adding ? "Adding samples" : "Teaching"} · Step {Math.min(step + 1, total)} of {total}
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
              : `Read: "${(adding ? state.moreSentences : state.sentences)[sentence]}"`}
      </p>
      <p className="mt-1 text-[12px] text-(--muted)">
        {busy === "recording"
          ? "Listening..."
          : busy === "learning"
            ? "This takes a few seconds. The recordings are deleted after."
            : (note ??
              (sentence === null
                ? "Your normal voice, like you would call it."
                : adding
                  ? "Try a new spot, mic or a softer voice. It helps most."
                  : "At your usual pace."))}
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
