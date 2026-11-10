// @ts-nocheck
// biome-ignore-all lint: ported as is from the Mascot Lab prototype; keep the two in step.
// The 2D face marks and final colour, joined onto the shader head in shaders.ts.

export const FACE_GLSL = `// ---- 2D face marks ----
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h);}
float sdArc(vec2 p,float ap,float ra,float rb){vec2 sc=vec2(sin(ap),cos(ap));p.x=abs(p.x);return((sc.y*p.x>sc.x*p.y)?length(p-sc*ra):abs(length(p)-ra))-rb;}
float sdEll2(vec2 p,vec2 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.0)/max(k1,1e-4);}
// type 0 ellipse (+ slanted top lid), 1 arc up (happy), 2 arc down (closed), 3 chevron, side = -1 left, 1 right
float eyeD(vec2 q,vec4 e,vec4 b,float side){
  float t=e.x;
  if(t>8.5) return 1.0;   // eyes drawn by the page on top (the app's own eyes)
  if(t<0.5){
    vec2 r=vec2(e.y,e.z*uLid);
    float d=sdEll2(q,r);
    float lid=b.x-e.w*q.x*side;      // top lid line, slanted toward the nose
    d=max(d,q.y-lid*uLid);
    return d;
  }
  if(t<1.5) return sdArc(q-vec2(0.0,-e.w*0.55),1.05,e.w,e.z);
  if(t<2.5) return sdArc(vec2(q.x,-q.y)-vec2(0.0,-e.w*0.75),0.85,e.w,e.z);
  float s=side;
  vec2 a=vec2(-0.045*s,0.05),c=vec2(0.04*s,0.0),d2=vec2(-0.045*s,-0.05);
  return min(sdSeg(q,a,c),sdSeg(q,c,d2))-e.z;
}
float mouthD(vec2 q){
  float t=uMouth.x,w=uMouth.y,h=uMouth.z;
  if(t<0.5) return 1.0;
  if(t<1.5) return sdArc(vec2(q.x,-q.y)-vec2(0.0,-w*0.9),0.9,w,h);        // smile
  if(t<2.5){float d=sdEll2(q,vec2(w,h));return max(d,q.y-h*0.25);}       // grin
  if(t<3.5 || t>6.5) return sdEll2(q,vec2(w,h));                                   // o / small
  if(t<4.5) return sdSeg(q,vec2(-w,0.0),vec2(w,0.0))-h;                   // flat
  if(t<5.5) return sdArc(q-vec2(0.0,-w*0.9),0.9,w,h);                     // frown
  vec2 r=vec2(abs(q.x)-w*0.5,q.y);                                        // cat
  return sdArc(vec2(r.x,-r.y)-vec2(0.0,-w*0.45),1.2,w*0.5,h);
}
// Face marks in object space (x, y) on the front of the head.
vec3 face(vec2 uv,out float mask,out float glowD){
  vec2 g=uGaze*vec2(0.05,0.035);
  vec2 cl=vec2(-0.18,0.19)+uEyeLB.zw+g;
  vec2 cr=vec2(0.18,0.19)+uEyeRB.zw+g;
  float dl=eyeD(uv-cl,uEyeL,uEyeLB,-1.0);
  float dr=eyeD(vec2(uv.x,uv.y)-cr,uEyeR,uEyeRB,1.0);
  float dm=mouthD(uv-vec2(0.0,-0.1)-g*0.6);
  float de=min(dl,dr);
  float d=min(de,uMouth.w>0.01?dm+(1.0-uMouth.w)*0.02:1.0);
  glowD=d;
  float aa=2.6*uZoom/uRes.y+0.002;
  mask=1.0-smoothstep(-aa,aa,d);
  if(uMouth.w<1.0 && dm<de) mask*=uMouth.w;
  float inner=clamp(-d/0.05,0.0,1.0);
  vec3 col=mix(uEyeEdge,uEyeCore,smoothstep(0.0,0.8,inner));
  // A yawning mouth is dark inside with a warm lip.
  if(uMouth.x>6.5 && dm<de) col=mix(uEyeEdge*0.9,uEyeEdge*0.12,smoothstep(0.1,0.55,clamp(-dm/0.04,0.0,1.0)));
  // A tiny glint on ink eyes.
  if(uGlint>0.5){
    float gl=length(uv-(cl+vec2(0.03,0.055)*uLid))-0.022;
    float gr=length(uv-(cr+vec2(0.03,0.055)*uLid))-0.022;
    col=mix(col,vec3(2.2),(1.0-smoothstep(-aa,aa,min(gl,gr)))*step(uEyeL.x,0.5));
  }
  return col;
}

void main(){
  vec2 frag=gl_FragCoord.xy;
  vec2 uv=(frag-0.5*uRes)/uRes.y;
  float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
  mat3 ry=mat3(cy,0.0,-sy, 0.0,1.0,0.0, sy,0.0,cy);
  mat3 rx=mat3(1.0,0.0,0.0, 0.0,cp,sp, 0.0,-sp,cp);
  rot=rx*ry;
  vec3 ro=vec3(0.0,0.06+uCamY,5.4);
  vec3 rd=normalize(vec3(uv*2.0*0.205*uZoom,-1.0));
  rd=normalize(rd+vec3(0.0,-0.012,0.0));
  // Into object space.
  vec3 o=toObj(ro), dir=normalize(rot*rd);

  // Bounding sphere.
  vec3 bc=vec3(0.0,-0.05,0.0);
  float bR=1.35;
  vec3 oc=o-bc; float bb=dot(oc,dir); float cc=dot(oc,oc)-bR*bR; float disc=bb*bb-cc;
  vec4 col=vec4(0.0);
  float glowAcc=0.0;
  if(disc>0.0){
    float t=max(-bb-sqrt(disc),0.0), tEnd=-bb+sqrt(disc);
    bool hit=false; vec3 p;
    float minD=1e3; vec3 pc=o;
    for(int i=0;i<110;i++){
      p=o+dir*t;
      float d=body(p);
      if(d<0.08) d=map(p);
      if(d<minD){minD=d;pc=p;}
      if(d<0.0006*t){hit=true;break;}
      t+=max(d,0.0012);
      if(t>tEnd) break;
    }
    if(hit){
      vec3 n=normalAt(p);
      vec3 nb=baseNormal(p);
      vec3 nd=normalize(mix(nb,n,uBump));
      vec3 nr=normalize(mix(nb,n,0.25));
      float a=ao(p,nb);
      float tip=curls(p);
      vec3 v=-dir;
      // Lights live in world space; bring them into object space.
      vec3 kd=normalize(rot*vec3(-0.6,0.7,0.62));
      vec3 rd2=normalize(rot*vec3(0.75,0.35,-0.65));
      vec3 fd=normalize(rot*vec3(0.6,-0.2,0.8));
      float wrap=0.22;
      float dk=max((dot(nd,kd)+wrap)/(1.0+wrap),0.0);
      float df=max(dot(nd,fd),0.0);
      float fres=pow(1.0-max(dot(nr,v),0.0),2.5);
      float rimTerm=fres*(0.12+0.88*max(dot(nr,rd2)+0.3,0.0));
      vec3 h=normalize(kd+v);
      float sheen=pow(max(dot(n,h),0.0),12.0)*0.1*tip;
      vec3 alb=mix(uFur,uTip,pow(tip,2.0)*0.8*uTipK);
      vec3 qd=design(p);
      float wg=wigMask(qd);
      float strand=hair(qd);
      alb=mix(alb,mix(uWigCol*0.5,uWigCol*3.2,strand*strand),wg);
      float micro=mix(uMicro,1.0,tip);
      vec3 c=alb*(uKey*dk*(1.0-uDim*0.6)+vec3(0.07,0.075,0.085)*df+vec3(0.08,0.082,0.09)*(0.4+0.6*nb.y)+vec3(0.02))*a*micro;
      c+=uKey*sheen*a*(1.0-uDim*0.7);
      c+=wg*uKey*vec3(0.9,0.85,0.8)*0.2*pow(max(dot(nd,normalize(kd+v)),0.0),16.0)*strand*a;
      c+=alb*uKey*0.6*pow(1.0-max(dot(nr,v),0.0),1.25)*max(dot(nb,kd)+0.35,0.0)*a;
      c+=uRim*rimTerm*uRimI*(0.5+0.5*a);
      vec3 wd=normalize(rot*vec3(-0.85,0.25,-0.45));
      c+=uKey*vec3(1.0,0.82,0.62)*fres*max(dot(nr,wd)+0.15,0.0)*0.22*a;
      // Eye light spilling onto the fur around the eyes.
      if(uEmissive>0.5){
        vec3 el=vec3(-0.15,0.19,0.62), er=vec3(0.15,0.19,0.62);
        vec3 le=el-p, re=er-p;
        float sl=max(dot(n,normalize(le)),0.0)/(1.0+60.0*dot(le,le));
        float sr=max(dot(n,normalize(re)),0.0)/(1.0+60.0*dot(re,re));
        c+=uEyeEdge*(sl+sr)*uGlow*0.95*(0.35+tip);
      }
      // Blush.
      float bl=exp(-dot(p.xy-vec2(-0.25,0.03),p.xy-vec2(-0.25,0.03))*110.0)+exp(-dot(p.xy-vec2(0.25,0.03),p.xy-vec2(0.25,0.03))*110.0);
      c+=vec3(1.0,0.38,0.52)*bl*uBlush*0.35*step(0.0,p.z);
      // Face marks on the front.
      if(p.z>0.15){
        float m,gd;
        vec3 fc=face(p.xy,m,gd);
        float facing=smoothstep(0.15,0.45,p.z);
        m*=facing;
        vec3 ink=uEmissive>0.5?fc*1.25:fc;
        c=mix(c,ink,m);
      }
      col=vec4(c,1.0);
    }
    // Soft halo of fur at the silhouette: rays that pass close catch a little light.
    if(!hit){
      float fuzz=1.0-smoothstep(0.0,uFurAmp*2.6,minD);
      fuzz*=0.35+0.65*smoothstep(0.0,0.7,snoise(pc*uDetail*3.1));
      float fa=fuzz*0.8;
      col=vec4((uFur*0.6+uRim*uRimI*0.5)*fa,fa);
    }
  }
  // Glow from the eyes, measured on the plane of the face.
  if(uEmissive>0.5){
    float tp=(0.5-o.z)/dir.z;
    vec3 pp=o+dir*tp;
    float m,gd;
    face(pp.xy,m,gd);
    float glow=exp(-max(gd,0.0)*28.0)*0.42+exp(-max(gd,0.0)*10.0)*0.07*smoothstep(0.35,0.1,gd);
    glow*=uGlow;
    col.rgb+=uEyeEdge*glow;
    col.a=max(col.a,clamp(glow*0.9,0.0,1.0));
  }
  // Filmic tone, premultiplied out.
  vec3 c=col.rgb;
  c=c/(1.0+c*0.35);
  c=pow(c,vec3(1.0/1.0));
  float dz=fract(sin(dot(frag,vec2(12.9898,78.233)))*43758.5453)-0.5;
  outColor=vec4(c+dz/255.0,col.a+dz/255.0*step(0.002,col.a));
  outColor.rgb=min(outColor.rgb,vec3(outColor.a)+outColor.rgb*0.0);
}`;
