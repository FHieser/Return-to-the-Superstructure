// shared/js/core.js
// Helpers used by every page: data loading, header, small renderers, the lore index and the catalog.
// Depends on: jsyaml (CDN), marked (CDN).

// Site root, derived from this script's own URL (works locally and on GitHub Pages sub-paths)
const ROOT = new URL('../../', document.currentScript.src).href;

// ── Data loading ────────────────────────────────────────────────────────────

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });   // always ask the server, so edited data shows on reload
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  return res.text();
}

async function fetchYaml(url) {
  return jsyaml.load(await fetchText(url)) ?? null;
}

// ── Small renderers ─────────────────────────────────────────────────────────

const has = v => Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '';

function md(text) {
  return has(text) ? marked.parse(String(text)) : '';
}

function mdInline(text) {
  return has(text) ? marked.parseInline(String(text)) : '';
}

function list(items) {
  if (!has(items)) return '';
  if (!Array.isArray(items)) return `<p>${mdInline(items)}</p>`;
  return '<ul>' + items.map(i => `<li>${mdInline(i)}</li>`).join('') + '</ul>';
}

function field(label, html) {
  return html ? `<div class="section"><div class="label">${label}</div>${html}</div>` : '';
}

function openBox(items) {
  return has(items) ? `<div class="open"><div class="label">Open questions</div>${list(items)}</div>` : '';
}

function glance(rows) {
  rows = rows.filter(r => has(r.value));
  return rows.length
    ? '<dl class="glance">' + rows.map(r => `<div><dt>${r.label}</dt><dd>${mdInline(r.value)}</dd></div>`).join('') + '</dl>'
    : '';
}

