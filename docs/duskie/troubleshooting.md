# Troubleshooting Duskie

## Duskie does not hear the wake word

Check Settings > AI models > Voice: voice is on, the right microphone is picked, and the speech models finished downloading (about 690 MB once). Teach Duskie your voice makes the wake word more reliable. Windows microphone privacy must allow desktop apps.

## Ask gives no answer or an error

Check Settings > AI models: the chosen AI must be signed in or have a key. A local model needs Ollama running. Copy diagnostics (Settings > Home > About) shows which model answers and recent errors.

## The browser extension is not connected

Press Install next to the browser in Settings > Connections; Duskie opens the extensions page with the folder copied, and it pairs on its own. Most questions about speed or settings do not need the extension at all.

## An agent says Done but nothing changed

The local agent now says when the model answered without changing files. Pick a coding model with reliable tool calls, or use Claude Code or Codex.

## Duskie crashes or freezes

Copy diagnostics from Settings > Home > About and paste it into an issue. Turn on Offer to report crashes to get a prefilled report after a crash.
