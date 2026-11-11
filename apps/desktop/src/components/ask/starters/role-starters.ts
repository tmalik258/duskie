"use client";

// Part of starters: roleStarters.

import { sendChat } from "@/lib/store";
import type { AskContext } from "@/lib/types";
import { CODE, type Command, MAIL, MEETING } from "./command";

/** Everyday work help from the app you are in and the time of day:
 * inbox triage and replies in your tone, notes to tasks, standup and
 * weekly status, handing work to a coding agent. */
export function roleStarters(
  context: AskContext | null,
  clip: string | null | undefined,
  focusInput: (prefix: string) => void,
  now = new Date(),
  coder = true,
): Command[] {
  const out: Command[] = [];
  const where = `${context?.app ?? ""} ${context?.title ?? ""}`;
  if (MAIL.test(where)) {
    out.push(
      {
        id: "starter:reply",
        label: "Draft a reply in my tone",
        hint: "From this email",
        icon: "send",
        run: () => sendChat("Draft a reply to this email in my usual tone. Short, friendly, no filler."),
        stay: true,
      },
      {
        id: "starter:triage",
        label: "Triage my inbox",
        hint: "What needs me today",
        icon: "box",
        run: () => sendChat("Triage my inbox: what needs a reply today, what can wait, what to archive."),
        stay: true,
      },
    );
  }
  if (clip && MEETING.test(where)) {
    out.push({
      id: "starter:tasks",
      label: "Turn my notes into tasks",
      hint: "Owner and due date each",
      icon: "check",
      run: () =>
        sendChat("Turn the notes I copied into a task list with an owner and due date each.", { clipboard: true }),
      stay: true,
    });
  }
  if (coder && CODE.test(where)) {
    out.push({
      id: "starter:delegate",
      label: "Hand this to a coding agent",
      hint: "Say what to do",
      icon: "pr",
      run: () => focusInput("Ask the coding agent to "),
      stay: true,
    });
  }
  const hour = now.getHours();
  if (now.getDay() === 5 && hour >= 13) {
    out.push({
      id: "starter:weekly",
      label: "Draft my weekly status",
      hint: "Done, next, blocked",
      icon: "send",
      run: () => sendChat("Draft my weekly status from what I worked on this week: done, next, blocked."),
      stay: true,
    });
  } else if (hour < 11 && now.getDay() >= 1 && now.getDay() <= 5) {
    out.push({
      id: "starter:standup",
      label: "Draft my standup",
      hint: "Yesterday, today, blockers",
      icon: "send",
      run: () => sendChat("Draft my standup from what I worked on yesterday: yesterday, today, blockers. Three lines."),
      stay: true,
    });
  }
  return out;
}
