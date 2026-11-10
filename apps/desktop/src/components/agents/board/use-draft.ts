import { useEffect, useRef, useState } from "react";
import { type Session, sessionView } from "@/lib/agents";

/** The composer draft for the focused tile, kept per session across switches. */
export function useDraft(target: Session | null) {
  const targetId = target?.id;
  const [text, setLocalText] = useState("");
  const textRef = useRef("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore draft only when the focused target switches
  useEffect(() => {
    const draft = target?.view?.draft ?? "";
    textRef.current = draft;
    setLocalText(draft);
  }, [targetId]);
  const setText = (draft: string) => {
    textRef.current = draft;
    setLocalText(draft);
  };
  const flushDraft = () => {
    if (targetId) sessionView(targetId, { draft: textRef.current });
  };
  useEffect(
    () => () => {
      if (targetId) sessionView(targetId, { draft: textRef.current });
    },
    [targetId],
  );
  const clearDraft = () => {
    setText("");
    if (targetId) sessionView(targetId, { draft: "" });
  };
  return { text, setText, flushDraft, clearDraft };
}
