// @ts-nocheck
// biome-ignore-all lint: ported as is from the Mascot Lab prototype; keep the two in step.
// Springs and arm geometry for the creature.

import { lin } from "./fur-themes";

export class Spring {
  constructor(v, response, zeta) {
    this.value = v;
    this.target = v;
    this.vel = 0;
    this.k = ((2 * Math.PI) / response) ** 2;
    this.c = (4 * Math.PI * zeta) / response;
  }
  to(t) {
    this.target = t;
  }
  kick(v) {
    this.vel += v;
  }
  step(dt) {
    const a = -this.k * (this.value - this.target) - this.c * this.vel;
    this.vel += a * dt;
    this.value += this.vel * dt;
  }
  get resting() {
    return Math.abs(this.vel) < 1e-3 && Math.abs(this.value - this.target) < 1e-3;
  }
  snap() {
    this.value = this.target;
    this.vel = 0;
  }
}

// One straight stubby arm, like Doraemon's: sewn on at the middle of the side, just below the eyes,
// it swings as a whole toward the paw target and never bends.
export const ARM_LEN = 0.6;
export function armSeg(side, h) {
  const S = [0.54 * side, 0.2, 0.08];
  const d = [h[0] * side - S[0], h[1] - S[1], h[2] - S[2]];
  const n = Math.hypot(...d) || 1e-4;
  const u = d.map((v) => v / n);
  const B = S.map((v, i) => v + u[i] * ARM_LEN);
  // Bow the middle outward and a touch down, so the arm curves like a stuffed limb.
  let o = [side, -0.35, 0];
  const k = o[0] * u[0] + o[1] * u[1] + o[2] * u[2];
  o = o.map((v, i) => v - k * u[i]);
  const ol = Math.hypot(...o) || 1;
  const M = S.map((v, i) => (v + B[i]) / 2 + (o[i] / ol) * 0.09);
  return [S, M, B];
}
export const mixHex = (a, b, t) => {
  const A = lin(a),
    B = lin(b);
  return A.map((v, i) => v + (B[i] - v) * t);
};
