// @ts-nocheck
// biome-ignore-all lint: ported as is from the Mascot Lab prototype; keep the two in step.
// The fur body shape, joined onto the shader head in shaders.ts.

export const SHAPE_GLSL = `// ---- shape ----
float sdRBox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b+r;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return min(a,b)-h*h*k*0.25;}
float sdEll(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.0)/k1;}
float sdCone(vec3 p,vec3 a,vec3 b,float r1,float r2){
  vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h)-mix(r1,r2,h);
}
// A soft plush arm: one even, round tube that bows gently through M (a curve, never a joint)
// and swells a little into a round paw at B.
vec3 bez(vec3 a,vec3 m,vec3 b,float t){float u=1.0-t;return u*u*a+2.0*u*t*m+t*t*b;}
float arm(vec3 p,vec3 a,vec3 m,vec3 b){
  // Distance to one smooth curved tube: find the nearest point on the curve (start from the
  // straight line, then two tangent steps), so the surface is seamless along its whole length.
  vec3 ab=b-a;
  float t=clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0);
  for(int i=0;i<2;i++){
    vec3 c=bez(a,m,b,t);
    vec3 tg=2.0*((1.0-t)*(m-a)+t*(b-m));
    t=clamp(t+dot(p-c,tg)/max(dot(tg,tg),1e-4),0.0,1.0);
  }
  float r=0.17+0.045*t*t*t;
  return length(p-bez(a,m,b,t))-r;
}
mat3 rot;
vec3 toObj(vec3 p){return rot*(p-vec3(0.0,-0.1,0.0))+vec3(0.0,-0.1,0.0);}
// The body is designed tall and drawn squashed: everything is 12% shorter.
const float HS=0.88;
vec3 design(vec3 p){return vec3(p.x,(p.y+0.86)/HS-0.86,p.z);}
// A dark hair cap with a wavy fringe over the forehead.
float wigMask(vec3 q){
  float edge=0.69+0.05*snoise(q*8.0)-0.03*smoothstep(0.15,0.5,q.z);
  // Hands raised into the hair zone stay furry, not haired.
  float ad=min(arm(q,uArmLA,uArmLM,uArmLB),arm(q,uArmRA,uArmRM,uArmRB));
  return smoothstep(edge-0.05,edge+0.04,q.y)*smoothstep(0.03,0.16,ad)*uWig;
}
float body(vec3 p){
  p=design(p);
  // Measured from the reference: an egg, narrower at the top, full at the bottom; a slimmer face.
  float taper=1.0+0.14*smoothstep(0.15,0.85,p.y);
  vec3 pt=vec3(p.x*taper,p.y,p.z);
  float egg=sdEll(pt-vec3(0.0,0.08,0.0),vec3(0.67,0.9,0.6));
  float dome=sdEll(pt-vec3(0.0,0.45,0.0),vec3(0.5,0.53,0.53));
  float low=sdEll(p-vec3(0.0,-0.36,0.03),vec3(0.67,0.48,0.59));
  float d=smin(smin(egg,dome,0.2),low,0.25);
  // An afro: a round, full cloud of tight coils sitting on the head.
  float afro=sdEll(p-vec3(0.0,0.88,-0.06),vec3(0.58,0.5,0.56));
  d=smin(d,afro,0.26);
  // Round bean feet peeking out in front.
  float fl=sdEll(p-vec3(-0.27,-0.87,0.13),vec3(0.2,0.11,0.2));
  float fr=sdEll(p-vec3(0.27,-0.87,0.13),vec3(0.2,0.11,0.2));
  d=smin(d,min(fl,fr),0.07);
  // Teardrop arms like the reference: thin where they leave the body, a round mitten at the end.
  float al=arm(p,uArmLA,uArmLM,uArmLB);
  float ar=arm(p,uArmRA,uArmRM,uArmRB);
  // Melt in at the shoulder, stay separate from the elbow down, so a hand can rest on the face.
  float kl=mix(0.16,0.012,clamp(length(p-uArmLA)/0.3,0.0,1.0));
  float kr=mix(0.16,0.012,clamp(length(p-uArmRA)/0.3,0.0,1.0));
  d=smin(d,al,kl);
  d=smin(d,ar,kr);
  d-=wigMask(p)*0.02;
  return d*HS;
}
float curls(vec3 p){
  vec3 q=p*uDetail;
  float grain=smoothstep(-0.15,0.8,snoise(q));
  float c=1.0-abs(snoise(q*2.3+vec3(7.0,1.3,4.1)));
  c=c*c*c*c;
  return clamp(grain*0.72+c*0.38,0.0,1.0);
}
float hair(vec3 q){float clump=smoothstep(-0.2,0.75,snoise(q*19.0));float a=1.0-abs(snoise(q*44.0+vec3(5.0)));a=a*a*a;return clamp(clump*0.7+a*0.45,0.0,1.0);}
float map(vec3 p){
  float d=body(p);
  if(d<0.08){
    vec3 q=design(p);
    float w=wigMask(q);
    d-=uFurAmp*curls(p)*(1.0-w)+w*0.06*hair(q);
  }
  return d*0.8;
}
vec3 normalAt(vec3 p){
  const vec2 k=vec2(1.0,-1.0);
  float e=0.0025;
  return normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));
}
vec3 baseNormal(vec3 p){
  const vec2 k=vec2(1.0,-1.0);
  float e=0.01;
  return normalize(k.xyy*body(p+k.xyy*e)+k.yyx*body(p+k.yyx*e)+k.yxy*body(p+k.yxy*e)+k.xxx*body(p+k.xxx*e));
}
float ao(vec3 p,vec3 n){
  float o=0.0,s=1.0;
  for(int i=1;i<=5;i++){float h=0.015+0.05*float(i);float d=body(p+n*h);o+=(h-d)*s;s*=0.7;}
  return clamp(1.0-2.4*o,0.0,1.0);
}

`;
