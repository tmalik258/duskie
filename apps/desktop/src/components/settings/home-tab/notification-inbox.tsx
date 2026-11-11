"use client";

// Part of home-tab: NotificationInbox, UpdateRow, ISSUES.

import { useCallback, useEffect, useState } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";
import { installUpdate, updateSettings, useDuskie } from "@/lib/store";
import type { InboxStatus, NotifyLevel } from "@/lib/types";
import { updateBusy } from "@/lib/updates";
import { UpdateProgress } from "../../update-progress";
import { LearnedList, NotificationProfile } from "../learned-list";
import { Button, ChipList, Field, Select, Toggle } from "../ui";
import { DoNotDisturb, LEVEL_TONE, LEVELS } from "./time-today";

/** Read Windows notifications and only bring up what matters. */
export function NotificationInbox({ onError }: { onError: (e: string) => void }) {
  const notifications = useDuskie((s) => s.settings.notifications);
  const [status, setStatus] = useState<InboxStatus | null>(null);
  const refresh = useCallback(() => void api.notificationsStatus().then(setStatus), []);
  useEffect(() => {
    refresh();
    if (!notifications.enabled) return;
    // Refreshed when a notification arrives, not on a timer.
    const off = listen(EVENTS.inboxChanged, refresh);
    return () => void off.then((f) => f());
  }, [refresh, notifications.enabled]);
  const save = (patch: Partial<typeof notifications>) =>
    void updateSettings({ notifications: { ...notifications, ...patch } })
      .then(refresh)
      .catch((e) => onError(String(e)));
  const today = (status?.items ?? []).filter((i) => new Date(i.ts).toDateString() === new Date().toDateString());
  const important = today.filter((i) => i.level === "now" || i.level === "soon").length;

  return (
    <>
      <DoNotDisturb onError={onError} />
      <Toggle
        label="Sort my notifications"
        hint={
          !notifications.enabled
            ? "Codes, VIPs and urgent ones come up at once. Messages wait for a quiet moment. The rest goes to a digest."
            : status && !status.readable
              ? (status.error ?? "Could not read notifications yet.")
              : `${today.length} today, ${important} worth a look`
        }
        checked={notifications.enabled}
        onChange={(enabled) => save({ enabled })}
      />
      {notifications.enabled && (
        <>
          <p className="text-[13px] font-medium">
            Always come through <span className="font-normal text-(--muted)">people, by name</span>
          </p>
          <ChipList
            label="Always come through"
            items={notifications.vip}
            suggestions={[]}
            placeholder="Add a name, e.g. Ali"
            format={(v) => v.replace(/\b\w/g, (c) => c.toUpperCase())}
            onChange={(vip) => save({ vip })}
          />
          <NotificationProfile onError={onError} />
          <LearnedList onError={onError} />
          {status && status.apps.length > 0 && (
            <div className="flex flex-col gap-2">
              {status.apps.map((a) => (
                <Field key={a.app} label={a.app} hint={a.count ? `${a.count} recently` : undefined}>
                  <Select
                    label={`${a.app} notifications`}
                    value={a.level ?? "auto"}
                    options={LEVELS}
                    onChange={(level) =>
                      void api
                        .notificationsSetLevel(a.app, level as NotifyLevel | "auto")
                        .then(refresh)
                        .catch((e) => onError(String(e)))
                    }
                  />
                </Field>
              ))}
            </div>
          )}
          {today.length > 0 && (
            <details className="text-[12.5px]">
              <summary className="cursor-pointer text-(--muted)">Latest</summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {today.slice(0, 8).map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${LEVEL_TONE[i.level]}`}>
                      {i.level}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">
                        {i.app}
                        {i.phone ? " (phone)" : ""}
                      </span>{" "}
                      {i.title}: <span className="text-(--muted)">{i.body}</span>
                      {(i.also?.length ?? 0) > 0 && (
                        <span className="text-(--muted)"> (also via {i.also?.join(", ")})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  );
}

/** This version, and a newer one when it is out: Install, or Check now. */
export function UpdateRow({ version, onError }: { version: string; onError: (e: string) => void }) {
  const update = useDuskie((s) => s.update);
  const progress = useDuskie((s) => s.updateProgress);
  const busy = updateBusy(progress);
  const [state, setState] = useState<"idle" | "checking" | "latest">("idle");
  const check = () => {
    setState("checking");
    api.updateCheck().then(
      (found) => setState(found ? "idle" : "latest"),
      (e) => {
        setState("idle");
        onError(String(e));
      },
    );
  };
  const install = () => {
    void installUpdate().catch((e) => onError(String(e)));
  };
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <div className="min-w-0 flex-1">
        <span className="block text-(--text)">
          {update ? `Duskie ${update.version} is available` : `Duskie ${version}`}
        </span>
        {progress ? (
          <div className="mt-2">
            <UpdateProgress progress={progress} />
          </div>
        ) : (
          <span className="block text-(--muted)">
            {update
              ? `You have ${update.current}. It downloads, checks and opens the installer.`
              : state === "latest"
                ? "You have the newest version."
                : "Checks once a day while the switch above is on."}
          </span>
        )}
      </div>
      {update || progress ? (
        <Button small onClick={install} disabled={busy}>
          {busy ? "Updating..." : progress?.phase === "failed" ? "Retry" : "Install"}
        </Button>
      ) : (
        <Button small onClick={check} disabled={state === "checking"}>
          {state === "checking" ? "Checking..." : "Check now"}
        </Button>
      )}
    </div>
  );
}

/** Version, models, timings and the end of the log, with secrets and your
 * name taken out, copied for a bug report. */
export const ISSUES = "https://github.com/tmalik258/duskie/issues/new";
