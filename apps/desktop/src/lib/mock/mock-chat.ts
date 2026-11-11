// Part of mock: mockChat, mockChanges, pendingAgentAnswer, welcomeDeferred, welcomeSpoken, voiceStatus, COMPOSIO_APPS.

import { call, emit, previewFlag, settings } from "./handler";
import { later } from "./mock-install-update";

// A fake streamed answer, so Ask mode can be developed in a browser.
export function mockChat(a: Record<string, unknown>) {
  const id = a.id as string;
  const messages = a.messages as { content: string }[];
  const last = messages[messages.length - 1]?.content ?? "";
  const formatted = /plan|compare|steps/i.test(last);
  const answer: string = formatted
    ? "Here is the plan for **Friday**:\n\n1. Send the invoice to **Ali** by 10:00\n2. Review the *Upwork* proposal\n3. Book the dentist\n\nCosts so far:\n\n| Item | Amount |\n| --- | --- |\n| Hosting | **$24** |\n| Domain | $12 |\n\n- Invoice is in [invoice-sept.pdf](C:\\Users\\you\\Downloads\\invoice-sept.pdf)\n- Notes are in [Projects](C:\\Users\\you\\Projects\\)\nOPTION: Draft the email to Ali"
    : /sidekick/i.test(last)
      ? "Found it: [Duskie's app folder](/C:/Users/you/AppData/Roaming/app.duskie.desktop), changed today. Its settings are in [settings.json](C:\\Users\\you\\AppData\\Roaming\\app.duskie.desktop\\settings.json).\nOPTION: Open the folder\nOPTION: Show settings.json"
      : `Found invoice-sept.pdf in Downloads, from Ali on Tuesday (preview, you asked "${last}").\nOPTION: Open invoice-sept.pdf\nOPTION: Show the folder\nOPTION: Find other invoices`;
  // Formatted answers arrive in bursts, like Claude Code's whole sentences.
  const words = formatted ? (answer.match(/[\s\S]{1,90}/g) ?? [answer]) : answer.split(/(?<=\s)/);
  let i = 0;
  const tick = () => {
    if (i < words.length) {
      emit("ai://delta", { id, text: words[i++] });
      setTimeout(tick, formatted ? 450 : 28);
    } else {
      const change = /\b(move|send|create|update|delete)\b/i.test(last);
      // A spoken question's answer is read aloud: the mascot talks for a bit.
      if ((a.attach as { speak?: boolean } | undefined)?.speak) {
        emit("voice://speaking", true);
        setTimeout(() => emit("voice://speaking", false), 3000);
      }
      emit("ai://done", {
        id,
        provider: "local",
        error: null,
        handoff: change ? "needs a change (JIRA_TRANSITION_ISSUE)" : null,
      });
    }
  };
  if (/meetings/i.test(last)) {
    // A local model that is not running, for the failure card.
    later(900, () =>
      emit("ai://done", {
        id,
        provider: null,
        error: "error sending request for url (http://127.0.0.1:11434/v1/chat/completions)",
        handoff: null,
      }),
    );
    return;
  }
  emit("ai://tool", { id, name: "search", label: `Searching your PC for \u201c${last.slice(0, 30)}\u201d` });
  // A task with several steps shows them one by one.
  if (/ and /i.test(last)) {
    const steps = ["notifications", "browser", "browser"];
    for (const [n, name] of steps.entries()) {
      later(250 * (n + 1), () => emit("ai://tool", { id, name }));
    }
  }
  if (/\btidy\b/i.test(last)) {
    // Separate actions, each needing its own yes.
    const asks = [
      "Archive 14 newsletters in Gmail",
      "Move 3 invoices to Documents",
      "Reply to Sara: timeline is Friday",
      "Delete 2 old build folders (1.2 GB)",
    ];
    for (const [n, label] of asks.entries())
      later(1000 + n * 60, () => emit("ai://proposal", { chatId: id, id: `p-${id}-${n}`, label, undoable: true }));
  } else if (/\bzip\b/i.test(last)) {
    // A task with several actions comes back as a plan.
    const plan = [
      "Create Downloads\\Invoices October",
      "Move 7 invoice PDFs into it",
      "Zip it as Invoices-October.zip",
    ];
    for (const [n, label] of plan.entries()) {
      later(1000 + n * 60, () =>
        emit("ai://proposal", { chatId: id, id: `p-${id}-${n}`, label, step: true, undoable: n % 2 === 0 }),
      );
    }
  } else {
    later(1200, () => emit("ai://proposal", { chatId: id, id: `p-${id}`, label: "Move invoice-sept.pdf to Invoices" }));
  }
  setTimeout(tick, 900);
}

// Agent sessions: a short simulated run with a plan, steps, one question
// and two changed files to review.
export const mockChanges = {
  v: [
    {
      path: "src/api/client.ts",
      status: "modified",
      added: 9,
      removed: 2,
      hunks: [
        {
          header: "@@ -12,6 +12,13 @@ export async function get(url: string) {",
          lines: [
            " export async function get(url: string) {",
            "-  const res = await fetch(url);",
            "-  return res.json();",
            "+  for (let attempt = 0; attempt < 3; attempt++) {",
            "+    const res = await fetch(url);",
            "+    if (res.ok) return res.json();",
            "+    await sleep(250 * 2 ** attempt);",
            "+  }",
            "+  throw new Error('GET failed: ' + url);",
            " }",
          ],
        },
      ],
    },
    {
      path: "src/api/client.test.ts",
      status: "added",
      added: 3,
      removed: 0,
      hunks: [
        {
          header: "@@ -0,0 +1,3 @@",
          lines: ["+test('retries', async () => {", "+  expect(await get('/flaky')).toEqual({ ok: true });", "+});"],
        },
      ],
    },
  ],
};

export const pendingAgentAnswer: { v: (() => void) | null } = { v: null };

export const welcomeDeferred = { v: false };
// `?settings` opens Settings once the island has loaded (visual checks).
if (previewFlag("settings")) setTimeout(() => call("ask_open", { view: "settings" }), 800);

export const welcomeSpoken = { v: false };

export const voiceStatus = () => ({
  models: [
    { id: "wake", label: "Wake word", size: 17_626_723, installed: settings.v.voice.enabled },
    { id: "speech", label: "Speech to text", size: 57_267_600, installed: settings.v.voice.enabled },
    { id: "voice", label: "Supertonic voice", size: 128_774_318, installed: settings.v.voice.enabled },
  ],
  missingBytes: settings.v.voice.enabled ? 0 : 203_669_641,
  downloading: false,
  listening: settings.v.voice.enabled,
  error: null,
  voices: [
    { id: "f5", label: "Female 5 (warm)" },
    { id: "f1", label: "Female 1 (clear)" },
    { id: "m2", label: "Male 2 (deep, lively)" },
  ],
});

export const COMPOSIO_APPS = [
  ["googlecalendar", "Google Calendar", "Meeting reminders and your day"],
  ["outlook", "Outlook", "Calendar and mail from Microsoft 365"],
  ["gmail", "Gmail", "Unread client mail in the morning brief"],
  ["slack", "Slack", "Messages to you in the brief"],
  ["jira", "Jira", "Issues assigned to you"],
  ["github", "GitHub", "Pull requests and issues"],
  ["fathom", "Fathom", "Meeting notes for follow-ups"],
  ["notion", "Notion", "Pages and notes in Ask mode"],
];
