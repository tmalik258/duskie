// @ts-nocheck
// biome-ignore-all lint: ported as is from the Mascot Lab prototype; keep the two in step.
// The Duskie creature: a small raymarched fur body (one shared WebGL 2 context draws every
// creature into its own 2D canvas, only when something changed) with the app's SVG eyes on top.
// Ported from the Mascot Lab prototype; keep the two in step.

import { ARM_LEN, armSeg, mixHex, Spring } from "./arm-math";
import { X_A } from "./expressions-a";
import { X_B } from "./expressions-b";
import { AI, APP_EYES, ARMS, both, E, EYE_INK, LID, M, REST } from "./faces";
import { FurRenderer } from "./fur-renderer";
import { lin, THEMES } from "./fur-themes";

let api = null;
let failed = false;
// Software rendering at boot is often a GPU that is still waking up; look again a few times.
let softTries = 0;
const SOFT_RETRIES = 4;

function boot() {
  let R;
  try {
    R = new FurRenderer();
  } catch {
    failed = true;
    return null;
  }
  // A software renderer draws the fur on the CPU and stalls the whole app; the orb is lighter.
  const info = R.gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = String(info ? R.gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : R.gl.getParameter(R.gl.RENDERER));
  // Screenshot and test runs set this to draw on a software renderer.
  const forced = (window as unknown as { __creatureForce?: boolean }).__creatureForce === true;
  if (!forced && /swiftshader|llvmpipe|softpipe|basic render|microsoft basic/i.test(gpu)) {
    R.gl.getExtension("WEBGL_lose_context")?.loseContext();
    softTries += 1;
    failed = softTries >= SOFT_RETRIES;
    return null;
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Expressions follow the Mascot Lab: a mouth only on reactions, the resting moods keep a quiet face.
  const X = { ...X_A, ...X_B };

  // Mood sounds come from the app; only the island's mascot (sound: true)
  // makes its life sounds (a yawn, dozing, tape) through Duskie's own player.
  const Sound = { play: (name) => name && soundHook?.(name) };
  const XS = {};

  const all = [];
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let lastPointer = 0;

  class Mascot {
    constructor(slot, o) {
      this.size = o.size;
      this.theme = o.theme ?? "atelier";
      this.alive = !!o.alive;
      this.follow = o.follow ?? true;
      this.interactive = !!o.interactive;
      this.bust = o.bust ?? this.size < 40;
      // The canvas reaches past the box so raised arms and hops are never cut.
      this.bleed = this.bust ? 1 : (o.bleed ?? 1.3);
      this.shadow = o.shadow ?? null;
      const el = document.createElement("div");
      el.className = "mz";
      el.style.width = el.style.height = `${this.size}px`;
      el.style.setProperty("--s", `${this.size}px`);
      // Parent (creature.tsx) already exposes role="img" + aria-label.
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `<div class="mz-move"><canvas></canvas><div class="mz-eyes"><div class="mz-pair"><svg class="mz-eye" viewBox="0 0 20 30" aria-hidden="true"></svg><svg class="mz-eye" viewBox="0 0 20 30" aria-hidden="true"></svg></div><i class="mz-tape"></i><i class="mz-tape"></i></div><div class="mz-fx"></div></div>`;
      slot.replaceChildren(el);
      this.el = el;
      this.move = el.querySelector(".mz-move");
      this.fx = el.querySelector(".mz-fx");
      this.eyesEl = el.querySelector(".mz-eyes");
      this.pairEl = el.querySelector(".mz-pair");
      this.eyeSvgs = [...el.querySelectorAll(".mz-eye")];
      this.tapes = [...el.querySelectorAll(".mz-tape")];
      this.sound = !!o.sound;
      this.eyeKey = "";
      const c = el.querySelector("canvas");
      this.canvas = c;
      if (this.bleed > 1) {
        // The stylesheet pins the canvas to the box; widen it and pull it back to center.
        const o = `${(-(this.bleed - 1) / 2) * 100}%`;
        const w = `${this.bleed * 100}%`;
        Object.assign(c.style, { inset: "auto", left: o, top: o, width: w, height: w });
      }
      this.ctx = c.getContext("2d");
      // Below 40 px only the upper body shows; it fades out at the bottom.
      if (this.bust) c.style.maskImage = c.style.webkitMaskImage = "linear-gradient(180deg, #000 66%, transparent 97%)";
      this.ppu = (this.size * dpr) / 2.21;
      this.setScale(1);
      this.s = {
        y: new Spring(0, 0.5, 0.55),
        tilt: new Spring(0, 0.55, 0.6),
        scale: new Spring(1, 0.45, 0.6),
        squash: new Spring(0, 0.34, 0.32),
        gx: new Spring(0, 0.35, 0.95),
        gy: new Spring(0, 0.35, 0.95),
        lid: new Spring(1, 0.15, 1),
        px: new Spring(0, 0.35, 0.65),
        py: new Spring(0, 0.35, 0.65),
        ...Object.fromEntries(
          ["l", "r"].flatMap((sd) => ["hx", "hy", "hz"].map((c, i) => [sd + c, new Spring(REST[i], 0.42, 0.62)])),
        ),
        mouth: new Spring(0, 0.25, 1),
        blush: new Spring(0, 0.5, 1),
        dim: new Spring(0, 0.6, 1),
        glow: new Spring(1, 0.5, 1),
      };
      this.timers = new Set();
      this.dirty = true;
      this.expr = null;
      this.look = X.idle;
      this.eyes = ["pill", "pill"];
      this.rim = null;
      this.show(o.expr ?? "idle");
      if (o.blink !== false) this.blinkLoop();
      this.aliveTick();
      all.push(this);
    }
    /** Renders sharper when the view is zoomed. */
    setScale(k) {
      const ss = this.size <= 44 ? 3 : this.size <= 130 ? 2.4 : 1.2;
      const px = this.size * this.bleed * dpr * k;
      this.canvas.width = this.canvas.height = Math.round(px);
      this.res = Math.min(700, Math.round(px * (k > 1 ? Math.max(1.5, (ss / k) * 1.2) : ss)));
      this.dirty = true;
    }
    later(ms, fn) {
      const t = setTimeout(() => {
        this.timers.delete(t);
        fn();
      }, ms);
      this.timers.add(t);
      return t;
    }
    setTheme(t) {
      this.theme = t;
      this.dirty = true;
    }
    show(expr) {
      const prev = this.look;
      this.expr = expr;
      const x = (this.look = X[expr]);
      const s = this.s;
      // Eyes change behind a blink so it reads as one face changing.
      const next = Array.isArray(x.eyes) ? x.eyes : [x.eyes, x.eyes];
      if (next.join() !== this.eyes.join()) {
        if (this.expr && !reduced && prev !== x) {
          s.lid.to(0.05);
          this.later(85, () => {
            this.eyes = next;
            s.lid.to(1);
            this.dirty = true;
          });
        } else this.eyes = next;
      }
      const p = x.pose ?? {};
      s.y.to(p.y ?? 0);
      s.tilt.to(p.tilt ?? 0);
      s.scale.to(p.scale ?? 1);
      this.gazeLocked = !!x.gaze;
      if (x.gaze) {
        s.gx.to(x.gaze[0]);
        s.gy.to(x.gaze[1]);
      } else if (prev.gaze) {
        s.gx.to(0);
        s.gy.to(0);
      }
      const arms = ARMS[x.arms ?? "rest"];
      const K = ["hx", "hy", "hz"];
      K.forEach((c, i) => {
        s["l" + c].to(arms[0][i]);
        s["r" + c].to(arms[1][i]);
      });
      if (x.arms === "wave" && !reduced) {
        const id = expr;
        [
          [300, 0.7],
          [500, 1.02],
          [700, 0.7],
          [900, 1.02],
          [1150, 0.92],
        ].forEach(([ms, hx]) =>
          this.later(ms, () => {
            if (this.expr === id) s.rhx.to(hx);
          }),
        );
      }
      this.mouthShape = x.mouth ?? "none";
      clearTimeout(this.mouthT);
      s.mouth.to(x.mouth ? 1 : 0);
      if (x.mouth && x.life !== "talk") this.mouthT = setTimeout(() => s.mouth.to(0), 5000);
      s.blush.to(x.blush ? 1 : 0);
      s.dim.to(x.dim ?? 0);
      s.glow.to(x.glow ?? 1);
      this.rim = x.rim ?? null;
      this.life = reduced ? "still" : (x.life ?? "breathe");
      this.since = performance.now();
      this.evs = new Set();
      this.yawnT0 = 0;
      this.droop = 1;
      for (const tp of this.tapes) tp.style.opacity = "0";
      if (this.life === "fightSleep") this.startYawn();
      if (this.sound) Sound.play(XS[expr]);
      if (reduced) Object.values(s).forEach((sp) => sp.snap());
      else this.accent(x.accent);
      this.effect(x.effect);
      this.dirty = true;
    }
    accent(kind) {
      const s = this.s;
      switch (kind) {
        case "hop":
          s.squash.kick(-1.8);
          this.later(90, () => {
            s.y.kick(-1);
            s.squash.kick(3.4);
          });
          break;
        case "hop2":
          s.squash.kick(-2);
          this.later(90, () => {
            s.y.kick(-1.1);
            s.squash.kick(3.6);
          });
          this.later(420, () => {
            s.y.kick(-0.8);
            s.squash.kick(2.6);
          });
          break;
        case "jump":
          s.y.kick(-1.3);
          s.squash.kick(3);
          s.scale.kick(0.6);
          break;
        case "nod":
          s.tilt.kick(-55);
          s.y.kick(0.25);
          break;
        case "lift":
          s.y.kick(-0.45);
          s.squash.kick(1.6);
          s.tilt.kick(30);
          break;
        case "sink":
          s.y.kick(0.35);
          s.squash.kick(-2.6);
          break;
        case "shiver":
          for (let i = 0; i < 4; i++) this.later(i * 70, () => s.tilt.kick(i % 2 ? 70 : -70));
          break;
        case "hello":
          s.y.kick(-0.5);
          s.squash.kick(1.4);
          break;
        case "wink": {
          let keep;
          this.later(180, () => {
            keep = this.eyes;
            this.eyes = [keep[0], "happy"];
            this.dirty = true;
          });
          this.later(820, () => {
            if (keep && this.eyes[1] === "happy") {
              this.eyes = keep;
              this.dirty = true;
            }
          });
          s.tilt.kick(-30);
          break;
        }
      }
    }
    blink() {
      this.s.lid.to(0.05);
      this.later(130, () => this.s.lid.to(1));
    }
    blinkLoop() {
      if (reduced) return;
      this.later(rnd(2600, 6000), () => {
        const open = !/happy|closed|squint/.test(this.eyes.join());
        if (open && this.s.lid.target === 1) {
          this.blink();
          if (Math.random() < 0.3) this.later(380, () => this.blink());
        }
        this.blinkLoop();
      });
    }
    aliveTick() {
      this.later(rnd(3000, 6500), () => {
        if (this.alive && this.expr === "idle" && performance.now() - lastPointer > 1500) {
          const r = Math.random();
          if (r < 0.55) {
            this.s.gx.to(rnd(-0.9, 0.9));
            this.s.gy.to(rnd(-0.5, 0.4));
            this.later(rnd(900, 1600), () => {
              if (this.expr === "idle") {
                this.s.gx.to(0);
                this.s.gy.to(0);
              }
            });
          } else if (r < 0.75) {
            this.blink();
            this.later(260, () => this.blink());
          } else if (r < 0.82) this.visit("happy", 2200);
          else if (r < 0.9) this.visit("hm", 1600);
          else this.visit("sleepy", 2600);
        }
        this.aliveTick();
      });
    }
    visit(e, ms) {
      const snd = this.sound;
      this.sound = false;
      this.show(e);
      this.sound = snd;
      this.later(ms, () => {
        if (this.expr === e) {
          this.sound = false;
          this.show("idle");
          this.sound = snd;
        }
      });
    }
    effect(kind) {
      clearInterval(this.fxTimer);
      for (const c of [...this.fx.children])
        c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 })
          .finished.then(() => c.remove())
          .catch(() => c.remove());
      if (!kind || reduced || this.size < 40) return;
      if (kind === "dots") {
        const b = document.createElement("div");
        b.className = "mz-bubble";
        for (let i = 0; i < 3; i++) {
          const d = document.createElement("span");
          b.append(d);
          d.animate([{ opacity: 0.35 }, { opacity: 1 }, { opacity: 0.35 }], {
            duration: this.expr === "offline" ? 2000 : 1100,
            iterations: Infinity,
            delay: i * 180,
          });
        }
        this.fx.append(b);
        return;
      }
      if (kind === "nowifi") {
        const b = document.createElement("div");
        b.className = "mz-bubble mz-nowifi";
        b.innerHTML =
          '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 8.5a15 15 0 0 1 20 0" opacity=".35"/><path d="M5.5 12.2a10 10 0 0 1 13 0" opacity=".55"/><path d="M9 15.8a5 5 0 0 1 6 0"/><circle cx="12" cy="19.3" r="1.3" fill="currentColor" stroke="none"/><path d="M4 3l16 17" stroke="#ff8a7a"/></svg>';
        b.animate(
          [
            { opacity: 0.45, transform: "translateY(0)" },
            { opacity: 1, transform: "translateY(-3px)" },
            { opacity: 0.45, transform: "translateY(0)" },
          ],
          { duration: 2400, iterations: Infinity },
        );
        this.fx.append(b);
        return;
      }
      const spawn = {
        zzz: () => this.glyph("z", 80, 14, rnd(0.09, 0.13), 0.16, -0.3, 2600),
        zzzSoft: () => this.glyph("z", 80, 18, 0.08, 0.12, -0.22, 2400),
        heart: () => this.glyph("♥", 80, 20, 0.11, 0.04, -0.32, 1700, "#ff7aa2"),
        glints: () => this.glint(),
        hm: () => this.glyph("?", 82, 10, 0.16, 0.05, -0.12, 1400),
      }[kind];
      spawn();
      this.fxTimer = setInterval(spawn, { zzz: 1100, zzzSoft: 1800, heart: 900, glints: 360, hm: 5000 }[kind]);
      if (!kind.startsWith("zzz")) {
        const t = this.fxTimer;
        this.later(1700, () => clearInterval(t));
      }
    }
    glyph(ch, x, y, size, dx, dy, dur, color) {
      const g = document.createElement("span");
      g.className = "mz-glyph";
      g.textContent = ch;
      Object.assign(g.style, { left: `${x}%`, top: `${y}%`, fontSize: `${size}em`, color: color ?? "" });
      this.fx.append(g);
      g.animate(
        [
          { transform: "translate(-50%,-50%) scale(.85)", opacity: 0 },
          { opacity: 1, offset: 0.2 },
          { transform: `translate(calc(-50% + ${dx}em), calc(-50% + ${dy}em)) scale(1)`, opacity: 0 },
        ],
        { duration: dur, easing: "cubic-bezier(0.23,1,0.32,1)" },
      )
        .finished.then(() => g.remove())
        .catch(() => g.remove());
    }
    glint() {
      const g = document.createElement("span");
      g.className = "mz-twinkle";
      const a = rnd(-2.6, -0.5),
        r = rnd(0.46, 0.56);
      Object.assign(g.style, {
        left: `${50 + Math.cos(a) * r * 100}%`,
        top: `${46 + Math.sin(a) * r * 100}%`,
        fontSize: `${rnd(0.06, 0.1)}em`,
      });
      this.fx.append(g);
      g.animate(
        [
          { transform: "translate(-50%,-50%) scale(.6) rotate(0deg)", opacity: 0 },
          { transform: "translate(-50%,-50%) scale(1) rotate(45deg)", opacity: 1, offset: 0.35 },
          { transform: "translate(-50%,-50%) scale(.7) rotate(90deg)", opacity: 0 },
        ],
        { duration: 700 },
      )
        .finished.then(() => g.remove())
        .catch(() => g.remove());
    }
    uniforms(now) {
      const t = THEMES[this.theme],
        s = this.s;
      const [el, er] = this.eyes;
      const v = (sd) => ["hx", "hy", "hz"].map((c) => s[sd + c].value);
      const lv = v("l"),
        rv = v("r");
      const [la, lm, lb] = armSeg(-1, lv);
      const [ra, rm, rb] = armSeg(1, rv);
      let mouth = M[this.mouthShape];
      let mh = mouth[2],
        ma = Math.max(0, Math.min(1, s.mouth.value)),
        lid = Math.max(0.05, s.lid.value);
      // A real yawn: the mouth opens wide, the eyes squeeze, then it settles.
      const open = this.yawn(now);
      if (open > 0.001) {
        mouth = [7, 0.04 + 0.05 * open, 0];
        mh = 0.026 + 0.1 * open;
        ma = Math.max(ma, Math.min(1, open * 3));
        lid *= 1 - 0.8 * open;
      }
      if (this.life === "talk") mh *= 0.45 + 0.55 * Math.abs(Math.sin(now / 140) * Math.sin(now / 310 + 1));
      const small = this.size < 60;
      return {
        uYaw: -s.gx.value * 0.34,
        uPitch: -s.gy.value * 0.14,
        uGaze: [s.gx.value, -s.gy.value],
        uArmLA: la,
        uArmLM: lm,
        uArmLB: lb,
        uArmRA: ra,
        uArmRM: rm,
        uArmRB: rb,
        uFur: lin(t.fur),
        uTip: lin(t.tip),
        uRim: this.rim ? mixHex(t.rim, this.rim, 0.75) : lin(t.rim),
        uRimI: t.rimI * (small ? 1.35 : 1) * (this.rim ? 1.25 : 1),
        uKey: [3.8, 3.7, 3.5],
        uDim: s.dim.value,
        uFurAmp: 0.018,
        uDetail: 44,
        uBump: t.bump * 0.52,
        uMicro: Math.min(0.88, t.micro + 0.24),
        uTipK: 0.28,
        uEyeCore: t.core,
        uEyeEdge: t.edge,
        uEmissive: t.emissive,
        uGlow: s.glow.value * (small ? 1.15 : 1),
        uGlint: t.emissive ? 0 : 1,
        uEyeL: [9, 0, 0, 0],
        uEyeR: [9, 0, 0, 0],
        uEyeLB: [LID[el] ?? 1, 0, 0, 0],
        uEyeRB: [LID[er] ?? 1, 0, 0, 0],
        uLid: Math.max(0.05, lid),
        uMouth: [mouth[0], mouth[1], mh, ma],
        uBlush: Math.max(0, s.blush.value),
        uZoom: (this.bust ? 0.78 : 1.06) * this.bleed,
        uCamY: this.bust ? 0.24 : 0.02,
        uWig: 1,
        uWigCol: lin("#1c1714"),
      };
    }
    startYawn() {
      this.yawnT0 = performance.now();
      this.dirty = true;
    }
    /** A real yawn, about 2.6 s: opens on a breath in, holds with a little tremble, closes with an "mm". */
    yawn(now) {
      if (this.yawnT0) {
        const t = (now - this.yawnT0) / 1000;
        if (t > 2.6) return 0;
        const eo = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3,
          io = (x) => {
            x = Math.min(1, Math.max(0, x));
            return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
          };
        if (t < 0.55) return 0.3 * eo(t / 0.55);
        if (t < 1.0) return 0.3 + 0.7 * eo((t - 0.55) / 0.45);
        if (t < 1.75) return 1 + 0.035 * Math.sin((t - 1) * 2 * Math.PI * 5.5);
        if (t < 2.25) return 1 - io((t - 1.75) / 0.5);
        return 0.13 * Math.sin((Math.PI * (t - 2.25)) / 0.35);
      }
      if (this.life !== "yawn") return 0;
      const t = (now + this.size * 97) % 6500;
      if (t > 2200) return 0;
      const ease = (x) => x * x * (3 - 2 * x);
      if (t < 800) return ease(t / 800);
      if (t < 1500) return 1;
      return 1 - ease((t - 1500) / 700);
    }
    scene(now) {
      const e = (x) => {
        x = Math.min(1, Math.max(0, x));
        return x * x * (3 - 2 * x);
      };
      const bump = (x, a, d) => (x > a && x < a + d ? Math.sin((Math.PI * (x - a)) / d) : 0);
      const t = (now - this.since) / 1000;
      let ly = 0,
        lr = 0,
        droop = 1,
        br = 1;
      if (this.life === "nodOff") {
        const p = (t % 4.6) / 4.6;
        droop = p < 0.72 ? 1 - 0.7 * e(p / 0.72) : p < 0.8 ? 0.3 + 0.7 * e((p - 0.72) / 0.08) : 1;
        ly = (1 - droop) * 0.03 - (p >= 0.72 && p < 0.86 ? 0.015 * Math.sin((Math.PI * (p - 0.72)) / 0.14) : 0);
        lr = (1 - droop) * 4;
        if (this.sound && p >= 0.72 && this.mark(Math.floor(t / 4.6) + "catch")) Sound.play("startle");
      } else if (this.life === "fightSleep") {
        // It has to stay up: lids sink and flicker, shut as the head nods, then a "brrr" shake and the eyes pop
        // open. Every third time tape holds the lids up instead, and every other shake ends in another yawn.
        const ct = t - 2.8,
          k = Math.floor(Math.max(0, ct) / 8),
          c = Math.max(0, ct) - k * 8,
          tape = k % 3 === 2;
        const ev = (name, when) => c >= when && ct >= 0 && this.mark(k + name);
        if (ct < 0) droop = 1;
        else if (!tape) {
          if (c < 0.6) droop = 1;
          else if (c < 3) droop = 1 - 0.94 * e((c - 0.6) / 2.4) + 0.28 * bump(c, 1.5, 0.3) + 0.16 * bump(c, 2.3, 0.25);
          else if (c < 5.4) {
            droop = 0.06;
            ly += 0.028 * e((c - 3) / 0.8);
            lr += 7 * e((c - 3) / 1.2) + 2 * Math.sin((c - 3) * 2.2);
          } else if (c < 6.2) {
            const u = (c - 5.4) / 0.8,
              dec = 1 - u;
            lr += 16 * Math.sin(u * 2 * Math.PI * 4.5) * dec + 7 * (1 - e(u * 3));
            ly += 0.028 * (1 - e(u * 4));
            droop = u < 0.08 ? 0.06 : 1.18 - 0.18 * e((u - 0.1) / 0.9);
          } else droop = 1 - 0.12 * e((c - 6.2) / 1.8);
          if (ev("z", 3.3)) {
            this.glyph("z", 74, 14, 0.09, 0.12, -0.24, 2200);
            if (this.sound) Sound.play("doze");
          }
          if (ev("shake", 5.4)) {
            if (this.sound) Sound.play("shake");
            this.s.y.kick(-0.5);
            this.s.squash.kick(1.2);
          }
          if (k % 2 === 1 && ev("yawn", 6.4)) {
            this.startYawn();
            if (this.sound) Sound.play("yawn");
          }
        } else {
          if (c < 0.6) droop = 1;
          else if (c < 2.5) droop = 1 - 0.72 * e((c - 0.6) / 1.9);
          else if (c < 6) {
            const u = c - 2.5;
            droop =
              1.16 + 0.04 * Math.sin(u * 2 * Math.PI * 3.2) - 0.1 * Math.max(0, Math.sin(u * 2 * Math.PI * 0.9)) ** 6;
            const on = e(u / 0.12),
              peel = e((c - 5.6) / 0.4);
            this.tapes.forEach((x, i) => {
              x.style.opacity = String(on * (1 - peel));
              x.style.transform = `translateY(${-6 * peel}%) rotate(${(i ? 1 : -1) * (8 + 50 * peel)}deg) scale(${1.25 - 0.25 * on})`;
            });
            lr += 0.8 * Math.sin(u * 2 * Math.PI * 6);
            br = 1.01;
          } else droop = 1.16 - 0.5 * e((c - 6) / 1.2) + 0.34 * e((c - 7.4) / 0.5);
          if (c < 2.5 || c >= 6) this.tapes.forEach((x) => (x.style.opacity = "0"));
          if (ev("tape", 2.5)) {
            if (this.sound) Sound.play("tapeOn");
            this.s.y.kick(-0.35);
          }
          if (ev("peel", 5.6) && this.sound) Sound.play("tapeOff");
        }
      } else return null;
      this.droop = droop;
      return { ly, lr, breathe: br };
    }
    mark(key) {
      if (this.evs.has(key)) return false;
      this.evs.add(key);
      return true;
    }
    /** Puts the app's eyes on the face, following the 3D turn of the body. */
    placeEyes(now) {
      const s = this.s,
        size = this.size;
      const t = EYE_INK[this.theme];
      const st = this.el.style;
      st.setProperty("--eye", t[0]);
      st.setProperty("--glow", t[1]);
      st.setProperty("--eglow", String(t[2] * Math.max(0.2, s.glow.value)));
      const open = this.yawn(now);
      const shapes = open > 0.35 ? ["yawnL", "yawnR"] : this.eyes;
      const key = shapes.join();
      if (key !== this.eyeKey) {
        this.eyeKey = key;
        this.eyeSvgs[0].innerHTML = APP_EYES[shapes[0]];
        this.eyeSvgs[1].innerHTML = APP_EYES[shapes[1]];
      }
      const zoom = this.bust ? 0.78 : 1.06,
        camY = this.bust ? 0.24 : 0.02;
      const yaw = -s.gx.value * 0.34,
        pitch = -s.gy.value * 0.14;
      const cy = Math.cos(yaw),
        sy = Math.sin(yaw),
        cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      // world = rot^T (obj - pivot) + pivot, rot = rx * ry (as in the shader)
      const R = [
        [cy, 0, sy],
        [sp * sy, cp, -sp * cy],
        [-cp * sy, sp, cp * cy],
      ];
      const toWorld = (o) => {
        const q = [o[0], o[1] + 0.1, o[2]];
        return [
          R[0][0] * q[0] + R[1][0] * q[1] + R[2][0] * q[2],
          R[0][1] * q[0] + R[1][1] * q[1] + R[2][1] * q[2] - 0.1,
          R[0][2] * q[0] + R[1][2] * q[1] + R[2][2] * q[2],
        ];
      };
      const gx = s.gx.value * 0.05,
        gy = -s.gy.value * 0.035;
      const c = toWorld([gx, 0.19 + gy, 0.57]);
      const camZ = 5.4,
        camYw = 0.06 + camY;
      const k = 1 / (camZ - c[2]) / (2 * 0.205 * zoom);
      const ux = c[0] * k,
        uy = (c[1] - camYw) * k;
      const px = (0.5 + ux) * size,
        py = (0.5 - uy) * size;
      const scale = (camZ / (camZ - c[2])) * (2.21 / (2.21 * zoom));
      const unit = size / (2 * 0.205 * zoom * camZ); // px per world unit at the face
      st.setProperty("--ew", `${0.23 * unit * scale}px`);
      st.setProperty("--eh", `${0.345 * unit * scale}px`);
      st.setProperty("--gap", `${0.09 * unit * scale * Math.cos(yaw)}px`);
      const lid =
        Math.max(0.05, s.lid.value) *
        (open > 0.001 && open <= 0.35 ? 1 - 0.8 * open : 1) *
        (open > 0.35 ? 1 : Math.max(0.04, this.droop ?? 1));
      this.eyesEl.style.transform = `translate(${px}px, ${py}px)`;
      // Heavy lids come down from the top, so the pair shrinks toward its lower edge.
      this.pairEl.style.transformOrigin = this.life === "fightSleep" || this.life === "nodOff" ? "50% 78%" : "50% 50%";
      this.pairEl.style.transform = `scaleY(${lid})`;
      const half = `calc((var(--ew) + var(--gap)) / 2)`;
      this.tapes[0].style.left = `calc(-1 * ${half})`;
      this.tapes[1].style.left = half;
    }
    render(now) {
      if (R.draw(this.uniforms(now), this.res, this.res, this.ctx)) this.dirty = false;
    }
    place(now) {
      const s = this.s,
        size = this.size;
      const sq = s.squash.value * 0.08,
        sc = s.scale.value;
      let breathe = 1,
        sway = 0;
      if (this.life === "breathe" || this.life === "talk") breathe = 1 + 0.01 * Math.sin(now / 760);
      if (this.life === "pulse") breathe = 1 + 0.02 * Math.sin(now / 210);
      if (this.life === "sway") sway = 2.2 * Math.sin(now / 800);
      if (this.life === "yawn") {
        sway = 1.8 * Math.sin(now / 900);
        breathe = 1 / (1 + 0.035 * this.yawn(now));
      }
      let ly = 0;
      const sc2 = this.scene(now);
      if (sc2) {
        ly = sc2.ly;
        sway += sc2.lr;
        breathe *= sc2.breathe;
      }
      const yo = this.yawn(now);
      if (yo > 0.001 && this.yawnT0) {
        ly -= 0.03 * Math.min(1, yo);
        breathe *= 1 / (1 + 0.05 * Math.min(1, yo));
        sway -= 3 * Math.min(1, yo);
      }
      this.move.style.transform = `translate(${s.px.value}px, ${s.py.value + (s.y.value + ly) * size}px) rotate(${s.tilt.value + sway}deg) scale(${sc * (1 + sq) * breathe}, ${(sc * (1 - sq)) / breathe})`;
      this.placeEyes(now);
      if (this.shadow) {
        const lift = Math.max(0, -s.y.value) * 6;
        this.shadow.style.scale = `${1 / (1 + lift)}`;
        this.shadow.style.opacity = String(1 / (1 + lift * 1.6));
      }
    }
  }

  // One loop for every creature; it sleeps while none is on screen.
  const shaderKeys = ["gx", "gy", "lid", "lhx", "lhy", "lhz", "rhx", "rhy", "rhz", "mouth", "blush", "dim", "glow"];
  let last = performance.now();
  let cursor = 0;
  let raf = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t0 = performance.now();
    // Start where the last frame stopped, so a busy creature never starves the rest.
    const order = all.slice(cursor).concat(all.slice(0, cursor));
    cursor = (cursor + 1) % Math.max(1, all.length);
    let busy = false;
    for (const m of order) {
      if (!m.active) continue;
      busy = true;
      const springs = m.s;
      let moving = false;
      for (const k in springs) {
        const sp = springs[k];
        if (sp.resting) continue;
        const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
        for (let i = 0; i < steps; i++) sp.step(dt / steps);
        if (shaderKeys.includes(k)) moving = true;
      }
      if (
        moving ||
        m.life === "talk" ||
        ((m.life === "yawn" || m.yawnT0) && (m.yawn(now) > 0 || now - m.yawnT0 < 2700))
      )
        m.dirty = true;
      m.place(now);
      if (m.dirty && performance.now() - t0 < 12) m.render(now);
    }
    if (busy && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const wake = () => {
    if (!raf && all.length) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  // Mark every creature dirty and run a frame (also used after WebGL restore).
  const dirt = () => {
    for (const m of all) m.dirty = true;
    wake();
  };
  R.onRestore = dirt;
  // Screen lock / sleep often clears canvas pixels without a context-loss event.
  const onVisible = () => {
    if (document.hidden) return;
    dirt();
    requestAnimationFrame(dirt); // GPU may need one more frame after unlock
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pageshow", onVisible);
  window.addEventListener("focus", onVisible);

  Mascot.prototype.gaze = function (x, y) {
    lastPointer = performance.now();
    if (this.gazeLocked) return;
    this.s.gx.to(x);
    this.s.gy.to(y);
    wake();
  };
  Mascot.prototype.pull = function (x, y) {
    if (reduced) return;
    this.s.px.to(x);
    this.s.py.to(y);
    wake();
  };
  Mascot.prototype.setActive = function (on) {
    this.active = on;
    if (on) {
      this.dirty = true;
      wake();
    }
  };
  Mascot.prototype.setAlive = function (on) {
    this.alive = on;
  };
  Mascot.prototype.destroy = function () {
    for (const t of this.timers) clearTimeout(t);
    clearTimeout(this.mouthT);
    clearInterval(this.fxTimer);
    clearTimeout(this.release);
    this.timers.clear();
    const i = all.indexOf(this);
    if (i >= 0) all.splice(i, 1);
    this.el.remove();
  };
  // Any change of mood or colour wakes the loop.
  for (const k of ["show", "setTheme", "later"]) {
    const f = Mascot.prototype[k];
    Mascot.prototype[k] = function (...a) {
      const r = f.apply(this, a);
      wake();
      return r;
    };
  }
  return { Mascot, THEMES, EXPRESSIONS: X, wake };
}

/** True while a later look might still find a GPU. */
export function creatureMayRetry() {
  return !api && !failed;
}

/** True when this machine can draw the creature (WebGL 2). */
export function creatureSupported() {
  if (!api && !failed && typeof window !== "undefined") api = boot();
  return !!api;
}

let soundHook = null;
/** Who plays the mascot's life sounds; null keeps it quiet. */
export function setCreatureSound(fn) {
  soundHook = fn;
}

export function createCreature(slot, opts) {
  if (!creatureSupported()) return null;
  const m = new api.Mascot(slot, { follow: false, ...opts });
  m.active = opts.active ?? true;
  api.wake();
  return m;
}
