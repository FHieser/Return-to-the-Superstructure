// lore/webapp/js/lore.js
// Rendering for the lore pages (cavity map, substructure, peripheries, codex, timeline).
// Depends on: shared/js/core.js, jsyaml (CDN), marked (CDN).

const LORE_NAV = [
  { id: 'map', label: 'Substructures', href: './' },
  ...LORE_COLLECTIONS.filter(c => c.id !== 'substructures').map(c => ({ id: c.id, label: c.label, href: c.page ? `./${c.page}` : `./codex.html?c=${c.id}` })),
  { id: 'timeline', label: 'Timeline', href: './timeline.html' },
];

async function loreHeader(active) {
  const overview = (await fetchYaml('../data/overview.yaml')) || {};
  renderHeader({ title: overview.title || 'Lore', nav: LORE_NAV, active });
  return overview;
}

// Fields that hold ids of other lore entries, with their label on the page
const LINK_FIELDS = [
  ['periphery', 'Periphery'], ['origin', 'Origin'], ['related', 'Related'],
];
// Plain one-line fields shown in the glance grid
const FACT_FIELDS = [['symbol', 'Symbol'], ['designation', 'Designation'], ['fate', 'Fate']];

const asIds = v => Array.isArray(v) ? v : has(v) ? [v] : [];

function backlinkIndex(byId, oneShots) {
  const back = {};   // id → { lore: [ids], shots: [one-shot] }
  const add = (id, key, value) => {
    back[id] = back[id] || { lore: [], shots: [] };
    if (!back[id][key].includes(value)) back[id][key].push(value);
  };
  for (const e of Object.values(byId))
    for (const [f] of LINK_FIELDS) for (const id of asIds(e[f])) add(id, 'lore', e.id);
  for (const s of oneShots) for (const id of s.lore_refs || []) add(id, 'shots', s);
  return back;
}

function backlinkFields(id, byId, back) {
  const b = back[id] || { lore: [], shots: [] };
  // substructures pointing at a periphery research it
  const researched = byId[id]?.collection === 'peripheries' ? b.lore.filter(x => byId[x]?.periphery === id) : [];
  return field('Researched in', loreLinks(researched, byId))
    + field('Mentioned by', loreLinks(b.lore.filter(x => !researched.includes(x)), byId))
    + field('Used in one-shots', b.shots.map(s => `<a class="ref" href="${s.url}">${s.title || s.id}</a>`).join(''));
}

function sourcesField(sources) {
  return has(sources) ? field('Sources', `<ul class="sources">${sources.map(s => `<li>${mdInline(s)}</li>`).join('')}</ul>`) : '';
}

// ── Cavity map ──────────────────────────────────────────────────────────────

const MAP_UNIT = 100;      // SVG units per grid step
const NODE_R = 0.36;       // circle radius in grid steps

// Black or white text, whichever reads better on the fill
function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#111';
  const n = parseInt(m[1], 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#111' : '#f4f4f0';
}

// "No known information": none of these filled in. Colour, habitation and periphery alone do not count.
const INFO_FIELDS = ['summary', 'details', 'sections', 'related', 'sources'];
function hasInfo(e) {
  return INFO_FIELDS.some(f => has(e[f]));
}

// The colour mixed towards black: amount 0 = unchanged, 1 = black
function darken(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = shift => Math.round(((n >> shift) & 255) * (1 - amount)).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// The colour mixed towards white: amount 0 = unchanged, 1 = white
function lighten(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = shift => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * amount).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// Full-text sections: [{ heading, body }] → a heading per section, body as Markdown paragraphs
function sectionsHtml(sections, level = 3) {
  return has(sections)
    ? sections.filter(sec => fanModeOn() || !(sec.fan || sec.canon === 'ours')).map(sec => {
        const fan = sec.fan || sec.canon === 'ours';
        return `<section class="prose${fan ? ' fan-section' : ''}">${has(sec.heading) ? `<h${level}>${sec.heading}${fan ? ` ${canonBadge('ours')}` : ''}</h${level}>` : ''}${md(sec.body)}</section>`;
      }).join('')
    : '';
}

function peripheryName(id, byId) {
  if (!has(id)) return '';
  const p = byId[id];
  return p ? p.name : id.charAt(0).toUpperCase() + id.slice(1);
}

// highlight: id of a substructure to mark (substructure page); others are dimmed
function renderMap(map, byId, highlight) {
  const nodes = Object.fromEntries((map.substructures || []).map(n => [n.id, n]));
  const pt = p => typeof p === 'string' ? nodes[p]?.at : p;
  const xy = p => { const [c, r] = pt(p) || [0, 0]; return `${c * MAP_UNIT},${r * MAP_UNIT}`; };
  const line = (pts, cls) => `<polyline class="${cls}" points="${pts.map(xy).join(' ')}"/>`;

  // viewBox from everything drawn, plus a margin
  const all = [...(map.walls || []).flat(), ...Object.values(nodes).map(n => n.at), ...shownLandmarks(map).map(l => [l.at[0], l.at[1] - 0.55])];
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const pad = 0.3;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad].map(v => v * MAP_UNIT);

  const nodeSvg = Object.values(nodes).map(n => {
    const e = byId[n.id] || { id: n.id, name: n.id, collection: 'substructures' };
    const [cx, cy] = n.at.map(v => v * MAP_UNIT);
    const hollow = e.marked !== true && !hasInfo(e);   // marked ones stay in full colour
    const fill = hollow ? 'transparent' : has(e.color) ? e.color : 'var(--plate)';
    const ink = hollow ? (has(e.color) ? '#e8e8e2' : 'var(--text)') : inkFor(e.color);
    const lines = [e.name, e.habitation, peripheryName(e.periphery, byId)].filter(has);
    const lh = 0.15 * MAP_UNIT;
    const text = lines.map((l, i) => `<text x="${cx}" y="${cy + (i - (lines.length - 1) / 2) * lh}" fill="${ink}" class="${i ? 'sub' : 'num'}">${l}</text>`).join('');
    // hollow nodes with a habitation colour: dark tone of it inside, the colour itself as dashed outline
    const outline = hollow && has(e.color) ? ` style="fill:${darken(e.color, 0.65)};stroke:${e.color}"` : '';
    const shape = n.size
      ? `<rect x="${cx - n.size[0] * MAP_UNIT / 2}" y="${cy - n.size[1] * MAP_UNIT / 2}" width="${n.size[0] * MAP_UNIT}" height="${n.size[1] * MAP_UNIT}" fill="${fill}"${outline}/>`
      : `<circle cx="${cx}" cy="${cy}" r="${NODE_R * MAP_UNIT}" fill="${fill}"${outline}/>`;
    // marked: an extra ring (or frame) around the substructure
    const gap = 0.09 * MAP_UNIT;
    const ring = e.marked !== true ? '' : n.size
      ? `<rect class="ring" x="${cx - n.size[0] * MAP_UNIT / 2 - gap}" y="${cy - n.size[1] * MAP_UNIT / 2 - gap}" width="${n.size[0] * MAP_UNIT + 2 * gap}" height="${n.size[1] * MAP_UNIT + 2 * gap}"/>`
      : `<circle class="ring" cx="${cx}" cy="${cy}" r="${NODE_R * MAP_UNIT + gap}"/>`;
    const q = has(e.open) && !n.size ? `<text class="q" x="${cx + NODE_R * MAP_UNIT * 0.95}" y="${cy - NODE_R * MAP_UNIT * 0.75}">?</text>` : '';
    const cls = ['map-node', n.size ? 'wide' : '', hollow ? 'no-info' : '', hollow && has(e.color) ? 'tinted' : '', highlight && n.id !== highlight ? 'dim' : '', n.id === highlight ? 'here' : ''].join(' ');
    return `<a class="${cls}" href="${loreUrl(e)}" data-id="${n.id}">${ring}${shape}${text}${q}</a>`;
  }).join('');

  return `
    <svg class="cavity-map" viewBox="${vb.join(' ')}" role="img" aria-label="Superstructure cavity map">
      ${(map.walls || []).map((w, i) => `<polygon class="${i === (map.walls.length - 1) ? 'wall outer' : 'wall'}" points="${w.map(xy).join(' ')}"/>`).join('')}
      ${(map.roads || []).map(l => line(l, 'road')).join('')}
      ${(map.tram_lines || []).map(l => line(l, 'tram')).join('')}
      ${nodeSvg}
      ${landmarkSvg(map)}
    </svg>`;
}

