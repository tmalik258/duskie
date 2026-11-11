// Part of mock: OTHER_APPS, connected, signedInNow, browsersSeen, laterItems, chats, soon, WELCOME_LINES, welcome, speechTimers, speakWelcome, enroll, GB, mockFocusUntil.

import type { WelcomeSpeech } from "../types";
import { emit, settings } from "./handler";

// Apps already connected in the account (as Claude sees them).
export const OTHER_APPS = [
  ["figma", "Figma"],
  ["googledrive", "Google Drive"],
  ["googlesheets", "Google Sheets"],
  ["linkedin", "LinkedIn"],
];

export const connected = new Set(["googlecalendar", "gmail", "slack", "github"]);

export const signedInNow = (how: string) => {
  settings.v = { ...settings.v, composio: { ...settings.v.composio, enabled: true, account: how, userId: "" } };
  emit("settings://changed", settings.v);
  emit("composio://changed", { ok: true, message: "Composio connected with 8 apps" });
};

export const browsersSeen = new Set<string>(["chrome"]);

export const laterItems = {
  v: [
    {
      id: "l1",
      title: "3 new screenshots",
      detail: "Copy text or move them to a folder",
      minutesAgo: 12,
      missed: true,
    },
    { id: "l2", title: "Download finished", detail: "invoice-sept.pdf", minutesAgo: 25, missed: false },
  ],
};

export const chats = new Map<string, { title: string; updated: string; turns: unknown[] }>([
  [
    "c1",
    {
      title: "How do I free port 3000",
      updated: new Date(Date.now() - 3_600_000).toISOString(),
      turns: [
        { role: "user", content: "How do I free port 3000" },
        { role: "assistant", content: "Run `netstat -ano | findstr :3000`, then `taskkill /PID <pid> /F`." },
      ],
    },
  ],
]);

export const soon = () => {
  const d = new Date(Date.now() + 5 * 60_000);
  const hm = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  return {
    title: "Design review",
    start: hm(d),
    end: hm(new Date(d.getTime() + 45 * 60_000)),
    joinUrl: "https://meet.google.com/abc-defg-hij",
    notes: { title: "Design review notes", source: "page", reference: "https://docs.example.com/review" },
  };
};

// The welcome line as Rust would report it while it is spoken.
const WELCOME_LINES = [
  "Hey, I'm Duskie. I live up here with you on this PC. I notice things, I help when you want, and I stay put: nothing leaves this machine, and I wait for your okay.",
  "First, how I think. If you want everything to stay on this PC, you can run a local model, only if your machine is up for it. Or use Claude Code or Codex with the plan you already have. You can use any of them, or all three, and set the order I try.",
  "Now, your world. Connect your calendar, your mail and the tools you use, and I'll start noticing what matters.",
  "A few small helpers make me sharper. Install the ones you want, and I'll wait while they finish.",
  "Welcome aboard. Say Duskie whenever you need me. Do Not Disturb is on so Windows stays quiet and alerts show once up here. Launch on login is already on, so I'm here when you sit down.",
];

export const welcome: { v: WelcomeSpeech } = {
  v: {
    step: 0,
    lines: WELCOME_LINES,
    script: WELCOME_LINES[0],
    pieces: [],
    endsAt: null,
    silent: false,
    pending: false,
  },
};

export const speechTimers: { v: ReturnType<typeof setTimeout>[] } = { v: [] };

/** Like Rust: each step's line as sentences with when they sound. The first
 * one waits 3 s, like the model loading. */
export function speakWelcome(step = 0) {
  for (const t of speechTimers.v) clearTimeout(t);
  speechTimers.v = [];
  const line = WELCOME_LINES[step] ?? WELCOME_LINES[0];
  const sentences = line.match(/[^.!?]+[.!?]/g) ?? [line];
  let at = Date.now() + (step === 0 ? 3000 : 400);
  welcome.v = { ...welcome.v, step, script: line, pieces: [], endsAt: null, pending: true };
  emit("voice://welcome", welcome.v);
  sentences.forEach((raw, i) => {
    const text = raw.trim();
    const ms = text.split(/\s+/).length * 330;
    const startsAt = at;
    at += ms + 280;
    // Pieces arrive a little ahead of when they sound, like synthesis.
    speechTimers.v.push(
      setTimeout(
        () => {
          welcome.v = { ...welcome.v, pieces: [...welcome.v.pieces, { text, startsAt, ms }] };
          if (i === sentences.length - 1) welcome.v = { ...welcome.v, endsAt: startsAt + ms, pending: false };
          emit("voice://welcome", welcome.v);
        },
        Math.max(0, startsAt - Date.now() - 300),
      ),
    );
  });
}

export const enroll: {
  taught: boolean;
  taughtFor: string | null;
  nameTakes: number;
  sentenceTakes: number;
  namesNeeded: number;
  sentences: string[];
  moreSentences: string[];
  samples: number;
  moreTakes: number;
} = {
  taught: false,
  taughtFor: null,
  nameTakes: 0,
  sentenceTakes: 0,
  samples: 0,
  moreTakes: 0,
  namesNeeded: 5,
  sentences: [
    "What is on my calendar this afternoon?",
    "Remind me to call the bank tomorrow morning.",
    "Turn on night light and play some quiet music.",
  ],
  moreSentences: [
    "Read me the first three emails from today.",
    "Set a timer for twenty five minutes.",
    "How is the weather looking for the weekend?",
  ],
};

export const GB = 1024 ** 3;

export const mockFocusUntil: { v: number | null } = { v: null };
