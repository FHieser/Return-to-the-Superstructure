// shared/js/shot-map.js
// The one-shot Map page: draws data/map.yaml as a thematic SVG map (Κ-Coolant sea, facility walls,
// elevated roads, walkways, zones, shelves and rooms, structures, points of interest) and keeps
// GM tokens on it, remembered per browser.
// Depends on: shared/js/core.js.

const MAP_U = 40;   // px per grid unit in map.yaml

function smEsc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
const smPt = p => ({ x: p[0] * MAP_U, y: p[1] * MAP_U });
const smLine = pts => pts.map(p => `${p[0] * MAP_U},${p[1] * MAP_U}`).join(' ');

// ── Ground and shared defs ──────────────────────────────────────────────────

// Frost specks on the coolant: a fixed scatter (seeded), so the pattern is the same on every load
function frostSpecks(n, size) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () =>
    `<circle cx="${(rnd() * size).toFixed(1)}" cy="${(rnd() * size).toFixed(1)}" r="${(0.5 + rnd() * 1.1).toFixed(2)}" opacity="${(0.05 + rnd() * 0.2).toFixed(2)}"/>`).join('');
}

function mapDefs() {
  return `<defs>
    <pattern id="sm-coolant" width="90" height="90" patternUnits="userSpaceOnUse">
      <rect width="90" height="90" fill="#05090d"/>
      <g fill="#d7e8f2">${frostSpecks(26, 90)}</g>
    </pattern>
    <radialGradient id="sm-chill" cx="50%" cy="45%" r="65%">
      <stop offset="0" stop-color="#16303f" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#05090d" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sm-tower" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#1c1c1c"/><stop offset="1" stop-color="#090909"/>
    </radialGradient>
    <pattern id="sm-floor" width="${MAP_U}" height="${MAP_U}" patternUnits="userSpaceOnUse">
      <rect width="${MAP_U}" height="${MAP_U}" fill="#121211"/>
      <path d="M ${MAP_U} 0 L 0 0 0 ${MAP_U}" fill="none" stroke="#1b1b19" stroke-width="1"/>
    </pattern>
    <filter id="sm-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${MAP_U * 0.22}"/></filter>
  </defs>`;
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function wallSvg(points) {
  return `<g class="sm-wall"><polyline class="outer" points="${smLine(points)}"/><polyline class="inner" points="${smLine(points)}"/></g>`;
}

// Text along the longest segment of a line, turned so it never reads upside down
function lineLabel(points, text, cls, offset = 0.62, t = 0.5) {
  if (!has(text) || points.length < 2) return '';
  let best = 0, len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const l = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
    if (l > len) { len = l; best = i; }
  }
  const a = smPt(points[best]), b = smPt(points[best + 1]);
  let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  const r = ang * Math.PI / 180;
  const mx = a.x + (b.x - a.x) * t - Math.sin(r) * offset * MAP_U, my = a.y + (b.y - a.y) * t + Math.cos(r) * offset * MAP_U;
  return `<text class="${cls}" x="${mx}" y="${my}" transform="rotate(${ang} ${mx} ${my})">${smEsc(text)}</text>`;
}

// An elevated road: frost rim, edges, deck and centre markings. fade: true lets it run out into the dark.
function roadSvg(road, i, link) {
  const pts = smLine(road.points);
  let mask = '';
  if (road.fade) {
    const a = smPt(road.points[0]), b = smPt(road.points[road.points.length - 1]);
    mask = `<linearGradient id="sm-fade-${i}" gradientUnits="userSpaceOnUse" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}">
        <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
      <mask id="sm-mask-${i}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
        <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#sm-fade-${i})"/></mask>`;
  }
  return `${mask}<g class="sm-road${link ? ' link' : ''}"${road.fade ? ` mask="url(#sm-mask-${i})"` : ''}${link ? ` data-target="${smEsc(link)}" tabindex="0"` : ''}>
      <polyline class="rim" points="${pts}"/><polyline class="edge" points="${pts}"/>
      <polyline class="deck" points="${pts}"/><polyline class="mark" points="${pts}"/>
      ${lineLabel(road.points, road.label, 'sm-road-label')}
    </g>`;
}