function slug(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function showError(e) {
  const box = document.querySelector('main, .content') || document.body;
  box.insertAdjacentHTML('beforeend', `<p class="empty">ERROR: ${e.message}</p>`);
  console.error(e);
}

// ── Header ──────────────────────────────────────────────────────────────────

// ── Fan project ─────────────────────────────────────────────────────────────
// The fan-made mark: the four slanted light strips of the favicon.

function fanMark(cls = '') {
  return `<svg class="fan-mark ${cls}" viewBox="0 0 24 16" aria-hidden="true">${[2, 8, 14, 20].map(x =>
    `<rect x="${x}" y="1" width="3" height="14" rx="1" transform="skewX(-12) translate(3 0)"/>`).join('')}</svg>`;
}

const FAN_TEXT = `
  <p>This project has two goals: to make the lore of White Knuckle more interesting and more visually appealing to explore, and to build a baseline of story and worldbuilding for the pen &amp; paper one-shots to come.</p>
  <p>The lore is collected from the <a href="https://whiteknuckle.miraheze.org/wiki/Lore" target="_blank" rel="noopener">White Knuckle community wiki</a> and our own reading of the game. It is subject to change, through creative freedom as well as through updates to the game and the wiki itself. This page does not claim to be the source of truth, but it can be an entry point to dive deeper. Please visit the original wiki and check out the White Knuckle community Discord.</p>
  <p>If this page causes any trouble whatsoever, that was never my intention. Please write to me via the email linked in my <a href="https://github.com/FHieser" target="_blank" rel="noopener">GitHub account</a>.</p>
  <p>I am a huge fan of White Knuckle, and I made this to give it my own spin and to give something back to the community.</p>
  <p class="fan-note">${'${MARK}'} Lore we add or change ourselves carries this mark.</p>
  <p class="fan-sign">Have fun.</p>`;

const FAN_SEEN_KEY = 'rtts-fan-project-seen';

// The fan-project overlay: the note flickers on in the middle and radiates glowing particles off its edges.
// Shown once on the first visit (remembered in localStorage) and again via "Read more" in the footer.
function showFanIntro() {
  if (document.querySelector('.fan-overlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="fan-overlay" role="dialog" aria-modal="true" aria-labelledby="fan-title">
      <canvas class="fan-radiation" aria-hidden="true"></canvas>
      <div class="fan-panel">
        <span class="strip-light"><i></i><i></i><i></i><i></i></span>
        <h2 id="fan-title">Fan project</h2>
        <div class="fan-text">${FAN_TEXT.replace('${MARK}', fanMark())}</div>
        <button class="fan-enter" type="button">Enter</button>
      </div>
    </div>`);
  const overlay = document.querySelector('.fan-overlay');
  const stopRadiation = radiate(overlay.querySelector('.fan-radiation'), overlay.querySelector('.fan-panel'));
  const close = () => {
    try { localStorage.setItem(FAN_SEEN_KEY, '1'); } catch (e) {}
    overlay.classList.add('closing');
    setTimeout(() => { stopRadiation(); overlay.remove(); }, 400);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  overlay.querySelector('.fan-enter').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (!e.target.closest('.fan-panel')) close(); });
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.fan-enter').focus({ preventScroll: true });
}

// Radiation noise, like hits on a camera sensor: single white pixels flash for a moment and vanish.
// Hits cluster around `source` and thin out with distance; a few land anywhere on the screen.
// Returns a function that stops the animation.
function radiate(canvas, source, opts = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  const RATE = opts.rate ?? 160;       // hits per millisecond (~160000/s, ~10000 lit at any moment)
  const FALLOFF = opts.falloff ?? 18;  // px: hit density near the box halves about every 12.5px (18 · ln 2)
  const STRAY = opts.stray ?? 0.03;    // share of hits that land anywhere on the canvas
  const HUG = opts.hug;                // px: if set, the canvas is kept just around the source (cheaper than full screen)
  const SHADES = opts.shades || ['rgb(255,255,255)', 'rgb(215,215,215)', 'rgb(170,170,170)'];
  let hits = [];        // { x, y, until, shade (index into SHADES), dx, dy, len } in canvas coordinates
  let W = 0, H = 0, running = true, last = performance.now(), toSpawn = 0;
  let r = null, ox = 0, oy = 0;   // source rect and canvas origin, read once per frame

  // Keep the canvas where it should be and its pixel buffer matching its size, checked every frame
  function layout() {
    r = source.getBoundingClientRect();
    if (HUG !== undefined) {
      const left = Math.floor(r.left - HUG), top = Math.floor(r.top - HUG);
      const w = Math.ceil(r.width + 2 * HUG), h = Math.ceil(r.height + 2 * HUG);
      const st = canvas.style;
      if (st.left !== left + 'px') st.left = left + 'px';
      if (st.top !== top + 'px') st.top = top + 'px';
      if (st.width !== w + 'px') st.width = w + 'px';
      if (st.height !== h + 'px') st.height = h + 'px';
      ox = left; oy = top;
    } else {
      const cr = canvas.getBoundingClientRect();
      ox = cr.left; oy = cr.top;
    }
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw !== W || ch !== H) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cw; H = ch;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hits = [];
    }
  }

  // Somewhere near the source's outline, or (STRAY) anywhere on the canvas; in canvas coordinates
  function spot() {
    if (Math.random() < STRAY) return [Math.random() * W, Math.random() * H];
    // distance from the edge: exponential, density ∝ e^(−d / FALLOFF),
    // or gaussian (opts.gauss), density ∝ e^(−d² / FALLOFF²): drops off faster the further out
    const d = opts.gauss
      ? Math.abs(Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())) * FALLOFF / Math.SQRT2
      : -Math.log(1 - Math.random()) * FALLOFF;
    // a point on the source's outline pushed out by d, with rounded corners (quarter circles of radius d),
    // chosen uniformly along that outline so edges and corners are covered evenly
    const L = r.left - ox, T = r.top - oy, R = r.right - ox, B = r.bottom - oy;
    const arc = Math.PI / 2 * d;
    let t = Math.random() * (2 * (r.width + r.height) + 4 * arc);
    const corner = (cx, cy, a0) => { const a = a0 + (t / arc) * Math.PI / 2; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d]; };
    if (t < r.width) return [L + t, T - d];                     t -= r.width;
    if (t < arc) return corner(R, T, -Math.PI / 2);             t -= arc;
    if (t < r.height) return [R + d, T + t];                    t -= r.height;
    if (t < arc) return corner(R, B, 0);                        t -= arc;
    if (t < r.width) return [R - t, B + d];                     t -= r.width;
    if (t < arc) return corner(L, B, Math.PI / 2);              t -= arc;
    if (t < r.height) return [L - d, B - t];                    t -= r.height;
    return corner(L, T, Math.PI);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(50, now - last);
    last = now;
    layout();
    toSpawn += dt * RATE;
    while (toSpawn >= 1) {
      toSpawn--;
      const [x, y] = spot();
      const streak = Math.random() < 0.04;
      const angle = Math.random() * Math.PI * 2;
      hits.push({
        x: Math.round(x), y: Math.round(y),
        until: now + 30 + Math.random() * 60,   // a frame or a few, then gone
        shade: Math.random() < 0.85 ? 0 : 1 + Math.floor(Math.random() * 2),
        dx: Math.round(Math.cos(angle)), dy: Math.round(Math.sin(angle)), len: streak ? 2 + Math.floor(Math.random() * 3) : 1,
      });
    }
    hits = hits.filter(h => now <= h.until);   // drop the ones whose moment is over
    ctx.clearRect(0, 0, W, H);
    for (let sh = 0; sh < SHADES.length; sh++) {   // one path and one fill per shade
      ctx.beginPath();
      for (const h of hits) {
        if (h.shade !== sh) continue;
        for (let k = 0; k < h.len; k++) ctx.rect(h.x + h.dx * k, h.y + h.dy * k, 1, 1);
      }
      ctx.fillStyle = SHADES[sh];
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return () => { running = false; };
}

// Every page: the footer with "Read more", and the intro on the first visit
function initFanProject() {
  if (!document.querySelector('.site-footer')) document.body.insertAdjacentHTML('beforeend', `
    <footer class="site-footer">${fanMark()}<span>A fan project. White Knuckle and its world belong to its developers.</span>
      <button class="fan-more" type="button">Read more</button></footer>`);
  document.querySelector('.fan-more').addEventListener('click', showFanIntro);
  let seen = false;
  try { seen = localStorage.getItem(FAN_SEEN_KEY) === '1'; } catch (e) {}
  if (!seen) showFanIntro();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFanProject);
else initFanProject();

// ── Fan-made mode ───────────────────────────────────────────────────────────
// Off: the lore as collected. On: our own additions for the one-shots join in (canon: ours entries,
// `fan:` blocks in lore files, fan-made timeline events), shown in red.
// Switched with the four-strip button in the bottom-right corner of every page; remembered per browser.

const FAN_MODE_KEY = 'rtts-fan-mode';
function fanModeOn() {
  try { return localStorage.getItem(FAN_MODE_KEY) === '1'; } catch (e) { return false; }
}
if (fanModeOn()) document.documentElement.classList.add('fan-mode');

// An entry with its `fan:` block applied (fan mode on) or dropped (off).
// sections and lists are appended to, other fields replaced; added sections are marked fan.
function applyFan(e, on = fanModeOn()) {
  if (!e || !e.fan) return e;
  const { fan, ...rest } = e;
  if (!on) return rest;
  const out = { ...rest };
  for (const [k, v] of Object.entries(fan)) {
    if (k === 'sections') out.sections = [...(rest.sections || []), ...(v || []).map(s => ({ ...s, fan: true }))];
    else if (Array.isArray(v) && Array.isArray(rest[k])) out[k] = [...rest[k], ...v];
    else out[k] = v;
  }
  out.fanTouched = true;
  return out;
}

// Each page starts through runPage(init). Switching fan mode re-runs init in place (no reload):
// the page's cleanups (animation loops, global listeners) run first, then the lore is loaded fresh.
let pageInit = null;
let pageCleanups = [];
function onPageCleanup(fn) { pageCleanups.push(fn); }
function runPage(init) {
  pageInit = init;
  return init().catch(showError);
}
async function rerenderPage() {
  const old = pageCleanups.splice(0);   // run after the new render, so a page can take over live parts (the orbit)
  lorePromise = null;
  if (pageInit) await pageInit().catch(showError);
  old.forEach(fn => { try { fn(); } catch (e) {} });
}

function initFanMode() {
  const on = fanModeOn();
  document.body.insertAdjacentHTML('beforeend', `
    <button class="fan-toggle${on ? ' on' : ''}" type="button" aria-pressed="${on}"
      title="Fan-made mode: ${on ? 'on' : 'off'}. Shows our own additions for the one-shots in red.">
      <span class="strip-light"><i></i><i></i><i></i><i></i></span><span class="fan-toggle-label">Fan-made ${on ? 'on' : 'off'}</span>
    </button>`);
  const btn = document.querySelector('.fan-toggle');
  let stopAura = on ? fanAura(btn) : null;
  btn.addEventListener('click', () => {
    const next = !fanModeOn();
    try { localStorage.setItem(FAN_MODE_KEY, next ? '1' : '0'); } catch (e) {}
    document.documentElement.classList.toggle('fan-mode', next);
    btn.classList.remove('switching', 'to-on', 'to-off');
    void btn.offsetWidth;   // restart the light-up animation
    btn.classList.add('switching', next ? 'to-on' : 'to-off');
    btn.classList.toggle('on', next);
    btn.setAttribute('aria-pressed', next);
    btn.title = `Fan-made mode: ${next ? 'on' : 'off'}. Shows our own additions for the one-shots in red.`;
    btn.querySelector('.fan-toggle-label').textContent = `Fan-made ${next ? 'on' : 'off'}`;
    setTimeout(() => btn.classList.remove('switching', 'to-on', 'to-off'), 700);
    if (next && !stopAura) stopAura = fanAura(btn);
    if (!next && stopAura) { stopAura(); stopAura = null; fanBurst(btn, 500); }
    rerenderPage();
  });
}
// White radiation hits around the fan-mode button: constant while fan mode is on.
// Returns a function that stops it; fanBurst runs it for a moment only.
function fanAura(btn) {
  const canvas = document.createElement('canvas');
  canvas.className = 'fan-burst';
  document.body.appendChild(canvas);
  const stop = radiate(canvas, btn, {
    rate: 20, falloff: 9, gauss: true, stray: 0, hug: 32,   // dense at the edge; the falloff steepens with distance (gone by ~20px)
    shades: ['rgb(255,255,255)', 'rgb(215,215,215)', 'rgb(170,170,170)'],
  });
  return () => { stop(); canvas.remove(); };
}
function fanBurst(btn, ms) {
  const stop = fanAura(btn);
  setTimeout(stop, ms);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFanMode);
else initFanMode();

// nav: [{ id, label, href }] — href relative to the current page
function renderHeader({ title, home = './', nav = [], active }) {
  const header = document.getElementById('site-header');
  header.innerHTML = `
    <a class="brand" href="${ROOT}">Return to the Superstructure</a>
    ${title ? `<span class="brand-sep">/</span><a class="plate small" href="${home}">${title}</a>` : ''}
    <nav>${nav.map(n => `<a href="${n.href}"${n.id === active ? ' class="active"' : ''}>${n.label}</a>`).join('')}</nav>`;
}

// ── Lore ────────────────────────────────────────────────────────────────────
// The lore (lore/data/) is the source of truth. One-shots point into it by entry id.

// folder: one YAML file per entry in lore/data/<id>/, listed under <id>: in lore/data/<folder>
//         (static hosting cannot list folders). A "NN-" prefix on the file name only sorts the
//         files (03-gamma.yaml); the entry id is the name without it (gamma).
// page:   own overview page in lore/webapp/ instead of codex.html?c=<id>
// detail: one page per entry: lore/webapp/<detail>?id=<entry id>
const LORE_COLLECTIONS = [
  { id: 'substructures', label: 'Substructures', single: 'Substructure', folder: 'map.yaml', page: 'index.html', detail: 'substructure.html' },
  { id: 'peripheries', label: 'Peripheries', single: 'Periphery', folder: 'orbit.yaml', page: 'peripheries.html', detail: 'periphery.html' },
  { id: 'entities',    label: 'Entities' },
  { id: 'objects',     label: 'Objects' },
];

const CANON = {
  confirmed: { label: 'Confirmed', hint: 'Shown in the game itself (notes, terminals, announcements, locations).' },
  developer: { label: 'Developer', hint: 'Stated by the developers outside the game.' },
  theory:    { label: 'Theory',    hint: 'Community reading. Not confirmed.' },
  ours:      { label: 'Fan-made',  hint: 'Our own addition or change for the one-shots. Not part of the game.' },
};

function canonBadge(canon) {
  const c = CANON[canon];
  return c ? `<span class="badge canon-${canon}" title="${c.hint}">${canon === 'ours' ? fanMark() : ''}${c.label}</span>` : '';
}

let lorePromise = null;

// "SB07" for numbered substructures; other entries must have a name
function substructureName(e) {
  return Number.isInteger(e.number) ? `SB${String(e.number).padStart(2, '0')}` : e.id;
}

// → { collections: { substructures: [...], ... }, byId: { id: entry } }  (each entry gets .collection)
function loadLore() {
  if (!lorePromise) lorePromise = (async () => {
    const collections = {};
    const byId = {};
    const indexes = {};   // index file → parsed YAML, fetched once
    const index = file => indexes[file] || (indexes[file] = fetchYaml(`${ROOT}lore/data/${file}`).then(y => y || {}));
    await Promise.all(LORE_COLLECTIONS.map(async c => {
      const files = c.folder ? ((await index(c.folder))[c.id] || []).map(n => typeof n === 'string' ? n : n.id) : [];
      const entries = c.folder
        ? await Promise.all(files.map(async file => ({ id: file.replace(/^\d+-/, ''), ...(await fetchYaml(`${ROOT}lore/data/${c.id}/${file}.yaml`)) })))
        : (await fetchYaml(`${ROOT}lore/data/${c.id}.yaml`)) || [];
      const fanOn = fanModeOn();
      collections[c.id] = entries
        .filter(e => e.show !== false)                       // show: false hides an entry everywhere
        .filter(e => fanOn || e.canon !== 'ours')            // fan-made entries only exist in fan mode
        .map(e => applyFan(e, fanOn))
        .map(e => ({ ...e, name: e.name || substructureName(e), collection: c.id }));
    }));
    for (const c of LORE_COLLECTIONS) for (const e of collections[c.id]) byId[e.id] = e;
    return { collections, byId };
  })();
  return lorePromise;
}

function loreUrl(entry) {
  const c = LORE_COLLECTIONS.find(c => c.id === entry.collection);
  if (c?.detail) return `${ROOT}lore/webapp/${c.detail}?id=${entry.id}`;
  if (c?.page) return `${ROOT}lore/webapp/${c.page}#${entry.id}`;
  return `${ROOT}lore/webapp/codex.html?c=${entry.collection}#${entry.id}`;
}

function loreLink(id, byId) {
  const e = byId[id];
  if (!e) return `<span class="ref missing" title="Not in the lore yet">${id}</span>`;
  const c = LORE_COLLECTIONS.find(c => c.id === e.collection);
  const kind = c.single || c.label;
  return `<a class="ref" href="${loreUrl(e)}"><span class="ref-kind">${kind}</span>${e.name}</a>`;
}

function loreLinks(ids, byId) {
  return has(ids) ? `<div>${ids.map(id => loreLink(id, byId)).join('')}</div>` : '';
}

// ── Catalog ─────────────────────────────────────────────────────────────────
// one-shots/catalog.yaml lists the one-shot folders; each one-shot's own data/overview.yaml holds its details.

async function loadCatalog() {
  const catalog = (await fetchYaml(`${ROOT}one-shots/catalog.yaml`)) || {};
  const ids = catalog.one_shots || [];
  return Promise.all(ids.map(async id => ({
    ...(await fetchYaml(`${ROOT}one-shots/${id}/data/overview.yaml`)),
    id,
    url: `${ROOT}one-shots/${id}/webapp/`,
  })));
}

// One one-shot's card (on the Expedition page)
function shotCard(s) {
  return `
    <a class="card" href="${s.url}">
      <span class="badges">${has(s.status) ? `<span class="badge${s.status === 'complete' ? ' solid' : ''}">${s.status}</span>` : ''}</span>
      <span class="card-title">${s.title || s.id}</span>
      ${has(s.tagline) ? `<span class="card-tagline">${mdInline(s.tagline)}</span>` : ''}
      <span class="card-meta">
        ${has(s.players) ? `<span>${s.players} players</span>` : ''}
        ${has(s.duration) ? `<span>${s.duration}</span>` : ''}
        ${has(s.when) ? `<span>${s.when}</span>` : ''}
      </span>
      ${has(s.tags) ? `<span class="card-tags">${s.tags.map(t => `<span class="badge">${t}</span>`).join('')}</span>` : ''}
    </a>`;
}
