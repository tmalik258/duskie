// Mock agent setup, routines, repos and Cursor commands.

import { gitParityReposOverview, previewFlag } from "./handler";

export const repoCommands: Record<string, (args: Record<string, unknown>) => unknown> = {
  routines_today: () => [
    { kind: "app", key: "code.exe", label: "Visual Studio Code", target: "", browser: "", days: 5 },
    { kind: "site", key: "github.com", label: "github.com", target: "https://github.com/", browser: "Chrome", days: 4 },
    { kind: "app", key: "slack.exe", label: "Slack", target: "", browser: "", days: 3 },
  ],
  routines_forget: () => 12,
  routines_remove: () => 1,
  ai_open_link: (a) => `Opened ${String(a.target)}`,
  agent_tune: () => null,
  agent_set_mode: () => null,
  agent_control: () => null,
  agent_project: () => "C:/code/sidekick",
  agent_reviews: () => [],
  agent_review_decide: () => null,
  agent_finish: () => "Merged wt/store-tests back",
  cursor_chats: () => [
    {
      id: "c1",
      title: "Tidy checkout form",
      path: "C:/code/shop",
      project: "shop",
      updatedAt: Date.now() - 120_000,
      status: "working",
      lastReply: "Moved validation into one hook and kept the error text as it was.",
    },
  ],
  cursor_open: () => null,
  agents_status: () => ({
    claudeCode: true,
    codex: true,
    copilot: true,
    cursor: false,
    handoff: "Claude Code",
    list: [
      { id: "claude_code", name: "Claude Code", installed: true, signedIn: true, limited: false, fix: null },
      { id: "codex", name: "Codex", installed: true, signedIn: false, limited: false, fix: "codex login" },
      { id: "copilot", name: "GitHub Copilot", installed: true, signedIn: null, limited: false, fix: null },
      {
        id: "cursor",
        name: "Cursor",
        installed: false,
        signedIn: null,
        limited: false,
        fix: "Install the Cursor CLI from cursor.com/cli",
      },
      { id: "local", name: "Local", installed: true, signedIn: true, limited: false, fix: null, local: true },
    ],
  }),
  repos_overview: () =>
    previewFlag("git")
      ? gitParityReposOverview()
      : {
          via: "gh",
          repos: [
            {
              name: "shop",
              path: "C:/code/shop",
              slug: "acme/shop",
              branch: "fix-login",
              ahead: 1,
              behind: 3,
              changed: 2,
              ci: "fail",
              reviews: 1,
              prs: [
                {
                  number: 42,
                  title: "Fix login redirect",
                  url: "https://github.com/acme/shop/pull/42",
                  branch: "fix-login",
                  mine: true,
                  ci: "fail",
                  failing: ["test (windows)", "https://github.com/acme/shop/actions/runs/1"],
                  reviewRequested: false,
                },
                {
                  number: 40,
                  title: "Cart totals in cents",
                  url: "https://github.com/acme/shop/pull/40",
                  branch: "cents",
                  mine: false,
                  ci: "pass",
                  failing: null,
                  reviewRequested: true,
                },
              ],
            },
            {
              name: "site",
              path: "C:/code/site",
              slug: "acme/site",
              branch: "main",
              ahead: 0,
              behind: 0,
              changed: 0,
              ci: "none",
              reviews: 0,
              prs: [],
            },
          ],
        },
  repo_pull: () => "Pulled 3 commits",
  repo_open: () => null,
};

export const mockStashes = { v: [{ name: "stash@{0}", message: "On main: island colours", when: "20 minutes ago" }] };
