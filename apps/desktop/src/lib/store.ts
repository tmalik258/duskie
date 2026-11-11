import { useDuskie } from "./store/duskie-state";

/** The assistant's name, "Duskie" unless the user renamed it. */
export const useAssistantName = () => useDuskie((s) => s.settings.assistantName || "Duskie");

export * from "./store/ask-actions";
export * from "./store/ask-types";
export * from "./store/chat-turns";
export * from "./store/connect";
export * from "./store/done-pill";
export * from "./store/duskie-state";
export * from "./store/panel-events";
export * from "./store/proposals";
export * from "./store/run-actions";
export * from "./store/send-chat";
export * from "./store/waiting";
