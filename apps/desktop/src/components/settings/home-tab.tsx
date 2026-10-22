"use client";

// Home: setup, today, shortcuts, sound, history and the app
// itself. Everything here is picked or recorded; nothing needs typing.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { updateSettings, useDuskie } from "@/lib/store";
import type { AppInfo } from "@/lib/types";
import { SetupChecklist } from "../setup-checklist";
import { AboutSection } from "./home-tab/about-section";
import {
  CloneRules,
  CodeFolders,
  DaySummaryToggle,
  END_OF_DAY,
  type HomePart,
  LeftElsewhere,
} from "./home-tab/day-summary-skill";
import { NotificationInbox, UpdateRow } from "./home-tab/notification-inbox";
import { SoundSection } from "./home-tab/sound-section";
import { Backup, RecentActions, TimeToday } from "./home-tab/time-today";
import { Field, Section, Select, Toggle } from "./ui";

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
      {on("sounds") && <SoundSection collapsible={!part} save={save} />}
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
      {info && on("updates") && <AboutSection info={info} save={save} onError={onError} />}
    </>
  );
}