// Points on the map that are not substructures (entrances, camps). canon: ours ones only appear in fan mode.
function shownLandmarks(map) {
  return (map.landmarks || []).filter(l => fanModeOn() || l.canon !== 'ours');
}
function landmarkSvg(map) {
  return shownLandmarks(map).map(l => {
    const [cx, cy] = l.at.map(v => v * MAP_UNIT);
    const s = 13;
    return `<g class="map-landmark${l.canon === 'ours' ? ' fan' : ''}"><title>${l.name}${l.note ? ' – ' + l.note : ''}</title>
      <path d="M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z"/>
      <text x="${cx}" y="${cy - s - 26}">${l.name}</text></g>`;
  }).join('');
}

function mapLegend(map) {
  return `<div class="map-legend">
    <span><i class="key road"></i>Road</span>
    <span><i class="key tram"></i>Tram line</span>
    <span><i class="key wall"></i>Facility wall</span>
    <span><i class="key ring"></i>Marked</span>
    <span><i class="key no-info"></i>No known information</span>
    ${shownLandmarks(map).some(l => l.canon === 'ours') ? '<span class="fan-legend"><i class="key landmark"></i>Fan-made point</span>' : ''}
    ${has(map.source) ? `<span class="dim">Layout: ${mdInline(map.source)}</span>` : ''}
  </div>`;
}

function mapTooltip(e, byId) {
  const swatch = has(e.color) ? `<i class="swatch" style="background:${e.color}"></i>` : '';
  return `
    <div class="label">${has(e.number) ? `Substructure ${e.number}` : 'Substructure'}</div>
    <div class="tip-title">${e.name}</div>
    <div class="tip-facts">
      ${has(e.habitation) ? `<span>${swatch}Habitation ${e.habitation}</span>` : ''}
      ${has(e.periphery) ? `<span>Periphery ${peripheryName(e.periphery, byId)}</span>` : ''}
    </div>
    <p>${has(e.summary) ? mdInline(e.summary) : '<span class="dim">No known information.</span>'}</p>
    <a class="tip-link" href="${loreUrl(e)}">Open ${e.name} &rarr;</a>`;
}

