# How Duskie works

## What Duskie is

Duskie lives in a small island at the top of the screen, with a small furry creature for a face. It notices moments where it can help (a download finishing, a dev server starting, an error on the clipboard, a meeting about to begin) and offers the next useful action. Safe actions can run on their own; everything else waits for one click, and anything that deletes or closes always asks.

## Local first

Events, history and settings stay on the PC in a local database. AI and online services are only used for what the user turns on. Rules handle everyday moments without any AI.

## Ask mode

Ctrl+Space (or the search button on the island) opens Ask. Duskie answers with tools that check the real PC: files and history, ports and processes, installed apps and their logs, Windows settings, the web, and connected apps. Changes are offered as buttons; nothing changes until the user taps one. "This PC only" keeps a chat on the local model with no web tools.

## Which AI answers

Settings > AI models picks who answers in Ask: Claude Code (the user's own subscription), Codex, the Anthropic API, a cloud key (Groq, OpenRouter, OpenAI, xAI, Gemini) or a local model through Ollama. Code changes go to a coding agent (Claude Code or Codex).

## Checking before answering

For "why is X not working, slow or not updating", Duskie checks first: diagnose and app_info read the app's version, whether it runs, waiting updates, its own logs, the Event Log and crash records; system lists ports and busy processes; run executes read-only commands such as netstat, ipconfig or ping. It then gives the likely cause in one line and the fixes as buttons.

## Agents

The Agents tab runs coding agents (Claude Code, Codex, Copilot CLI, Cursor, or a local Ollama agent) on a project. Modes: Plan reads and plans; Ask asks before each change; Edit edits files and asks before commands; Debug adds temporary logs, finds the cause, fixes it and removes the logs; Full does everything without asking; Try works on a throwaway copy of the project, then Keep brings the changes over or Throw away deletes the copy. After each turn, Review shows only the files the agent changed, with Keep and Undo per change. Images and files can be pasted, dropped or attached with the paperclip, and @ picks project files or folders.

## Voice and conversation

Say "Duskie" and the question. The island shows the words as you speak, and the answer is read aloud. Talking over an answer stops it. After an answer Duskie keeps listening for a reply, so a conversation does not need the wake word each time. Speech recognition and the voice run on the PC; audio is never saved or sent.
