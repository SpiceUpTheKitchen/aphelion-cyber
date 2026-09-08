/* ==========================================================================
   ANECHOIC — the Aphelion hero
   assets/js/hero.js

   An RF anechoic chamber. Six surfaces lined with pyramidal absorber, one
   lamp on a ceiling gantry travelling the length of the room toward the
   camera. Every shadow is cast, not painted: a single moving spotlight with
   a real-time shadow map over ~15,000 instanced wedges, a slow dolly down
   the room, and physically based depth of field that racks in as the lamp
   arrives. The lamp is overhead by eight seconds, so the whole payoff sits
   inside a first impression. The room notices you came in (two degrees of
   head-turn); it does not get up.

   Swappable module. Contract:
     AphHero.mount(rootEl, opts?) → { pause(), resume(), destroy(), name }
   rootEl contains an optional <canvas class="hero__canvas"> and any number
   of [data-hero-in="1..4"] copy elements, which receive .is-in on the
   hero's own clock.

   Quality tiers: instances, shadow resolution, render scale and depth of
   field. Every visitor starts at a tier their hardware is very likely to
   hold and is promoted only after seconds of frames pinned to the display's
   own rate; a tier that then stutters is stepped back down and not tried
   again. Reduced motion renders one still frame. No WebGL2 → a CSS still
   (.hero--static) and the copy.
   ========================================================================== */