// Hover (or first tap on touch screens) shows a card with a link; click opens the substructure
function wireMap(wrap, byId) {
  const tip = wrap.querySelector('.map-tip');
  const touch = matchMedia('(hover: none)').matches;
  let current = null, hideTimer = null;

  function show(node) {
    clearTimeout(hideTimer);
    current = node.dataset.id;
    tip.innerHTML = mapTooltip(byId[current], byId);
    tip.hidden = false;
    const w = wrap.getBoundingClientRect(), n = node.getBoundingClientRect();
    let left = n.right - w.left + 8;
    if (left + tip.offsetWidth > w.width) left = n.left - w.left - tip.offsetWidth - 8;
    left = Math.max(0, Math.min(left, w.width - tip.offsetWidth));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, n.top - w.top + n.height / 2 - tip.offsetHeight / 2)}px`;
  }
  function hideSoon() {
    hideTimer = setTimeout(() => { tip.hidden = true; current = null; }, 250);
  }

  wrap.querySelectorAll('.map-node').forEach(node => {
    node.addEventListener('mouseenter', () => show(node));
    node.addEventListener('mouseleave', hideSoon);
    node.addEventListener('focus', () => show(node));
    node.addEventListener('blur', hideSoon);
    node.addEventListener('click', e => {
      if (touch && current !== node.dataset.id) { e.preventDefault(); show(node); }
    });
  });
  tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  tip.addEventListener('mouseleave', hideSoon);
  const closeTip = e => {
    if (!tip.hidden && !e.target.closest('.map-tip, .map-node')) { tip.hidden = true; current = null; }
  };
  document.addEventListener('click', closeTip);
  onPageCleanup(() => document.removeEventListener('click', closeTip));
}

function substructureList(entries) {
  return `<div class="pills">${entries.map(e => `<a class="pill" href="${loreUrl(e)}">${has(e.color) ? `<i class="swatch" style="background:${e.color}"></i>` : ''}${e.name}</a>`).join('')}</div>`;
}

// ── Lore start page: the cavity map + overview ──────────────────────────────

async function initLoreMap() {
  const o = await loreHeader('map');
  // substructures/_superstructure.yaml: the base file, about the Superstructure as a whole
  const [map, { collections, byId }, base] = await Promise.all([
    fetchYaml('../data/map.yaml'), loadLore(), fetchYaml('../data/substructures/_superstructure.yaml').catch(() => null),
  ]);
  const b = applyFan(base) || {};
  const subs = [...collections.substructures].sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  const counts = LORE_COLLECTIONS.filter(c => c.id !== 'substructures').map(c =>
    `<a class="pill" href="${c.page ? `./${c.page}` : `./codex.html?c=${c.id}`}">${c.label}<span class="count">${collections[c.id].length}</span></a>`).join('');

  document.getElementById('content').innerHTML = `
    <h1>${b.name || o.title || 'Lore'}</h1>
    ${has(b.aka) ? `<p class="aka-line">AKA ${asIds(b.aka).join(' · ')} ${canonBadge(b.canon)}</p>` : ''}
    ${has(b.summary) ? `<p class="lede">${mdInline(b.summary)}</p>` : ''}
    ${has(o.intro) ? `<div class="lede">${md(o.intro)}</div>` : ''}
    <div class="map-wrap">
      ${renderMap(map || {}, byId)}
      <div class="map-tip" hidden></div>
    </div>
    ${mapLegend(map || {})}
    <h2>Substructures</h2>
    ${substructureList(subs)}
    ${sectionsHtml(b.sections, 2)}
    ${field('Related', loreLinks(asIds(b.related), byId))}
    ${sourcesField(b.sources)}
    ${openBox(b.open)}
    ${glance((o.glance || []).map(g => ({ label: g.label, value: g.value })))}
    ${(o.sections || []).map(s => `<h2>${s.heading}</h2>${md(s.body)}`).join('')}
    <h2>Codex</h2>
    <div class="pills">${counts}<a class="pill" href="./timeline.html">Timeline</a></div>
    <h2>How to read the lore</h2>
    <dl class="glance">${Object.entries(CANON).map(([k, c]) => `<div><dt>${canonBadge(k)}</dt><dd>${c.hint}</dd></div>`).join('')}</dl>
    ${openBox(o.open)}`;
  wireMap(document.querySelector('.map-wrap'), byId);
}

// ── Substructure page ───────────────────────────────────────────────────────

// Neighbours along tram lines and roads, from map.yaml
function neighbours(map, id) {
  const out = { tram: [], road: [] };
  for (const [key, lines] of [['tram', map.tram_lines], ['road', map.roads]])
    for (const l of lines || []) {
      const i = l.indexOf(id);
      if (i < 0) continue;
      for (const j of [i - 1, i + 1]) if (typeof l[j] === 'string' && !out[key].includes(l[j])) out[key].push(l[j]);
    }
  return out;
}

async function initSubstructure() {
  await loreHeader('map');
  const id = new URLSearchParams(location.search).get('id');
  const [map, { collections, byId }, oneShots] = await Promise.all([
    fetchYaml('../data/map.yaml'), loadLore(), loadCatalog().catch(() => []),
  ]);
  const e = byId[id];
  const content = document.getElementById('content');
  if (!e || e.collection !== 'substructures') {
    content.innerHTML = `<p class="empty">Substructure "${id}" not found. <a href="./">Back to the map</a></p>`;
    return;
  }
  document.title = `${e.name} — Lore`;

  const subs = [...collections.substructures].sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  const i = subs.indexOf(e);
  const prev = subs[(i - 1 + subs.length) % subs.length], next = subs[(i + 1) % subs.length];
  const near = neighbours(map || {}, id);
  const back = backlinkIndex(byId, oneShots);

  content.innerHTML = `
    <div class="pager">
      <a href="${loreUrl(prev)}">&larr; ${prev.name}</a>
      <a href="./">Map</a>
      <a href="${loreUrl(next)}">${next.name} &rarr;</a>
    </div>
    <article class="sheet sub-sheet" style="--hab:${has(e.color) ? e.color : 'var(--plate)'}">
      <div class="sheet-head">
        <h2>${e.name}</h2>
        <div class="badges">${has(e.habitation) ? `<span class="badge"><i class="swatch" style="background:${e.color || 'transparent'}"></i>Habitation ${e.habitation}</span>` : ''}${canonBadge(e.canon)}</div>
      </div>
      ${has(e.summary) ? `<p class="lede">${mdInline(e.summary)}</p>` : ''}
      ${glance([
        { label: 'Number', value: e.number },
        { label: 'Habitation', value: e.habitation },
      ])}
      ${sectionsHtml(e.sections)}
      ${!has(e.summary) && !has(e.sections) ? '<p class="dim">No known information.</p>' : ''}
      ${field('Periphery', has(e.periphery) ? loreLink(e.periphery, byId) : '')}
      ${field('Tram line to', loreLinks(near.tram, byId))}
      ${field('Road to', loreLinks(near.road, byId))}
      ${field('Related', loreLinks(asIds(e.related), byId))}
      ${backlinkFields(id, byId, back)}
      ${sourcesField(e.sources)}
      ${openBox(e.open)}
    </article>
    <h2>On the map</h2>
    <div class="map-wrap small">
      ${renderMap(map || {}, byId, id)}
      <div class="map-tip" hidden></div>
    </div>`;
  wireMap(content.querySelector('.map-wrap'), byId);
}

// ── Peripheries: orbit ──────────────────────────────────────────────────────
// Every periphery (lore/data/peripheries/, in orbit.yaml order) floats around one orbit
// and sheds its Greek letter in its colour. Colour: the periphery's own, else that of the
// substructure that researches it. stable: true sits fixed in the centre as a square.

function peripheryList({ collections }) {
  return collections.peripheries.map(entry => {
    const subs = collections.substructures.filter(s => s.periphery === entry.id);
    const stable = entry.stable === true;
    const upper = stable ? '□' : has(entry.symbol) ? entry.symbol : entry.name.charAt(0);
    return {
      id: entry.id, entry, subs, name: entry.name, upper, stable,
      lower: upper.toLowerCase(),
      color: has(entry.color) ? entry.color : subs.find(s => has(s.color))?.color || '#e4e4df',
      lit: entry.marked === true || hasInfo(entry),   // same rule as the map
    };
  });
}

function orbitTooltip(p, byId) {
  return `
    <div class="label">${p.stable ? 'Stable' : 'Periphery'}</div>
    <div class="tip-title"><span class="greek" style="color:${p.color}">${p.upper}</span> ${p.name}</div>
    ${p.subs.length ? `<div class="tip-facts"><span>Researched in ${p.subs.map(s => s.name).join(', ')}</span></div>` : ''}
    <p>${has(p.entry.summary) ? mdInline(p.entry.summary) : '<span class="dim">No known information.</span>'}</p>
    <a class="tip-link" href="${loreUrl(p.entry)}">Open ${p.name} &rarr;</a>`;
}

function runOrbit(wrap, list, byId) {
  const canvas = wrap.querySelector('canvas');
  const tip = wrap.querySelector('.map-tip');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const glyphs = [];                       // the trail: { x, y, vx, vy, rot, vr, ch, color, life, max, size, alpha }
  // one state per orb, so the list can change while running: orbs fade in/out and glide to their new place
  // { p, alpha, target (1 shown, 0 leaving), frac, fracTarget (place on the circle, 0..1), spawn, seed }
  let orbs = [];
  const seedOf = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);
  function setList(next, fadeIn) {
    const byIdNow = Object.fromEntries(orbs.map(o => [o.p.id, o]));
    const ids = new Set(next.map(p => p.id));
    for (const o of orbs) if (!ids.has(o.p.id)) o.target = 0;
    const ringNext = next.filter(p => !p.stable);
    for (const p of next) {
      const fracTarget = p.stable ? 0 : ringNext.indexOf(p) / ringNext.length;
      const o = byIdNow[p.id];
      if (o) { o.p = p; o.target = 1; o.fracTarget = fracTarget; }
      else orbs.push({ p, alpha: fadeIn ? 0 : 1, target: 1, frac: fracTarget, fracTarget, spawn: 0, seed: seedOf(p.id) });
    }
    hover = -1; pinned = -1; tip.hidden = true;
  }
  let W = 0, H = 0, R = 0, orbR = 0;
  let clock = 0, speed = 1, hover = -1, pinned = -1, mouse = null;   // clock: orbit time, stops while hovering

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.36;
    orbR = Math.max(18, Math.min(34, R * 0.16));
  }

  function orbPos(i) {
    const o = orbs[i];
    if (o.p.stable) return [W / 2, H / 2];
    const a = clock * 0.00022 + o.frac * Math.PI * 2 - Math.PI / 2;   // about 30 s per lap
    const r = R + Math.sin(clock * 0.0009 + o.seed * 1.7) * R * 0.06;     // slow breathing in and out
    const bob = Math.sin(clock * 0.0013 + o.seed * 2.3) * orbR * 0.25;    // and a little float
    return [W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r + bob];
  }

  function dropLetter(o, x, y) {
    const p = o.p;
    const out = Math.atan2(y - H / 2, x - W / 2) + (Math.random() - 0.5) * 1.6;
    const v = 0.002 + Math.random() * 0.008;   // slow, so the letters linger along the path
    glyphs.push({
      x: x + (Math.random() - 0.5) * orbR, y: y + (Math.random() - 0.5) * orbR,
      vx: Math.cos(out) * v, vy: Math.sin(out) * v - 0.004,
      rot: (Math.random() - 0.5) * 0.8, vr: (Math.random() - 0.5) * 0.0012,
      ch: Math.random() < 0.6 ? p.lower : p.upper, color: p.color,
      life: 0, max: 3500 + Math.random() * 3000, size: 12 + Math.random() * 16,
      alpha: (p.lit ? 1 : 0.55) * o.alpha,
    });
  }

  function step(t, dt) {
    const target = hover >= 0 || pinned >= 0 ? 0 : 1;      // stand still while one is looked at
    speed += (target - speed) * Math.min(1, dt * 0.008);
    if (speed < 0.002) speed = target;
    clock += dt * speed;
    // fade in/out (~0.6s) and glide to the new place on the circle; drop the ones that faded out
    for (const o of orbs) {
      o.alpha += (o.target - o.alpha) * Math.min(1, dt * 0.006);
      let df = o.fracTarget - o.frac;
      df -= Math.round(df);                       // the short way round
      o.frac += df * Math.min(1, dt * 0.004);
    }
    orbs = orbs.filter(o => o.target > 0 || o.alpha > 0.01);
    orbs.forEach((o, i) => {
      if (o.p.stable || o.alpha < 0.3) return;   // stable: no trail; nearly gone: no new letters
      o.spawn -= dt;   // the particles keep flying, also while the orbit stands still
      if (o.spawn <= 0) {
        const [x, y] = orbPos(i);
        dropLetter(o, x, y);
        o.spawn = (o.p.lit ? 60 : 130) + Math.random() * 80;
      }
    });
    for (let k = glyphs.length - 1; k >= 0; k--) {
      const g = glyphs[k];
      g.life += dt; g.x += g.vx * dt; g.y += g.vy * dt; g.rot += g.vr * dt;
      if (g.life >= g.max) glyphs.splice(k, 1);
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    // the trail
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of glyphs) {
      const k = g.life / g.max;
      const fade = k < 0.1 ? k / 0.1 : Math.pow(1 - (k - 0.1) / 0.9, 1.6);
      ctx.save();
      ctx.globalAlpha = g.alpha * fade;
      ctx.translate(g.x, g.y); ctx.rotate(g.rot);
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color; ctx.shadowBlur = 6;
      ctx.font = `${Math.round(g.size)}px Georgia, "Times New Roman", serif`;
      ctx.fillText(g.ch, 0, 0);
      ctx.restore();
    }

    // the letters (and the stable square); the written-out name only while hovered
    orbs.forEach((o, i) => {
      const p = o.p;
      const [x, y] = orbPos(i);
      const on = i === hover || i === pinned;
      const size = orbR * (on ? 2.3 : 2);
      ctx.save();
      ctx.globalAlpha = o.alpha;
      if (p.stable) {
        const side = orbR * (on ? 2.1 : 1.9);
        ctx.shadowColor = p.color; ctx.shadowBlur = (on ? 34 : 22) + Math.sin(t * 0.0015) * 4;   // a slow, steady pulse
        ctx.fillStyle = 'rgba(228, 228, 223, 0.08)';
        ctx.fillRect(x - side / 2, y - side / 2, side, side);
        ctx.lineWidth = on ? 3 : 2.5;
        ctx.strokeStyle = lighten(p.color, 0.4);
        ctx.strokeRect(x - side / 2, y - side / 2, side, side);
        if (on) {
          ctx.shadowBlur = 8;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = '700 12px "IBM Plex Mono", monospace';
          ctx.fillStyle = '#f0f0ec';
          ctx.fillText(p.name.toUpperCase(), x, y + side / 2 + 16);
        }
        ctx.restore();
        return;
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = (p.lit || on ? 1 : 0.55) * o.alpha;
      ctx.shadowColor = p.color; ctx.shadowBlur = on ? 36 : p.lit ? 26 : 12;
      ctx.fillStyle = p.color;
      ctx.font = `700 ${Math.round(size)}px Georgia, "Times New Roman", serif`;
      ctx.fillText(p.upper, x, y);
      // glowing edges: the outline in a lighter tint, with a tight blur
      ctx.shadowBlur = on ? 14 : 9;
      ctx.strokeStyle = lighten(p.color, 0.55);
      ctx.lineWidth = on ? 2 : 1.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(p.upper, x, y);
      if (on) {
        ctx.shadowBlur = 8;
        ctx.font = '700 12px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#f0f0ec';
        ctx.fillText(p.name.toUpperCase(), x, y + size * 0.62 + 10);
      }
      ctx.restore();
    });
  }

  function orbAt(x, y, t) {
    for (let i = 0; i < orbs.length; i++) {
      if (orbs[i].alpha < 0.5) continue;
      const [ox, oy] = orbPos(i);
      if (Math.hypot(ox - x, oy - y) < orbR * 1.3) return i;
    }
    return -1;
  }

  function placeTip(i, t) {
    if (i < 0) { tip.hidden = true; return; }
    const [x, y] = orbPos(i);
    const gap = orbs[i].p.stable ? 70 : orbR + 12;   // the centre square's label is wider than the square
    let left = x + gap;
    if (left + tip.offsetWidth > W) left = x - gap - tip.offsetWidth;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, Math.min(H - tip.offsetHeight, y - tip.offsetHeight / 2))}px`;
  }

  function show(i) {
    if (i < 0) { tip.hidden = true; return; }
    tip.innerHTML = orbitTooltip(orbs[i].p, byId);
    tip.hidden = false;
  }

  const pointer = e => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  let hideTimer = null;
  canvas.addEventListener('mousemove', e => { mouse = pointer(e); });
  canvas.addEventListener('mouseleave', () => { mouse = null; });
  canvas.addEventListener('click', e => {
    const i = orbAt(...pointer(e), performance.now());
    if (touch || reduce || i < 0) { pinned = i; show(i); if (reduce) placeTip(i, 3600); return; }
    const link = tip.querySelector('.tip-link');
    if (link) link.click();
  });
  tip.addEventListener('mouseenter', () => { clearTimeout(hideTimer); pinned = hover; });
  tip.addEventListener('mouseleave', () => { pinned = -1; });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last);
    last = now;
    if (!touch) {
      const i = mouse ? orbAt(mouse[0], mouse[1], now) : -1;
      if (i !== hover) {
        hover = i;
        canvas.style.cursor = i >= 0 ? 'pointer' : '';
        clearTimeout(hideTimer);
        if (i >= 0) show(i);
        else if (pinned < 0) hideTimer = setTimeout(() => { if (hover < 0 && pinned < 0) tip.hidden = true; }, 300);
      }
    }
    step(now, dt);
    draw(now);
    if (!tip.hidden) placeTip(pinned >= 0 ? pinned : hover, now);
    if (!reduce && running) requestAnimationFrame(frame);
  }

  let running = true;
  setList(list, false);
  resize();
  const observer = new ResizeObserver(() => { resize(); if (reduce) draw(performance.now()); });
  observer.observe(canvas);
  const ctrl = {
    wrap,
    update(next) { setList(next, true); if (reduce) { orbs.forEach(o => { o.alpha = o.target; o.frac = o.fracTarget; }); orbs = orbs.filter(o => o.target > 0); draw(3600); } },
    stop() { running = false; observer.disconnect(); },
  };
  if (reduce) {
    // one still frame with a trail already laid down
    for (let k = 0; k < 120; k++) step(k * 30, 30);
    draw(3600);
  } else {
    requestAnimationFrame(frame);
  }
  return ctrl;
}