// Zones: floor (the hall's floor), coolant (Κ-Coolant breaking in), dark | mu (darkness / Mu darkness), barnacle (Barnacles on the ceiling, red)
function zoneSvg(z, link) {
  return `<g class="sm-zone kind-${z.kind || 'floor'}${link ? ' link' : ''}"${link ? ` data-target="${smEsc(link)}" tabindex="0"` : ''}>
      <polygon points="${smLine(z.points)}"/>
    </g>`;
}

// Zone labels are drawn last, above walls and shelves
function zoneLabelSvg(z) {
  if (!has(z.label)) return '';
  const c = z.points.reduce((a, p) => [a[0] + p[0] / z.points.length, a[1] + p[1] / z.points.length], [0, 0]);
  const at = smPt(z.label_at || c);
  return `<text class="sm-zone-label kind-${z.kind || 'floor'}" x="${at.x}" y="${at.y}">${smEsc(z.label)}</text>`;
}

// A walkway (e.g. a gallery running round a hall up top): a dashed band along the points
function walkwaySvg(w, link) {
  const pts = smLine(w.points);
  return `<g class="sm-walkway${link ? ' link' : ''}"${link ? ` data-target="${smEsc(link)}" tabindex="0"` : ''}>
      <polyline class="band" points="${pts}"/><polyline class="rail" points="${pts}"/>
      ${lineLabel(w.points, w.label, 'sm-walkway-label', w.label_offset ?? 0.75, w.label_t ?? 0.5)}
    </g>`;
}

// Crane rails on the ceiling: thin steel lines, drawn above the floor
function railSvg(r, link) {
  return `<g class="sm-rail${link ? ' link' : ''}"${link ? ` data-target="${smEsc(link)}" tabindex="0"` : ''}>
      <polyline points="${smLine(r.points)}"/>${lineLabel(r.points, r.label, 'sm-rail-label', r.label_offset ?? 0.5, r.label_t ?? 0.5)}</g>`;
}

// Blocks: turned rectangles. kind: shelf | fallen (knocked-over shelf) | debris | container | room | corridor | gate | breach | door
// mu: true fills it with Mu darkness; hidden: true draws a dashed outline (a hidden room); color: fill of its region
// parts: further blocks of the same group, drawn in the same element (one tip, one highlight)
function blockSvg(b, link, color, parts = []) {
  const shape = (p, col) => {
    const c = smPt(p.at), [w, h] = p.size.map(v => v * MAP_U);
    const turn = p.angle ? ` transform="rotate(${p.angle} ${c.x} ${c.y})"` : '';
    const lc = p.label_at ? smPt(p.label_at) : c;
    const label = has(p.label) ? `<text class="sm-block-label" x="${lc.x}" y="${lc.y}">${
      String(p.label).split('\n').map((l, i, all) => `<tspan x="${lc.x}" dy="${i ? '1.15em' : `${-(all.length - 1) * 0.575}em`}">${smEsc(l)}</tspan>`).join('')}</text>` : '';
    return `<rect x="${c.x - w / 2}" y="${c.y - h / 2}" width="${w}" height="${h}"${turn}${col && !p.mu ? ` style="fill:${smEsc(col)}"` : ''}/>${label}`;
  };
  const cls = p => `sm-block kind-${p.kind || 'shelf'}${p.mu ? ' mu' : ''}${p.hidden ? ' hidden' : ''}`;
  const attrs = link ? ` data-target="${smEsc(link)}" tabindex="0"` : '';
  if (!parts.length) return `<g class="${cls(b)}${link ? ' link' : ''}"${attrs}>${shape(b, color)}</g>`;
  // A group: each part keeps its own look inside one shared element
  return `<g class="sm-block sm-group${link ? ' link' : ''}"${attrs}>
      ${[...parts, { b, color }].map(p => `<g class="${cls(p.b)}">${shape(p.b, p.color)}</g>`).join('')}</g>`;
}

