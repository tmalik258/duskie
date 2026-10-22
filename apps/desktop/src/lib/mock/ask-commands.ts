// Mock Ask panel, welcome, clipboard and search commands.

import { call, emit, previewFlag, settings, suggestion } from "./handler";
import { mockChanges, voiceStatus, welcomeDeferred, welcomeSpoken } from "./mock-chat";
import { go } from "./mock-install-update";
import { speakWelcome } from "./other-apps";

export const askCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  agent_undo: (a) => {
    mockChanges.v = a.path ? mockChanges.v.filter((f) => f.path !== a.path) : [];
  },
  ask_close: () => {
    if (!settings.v.onboarded && !welcomeDeferred.v) {
      call("ask_open", { view: "welcome" });
      return;
    }
    emit("ask://close", { reason: "close" });
  },
  ask_open: (a) => {
    welcomeDeferred.v = false;
    emit("ask://open", {
      sentAt: Date.now(),
      context: {
        app: "Visual Studio Code",
        title: "Island.tsx - sidekick",
        clipboardKind: "stack_trace",
        clipboardPreview: "Error: listen EADDRINUSE: address already in use :::3000",
        clipboardSecret: false,
      },
      prompt: (a.prompt as string | null) ?? null,
      ask: Boolean(a.ask),
      clipboard: false,
      page: null,
      view: settings.v.onboarded ? ((a.view as string | undefined) ?? "ask") : "welcome",
      tool: (a.tool as string | undefined) ?? null,
      tab: (a.tab as string | undefined) ?? undefined,
    });
    if (!settings.v.onboarded && !welcomeSpoken.v) {
      welcomeSpoken.v = true;
      speakWelcome(settings.v.welcomeStep);
    }
  },
  ask_ensure_welcome: () => {
    if (settings.v.onboarded || welcomeDeferred.v) return;
    call("ask_open", { view: "welcome" });
  },
  ask_defer_welcome: () => {
    if (settings.v.onboarded) {
      emit("ask://close", { reason: "close" });
      return;
    }
    welcomeDeferred.v = true;
    emit("ask://close", { reason: "defer" });
    // Preview a permission arriving while onboarding is hidden.
    if (previewFlag("approval")) {
      setTimeout(() => {
        suggestion.v = {
          id: "preview-approval",
          skillId: "notify.permission",
          title: "Allow this connection?",
          detail: "The connection needs your approval.",
          options: ["Accept", "Decline"],
          actions: ["approve", "reject"],
        };
        emit("suggestion://new", suggestion.v);
        go("suggesting");
      }, 500);
    }
  },
  ask_resume_welcome: () => {
    if (settings.v.onboarded) return;
    welcomeDeferred.v = false;
    call("ask_open", { view: "welcome" });
  },
  skill_install: () => "Screenshots",
  voice_status: voiceStatus,
  clipboard_history: () => [
    { text: "npm run dev -- --port 3001", ts: new Date().toISOString() },
    { text: "https://github.com/tmalik258/duskie/pull/5", ts: new Date().toISOString() },
    { text: "#0ea5e9", ts: new Date().toISOString() },
  ],
  clipboard_copy: () => undefined,
  search_clear: () => 0,
};
