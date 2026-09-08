/* ==========================================================================
   SITE — orchestration
   assets/js/site.js

   · window.Aph          shared runtime: reduce/coarse flags, visibility-aware
                          IntersectionObserver helper, formatting utilities
   · navigation           fixed bar, mega menu (hover intent + click), drawer
   · reveal               [data-reveal] enters once, staggered by --i
   · page transitions     fade out on internal navigation, fade in on ready
   · hero + artifacts     mounted here so the order of initialisation is one place
   · footer clocks        Ahmedabad and Sharjah, live
   ========================================================================== */
(function () {
  'use strict';

  var A = window.Aph || (window.Aph = {});
  var html = document.documentElement;

  A.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  A.coarse = !!(window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches);
  A.hidden = document.hidden;

  /* ---- visibility-aware watcher --------------------------------------
     watch(el, onEnter, onLeave) fires onEnter when el is on screen AND the
     tab is visible; onLeave when either stops being true. Every animation
     loop on the site hangs off this, so nothing burns a frame off-screen. */
  var watched = [];
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var w = en.target.__aphWatch; if (!w) return;
      w.inView = en.isIntersecting; sync(w);
    });
  }, { threshold: 0.05, rootMargin: '80px 0px' }) : null;

  function sync(w) {
    var should = w.inView && !A.hidden;
    if (should && !w.active) { w.active = true; w.onEnter && w.onEnter(); }
    else if (!should && w.active) { w.active = false; w.onLeave && w.onLeave(); }
  }
  A.watch = function (el, onEnter, onLeave) {
    var w = { el: el, onEnter: onEnter, onLeave: onLeave, inView: !io, active: false };
    el.__aphWatch = w; watched.push(w);
    if (io) io.observe(el); else sync(w);
    return { stop: function () { if (io) io.unobserve(el); w.inView = false; sync(w); } };
  };
  document.addEventListener('visibilitychange', function () {
    A.hidden = document.hidden; watched.forEach(sync);
  });

  /* ---- utilities ------------------------------------------------------ */
  A.inr = function (n) {
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + ' L';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  };
  A.el = function (tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  };
  A.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---- navigation ---------------------------------------------------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    /* The bar floats over the page and auto-hides on the way down. It reveals on
       any upward movement, is always visible near the top, ignores deltas under
       6px so it cannot jitter, and never hides while a menu or the drawer is
       open or focus is inside it — a keyboard user must not lose the nav. */
    var SHOW_ABOVE = 120, DEAD = 6;
    var scrolled = false, hidden = false, ticking = false, lastY = window.scrollY || 0;
    var progress = nav.querySelector('.nav__progress i');
    var mcta = document.querySelector('.mcta'), mctaIn = false;

    function navPinned() {
      return A.reduce || !!openId ||
        (drawer && drawer.classList.contains('is-open')) ||
        nav.contains(document.activeElement);
    }
    function setHidden(v) {
      if (v === hidden) return;
      hidden = v; nav.classList.toggle('is-hidden', v);
    }
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var y = window.scrollY || 0;
        var s = y > 24;
        if (s !== scrolled) { scrolled = s; nav.classList.toggle('is-scrolled', s); }

        // scroll progress and the mobile CTA ride this same frame — no extra listeners
        if (progress) {
          var max = document.documentElement.scrollHeight - window.innerHeight;
          progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max).toFixed(4) : 0) + ')';
        }
        if (mcta) {
          var want = y > 600 && !(drawer && drawer.classList.contains('is-open'));
          if (want !== mctaIn) {
            mctaIn = want;
            if (want) mcta.hidden = false;
            mcta.classList.toggle('is-in', want);
          }
        }

        if (navPinned()) { setHidden(false); lastY = y; return; }
        if (y <= SHOW_ABOVE) { setHidden(false); lastY = y; return; }
        var d = y - lastY;
        if (Math.abs(d) < DEAD) return;   // lastY is left alone so small moves accumulate rather than jitter
        setHidden(d > 0);
        lastY = y;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    nav.addEventListener('focusin', function () { setHidden(false); });

    // mega menus: [data-menu] triggers, .menu[data-menu-for] panels
    var triggers = nav.querySelectorAll('[data-menu]');
    var openId = null, closeT = 0;
    function panel(id) { return nav.querySelector('.menu[data-menu-for="' + id + '"]'); }
    function openMenu(id) {
      clearTimeout(closeT);
      if (openId === id) return;
      closeMenu(true);
      var p = panel(id), t = nav.querySelector('[data-menu="' + id + '"]');
      if (!p) return;
      p.classList.add('is-open'); t.setAttribute('aria-expanded', 'true'); openId = id;
      setHidden(false);
      A.lens && A.lens.refresh();
    }
    function closeMenu(now) {
      clearTimeout(closeT);
      var doClose = function () {
        if (!openId) return;
        var p = panel(openId), t = nav.querySelector('[data-menu="' + openId + '"]');
        p && p.classList.remove('is-open'); t && t.setAttribute('aria-expanded', 'false'); openId = null;
      };
      if (now) doClose(); else closeT = setTimeout(doClose, 160);
    }
    triggers.forEach(function (t) {
      var id = t.getAttribute('data-menu'), p = panel(id);
      t.setAttribute('aria-expanded', 'false'); t.setAttribute('aria-haspopup', 'true');
      t.addEventListener('click', function (e) { e.preventDefault(); openId === id ? closeMenu(true) : openMenu(id); });
      if (!A.coarse) {
        t.addEventListener('pointerenter', function () { openMenu(id); });
        t.addEventListener('pointerleave', function () { closeMenu(false); });
        if (p) {
          p.addEventListener('pointerenter', function () { clearTimeout(closeT); });
          p.addEventListener('pointerleave', function () { closeMenu(false); });
        }
      }
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' && p) { e.preventDefault(); openMenu(id); var f = p.querySelector('a'); f && f.focus(); }
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(true); closeDrawer(); } });
    document.addEventListener('pointerdown', function (e) { if (openId && !nav.contains(e.target)) closeMenu(true); });
    // keep menus closed when focus leaves the nav via keyboard
    nav.addEventListener('focusout', function (e) { if (openId && !nav.contains(e.relatedTarget)) closeMenu(true); });

    // drawer
    var burger = nav.querySelector('.nav__burger'), drawer = document.querySelector('.drawer');
    function closeDrawer() {
      if (!drawer || !drawer.classList.contains('is-open')) return;
      drawer.classList.remove('is-open'); nav.classList.remove('is-open');
      burger && burger.setAttribute('aria-expanded', 'false'); html.style.overflow = '';
    }
    if (burger && drawer) {
      burger.setAttribute('aria-expanded', 'false');
      burger.addEventListener('click', function () {
        var open = !drawer.classList.contains('is-open');
        drawer.classList.toggle('is-open', open); nav.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open)); html.style.overflow = open ? 'hidden' : '';
        if (open) setHidden(false);
      });
      window.addEventListener('resize', function () { if (window.innerWidth > 1040) closeDrawer(); });
    }
  }

  /* ---- current page marker -------------------------------------------
     The nav and footer markup is byte-identical on every page (that is what
     the partials are for), so the active link is marked at runtime rather
     than baked in. Purely additive: nothing depends on it. */
  (function () {
    var here = location.pathname.replace(/index\.html$/, '');
    if (here !== '/' && here.charAt(here.length - 1) !== '/') here += '/';
    document.querySelectorAll('.nav a[href^="/"], .footer a[href^="/"], .drawer a[href^="/"]').forEach(function (a) {
      if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    });
  })();

  /* ---- capability constellation --------------------------------------
     /services/ only. The map is complete static HTML; this just isolates a
     group. Without it every node is still there and still a link. */
  (function () {
    var field = document.querySelector('.consto__field');
    if (!field) return;
    var btns = document.querySelectorAll('[data-cf]');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.getAttribute('data-cf');
        btns.forEach(function (o) {
          var on = o === b;
          o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', String(on));
        });
        if (g === 'all') field.removeAttribute('data-cf'); else field.setAttribute('data-cf', g);
      });
    });
    // hovering or focusing a point isolates its group too, then releases
    field.addEventListener('pointerover', function (e) {
      var n = e.target.closest && e.target.closest('.cnode');
      if (n && !field.hasAttribute('data-cf-locked')) field.setAttribute('data-cf', n.getAttribute('data-g'));
    });
    field.addEventListener('pointerleave', function () {
      var on = document.querySelector('[data-cf].is-on');
      var g = on && on.getAttribute('data-cf');
      if (!g || g === 'all') field.removeAttribute('data-cf'); else field.setAttribute('data-cf', g);
    });
  })();

  /* ---- reveal ---------------------------------------------------------- */
  var reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length) {
    // stagger siblings inside a [data-reveal-group]
    document.querySelectorAll('[data-reveal-group]').forEach(function (g) {
      g.querySelectorAll('[data-reveal]').forEach(function (r, i) { r.style.setProperty('--i', i); });
    });
    if (A.reduce || !('IntersectionObserver' in window)) {
      reveals.forEach(function (r) { r.classList.add('is-in'); });
    } else {
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); rio.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      reveals.forEach(function (r) { rio.observe(r); });
    }
  }

  /* ---- boot screen and page transitions -------------------------------
     The boot screen is an overlay on already-rendered HTML — <body> is never
     hidden — so a script failure degrades to a plain, readable page. A first
     visit gets the full ~600ms mark; a return visit inside the session gets
     only as long as it needs. Reduced motion gets neither. */
  var boot = document.getElementById('boot');
  var BOOT_FIRST = 600, BOOT_BACK = 180, WIPE = 220;
  var booted = false;
  try { booted = sessionStorage.getItem('aph-booted') === '1'; sessionStorage.setItem('aph-booted', '1'); } catch (e) {}

  function clearBoot() { html.classList.add('is-ready'); if (boot) boot.classList.add('is-done'); }

  if (!boot || A.reduce) {
    clearBoot();
  } else {
    var t0 = performance.now();
    var hold = booted ? BOOT_BACK : BOOT_FIRST;
    var release = function () {
      setTimeout(clearBoot, Math.max(0, hold - (performance.now() - t0)));
    };
    if (document.readyState === 'complete') release();
    else window.addEventListener('load', release);
    setTimeout(clearBoot, 1600);   // fonts or a slow image must never hold the page hostage
  }
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { if (boot) boot.classList.remove('is-wipe'); clearBoot(); }
  });

  if (!A.reduce) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download') || a.getAttribute('href').charAt(0) === '#') return;
      var url; try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      if (boot) { boot.classList.remove('is-done'); boot.classList.add('is-wipe'); }
      setTimeout(function () { location.href = url.href; }, WIPE);
    });
  }

  /* ---- hero + artifacts ----------------------------------------------- */
  var heroEl = document.querySelector('[data-hero]');
  if (heroEl && window.AphHero) A.hero = window.AphHero.mount(heroEl);
  if (window.AphArtifacts) window.AphArtifacts.init(document);

  /* ---- footer clocks -------------------------------------------------- */
  var clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length && window.Intl && Intl.DateTimeFormat) {
    var fmts = {};
    function tickClocks() {
      var now = new Date();
      clocks.forEach(function (c) {
        var tz = c.getAttribute('data-clock');
        try {
          fmts[tz] = fmts[tz] || new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false });
          c.textContent = fmts[tz].format(now) + ' local';
        } catch (err) { c.textContent = ''; }
      });
    }
    tickClocks(); setInterval(tickClocks, 15000);
  }
  var yr = document.querySelector('[data-year]'); if (yr) yr.textContent = String(new Date().getFullYear());
})();
