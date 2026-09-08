/* ==========================================================================
   THE LENS — Aphelion's cursor
   assets/js/cursor.js

   Two elements, because custom cursors fail on latency:
     · a 5px dot moved synchronously inside the pointer event — zero lag
     · a ring that follows on smoothing — the graceful part

   Three rules learned the hard way, all of them load-bearing:

   1. NO BLEND MODES. `.lens` is position:fixed, which makes it a stacking
      context, so mix-blend-mode blends against the lens's own transparent
      backdrop rather than the page — it renders white everywhere, which is
      invisible on a light ground like /platform/. The cursor is coloured
      from --lens-* tokens instead, and those flip with the theme.

   2. NO PER-FRAME LAYOUT. The ring is a fixed 64px SVG scaled by transform.
      Writing width/height in pixels each frame costs a layout and a paint
      per frame, which is what "laggy" actually was. The stroke stays 1px at
      any scale via vector-effect:non-scaling-stroke.

   3. NO BACKDROP FILTER ON THE DEFAULT PATH. Chromium re-rasterises a
      reference backdrop-filter every frame. The glass layer is built only
      when refraction is opted into — <html data-lens-refract> or
      Aph.lens.refract(true).

   Motion is frame-rate-independent exponential smoothing, not a spring:
   swift, never oscillates, and settles in about 40ms.

   Over a link         → ring opens to 64px and eases toward a small target's centre
   Over body text      → ring hides, a 26px caret takes its place
   Over an artifact    → four corner ticks: this is manipulable
   Over a text field   → we vanish; the native caret returns
   Touch               → never initialised
   Reduced motion      → the ring is placed without smoothing

   pointer-events:none throughout — it can never be why a click missed.
   ========================================================================== */
