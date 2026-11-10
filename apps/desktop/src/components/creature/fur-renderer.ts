// @ts-nocheck
// biome-ignore-all lint: ported as is from the Mascot Lab prototype; keep the two in step.
// The shared WebGL 2 renderer that draws every creature.

import { FRAG, VERT } from "./shaders";

export class FurRenderer {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = 640;
    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      alpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.lost = false;
    // Kept from the start: the extension cannot be fetched once the context is gone.
    const loser = gl.getExtension("WEBGL_lose_context");
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      // The browser does not always give the context back after a GPU reset; ask for it.
      setTimeout(() => {
        if (this.lost) loser?.restoreContext();
      }, 1500);
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.init();
      this.lost = false;
      this.onRestore?.();
    });
    this.init();
  }
  init() {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      this.u[info.name] = gl.getUniformLocation(prog, info.name);
    }
  }

  /** Renders `params` at w x h pixels and copies it into `target` (a 2D canvas context). */
  draw(params, w, h, target) {
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return false;
    if (w > this.canvas.width || h > this.canvas.height) {
      this.canvas.width = Math.max(w, this.canvas.width);
      this.canvas.height = Math.max(h, this.canvas.height);
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const [k, v] of Object.entries(params)) {
      const loc = this.u[k];
      if (!loc) continue;
      if (typeof v === "number") gl.uniform1f(loc, v);
      else if (v.length === 2) gl.uniform2fv(loc, v);
      else if (v.length === 3) gl.uniform3fv(loc, v);
      else gl.uniform4fv(loc, v);
    }
    gl.uniform2f(this.u.uRes, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    target.clearRect(0, 0, target.canvas.width, target.canvas.height);
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = "high";
    target.drawImage(this.canvas, 0, this.canvas.height - h, w, h, 0, 0, target.canvas.width, target.canvas.height);
    return true;
  }
}
