"use client";

// What Ask mode offers before you type: context chips and starters.

import { sendChat } from "@/lib/store";
import type { AskContext } from "@/lib/types";
import type { Command } from "./starters/command";
import { roleStarters } from "./starters/role-starters";

/**
 * What Ask offers before you type, from what you are doing: the error you
 * copied, the page you are on, the meeting coming up. Enter runs the first.
 */
export function contextStarters({
  context,
  page,
  meeting,
  focusInput,
  coder = true,
}: {
  context: AskContext | null;
  page: string | null;
  meeting: { title: string; start: string } | null;
  focusInput: (prefix: string) => void;
  /** "Do you work with code?" No: starters about mail, notes and the day. */
  coder?: boolean;
}): Command[] {
  const out: Command[] = [];
  const clip = context?.clipboardSecret ? null : context?.clipboardKind;
  if (!coder && clip) {
    out.push({
      id: "starter:clip",
      label: "Summarize what I copied",
      hint: "Three lines",
      icon: "copy",
      run: () => sendChat("Summarize what I copied in three short lines.", { clipboard: true }),
      stay: true,
    });
  }
  if (coder && clip === "stack_trace") {
    out.push({
      id: "starter:error",
      label: "Explain the error I copied",
      hint: "Two ways to fix it",
      icon: "warn",
      run: () => sendChat("Explain the error I copied and give me the two most likely fixes.", { clipboard: true }),
      stay: true,
    });
  }
  if (page) {
    out.push({
      id: "starter:page",
      label: "Summarize this page",
      hint: "In three lines",
      icon: "open",
      run: () => sendChat("Summarize this page in three short lines."),
      stay: true,
    });
  }
  if (context?.app && !page) {
    const app = context.app;
    out.push({
      id: "starter:howto",
      label: `How do I use ${app}?`,
      hint: "Three steps, shows where",
      icon: "spark",
      run: () =>
        sendChat(`How do I use ${app} for what I am doing? Three short steps, and point at the first control.`),
      stay: true,
    });
  }
  if (meeting) {
    out.push({
      id: "starter:meeting",
      label: `Prepare for ${meeting.title}`,
      hint: `At ${meeting.start}`,
      icon: "clock",
      run: () =>
        sendChat(`Help me prepare for "${meeting.title}" at ${meeting.start}: related notes, files and open items.`),
      stay: true,
    });
  }
  out.push(...roleStarters(context, clip, focusInput, new Date(), coder));
  out.push(
    {
      id: "starter:find",
      label: "Find a file",
      hint: "Searches your PC",
      icon: "folder",
      run: () => focusInput("Find "),
      stay: true,
    },
    {
      id: "starter:today",
      label: "What did I work on today?",
      icon: "clock",
      run: () => sendChat("What did I work on today? Two lines."),
      stay: true,
    },
  );
  return out.slice(0, 3);
}
