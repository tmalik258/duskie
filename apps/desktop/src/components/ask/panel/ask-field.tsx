// The Ask input line: the field (or what the mic hears) and the buttons
// on its right: history filter, speak, mic, model, stop, new chat, send.

import { type KeyboardEvent, type RefObject, useState } from "react";
import { cancelChat, startListening, stopListening } from "@/lib/store";
import { addAskFile, removeAskFile, useAskFiles } from "@/lib/store/ask-files";
import type { ProviderStatus } from "@/lib/types";
import { AttachButton, ContextChips } from "../../attach/attach-bar";
import { eventFiles, saveFile } from "../../attach/save-file";
import { Ic, Icon } from "../../icon";
import type { HistoryKind } from "../history";
import { ModelPicker } from "../model-picker";
import { Hearing } from "../voice";
import { IconButton } from "./icon-button";

/** Saves files and adds them as chips; the first failure is returned. */
async function attach(files: File[]): Promise<string | null> {
  for (const f of files) {
    try {
      const a = await saveFile(f);
      addAskFile({ name: a.name, path: a.path, folder: false, url: a.url });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
  return null;
}

export function AskField(p: {
  inputRef: RefObject<HTMLInputElement | null>;
  text: string;
  hearing: string | null;
  inHistory: boolean;
  inChat: boolean;
  showChat: boolean;
  streaming: boolean;
  alt: boolean;
  assistant: string;
  speak: boolean;
  voiceReady: boolean;
  historyKind: HistoryKind;
  choices: ProviderStatus[];
  best: ProviderStatus | undefined;
  picked: ProviderStatus | null;
  onChange: (text: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onHistoryKind: (k: HistoryKind) => void;
  onToggleSpeak: () => void;
  onNewChat: () => void;
  onSend: () => void;
}) {
  const files = useAskFiles((s) => s.items);
  const [error, setError] = useState<string | null>(null);
  const add = (f: File[]) => {
    setError(null);
    void attach(f).then(setError);
  };
  return (
    <>
      {!p.inHistory && <ContextChips items={files} error={error} onRemove={removeAskFile} />}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop zone for files; the paperclip is the keyboard path */}
      <div
        className="ak-composer ak-field"
        onDrop={(e) => {
          const f = eventFiles(e);
          if (!f.length) return;
          e.preventDefault();
          add(f);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
      >
        {p.hearing !== null ? (
          <Hearing text={p.hearing} />
        ) : (
          <input
            ref={p.inputRef}
            value={p.text}
            onChange={(e) => p.onChange(e.target.value)}
            onKeyDown={p.onKeyDown}
            onPaste={(e) => {
              const f = eventFiles(e);
              if (!f.length) return;
              e.preventDefault();
              add(f);
            }}
            placeholder={
              p.inHistory ? "Search history" : p.inChat ? "Ask a follow-up" : "Ask anything, or describe a task"
            }
            spellCheck={false}
            className="ak-q"
          />
        )}
        <div className="ak-right">
          {p.inHistory ? (
            <fieldset className="ak-seg border-0" aria-label="Show">
              {(["all", "chats", "agents", "live"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={p.historyKind === k}
                  onClick={() => p.onHistoryKind(k)}
                  className="chip capitalize"
                >
                  {k}
                </button>
              ))}
            </fieldset>
          ) : p.hearing !== null ? (
            <button type="button" onClick={stopListening} className="ak-stop chip">
              Stop <kbd>Esc</kbd>
            </button>
          ) : (
            <>
              <AttachButton onFiles={add} />
              <IconButton
                label={p.speak ? "Speak replies: on (Alt S)" : "Speak replies: off (Alt S)"}
                pressed={p.speak}
                keys={p.alt}
                hint="Alt S"
                onClick={p.onToggleSpeak}
              >
                <Icon name={p.speak ? "speaker" : "speakerOff"} size={14} />
              </IconButton>
              {p.voiceReady && !p.streaming && (
                <IconButton
                  label={`Talk, or say ${p.assistant} (Alt V)`}
                  keys={p.alt}
                  hint="Alt V"
                  onClick={startListening}
                >
                  <Ic name="mic" size={14} />
                </IconButton>
              )}
              {p.best && (
                <ModelPicker choices={p.choices} best={p.best} picked={p.picked} keys={p.alt} disabled={p.streaming} />
              )}
              {p.streaming ? (
                <button type="button" onClick={cancelChat} className="ak-stop chip">
                  Stop <kbd>Esc</kbd>
                </button>
              ) : (
                <>
                  {p.inChat && !p.showChat && (
                    <IconButton label="New chat (Ctrl N)" keys={p.alt} hint="Ctrl N" onClick={p.onNewChat}>
                      <Ic name="plus" size={15} />
                    </IconButton>
                  )}
                  <button type="button" aria-label="Send" className="ak-send" onClick={p.onSend}>
                    <Ic name="send" size={14} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
