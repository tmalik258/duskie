# Duskie features

## Download a file

The moment it finishes, the island offers Open, Show in folder, Copy file, and conversions that fit the file (images to WebP, PNG or JPG; videos to MP4 or MP3; Office files to PDF; archives extracted) when ffmpeg, ImageMagick, LibreOffice or tar are installed.

## Start a dev server

(`pnpm dev`, `uvicorn`, `python -m http.server`, also from WSL). Within a second it offers Chrome, Incognito, Zen, Edge, Firefox or your default browser, and FastAPI docs for Python servers. The browser you pick moves to the front next time.

## Copy an `EADDRINUSE` error

It offers to free the port.

## Copy a password or API key

The clipboard clears itself after 30 seconds.

## Go fullscreen

(video, game, slides). The island hides and comes back after.

## Settings > Skills

switch skills on or off, or set them to Auto. Destructive actions always ask.

## Your own skills

drop YAML files into the folder shown in Settings > Found on this PC (format in `skills/README.md`).

## Press Win+Alt+Space

(or the search button on the island) and the island becomes Ask mode: type a command or ask anything, and the answer streams right there. Attach the app you were in or your clipboard with the chips; "This PC only" keeps the chat on a local model. Esc or a click elsewhere folds it back; the conversation stays for next time.

## Copy an error or stack trace

The island offers Explain and fix, which asks AI with the error attached.

## Claude Code sessions

add the hook from Settings > AI and the island tells you when a session finishes or is waiting for you.

## Undo

files Duskie creates (conversions, extracted folders) can be sent to the Recycle Bin from the island or Settings > History for 24 hours.

## Low disk or memory

the island warns once and offers Storage settings or Task Manager.

## Step away

for 5 minutes and suggestions wait for you instead of expiring unseen.

## Browser

press Install next to your browser in Settings > Connections; Duskie opens the extensions page with the folder path copied, and the extension pairs on its own. Too many tabs offer cleanup, Upwork jobs offer a proposal draft.

## Screenshots

(Win+PrtScn): Copy, Copy text (with Tesseract), Show in folder.

## Search my stuff

type in Ask mode and pick Search. Pick folders under Settings > Privacy and data. With Ollama running, `ollama pull nomic-embed-text` adds search by meaning (embeddings stay on this PC).

## Claude Code can use Duskie

through MCP: press Add for me in Settings > Connections.

## What's on my screen?

pick it in Ask mode, or turn on the Screenshot chip to send one with your next question. Duskie only captures when you ask.

## Voice

on by default (Settings > AI > Voice; about 690 MB of speech models download once). Say "Duskie" and your question; the island shows your words as you speak, a final pass with Parakeet writes the question you asked, and the answer is read aloud with Supertonic (10 voices to pick from in Settings > AI > Voice). Talking over an answer stops it, and after an answer you can reply without the wake word. Suggestions are read out too, and you can answer them by voice ("the first one", "not now"). There is a mic button in Ask mode for push to talk.

## Settings

open inside the island (tray, the island's Settings button, or "Open settings" in Ask mode).

## Meetings

connect Composio in Settings > Connections, then Google Calendar or Outlook. A few minutes before a meeting the island offers Join call and Prep with AI; afterwards it offers to draft the follow-up from your Fathom notes (connect Fathom too). Suggestions wait quietly while you are in a meeting.

## Morning brief

the first time you sit down each day, one card with yesterday's time, repos with unsaved work and PRs waiting on you (if the GitHub CLI `gh` is signed in). Plan my day hands it to your AI.

## End of day

a time summary to paste into your standup, and repos with unsaved work.

## Learns

three Not nows in a row quiet a skill for a while; **Always do this** on a suggestion makes it automatic (see Settings > Skills > Automations). Low-priority suggestions are saved for later instead of popping up; a small number on the island shows how many.

## Mail

connect Gmail (or any IMAP server under Advanced) and mail that needs you shows up in the island, quiet by default and louder only for what matters. Settings > Notifications shows what Duskie has learned about your senders.

## Git dock

(Ctrl G in Ask): stage with checkboxes, write the commit message from the staged changes, see History, the pull request and Stashes side by side with the island. Pull and Push light up only when there is something to move; with both, one Sync button pulls then pushes. A pull that hits conflicts opens a Merge tab: pick yours, theirs or both for each file, then Finish or Undo.

## Teach Duskie your voice

(Settings > Voice): say its name five times and read three short lines. Duskie learns how firmly to listen for your "Duskie" and, if you turn on "Only answer my voice", drops questions in other voices. The recordings stay in memory and are dropped; only the learned numbers are kept, and Forget removes them. Add samples reads the lines again to sharpen it; the newest 12 takes are kept.

## Debug mode

for agents: the agent adds temporary logs, reproduces the bug, fixes the cause, then removes the logs. A panel lists the probes, what they logged and the cause.

## Editor

Full screen in the Git dock opens the project in an editor with a file tree, change markers, Ctrl P to open a file, Ctrl Shift F to search and Ctrl ` for a terminal. Open on a changed file jumps to the change. If an agent edits a file you have open, Duskie asks before reloading.

## Skills library

(Settings > Skills > Library): skills from Claude Code and Codex in one place, written back to each tool you switch on, and readable by the local model. Add one from a GitHub link; it is pinned to a commit. Nothing in a skill runs when you add or sync it.

## Apps over MCP

add a server you run on this PC, or sign in to one online, in Settings > Connections. Tools from a direct server win over the same app through Composio, and Ask shows which one answered.

## Shortcuts

for Talk, Accept, Not now, Ask about the screen, Clipboard history, Pause and Settings. Record your own in Settings > Home > Shortcuts.
