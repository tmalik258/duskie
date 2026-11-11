"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import { interruptSession, useAgents } from "@/lib/agents";
import { setHovered } from "@/lib/store";
import { GitSideDock } from "../agents/git-side-dock";
import { ReviewSideDock } from "../agents/review-side-dock";
import { Announcer } from "../announcer";
import { Creature } from "../creature";
import { BubblePeek, IslandBubbles } from "../island-bubbles";
import { TOP } from "../island-layout";
import { CompactTrailing, dismiss } from "../island-parts/activity";
import { choose } from "../island-parts/dismiss-fill";
import { IslandPill } from "../island-pill";
import { VoicePill } from "../island-voice";
import { openBoard } from "../island-voice/tail";
import { haloFace, tintRgb } from "./helpers";
import { IslandContent } from "./island-content";
import { useBubbles } from "./use-bubbles";
import type { IslandFace } from "./use-island-face";
import type { IslandHover } from "./use-island-hover";
import type { IslandShape } from "./use-island-shape";
import type { IslandStore } from "./use-island-store";
import type { IslandWork } from "./use-island-work";

/** Everything the island draws, from the state its hooks worked out. */
export function IslandView(c: IslandStore & IslandWork & IslandHover & IslandFace & IslandShape) {
  const { agentsOnly, bare, bump, busy, chatting, displayedActivity, dockBeside, donePill, expanded, face } = c;
  const { gitBeside, gitDockLive, height, layout, look, mascot, online, paused, peekId, pillModel, radius } = c;
  const { rawHover, reduced, registryId, reviewBeside, reviewDockLive, setPeekId, setPillMeasured, settings } = c;
  const { sideDockH, transition, visible, voicePill, waiting, width } = c;

  const mascotX = layout.geom.mascotX;
  const mascotY = layout.geom.mascotY;
  const mascotSize = layout.geom.mascotSize;
  // Size stays 48; Take A / Ask scale via CSS (prototype orbAt). perch is on geom.
  const mascotScale = layout.geom.mascotScale;
  // Hidden for a fullscreen app, the island still comes back under the cursor.
  const shown = visible || rawHover;
  const shellColor = settings.islandColor;
  const washEvent =
    mascot === "success" || donePill || mascot === "error"
      ? mascot === "error"
        ? ("error" as const)
        : ("success" as const)
      : null;
  const { bubbleItems, openBubble, peekSuggestion } = useBubbles(c);

  return (
    <motion.div
      className="flex h-screen w-screen justify-center select-none"
      style={{ paddingTop: TOP, originY: 0 }}
      initial={false}
      animate={shown ? { opacity: 1, scale: 1, filter: "blur(0px)" } : { opacity: 0, scale: 0.92, filter: "blur(4px)" }}
      transition={reduced ? { duration: 0 } : { duration: shown ? 0.32 : 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className={`relative${dockBeside ? " flex items-start" : ""}`}>
        <motion.div
          className="island-shell relative overflow-hidden text-white"
          data-bare={layout.geom.bare}
          data-perch={layout.geom.perch || undefined}
          data-color={shellColor}
          data-state={registryId}
          data-solid={look.solid || undefined}
          data-simple={look.simple || undefined}
          initial={false}
          animate={{ width, height, borderRadius: radius }}
          transition={transition}
          style={{ scaleX: bump, originY: 0 }}
          // Focusing the input while the shell is still small would scroll its
          // content up; the shell never scrolls.
          onScroll={(e) => {
            e.currentTarget.scrollTop = 0;
          }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <div
            className="isl-tint"
            aria-hidden
            style={{ "--tint": tintRgb(washEvent ?? layout.geom.wash) } as CSSProperties}
          />
          <Announcer registryId={registryId} />

          <AnimatePresence initial={false}>
            {pillModel && <IslandPill key={`pill-${pillModel.kind}`} model={pillModel} onWidth={setPillMeasured} />}
            {!pillModel && !expanded && voicePill && (
              <VoicePill
                key="voice"
                {...voicePill}
                activity={displayedActivity}
                onOpen={agentsOnly ? () => openBoard() : undefined}
                onCancel={
                  agentsOnly
                    ? () => {
                        for (const s of useAgents.getState().sessions) {
                          if (s.status === "working" || s.status === "waiting") interruptSession(s.id);
                        }
                      }
                    : undefined
                }
              />
            )}
            {!pillModel && !expanded && !bare && !voicePill && (
              <CompactTrailing
                key="compact"
                busy={busy}
                paused={paused}
                offline={!online}
                waiting={waiting?.label ?? null}
              />
            )}
          </AnimatePresence>

          <IslandContent {...c} />
        </motion.div>
        {bubbleItems.length > 0 && (
          <IslandBubbles
            items={bubbleItems}
            openId={peekId}
            onOpen={openBubble}
            peek={
              peekSuggestion && (
                <BubblePeek
                  eyebrow={peekSuggestion.source ? `From ${peekSuggestion.source}` : undefined}
                  title={peekSuggestion.title || "Suggestion"}
                  detail={peekSuggestion.detail || undefined}
                  actions={peekSuggestion.options.slice(0, 2).map((label, i) => ({
                    label,
                    run: () => {
                      setPeekId(null);
                      choose(peekSuggestion, i);
                    },
                  }))}
                  onDismiss={() => {
                    setPeekId(null);
                    dismiss(peekSuggestion);
                  }}
                />
              )
            }
          />
        )}
        {/* Outside the shell, so its clipping never cuts Duskie's arms or hops. */}
        <motion.div
          className="pointer-events-none absolute top-0 left-0 z-2"
          initial={false}
          animate={{ x: mascotX, y: mascotY, scale: mascotScale }}
          transition={transition}
          style={{ originX: 0, originY: 0 }}
        >
          <span className="dk-orb" data-face={haloFace(mascot)}>
            <span className="dk-halo" />
            <Creature
              state={chatting && mascot === "idle" ? "working" : mascot}
              face={chatting && mascot === "idle" ? null : face}
              size={mascotSize}
              theme={settings.theme}
              alive={settings.alive && visible && !look.simple}
              simple={look.simple}
              active={shown}
              bust={false}
            />
          </span>
        </motion.div>
        <AnimatePresence initial={false}>
          {gitDockLive && <GitSideDock key="git-side" height={sideDockH} visible={gitBeside} />}
          {reviewDockLive && <ReviewSideDock key="review-side" height={sideDockH} visible={reviewBeside} />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
