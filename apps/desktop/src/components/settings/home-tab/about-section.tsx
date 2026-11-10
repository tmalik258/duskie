"use client";

// Settings > About: version and paths, diagnostics, crash reports and debug tools.

import { api } from "@/lib/bridge";
import { type updateSettings, useDuskie } from "@/lib/store";
import { type AppInfo, MASCOT_STATES } from "@/lib/types";
import { Button, Section, Toggle } from "../ui";
import { CopyDiagnostics } from "./copy-diagnostics";
import { RecentEvents } from "./time-today";

export function AboutSection({
  info,
  save,
  onError,
}: {
  info: AppInfo;
  save: (patch: Parameters<typeof updateSettings>[0]) => void;
  onError: (e: string) => void;
}) {
  const settings = useDuskie((s) => s.settings);
  const mascot = useDuskie((s) => s.mascot);
  return (
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
  );
}