(function () {
  'use strict';

  var A = window.Aph || (window.Aph = {});
  var coarse = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (coarse || !document.body) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- geometry ------------------------------------------------------ */
  var BASE = 64;                                   // the ring box never changes
  var SIZE = { idle: 34, link: 64, reticle: 48 };
  var TEXT_H = 26;
  var RATE_POS = 26;                               // higher = swifter
  var RATE_SIZE = 19;
  var NS = 'http://www.w3.org/2000/svg';

  /* ---- DOM ------------------------------------------------------------ */
  var root = el('div', 'lens' + (reduce ? ' lens--static' : ''));
  root.setAttribute('aria-hidden', 'true');
  var dot = el('div', 'lens__dot');
  var caret = el('div', 'lens__caret');
  var ring = svg('svg', { 'class': 'lens__ring', viewBox: '0 0 64 64' });
  ring.appendChild(svg('circle', { 'class': 'lens__stroke', cx: 32, cy: 32, r: 31 }));
  var gleam = svg('circle', {
    'class': 'lens__gleam', cx: 32, cy: 32, r: 31,
    pathLength: 100, 'stroke-dasharray': '17 83', 'stroke-linecap': 'round'
  });
  ring.appendChild(gleam);
  var ticks = svg('g', { 'class': 'lens__ticks' });
  ['M2 13V2h11', 'M62 13V2H51', 'M2 51v11h11', 'M62 51v11H51'].forEach(function (d) {
    ticks.appendChild(svg('path', { d: d }));
  });
  ring.appendChild(ticks);
  root.appendChild(dot); root.appendChild(ring); root.appendChild(caret);

  var glass = null, dispMap = null;
  if (!reduce && document.documentElement.hasAttribute('data-lens-refract')) enableGlass();

  document.body.appendChild(root);
  document.documentElement.classList.add('has-lens');

  function el(tag, cls) { var e = document.createElement(tag); e.className = cls; return e; }
  function svg(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  /* ---- the opt-in refraction layer -----------------------------------
     A radial displacement map: R = x offset, G = y offset, 128 = none.
     Displacement rises toward the rim and stops hard at it — a glass edge.
     Built on request only; see the header note. */
  function enableGlass() {
    if (glass) return true;
    var N = 96, cv = document.createElement('canvas'); cv.width = cv.height = N;
    var ctx = cv.getContext('2d'); if (!ctx) return false;
    var img = ctx.createImageData(N, N), d = img.data, c = (N - 1) / 2;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var nx = (x - c) / c, ny = (y - c) / c, r = Math.sqrt(nx * nx + ny * ny), g = 0;
      if (r < 1) { var t = smooth(0.42, 1.0, r); g = t * t; }
      var i = (y * N + x) * 4;
      d[i] = Math.round(128 - 127 * nx * g);
      d[i + 1] = Math.round(128 - 127 * ny * g);
      d[i + 2] = 128; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var holder = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
    holder.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    var f = svg('filter', {
      id: 'aph-lens', x: 0, y: 0, width: '100%', height: '100%',
      'color-interpolation-filters': 'sRGB'
    });
    var fi = svg('feImage', { preserveAspectRatio: 'none', result: 'map' });
    fi.setAttributeNS('http://www.w3.org/1999/xlink', 'href', cv.toDataURL('image/png'));
    fi.setAttribute('href', cv.toDataURL('image/png'));
    dispMap = svg('feDisplacementMap', {
      'in': 'SourceGraphic', in2: 'map', scale: 4, xChannelSelector: 'R', yChannelSelector: 'G'
    });
    f.appendChild(fi); f.appendChild(dispMap); holder.appendChild(f);
    glass = el('div', 'lens__glass');
    root.insertBefore(glass, ring);
    root.appendChild(holder);
    root.classList.add('lens--refract');
    return true;
  }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ---- state ---------------------------------------------------------- */
  var px = -200, py = -200;              // pointer
  var rx = px, ry = py;                  // ring position
  var vx = 0, vy = 0;                    // ring velocity, for the gleam tilt only
  var sz = SIZE.idle, szT = SIZE.idle;
  var strength = 4, strengthT = 4;
  var mode = 'idle', pressed = false, shown = false, raf = 0, last = 0;
  var magnet = null, lastTarget = null;

  /* ---- classification -------------------------------------------------- */
  var SEL_NATIVE = 'input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable]:not([contenteditable="false"])';
  var SEL_LINK = 'a[href], button, [role="button"], summary, label, input[type=range], input[type=checkbox], input[type=radio], [data-lens="link"]';
  var SEL_ARTIFACT = '[data-artifact], [data-lens="reticle"]';
  var SEL_TEXT = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, dt, dd, figcaption, td, th, .lede, address, [data-lens="text"]';

  function classify(target) {
    if (!target || target.nodeType !== 1) return 'idle';
    if (target.closest(SEL_NATIVE)) return 'native';
    var link = target.closest(SEL_LINK);
    if (link) {
      var r = link.getBoundingClientRect();
      magnet = (r.width < 260 && r.height < 120) ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2 } : null;
      return 'link';
    }
    magnet = null;
    if (target.closest(SEL_ARTIFACT)) return 'reticle';
    if (target.closest(SEL_TEXT)) return 'text';
    return 'idle';
  }

  function setMode(m) {
    if (m === mode) return;
    root.classList.remove('lens--' + mode);
    mode = m;
    root.classList.add('lens--' + mode);
    switch (m) {
      case 'link':    szT = SIZE.link;    strengthT = 7.5; break;
      case 'reticle': szT = SIZE.reticle; strengthT = 0;   break;
      case 'text':    szT = SIZE.idle;    strengthT = 0;   break;
      default:        szT = SIZE.idle;    strengthT = 4;
    }
  }

  /* ---- events ---------------------------------------------------------- */
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    px = e.clientX; py = e.clientY;
    // the dot: synchronous, no rAF, no smoothing
    dot.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
    if (e.target !== lastTarget) { lastTarget = e.target; setMode(classify(e.target)); }
    if (!shown) { shown = true; rx = px; ry = py; sz = szT; root.classList.add('is-on'); place(); }
    if (reduce) { rx = px; ry = py; sz = szT; place(); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }, { passive: true });

  document.addEventListener('pointerdown', function (e) {
    if (e.button === 0) { pressed = true; kick(); }
  }, { passive: true });
  document.addEventListener('pointerup', function () { pressed = false; kick(); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { shown = false; root.classList.remove('is-on'); });
  document.documentElement.addEventListener('mouseenter', function () { if (px > -50) { shown = true; root.classList.add('is-on'); } });
  window.addEventListener('blur', function () { pressed = false; });
  // when the content under a still pointer changes (a menu opens, the page scrolls), re-classify
  document.addEventListener('scroll', function () { lastTarget = null; }, { passive: true, capture: true });

  function kick() { if (!reduce && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  /* ---- the loop --------------------------------------------------------
     Exponential smoothing rather than a spring: 1 - e^(-dt·rate) is the same
     fraction of the remaining distance per unit of TIME, not per frame, so it
     behaves identically at 60Hz and 144Hz and never overshoots. */
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000) || 0.016; last = now;
    var kp = 1 - Math.exp(-dt * RATE_POS);
    var ks = 1 - Math.exp(-dt * RATE_SIZE);

    // target: the pointer, biased toward a small link's centre
    var tx = px, ty = py;
    if (mode === 'link' && magnet) { tx = px + (magnet.cx - px) * 0.42; ty = py + (magnet.cy - py) * 0.42; }

    var ox = rx, oy = ry;
    rx += (tx - rx) * kp; ry += (ty - ry) * kp;
    vx = (rx - ox) / dt; vy = (ry - oy) / dt;

    var target = szT * (pressed ? 0.86 : 1);
    sz += (target - sz) * ks;

    strength += (strengthT - strength) * Math.min(1, dt * 10);
    if (dispMap) {
      var s = Math.round(strength * 10) / 10;
      if (dispMap.__s !== s) { dispMap.__s = s; dispMap.setAttribute('scale', String(s)); }
    }

    // velocity tilts the gleam: the light comes from the direction of travel
    var speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > 40) {
      var ang = Math.atan2(vy, vx) * 180 / Math.PI + 90;
      gleam.setAttribute('transform', 'rotate(' + ang.toFixed(1) + ' 32 32)');
    }

    place();

    var settled = Math.abs(tx - rx) < 0.05 && Math.abs(ty - ry) < 0.05 &&
                  Math.abs(target - sz) < 0.05 && Math.abs(strengthT - strength) < 0.05;
    raf = settled ? 0 : requestAnimationFrame(tick);
  }

  /* Transform only — never width/height. The 1px stroke survives the scale
     because the SVG uses vector-effect:non-scaling-stroke. */
  function place() {
    var s = sz / BASE;
    var t = 'translate3d(' + (rx - BASE / 2).toFixed(2) + 'px,' + (ry - BASE / 2).toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';
    ring.style.transform = t;
    if (glass) glass.style.transform = t;
    caret.style.transform = 'translate3d(' + (rx - 0.5).toFixed(2) + 'px,' + (ry - TEXT_H / 2).toFixed(2) + 'px,0)';
  }

  /* ---- API -------------------------------------------------------------- */
  A.lens = {
    el: root,
    refresh: function () { lastTarget = null; },
    refract: function (on) {
      if (on) { var ok = !reduce && enableGlass(); root.classList.toggle('lens--refract', ok); return ok; }
      root.classList.remove('lens--refract');
      return false;
    },
    hide: function () { root.classList.remove('is-on'); },
    show: function () { if (shown) root.classList.add('is-on'); }
  };
})();