// Structures: a round tower (substructure) or a rectangular block, with a plate for its name
function areaSvg(a, link) {
  const c = smPt(a.at);
  const color = a.color || '#8a8a85';
  let body;
  if ((a.shape || 'circle') === 'circle') {
    const r = (a.radius || 1) * MAP_U;
    body = `<circle class="glow" cx="${c.x}" cy="${c.y}" r="${r * 1.15}" style="fill:${color}"/>
      <circle class="body" cx="${c.x}" cy="${c.y}" r="${r}" style="stroke:${color}"/>
      ${a.inner === 'diamond'
        ? `<polygon class="ring" points="${c.x},${c.y - r * 0.82} ${c.x + r * 0.82},${c.y} ${c.x},${c.y + r * 0.82} ${c.x - r * 0.82},${c.y}" style="stroke:${color}"/>`
        : `<circle class="ring" cx="${c.x}" cy="${c.y}" r="${r * 0.72}" style="stroke:${color}"/>`}`;
  } else {
    const [w, h] = (a.size || [2, 1.4]).map(v => v * MAP_U);
    body = `<rect class="body" x="${c.x - w / 2}" y="${c.y - h / 2}" width="${w}" height="${h}" style="stroke:${color}"/>`;
  }
  const below = ((a.shape || 'circle') === 'circle' ? (a.radius || 1) : (a.size || [2, 1.4])[1] / 2) * MAP_U;
  const plateY = c.y + below + MAP_U * 0.55;
  const name = smEsc(a.name), sub = smEsc(a.sub || '');
  const pw = Math.max(name.length * 0.36, sub.length * 0.22, 1.6) * MAP_U;
  const plate = `<g class="sm-plate">
      <rect x="${c.x - pw / 2}" y="${plateY - MAP_U * 0.42}" width="${pw}" height="${MAP_U * (sub ? 1.05 : 0.84)}"/>
      <text class="name" x="${c.x}" y="${plateY}">${name}</text>
      ${sub ? `<text class="sub" x="${c.x}" y="${plateY + MAP_U * 0.42}">${sub}</text>` : ''}
    </g>`;
  return `<g class="sm-area${a.kind ? ` kind-${a.kind}` : ''}${link ? ' link' : ''}"${link ? ` data-target="${smEsc(link)}" tabindex="0"` : ''}>${body}${plate}</g>`;
}

// Point-of-interest icons, drawn around 0,0 in a 2 × 2 box
const SM_ICONS = {
  elevator: `<rect x="-1.1" y="-1.1" width="2.2" height="2.2" class="fill"/><line x1="0" y1="-1.1" x2="0" y2="1.1"/>
    <path d="M-0.55 -0.25 L-0.3 -0.6 L-0.05 -0.25 M0.05 0.25 L0.3 0.6 L0.55 0.25" class="thin"/>`,
  dead: `<circle r="1" class="fill"/><path d="M-0.5 -0.5 L0.5 0.5 M0.5 -0.5 L-0.5 0.5"/>`,
  convoy: `<rect x="-1.5" y="-0.45" width="0.8" height="0.9" rx="0.1" class="fill"/><rect x="-0.4" y="-0.45" width="0.8" height="0.9" rx="0.1" class="fill"/>
    <rect x="0.7" y="-0.45" width="0.8" height="0.9" rx="0.1" class="fill"/>`,
  stairs: `<rect x="-1" y="-1" width="2" height="2" class="fill"/><path d="M-1 0.5 H-0.4 V0 H0.2 V-0.5 H1" class="thin"/>`,
  'stairs-broken': `<rect x="-1" y="-1" width="2" height="2" class="fill"/><path d="M-1 0.5 H-0.4 V0 H-0.1 M0.3 -0.5 H1" class="thin"/>
    <path d="M-0.15 -0.45 L0.35 0.45" class="crack"/>`,
  gate: `<rect x="-1.2" y="-0.8" width="2.4" height="1.6" class="fill"/><path d="M-0.6 -0.8 V0.8 M0 -0.8 V0.8 M0.6 -0.8 V0.8" class="thin"/>`,
  crane: `<circle r="1" class="fill"/><path d="M0 -1 V0.15 M0 0.15 C0 0.75 -0.55 0.75 -0.55 0.3" class="thin"/>`,
  barnacle: `<circle r="1" class="fill"/><path d="M-0.55 -0.1 C-0.5 0.35 -0.35 0.6 -0.3 0.85 M0 0 V0.9 M0.55 -0.1 C0.5 0.35 0.35 0.6 0.3 0.85" class="thin"/>
    <path d="M-0.6 -0.25 Q0 -0.75 0.6 -0.25" class="thin"/>`,
  dot: `<circle r="0.7" class="fill"/>`,
};