async function initPeripheries() {
  const overview = await loreHeader('peripheries');
  document.title = `Peripheries — ${overview.title || 'Lore'}`;
  // _peripheries.yaml: the base file, about peripheries in general
  const [data, base] = await Promise.all([loadLore(), fetchYaml('../data/peripheries/_peripheries.yaml').catch(() => null)]);
  const b = applyFan(base) || {};
  const shown = peripheryList(data);
  document.getElementById('content').innerHTML = `
    <h1>${b.name || 'Peripheries'}</h1>
    ${has(b.summary) ? `<p class="lede">${mdInline(b.summary)} ${canonBadge(b.canon)}</p>` : ''}
    ${shown.length ? `
    <div class="orbit-wrap"><canvas class="orbit" aria-label="The peripheries in orbit"></canvas><div class="map-tip" hidden></div></div>
    <div class="pills">${shown.map(p => `<a class="pill" href="${loreUrl(p.entry)}"><span class="greek" style="color:${p.color}">${p.upper}</span> ${p.name}</a>`).join('')}</div>`
    : '<p class="empty">No peripheries shown. Set show: true in a file in lore/data/peripheries/.</p>'}
    ${sectionsHtml(b.sections, 2)}
    ${field('Related', loreLinks(asIds(b.related), data.byId))}
    ${sourcesField(b.sources)}
    ${openBox(b.open)}`;
  const fresh = document.querySelector('.orbit-wrap');
  if (fresh && liveOrbit) {
    fresh.replaceWith(liveOrbit.wrap);   // keep the running orbit; it fades the changes in and out
    liveOrbit.update(shown);
  } else {
    if (liveOrbit) liveOrbit.stop();
    liveOrbit = fresh ? runOrbit(fresh, shown, data.byId) : null;
  }
  const mine = liveOrbit;
  onPageCleanup(() => { if (mine && liveOrbit === mine && !document.body.contains(mine.wrap)) { mine.stop(); liveOrbit = null; } });
}
let liveOrbit = null;   // the orbit on the Peripheries page, kept across fan-mode switches