window.AphHero = (function () {
  'use strict';

  var NAME = 'anechoic';

  /* ---- the room, in metres ------------------------------------------- */
  var ROOM = { w: 6.4, floor: -1.6, ceil: 2.4, zFar: -24.0, zNear: 3.0 };
  var LOOP = 11.5;                  // seconds per pass of the lamp
  var LAMP_Z0 = -12.1, LAMP_Z1 = 1.9;   // out of frame at ~0:06.5, past the camera at ~0:09, then the fade
  var LAMP_DROP = 0.68;             // light point below the ceiling
  var DOLLY = 1.5;                  // metres per loop — 13 cm a second, a slow push down the room
  var FADE = [1.2, 1.5];            // seconds up from the void at the head, and back down to it at the tail
  var STILL_AT = 5.6;               // the frame reduced motion gets: the lamp four metres out, shadows long
  var LIGHT_COL = [1.0, 0.80, 0.58];  // tungsten work lamp
  var INTENSITY = 98;
  var SPOT = [0.36, -0.04];         // cos(angle from straight down): full above .36, gone just past the horizon
  var SHADOW_FAR = 26;              // metres — the depth range of the paraboloid shadow map
  var VOID = [10 / 255, 7 / 255, 16 / 255];
  var ABSORBER = [0.046, 0.043, 0.052];       // carbon-loaded foam, a breath of violet
  var STEEL = [0.30, 0.30, 0.33];
  var COPY_TIMES = [0.9, 1.5, 3.0, 3.6];      // eyebrow, title, sub, cta — settled by ~5.2s, before the lamp arrives
  var FOCUS = [4.6, 2.0];                     // the rack: focus plane in metres, deep → near as the lamp closes
  var NEAR_BLUR = 1.1;                        // everything this close is at full circle of confusion
  var RACK = [6.5, 2.2];                      // lamp distance over which the rack travels

  // adaptive quality, all in the units it is measured in
  var SLOW_MS = 21;                 // a frame this long is stutter a person can see
  var SLOW_FOR = 1.2;               // seconds of it before stepping down
  var CLEAN_FOR = 3.0;              // seconds pinned to the display's own rate before stepping up
  var CLEAN_PENALTY = 0.6;          // credit a single late frame costs — a hiccup, not a verdict
  var PROBE_GRACE = 2.0;            // a step up is on probation this long...
  var PROBE_FOR = 0.5;              // ...during which stutter is corrected this fast
  var TARGET_MS = 1000 / 90;        // we never ask for more headroom than 90 fps

  var TIERS = {
    high: { base: 0.20, shadow: 2048, dof: 1, scale: 1.00 },
    mid:  { base: 0.26, shadow: 1536, dof: 0, scale: 0.85 },
    low:  { base: 0.34, shadow: 1024, dof: 0, scale: 0.70 }
  };
  var TIER_ORDER = ['high', 'mid', 'low'];

  /* ---- shaders ------------------------------------------------------- */
  function vertSrc(shadowPass) {
    return '#version 300 es\n' +
    'precision highp float;\n' +
    'layout(location=0) in vec3 aPos;\n' +
    'layout(location=1) in vec3 aNrm;\n' +
    'layout(location=2) in vec3 aIPos;\n' +
    'layout(location=3) in vec2 aIMeta;\n' +
    'uniform mat4 uVP; uniform mat3 uRot[6];\n' +
    'uniform vec2 uWedge; uniform int uMode; uniform vec3 uOffset;\n' +
    'uniform vec3 uLightPos; uniform float uShadowFar;\n' +
    (shadowPass ? '' : 'out vec3 vWorld; out vec3 vNrm; out float vRnd;\n') +
    'void main(){\n' +
    '  vec3 wp, n; float rnd;\n' +
    '  if (uMode == 0) {\n' +
    '    mat3 R = uRot[int(aIMeta.x + 0.5)];\n' +
    '    float b = uWedge.x; float h = uWedge.y * (0.92 + 0.16 * aIMeta.y);\n' +
    '    vec3 lp = vec3(aPos.x * b, aPos.y * h, aPos.z * b);\n' +
    '    vec3 ln = normalize(vec3(aNrm.x * h, 0.5 * b, aNrm.z * h));\n' +
    '    wp = aIPos + R * lp; n = R * ln; rnd = aIMeta.y;\n' +
    '  } else { wp = aPos + uOffset; n = aNrm; rnd = 0.5; }\n' +
    (shadowPass
      // paraboloid map of the hemisphere below the lamp: x right, -z up, depth = distance
      ? '  vec3 d = wp - uLightPos; float dist = length(d); vec3 a = vec3(d.x, -d.z, -d.y) / dist;\n' +
        '  vec2 uv = a.xy / max(1.0 + a.z, 0.2);\n' +
        '  gl_Position = vec4(uv, dist / uShadowFar * 2.0 - 1.0, 1.0);\n'
      : '  vWorld = wp; vNrm = n; vRnd = rnd;\n' +
        '  gl_Position = uVP * vec4(wp, 1.0);\n') +
    '}\n';
  }

  var FRAG_SHADOW = '#version 300 es\nprecision highp float;\nvoid main(){}\n';

  var FRAG_MAIN = '#version 300 es\n' +
  'precision highp float; precision highp sampler2DShadow;\n' +
  'in vec3 vWorld; in vec3 vNrm; in float vRnd;\n' +
  'uniform sampler2DShadow uShadow; uniform float uShadowPx; uniform float uShadowFar;\n' +
  'uniform vec3 uLightPos; uniform vec3 uLightCol; uniform float uIntensity; uniform vec2 uSpot;\n' +
  'uniform vec3 uEye; uniform vec3 uAlbedo; uniform float uRough; uniform vec3 uEmissive; uniform vec3 uAmbient;\n' +
  'uniform float uFade; uniform float uSeed; uniform int uDebug;\n' +
  'out vec4 o;\n' +
  // same paraboloid as the shadow pass; the receiver is nudged along its normal by ~1.5 texels
  'float pcf(vec3 wp, vec3 n){\n' +
  '  vec3 d0 = wp - uLightPos; float dist0 = length(d0);\n' +
  '  vec3 d = d0 + n * (dist0 * uShadowPx * 3.2 + 0.006); float dist = length(d);\n' +
  '  vec3 a = vec3(d.x, -d.z, -d.y) / dist;\n' +
  '  if (a.z < 0.0) return 1.0;\n' +
  '  vec2 p = a.xy / (1.0 + a.z) * 0.5 + 0.5;\n' +
  '  float ref = dist / uShadowFar - 0.0004;\n' +
  '  float s = 0.0;\n' +
  '  s += texture(uShadow, vec3(p + vec2(-0.7,  0.3) * uShadowPx, ref));\n' +
  '  s += texture(uShadow, vec3(p + vec2( 0.3,  0.7) * uShadowPx, ref));\n' +
  '  s += texture(uShadow, vec3(p + vec2( 0.7, -0.3) * uShadowPx, ref));\n' +
  '  s += texture(uShadow, vec3(p + vec2(-0.3, -0.7) * uShadowPx, ref));\n' +
  '  return s * 0.25;\n' +
  '}\n' +
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }\n' +
  'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }\n' +
  'void main(){\n' +
  '  vec3 N = normalize(vNrm);\n' +
  '  vec3 Lv = uLightPos - vWorld; float d2 = dot(Lv, Lv); float d = sqrt(d2); vec3 L = Lv / d;\n' +
  '  vec3 V = normalize(uEye - vWorld);\n' +
  '  float ndl = dot(N, L); float ndv = max(dot(N, V), 0.0);\n' +
  '  float att = uIntensity / (d2 + 0.2);\n' +
  '  vec3 alb = uAlbedo * (0.8 + 0.4 * vRnd);\n' +
  '  vec3 col = vec3(0.0);\n' +
  '  if (ndl > 0.0) {\n' +
  '    float spot = smoothstep(uSpot.y, uSpot.x, L.y);\n' +          // a shallow reflector: full below, fading to the horizon
  '    float leak = 0.02 * step(L.y, 0.0);\n' +                        // a little escapes the housing upward
  '    float sh = spot > 0.001 ? pcf(vWorld, N) : 1.0;\n' +
  '    if (uDebug == 1) sh = 1.0;\n' +
  '    if (uDebug == 2) { o = vec4(vec3(sh), 1.0); return; }\n' +
  '    if (uDebug == 3) { o = vec4(vec3(spot, ndl, att * 0.05), 1.0); return; }\n' +
  '    vec3 H = normalize(L + V); float ndh = max(dot(N, H), 0.0);\n' +
  '    float a2 = uRough * uRough; a2 *= a2;\n' +
  '    float dd = ndh * ndh * (a2 - 1.0) + 1.0;\n' +
  '    float D = a2 / (3.14159 * dd * dd);\n' +
  '    float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);\n' +
  '    vec3 rad = uLightCol * att * (spot * sh + leak) * ndl;\n' +
  '    col = (alb + vec3(D * F * 0.25)) * rad;\n' +
  '  }\n' +
  '  col += uAmbient * (0.55 + 0.45 * ndv);\n' +
  '  col += uEmissive;\n' +
  '  col *= uFade;\n' +
  '  col = pow(aces(col), vec3(1.0 / 2.2));\n' +
  '  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;\n' +
  '  o = vec4(col, 1.0);\n' +
  '}\n';

  var VERT_POST = '#version 300 es\n' +
  'void main(){ vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }\n';

  var FRAG_POST = '#version 300 es\n' +
  'precision highp float;\n' +
  'uniform sampler2D uColor; uniform sampler2D uDepth;\n' +
  'uniform vec2 uRes; uniform vec2 uOut;\n' +
  'uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uNearBlur; uniform float uCoc; uniform float uDoF;\n' +
  'uniform vec2 uLamp; uniform float uGlow; uniform vec3 uLampCol;\n' +
  'uniform vec3 uVoid; uniform float uSeed; uniform float uVig;\n' +
  'out vec4 o;\n' +
  'const vec2 P[12] = vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),' +
  'vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),' +
  'vec2(-0.322,-0.933),vec2(-0.792,-0.598));\n' +
  'float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }\n' +
  'float coc(float z){ return uCoc * (1.0 - smoothstep(uNearBlur, uFocus, z)); }\n' +
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }\n' +
  'void main(){\n' +
  '  vec2 uv = gl_FragCoord.xy / uOut;\n' +
  '  vec3 c0 = texture(uColor, uv).rgb; vec3 col = c0;\n' +
  '  if (uDoF > 0.5) {\n' +
  '    float c = coc(lin(texture(uDepth, uv).r));\n' +
  '    vec3 acc = c0; float wsum = 1.0;\n' +
  '    for (int i = 0; i < 12; i++) {\n' +
  '      vec2 off = P[i] * uCoc; float len = length(off);\n' +
  '      vec2 suv = uv + off / uRes;\n' +
  '      float cc = coc(lin(texture(uDepth, suv).r));\n' +
  '      float w = max(smoothstep(len - 1.5, len + 1.5, cc), smoothstep(len - 1.5, len + 1.5, c));\n' +
  '      acc += texture(uColor, suv).rgb * w; wsum += w;\n' +
  '    }\n' +
  '    col = acc / wsum;\n' +
  '  }\n' +
  '  vec2 dp = (gl_FragCoord.xy - uLamp) / uOut.y; float r = length(dp);\n' +
  '  float halo = uGlow * (0.55 * exp(-r * r * 320.0) + 0.45 * exp(-r * 13.0));\n' +
  '  col += uLampCol * halo;\n' +
  '  vec2 q = uv - 0.5; col *= 1.0 - uVig * dot(q, q) * 1.6;\n' +
  '  col = uVoid + col * (1.0 - uVoid);\n' +
  '  float n = hash(gl_FragCoord.xy);\n' +
  '  col += (n - 0.5) * (0.034 - 0.02 * col.g);\n' +
  '  o = vec4(col, 1.0);\n' +
  '}\n';

  /* ---- small matrix kit (column-major, preallocated) ----------------- */
  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  }
  function lookAt(out, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
    var zx = ex - cx, zy = ey - cy, zz = ez - cz, l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * ex + xy * ey + xz * ez); out[13] = -(yx * ex + yy * ey + yz * ez); out[14] = -(zx * ex + zy * ey + zz * ez); out[15] = 1;
    return out;
  }
  function mul(out, a, b) {
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return out;
  }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ---- geometry ------------------------------------------------------ */
  // unit pyramid: square base 1, apex at y=1; aNrm carries the face direction
  var PYRAMID = new Float32Array([
    -.5, 0, .5,   0, 0, 1,    .5, 0, .5,   0, 0, 1,    0, 1, 0,   0, 0, 1,
     .5, 0, .5,   1, 0, 0,    .5, 0, -.5,  1, 0, 0,    0, 1, 0,   1, 0, 0,
     .5, 0, -.5,  0, 0, -1,  -.5, 0, -.5,  0, 0, -1,   0, 1, 0,   0, 0, -1,
    -.5, 0, -.5, -1, 0, 0,   -.5, 0, .5,  -1, 0, 0,    0, 1, 0,  -1, 0, 0
  ]);

  // surfaces: normal, tangent (u), bitangent (v) = n × t — right-handed, so quads are CCW from inside
  var hw = ROOM.w / 2, H = ROOM.ceil - ROOM.floor, L = ROOM.zNear - ROOM.zFar;
  var SURF = [
    { o: [0, ROOM.floor, 0],  n: [0, 1, 0],  t: [1, 0, 0], bt: [0, 0, -1], u: [-hw, hw],               v: [-ROOM.zNear, -ROOM.zFar] },
    { o: [0, ROOM.ceil, 0],   n: [0, -1, 0], t: [1, 0, 0], bt: [0, 0, 1],  u: [-hw, hw],               v: [ROOM.zFar, ROOM.zNear] },
    { o: [-hw, 0, 0],         n: [1, 0, 0],  t: [0, 0, 1], bt: [0, -1, 0], u: [ROOM.zFar, ROOM.zNear], v: [-ROOM.ceil, -ROOM.floor] },
    { o: [hw, 0, 0],          n: [-1, 0, 0], t: [0, 0, 1], bt: [0, 1, 0],  u: [ROOM.zFar, ROOM.zNear], v: [ROOM.floor, ROOM.ceil] },
    { o: [0, 0, ROOM.zFar],   n: [0, 0, 1],  t: [1, 0, 0], bt: [0, 1, 0],  u: [-hw, hw],               v: [ROOM.floor, ROOM.ceil] }
  ];
  // instance rotation: local x→t, local y (the wedge axis)→n, local z→t×n = -bt, so the basis is
  // right-handed and the pyramid's outward winding survives the transform
  var ROT = new Float32Array(54);
  SURF.forEach(function (s, i) {
    ROT.set([s.t[0], s.t[1], s.t[2], s.n[0], s.n[1], s.n[2], -s.bt[0], -s.bt[1], -s.bt[2]], i * 9);
  });

  function quad(arr, o, t, bt, n, u0, u1, v0, v1) {
    function p(u, v) { arr.push(o[0] + t[0] * u + bt[0] * v, o[1] + t[1] * u + bt[1] * v, o[2] + t[2] * u + bt[2] * v, n[0], n[1], n[2]); }
    p(u0, v0); p(u1, v0); p(u1, v1);
    p(u0, v0); p(u1, v1); p(u0, v1);
  }
  function box(arr, cx, cy, cz, sx, sy, sz) {
    var x = sx / 2, y = sy / 2, z = sz / 2;
    quad(arr, [cx, cy, cz + z], [1, 0, 0], [0, 1, 0], [0, 0, 1], -x, x, -y, y);
    quad(arr, [cx, cy, cz - z], [-1, 0, 0], [0, 1, 0], [0, 0, -1], -x, x, -y, y);
    quad(arr, [cx + x, cy, cz], [0, 0, -1], [0, 1, 0], [1, 0, 0], -z, z, -y, y);
    quad(arr, [cx - x, cy, cz], [0, 0, 1], [0, 1, 0], [-1, 0, 0], -z, z, -y, y);
    quad(arr, [cx, cy + y, cz], [1, 0, 0], [0, 0, -1], [0, 1, 0], -x, x, -z, z);
    quad(arr, [cx, cy - y, cz], [1, 0, 0], [0, 0, 1], [0, -1, 0], -x, x, -z, z);
  }

  // deterministic noise so every visitor sees the same room
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function buildInstances(base) {
    var rand = rng(7), data = [], groups = [];
    SURF.forEach(function (s, si) {
      var nu = Math.round((s.u[1] - s.u[0]) / base), nv = Math.round((s.v[1] - s.v[0]) / base);
      var bu = (s.u[1] - s.u[0]) / nu, bv = (s.v[1] - s.v[0]) / nv;
      var start = data.length / 5;
      for (var i = 0; i < nu; i++) for (var j = 0; j < nv; j++) {
        var u = s.u[0] + (i + 0.5) * bu + (rand() - 0.5) * base * 0.05;
        var v = s.v[0] + (j + 0.5) * bv + (rand() - 0.5) * base * 0.05;
        data.push(s.o[0] + s.t[0] * u + s.bt[0] * v, s.o[1] + s.t[1] * u + s.bt[1] * v, s.o[2] + s.t[2] * u + s.bt[2] * v, si, rand());
      }
      groups.push({ offset: start, count: data.length / 5 - start, surface: si });
    });
    return { data: new Float32Array(data), groups: groups };
  }

  function buildPlanes() {
    var a = [];
    SURF.forEach(function (s) { quad(a, s.o, s.t, s.bt, s.n, s.u[0], s.u[1], s.v[0], s.v[1]); });
    return new Float32Array(a);
  }
  function buildRails() {
    var a = [], y = ROOM.ceil - 0.05, zc = (ROOM.zFar + ROOM.zNear) / 2;
    box(a, -0.34, y, zc, 0.05, 0.05, L); box(a, 0.34, y, zc, 0.05, 0.05, L);
    return new Float32Array(a);
  }
  function buildLamp() {
    var a = [], top = ROOM.ceil - 0.05;
    box(a, 0, top, 0, 0.78, 0.05, 0.08);               // crossbar between the rails
    box(a, 0, top - 0.22, 0, 0.03, 0.36, 0.03);        // stem
    box(a, 0, top - 0.49, 0, 0.42, 0.18, 0.30);        // head
    return new Float32Array(a);
  }
  function buildDisc() {
    var a = [], y = ROOM.ceil - 0.05 - 0.585;
    quad(a, [0, y, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], -0.15, 0.15, -0.10, 0.10);
    return new Float32Array(a);
  }

  /* ---- mount --------------------------------------------------------- */
  function mount(root, opts) {
    opts = opts || {};
    var A = window.Aph || {};
    var reduce = A.reduce !== undefined ? A.reduce : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var coarse = A.coarse !== undefined ? A.coarse : !!(window.matchMedia && matchMedia('(hover: none), (pointer: coarse)').matches);

    var copy = Array.prototype.slice.call(root.querySelectorAll('[data-hero-in]'));
    var seen = false;
    try { seen = sessionStorage.getItem('aph-hero-seen') === '1'; sessionStorage.setItem('aph-hero-seen', '1'); } catch (e) {}

    function showCopyNow() { root.classList.add('hero--now'); copy.forEach(function (c) { c.classList.add('is-in'); }); }

    var canvas = root.querySelector('canvas') || root.insertBefore(document.createElement('canvas'), root.firstChild);
    canvas.className = 'hero__canvas'; canvas.setAttribute('aria-hidden', 'true');

    var gl = null;
    try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); } catch (e) {}
    if (!gl) { root.classList.add('hero--static'); showCopyNow(); return { name: NAME, pause: noop, resume: noop, destroy: noop, tier: 'static' }; }

    /* programs */
    function compile(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error('shader: ' + gl.getShaderInfoLog(s)); }
      return s;
    }
    function program(vs, fs) {
      var p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error('program: ' + gl.getProgramInfoLog(p)); }
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
      return { p: p, u: u };
    }
    var P_SHADOW, P_MAIN, P_POST;
    try { P_SHADOW = program(vertSrc(true), FRAG_SHADOW); P_MAIN = program(vertSrc(false), FRAG_MAIN); P_POST = program(VERT_POST, FRAG_POST); }
    catch (e) { root.classList.add('hero--static'); showCopyNow(); return { name: NAME, pause: noop, resume: noop, destroy: noop, tier: 'static', error: e }; }

    /* static meshes */
    function meshVAO(data) {
      var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindVertexArray(null);
      return { vao: vao, n: data.length / 6, vb: vb };
    }
    var planes = meshVAO(buildPlanes()), rails = meshVAO(buildRails()), lamp = meshVAO(buildLamp()), disc = meshVAO(buildDisc());

    /* pyramids: one mesh, many instances */
    var pyrVAO = gl.createVertexArray(); gl.bindVertexArray(pyrVAO);
    var pyrVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pyrVB); gl.bufferData(gl.ARRAY_BUFFER, PYRAMID, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    var instVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, instVB);
    gl.enableVertexAttribArray(2); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    var groups = [], instCount = 0;

    /* render targets */
    var shadowFB = null, shadowTex = null, shadowRes = 0;
    var sceneFB = null, sceneCol = null, sceneDep = null, sceneW = 0, sceneH = 0;

    function allocShadow(res) {
      if (shadowTex) { gl.deleteTexture(shadowTex); gl.deleteFramebuffer(shadowFB); }
      shadowRes = res;
      shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, res, res);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function allocScene(w, h) {
      if (w === sceneW && h === sceneH) return;
      if (sceneCol) { gl.deleteTexture(sceneCol); gl.deleteTexture(sceneDep); gl.deleteFramebuffer(sceneFB); }
      sceneW = w; sceneH = h;
      sceneCol = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, sceneCol);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      sceneDep = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, sceneDep);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      sceneFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneCol, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, sceneDep, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /* quality */
    // everyone starts somewhere their hardware is very likely to hold; the frame-time
    // monitor promotes from there. A first impression must never contain stutter.
    var tierName = opts.tier || (coarse && Math.min(screen.width, screen.height) < 420 ? 'low' : 'mid');
    var tier = TIERS[tierName];
    var tierCap = 0;              // best tier still allowed; a tier that stutters raises this for good
    var instCache = {};           // rebuilding 14k instances is a hitch — pay for each tier once
    function applyTier(name) {
      tierName = name; tier = TIERS[name];
      var inst = instCache[name] || (instCache[name] = buildInstances(tier.base));
      groups = inst.groups; instCount = inst.data.length / 5;
      gl.bindBuffer(gl.ARRAY_BUFFER, instVB); gl.bufferData(gl.ARRAY_BUFFER, inst.data, gl.STATIC_DRAW);
      allocShadow(tier.shadow);
      needResize = true;
    }
    var needResize = true;
    applyTier(tierName);

    /* state — preallocated */
    var mView = new Float32Array(16), mProj = new Float32Array(16), mVP = new Float32Array(16);
    var eye = [0, 0, 0], lampPos = [0, ROOM.ceil - LAMP_DROP, LAMP_Z0];
    var cw = 0, ch = 0, dpr = 1;
    var t = seen ? 5.2 : 0.0, last = 0, running = false, raf = 0, destroyed = false;
    var yaw = 0, pitch = 0, yawT = 0, pitchT = 0;
    var copyShown = seen ? 4 : 0, frames = 0, ema = 16, slowFor = 0, debugMode = 0;
    var cleanFor = 0, probing = 0, baseMs = 1e3;   // baseMs: the display's own interval, discovered
    var dofMix = tier.dof;                          // depth of field eases in, so a promotion is a settle, not a pop
    if (seen || reduce) showCopyNow();

    function resize() {
      var r = root.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      cw = bw; ch = bh;
      allocScene(Math.max(1, Math.round(bw * tier.scale)), Math.max(1, Math.round(bh * tier.scale)));
      needResize = false;
    }

    /* passes */
    function drawPyramids(prog, skipCeiling) {
      gl.bindVertexArray(pyrVAO);
      gl.uniform1i(prog.u.uMode, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, instVB);
      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g]; if (skipCeiling && grp.surface === 1) continue;
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 20, grp.offset * 20);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 20, grp.offset * 20 + 12);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 12, grp.count);
      }
    }
    function drawMesh(prog, m, ox, oy, oz) {
      gl.uniform1i(prog.u.uMode, 1); gl.uniform3f(prog.u.uOffset, ox, oy, oz);
      gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n);
    }
    function setCommon(prog) {
      gl.uniformMatrix4fv(prog.u.uVP, false, mVP);
      gl.uniformMatrix3fv(prog.u.uRot, false, ROT);
      gl.uniform2f(prog.u.uWedge, tier.base, tier.base * 2.4);
      gl.uniform3f(prog.u.uLightPos, lampPos[0], lampPos[1], lampPos[2]);
      gl.uniform1f(prog.u.uShadowFar, SHADOW_FAR);
      gl.uniform3f(prog.u.uOffset, 0, 0, 0);
    }

    function render(now) {
      if (needResize) resize();
      var lt = t / LOOP;
      var fade = smooth(0, FADE[0], t) * (1 - smooth(LOOP - FADE[1], LOOP - 0.12, t));

      // the lamp: a gantry motor, constant speed, three centimetres of sway
      lampPos[0] = 0.03 * Math.sin(t * 1.7);
      lampPos[2] = LAMP_Z0 + (LAMP_Z1 - LAMP_Z0) * lt;

      // camera: a slow push down the room, two degrees of head-turn
      eye[2] = -DOLLY * lt;
      // the rack: focus follows the lamp in, so the near wedges resolve exactly as it rakes them
      var lampDist = Math.hypot(lampPos[0] - eye[0], lampPos[1] - eye[1], lampPos[2] - eye[2]);
      var focus = FOCUS[0] + (FOCUS[1] - FOCUS[0]) * smooth(RACK[0], RACK[1], lampDist);
      var cy = Math.cos(pitch), fx = Math.sin(yaw) * cy, fy = Math.sin(pitch), fz = -Math.cos(yaw) * cy;
      var aspect = cw / ch, fov = (aspect > 1 ? 54 : 76) * Math.PI / 180;
      perspective(mProj, fov, aspect, 0.05, 60);
      lookAt(mView, eye[0], eye[1], eye[2], eye[0] + fx, eye[1] + fy, eye[2] + fz, 0, 1, 0);
      mul(mVP, mProj, mView);

      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);

      // 1 — paraboloid shadow map of everything below the lamp (the base planes only receive)
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, shadowRes, shadowRes);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.cullFace(gl.FRONT);
      gl.useProgram(P_SHADOW.p); setCommon(P_SHADOW);
      drawPyramids(P_SHADOW, true);

      // 2 — the room
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFB); gl.viewport(0, 0, sceneW, sceneH);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.cullFace(gl.BACK);
      gl.useProgram(P_MAIN.p); setCommon(P_MAIN);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.uniform1i(P_MAIN.u.uShadow, 0);
      gl.uniform1f(P_MAIN.u.uShadowPx, 1 / shadowRes);
      gl.uniform3f(P_MAIN.u.uLightCol, LIGHT_COL[0], LIGHT_COL[1], LIGHT_COL[2]);
      gl.uniform1f(P_MAIN.u.uIntensity, INTENSITY); gl.uniform2f(P_MAIN.u.uSpot, SPOT[0], SPOT[1]);
      gl.uniform3f(P_MAIN.u.uEye, eye[0], eye[1], eye[2]);
      gl.uniform3f(P_MAIN.u.uAmbient, 0.0050, 0.0036, 0.0074);
      gl.uniform1f(P_MAIN.u.uFade, fade); gl.uniform1f(P_MAIN.u.uSeed, (now % 1000) * 0.001);
      gl.uniform1i(P_MAIN.u.uDebug, debugMode);
      gl.uniform3f(P_MAIN.u.uEmissive, 0, 0, 0);

      gl.uniform3f(P_MAIN.u.uAlbedo, ABSORBER[0], ABSORBER[1], ABSORBER[2]); gl.uniform1f(P_MAIN.u.uRough, 0.62);
      drawPyramids(P_MAIN, false);
      gl.uniform3f(P_MAIN.u.uAlbedo, ABSORBER[0] * 0.8, ABSORBER[1] * 0.8, ABSORBER[2] * 0.8); gl.uniform1f(P_MAIN.u.uRough, 0.8);
      drawMesh(P_MAIN, planes, 0, 0, 0);
      gl.uniform3f(P_MAIN.u.uAlbedo, STEEL[0], STEEL[1], STEEL[2]); gl.uniform1f(P_MAIN.u.uRough, 0.38);
      drawMesh(P_MAIN, rails, 0, 0, 0);
      drawMesh(P_MAIN, lamp, lampPos[0], 0, lampPos[2]);
      gl.uniform3f(P_MAIN.u.uAlbedo, 0, 0, 0);
      gl.uniform3f(P_MAIN.u.uEmissive, LIGHT_COL[0] * 3, LIGHT_COL[1] * 3, LIGHT_COL[2] * 3);
      drawMesh(P_MAIN, disc, lampPos[0], 0, lampPos[2]);

      // 3 — composite: depth of field, halo, void floor, grain
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.useProgram(P_POST.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneCol); gl.uniform1i(P_POST.u.uColor, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sceneDep); gl.uniform1i(P_POST.u.uDepth, 1);
      gl.uniform2f(P_POST.u.uRes, sceneW, sceneH); gl.uniform2f(P_POST.u.uOut, cw, ch);
      gl.uniform1f(P_POST.u.uNear, 0.05); gl.uniform1f(P_POST.u.uFar, 60);
      gl.uniform1f(P_POST.u.uFocus, focus); gl.uniform1f(P_POST.u.uNearBlur, NEAR_BLUR);
      gl.uniform1f(P_POST.u.uCoc, 5.5 * dpr * tier.scale * dofMix); gl.uniform1f(P_POST.u.uDoF, dofMix > 0.02 ? 1 : 0);
      // the lamp on screen
      var lx = lampPos[0], ly = lampPos[1] + 0.05, lz = lampPos[2];
      var cwx = mVP[3] * lx + mVP[7] * ly + mVP[11] * lz + mVP[15];
      var glow = 0, sx = -1e4, sy = -1e4;
      if (cwx > 0.05) {
        sx = ((mVP[0] * lx + mVP[4] * ly + mVP[8] * lz + mVP[12]) / cwx * 0.5 + 0.5) * cw;
        sy = ((mVP[1] * lx + mVP[5] * ly + mVP[9] * lz + mVP[13]) / cwx * 0.5 + 0.5) * ch;
        var dist = Math.hypot(lx - eye[0], ly - eye[1], lz - eye[2]);
        glow = fade * Math.min(1.5, 2.6 / dist) * 0.55;
      }
      gl.uniform2f(P_POST.u.uLamp, sx, sy); gl.uniform1f(P_POST.u.uGlow, glow);
      gl.uniform3f(P_POST.u.uLampCol, LIGHT_COL[0], LIGHT_COL[1], LIGHT_COL[2]);
      gl.uniform3f(P_POST.u.uVoid, VOID[0], VOID[1], VOID[2]);
      gl.uniform1f(P_POST.u.uSeed, ((now * 0.37) % 1000) * 0.001); gl.uniform1f(P_POST.u.uVig, 0.42);
      gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* loop */
    function frame(now) {
      raf = 0; if (!running || destroyed) return;
      var raw = last ? (now - last) / 1000 : 0.016, dt = Math.min(0.05, raw); last = now;
      t += dt; if (t >= LOOP) { t -= LOOP; }

      // pointer parallax, eased
      yaw += (yawT - yaw) * Math.min(1, dt * 2.2); pitch += (pitchT - pitch) * Math.min(1, dt * 2.2);

      // depth of field arrives over half a second and leaves at once: a promotion should read
      // as the lens settling, but a downgrade must not keep paying for the pass it just dropped
      dofMix = tier.dof < dofMix ? tier.dof : dofMix + (tier.dof - dofMix) * Math.min(1, dt * 4);

      // copy on the hero's clock
      while (copyShown < COPY_TIMES.length && t >= COPY_TIMES[copyShown]) {
        var idx = copyShown + 1;
        copy.forEach(function (c) { if (parseInt(c.getAttribute('data-hero-in'), 10) === idx) c.classList.add('is-in'); });
        copyShown++;
      }

      render(now);

      // adaptive quality — measured, not guessed; gaps over 250ms are throttling, not slowness.
      // Frame *interval* is vsync-locked, so "fast" is only meaningful against the display's own
      // rate: discover that as the shortest frame ever served, and never demand better than 90fps.
      frames++;
      if (frames > 40 && raw < 0.25) {
        var ms = raw * 1000;
        if (ms > 3 && ms < baseMs) baseMs = ms;
        var target = Math.max(baseMs, TARGET_MS);
        ema = ema * 0.9 + ms * 0.1;
        slowFor = ema > SLOW_MS ? slowFor + dt : 0;
        // one stray frame is a hiccup, not a verdict: it costs CLEAN_PENALTY of credit rather
        // than all of it, so what has to be low is the *rate* of hiccups, not their count
        cleanFor = (ms < target * 1.6 + 2 && ema < target * 1.15 + 1.5)
          ? cleanFor + dt : Math.max(0, cleanFor - CLEAN_PENALTY);
        if (probing > 0) probing -= dt;
        var i = TIER_ORDER.indexOf(tierName);
        if (slowFor > (probing > 0 ? PROBE_FOR : SLOW_FOR) && i < TIER_ORDER.length - 1) {
          tierCap = i + 1; step(i + 1);          // this tier is proven too heavy — don't come back
        } else if (cleanFor > CLEAN_FOR && i > tierCap) {
          step(i - 1); probing = PROBE_GRACE;    // earned a step up; it is on probation
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function step(i) {
      // 8 frames to settle the new buffers, not the 40 the cold mount needs: a probe that
      // fails has to be caught inside PROBE_FOR, and the gate below is part of that clock
      applyTier(TIER_ORDER[i]);
      frames = 32; ema = 16; slowFor = 0; cleanFor = 0;
    }

    function pause() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } last = 0; }
    function resume() {
      if (destroyed || running) return;
      if (reduce) { still(); return; }
      running = true; last = 0; if (!raf) raf = requestAnimationFrame(frame);
    }
    function still() {
      // reduced motion: one considered frame — the lamp four metres out, shadows long. There is
      // no loop to budget for, so a pointer device renders it at the top tier whatever the
      // monitor would have chosen; the tier check keeps a resize from rebuilding it.
      if (!coarse && tierName !== 'high') applyTier('high');
      seek(STILL_AT); showCopyNow();
    }
    function seek(seconds) {
      // render one frame at a given moment of the loop; also used for tuning
      t = ((seconds % LOOP) + LOOP) % LOOP; yaw = yawT; pitch = pitchT; needResize = true; dofMix = tier.dof;
      while (copyShown < COPY_TIMES.length && t >= COPY_TIMES[copyShown]) {
        var idx = ++copyShown;
        copy.forEach(function (c) { if (parseInt(c.getAttribute('data-hero-in'), 10) === idx) c.classList.add('is-in'); });
      }
      render(performance.now());
    }

    /* pointer: two degrees, no more */
    function onMove(e) {
      var r = root.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      yawT = nx * 2.0 * Math.PI / 180; pitchT = -ny * 1.4 * Math.PI / 180;
    }
    if (!coarse && !reduce) window.addEventListener('pointermove', onMove, { passive: true });

    /* resize + visibility */
    var ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(function () { needResize = true; if (reduce) still(); }); ro.observe(root); }
    else window.addEventListener('resize', function () { needResize = true; if (reduce) still(); });

    var watch = null;
    if (A.watch) watch = A.watch(root, resume, pause);
    else { resume(); document.addEventListener('visibilitychange', function () { document.hidden ? pause() : resume(); }); }

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); pause(); root.classList.add('hero--static'); showCopyNow(); }, false);

    function destroy() {
      destroyed = true; pause(); if (ro) ro.disconnect(); if (watch) watch.stop();
      window.removeEventListener('pointermove', onMove);
      var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    }
    function noop() {}

    return {
      name: NAME, pause: pause, resume: resume, destroy: destroy,
      get tier() { return tierName; },
      get time() { return t; },
      get running() { return running; },
      seek: seek,
      debug: function (m) { debugMode = m | 0; seek(t); },
      setTier: function (n) { if (TIERS[n]) applyTier(n); },
      count: function () { return instCount; }
    };
  }

  function noop() {}
  return { mount: mount, name: NAME, tiers: TIERS };
})();
