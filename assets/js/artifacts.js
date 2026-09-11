/* ==========================================================================
   ARTIFACTS — the interactive library
   assets/js/artifacts.js

   Eighteen components, one system. Each is declared with
     AphArtifacts.define(name, meta, factory)
   and mounted from markup:
     <div data-artifact="breach-cost" data-config='{"title":"…"}'></div>

   The factory receives (body, cfg, ctx) and returns an optional
   { start, stop, destroy }. start/stop are wired to Aph.watch, so anything
   with a clock runs only while on screen in a visible tab.

   The rule: no motion without an argument. Every artifact teaches, proves
   or qualifies. Every one ships with sample data and says so in its footer.
   Every one is keyboard-operable. Under reduced motion they freeze to a
   meaningful still, never an empty box.

   Registry: breach-cost · phish-or-legit · attack-path · framework-mapper ·
   ir-scrubber · soc-console · typosquat · severity-triage · blast-radius ·
   kill-chain · purdue-layers · readiness · control-explorer · scan-vs-exploit ·
   vendor-risk-matrix · dpdp-penalty · incident-triage-intake · orbital-timeline
   ========================================================================== */
window.AphArtifacts = (function () {
  'use strict';

  var R = {};
  var A = window.Aph || (window.Aph = {});

  /* ---- helpers ------------------------------------------------------- */
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
    });
    if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function inr(n) {
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + ' L';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }
  function reduce() { return !!A.reduce || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function rangeFill(input) {
    var min = +input.min || 0, max = +input.max || 100;
    input.style.setProperty('--pct', ((+input.value - min) / (max - min) * 100).toFixed(2) + '%');
  }
  function parse(s) { try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } }
  var uidN = 0; function uid(p) { return 'aph-' + p + '-' + (++uidN); }
  function keyActivate(el, fn) {
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } });
  }

  /* ---- registry ------------------------------------------------------- */
  function define(name, meta, factory) { R[name] = { meta: meta, factory: factory }; }

  function chrome(el, meta, cfg) {
    if (el.hasAttribute('data-bare')) return el;
    el.classList.add('artifact'); if (meta.tall) el.classList.add('artifact--tall');
    var titleId = uid('t');
    el.setAttribute('aria-labelledby', titleId); el.setAttribute('role', 'group');
    el.appendChild(h('div', { class: 'artifact__head' }, [
      h('div', { class: 'artifact__title' }, [
        h('h3', { id: titleId, text: cfg.title || meta.title }),
        h('p', { class: 'artifact__mech', text: cfg.mechanic || meta.mechanic })
      ]),
      h('span', { class: 'artifact__tag', text: cfg.tag || meta.tag || 'Interactive' })
    ]));
    var body = h('div', { class: 'artifact__body' });
    el.appendChild(body);
    /* The left footnote is the sample-data disclaimer by default. Artifacts that
       carry no sample data at all — a real intake form, our own company facts —
       override it with `note`; they must still say what they are. */
    var note = cfg.note || meta.note ||
      '<b>Illustrative sample data</b> · not a measurement of any real system';
    el.appendChild(h('div', { class: 'artifact__foot' }, [
      h('span', { html: note }),
      h('span', { text: cfg.foot || meta.foot || '' })
    ]));
    return body;
  }

  function mount(el) {
    if (el.__aph) return el.__aph;
    var name = el.getAttribute('data-artifact'), def = R[name];
    if (!def) { el.setAttribute('data-artifact-missing', name); return null; }
    var cfg = Object.assign({}, def.meta.defaults || {}, parse(el.getAttribute('data-config')));
    var body = chrome(el, def.meta, cfg);
    var ctx = { h: h, inr: inr, reduce: reduce(), coarse: !!A.coarse, uid: uid, rangeFill: rangeFill, key: keyActivate };
    var inst = def.factory(body, cfg, ctx) || {};
    if ((inst.start || inst.stop) && A.watch) A.watch(el, inst.start || null, inst.stop || null);
    else if (inst.start) inst.start();
    el.__aph = inst;
    return inst;
  }
  function init(scope) { Array.prototype.forEach.call((scope || document).querySelectorAll('[data-artifact]'), mount); }


  /* ==========================================================================
     1 · BREACH COST MODEL
     Argument: dwell time is the variable you control; every day undetected costs.
     ========================================================================== */
  define('breach-cost', {
    title: 'Breach cost model',
    mechanic: 'Three inputs you know today. The model shows what a long dwell time adds to a breach, and what detecting it in a day would have saved.',
    tag: 'Qualifies', foot: 'Per-record and dwell coefficients are sample parameters',
    defaults: { records: 50000, dwell: 180, sector: '1.0' }
  }, function (body, cfg, ctx) {
    var recId = ctx.uid('rec'), dwId = ctx.uid('dw'), secId = ctx.uid('sec');
    var rec = h('input', { type: 'range', class: 'range', id: recId, min: 1000, max: 1000000, step: 1000, value: cfg.records });
    var dw = h('input', { type: 'range', class: 'range', id: dwId, min: 1, max: 280, step: 1, value: cfg.dwell });
    var sec = h('select', { class: 'input', id: secId }, [
      ['1.0', 'Technology / SaaS'], ['1.35', 'Finance & banking'], ['1.5', 'Healthcare & pharma'],
      ['0.85', 'Retail & e-commerce'], ['1.1', 'Manufacturing'], ['0.9', 'Hospitality']
    ].map(function (o) { return h('option', { value: o[0], text: o[1], selected: o[0] === cfg.sector }); }));
    var recV = h('b'), dwV = h('b'), out = h('div', { class: 'bigno bigno--crit' }), saved = h('div', { class: 'bigno bigno--ok', style: 'font-size:1.5rem' });

    body.appendChild(h('div', { class: 'calc' }, [
      h('div', { class: 'calc__in' }, [
        h('div', { class: 'field' }, [h('label', { for: recId }, ['Records held', recV]), rec]),
        h('div', { class: 'field' }, [h('label', { for: secId }, ['Sector']), sec]),
        h('div', { class: 'field' }, [h('label', { for: dwId }, ['Days to detect', dwV]), dw])
      ]),
      h('div', { class: 'calc__out' }, [
        h('div', {}, [out, h('div', { class: 'tiny', text: 'Modelled exposure' })]),
        h('div', {}, [saved, h('div', { class: 'tiny', text: 'Avoided at one-day detection' })]),
        h('details', { class: 'calc__how' }, [
          h('summary', { text: 'How this is modelled' }),
          h('p', { text: 'Exposure = records × a per-record cost × a sector multiplier × (1 + dwell factor). The per-record figure and the dwell curve are sample parameters chosen to be plausible for Indian mid-market organisations; they are not a measurement and your number will differ. The shape is the point: cost grows with time undetected.' })
        ])
      ])
    ]));

    function cost(days) { return (+rec.value) * 430 * parseFloat(sec.value) * (1 + days / 280 * 0.42); }
    function upd() {
      recV.textContent = (+rec.value).toLocaleString('en-IN'); dwV.textContent = dw.value;
      ctx.rangeFill(rec); ctx.rangeFill(dw);
      var c = cost(+dw.value); out.textContent = inr(c); saved.textContent = inr(Math.max(0, c - cost(1)));
    }
    [rec, dw, sec].forEach(function (e) { e.addEventListener('input', upd); });
    upd();
  });


  /* ==========================================================================
     2 · PHISH OR LEGIT
     Argument: the tells are learnable; the click rate is the business case.
     ========================================================================== */
  define('phish-or-legit', {
    title: 'Phish or legit?',
    mechanic: 'Three messages from a morning inbox. One is a phish. Pick it, and every message shows its tells.',
    tag: 'Teaches', foot: 'Sender domains use reserved .example names'
  }, function (body, cfg, ctx) {
    var SETS = [
      [
        { from: 'no-reply@aphelioncyber.com', when: '08:41', subj: 'Your September statement is ready', phish: false, tell: 'Legitimate: the domain matches, there is no deadline, and nothing asks for a credential.' },
        { from: 'it-support@aphelioncyber.co', when: '08:52', subj: 'URGENT: re-verify your password within 2 hours', phish: true, tell: 'Three tells: .co, not .com · a manufactured deadline · a request for credentials.' },
        { from: 'priya.d@yourcompany.example', when: '09:03', subj: 'Notes from Tuesday’s review', phish: false, tell: 'Legitimate: a known colleague, conversational context, no link and no attachment.' }
      ],
      [
        { from: 'hr@yourcompany.example', when: '10:12', subj: 'Updated leave policy for review', phish: false, tell: 'Legitimate: expected sender, no urgency, links to the intranet you already use.' },
        { from: 'payroll@yourcornpany.example', when: '10:18', subj: 'Salary revision: confirm your bank details today', phish: true, tell: 'Two tells: "cornpany" — an r and an n dressed as an m · a request for bank details with a same-day deadline.' },
        { from: 'security@yourcompany.example', when: '10:40', subj: 'Scheduled MFA change this Friday', phish: false, tell: 'Legitimate: announces a change, asks for nothing now, and matches your real security team’s address.' }
      ]
    ];
    var set = 0, done = false;
    var wrap = h('div', { class: 'mails' }), out = h('div', { class: 'artifact__out', text: 'Pick the phish.' });
    var again = h('button', { class: 'btn btn--ghost btn--small', type: 'button', text: 'Try another set', style: 'margin-top:14px', hidden: true });
    body.appendChild(wrap); body.appendChild(out); body.appendChild(again);

    function render() {
      wrap.innerHTML = ''; done = false; again.hidden = true; out.textContent = 'Pick the phish.';
      SETS[set].forEach(function (m) {
        var b = h('button', { class: 'mail', type: 'button' }, [
          h('span', { class: 'from', text: m.from }), h('span', { class: 'when', text: m.when }),
          h('span', { class: 'subj', text: m.subj }), h('span', { class: 'tell', text: m.tell })
        ]);
        b.addEventListener('click', function () {
          if (done) return; done = true;
          Array.prototype.forEach.call(wrap.children, function (e, j) {
            e.classList.add('is-revealed', SETS[set][j].phish ? 'is-phish' : 'is-legit'); e.setAttribute('disabled', '');
          });
          out.innerHTML = m.phish
            ? '<span class="ok">Correct.</span> In simulations, a meaningful share of staff click anyway. That share is what training moves.'
            : '<span class="crit">That one is real.</span> Missing a phish in a calm moment is the whole case for rehearsing it.';
          again.hidden = false;
        });
        wrap.appendChild(b);
      });
    }
    again.addEventListener('click', function () { set = (set + 1) % SETS.length; render(); wrap.querySelector('.mail').focus(); });
    render();
  });


  /* ==========================================================================
     3 · ATTACK PATH GRAPH
     Argument: identity misconfigurations chain; the fix is the weakest link.
     ========================================================================== */
  define('attack-path', {
    title: 'Attack path to Tier-0',
    mechanic: 'Select any node. The graph traces the shortest chain of identity misconfigurations from there to Domain Admin, and names the link to break first.',
    tag: 'Proves', foot: 'The example path is the one AphelioNYX documents: Kerberoast → ESC1 → DCSync'
  }, function (body, cfg, ctx) {
    var N = [
      { id: 0, x: 6, y: 92, w: 124, t: 'Domain Users', s: 'any authenticated user' },
      { id: 1, x: 168, y: 22, w: 124, t: 'svc_sql', s: 'service account · SPN set' },
      { id: 2, x: 168, y: 162, w: 124, t: 'helpdesk', s: 'security group' },
      { id: 3, x: 322, y: 92, w: 150, t: 'ADCS template', s: 'ESC1 · enrollee-supplied SAN' },
      { id: 4, x: 486, y: 22, w: 108, t: 'DC-01', s: 'replication rights' },
      { id: 5, x: 486, y: 162, w: 108, t: 'Domain Admin', s: 'tier-0' }
    ];
    var E = [
      [0, 1, 'Kerberoast', 'Rotate svc_sql to a 25+ character random password or a gMSA; the ticket becomes uncrackable.'],
      [0, 2, 'MemberOf', ''],
      [1, 3, 'Enroll', 'Remove enrol rights for service accounts on the template.'],
      [2, 3, 'Enroll', 'Restrict enrolment to the PKI admins group.'],
      [3, 4, 'Auth as DC', 'Disable "enrollee supplies subject" on the ESC1 template.'],
      [4, 5, 'DCSync', 'Audit replication rights; only domain controllers should hold them.'],
      [2, 1, 'ResetPassword', 'Remove helpdesk reset rights over service accounts.']
    ];
    var NS = 'http://www.w3.org/2000/svg', HGT = 32;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'apg'); svg.setAttribute('viewBox', '0 0 600 210'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Attack path graph with six identity nodes');
    var eg = document.createElementNS(NS, 'g'), ng = document.createElementNS(NS, 'g');
    svg.appendChild(eg); svg.appendChild(ng);
    var out = h('div', { class: 'artifact__out' });
    body.appendChild(h('div', { class: 'apg-wrap' }, svg)); body.appendChild(out);

    function cx(n) { return n.x + n.w / 2; } function cy(n) { return n.y + HGT / 2; }
    E.forEach(function (e, i) {
      var a = N[e[0]], b = N[e[1]], p = document.createElementNS(NS, 'path');
      var mx = (cx(a) + cx(b)) / 2;
      p.setAttribute('class', 'edge'); p.setAttribute('data-e', i);
      p.setAttribute('d', 'M' + cx(a) + ',' + cy(a) + ' C' + mx + ',' + cy(a) + ' ' + mx + ',' + cy(b) + ' ' + cx(b) + ',' + cy(b));
      eg.appendChild(p);
      var tx = document.createElementNS(NS, 'text');
      tx.setAttribute('class', 'elabel'); tx.setAttribute('x', mx); tx.setAttribute('y', (cy(a) + cy(b)) / 2 - 4); tx.setAttribute('text-anchor', 'middle');
      tx.textContent = e[2]; eg.appendChild(tx);
    });
    N.forEach(function (n) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'nd' + (n.id === 5 ? ' is-t0' : '')); g.setAttribute('data-n', n.id);
      g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', n.t + ', ' + n.s);
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', n.x); r.setAttribute('y', n.y); r.setAttribute('width', n.w); r.setAttribute('height', HGT);
      var t = document.createElementNS(NS, 'text'); t.setAttribute('x', n.x + 8); t.setAttribute('y', n.y + 13); t.textContent = n.t;
      var s = document.createElementNS(NS, 'text'); s.setAttribute('class', 'sub'); s.setAttribute('x', n.x + 8); s.setAttribute('y', n.y + 24); s.textContent = n.s;
      g.appendChild(r); g.appendChild(t); g.appendChild(s); ng.appendChild(g);
      g.addEventListener('click', function () { trace(n.id); });
      ctx.key(g, function () { trace(n.id); });
    });

    function trace(start) {
      Array.prototype.forEach.call(ng.querySelectorAll('.nd'), function (e) { e.classList.remove('is-lit'); });
      Array.prototype.forEach.call(eg.querySelectorAll('.edge'), function (e) { e.classList.remove('is-lit'); });
      if (start === 5) { ng.querySelector('[data-n="5"]').classList.add('is-lit'); out.innerHTML = '<span class="crit">Domain Admin is the objective.</span> Every path on this graph terminates here.'; return; }
      var prev = {}, q = [start], seen = {}; seen[start] = 1;
      while (q.length) {
        var c = q.shift(); if (c === 5) break;
        for (var i = 0; i < E.length; i++) if (E[i][0] === c && !seen[E[i][1]]) { seen[E[i][1]] = 1; prev[E[i][1]] = [c, i]; q.push(E[i][1]); }
      }
      if (!prev[5]) { out.textContent = 'No path to Tier-0 from this node.'; return; }
      var path = [5], cur = 5, edges = [];
      while (prev[cur]) { edges.unshift(prev[cur][1]); cur = prev[cur][0]; path.unshift(cur); }
      edges.forEach(function (ei) { eg.querySelector('[data-e="' + ei + '"]').classList.add('is-lit'); });
      path.forEach(function (p) { ng.querySelector('[data-n="' + p + '"]').classList.add('is-lit'); });
      var weakest = E[edges[0]];
      out.innerHTML = '<span class="crit">' + edges.length + ' hop' + (edges.length > 1 ? 's' : '') + ' to Tier-0</span> · ' +
        path.map(function (p) { return N[p].t; }).join(' → ') +
        (weakest[3] ? '<br><span class="ok">Break it first:</span> ' + weakest[3] : '');
    }
    trace(0);
  });


  /* ==========================================================================
     4 · CROSS-FRAMEWORK MAPPER
     Argument: frameworks overlap; evidence collected once serves many audits.
     ========================================================================== */
  define('framework-mapper', {
    title: 'Cross-framework mapper',
    mechanic: 'Toggle the frameworks you are asked for. The overlap is the work you only have to do once.',
    tag: 'Teaches', foot: 'Control families and counts are simplified for orientation'
  }, function (body, cfg, ctx) {
    var FAM = ['Access control', 'Asset management', 'Cryptography', 'Physical security', 'Operations security', 'Communications security',
      'Supplier risk', 'Incident management', 'Business continuity', 'Compliance', 'Data subject rights', 'Breach notification',
      'Consent & notice', 'Retention & erasure', 'Logging & monitoring', 'Change management', 'People security', 'Risk assessment'];
    var FW = {
      'ISO 27001': { n: 93, f: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15, 16, 17] },
      'SOC 2': { n: 61, f: [0, 1, 4, 5, 7, 8, 9, 14, 15, 17] },
      'GDPR': { n: 59, f: [0, 2, 6, 7, 9, 10, 11, 12, 13, 17] },
      'HIPAA': { n: 104, f: [0, 1, 2, 3, 4, 7, 9, 11, 14, 16] },
      'DPDP Act': { n: 42, f: [0, 7, 9, 10, 11, 12, 13, 17] },
      'PCI DSS': { n: 69, f: [0, 1, 2, 3, 4, 5, 14, 15, 16] }
    };
    var sel = { 'ISO 27001': true, 'SOC 2': true };
    var chips = h('div', { class: 'chips' }), pct = h('div', { class: 'bigno bigno--ok' }), sh = h('div', { class: 'bigno', style: 'font-size:1.5rem' }), tot = h('div', { class: 'bigno', style: 'font-size:1.5rem' });
    var fams = h('div', { class: 'fam-grid' }, FAM.map(function (f) { return h('span', { class: 'fam', text: f }); }));
    Object.keys(FW).forEach(function (k) {
      var b = h('button', { class: 'btn btn--ghost btn--small', type: 'button', text: k, 'aria-pressed': sel[k] ? 'true' : 'false' });
      b.addEventListener('click', function () { sel[k] = !sel[k]; b.setAttribute('aria-pressed', String(!!sel[k])); calc(); });
      chips.appendChild(b);
    });
    body.appendChild(chips);
    body.appendChild(h('div', { class: 'fw-out' }, [
      h('div', {}, [pct, h('div', { class: 'tiny', text: 'Shared families' })]),
      h('div', {}, [sh, h('div', { class: 'tiny', text: 'Families in common' })]),
      h('div', {}, [tot, h('div', { class: 'tiny', text: 'Controls, summed' })])
    ]));
    body.appendChild(fams);
    function calc() {
      var keys = Object.keys(sel).filter(function (k) { return sel[k]; }), nodes = fams.children;
      Array.prototype.forEach.call(nodes, function (n) { n.classList.remove('is-shared'); });
      if (keys.length < 2) { pct.textContent = '—'; sh.textContent = '—'; tot.textContent = keys.length ? FW[keys[0]].n : '—'; return; }
      var inter = FW[keys[0]].f.slice(), union = {};
      keys.forEach(function (k) { FW[k].f.forEach(function (i) { union[i] = 1; }); });
      keys.slice(1).forEach(function (k) { inter = inter.filter(function (i) { return FW[k].f.indexOf(i) > -1; }); });
      inter.forEach(function (i) { nodes[i].classList.add('is-shared'); });
      pct.textContent = Math.round(inter.length / Object.keys(union).length * 100) + '%';
      sh.textContent = inter.length; tot.textContent = keys.reduce(function (a, k) { return a + FW[k].n; }, 0);
    }
    calc();
  });


  /* ==========================================================================
     5 · INCIDENT TIMELINE SCRUBBER
     Argument: the first hour decides the month.
     ========================================================================== */
  define('ir-scrubber', {
    title: 'Incident timeline',
    mechanic: 'Scrub thirty days after an intrusion. Two organisations, one difference: whether anyone was ready.',
    tag: 'Teaches', foot: 'Loss rates are sample parameters, in rupees'
  }, function (body, cfg, ctx) {
    var id = ctx.uid('ir');
    var r = h('input', { type: 'range', class: 'range', id: id, min: 0, max: 30, step: 0.5, value: 0 });
    var day = h('b', { text: '0' });
    var bs = h('span', { class: 'track__state' }), gs = h('span', { class: 'track__state' });
    var bb = h('i', { style: 'width:0;background:var(--sev-crit)' }), gb = h('i', { style: 'width:0;background:var(--ok)' });
    var bc = h('b', { class: 'crit' }), gc = h('b', { class: 'ok' });
    body.appendChild(h('div', { class: 'field' }, [h('label', { for: id }, [h('span', {}, ['Day ', day, ' of 30'])]), r,
      h('div', { class: 'marks' }, ['Intrusion', 'Week 1', 'Week 2', 'Week 3', 'Day 30'].map(function (m) { return h('span', { text: m }); }))]));
    body.appendChild(h('div', { class: 'tracks' }, [
      h('div', { class: 'track' }, [h('div', { class: 'track__lbl' }, [h('span', { class: 'tiny', text: 'No incident response plan' }), bs]), h('div', { class: 'bar' }, bb), h('div', { class: 'tiny' }, ['Estimated loss ', bc])]),
      h('div', { class: 'track' }, [h('div', { class: 'track__lbl' }, [h('span', { class: 'tiny', text: 'With a retained IR team' }), gs]), h('div', { class: 'bar' }, gb), h('div', { class: 'tiny' }, ['Estimated loss ', gc])])
    ]));
    function upd() {
      var d = parseFloat(r.value); day.textContent = d; ctx.rangeFill(r);
      bs.textContent = d < 0.2 ? 'Intrusion begins' : d < 21 ? 'Undetected — attacker resident' : d < 26 ? 'Detected. Scrambling.' : d < 29 ? 'Containing' : 'Recovering';
      gs.textContent = d < 0.02 ? 'Intrusion begins' : d < 0.05 ? 'Alert raised' : d < 0.1 ? 'Contained' : d < 1 ? 'Eradicated' : 'Recovered. Report filed.';
      bb.style.width = Math.min(100, d / 30 * 100) + '%'; gb.style.width = Math.min(100, d / 1 * 100) + '%';
      bc.textContent = inr(Math.min(d, 21) * 1900000 + Math.max(0, d - 21) * 400000);
      gc.textContent = inr(Math.min(d, 0.1) * 1900000 + Math.max(0, Math.min(d, 1) - 0.1) * 180000);
    }
    r.addEventListener('input', upd); upd();
    if (ctx.reduce) { r.value = 21; upd(); }
  });


  /* ==========================================================================
     6 · LIVE SOC CONSOLE
     Argument: detection is only real if something acts on it, in minutes.
     ========================================================================== */
  define('soc-console', {
    title: 'SOC console',
    mechanic: 'A simulated analyst feed. Every signal has an action beside it, because a detection nobody acts on is a log line.',
    tag: 'Simulated feed', foot: 'Signals are scripted; times are your clock'
  }, function (body, cfg, ctx) {
    var POOL = [
      ['Impossible travel — j.mehta', 'Session revoked', 'c'], ['Kerberoast attempt on svc_sql', 'Ticket denied', 'h'],
      ['New admin created off-hours', 'Held for approval', 'h'], ['Beacon-like DNS to a new domain', 'Domain sinkholed', 'c'],
      ['Bulk download from SharePoint', 'User challenged', 'm'], ['MFA fatigue — 14 pushes', 'Account locked', 'h'],
      ['EDR: LSASS access attempt', 'Process killed', 'c'], ['Firewall rule change, no ticket', 'Rolled back', 'm'],
      ['Password spray from 41 IPs', 'Range blocked', 'h']
    ];
    var seen = h('b', { text: '1,284' }), mttd = h('b', { style: 'color:var(--ok)', text: '00:04' });
    var feed = h('div', { class: 'soc', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
    body.appendChild(h('div', { class: 'stat-row' }, [
      h('div', { class: 'stat' }, [seen, h('span', { text: 'Signals today' })]),
      h('div', { class: 'stat' }, [mttd, h('span', { text: 'Median time to detect' })])
    ]));
    body.appendChild(feed);
    var i = 0, n = 1284, tick = null;
    function push() {
      var p = POOL[i % POOL.length]; i++;
      var d = new Date(), row = h('div', { class: 'soc__row' }, [
        h('span', { class: 'tm', text: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) }),
        h('span', { text: p[0], style: 'color:' + (p[2] === 'c' ? 'var(--sev-crit)' : p[2] === 'h' ? 'var(--sev-high)' : 'var(--sev-med)') }),
        h('span', { class: 'ac', text: p[1] })
      ]);
      feed.insertBefore(row, feed.firstChild);
      while (feed.children.length > 6) feed.removeChild(feed.lastChild);
      n += 1 + (i % 4); seen.textContent = n.toLocaleString('en-IN');
      mttd.textContent = '00:0' + (3 + (i % 5));
    }
    if (ctx.reduce) { for (var k = 0; k < 6; k++) push(); return {}; }
    return {
      start: function () { if (tick) return; if (!feed.children.length) for (var k = 0; k < 3; k++) push(); tick = setInterval(push, 1600); },
      stop: function () { clearInterval(tick); tick = null; }
    };
  });


  /* ==========================================================================
     7 · TYPOSQUAT GENERATOR
     Argument: your brand is attackable in ways you have not registered.
     ========================================================================== */
  define('typosquat', {
    title: 'Typosquat generator',
    mechanic: 'Type your domain. These are the look-alikes an attacker registers first, and what each technique is called.',
    tag: 'Qualifies', foot: 'Generated locally; nothing is sent anywhere'
  }, function (body, cfg, ctx) {
    var id = ctx.uid('ts');
    var inp = h('input', { type: 'text', class: 'input', id: id, value: cfg.domain || 'yourcompany.com', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
    var list = h('div', { class: 'ts-list' });
    body.appendChild(h('div', { class: 'field' }, [h('label', { for: id }, ['Your domain']), inp])); body.appendChild(list);
    function gen(d) {
      d = (d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!d) return [];
      var dot = d.lastIndexOf('.'), name = dot > 0 ? d.slice(0, dot) : d, tld = dot > 0 ? d.slice(dot) : '.com', out = [], seen = {};
      function add(v, k) { if (v !== d && !seen[v]) { seen[v] = 1; out.push([v, k]); } }
      if (/[lio]/.test(name)) add(name.replace(/l/, '1').replace(/o/, '0').replace(/i/, '1') + tld, 'Character swap');
      if (/[aeo]/.test(name)) add(name.replace(/a/, 'а').replace(/e/, 'е').replace(/o/, 'о') + tld, 'Cyrillic homoglyph');
      if (/m/.test(name)) add(name.replace(/m/, 'rn') + tld, 'Letter pair (rn for m)');
      add(name + (tld === '.com' ? '.co' : '.com'), 'TLD swap');
      add(name.slice(0, Math.max(1, Math.ceil(name.length / 2))) + '-' + name.slice(Math.ceil(name.length / 2)) + tld, 'Hyphen insertion');
      if (name.length > 2) add(name.slice(0, 1) + name.slice(2, 3) + name.slice(1, 2) + name.slice(3) + tld, 'Transposition');
      add(name + name.slice(-1) + tld, 'Doubled letter');
      add(name + tld.replace('.', '-') + '.secure-login.example', 'Subdomain deception');
      return out.slice(0, 7);
    }
    function render() {
      list.innerHTML = '';
      gen(inp.value).forEach(function (v) { list.appendChild(h('div', { class: 'ts-row' }, [h('b', { text: v[0] }), h('span', { text: v[1] })])); });
    }
    inp.addEventListener('input', render); render();
  });


  /* ==========================================================================
     8 · SEVERITY TRIAGE BOARD
     Argument: CVSS is not risk. Sort both ways and watch the order change.
     ========================================================================== */
  define('severity-triage', {
    title: 'Severity triage board',
    mechanic: 'Six findings from one assessment. Sort by CVSS, then by business risk. The order is the argument.',
    tag: 'Teaches', foot: 'Business risk scores are analyst judgement, 0–100'
  }, function (body, cfg, ctx) {
    var F = [
      { t: 'Reflected XSS on /search', cvss: 6.1, risk: 22, sev: 'm' },
      { t: 'Default credentials on jump host', cvss: 9.8, risk: 97, sev: 'c' },
      { t: 'TLS 1.0 enabled on legacy MX', cvss: 7.5, risk: 14, sev: 'h' },
      { t: 'IDOR exposing payroll records', cvss: 6.5, risk: 91, sev: 'm' },
      { t: 'Verbose stack traces in production', cvss: 5.3, risk: 38, sev: 'm' },
      { t: 'Unauthenticated Redis on 6379', cvss: 9.1, risk: 88, sev: 'c' }
    ];
    var bc = h('button', { class: 'btn btn--ghost btn--small', type: 'button', text: 'Sort by CVSS', 'aria-pressed': 'true' });
    var br = h('button', { class: 'btn btn--ghost btn--small', type: 'button', text: 'Sort by business risk', 'aria-pressed': 'false' });
    var list = h('div', { class: 'tri-list' });
    body.appendChild(h('div', { class: 'chips' }, [bc, br])); body.appendChild(list);
    var rows = F.map(function (f) {
      return h('div', { class: 'tri' }, [h('span', { class: 'sev sev--' + f.sev }), h('span', { text: f.t }), h('span', { class: 'cv' })]);
    });
    function render(mode) {
      var before = rows.map(function (r) { return r.getBoundingClientRect().top; });
      var order = F.map(function (f, i) { return i; }).sort(function (a, b) { return mode === 'cvss' ? F[b].cvss - F[a].cvss : F[b].risk - F[a].risk; });
      order.forEach(function (i) {
        var r = rows[i], f = F[i];
        r.children[0].textContent = mode === 'cvss' ? f.cvss.toFixed(1) : f.risk;
        r.children[2].textContent = mode === 'cvss' ? 'risk ' + f.risk : 'cvss ' + f.cvss.toFixed(1);
        list.appendChild(r);
      });
      if (!ctx.reduce && before[0]) rows.forEach(function (r, i) {
        var dy = before[i] - r.getBoundingClientRect().top; if (!dy) return;
        r.style.transition = 'none'; r.style.transform = 'translateY(' + dy + 'px)';
        requestAnimationFrame(function () { r.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1)'; r.style.transform = ''; });
      });
      bc.setAttribute('aria-pressed', String(mode === 'cvss')); br.setAttribute('aria-pressed', String(mode !== 'cvss'));
    }
    bc.addEventListener('click', function () { render('cvss'); }); br.addEventListener('click', function () { render('risk'); });
    render('cvss');
  });


  /* ==========================================================================
     9 · BLAST RADIUS
     Argument: one misconfiguration is the difference between three assets and all of them.
     ========================================================================== */
  define('blast-radius', {
    title: 'Blast radius',
    mechanic: 'Thirty-six assets. Toggle one path — a backup service account with Domain Admin rights — and watch what a single compromised workstation can reach.',
    tag: 'Proves', foot: 'Crown jewels outlined in amber'
  }, function (body, cfg, ctx) {
    var TOTAL = 36, CROWN = [7, 19, 31], on = false, dots = [], timers = [];
    var btn = h('button', { class: 'btn btn--ghost btn--small', type: 'button', 'aria-pressed': 'false', text: 'svc_backup → Domain Admin: OFF' });
    var grid = h('div', { class: 'dots', role: 'img', 'aria-label': 'Grid of thirty-six assets' }), out = h('div', { class: 'artifact__out', html: 'Reachable: <b>3</b> of 36 assets · 0 crown jewels' });
    for (var i = 0; i < TOTAL; i++) { var d = h('div', { class: 'dot' + (CROWN.indexOf(i) > -1 ? ' is-crown' : '') + (i < 3 ? ' is-hit' : '') }); grid.appendChild(d); dots.push(d); }
    body.appendChild(btn); body.appendChild(grid); body.appendChild(out);
    btn.addEventListener('click', function () {
      on = !on; btn.setAttribute('aria-pressed', String(on)); btn.textContent = 'svc_backup → Domain Admin: ' + (on ? 'ON' : 'OFF');
      timers.forEach(clearTimeout); timers = [];
      dots.forEach(function (d, i) {
        if (i < 3) return;
        var delay = ctx.reduce ? 0 : (on ? i * 26 : (TOTAL - i) * 16);
        timers.push(setTimeout(function () { d.classList.toggle('is-hit', on); }, delay));
      });
      timers.push(setTimeout(function () {
        out.innerHTML = on ? 'Reachable: <b class="crit">36</b> of 36 assets · <b class="crit">3</b> crown jewels · one misconfiguration' : 'Reachable: <b>3</b> of 36 assets · 0 crown jewels';
      }, ctx.reduce ? 0 : (on ? 900 : 300)));
    });
  });


  /* ==========================================================================
     10 · KILL CHAIN INTERCEPTION
     Argument: you do not need to stop every stage, only one before impact.
     ========================================================================== */
  define('kill-chain', {
    title: 'Kill chain interception',
    mechanic: 'A scripted intrusion runs the seven stages. Detection at persistence breaks the chain three stages before impact.',
    tag: 'Teaches', foot: 'Timings are compressed'
  }, function (body, cfg, ctx) {
    var STEPS = [['Recon', 'Public assets enumerated'], ['Weaponise', 'Payload built for the finance team’s stack'], ['Deliver', 'Invoice attachment opens in finance'],
      ['Exploit', 'Macro executes. Foothold established.'], ['Install', 'Persistence written to the registry'], ['Command', 'Beacon reaches out to the operator'], ['Act', 'Exfiltration begins']];
    var wrap = h('div', { class: 'kc' }), status = h('div', { class: 'kc__status', role: 'status', text: 'Standing by.' });
    var btn = h('button', { class: 'btn btn--ghost btn--small', type: 'button', text: 'Run the attack', style: 'margin-top:14px' });
    var els = STEPS.map(function (s, i) { var d = h('div', { class: 'kc__step' }, [h('div', { class: 'n', text: '0' + (i + 1) }), h('div', { class: 't', text: s[0] })]); wrap.appendChild(d); return d; });
    body.appendChild(wrap); body.appendChild(status); body.appendChild(btn);
    var timer = null, ran = false;
    function reset() { clearTimeout(timer); timer = null; els.forEach(function (e) { e.className = 'kc__step'; }); status.textContent = 'Standing by.'; status.style.color = ''; }
    function finish() {
      els.forEach(function (e, k) { e.className = 'kc__step' + (k < 4 ? ' is-done' : k === 4 ? ' is-blocked' : ''); });
      status.innerHTML = '<strong style="color:var(--brand-violet-bright)">Persistence blocked at 00:04:11.</strong> The beacon never dialled home. Chain broken three stages before impact.';
      status.style.color = ''; timer = null;
    }
    function play(i) {
      if (i > 0) els[i - 1].className = 'kc__step is-done';
      if (i === 4) { finish(); return; }
      els[i].className = 'kc__step is-active'; status.textContent = STEPS[i][1]; status.style.color = 'var(--sev-crit)';
      timer = setTimeout(function () { play(i + 1); }, 1250);
    }
    btn.addEventListener('click', function () { reset(); ctx.reduce ? finish() : play(0); });
    if (ctx.reduce) { finish(); return {}; }
    return {
      start: function () { if (!ran) { ran = true; play(0); } },
      stop: function () { if (timer) { clearTimeout(timer); timer = null; finish(); } }
    };
  });


  /* ==========================================================================
     11 · PURDUE MODEL LAYERS
     Argument: OT is defended by levels and conduits; you cannot protect what you have not discovered.
     ========================================================================== */
  define('purdue-layers', {
    title: 'Purdue model',
    mechanic: 'Select a level. See what typically lives there, which protocols AphelioNYX fingerprints passively, and which neighbours it should be allowed to talk to.',
    tag: 'Teaches', foot: 'Protocol placement is typical, not universal'
  }, function (body, cfg, ctx) {
    var LV = [
      { n: 'L5', t: 'Enterprise network', d: 'ERP, email, internet-facing services. Corporate IT, corporate rules.', p: [], talk: 'L4 only, through the industrial DMZ.' },
      { n: 'L4', t: 'Site business planning', d: 'Scheduling, inventory, reporting for the plant. The last IT-managed level.', p: [], talk: 'L5 and the DMZ. Never directly to control.' },
      { n: 'L3.5', t: 'Industrial DMZ', d: 'Jump hosts, patch servers, historian replicas. The only place IT and OT are meant to meet.', p: ['OPC-UA'], talk: 'Brokers between L4 and L3; nothing passes straight through.', dmz: true },
      { n: 'L3', t: 'Site operations', d: 'Historians, engineering workstations, the OT domain controller. Where identity meets the plant.', p: ['OPC-UA', 'IEC 60870-5-104'], talk: 'L2 below, the DMZ above.' },
      { n: 'L2', t: 'Area supervisory', d: 'HMIs and SCADA servers. Operators see the process here.', p: ['OPC-UA', 'DNP3', 'BACnet', 'IEC 60870-5-104'], talk: 'L1 and L3 only.' },
      { n: 'L1', t: 'Basic control', d: 'PLCs, RTUs, safety controllers. Logic that moves physical things.', p: ['Modbus', 'S7', 'EtherNet/IP', 'DNP3'], talk: 'L0 and L2 only.' },
      { n: 'L0', t: 'Process', d: 'Sensors, actuators, drives. The physics.', p: ['Modbus', 'EtherNet/IP'], talk: 'L1 only.' }
    ];
    var levels = h('div', { class: 'purdue__levels', role: 'tablist', 'aria-label': 'Purdue levels' });
    var dTitle = h('h4'), dText = h('p'), dTalk = h('p'), dChips = h('div', { class: 'chips' }), dNone = h('p', { class: 'tiny', text: 'No OT protocols expected at this level — IT tooling applies.' });
    var detail = h('div', { class: 'purdue__detail', role: 'tabpanel' }, [dTitle, dText, h('div', { class: 'tiny', text: 'Passively fingerprinted here' }), dChips, dNone, h('div', { class: 'tiny', text: 'Should talk to' }), dTalk]);
    var btns = LV.map(function (l, i) {
      var b = h('button', { class: 'purdue__lvl' + (l.dmz ? ' is-dmz' : ''), type: 'button', role: 'tab', 'aria-selected': 'false' }, [h('span', { class: 'n', text: l.n }), h('span', { class: 't', text: l.t })]);
      b.addEventListener('click', function () { select(i); });
      levels.appendChild(b); return b;
    });
    levels.addEventListener('keydown', function (e) {
      var i = btns.indexOf(document.activeElement); if (i < 0) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var j = (i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length; btns[j].focus(); select(j); }
    });
    body.appendChild(h('div', { class: 'purdue' }, [levels, detail]));
    function select(i) {
      btns.forEach(function (b, k) { b.classList.toggle('is-on', k === i); b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      var l = LV[i]; dTitle.textContent = l.n + ' · ' + l.t; dText.textContent = l.d; dTalk.textContent = l.talk;
      dChips.innerHTML = ''; l.p.forEach(function (p) { dChips.appendChild(h('span', { text: p })); });
      dNone.hidden = l.p.length > 0; dChips.hidden = !l.p.length;
    }
    select(5);
  });


  /* ==========================================================================
     12 · READINESS SELF-ASSESSMENT
     Argument: ten honest answers say more than a brochure; the gaps are the conversation.
     ========================================================================== */
  define('readiness', {
    title: 'Readiness self-assessment',
    mechanic: 'Ten questions, answered honestly, give an indicative posture and a list of gaps mapped to the control families an auditor will ask about.',
    tag: 'Qualifies', foot: 'Indicative only — a real assessment reviews evidence',
    defaults: { cta: '/contact/', ctaText: 'Get the free readiness assessment' }
  }, function (body, cfg, ctx) {
    var Q = [
      ['Is there a written, approved information security policy reviewed in the last twelve months?', 'Governance'],
      ['Do you keep a maintained inventory of information assets, each with an owner?', 'Asset management'],
      ['Are access rights reviewed at least quarterly, with leavers removed within a day?', 'Access control'],
      ['Is multi-factor authentication enforced for every remote and administrative login?', 'Identity'],
      ['Are security logs collected centrally and actually reviewed?', 'Logging & monitoring'],
      ['Is there a tested incident response plan with named roles and a call tree?', 'Incident management'],
      ['Are backups restored on a schedule to prove they work?', 'Business continuity'],
      ['Are critical vendors assessed for security before they are onboarded?', 'Supplier risk'],
      ['Has every member of staff completed security awareness training this year?', 'People security'],
      ['Do you know which personal data you hold, and the purpose for each, as the DPDP Act requires?', 'Privacy / DPDP']
    ];
    var ans = Q.map(function () { return null; });
    var score = h('div', { class: 'bigno' }), band = h('div', { class: 'tiny' }), gaps = h('ul', { class: 'ready__gaps' });
    var cta = h('a', { class: 'btn btn--primary btn--small', href: cfg.cta, text: cfg.ctaText, style: 'margin-top:10px', hidden: true });
    var list = h('div');
    Q.forEach(function (q, i) {
      var opts = h('div', { class: 'ready__opts', role: 'radiogroup', 'aria-label': q[0] });
      [['Yes', 2], ['Partly', 1], ['No', 0]].forEach(function (o) {
        var b = h('button', { class: 'btn btn--ghost', type: 'button', role: 'radio', 'aria-checked': 'false', text: o[0] });
        b.addEventListener('click', function () {
          ans[i] = o[1];
          Array.prototype.forEach.call(opts.children, function (c) { c.setAttribute('aria-checked', 'false'); c.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-checked', 'true'); b.setAttribute('aria-pressed', 'true'); calc();
        });
        opts.appendChild(b);
      });
      list.appendChild(h('div', { class: 'ready__q' }, [h('p', { text: (i + 1) + '. ' + q[0] }), opts]));
    });
    body.appendChild(list);
    body.appendChild(h('div', { class: 'ready__out' }, [h('div', {}, [score, band]), h('div', {}, [h('div', { class: 'tiny', text: 'Gaps an auditor will ask about', style: 'margin-bottom:8px' }), gaps, cta])]));
    function calc() {
      var answered = ans.filter(function (a) { return a !== null; }).length;
      if (!answered) { score.textContent = '—'; band.textContent = 'Answer to see an indicative posture'; gaps.innerHTML = ''; return; }
      var total = ans.reduce(function (s, a) { return s + (a || 0); }, 0), pct = Math.round(total / (Q.length * 2) * 100);
      score.textContent = pct + '%'; score.className = 'bigno ' + (pct >= 70 ? 'bigno--ok' : pct >= 40 ? '' : 'bigno--crit');
      band.textContent = answered < Q.length ? answered + ' of ' + Q.length + ' answered' : pct >= 70 ? 'Audit-ready posture — now prove it with evidence' : pct >= 40 ? 'Forming — the gaps below are the plan' : 'Early — start with the first three gaps';
      gaps.innerHTML = '';
      Q.forEach(function (q, i) { if (ans[i] !== null && ans[i] < 2) gaps.appendChild(h('li', { text: q[1] + (ans[i] === 1 ? ' — partial' : '') })); });
      if (!gaps.children.length && answered === Q.length) gaps.appendChild(h('li', { text: 'No gaps declared. Evidence review is the next step.' }));
      cta.hidden = answered < Q.length;
    }
    calc();
  });


  /* ==========================================================================
     13 · CONTROL EXPLORER
     Argument: a standard is not a wall of clauses; each control is a question with an answer you can produce.
     ========================================================================== */
  define('control-explorer', {
    title: 'Control explorer',
    mechanic: 'Pick a framework and search. Each control comes with the plain-English question it asks and the evidence that answers it.',
    tag: 'Teaches', foot: 'Titles follow the public structure of each framework; explanations are ours',
    defaults: { framework: 'ISO 27001:2022' }
  }, function (body, cfg, ctx) {
    var DATA = {
      'ISO 27001:2022': [
        ['A.5.1', 'Policies for information security', 'Is there a policy, approved by management, that people have actually read?', 'Approved policy · communication record · review log'],
        ['A.5.9', 'Inventory of information and other associated assets', 'Do you know what you have and who owns it?', 'Asset register with owners and classification'],
        ['A.5.15', 'Access control', 'Are there rules for who gets access to what, and are they followed?', 'Access policy · role matrix · approval records'],
        ['A.5.19', 'Information security in supplier relationships', 'Do your suppliers meet your standard?', 'Vendor assessments · contract clauses'],
        ['A.5.23', 'Information security for use of cloud services', 'Is cloud adoption governed, not just enabled?', 'Cloud policy · shared-responsibility mapping'],
        ['A.5.24', 'Incident management planning and preparation', 'Do you know what to do when it happens?', 'IR plan · roles · exercise records'],
        ['A.5.30', 'ICT readiness for business continuity', 'Can the technology keep the business alive?', 'BIA · recovery objectives · test evidence'],
        ['A.6.3', 'Information security awareness, education and training', 'Does every person know their part?', 'Training completion · phishing results'],
        ['A.6.8', 'Information security event reporting', 'Would staff know how to report something odd?', 'Reporting channel · sample reports'],
        ['A.7.1', 'Physical security perimeters', 'Is the building defended as carefully as the network?', 'Zone map · access logs'],
        ['A.7.14', 'Secure disposal or re-use of equipment', 'Does data leave with old laptops?', 'Disposal certificates · wipe logs'],
        ['A.8.2', 'Privileged access rights', 'Who is an administrator, and why?', 'Privileged account list · review records'],
        ['A.8.5', 'Secure authentication', 'Is a password alone ever enough?', 'MFA coverage report · auth policy'],
        ['A.8.7', 'Protection against malware', 'Is every endpoint covered, and is coverage checked?', 'EDR coverage · exclusion review'],
        ['A.8.8', 'Management of technical vulnerabilities', 'How long does a critical patch take?', 'Scan results · patch SLAs · exceptions'],
        ['A.8.13', 'Information backup', 'Have you restored from backup lately?', 'Backup policy · restore test records'],
        ['A.8.15', 'Logging', 'Are the right events recorded and protected?', 'Log sources · retention · integrity controls'],
        ['A.8.16', 'Monitoring activities', 'Is anyone watching?', 'Alert rules · triage records · SOC reports'],
        ['A.8.24', 'Use of cryptography', 'Is encryption deliberate — algorithms, keys, lifetimes?', 'Crypto standard · key inventory'],
        ['A.8.28', 'Secure coding', 'Is security built in before the code ships?', 'Secure coding standard · review evidence']
      ],
      'SOC 2': [
        ['CC1', 'Control environment', 'Does leadership set and model the tone?', 'Org chart · code of conduct · board minutes'],
        ['CC2', 'Communication and information', 'Do the right people get the right information?', 'Policy distribution · internal comms records'],
        ['CC3', 'Risk assessment', 'Are risks identified and rated on a schedule?', 'Risk register · assessment cadence'],
        ['CC4', 'Monitoring activities', 'Are controls checked that they still work?', 'Internal audit · control testing results'],
        ['CC5', 'Control activities', 'Are controls designed to address the risks?', 'Control matrix · risk mapping'],
        ['CC6', 'Logical and physical access controls', 'Is access provisioned, reviewed and revoked?', 'Access reviews · onboarding and leaver records'],
        ['CC7', 'System operations', 'Are anomalies detected and incidents handled?', 'Monitoring alerts · incident tickets'],
        ['CC8', 'Change management', 'Are changes authorised, tested and tracked?', 'Change tickets · approvals · deployment logs'],
        ['CC9', 'Risk mitigation', 'Are vendor and business disruption risks managed?', 'Vendor reviews · continuity plans'],
        ['A1', 'Availability', 'Is capacity planned and recovery tested?', 'Capacity reports · DR tests'],
        ['C1', 'Confidentiality', 'Is confidential data identified and protected through its life?', 'Classification · disposal records'],
        ['PI1', 'Processing integrity', 'Is processing complete, accurate and timely?', 'Reconciliations · error handling evidence'],
        ['P1–P8', 'Privacy', 'Are personal data commitments kept?', 'Notice · consent records · retention schedule']
      ],
      'DPDP Act 2023': [
        ['s.5', 'Notice', 'Did you tell the data principal what you collect and why, before or at collection?', 'Notice text · versions · where it is shown'],
        ['s.6', 'Consent', 'Is consent free, specific, informed, unconditional and unambiguous — and withdrawable as easily as given?', 'Consent records · withdrawal flow'],
        ['s.7', 'Certain legitimate uses', 'Where you rely on legitimate use instead of consent, can you show the basis?', 'Basis register per processing activity'],
        ['s.8', 'General obligations of a data fiduciary', 'Is data accurate, protected by reasonable safeguards, breaches notified, and erased when the purpose ends?', 'Security controls · breach procedure · erasure records'],
        ['s.9', 'Processing of children’s data', 'Do you obtain verifiable parental consent and avoid tracking or targeted advertising to children?', 'Age assurance · consent mechanism'],
        ['s.10', 'Significant data fiduciary', 'If notified as significant: is there a Data Protection Officer, an independent auditor and periodic impact assessments?', 'DPO appointment · audit reports · DPIAs'],
        ['s.11', 'Right to access information', 'Can a principal get a summary of their data and who it was shared with?', 'Request handling procedure · response samples'],
        ['s.12', 'Right to correction and erasure', 'Can a principal correct, complete, update or erase their data?', 'Correction and erasure workflow'],
        ['s.13', 'Right of grievance redressal', 'Is there a readily available way to complain, with a response time?', 'Grievance channel · response records'],
        ['s.14', 'Right to nominate', 'Can a principal nominate someone to exercise rights on their behalf?', 'Nomination mechanism']
      ]
    };
    var frameworks = (cfg.frameworks && cfg.frameworks.length) ? cfg.frameworks.filter(function (f) { return DATA[f]; }) : Object.keys(DATA);
    var current = DATA[cfg.framework] ? cfg.framework : frameworks[0];
    var selId = ctx.uid('fw'), qId = ctx.uid('q');
    var sel = h('select', { class: 'input', id: selId, 'aria-label': 'Framework' }, frameworks.map(function (f) { return h('option', { value: f, text: f, selected: f === current }); }));
    var q = h('input', { type: 'search', class: 'input', id: qId, placeholder: 'Search controls', 'aria-label': 'Search controls', autocomplete: 'off' });
    var count = h('span', { class: 'tiny' }), list = h('div', { class: 'ctrl__list' });
    body.appendChild(h('div', { class: 'ctrl__bar' }, [sel, q, count])); body.appendChild(list);
    function render() {
      var term = q.value.trim().toLowerCase(), rows = DATA[sel.value].filter(function (c) { return !term || (c[0] + ' ' + c[1] + ' ' + c[2]).toLowerCase().indexOf(term) > -1; });
      list.innerHTML = '';
      rows.forEach(function (c) {
        list.appendChild(h('div', { class: 'ctrl' }, [h('span', { class: 'id', text: c[0] }), h('div', {}, [h('div', { class: 't', text: c[1] }), h('div', { class: 'd', text: c[2] }), h('div', { class: 'e', text: 'Evidence: ' + c[3] })])]));
      });
      count.textContent = rows.length + ' of ' + DATA[sel.value].length + ' shown';
      if (!rows.length) list.appendChild(h('div', { class: 'ctrl' }, [h('span', { class: 'id', text: '—' }), h('div', { class: 'd', text: 'No control matches that search.' })]));
    }
    sel.addEventListener('change', render); q.addEventListener('input', render); render();
  });


  /* ==========================================================================
     14 · SCAN VS EXPLOIT
     Argument: a scanner lists; a tester proves. The critical is rarely where the scanner said.
     ========================================================================== */
  define('scan-vs-exploit', {
    title: 'Scan vs exploit',
    mechanic: 'The same target, twice. Left: what an automated scanner reports. Right: what a tester confirms, discards, and chains into the finding that matters.',
    tag: 'Proves', foot: 'One scripted engagement'
  }, function (body, cfg, ctx) {
    var F = [
      { t: 'Outdated jQuery 1.12 detected', cvss: '6.1', out: 'fp', note: 'No exploitable sink on any page — false positive' },
      { t: 'Default credentials on jump host', cvss: '9.8', out: 'fp', note: 'A deliberately exposed honeypot — false positive' },
      { t: 'Verbose error page on /api/v2', cvss: '5.3', out: 'chain', note: 'Leaks an internal hostname — first link' },
      { t: 'TLS 1.0 enabled on legacy MX', cvss: '7.5', out: 'ok', note: 'Confirmed; low real exposure, fix in the next window' },
      { t: 'Missing HttpOnly on session cookie', cvss: '4.3', out: 'chain', note: 'With the leak above, session capture becomes practical — second link' },
      { t: 'IDOR on /invoices/{id}', cvss: '6.5', out: 'chain', note: 'Reads any customer invoice — chained: full customer data access' }
    ];
    var left = h('div', { class: 'sve__col' }, [h('h4', { text: 'Automated scan · 6 findings' })]);
    var right = h('div', { class: 'sve__col' }, [h('h4', { text: 'Manual validation' })]);
    var rrows = [];
    F.forEach(function (f) {
      left.appendChild(h('div', { class: 'sve__row' }, [h('span', { class: 'sev sev--' + (parseFloat(f.cvss) >= 9 ? 'c' : parseFloat(f.cvss) >= 7 ? 'h' : 'm'), text: f.cvss }), h('span', { text: f.t })]));
      var r = h('div', { class: 'sve__row' }, [h('span', { class: 'v', text: 'pending' }), h('span', { text: f.t })]); right.appendChild(r); rrows.push(r);
    });
    var lsum = h('div', { class: 'sve__sum', text: '2 critical · 1 high · 3 medium' }), rsum = h('div', { class: 'sve__sum', text: 'Awaiting validation' });
    left.appendChild(lsum); right.appendChild(rsum);
    var btn = h('button', { class: 'btn btn--ghost btn--small', type: 'button', text: 'Run manual validation', style: 'margin-top:14px' });
    body.appendChild(h('div', { class: 'sve' }, [left, right])); body.appendChild(btn);
    var timers = [], ran = false;
    function reveal(i) {
      var f = F[i], r = rrows[i]; r.className = 'sve__row is-' + f.out; r.children[0].textContent = f.out === 'fp' ? 'false +' : f.out === 'chain' ? 'chained' : 'confirmed';
      r.children[1].textContent = f.t + ' — ' + f.note;
    }
    function finish() { rsum.innerHTML = '<span class="crit">2 false positives dropped · 3 low and medium findings chained into 1 critical</span> — the one the scanner scored 6.5.'; }
    function run() {
      timers.forEach(clearTimeout); timers = []; ran = true;
      rrows.forEach(function (r, i) { r.className = 'sve__row'; r.children[0].textContent = 'pending'; r.children[1].textContent = F[i].t; });
      rsum.textContent = 'Validating…';
      if (ctx.reduce) { F.forEach(function (f, i) { reveal(i); }); finish(); return; }
      F.forEach(function (f, i) { timers.push(setTimeout(function () { reveal(i); if (i === F.length - 1) finish(); }, 600 + i * 700)); });
    }
    btn.addEventListener('click', run);
    if (ctx.reduce) { run(); return {}; }
    return { start: function () { if (!ran) run(); }, stop: function () { timers.forEach(clearTimeout); timers = []; if (ran) { F.forEach(function (f, i) { reveal(i); }); finish(); } } };
  });

  /* ==========================================================================
     15 · VENDOR RISK MATRIX
     Argument: a vendor's risk is what it can reach, not what it costs you.
     ========================================================================== */
  define('vendor-risk-matrix', {
    title: 'Vendor risk matrix',
    mechanic: 'Ten typical suppliers, placed by what they can reach and how badly you need them. The square a vendor lands in decides the diligence — not its invoice value.',
    tag: 'Qualifies', foot: 'Tiering thresholds are ours; adapt them to your risk appetite',
    tall: true
  }, function (body, cfg, ctx) {
    // access: 0 none · 1 internal · 2 customer personal data · 3 regulated / privileged
    // crit:   1 low  · 2 moderate · 3 high · 4 critical
    var V = [
      { t: 'Cloud IaaS provider', a: 3, c: 4, n: 'Runs the production estate. Holds everything, including the backups you have not moved elsewhere.' },
      { t: 'Backup and DR provider', a: 3, c: 4, n: 'A copy of the crown jewels, held by someone else, restorable by someone else.' },
      { t: 'Managed email and collaboration', a: 2, c: 4, n: 'Identity, mail, files and chat. The first place an attacker looks once they hold credentials.' },
      { t: 'Payroll processor', a: 3, c: 3, n: 'Salary, bank and identity data for every employee. Regulated, and irreplaceable at month end.' },
      { t: 'Offshore development contractor', a: 3, c: 3, n: 'Source code and, far too often, a copy of production data sitting in a test environment.' },
      { t: 'CRM platform', a: 2, c: 3, n: 'Every customer, every contact detail, every deal — exportable in one click, by design.' },
      { t: 'ITSM and ticketing', a: 1, c: 3, n: 'Internal only, until someone pastes a credential into a ticket. Someone always does.' },
      { t: 'Analytics SDK in the mobile app', a: 3, c: 2, n: 'Device identifiers and behaviour are personal data under the DPDP Act. Almost nobody assesses this one.' },
      { t: 'Marketing automation', a: 2, c: 2, n: 'Prospect and customer contact data, with a wide and rarely reviewed integration surface.' },
      { t: 'Facilities and cleaning contractor', a: 0, c: 1, n: 'No system access — physical access instead, which your questionnaire probably never asks about.' }
    ];
    var ACC = ['No data', 'Internal data', 'Customer personal data', 'Regulated or privileged'];
    var CRT = ['Low', 'Moderate', 'High', 'Critical'];
    var TIERS = [
      { n: 'Tier 1', k: 'crit', r: ['Evidence-backed security questionnaire — never a bare self-attestation', 'Current ISO 27001 or SOC 2 report reviewed, exceptions actually read', 'Data processing agreement with a 72-hour breach notification clause', 'Right to audit, and an exit plan that has been tested', 'A named owner inside your organisation; reviewed quarterly'] },
      { n: 'Tier 2', k: 'high', r: ['Security questionnaire with evidence on the top ten controls', 'Data processing agreement with breach notification', 'Certification re-checked at every renewal', 'A named owner inside your organisation; reviewed annually'] },
      { n: 'Tier 3', k: 'med', r: ['Short screening questionnaire before signature', 'Standard contractual security terms', 'Recorded in the vendor register with an owner'] },
      { n: 'Tier 4', k: 'low', r: ['Recorded in the vendor register', 'Physical and personnel controls where there is site access', 'Reassessed if the scope of the engagement changes'] }
    ];
    function tierOf(a, c) { var s = c * (a + 1); return s >= 12 ? 0 : s >= 6 ? 1 : s >= 3 ? 2 : 3; }

    var cells = {}, grid = h('div', { class: 'vrm__grid', role: 'img', 'aria-label': 'Four by four matrix of data access against business criticality' });
    grid.appendChild(h('div', { class: 'vrm__corner', html: 'Criticality&nbsp;&uarr;<br>Access&nbsp;&rarr;' }));
    ACC.forEach(function (a) { grid.appendChild(h('div', { class: 'vrm__axis vrm__axis--x', text: a })); });
    for (var r = 3; r >= 0; r--) {
      grid.appendChild(h('div', { class: 'vrm__axis vrm__axis--y', text: CRT[r] }));
      for (var a2 = 0; a2 < 4; a2++) {
        var key = a2 + ':' + (r + 1);
        var here = V.filter(function (v) { return v.a === a2 && v.c === r + 1; });
        var cell = h('div', { class: 'vrm__cell is-' + TIERS[tierOf(a2, r + 1)].k, 'data-k': key },
          here.map(function () { return h('i'); }));
        grid.appendChild(cell); cells[key] = cell;
      }
    }
    var chips = h('div', { class: 'vrm__chips' });
    var dTier = h('div', { class: 'bigno', style: 'font-size:1.6rem' }), dWhy = h('div', { class: 'tiny' });
    var dName = h('h4', { style: 'margin-top:14px' }), dNote = h('p'), dReq = h('ul', { class: 'ready__gaps' });
    var detail = h('div', { class: 'vrm__detail' }, [
      dTier, dWhy, dName, dNote,
      h('div', { class: 'tiny', text: 'What this tier requires', style: 'margin-top:14px' }), dReq
    ]);
    var btns = V.map(function (v, i) {
      var b = h('button', { class: 'btn btn--ghost btn--small', type: 'button', 'aria-pressed': 'false', text: v.t });
      b.addEventListener('click', function () { select(i); });
      chips.appendChild(b); return b;
    });
    body.appendChild(h('div', { class: 'vrm' }, [grid, detail]));
    body.appendChild(h('div', { class: 'tiny', text: 'Select a supplier', style: 'margin:20px 0 8px' }));
    body.appendChild(chips);

    function select(i) {
      var v = V[i], t = TIERS[tierOf(v.a, v.c)];
      btns.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); b.classList.toggle('is-on', k === i); });
      Object.keys(cells).forEach(function (k) { cells[k].classList.remove('is-sel'); });
      cells[v.a + ':' + v.c].classList.add('is-sel');
      dTier.textContent = t.n;
      dTier.className = 'bigno' + (t.k === 'crit' ? ' bigno--crit' : t.k === 'low' ? ' bigno--ok' : '');
      dWhy.textContent = CRT[v.c - 1].toLowerCase() + ' criticality · ' + ACC[v.a].toLowerCase();
      dName.textContent = v.t; dNote.textContent = v.n;
      dReq.innerHTML = ''; t.r.forEach(function (x) { dReq.appendChild(h('li', { text: x })); });
    }
    select(0);
  });


  /* ==========================================================================
     16 · DPDP PENALTY EXPLORER
     Argument: the Act does not levy one fine. It prices specific failures, separately.
     ========================================================================== */
  define('dpdp-penalty', {
    title: 'DPDP penalty explorer',
    mechanic: 'The Schedule to the Digital Personal Data Protection Act, 2023 sets a separate maximum for each duty. Select the ones you could not evidence today.',
    tag: 'Qualifies',
    note: '<b>Statutory maxima</b> from the Schedule to the DPDP Act, 2023 · not legal advice',
    foot: 'The Board fixes the actual amount under section 33(2)'
  }, function (body, cfg, ctx) {
    var P = [
      { s: 'Section 8(5)', cr: 250, t: 'Reasonable security safeguards', d: 'Failure to take reasonable security safeguards to prevent a personal data breach. The largest single number in the Act — and the one an unpatched estate walks straight into.' },
      { s: 'Section 8(6)', cr: 200, t: 'Breach notification', d: 'Failure to notify the Data Protection Board and every affected Data Principal of a personal data breach. Assessed separately from the breach itself.' },
      { s: 'Section 9', cr: 200, t: 'Children’s data', d: 'Failure to obtain verifiable parental consent, or tracking, behavioural monitoring or targeted advertising directed at children.' },
      { s: 'Section 10', cr: 150, t: 'Significant Data Fiduciary duties', d: 'Once notified as significant: no Data Protection Officer based in India, no independent data auditor, no periodic impact assessment or audit.' },
      { s: 'Other provisions', cr: 50, t: 'Any other duty under the Act or its rules', d: 'The catch-all: notice, consent, purpose limitation, erasure, grievance redressal, processor contracts — anything not priced separately above.' },
      { s: 'Section 15', cr: 0, t: 'Data Principal duties', d: 'Up to ₹10,000, and it falls on the individual rather than on you — for false or frivolous complaints and for impersonation. Included because clients always ask.' }
    ];
    var F = ['The nature, gravity and duration of the breach', 'The type and nature of the personal data affected', 'Whether the same breach has happened before', 'Any gain made, or loss avoided, as a result', 'Whether you acted to mitigate — and how quickly, and how effectively', 'Whether the penalty is proportionate and effective', 'The likely impact of the penalty on the person concerned'];
    var on = {}, total = h('div', { class: 'bigno bigno--crit' }), count = h('div', { class: 'tiny' });
    var list = h('div', { class: 'pen__list' });
    P.forEach(function (p, i) {
      var money = p.cr ? '₹' + p.cr + ' cr' : '₹10,000';
      var b = h('button', {
        class: 'pen', type: 'button', 'aria-pressed': 'false',
        'aria-label': p.t + ', ' + p.s + ', maximum ' + (p.cr ? p.cr + ' crore rupees' : '10,000 rupees')
      }, [
        h('span', { class: 'pen__s', text: p.s }),
        h('span', { class: 'pen__c' }, [h('span', { class: 'pen__t', text: p.t }), h('span', { class: 'pen__d', text: p.d })]),
        h('span', { class: 'pen__v', text: money })
      ]);
      b.addEventListener('click', function () {
        on[i] = !on[i]; b.setAttribute('aria-pressed', String(!!on[i])); b.classList.toggle('is-on', !!on[i]); calc();
      });
      list.appendChild(b);
    });
    body.appendChild(list);
    body.appendChild(h('div', { class: 'stat-row', style: 'margin-top:20px' }, [
      h('div', {}, [total, h('div', { class: 'tiny', text: 'Combined statutory maximum' })]),
      h('div', { style: 'flex:1;min-width:200px' }, [count])
    ]));
    body.appendChild(h('details', { class: 'calc__how', style: 'margin-top:20px' }, [
      h('summary', { text: 'How the Board decides the actual amount' }),
      h('div', {}, [
        h('p', { text: 'Section 33(2) requires the Data Protection Board to weigh each of the following before fixing a penalty. A maximum is a ceiling, not a tariff — and the fifth factor is the only one you can still influence after a breach has already happened.' }),
        h('ul', { class: 'ready__gaps', style: 'margin-top:12px' }, F.map(function (f) { return h('li', { text: f }); }))
      ])
    ]));
    function calc() {
      var keys = Object.keys(on).filter(function (k) { return on[k]; });
      var sum = keys.reduce(function (s, k) { return s + P[k].cr; }, 0);
      var indiv = keys.some(function (k) { return !P[k].cr; });
      if (!keys.length) { total.textContent = '₹0'; count.textContent = 'Select the duties you could not evidence today.'; return; }
      total.textContent = '₹' + sum + ' cr';
      count.textContent = keys.length + ' of ' + P.length + ' contraventions selected · each is assessed separately' +
        (indiv ? ' · the section 15 maximum falls on the individual, so it is not added here' : '');
    }
    calc();
  });


  /* ==========================================================================
     17 · INCIDENT TRIAGE INTAKE
     Argument: an active incident and a planned engagement are not the same conversation.
     ========================================================================== */
  define('incident-triage-intake', {
    title: 'Are you in an active incident?',
    mechanic: 'One question decides which conversation this is. If something is happening right now, the page stops selling and starts helping.',
    tag: 'Routes',
    note: '<b>Nothing is sent from this page</b> · your answers only compose a message in your own mail client',
    foot: 'Hotline +91 70160 88075',
    defaults: { email: 'secure@aphelioncyber.com', phone: '+917016088075', phoneText: '+91 70160 88075', calendar: 'https://calendar.app.google/K9AS429zPHXiAhWg9' }
  }, function (body, cfg, ctx) {
    var FIRST = [
      'Do not power the machine off. Memory is evidence, and it is gone the moment you do.',
      'Isolate rather than wipe. Pull the network cable or suspend the VM, and keep the disk.',
      'Preserve logs now — endpoint, firewall, identity provider, mail. Retention windows are short, and they are already running.',
      'If money is moving, call the bank before you call anyone else.',
      'Write down when you first noticed and who has been told. That timeline is the first thing any regulator asks for.'
    ];
    var NEED = ['A security incident I need help with', 'Penetration testing or VAPT', 'ISO 27001, SOC 2 or DPDP readiness', 'Managed SOC or MDR', 'The AphelioNYX platform', 'Cybersecurity staff augmentation', 'Something else'];
    var yes = h('button', { class: 'btn btn--primary', type: 'button', text: 'Yes — it is happening now' });
    var no = h('button', { class: 'btn btn--ghost', type: 'button', text: 'No — I am planning ahead' });
    var ask = h('div', { class: 'tri-ask' }, [
      h('p', { class: 'tri-ask__q', text: 'Is something happening right now — an intrusion, ransomware, a live data leak, or an account you no longer control?' }),
      h('div', { class: 'tri-ask__btns' }, [yes, no])
    ]);
    var panel = h('div', { class: 'tri-panel', 'aria-live': 'polite' });
    body.appendChild(h('div', { class: 'tri-intake' }, [ask, panel]));

    function field(label, el) { return h('div', { class: 'field' }, [h('label', { for: el.id, text: label }), el]); }
    function mailto(subject, lines) {
      return 'mailto:' + cfg.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    }

    function emergency() {
      body.parentNode.classList.add('is-alarm');
      var org = h('input', { class: 'input', id: ctx.uid('o'), placeholder: 'Organisation' });
      var num = h('input', { class: 'input', id: ctx.uid('n'), type: 'tel', placeholder: 'A number we can call you back on' });
      var what = h('textarea', { class: 'input', id: ctx.uid('w'), rows: '3', placeholder: 'What are you seeing? One line is enough.' });
      var send = h('a', { class: 'btn btn--primary', href: '#', text: 'Open a pre-filled email' });
      function refresh() {
        send.href = mailto('[ACTIVE INCIDENT] ' + (org.value || 'Incoming'), [
          'Organisation: ' + org.value, 'Callback number: ' + num.value,
          'What we are seeing: ' + what.value, '', 'Sent from the Aphelion Cyber incident intake.'
        ]);
      }
      [org, num, what].forEach(function (i) { i.addEventListener('input', refresh); }); refresh();
      var tel = h('a', { class: 'tri-emg__tel', href: 'tel:' + cfg.phone, text: cfg.phoneText });
      panel.innerHTML = '';
      panel.appendChild(h('div', { class: 'tri-emg' }, [
        h('p', { class: 'tri-emg__lead', text: 'Call us. Do not wait for an email to be read.' }),
        tel,
        h('p', { class: 'small', text: 'Ahmedabad and Sharjah. If nobody answers within two rings, call again — we would much rather take the duplicate.' }),
        h('div', { class: 'tiny', text: 'While you wait — the first ten minutes', style: 'margin-top:22px' }),
        h('ol', { class: 'tri-first' }, FIRST.map(function (f, i) { return h('li', {}, [h('b', { text: '0' + (i + 1) }), h('span', { text: f })]); })),
        h('div', { class: 'tri-form' }, [field('Organisation', org), field('Callback number', num), field('What are you seeing', what), send])
      ]));
      tel.focus();
    }

    function scheduling() {
      body.parentNode.classList.remove('is-alarm');
      var nm = h('input', { class: 'input', id: ctx.uid('nm'), placeholder: 'Your name' });
      var org = h('input', { class: 'input', id: ctx.uid('og'), placeholder: 'Organisation' });
      var em = h('input', { class: 'input', id: ctx.uid('em'), type: 'email', placeholder: 'Work email' });
      var nd = h('select', { class: 'input', id: ctx.uid('nd') }, NEED.map(function (n) { return h('option', { value: n, text: n }); }));
      var msg = h('textarea', { class: 'input', id: ctx.uid('ms'), rows: '3', placeholder: 'Anything you would like us to read first' });
      var send = h('a', { class: 'btn btn--primary', href: '#', text: 'Open a pre-filled email' });
      function refresh() {
        send.href = mailto('Consultation request — ' + nd.value, [
          'Name: ' + nm.value, 'Organisation: ' + org.value, 'Email: ' + em.value,
          'Interested in: ' + nd.value, '', msg.value, '', 'Sent from the Aphelion Cyber contact page.'
        ]);
      }
      [nm, org, em, msg].forEach(function (i) { i.addEventListener('input', refresh); });
      nd.addEventListener('change', refresh); refresh();
      panel.innerHTML = '';
      panel.appendChild(h('div', { class: 'tri-sched' }, [
        h('p', { class: 'small', text: 'Forty-five minutes, your environment rather than a slide deck, and a free readiness assessment against the frameworks you are actually being asked for. We reply within one business day.' }),
        h('div', { class: 'tri-form' }, [
          field('Name', nm), field('Organisation', org), field('Work email', em),
          field('What do you need', nd), field('Message', msg),
          h('div', { class: 'tri-acts' }, [send,
            h('a', { class: 'btn btn--ghost', href: cfg.calendar, target: '_blank', rel: 'noopener', text: 'Or pick a time ↗' })])
        ]),
        h('p', { class: 'tiny', style: 'margin-top:16px', text: 'Prefer to write it yourself: ' + cfg.email + ' · ' + cfg.phoneText })
      ]));
    }

    yes.addEventListener('click', function () { yes.classList.add('is-on'); no.classList.remove('is-on'); emergency(); });
    no.addEventListener('click', function () { no.classList.add('is-on'); yes.classList.remove('is-on'); scheduling(); });
    scheduling();
  });


  /* ==========================================================================
     18 · ORBITAL TIMELINE
     Argument: aphelion is the far point of an orbit — the distance is the vantage.
     ========================================================================== */
  define('orbital-timeline', {
    title: 'The orbit so far',
    mechanic: 'Aphelion is the point in an orbit farthest from the sun. Select a station to see what the company has actually done — and nothing it has not.',
    tag: 'Teaches',
    note: '<b>Company facts only</b> · the orbit is a diagram, not a dated history',
    foot: 'Founded 2024 · Ahmedabad and Sharjah'
  }, function (body, cfg, ctx) {
    var S = [
      { k: '2024', t: 'Incorporated', d: 'AphelionCyber Private Limited is founded in Ahmedabad, to help organisations build a proactive and resilient security posture rather than a reactive one.' },
      { k: 'Ahmedabad', t: 'The practice', d: 'Consulting from 203 Shanti Mall, Sattadhar Cross Road: risk management and governance, security architecture, identity and access management, cloud and network security, and incident response.' },
      { k: 'Sharjah', t: 'The second office', d: 'A presence at Sharjah Media City, Al Messaned, Al Bataeh — the same practice, inside the UAE, for clients who need the work delivered locally.' },
      { k: 'AphelioNYX', t: 'The platform', d: 'One sign-on across three modules: Compliance Hub, MDR, and AD Pen-Test — the last of which is air-gapped by design, for environments where outbound traffic is simply not permitted.' },
      { k: '100+', t: 'Organizations secured', d: 'Across the globe, in finance and banking, healthcare, retail and e-commerce, technology, SaaS, hospitality, manufacturing and pharmaceuticals.' },
      { k: 'Aphelion', t: 'The far point', d: 'The name is the argument. From the farthest point of an orbit you can see the whole system at once — which is the only vantage from which a security posture makes any sense.' }
    ];
    var NS = 'http://www.w3.org/2000/svg', W = 580, H = 268, OX = 296, OY = 134, RX = 236, RY = 106;
    function mk(n, at) { var e = document.createElementNS(NS, n); Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); }); return e; }
    var svg = mk('svg', { class: 'orb', viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'Orbit diagram with six stations' });
    svg.appendChild(mk('ellipse', { cx: OX, cy: OY, rx: RX, ry: RY, class: 'orb__path' }));
    var sx = OX + RX - 42;
    svg.appendChild(mk('circle', { cx: sx, cy: OY, r: 22, class: 'orb__corona' }));
    svg.appendChild(mk('circle', { cx: sx, cy: OY, r: 8, class: 'orb__sun' }));
    var marker = mk('circle', { cx: OX - RX, cy: OY, r: 3.5, class: 'orb__marker' });
    svg.appendChild(marker);
    // stations run from near the sun round to aphelion, the far point at angle π
    var ang = S.map(function (s, i) { return Math.PI * (0.30 + 0.70 * (i / (S.length - 1))); });
    var nodes = S.map(function (s, i) {
      var x = OX + RX * Math.cos(ang[i]), y = OY + RY * Math.sin(ang[i]);
      var g = mk('g', { class: 'orb__st', tabindex: '0', role: 'button', 'aria-label': s.k + ' — ' + s.t, transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')' });
      g.appendChild(mk('circle', { r: 15, class: 'orb__hit' }));
      g.appendChild(mk('circle', { r: 5, class: 'orb__dot' }));
      var lab = mk('text', { y: y < OY ? -16 : 25, 'text-anchor': 'middle', class: 'orb__lab' });
      lab.textContent = s.k; g.appendChild(lab);
      g.addEventListener('click', function () { select(i); });
      ctx.key(g, function () { select(i); });
      svg.appendChild(g); return g;
    });
    svg.addEventListener('keydown', function (e) {
      var i = nodes.indexOf(document.activeElement); if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var j = (i + (e.key === 'ArrowRight' ? 1 : -1) + S.length) % S.length;
        nodes[j].focus(); select(j);
      }
    });
    var dK = h('span', { class: 'orb__k' }), dT = h('h4'), dD = h('p');
    body.appendChild(h('div', { class: 'orb__wrap' }, svg));
    body.appendChild(h('div', { class: 'orb__detail' }, [dK, dT, dD]));

    function select(i) {
      nodes.forEach(function (n, k) { n.classList.toggle('is-on', k === i); });
      dK.textContent = S[i].k; dT.textContent = S[i].t; dD.textContent = S[i].d;
    }
    function place(t) {
      marker.setAttribute('cx', (OX + RX * Math.cos(t)).toFixed(1));
      marker.setAttribute('cy', (OY + RY * Math.sin(t)).toFixed(1));
    }
    select(S.length - 1); place(ang[S.length - 1]);
    if (ctx.reduce) return {};
    var raf = 0, t0 = 0;
    function loop(ts) {
      if (!t0) t0 = ts;
      // slow at the far point, quick past the sun — Kepler's second law, roughly
      var u = ((ts - t0) / 28000) % 1, th = Math.PI * 2 * u;
      place(th + Math.sin(th) * 0.5);
      raf = requestAnimationFrame(loop);
    }
    return {
      start: function () { if (!raf) { t0 = 0; raf = requestAnimationFrame(loop); } },
      stop: function () { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    };
  });

  return { define: define, init: init, mount: mount, registry: R, h: h };
})();