// ── Periphery page ──────────────────────────────────────────────────────────

async function initPeriphery() {
  await loreHeader('peripheries');
  const id = new URLSearchParams(location.search).get('id');
  const [data, oneShots] = await Promise.all([loadLore(), loadCatalog().catch(() => [])]);
  const { byId } = data;
  const shown = peripheryList(data);
  const p = shown.find(x => x.id === id);
  const content = document.getElementById('content');
  if (!p) {
    content.innerHTML = `<p class="empty">Periphery "${id}" not found. <a href="./peripheries.html">Back to the peripheries</a></p>`;
    return;
  }
  const e = p.entry;
  document.title = `${e.name} — Lore`;
  const i = shown.indexOf(p);
  const prev = shown[(i - 1 + shown.length) % shown.length], next = shown[(i + 1) % shown.length];
  const back = backlinkIndex(byId, oneShots);

  content.innerHTML = `
    <div class="pager">
      <a href="${loreUrl(prev.entry)}">&larr; ${prev.name}</a>
      <a href="./peripheries.html">Peripheries</a>
      <a href="${loreUrl(next.entry)}">${next.name} &rarr;</a>
    </div>
    <article class="sheet sub-sheet" style="--hab:${p.color}">
      <div class="periphery-head">
        ${p.stable ? `<span class="periphery-square" style="--c:${p.color}"></span>` : `<span class="periphery-symbol" style="--c:${p.color}">${p.upper}</span>`}
        <div>
          <h2>${e.name}</h2>
          <div class="badges">${canonBadge(e.canon)}</div>
        </div>
      </div>
      ${has(e.summary) ? `<p class="lede">${mdInline(e.summary)}</p>` : ''}
      ${sectionsHtml(e.sections)}
      ${!hasInfo(e) ? '<p class="dim">No known information.</p>' : ''}
      ${field('Related', loreLinks(asIds(e.related), byId))}
      ${backlinkFields(e.id, byId, back)}
      ${sourcesField(e.sources)}
      ${openBox(e.open)}
    </article>`;
}

