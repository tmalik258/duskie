"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import { ActivitiesCard } from "../activities-card";
import { AgentCard } from "../agent-card";
import { ASK_PAD, AskPanel } from "../ask-panel";
import { IslandGuide } from "../island-guide";
import { EXPANDED } from "../island-layout";
import { ExpandedContent } from "../island-parts";
import { IslandSettings } from "../island-settings";
import { FullVoice } from "../island-voice/tail";
import { IslandWelcome } from "../island-welcome";
import { MeetingCard } from "../meeting-card";
import { NetCard } from "../net-card";
import { PreparingVoice } from "../preparing-voice";
import { UpdateCard } from "../update-card";
import type { IslandFace } from "./use-island-face";
import type { IslandHover } from "./use-island-hover";
import type { IslandShape } from "./use-island-shape";
import type { IslandStore } from "./use-island-store";
import type { IslandWork } from "./use-island-work";

/** What the open island shows: Ask, the voice warm-up, or an expanded card. */
export function IslandContent(c: IslandStore & IslandWork & IslandHover & IslandFace & IslandShape) {
  const {
    asking,
    contentRef,
    askPanel,
    layout,
    reduced,
    askTab,
    view,
    preparingVoice,
    voiceStatus,
    expanded,
    fullVoice,
    voicePill,
    showGuide,
    waiting,
    guide,
    registryId,
    updateWorking,
    updateActivity,
    cardAgent,
    meetingSoon,
    setNetOpen,
    mascot,
    paused,
    suggestion,
  } = c;
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {/* Exclusive branches only (as on main): keeping Ask mounted while closed
        stacked with Expanded and stuck the island after rapid open/close. */}
      {asking ? (
        <motion.div
          key="ask"
          ref={contentRef}
          className="absolute top-0 right-0"
          style={
            askPanel
              ? ({
                  // Design: only the tab row sits beside Duskie; the rest runs full width.
                  left: 12,
                  paddingTop: ASK_PAD.top,
                  paddingRight: ASK_PAD.x,
                  paddingBottom: ASK_PAD.bottom,
                  "--ak-indent": `${layout.geom.contentPadLeft - 12}px`,
                } as CSSProperties)
              : {
                  left: layout.geom.contentPadLeft,
                  paddingTop: EXPANDED.pad,
                  paddingRight: EXPANDED.pad,
                }
          }
          initial={
            reduced
              ? { opacity: 0 }
              : askPanel && askTab === "agents"
                ? { opacity: 0, filter: "blur(8px)", y: 10, scale: 0.985 }
                : { opacity: 0, y: 4 }
          }
          animate={{ opacity: 1, filter: "blur(0px)", y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            filter: reduced ? undefined : "blur(4px)",
            y: reduced ? 0 : -3,
            transition: { duration: 0.1 },
          }}
          transition={
            reduced
              ? { duration: 0 }
              : askPanel && askTab === "agents"
                ? { duration: 0.34, delay: 0.05, ease: [0.23, 1, 0.32, 1] }
                : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }
          }
        >
          {view === "settings" ? <IslandSettings /> : view === "welcome" ? <IslandWelcome /> : <AskPanel />}
        </motion.div>
      ) : preparingVoice ? (
        <motion.div
          key="preparing"
          ref={contentRef}
          className="absolute top-0 right-0"
          style={{
            left: layout.geom.contentPadLeft,
            paddingTop: EXPANDED.pad,
            paddingRight: EXPANDED.pad,
            paddingBottom: 6,
          }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)", y: 4 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.1 } }}
          transition={{ duration: 0.28, delay: 0.06, ease: [0.23, 1, 0.32, 1] }}
        >
          <PreparingVoice voiceStatus={voiceStatus} />
        </motion.div>
      ) : (
        expanded && (
          <motion.div
            key="expanded"
            ref={contentRef}
            className="absolute top-0 right-0"
            style={
              {
                left: layout.geom.contentPadLeft,
                paddingTop: EXPANDED.pad,
                paddingRight: EXPANDED.pad,
                // Tight inset only - clears the shell radius; height hugs content.
                paddingBottom: 6,
                // Lists below the orb (You missed) reach back under it.
                "--orb-indent": `${layout.geom.mascotSize + 14}px`,
              } as CSSProperties
            }
            initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)", y: 4 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.1 } }}
            transition={{ duration: 0.28, delay: 0.06, ease: [0.23, 1, 0.32, 1] }}
          >
            {fullVoice && voicePill ? (
              <FullVoice text={voicePill.text} thinking={voicePill.thinking} />
            ) : showGuide && waiting ? (
              <IslandGuide waiting={waiting} guide={guide} />
            ) : registryId === "activities" ? (
              <ActivitiesCard />
            ) : registryId === "update" && updateWorking !== null ? (
              <UpdateCard activityId={updateActivity?.id ?? null} startedAt={updateActivity?.startedAt ?? null} />
            ) : registryId === "agent-card" && cardAgent ? (
              <AgentCard id={cardAgent} />
            ) : registryId === "notify-card" && meetingSoon ? (
              <MeetingCard meeting={meetingSoon} />
            ) : registryId === "net-card" ? (
              <NetCard onClose={() => setNetOpen(false)} />
            ) : (
              <ExpandedContent mascot={mascot} paused={paused} suggestion={suggestion} />
            )}
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}
