// Mock setup checklist status.

import { settings } from "./handler";

export const setupCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  setup_status: () => {
    const w = (id: string) => `winget install -e --id ${id} --accept-source-agreements`;
    const item = (
      id: string,
      group: "ai" | "connect" | "tools",
      title: string,
      why: string,
      done: boolean,
      status: string,
      extra: {
        command?: string;
        runnable?: boolean;
        action?: string;
        opensApp?: boolean;
        opensTerminal?: boolean;
        tab?: string;
        recommended?: boolean;
      } = {},
    ) => ({
      id,
      group,
      title,
      why,
      done,
      status,
      command: extra.command ?? null,
      runnable: extra.runnable ?? false,
      action: extra.action ?? "Install",
      opensApp: extra.opensApp ?? false,
      opensTerminal: extra.opensTerminal ?? false,
      tab: extra.tab ?? null,
      recommended: extra.recommended ?? false,
    });
    return {
      items: [
        item("claude_code", "ai", "Claude Code", "Chat, drafts and skills with your Claude plan.", true, "Installed", {
          recommended: true,
        }),
        item("ollama", "ai", "Ollama", "Free local AI on this PC, and search by meaning.", true, "Running", {
          recommended: true,
        }),
        item("ollama_embed", "ai", "Search model", "Finds things by meaning. About 270 MB.", false, "Not downloaded", {
          command: "ollama pull nomic-embed-text",
          runnable: true,
          action: "Download",
          recommended: true,
        }),
        item(
          "anthropic",
          "ai",
          "Anthropic API key",
          "Pay as you go. Opens PowerShell with the command ready to paste.",
          false,
          "",
          {
            command: 'setx ANTHROPIC_API_KEY "your-key"',
            runnable: true,
            action: "Open terminal",
            opensTerminal: true,
          },
        ),
        item(
          "claude_hooks",
          "connect",
          "Claude Code hooks",
          "Allow or deny requests from the island.",
          false,
          "Not added",
          {
            command: '{\n  "hooks": {}\n}',
            tab: "ai",
            recommended: true,
          },
        ),
        item(
          "browser",
          "connect",
          "Browser extension",
          "Page help, tabs and sessions on the island.",
          false,
          "Not paired",
          {
            tab: "browser",
            recommended: true,
          },
        ),
        item(
          "composio",
          "connect",
          "Composio",
          "One sign-in for your calendar, mail, Slack and more.",
          Boolean(settings.v.composio.account),
          settings.v.composio.account ? "Connected" : "Not connected",
          { tab: "connections", recommended: true },
        ),
        item("gh", "tools", "GitHub CLI", "Open PRs in the morning brief.", false, "Not installed", {
          command: w("GitHub.cli"),
          runnable: true,
          recommended: true,
        }),
        item("git", "tools", "Git", "Repo status and unsaved work.", true, "Installed", { recommended: true }),
        item("tesseract", "tools", "Tesseract", "Copy text out of screenshots.", false, "Not installed", {
          command: w("UB-Mannheim.TesseractOCR"),
          runnable: true,
          recommended: true,
        }),
        item("ffmpeg", "tools", "FFmpeg", "Convert videos and audio.", false, "Not installed", {
          command: w("Gyan.FFmpeg"),
          runnable: true,
        }),
      ],
      installAll: `${w("GitHub.cli")}; ${w("UB-Mannheim.TesseractOCR")}`,
    };
  },
};
