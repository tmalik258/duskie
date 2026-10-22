// The grain wash shader and the WebGL program that draws it: one triangle
// covering the canvas.

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec3 a;uniform vec3 b;uniform vec3 c;uniform float e;uniform vec4 pu;uniform float g;uniform float gt;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,m=.5;for(int i=0;i<5;i++){s+=m*n(p);p=p*2.03+vec2(1.7,9.2);m*=.5;}return s;}
void main(){
 vec2 uv=gl_FragCoord.xy/r; float asp=r.x/r.y; vec2 q=vec2(uv.x*asp,uv.y);
 float tt=t*.05;
 vec2 w=vec2(fbm(q*1.1+vec2(tt,tt*.6)),fbm(q*1.1-vec2(tt*.8,-tt)+4.));
 float f1=fbm(q*1.05+w*1.7+vec2(tt*.6,-tt*.4));
 float f2=fbm(q*1.5-w*1.3+vec2(-tt*.5,tt*.7)+7.);
 vec3 col=vec3(.03,.033,.031);
 float top=smoothstep(1.,0.,length((uv-vec2(.5,1.04))*vec2(1.05,1.9)));
 col+=a*smoothstep(.38,.95,f1)*(.12+.42*e);
 col+=b*smoothstep(.48,1.,f2)*(.08+.34*e);
 col+=mix(a,c,.5)*top*(.05+.2*e);
 vec2 pp=vec2(pu.x,1.-pu.y); float d=length((uv-pp)*vec2(asp,1.));
 float age=pu.z; float rad=age*.62;
 float ring=exp(-pow((d-rad)*6.,2.))*pu.w*exp(-age*1.5);
 col+=(a*.55+c*.12)*ring;
 col+=a*exp(-d*3.5)*pu.w*exp(-age*2.6)*.35;
 col*=mix(.6,1.,smoothstep(1.3,.2,length(uv-vec2(.5,.62))));
 col+=(h(gl_FragCoord.xy+gt*91.7)-.5)*g;
 gl_FragColor=vec4(col,1.);
}`;

export const UNIFORMS = ["r", "t", "a", "b", "c", "e", "pu", "g", "gt"] as const;
export type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

/** Compiles and binds the program; null when WebGL refuses it. */
export function setupProgram(gl: WebGLRenderingContext): Uniforms | null {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error("no shader");
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const program = gl.createProgram();
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  } catch {
    return null;
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return Object.fromEntries(UNIFORMS.map((k) => [k, gl.getUniformLocation(program, k)])) as Uniforms;
}
