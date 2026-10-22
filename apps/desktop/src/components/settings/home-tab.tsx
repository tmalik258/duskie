"use client";

// Home: setup, today, shortcuts, sound, history and the app
// itself. Everything here is picked or recorded; nothing needs typing.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { playCue } from "@/lib/sound";
import { cueVolume, SYNTH_KIT } from "@/lib/sound/snd-sound";
import { updateSettings, useDuskie } from "@/lib/store";
import { type AppInfo, CUES, MASCOT_STATES } from "@/lib/types";
import { SetupChecklist } from "../setup-checklist";
import { CopyDiagnostics } from "./home-tab/copy-diagnostics";
import {
  CloneRules,
  CodeFolders,
  DaySummaryToggle,
  END_OF_DAY,
  type HomePart,
  KitStatus,
  LeftElsewhere,
  SOUND_KITS,
} from "./home-tab/day-summary-skill";
import { NotificationInbox, UpdateRow } from "./home-tab/notification-inbox";
import { Backup, RecentActions, RecentEvents, TimeToday } from "./home-tab/time-today";
import { Button, Field, Section, Select, Slider, Toggle } from "./ui";

export function HomeTab({
  onError,
  onOpenTab,
  part,
}: {
  onError: (e: string) => void;
  onOpenTab: (tab: string) => void;
  /** One sidebar section; all of them when searching. */
  part?: HomePart;
}) {
  const on = (p: HomePart) => !part || part === p;
  const settings = useDuskie((s) => s.settings);
  const mascot = useDuskie((s) => s.mascot);
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    void api.appInfo().then(setInfo);
  }, []);
  const save = (patch: Parameters<typeof updateSettings>[0]) =>
    void updateSettings(patch).catch((e) => onError(String(e)));

  return (
    <>
      {on("general") && (
        <Section title="Startup" keywords="launch login windows start">
          <Toggle
            label="Launch on login"
            checked={settings.launchAtLogin}
            onChange={(launchAtLogin) => save({ launchAtLogin })}
          />
        </Section>
      )}
      {on("setup") && (
        <Section title="Setup" keywords="install checklist get started tools">
          <LeftElsewhere onOpenTab={onOpenTab} />
          <SetupChecklist groups={["tools"]} onOpenTab={onOpenTab} />
        </Section>
      )}
      {on("notifications") && (
        <Section
          title="Notifications"
          hint="Windows stays quiet. Only what matters comes up on the island."
          keywords="notifications inbox do not disturb silence important digest vip whatsapp slack"
        >
          <NotificationInbox onError={onError} />
        </Section>
      )}
      {on("general") && (
        <Section title="Your day" keywords="end of day summary evening hours">
          <DaySummaryToggle onError={onError} />
          <Field label="My day ends at">
            <Select
              label="My day ends at"
              value={String(settings.endOfDayHour)}
              options={END_OF_DAY}
              onChange={(v) => save({ endOfDayHour: Number(v) })}
            />
          </Field>
        </Section>
      )}
      {on("general") && (
        <Section title="Today" keywords="time tracking hours apps">
          <TimeToday />
        </Section>
      )}
      {on("code") && (
        <Section
          collapsible={!part}
          summary="Folders where your projects live"
          title="Your code"
          keywords="code folders repos git projects end of day wsl"
        >
          <CodeFolders chosen={settings.codeFolders} onChange={(codeFolders) => save({ codeFolders })} />
          <CloneRules rules={settings.cloneRules ?? {}} onChange={(cloneRules) => save({ cloneRules })} />
        </Section>
      )}
      {on("updates") && (
        <Section title="Updates" keywords="update version new release">
          <Toggle
            label="Tell me about new versions"
            checked={settings.checkUpdates}
            onChange={(checkUpdates) => save({ checkUpdates })}
          />
          <UpdateRow version={info?.version ?? ""} onError={onError} />
        </Section>
      )}
      {on("sounds") && (
        <Section
          collapsible={!part}
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
          <Slider
            label="Master volume"
            value={settings.masterVolume}
            onChange={(masterVolume) => save({ masterVolume })}
          />
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
      )}
      {on("general") && (
        <Section collapsible summary="What Duskie did, with Undo" title="History" keywords="undo actions recent">
          <RecentActions onError={onError} />
        </Section>
      )}
      {on("general") && (
        <Section collapsible summary="Export or restore your settings" title="Backup" keywords="export import restore">
          <Backup onError={onError} />
        </Section>
      )}
      {info && on("updates") && (
        <Section collapsible summary={info.version} title="About" keywords="version database path">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-(--muted)">Version</dt>
            <dd>{info.version}</dd>
            <dt className="text-(--muted)">Database</dt>
            <dd className="font-mono text-xs break-all">{info.dbPath}</dd>
            <dt className="text-(--muted)">Settings</dt>
            <dd className="font-mono text-xs break-all">{info.settingsPath}</dd>
            <dt className="text-(--muted)">Stored events</dt>
            <dd>{info.eventCount}</dd>
          </dl>
          <CopyDiagnostics onError={onError} />
          <Toggle
            label="Offer to report crashes"
            hint="After a crash, Duskie shows the report and lets you send it. It holds the version, Windows version and the error, never your files or chats."
            checked={settings.crashReports}
            onChange={(crashReports) => save({ crashReports })}
          />
          <details className="text-[13px]">
            <summary className="cursor-pointer text-(--muted)">Debug tools</summary>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {MASCOT_STATES.map((s) => (
                  <Button key={s} small active={s === mascot} onClick={() => void api.debugSetState(s)}>
                    {s}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button small onClick={() => void api.debugEmitEvent()}>
                  Emit test event
                </Button>
              </div>
              <RecentEvents />
            </div>
          </details>
        </Section>
      )}
    </>
  );
}
