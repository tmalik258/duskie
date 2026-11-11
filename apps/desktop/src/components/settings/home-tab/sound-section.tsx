"use client";

// Settings > Sound: the kit, mute, master volume and each cue with a test.

import { playCue } from "@/lib/sound";
import { cueVolume, SYNTH_KIT } from "@/lib/sound/snd-sound";
import { type updateSettings, useDuskie } from "@/lib/store";
import { CUES } from "@/lib/types";
import { Button, Field, Section, Select, Slider, Toggle } from "../ui";
import { KitStatus, SOUND_KITS } from "./day-summary-skill";

export function SoundSection({
  collapsible,
  save,
}: {
  collapsible: boolean;
  save: (patch: Parameters<typeof updateSettings>[0]) => void;
}) {
  const settings = useDuskie((s) => s.settings);
  return (
    <Section
      collapsible={collapsible}
      summary={settings.muted ? "Muted" : "On"}
      title="Sound"
      hint={
        settings.soundKit === SYNTH_KIT
          ? "Soft sounds made by Duskie itself."
          : "Sounds by SND (snd.dev), designed by Dentsu Inc. and Starryworks Inc."
      }
      keywords="volume mute audio cue kit voice"
    >
      <Field label="Sounds">
        <Select
          label="Sounds"
          value={settings.soundKit}
          options={SOUND_KITS}
          onChange={(soundKit) => save({ soundKit })}
        />
      </Field>
      <KitStatus kit={settings.soundKit} />
      <Toggle label="Mute all sounds" checked={settings.muted} onChange={(muted) => save({ muted })} />
      <Slider label="Master volume" value={settings.masterVolume} onChange={(masterVolume) => save({ masterVolume })} />
      <details className="text-[13px]">
        <summary className="cursor-pointer text-(--muted)">Each sound</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CUES.map((cue) => (
            <div key={cue} className="flex items-center gap-2">
              <Slider
                label={cue}
                value={settings.cueVolumes[cue] ?? 1}
                onChange={(v) => save({ cueVolumes: { ...settings.cueVolumes, [cue]: v } })}
              />
              <Button small onClick={() => playCue(cue, cueVolume(settings, cue), settings.soundKit)}>
                Test
              </Button>
            </div>
          ))}
        </div>
      </details>
    </Section>
  );
}