// ── Codex (one page for every non-folder collection) ────────────────────────

function renderEntry(e, byId, back) {
  return `
    <article class="sheet" id="${e.id}" data-kind="${e.kind || ''}" data-canon="${e.canon || ''}">
      <div class="sheet-head">
        <h2>${e.name}</h2>
        <div class="badges">${has(e.kind) ? `<span class="badge">${e.kind}</span>` : ''}${canonBadge(e.canon)}</div>
        ${has(e.aka) ? `<div class="aka">AKA ${asIds(e.aka).join(' · ')}</div>` : ''}
      </div>
      ${has(e.summary) ? `<p><strong>${mdInline(e.summary)}</strong></p>` : ''}
      ${glance(FACT_FIELDS.map(([f, label]) => ({ label, value: e[f] })))}
      ${list(e.details)}
      ${!hasInfo(e) ? '<p class="dim">No known information.</p>' : ''}
      ${has(e.threat) ? `<div class="box gm section"><div class="label">Threat</div>${mdInline(e.threat)}</div>` : ''}
      ${LINK_FIELDS.map(([f, label]) => field(label, loreLinks(asIds(e[f]), byId))).join('')}
      ${backlinkFields(e.id, byId, back)}
      ${sourcesField(e.sources)}
      ${openBox(e.open)}
    </article>`;
}

