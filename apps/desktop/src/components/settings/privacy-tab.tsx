"use client";

// Privacy and data: pause, what Duskie notices, what it ignores, and what
// it can search. Apps and folders are picked from what is on this PC.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { updateSettings, useDuskie } from "@/lib/store";
import { isPaused, SENSOR_IDS } from "@/lib/types";
import { Capabilities, PauseStatus, SearchSettings } from "./privacy-tab/pause-status";
import { appName, Button, ChipList, Section, Toggle } from "./ui";

export function PrivacyTab({ onError }: { onError: (e: string) => void }) {
  const settings = useDuskie((s) => s.settings);
  const save = (patch: Parameters<typeof updateSettings>[0]) =>
    updateSettings(patch).catch((e: unknown) => onError(String(e)));
  const run = (p: Promise<unknown>) => void p.catch((e: unknown) => onError(String(e)));
  const [apps, setApps] = useState<string[]>([]);
  useEffect(() => {
    void api
      .runningApps()
      .then(setApps)
      .catch(() => setApps([]));
  }, []);

  return (
    <>
      <Section title="Pause" keywords="stop privacy break">
        <PauseStatus pause={settings.pause} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run(api.sensorsPause(15))}>15 min</Button>
          <Button onClick={() => run(api.sensorsPause(60))}>1 hour</Button>
          <Button onClick={() => run(api.sensorsPause(null))}>Until I resume</Button>
          {isPaused(settings.pause) && (
            <Button primary onClick={() => run(api.sensorsResume())}>
              Resume
            </Button>
          )}
        </div>
      </Section>
      <Section
        title="Ignored apps and sites"
        hint="Nothing from these is seen or kept."
        keywords="deny block private password manager bank"
      >
        <p className="text-[13px] font-medium">Apps</p>
        <ChipList
          label="Ignored apps"
          items={settings.denyApps}
          suggestions={apps}
          placeholder="Pick a running app or type its name"
          format={appName}
          onChange={(denyApps) => void save({ denyApps })}
        />
        <p className="mt-1 text-[13px] font-medium">Sites</p>
        <ChipList
          label="Ignored sites"
          items={settings.denySites}
          suggestions={[]}
          placeholder="mybank.com"
          onChange={(denySites) => void save({ denySites })}
        />
      </Section>
      <Section
        title="Search"
        hint="Files here are searchable from Ask. Stays on this PC."
        keywords="index folders notes documents semantic meaning embedding"
      >
        <SearchSettings onError={onError} />
      </Section>
      <Section collapsible summary="Switch each one on or off" title="What Duskie notices" keywords="sensors">
        {SENSOR_IDS.map(({ id, label, hint }) => (
          <Toggle
            key={id}
            label={label}
            hint={hint}
            checked={settings.sensors[id] ?? true}
            onChange={(on) => void save({ sensors: { ...settings.sensors, [id]: on } })}
          />
        ))}
      </Section>
      <Section
        collapsible
        summary="Tools skills can use"
        title="Found on this PC"
        keywords="capabilities tools ffmpeg rescan learned choices"
      >
        <Capabilities onError={onError} />
      </Section>
    </>
  );
}
