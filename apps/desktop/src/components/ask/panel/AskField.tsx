// The Ask input line: the field (or what the mic hears) and the buttons
// on its right: history filter, speak, mic, model, stop, new chat, send.

import type { KeyboardEvent, RefObject } from "react";
import { cancelChat, startListening, stopListening } from "@/lib/store";
import type { ProviderStatus } from "@/lib/types";
import { Ic, Icon } from "../../Icon";
import type { HistoryKind } from "../History";
import { ModelPicker } from "../ModelPicker";
import { Hearing } from "../Voice";
import { IconButton } from "./IconButton";

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
  return (
    <div className="ak-composer ak-field">
      {p.hearing !== null ? (
        <Hearing text={p.hearing} />
      ) : (
        <input
          ref={p.inputRef}
          value={p.text}
          onChange={(e) => p.onChange(e.target.value)}
          onKeyDown={p.onKeyDown}
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
  );
}