// colId: collection to show (default: ?c= in the URL)
// top(data): extra HTML between heading and entries; after(data): runs once the page is rendered
async function initCodex(colId, { top, after } = {}) {
  const params = new URLSearchParams(location.search);
  const cols = LORE_COLLECTIONS.filter(c => !c.folder);
  const col = cols.find(c => c.id === (colId || params.get('c'))) || cols[0];
  const overview = await loreHeader(col.id);
  document.title = `${col.label} — ${overview.title || 'Lore'}`;

  const [{ collections, byId }, oneShots] = await Promise.all([loadLore(), loadCatalog().catch(() => [])]);
  const entries = collections[col.id];
  const back = backlinkIndex(byId, oneShots);

  const kinds = [...new Set(entries.map(e => e.kind).filter(Boolean))];
  const canons = Object.keys(CANON).filter(k => entries.some(e => e.canon === k));
  const pills = (group, values, labelOf) => values.length > 1
    ? `<div class="pills" data-group="${group}"><button class="pill active" data-value="">All</button>${values.map(v =>
        `<button class="pill" data-value="${v}">${labelOf(v)}<span class="count">${entries.filter(e => e[group] === v).length}</span></button>`).join('')}</div>`
    : '';

  const data = { collections, byId };
  document.getElementById('content').innerHTML = `
    <h1>${col.label}</h1>
    ${top ? top(data) : ''}
    ${entries.length ? `
    <div class="toolbar">
      <input class="search" id="search" type="search" placeholder="Search ${col.label.toLowerCase()}…" autocomplete="off">
      ${pills('kind', kinds, v => v)}
      ${pills('canon', canons, v => CANON[v].label)}
    </div>
    <div id="entries">${entries.map(e => renderEntry(e, byId, back)).join('')}</div>
    <p class="empty" id="no-match" hidden>Nothing matches.</p>`
    : `<p class="empty">No ${col.label.toLowerCase()} recorded yet. Add entries to ${col.folder ? `lore/data/${col.id}/ and list them in lore/data/${col.folder}` : `lore/data/${col.id}.yaml`}.</p>`}`;
  if (after) after(data);
  if (!entries.length) return;

  // Filtering: search text + one active pill per group
  const filter = { kind: '', canon: '' };
  const search = document.getElementById('search');
  const text = Object.fromEntries(entries.map(e => [e.id, JSON.stringify(e).toLowerCase()]));
  function apply() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll('#entries .sheet').forEach(el => {
      const ok = (!filter.kind || el.dataset.kind === filter.kind)
        && (!filter.canon || el.dataset.canon === filter.canon)
        && (!q || text[el.id].includes(q));
      el.hidden = !ok;
      if (ok) shown++;
    });
    document.getElementById('no-match').hidden = shown > 0;
  }
  search.addEventListener('input', apply);
  document.querySelectorAll('.toolbar .pills').forEach(group => group.addEventListener('click', e => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    filter[group.dataset.group] = btn.dataset.value;
    group.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p === btn));
    apply();
  }));

  // Content arrived after load, so jump to the #entry now
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

// ── Timeline: a heart-monitor trace ─────────────────────────────────────────
// The trace runs down the left. Every event kicks it out in an ECG beat, whose spike points at the
// event's card; the date sits on the line beside it. A pulse sweeps down the trace on a loop, and each
// spike tip flares as it passes.

async function initLoreTimeline() {
  const overview = await loreHeader('timeline');
  document.title = `Timeline — ${overview.title || 'Lore'}`;
  const [eras, { byId }, oneShots] = await Promise.all([fetchYaml('../data/timeline.yaml'), loadLore(), loadCatalog().catch(() => [])]);
  const shotById = Object.fromEntries(oneShots.map(s => [s.id, s]));
  const content = document.getElementById('content');
  if (!has(eras)) {
    content.innerHTML = '<h1>Timeline</h1><p class="empty">No events recorded yet. Add eras to lore/data/timeline.yaml.</p>';
    return;
  }
  // Fan-made events (canon: ours) only appear in fan-made mode, drawn red
  const fanOn = fanModeOn();
  eras.forEach(era => { era.hadEvents = has(era.events); era.events = (era.events || []).filter(ev => fanOn || ev.canon !== 'ours'); });
  const shownEras = eras.filter(era => !era.hadEvents || era.events.length);   // an era whose events are all hidden goes too
  const shotLinks = ids => asIds(ids).map(id => shotById[id]
    ? `<a class="ref fan-ref" href="${shotById[id].url}"><span class="ref-kind">One-shot</span>${shotById[id].title || id}</a>`
    : `<span class="ref missing fan-ref">${id}</span>`).join('');
  content.innerHTML = `
    <h1>Timeline</h1>
    <div class="ecg">
      <svg class="ecg-trace" aria-hidden="true"></svg>
      <div class="ecg-rows">${shownEras.map(era => `
        <div class="ecg-row ecg-era">
          <div class="ecg-date"></div>
          <div class="ecg-body"><div class="ecg-era-name">${era.era}</div>${md(era.note)}</div>
        </div>${(era.events || []).map(ev => `
        <div class="ecg-row ecg-event${ev.canon === 'ours' ? ' ecg-fan' : ''}">
          <div class="ecg-date">${ev.date || 'Undated'}</div>
          <article class="ecg-body ecg-card">
            <h3>${ev.title || ''} ${canonBadge(ev.canon)}</h3>
            ${md(ev.text)}
            ${loreLinks(ev.related, byId)}${has(ev.one_shots) ? `<div>${shotLinks(ev.one_shots)}</div>` : ''}
            ${has(ev.sources) ? `<ul class="sources">${ev.sources.map(src => `<li>${mdInline(src)}</li>`).join('')}</ul>` : ''}
          </article>
        </div>`).join('')}`).join('')}
      </div>
    </div>`;
  ecgTrace(content.querySelector('.ecg'));
}

