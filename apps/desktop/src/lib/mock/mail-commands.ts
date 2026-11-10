// Mock mail, notifications and debug commands.

import type { MascotState } from "../types";
import { call, mailStatus, settings } from "./handler";
import { go, later } from "./mock-install-update";

export const mailCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  mail_connect: () => {
    mailStatus.v = {
      state: "connected",
      configured: true,
      lastOk: Math.floor(Date.now() / 1000),
      error: null,
      provider: "gmail",
    };
    return mailStatus.v;
  },
  mail_connect_imap: () => {
    mailStatus.v = {
      state: "connected",
      configured: true,
      lastOk: Math.floor(Date.now() / 1000),
      error: null,
      provider: "imap",
    };
    return mailStatus.v;
  },
  mail_disconnect: () => {
    mailStatus.v = { state: "disconnected", configured: true, lastOk: null, error: null, provider: null };
    return mailStatus.v;
  },
  attention_set_profile: (args) => {
    settings.v = { ...settings.v, notifications: { ...settings.v.notifications, profile: args.profile as never } };
    return null;
  },
  notifications_set_level: (args) => {
    const from = String(args.from);
    const level = String(args.level);
    const apps = { ...settings.v.notifications.apps, [from]: level as never };
    if (level === "auto") delete apps[from];
    settings.v = { ...settings.v, notifications: { ...settings.v.notifications, apps } };
    return `${from}: ${level}`;
  },
  notifications_status: () => {
    const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    const items = settings.v.notifications.enabled
      ? [
          {
            id: 9,
            app: "Chrome",
            title: "Google",
            body: "G-482913 is your verification code",
            ts: ago(2),
            level: "now",
            why: "login code",
            code: "482913",
          },
          {
            id: 8,
            app: "WhatsApp",
            title: "Ali Khan",
            body: "Can you send the invoice today?",
            ts: ago(6),
            level: "soon",
            why: "message",
          },
          {
            id: 7,
            app: "Slack",
            title: "#dev",
            body: "Sara mentioned you: can you review the PR?",
            ts: ago(14),
            level: "soon",
            why: "mention",
          },
          {
            id: 6,
            app: "Chrome",
            title: "Daraz",
            body: "Flash sale: 50% off today only",
            ts: ago(30),
            level: "digest",
            why: "promotion",
          },
          {
            id: 5,
            app: "Windows Update",
            title: "Updates are ready",
            body: "Restart to finish installing",
            ts: ago(55),
            level: "digest",
            why: "update",
          },
        ]
      : [];
    const apps: { app: string; level: string | null; count: number }[] = [];
    for (const it of items) {
      const found = apps.find((a) => a.app === it.app);
      if (found) found.count += 1;
      else apps.push({ app: it.app, level: settings.v.notifications.apps[it.app] ?? null, count: 1 });
    }
    return { readable: settings.v.notifications.enabled, error: null, items, apps };
  },
  actions_recent: () => [],
  reveal_path: () => undefined,
  open_settings: () => call("ask_open", { view: "settings" }),
  debug_set_state: (a) => go(a.state as MascotState),
  debug_emit_event: () => {
    go("noticing");
    later(1200, () => go("idle"));
  },
};

export const folder = (path: string, label: string, repos = 0) => ({ path, label, repos });