function markerSvg(m, link) {
  const c = smPt(m.at), s = MAP_U * 0.36;
  const side = m.label_side === 'left' ? -1 : 1, below = m.label_side === 'below';
  const label = m.hide_label ? '' : below
    ? `<text class="sm-marker-label" x="${c.x}" y="${c.y + s * 2.4}">${smEsc(m.name)}</text>`
    : `<text class="sm-marker-label" x="${c.x + side * s * 2}" y="${c.y}" style="text-anchor:${side > 0 ? 'start' : 'end'}">${smEsc(m.name)}</text>`;
  return `<g class="sm-marker${link ? ' link' : ''}"${link ? ` data-target="${smEsc(link)}" tabindex="0"` : ''}>
      <circle class="hit" cx="${c.x}" cy="${c.y}" r="${s * 2}"/>
      <g class="icon" transform="translate(${c.x} ${c.y}) scale(${s})">${SM_ICONS[m.icon] || SM_ICONS.dot}</g>
      ${label}
    </g>`;
}

// ── The page ────────────────────────────────────────────────────────────────

// opts: { locations: [...] from locations.yaml, locationUrl(id), lore: byId from loadLore(), storeKey }
function renderShotMap(container, sections, opts) {
  const locById = Object.fromEntries((opts.locations || []).map(l => [l.id, l]));

  // Everything clickable gets a target; its key is stored on the element
  const targets = {};
  function target(item, kind) {
    const key = `${kind}:${item.id || item.name}`;
    let link = null;
    if (has(item.location) && locById[item.location]) {
      const l = locById[item.location];
      link = { title: item.name || l.name, facts: l.name, text: item.note || [].concat(l.description || [])[0] };
    } else if (has(item.lore) && (opts.lore || {})[item.lore]) {
      const e = opts.lore[item.lore];
      link = { title: item.name || e.name, facts: e.name, text: item.note || e.summary, url: loreUrl(e), go: 'Open in the lore' };
    } else if (has(item.note)) {
      link = { title: item.name, text: item.note };
    }
    if (!link) return null;
    targets[key] = link;
    return key;
  }

  const load = () => { try { return JSON.parse(localStorage.getItem(opts.storeKey)) || {}; } catch (e) { return {}; } };
  const state = { section: sections[0].id, tokens: [], ...load() };
  if (!sections.some(s => s.id === state.section)) state.section = sections[0].id;
  const save = () => { try { localStorage.setItem(opts.storeKey, JSON.stringify(state)); } catch (e) {} };

  container.insertAdjacentHTML('beforeend', `
    ${sections.length > 1 ? `<div class="pills spaced" id="sm-sections">${sections.map(s =>
      `<button class="pill" data-section="${smEsc(s.id)}">${smEsc(s.name)}</button>`).join('')}</div>` : ''}
    <div class="map-wrap sm-wrap">
      <svg class="shot-map" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="sm-controls"><button class="pill" type="button" data-act="fit">Fit</button></div>
    </div>
    <div class="map-legend sm-legend"></div>
    <div class="sm-tracker box section">
      <div class="label">GM tokens</div>
      <p class="dim">Drag the tokens to track where the players are. Each map keeps its own tokens; they are remembered in this browser.</p>
      <form class="sm-add"><input name="name" placeholder="Name" maxlength="24" autocomplete="off"><button class="pill" type="submit">Add token</button></form>
      <ul class="sm-list"></ul>
    </div>`);

  const wrap = container.querySelector('.sm-wrap');
  const svg = wrap.querySelector('svg');
  const list = container.querySelector('.sm-list');
  const legend = container.querySelector('.sm-legend');
  let sec = null, vb = null, home = null;

  // ── Drawing one section
  function bounds(s) {
    if (s.view) { const [x0, y0, x1, y1] = s.view; return { x: x0 * MAP_U, y: y0 * MAP_U, w: (x1 - x0) * MAP_U, h: (y1 - y0) * MAP_U }; }
    const pts = [...(s.walls || []).flat(), ...(s.roads || []).flatMap(r => r.points), ...(s.zones || []).flatMap(z => z.points), ...(s.rails || []).flatMap(r => r.points),
      ...(s.areas || []).map(a => a.at), ...(s.blocks || []).map(b => b.at), ...(s.markers || []).map(m => m.at)];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x: (Math.min(...xs) - 2) * MAP_U, y: (Math.min(...ys) - 2) * MAP_U, w: (Math.max(...xs) - Math.min(...xs) + 4) * MAP_U, h: (Math.max(...ys) - Math.min(...ys) + 4) * MAP_U };
  }
  // Floor and coolant lie under the shelves; darkness lies over them
  const zonesSvg = (s, pick) => (s.zones || []).map((z, i) => pick(z) ? zoneSvg(z, target({ id: `zone${i}`, ...z }, 'zone')) : '').join('');
  // Shelves and debris lie under the walls; rooms and gates sit on top of them
  // A block with a region takes that region's colour
  const regionColor = (s, b) => ((s.regions || []).find(r => r.id === b.region) || {}).color;
  // Blocks with the same group are one element: the last of the group draws all of them
  const blocksSvg = (s, pick) => (s.blocks || []).map((b, i, all) => {
    if (!pick(b)) return '';
    const group = has(b.group) ? all.filter(o => o.group === b.group) : [b];
    if (group[group.length - 1] !== b) return '';
    const parts = group.slice(0, -1).map(o => ({ b: o, color: regionColor(s, o) }));
    return blockSvg(b, target({ id: has(b.group) ? `group-${b.group}` : `block${i}`, name: b.label, ...b }, 'block'), regionColor(s, b), parts);
  }).join('');
  function draw(s) {
    sec = s;
    home = bounds(s);
    const g = { x: home.x - home.w * 2, y: home.y - home.h * 2, w: home.w * 5, h: home.h * 5 };   // ground reaches past the edges when panning
    svg.innerHTML = `${mapDefs()}
      <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="${s.ground === 'coolant' ? 'url(#sm-coolant)' : '#070707'}"/>
      ${s.ground === 'coolant' ? `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="url(#sm-chill)"/>` : ''}
      ${(s.labels || []).map(l => { const p = smPt(l.at); return `<text class="sm-ground-label" x="${p.x}" y="${p.y}" style="font-size:${(l.size || 1) * MAP_U}px"${l.rotate ? ` transform="rotate(${l.rotate} ${p.x} ${p.y})"` : ''}>${smEsc(l.text)}</text>`; }).join('')}
      ${zonesSvg(s, z => !['dark', 'mu', 'barnacle'].includes(z.kind))}
      ${blocksSvg(s, b => !['room', 'gate', 'breach', 'door'].includes(b.kind))}
      ${zonesSvg(s, z => ['dark', 'mu'].includes(z.kind))}
      ${(s.walls || []).map(wallSvg).join('')}
      ${(s.walkways || []).map((w, i) => walkwaySvg(w, target({ id: `walkway${i}`, name: w.label, ...w }, 'walkway'))).join('')}
      ${blocksSvg(s, b => ['room', 'gate', 'breach'].includes(b.kind))}
      ${zonesSvg(s, z => z.kind === 'barnacle')}
      ${blocksSvg(s, b => b.kind === 'door')}
      ${(s.rails || []).map((r, i) => railSvg(r, target({ id: `rail${i}`, name: r.label, ...r }, 'rail'))).join('')}
      ${(s.roads || []).map((r, i) => roadSvg(r, i, target(r, 'road'))).join('')}
      ${(s.areas || []).map(a => areaSvg(a, target(a, 'area'))).join('')}
      ${(s.markers || []).map(m => markerSvg(m, target(m, 'marker'))).join('')}
      ${(s.zones || []).map(zoneLabelSvg).join('')}
      <g class="sm-tokens"></g>`;
    const used = new Set((s.markers || []).map(m => m.icon || 'dot'));
    const names = { elevator: 'Elevator', dead: 'The dead', convoy: 'Convoy', stairs: 'Stairs', 'stairs-broken': 'Destroyed stairs', gate: 'Entrance', crane: 'Crane', barnacle: 'Barnacles', dot: 'Point of interest' };
    const kinds = new Set((s.blocks || []).map(b => b.kind || 'shelf'));
    const zoneKinds = new Set((s.zones || []).map(z => z.kind || 'floor'));
    legend.innerHTML = [
      ...(s.regions || []).map(r => `<span><span class="key sm-key-region" style="background:${smEsc(r.color)}"></span>${smEsc(r.name)}</span>`),
      kinds.has('shelf') ? '<span><span class="key sm-key-block kind-shelf"></span>Shelf</span>' : '',
      kinds.has('fallen') ? '<span><span class="key sm-key-block kind-fallen"></span>Knocked-over shelf</span>' : '',
      kinds.has('debris') ? '<span><span class="key sm-key-block kind-debris"></span>Debris</span>' : '',
      kinds.has('corridor') ? '<span><span class="key sm-key-block kind-corridor"></span>Hallway</span>' : '',
      kinds.has('door') ? '<span><span class="key sm-key-block kind-door"></span>Door</span>' : '',
      kinds.has('breach') ? '<span><span class="key sm-key-block kind-breach"></span>Breach</span>' : '',
      (s.blocks || []).some(b => b.hidden) ? '<span><span class="key sm-key-block hidden"></span>Hidden room</span>' : '',
      kinds.has('container') ? '<span><span class="key sm-key-block kind-container"></span>Transport container</span>' : '',
      has(s.rails) ? '<span><span class="key sm-key-rail"></span>Crane rail (ceiling)</span>' : '',
      zoneKinds.has('mu') || (s.blocks || []).some(b => b.mu) ? '<span><span class="key sm-key-mu"></span>Mu darkness</span>' : '',
      zoneKinds.has('barnacle') ? '<span><span class="key sm-key-barnacle"></span>Barnacles (ceiling)</span>' : '',
      has(s.walkways) ? '<span><span class="key sm-key-walkway"></span>Walkway (up top)</span>' : '',
      zoneKinds.has('coolant') ? '<span><span class="key sm-key-coolant"></span>Κ-Coolant</span>' : '',
      has(s.roads) ? '<span><span class="key sm-key-road"></span>Elevated road</span>' : '',
      has(s.walls) ? `<span><span class="key wall"></span>${smEsc(s.wall_label || 'Wall')}</span>` : '',
      s.ground === 'coolant' ? '<span><span class="key sm-key-coolant"></span>Κ-Coolant sea</span>' : '',
      ...[...used].map(i => `<span><svg class="sm-key-icon" viewBox="-1.6 -1.6 3.2 3.2"><g class="icon">${SM_ICONS[i] || SM_ICONS.dot}</g></svg>${names[i] || i}</span>`),
    ].join('');
    fit(); drawTokens(); drawList();
  }

  // ── View: fit, wheel zoom, drag to pan
  const setView = v => { vb = v; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); };
  const fit = () => setView({ ...home });
  const toMap = ev => { const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y }; };
  svg.addEventListener('wheel', ev => {
    ev.preventDefault();
    const p = toMap(ev), k = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
    setView({ x: p.x - (p.x - vb.x) * k, y: p.y - (p.y - vb.y) * k, w: vb.w * k, h: vb.h * k });
  }, { passive: false });

  let drag = null;
  svg.addEventListener('pointerdown', ev => {
    const tok = ev.target.closest('.sm-token');
    if (tok) {
      const t = state.tokens.find(t => t.id === tok.dataset.id), p = toMap(ev);
      drag = { kind: 'token', t, dx: t.x - p.x, dy: t.y - p.y };
    } else {
      // the clicked item is read here: once the pointer is captured, later events target the svg itself
      drag = { kind: 'pan', start: toMap(ev), sx: ev.clientX, sy: ev.clientY, moved: false, item: ev.target.closest('[data-target]') };
    }
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener('pointermove', ev => {
    if (!drag) return;
    if (drag.kind === 'token') {
      const p = toMap(ev);
      drag.t.x = p.x + drag.dx; drag.t.y = p.y + drag.dy;
      drawTokens();
      return;
    }
    if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const p = toMap(ev);
    setView({ ...vb, x: vb.x - (p.x - drag.start.x), y: vb.y - (p.y - drag.start.y) });
  });
  svg.addEventListener('pointerup', ev => {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.kind === 'token') save();
    else if (!d.moved) { if (d.item) showTip(d.item, ev); else hideTip(); }
  });
  svg.addEventListener('keydown', ev => {
    const item = ev.target.closest?.('[data-target]');
    const t = item && targets[item.dataset.target];
    if (t?.url && ev.key === 'Enter') location.href = t.url;
  });

  // ── Tips
  function hideTip() { wrap.querySelector('.map-tip')?.remove(); }
  function showTip(item, ev) {
    hideTip();
    const t = targets[item.dataset.target];
    const r = wrap.getBoundingClientRect();
    const left = Math.max(4, Math.min(ev.clientX - r.left + 12, r.width - 270));
    const top = Math.min(ev.clientY - r.top + 12, r.height - 60);
    wrap.insertAdjacentHTML('beforeend', `
      <div class="map-tip" style="left:${left}px;top:${top}px">
        <div class="tip-title">${smEsc(t.title)}</div>
        ${has(t.facts) && t.facts !== t.title ? `<div class="tip-facts"><span>${smEsc(t.facts)}</span></div>` : ''}
        ${has(t.text) ? `<p>${mdInline(t.text)}</p>` : ''}
        ${t.url ? `<a class="tip-link" href="${t.url}">${t.go}</a>` : ''}
      </div>`);
  }

  // ── Tokens (each section keeps its own)
  const tokenR = () => MAP_U * 0.42;
  function drawTokens() {
    const r = tokenR();
    svg.querySelector('.sm-tokens').innerHTML = state.tokens.filter(t => t.section === sec.id).map(t => `
      <g class="sm-token" data-id="${t.id}">
        <circle cx="${t.x}" cy="${t.y}" r="${r}"/>
        <text x="${t.x}" y="${t.y}" style="font-size:${r * 0.95}px">${smEsc(t.name.slice(0, 2).toUpperCase())}</text>
      </g>`).join('');
  }
  function drawList() {
    const mine = state.tokens.filter(t => t.section === sec.id);
    list.innerHTML = mine.length ? mine.map(t => `
      <li data-id="${t.id}"><span class="sm-name">${smEsc(t.name)}</span>
        <button class="pill" type="button" data-act="here">Bring here</button>
        <button class="pill" type="button" data-act="remove" aria-label="Remove ${smEsc(t.name)}">✕</button></li>`).join('')
      : '<li class="dim">No tokens on this map yet.</li>';
  }
  const centre = () => ({ x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 });

  container.querySelector('.sm-add').addEventListener('submit', ev => {
    ev.preventDefault();
    const input = ev.target.elements.name, name = input.value.trim();
    if (!name) return;
    const c = centre(), n = state.tokens.filter(t => t.section === sec.id).length;
    state.tokens.push({ id: `t${Date.now().toString(36)}${n}`, name, x: c.x + (n % 5) * tokenR() * 2.4, y: c.y, section: sec.id });
    input.value = '';
    save(); drawTokens(); drawList();
  });
  list.addEventListener('click', ev => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    if (btn.dataset.act === 'remove') state.tokens = state.tokens.filter(t => t.id !== id);
    if (btn.dataset.act === 'here') Object.assign(state.tokens.find(t => t.id === id), centre());
    save(); drawTokens(); drawList();
  });
  wrap.querySelector('[data-act="fit"]').addEventListener('click', fit);

  // ── Sections
  function showSection(id) {
    state.section = id;
    save();
    container.querySelectorAll('#sm-sections .pill').forEach(p => p.classList.toggle('active', p.dataset.section === id));
    hideTip();
    draw(sections.find(s => s.id === id));
  }
  container.querySelector('#sm-sections')?.addEventListener('click', ev => {
    const btn = ev.target.closest('.pill');
    if (btn) showSection(btn.dataset.section);
  });
  showSection(state.section);
}