function ecgTrace(wrap) {
  const svg = wrap.querySelector('.ecg-trace');
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let animations = [];

  function draw() {
    animations.forEach(a => a.cancel());
    animations = [];
    const W = svg.clientWidth, H = wrap.clientHeight;
    const x = W - 52;                      // the line, in the left column; the spike reaches the card
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    // The beats: one per event, at the height of its title; eras get a small square marker
    const rows = [...wrap.querySelectorAll('.ecg-row')].filter(r => r.offsetParent !== null);
    const top = wrap.getBoundingClientRect().top;
    const beats = [], marks = [];
    for (const row of rows) {
      const y = row.getBoundingClientRect().top - top + 22;
      (row.classList.contains('ecg-event') ? beats : marks).push({ y, row, fan: row.classList.contains('ecg-fan') });
    }

    // Build the trace: flat, then at each beat P wave, Q dip, R spike (towards the card), S dip, T wave
    let d = `M${x},0`, fanD = '';
    const fanRanges = [];   // [from, to] y ranges of the red stretches
    const tips = [];
    beats.forEach((b, i) => {
      const y = b.y;
      const beat = ` Q${x + 11},${y - 23} ${x},${y - 16} L${x - 8},${y - 7} L${x + 48},${y} L${x - 22},${y + 8}`
         + ` L${x},${y + 14} Q${x + 15},${y + 26} ${x},${y + 38}`;
      d += ` L${x},${y - 30}` + beat;
      if (b.fan) {
        // red from halfway after the previous beat to halfway before the next one
        const from = i ? (beats[i - 1].y + 38 + y - 30) / 2 : Math.max(0, y - 60);
        const to = i < beats.length - 1 ? (y + 38 + beats[i + 1].y - 30) / 2 : H;
        fanD += ` M${x},${from} L${x},${y - 30}` + beat + ` L${x},${to}`;
        fanRanges.push([from, to]);
      }
      tips.push({ ...b, d: `${d}` });    // the path up to just past the spike, to measure where it sits
    });
    d += ` L${x},${H}`;

    const path = cls => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); svg.appendChild(p); return p; };
    path('ecg-line');
    if (fanD) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', fanD); p.setAttribute('class', 'ecg-line-fan'); svg.appendChild(p); }
    // the pulse is drawn twice: green clipped to the normal stretches, red clipped to the fan-made ones
    const clip = (id, ranges) => {
      const c = document.createElementNS(NS, 'clipPath');
      c.setAttribute('id', id);
      c.setAttribute('clipPathUnits', 'userSpaceOnUse');
      for (const [a, b] of ranges) {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', 0); r.setAttribute('y', a); r.setAttribute('width', W); r.setAttribute('height', Math.max(0, b - a));
        c.appendChild(r);
      }
      svg.appendChild(c);
    };
    const normal = [];
    let at = 0;
    for (const [a, b] of fanRanges) { if (a > at) normal.push([at, a]); at = Math.max(at, b); }
    if (at < H) normal.push([at, H]);
    clip('ecg-clip-normal', normal);
    clip('ecg-clip-fan', fanRanges);
    const pulse = (cls, clipId) => { const p = path(cls); p.setAttribute('clip-path', `url(#${clipId})`); return p; };
    const tails = [pulse('ecg-pulse-tail', 'ecg-clip-normal')], heads = [pulse('ecg-pulse', 'ecg-clip-normal')];
    if (fanRanges.length) { tails.push(pulse('ecg-pulse-tail fan', 'ecg-clip-fan')); heads.push(pulse('ecg-pulse fan', 'ecg-clip-fan')); }
    const head = heads[0];
    const total = head.getTotalLength();
    const inFan = y => fanRanges.some(([a, b]) => y >= a && y <= b);

    for (const m of marks) {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x - 4); r.setAttribute('y', m.y - 4); r.setAttribute('width', 8); r.setAttribute('height', 8);
      r.setAttribute('class', inFan(m.y) ? 'ecg-mark fan' : 'ecg-mark');
      svg.appendChild(r);
    }

    // where along the trace each spike tip sits (0..1), to time its flash with the pulse
    const probe = document.createElementNS(NS, 'path');
    const dots = tips.map(t => {
      probe.setAttribute('d', t.d.replace(/ L[^ ]+ L[^ ]+ Q[^ ]+ [^ ]+$/, ''));   // cut back to the spike tip
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x + 48); dot.setAttribute('cy', t.y); dot.setAttribute('r', 3);
      dot.setAttribute('class', t.fan ? 'ecg-tip fan' : 'ecg-tip');
      svg.appendChild(dot);
      return { dot, at: probe.getTotalLength() };
    });

    if (reduce) { svg.classList.add('still'); return; }

    const HEAD = 26, TAIL = 220;
    const duration = Math.max(5000, total / 0.32);   // ~320 px per second
    heads.forEach(h => { h.style.strokeDasharray = `${HEAD} ${total + TAIL}`; });
    tails.forEach(t => { t.style.strokeDasharray = `${TAIL} ${total + TAIL}`; });
    const run = (el, len) => el.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: -total }],
      { duration: duration * (total + len) / total, iterations: Infinity, easing: 'linear' });
    heads.forEach(h => animations.push(run(h, HEAD)));
    tails.forEach(t => animations.push(run(t, TAIL)));

    // each spike tip flares as the pulse reaches it
    const cycle = duration * (total + HEAD) / total;
    for (const { dot, at } of dots) {
      const f = Math.min(0.995, Math.max(0.005, (at + HEAD) / (total + HEAD)));
      const flare = (props, rest) => [
        { offset: 0, ...rest }, { offset: Math.max(0, f - 0.004), ...rest }, { offset: f, ...props },
        { offset: Math.min(1, f + 0.09), ...rest }, { offset: 1, ...rest },
      ];
      animations.push(dot.animate(flare({ opacity: 1, r: 5.2 }, { opacity: 0.3, r: 3 }), { duration: cycle, iterations: Infinity }));
    }
  }

  draw();
  let pending = null;
  const observer = new ResizeObserver(() => { clearTimeout(pending); pending = setTimeout(draw, 120); });
  observer.observe(wrap);
  onPageCleanup(() => { observer.disconnect(); clearTimeout(pending); animations.forEach(a => a.cancel()); });
}
