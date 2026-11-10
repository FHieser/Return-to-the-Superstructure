// expedition/webapp/js/expedition.js
// The Expedition pages: the overview of the one-shots (index.html: one big card per one-shot, each with its own
// visual cue, plus cards for the subpages), the North Base (north-base.html) and the items (items.html).
// Reads expedition/data/*.yaml, one-shots/catalog.yaml and lore/data/objects.yaml.
// Depends on: shared/js/core.js, jsyaml (CDN), marked (CDN).

const EXPEDITION_NAV = [
  { id: 'overview',   label: 'Overview',   href: './' },
  { id: 'north-base', label: 'North Base', href: './north-base.html' },
  { id: 'items',      label: 'Items',      href: './items.html' },
];

async function expeditionHeader(active, pageTitle) {
  const x = (await fetchYaml('../data/expedition.yaml')) || {};
  const title = x.title || 'The Expedition';
  renderHeader({ title, nav: EXPEDITION_NAV, active });
  document.title = pageTitle ? `${pageTitle} — ${title}` : `${title} — Return to the Superstructure`;
  return x;
}

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Recurring entries (NPCs, places, items) ─────────────────────────────────

// "Appears in": links to the one-shots an entry shows up in
function appearsIn(folders, shotById) {
  return has(folders)
    ? `<div>${folders.map(f => `<a class="ref" href="${ROOT}one-shots/${f}/webapp/"><span class="ref-kind">One-shot</span>${shotById[f]?.title || f}</a>`).join('')}</div>`
    : '';
}

// One recurring entry. head: { name, badges }; body: the HTML between the head and "Appears in".
function rosterSheet(e, head, body, shotById) {
  return `
    <article class="sheet" id="${e.id}">
      <div class="sheet-head"><h2>${head.name}</h2><div class="badges">${head.badges || ''}</div></div>
      ${body}
      ${has(e.gm) ? `<div class="box gm section"><div class="label">GM only</div>${md(e.gm)}</div>` : ''}
      ${field('Appears in', appearsIn(e.one_shots, shotById))}
      ${openBox(e.open)}
    </article>`;
}

function roster(entries, render, what, file) {
  return has(entries)
    ? `<div class="roster">${entries.map(render).join('')}</div>`
    : `<p class="empty">No ${what} yet. Add them to expedition/data/${file}.</p>`;
}

// Jump to #holly etc. once the content is in the page
function scrollToHash() {
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

// ── One-shot covers ─────────────────────────────────────────────────────────
// Each one-shot's card look, chosen by `cover` in its data/overview.yaml.
// html: the layers behind the card's text; start(card): starts its animation, returns a function that stops it.

// The corridor's cross-section at depth z (0 = the near frame, 6 = the end wall), in the 800×400 drawing.
// Everything nearer than z lies outside this rectangle, so a black rectangle here hides exactly what is beyond z.
const CORRIDOR_END = 6;
function corridorAt(z) {
  const d = z / (z + 1);
  return { l: 400 * d, r: 800 - 400 * d, t: 190 * d, b: 400 - 210 * d };
}

// A retro lab corridor in one-point perspective, as seen from the doorway of Maroon's labs
function corridorSvg() {
  const at = corridorAt;
  const y = (z, f) => { const a = at(z); return a.b - (a.b - a.t) * f; };   // height f (0 floor … 1 ceiling) on a wall at depth z
  const far = at(CORRIDOR_END), RAIL = 0.42, mirror = pts => pts.map(([x, yy]) => [800 - x, yy]);
  const poly = (pts, attrs) => `<polygon points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" ${attrs}/>`;
  const wallUpper = [[0, 0], [far.l, far.t], [far.l, y(6, RAIL)], [0, y(0, RAIL)]];
  const wallLower = [[0, y(0, RAIL)], [far.l, y(6, RAIL)], [far.l, far.b], [0, 400]];
  // a door on the left (side -1) or right (side 1) wall between depths z1 and z2
  const door = (side, z1, z2, lit) => {
    const x = z => side < 0 ? at(z).l : at(z).r;
    const pts = [[x(z1), y(z1, 0.72)], [x(z2), y(z2, 0.72)], [x(z2), at(z2).b], [x(z1), at(z1).b]];
    return poly(pts, 'fill="#141211" stroke="#4d4743" stroke-width="1.5"')
      + (lit ? `<line x1="${x(z1)}" y1="${at(z1).b - 1}" x2="${x(z2)}" y2="${at(z2).b - 1}" stroke="rgba(240,232,210,0.55)" stroke-width="2"/>` : '');
  };
  const light = z => {
    const a = at(z), b = at(z + 0.22 * (1 + z * 0.35));
    const pts = [[400 - (400 - a.l) * 0.22, a.t], [400 + (a.r - 400) * 0.22, a.t], [400 + (b.r - 400) * 0.22, b.t], [400 - (400 - b.l) * 0.22, b.t]];
    return poly(pts, 'fill="#f4f1e6" filter="url(#cor-glow)"') + poly(pts, 'fill="#fbfaf4"');
  };
  const depths = [0.2, 0.45, 0.75, 1.1, 1.55, 2.1, 2.8, 3.7, 4.8];
  return `
    <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="cor-glow" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="9"/></filter>
        <filter id="cor-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.5"/></filter>
        <filter id="cor-halo" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12"/></filter>
        <radialGradient id="cor-fog" cx="400" cy="190" r="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#000" stop-opacity="0.92"/><stop offset="0.45" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="cor-vignette" cx="400" cy="200" r="520" gradientUnits="userSpaceOnUse">
          <stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/>
        </radialGradient>
        <clipPath id="cor-floor"><polygon points="0,400 800,400 ${far.r},${far.b} ${far.l},${far.b}"/></clipPath>
      </defs>
      <rect width="800" height="400" fill="#0a0909"/>
      ${poly([[0, 0], [800, 0], [far.r, far.t], [far.l, far.t]], 'fill="#272524"')}
      ${poly([[0, 400], [800, 400], [far.r, far.b], [far.l, far.b]], 'fill="#22201e"')}
      <g clip-path="url(#cor-floor)" stroke="rgba(0,0,0,0.5)" stroke-width="1.5">
        ${[-1200, -900, -600, -300, 0, 300, 600, 900, 1200, 1500, 1800, 2100].map(x => `<line x1="400" y1="190" x2="${x}" y2="400"/>`).join('')}
        ${depths.map(z => `<line x1="${at(z).l}" y1="${at(z).b}" x2="${at(z).r}" y2="${at(z).b}"/>`).join('')}
      </g>
      ${poly(wallUpper, 'fill="#46403b"')}${poly(mirror(wallUpper), 'fill="#433d39"')}
      ${poly(wallLower, 'fill="#2c2826"')}${poly(mirror(wallLower), 'fill="#2a2725"')}
      <g stroke="rgba(0,0,0,0.28)" stroke-width="1">
        ${depths.flatMap(z => [0.25, 0.5, 0.75].map(k => z + k * 0.3)).map(z =>
          `<line x1="${at(z).l}" y1="${at(z).t}" x2="${at(z).l}" y2="${y(z, RAIL)}"/><line x1="${at(z).r}" y1="${at(z).t}" x2="${at(z).r}" y2="${y(z, RAIL)}"/>`).join('')}
      </g>
      <path d="M0 ${y(0, RAIL)} L${far.l} ${y(6, RAIL)} M800 ${y(0, RAIL)} L${far.r} ${y(6, RAIL)}" stroke="#5c554f" stroke-width="3"/>
      <path d="M22 40 l38 6 l-4 52 l-12 -9 l-9 18 l-6 -22 z" fill="#5a534c" opacity="0.7"/>
      <path d="M752 70 l26 -4 l2 60 l-10 -12 l-14 10 z" fill="#57514b" opacity="0.6"/>
      ${door(-1, 0.9, 1.35)}${door(1, 1.8, 2.3, true)}${door(-1, 3.2, 3.7)}${door(1, 4.3, 4.7)}
      <rect x="${far.l}" y="${far.t}" width="${far.r - far.l}" height="${far.b - far.t}" fill="#1d1b1a"/>
      <rect x="389" y="186" width="22" height="${far.b - 186}" fill="#000"/>
      <g class="cor-lights">${[0.35, 1.2, 2.4, 4].map(light).join('')}</g>
      <rect width="800" height="400" fill="url(#cor-fog)"/>
      <rect width="800" height="400" fill="url(#cor-vignette)"/>
      <rect class="cor-dim" width="800" height="400" fill="#000" opacity="0"/>
      <rect class="cor-dark-halo" fill="#000" opacity="0.6" filter="url(#cor-halo)"/>
      <rect class="cor-dark" fill="#000" filter="url(#cor-soft)"/>
    </svg>`;
}

// The eye that opens in the darkness: the sprayed eye of the janitor's closet mural, in white
const COVER_EYE = `
  <svg class="cover-eye" viewBox="0 0 120 60" aria-hidden="true"><g class="cover-lids">
    <path d="M6 30 Q60 -6 114 30 Q60 66 6 30 Z" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"/>
    <circle class="cover-pupil" cx="60" cy="30" r="10" fill="currentColor"/>
  </g></svg>`;

// Mu darkness at the end of the corridor, creeping closer. Each hover makes the lights flicker, and in the last
// blackout the darkness comes one step nearer; it never draws back until the page is loaded again. Once it is right at
// the front, the card is black and a white eye opens; it stays open and follows the cursor.
const DARK_STEPS = [CORRIDOR_END, 2.6, 0.9, -0.11];   // depth of the darkness after each hover; the last covers the whole card

function darknessCreep(card) {
  const dark = card.querySelector('.cor-dark'), halo = card.querySelector('.cor-dark-halo'), dim = card.querySelector('.cor-dim');
  const lights = card.querySelector('.cor-lights'), eye = card.querySelector('.cover-eye'), pupil = card.querySelector('.cover-pupil');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const last = DARK_STEPS.length - 1;
  let step = 0, z = DARK_STEPS[0], busy = false, raf = 0, timers = [];

  const setRect = (el, depth) => {
    const a = corridorAt(depth);
    el.setAttribute('x', a.l); el.setAttribute('y', a.t);
    el.setAttribute('width', a.r - a.l); el.setAttribute('height', a.b - a.t);
  };
  const draw = () => { setRect(dark, z); setRect(halo, z - 0.08); };
  const eyeState = () => card.classList.toggle('eye-open', !busy && step === last);
  // lights: 1 on … 0 off; the rest of the corridor dims with them
  const lightsTo = level => { lights.style.opacity = level; dim.setAttribute('opacity', ((1 - level) * 0.8).toFixed(2)); };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  // Move the darkness to depth `to` in `ms`
  function moveTo(to, ms) {
    const from = z, t0 = performance.now();
    cancelAnimationFrame(raf);
    const frame = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      z = from + (to - from) * (t * t * (3 - 2 * t));
      draw();
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function creep() {
    step++;
    if (still) { z = DARK_STEPS[step]; draw(); eyeState(); return; }
    busy = true;
    // [lights level, ms]: a stutter, then the blackout in which the darkness comes nearer, then the lights come back
    const flicker = [[0.12, 60], [1, 80], [0.3, 45], [0.04, 70], [1, 160], [0.08, 50], [1, 70]];
    let t = 0;
    for (const [level, ms] of flicker) { later(() => lightsTo(level), t); t += ms; }
    later(() => { lightsTo(0); moveTo(DARK_STEPS[step], 380); }, t);
    later(() => lightsTo(1), t + 430);
    later(() => { busy = false; eyeState(); }, t + 500);
  }

  const onEnter = () => { if (!busy && step < last) creep(); };
  // The pupil looks towards the cursor, like the mural's
  const follow = e => {
    if (!card.classList.contains('eye-open')) return;
    const r = eye.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy) || 1, reach = Math.min(1, dist / (r.width * 1.5));
    pupil.setAttribute('transform', `translate(${(dx / dist * reach * 30).toFixed(1)} ${(dy / dist * reach * 9).toFixed(1)})`);
  };
  card.addEventListener('mouseenter', onEnter);
  window.addEventListener('pointermove', follow);
  draw();
  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    card.removeEventListener('mouseenter', onEnter);
    window.removeEventListener('pointermove', follow);
  };
}

const SHOT_COVERS = {
  darkness: { html: () => `<span class="cover-bg">${corridorSvg()}</span>${COVER_EYE}`, start: darknessCreep },
};

function shotCover(s) {
  const cover = SHOT_COVERS[s.cover];
  return `
    <a class="shot-cover${cover ? ` cover-${s.cover}` : ''}" href="${s.url}">
      ${cover ? cover.html() : ''}
      <span class="cover-text">
        <span class="badges">${has(s.status) ? `<span class="badge${s.status === 'complete' ? ' solid' : ''}">${s.status}</span>` : ''}${(s.tags || []).map(t => `<span class="badge">${t}</span>`).join('')}</span>
        <span class="cover-title">${s.title || s.id}</span>
        ${has(s.tagline) ? `<span class="cover-tagline">${mdInline(s.tagline)}</span>` : ''}
        <span class="card-meta">
          ${has(s.players) ? `<span>${s.players} players</span>` : ''}
          ${has(s.duration) ? `<span>${s.duration}</span>` : ''}
          ${has(s.when) ? `<span>${s.when}</span>` : ''}
        </span>
      </span>
    </a>`;
}

// ── North Base symbol ───────────────────────────────────────────────────────
// The view from the forecourt of the North Entry, south into the cavity: the forecourt is a concrete chamber whose
// walls, ceiling and floor frame the picture, with the railing and a lamp at its open end. Beyond it, under the
// Superstructure's ceiling (concrete panels in perspective, shrinking into the distance), the first rows of
// substructures from the cavity map (lore/data/map.yaml) stand as giant pillars in thick brown fog; everything further
// back, walls included, is lost in it. Looking south, the map's west is on the right: from there, out of sight, Rho's
// substructure (SB07) casts a red glow; on the left, now and then, blue lightning from SB13 lights up a station further back,
// and very rarely a small bolt arcs along the ceiling far back on the right.
// map: the parsed cavity map.
// Used on the North Base card of the overview and as the banner of the North Base page.

function northBaseSvg(map) {
  const W = 800, H = 440, CX = 400, CY = 235, F = 380;   // drawing size, horizon, focal length (about 80° across the opening)
  const CAM = [3, -1.55];                                // at the back of the forecourt, behind the North Entry (row -1), looking towards growing rows
  const SPREAD = 1.8;                                    // the map's distances, stretched: the cavern is vast
  const FLOOR = -4.5, CEIL = 0.8, RADIUS = 0.25;         // how far the pillars reach down into the pit, the ceiling (eye = 0), pillar radius (0.14 grid steps, as in the user's sketch, × SPREAD)
  const ROWS = 4;                                        // rows of pillars drawn; the rest is lost in the fog
  const OPEN = { l: 80, r: 720, t: 40, b: 392 };         // the forecourt's open end, where it looks out into the cavern
  const FOG = '#2f2420';                                 // the colour everything fades into
  const subs = ((map && map.substructures) || []).filter(e => !e.size);
  const spread = ([c, r]) => [CAM[0] + (c - CAM[0]) * SPREAD, CAM[1] + (r - CAM[1]) * SPREAD];
  const sx = (c, z) => CX - F * (c - CAM[0]) / z;        // looking south: the map's east (growing columns) is on the left
  const sy = (Y, z) => CY - F * Y / z;
  const haze = z => z < 2.8 ? 0 : Math.min(0.94, 1 - Math.exp(-(z - 2.8) / 3.8));   // how much of a thing at depth z the fog swallows
  const ceilHaze = z => Math.min(0.97, Math.max(0, (z - 1.6) / 6.5));  // the ceiling is lit from below and shows a little further
  const pts = list => list.map(q => q.map(n => n.toFixed(1)).join(',')).join(' ');
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // The Superstructure's ceiling: concrete panels, each a slightly different shade, every other row shifted by half a
  // panel (so no seam runs straight into the distance), narrow dark joints between them and stains here and there. Rows of equal size in the world
  // get thinner and the panels smaller towards the horizon, until the fog takes them.
  const PANEL = 0.55;
  const zStart = F * CEIL / (CY - OPEN.t);   // the nearest ceiling seen through the forecourt's opening
  let ceiling = '';
  for (let z = zStart, row = 0; z < 9; z += PANEL, row++) {
    const half = (CX - OPEN.l + 40) * (z + PANEL) / F;   // as far left and right as can be seen at this depth
    const shift = row % 2 ? PANEL / 2 : 0;
    // a stretch of this row, u across and v along it, in world units
    const quad = (u0, u1, v0, v1) => [[u0, z + v0], [u1, z + v0], [u1, z + v1], [u0, z + v1]].map(([x, d]) => [sx(CAM[0] + x, d), sy(CEIL, d)]);
    ceiling += `<polygon points="${pts(quad(-half - PANEL, half + PANEL, 0, PANEL + 0.01))}" fill="#0d0a09"/>`;   // the joints show through
    for (let c = Math.floor(-half / PANEL) * PANEL - shift; c < half; c += PANEL) {
      const shade = 24 + Math.floor(rand() * 16), gap = PANEL * 0.05;
      ceiling += `<polygon points="${pts(quad(c + gap, c + PANEL - gap, gap, PANEL - gap))}" fill="rgb(${shade + 7},${shade},${shade - 4})"/>`;
      if (rand() < 0.3) {
        const u = c + rand() * PANEL * 0.6, v = rand() * PANEL * 0.6, size = PANEL * (0.15 + rand() * 0.25);
        ceiling += `<polygon points="${pts(quad(u, u + size, v, v + size * 0.7))}" fill="#0f0b0a" opacity="0.45"/>`;
      }
    }
    // the fog over this row of panels
    const y0 = sy(CEIL, z), y1 = sy(CEIL, z + PANEL);
    ceiling += `<rect x="0" y="${y0.toFixed(1)}" width="${W}" height="${(y1 - y0 + 0.6).toFixed(1)}" fill="${FOG}" opacity="${ceilHaze(z + PANEL / 2).toFixed(2)}"/>`;
  }

  // the pillars: the first rows in front of the North Entry, drawn far to near
  const rows = [...new Set(subs.map(e => e.at[1]))].sort((a, b) => a - b).slice(0, ROWS);
  const items = [], placed = {};   // placed: where each pillar is in the picture, for the lights
  for (const e of subs.filter(e => rows.includes(e.at[1]))) {
    const [c, r] = spread(e.at), z = r - CAM[1];
    // the pillar's outline: the two sight lines that just touch it (off to the side it shows wider than straight ahead)
    const x = CAM[0] - c, th = Math.atan2(x, z), a = Math.asin(RADIUS / Math.hypot(x, z));
    const l = CX + F * Math.tan(th - a), rt = CX + F * Math.tan(th + a);
    const top = sy(CEIL, z), bottom = sy(FLOOR, z), w = rt - l, h = haze(z).toFixed(2);
    placed[e.id] = { l, rt, top, bottom, z };
    if (rt < -40 || l > W + 40) continue;
    let svg = `<rect x="${l}" y="${top}" width="${w}" height="${bottom - top}" fill="#130f0e"/>
      <rect x="${l}" y="${top}" width="${w}" height="${bottom - top}" fill="url(#nx-round)"/>`;
    for (let Y = -2.6; Y < CEIL; Y += 0.5) svg += `<rect x="${l}" y="${sy(Y, z)}" width="${w}" height="${Math.max(0.6, 4 / z)}" fill="#000" opacity="0.4"/>`;
    svg += `<rect x="${l - 1}" y="${top}" width="${w + 2}" height="${bottom - top}" fill="${FOG}" opacity="${h}"/>`;
    items.push({ z, svg });
  }
  items.sort((a, b) => b.z - a.z);

  // Rho's red glow from the right: its source, SB07, stays behind the forecourt's right wall
  const rho = placed.sb07;
  const rhoX = Math.max(OPEN.r + 30, rho ? (rho.l + rho.rt) / 2 : W), rhoY = rho ? sy(-0.6, rho.z) : CY + 40;
  // at Rho's depth, so the near pillar on the right stands dark in front of it instead of being lit
  items.push({ z: rho ? rho.z - 0.01 : 4, svg: `<ellipse class="nx-rho" cx="${rhoX}" cy="${rhoY}" rx="330" ry="230" fill="url(#nx-rho)"/>` });
  // Blue lightning: a jagged bolt from a to b with a branch, lighting up the pillar it hits for a moment. It sits at
  // depth z, so the nearer pillars stand in front of it; cls sets its timing (style.css).
  const bolt = (p, q, n, jag) => {
    let d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;
    for (let k = 1; k < n; k++) {
      const t = k / n, off = (rand() - 0.5) * jag;
      d += ` L${(p[0] + (q[0] - p[0]) * t + nx * off).toFixed(1)} ${(p[1] + (q[1] - p[1]) * t + ny * off).toFixed(1)}`;
    }
    return d + ` L${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  };
  // path: the points the bolt runs through, each stretch [point, segments, jag]; it ends at the last point.
  // size scales its strokes and glow (smaller far away).
  const strike = (cls, path, to, z, fork, size = 1) => {
    let main = '';
    for (let k = 0; k < path.length - 1; k++) main += bolt(path[k][0], path[k + 1][0], path[k][1], path[k][2]).replace(/^M/, k ? ' L' : 'M');
    const a = path[path.length - 2][0], b = path[path.length - 1][0];
    const mid = [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45];
    const branch = bolt(mid, [mid[0] + fork[0], mid[1] + fork[1]], 5, 12);
    items.push({ z, svg: `<g class="${cls}">
      <rect width="${W}" height="${H}" fill="#6fa8ff" opacity="${(0.05 * size).toFixed(3)}"/>
      <circle cx="${b[0]}" cy="${b[1]}" r="${120 * size}" fill="url(#nx-blue)"/>
      <g filter="url(#nx-soft)">
        <rect x="${to.l}" y="${to.top}" width="${to.rt - to.l}" height="${to.bottom - to.top}" fill="#8fbcff" opacity="0.13"/>
        <rect x="${to.rt - (to.rt - to.l) * 0.35}" y="${to.top}" width="${(to.rt - to.l) * 0.35}" height="${to.bottom - to.top}" fill="#cfe2ff" opacity="0.12"/>
      </g>
      <path d="${main} ${branch}" stroke="#5b9dff" stroke-width="${6 * size}" fill="none" opacity="0.5" filter="url(#nx-soft)"/>
      <path d="${main} ${branch}" stroke="#e8f2ff" stroke-width="${Math.max(0.7, 1.4 * size)}" fill="none" stroke-linejoin="bevel"/>
    </g>` });
  };
  // Every few seconds: from SB13 (behind the near pillar on the left) to SB05, a station further back that the near
  // pillars leave in view
  const from = placed.sb13, to = placed.sb05;
  if (from && to) strike('nx-strike', [[[Math.min(from.rt, OPEN.l + 8) + 4, sy(0.1, from.z)], 10, 22], [[(to.l + to.rt) / 2, sy(-0.4, to.z)]]], to, (from.z + to.z) / 2, [26, 38]);
  // Very rarely, far back on the right of the centre pillar: along the ceiling, then down into SB08, a station in the fourth row that the
  // nearer pillars leave in view
  const far = placed.sb08;
  if (far) {
    const cx = (far.l + far.rt) / 2, ceil = sy(CEIL, far.z - 0.15) + 1, k = 4.6 / far.z;   // k: its size against the centre pillar's depth
    strike('nx-strike-rare', [[[cx - 190 * k, ceil + 1], 10, 7 * k], [[far.l - 1, ceil + 2], 3, 6 * k], [[cx - 1, sy(0.1, far.z)]]],
      far, far.z - 0.01, [26 * k, 30 * k], k);   // runs in from the left: on its right the near pillar would hide it
  }
  items.sort((p, q) => q.z - p.z);

  // a lattice mast standing in the forecourt: two rails with cross braces
  const mast = (x, top, bottom, w) => {
    let d = `M${x} ${bottom}V${top}M${x + w} ${bottom}V${top}`;
    for (let y = bottom; y > top + w; y -= w * 1.4) d += `M${x} ${y}L${x + w} ${y - w * 1.4}M${x + w} ${y}L${x} ${y - w * 1.4}M${x} ${y}H${x + w}`;
    return `<path d="${d}" stroke="#0e0b0a" stroke-width="2.2" fill="none"/>`;
  };
  // a shipping container: ribbed steel, a lighter top edge
  const container = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#nx-ribs)"/>
    <rect x="${x}" y="${y}" width="${w}" height="2" fill="#2c2420"/><rect x="${x}" y="${y + h - 3}" width="${w}" height="3" fill="#070505"/>`;
  const O = OPEN;

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="nx-sky" cx="${CX}" cy="${CY + 20}" r="${W * 0.6}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${FOG}"/><stop offset="0.55" stop-color="#241b18"/><stop offset="1" stop-color="#0d0a09"/>
        </radialGradient>
        <linearGradient id="nx-round" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="0.4" stop-color="#3a2a24" stop-opacity="0.25"/>
          <stop offset="0.7" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/>
        </linearGradient>
        <linearGradient id="nx-fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${FOG}" stop-opacity="0"/><stop offset="0.4" stop-color="${FOG}" stop-opacity="0.3"/>
          <stop offset="0.62" stop-color="${FOG}" stop-opacity="0.4"/><stop offset="1" stop-color="#1c1513" stop-opacity="0.95"/>
        </linearGradient>
        <linearGradient id="nx-wall-l" x1="0" y1="0" x2="${O.l}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#090706"/><stop offset="1" stop-color="#1b1513"/>
        </linearGradient>
        <linearGradient id="nx-wall-r" x1="${W}" y1="0" x2="${O.r}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#090706"/><stop offset="1" stop-color="#1b1513"/>
        </linearGradient>
        <linearGradient id="nx-roof" x1="0" y1="0" x2="0" y2="${O.t}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#070505"/><stop offset="1" stop-color="#15100e"/>
        </linearGradient>
        <radialGradient id="nx-rho"><stop offset="0" stop-color="#d0281c" stop-opacity="0.55"/><stop offset="0.45" stop-color="#a81e16" stop-opacity="0.2"/><stop offset="1" stop-color="#a81e16" stop-opacity="0"/></radialGradient>
        <linearGradient id="nx-rho-wall" x1="${O.r}" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#c8261b" stop-opacity="0.16"/><stop offset="0.5" stop-color="#c8261b" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="nx-blue"><stop offset="0" stop-color="#7fb2ff" stop-opacity="0.55"/><stop offset="1" stop-color="#7fb2ff" stop-opacity="0"/></radialGradient>
        <pattern id="nx-ribs" width="8" height="10" patternUnits="userSpaceOnUse"><rect width="2.5" height="10" fill="#000" opacity="0.4"/><rect x="2.5" width="1" height="10" fill="#3a302a" opacity="0.25"/></pattern>
        <radialGradient id="nx-green"><stop offset="0" stop-color="#5dff92" stop-opacity="0.3"/><stop offset="1" stop-color="#5dff92" stop-opacity="0"/></radialGradient>
        <filter id="nx-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
        <radialGradient id="nx-lamp"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0.45"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
        <radialGradient id="nx-vignette" cx="${W / 2}" cy="${H / 2}" r="${W * 0.6}" gradientUnits="userSpaceOnUse">
          <stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.8"/>
        </radialGradient>
        <filter id="nx-grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"/></filter>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#nx-sky)"/>
      ${ceiling}
      ${items.map(it => it.svg).join('')}
      <rect width="${W}" height="${H}" fill="url(#nx-fog)"/>
      <!-- the forecourt of the North Entry: its walls, ceiling and floor around the open end -->
      <polygon points="0,0 ${O.l},${O.t} ${O.l},${O.b} 0,${H}" fill="url(#nx-wall-l)"/>
      <polygon points="${W},0 ${O.r},${O.t} ${O.r},${O.b} ${W},${H}" fill="url(#nx-wall-r)"/>
      <polygon class="nx-rho" points="${W},0 ${O.r},${O.t} ${O.r},${O.b} ${W},${H}" fill="url(#nx-rho-wall)"/>
      <polygon points="0,0 ${W},0 ${O.r},${O.t} ${O.l},${O.t}" fill="url(#nx-roof)"/>
      <polygon points="0,${H} ${O.l},${O.b} ${O.r},${O.b} ${W},${H}" fill="#0d0a09"/>
      <ellipse cx="300" cy="${O.b + 14}" rx="150" ry="22" fill="url(#nx-lamp)" opacity="0.7"/>
      <g stroke="#1d1715" stroke-width="2"><path d="M${O.l} ${O.b - 24} H${O.r}"/>${[110, 190, 270, 350, 430, 510, 590, 670].map(x => `<path d="M${x} ${O.b - 24} V${O.b}"/>`).join('')}</g>
      <!-- containers stacked on the right, behind the crates with the terminal -->
      ${container(604, 296, 112, 46, '#130f0d')}
      ${container(470, 330, 120, 64, '#15100e')}
      ${container(578, 342, 156, 64, '#16110f')}
      ${mast(640, 140, O.b + 8, 14)}
      ${container(686, 376, 108, 64, '#120e0c')}
      <path d="M250 ${O.b + 18} V300 Q250 284 270 284 H300" stroke="#0e0b0a" stroke-width="3" fill="none"/>
      <rect x="292" y="282" width="18" height="5" fill="#0e0b0a"/>
      <g class="nb-flicker"><circle cx="301" cy="290" r="26" fill="url(#nx-lamp)"/><circle cx="301" cy="288" r="2.2" fill="#fff0d0"/></g>
      <g fill="#0f0c0b"><rect x="520" y="${O.b - 10}" width="40" height="30"/><rect x="560" y="${O.b - 20}" width="30" height="40"/><rect x="530" y="${O.b - 30}" width="24" height="20"/></g>
      <!-- a small terminal on the crates, its green screen lighting them up -->
      <g class="nx-screen">
        <ellipse cx="542" cy="${O.b - 34}" rx="80" ry="46" fill="url(#nx-green)"/>
        <rect x="531" y="${O.b - 30}" width="24" height="3" fill="#7dffa8" opacity="0.18"/>
      </g>
      <rect x="532" y="${O.b - 47}" width="21" height="16" fill="#0b0908"/>
      <rect class="nx-screen" x="534.5" y="${O.b - 45}" width="16" height="11" fill="#6dff9e"/>
      <g fill="#0f3b1e" opacity="0.7"><rect x="536" y="${O.b - 43}" width="9" height="1.4"/><rect x="536" y="${O.b - 40}" width="12" height="1.4"/><rect x="536" y="${O.b - 37}" width="6" height="1.4"/></g>
      <rect width="${W}" height="${H}" filter="url(#nx-grain)" opacity="0.35"/>
      <rect width="${W}" height="${H}" fill="url(#nx-vignette)"/>
    </svg>`;
}

// ── Items symbol ────────────────────────────────────────────────────────────
// A workshop table seen from above. Along its back edge stand the machines and tools in a row: a tool tray, the
// oscilloscope (its screen faces the worker, so only its green light is seen, pulsing on the work area), the soldering
// station with its iron, a bench power supply and a parts cabinet. Below is the working area with the Mu flashlight, its
// probe still attached, and a few loose tools. On hover the flashlight clicks on, and everything in front of its lens
// turns pitch black (Mu light: what it hits cannot be seen; style.css .mu-beam).
// Used on the Items card of the overview and as the banner of the Items page.

function itemsSvg() {
  const W = 800, H = 440, BACK = 152, ROW = 34;             // drawing size; depth of the strip along the back edge; where its row starts (the banner crops the edges)
  const LENS = [372, 286], ANGLE = -5;                       // where the flashlight's lens is, and where it points (degrees)
  let seed = 23;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const at = (x, y, deg, body) => `<g transform="translate(${x} ${y}) rotate(${deg})">${body}</g>`;
  const shadow = 'filter="url(#it-shadow)"';
  const knob = (x, y, r = 8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#151715"/><circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="#4e524c"/><rect x="${x - 0.8}" y="${y - r * 0.75}" width="1.6" height="${r * 0.6}" fill="#bdb9b1"/>`;
  const vents = (x, y, w, n) => Array.from({ length: n }, (_, k) => `<rect x="${x}" y="${y + k * 6}" width="${w}" height="2.5" rx="1" fill="#000" opacity="0.45"/>`).join('');

  // ── the back row, left to right; each drawn from its own top-left corner
  // a tray of tools lying side by side, handles to the back
  const trayTools = [['#6d3c22', 70], ['#2f4a5a', 60], ['#5a5a2a', 76], ['#4a2a2a', 54], ['#77736d', 72], ['#8a8780', 58], ['#6d3c22', 64], ['#2f4a5a', 50]];
  const tray = `<g ${shadow}><rect width="136" height="104" rx="3" fill="#3b3326"/></g><rect x="4" y="4" width="128" height="96" fill="#2c261d"/>
    ${trayTools.map(([color, len], k) => { const x = 14 + k * 15.5; return k === 4
      ? `<g ${shadow}><rect x="${x - 4}" y="10" width="8" height="${len}" fill="${color}"/>${Array.from({ length: 9 }, (_, n) => `<rect x="${x - 4}" y="${14 + n * 7}" width="8" height="1" fill="#3a3632"/>`).join('')}</g>`
      : k === 5 ? `<path d="M${x - 2} 10 L${x - 1} ${10 + len} M${x + 2} 10 L${x + 1} ${10 + len}" stroke="${color}" stroke-width="2.5" ${shadow}/>`
      : `<g ${shadow}><rect x="${x - 5}" y="10" width="10" height="30" rx="4" fill="${color}"/><rect x="${x - 1.6}" y="40" width="3.2" height="${len - 30}" fill="#9d9890"/></g>`; }).join('')}`;
  // the oscilloscope from above: its casing, vents and carry handle; the screen is on the side facing the work area
  const scope = `<g ${shadow}><rect width="176" height="112" rx="6" fill="#2a2d2a"/></g>
    ${vents(22, 20, 132, 8)}
    <rect x="58" y="-4" width="60" height="10" rx="4" fill="#1a1c1a" stroke="#3d413c" stroke-width="2"/>
    <rect x="0" y="104" width="176" height="8" rx="2" fill="#1d201d"/>
    <rect class="it-scope-glow" x="10" y="109" width="110" height="3" fill="#8dffb0" opacity="0.8"/>
    <circle cx="160" cy="108" r="2.4" fill="#7dffa8"/>`;
  // the soldering station: its box with a dial and a readout, the iron's holder beside it and a cleaning sponge
  const station = `<g ${shadow}><rect width="96" height="88" rx="5" fill="#3a2f22"/></g><rect x="4" y="4" width="88" height="8" fill="#4a3d2c"/>
    ${knob(48, 46, 18)}
    <rect x="22" y="72" width="52" height="12" rx="2" fill="#140c08"/><rect x="26" y="75" width="44" height="6" fill="#ff8a3a" opacity="0.75"/>
    <g ${shadow}><ellipse cx="128" cy="40" rx="26" ry="24" fill="#2b2826"/></g>
    ${[19, 15, 11, 7].map(r => `<ellipse cx="128" cy="40" rx="${r}" ry="${r * 0.9}" fill="none" stroke="#76726b" stroke-width="2.2"/>`).join('')}
    <g ${shadow}><rect x="108" y="74" width="40" height="26" rx="3" fill="#7c6a3e"/></g>
    ${Array.from({ length: 10 }, (_, k) => `<circle cx="${114 + (k % 5) * 7}" cy="${82 + Math.floor(k / 5) * 9}" r="1.5" fill="#4e4227"/>`).join('')}
    <g ${shadow}><rect x="122" y="22" width="12" height="62" rx="5" fill="#1d1b19" transform="rotate(-18 128 40)"/></g>
    <circle cx="137" cy="12" r="5" fill="url(#it-hot)"/>`;
  // a bench power supply: dials, terminals, an amber readout
  const psu = `<g ${shadow}><rect width="118" height="96" rx="5" fill="#33302c"/></g>${vents(14, 12, 90, 5)}
    <rect x="14" y="48" width="56" height="14" rx="2" fill="#120d08"/><rect x="18" y="51" width="48" height="8" fill="#ffb347" opacity="0.6"/>
    ${knob(90, 56, 10)}${knob(30, 80, 7)}
    <circle cx="62" cy="82" r="5" fill="#8a2a22"/><circle cx="80" cy="82" r="5" fill="#141210"/>`;
  // a small parts cabinet: rows of little drawers with labels
  const cabinet = `<g ${shadow}><rect width="108" height="104" rx="3" fill="#4a4740"/></g>
    ${Array.from({ length: 12 }, (_, k) => { const x = 8 + (k % 3) * 32, y = 8 + Math.floor(k / 3) * 23;
      return `<rect x="${x}" y="${y}" width="28" height="19" fill="#5d5951"/><rect x="${x + 6}" y="${y + 4}" width="16" height="5" fill="#a8a092" opacity="0.6"/><rect x="${x + 10}" y="${y + 13}" width="8" height="3" rx="1" fill="#2a2724"/>`; }).join('')}`;

  // ── the working area
  const screwdriver = `<g ${shadow}><rect x="-62" y="-8" width="58" height="16" rx="7" fill="#5a3a22"/><rect x="-58" y="-8" width="50" height="4" rx="2" fill="#7a5232" opacity="0.6"/>
    <rect x="-4" y="-2.5" width="64" height="5" fill="#8d8a84"/><rect x="58" y="-1.5" width="8" height="3" fill="#b5b1aa"/></g>`;
  const wrench = `<g ${shadow} fill="#77736d"><rect x="-58" y="-7" width="116" height="14" rx="5"/>
    <path d="M58 -20 a20 20 0 1 1 0 40 l0 -12 l-10 0 l0 -16 l10 0 z"/>
    <circle cx="-62" cy="0" r="16"/></g><circle cx="-62" cy="0" r="8" fill="#211d1a"/><rect x="-52" y="-2" width="100" height="2" fill="#a29e97" opacity="0.4"/>`;
  const screw = () => { const r = 3.5 + rand() * 2; return `<circle r="${r}" fill="#8f8b84" ${shadow}/><rect x="${-r * 0.8}" y="-0.6" width="${r * 1.6}" height="1.2" fill="#3a3632" transform="rotate(${rand() * 180})"/>`; };
  const note = `<g ${shadow}><rect x="-60" y="-44" width="120" height="88" fill="#a8a092"/>${[-28, -16, -4, 8, 20].map((y, k) =>
    `<path d="M-48 ${y} q12 -3 24 0 t24 0 t${k % 2 ? 20 : 36} 0" stroke="#3e3a35" stroke-width="1.4" fill="none" opacity="0.7"/>`).join('')}</g>`;
  const mug = `<g ${shadow}><circle r="34" fill="#3b3631"/><circle r="28" fill="#2a1a10"/><circle r="28" fill="url(#it-coffee)"/><rect x="32" y="-8" width="18" height="16" rx="7" fill="none" stroke="#3b3631" stroke-width="6"/></g>`;
  // the Mu flashlight, pointing along +x with its lens at 0,0
  const flashlight = `<g ${shadow}>
      <rect x="-210" y="-15" width="10" height="30" rx="3" fill="#2a2724"/>
      <rect x="-202" y="-16" width="130" height="32" rx="6" fill="url(#it-metal)"/>
      ${Array.from({ length: 14 }, (_, k) => `<rect x="${-190 + k * 6}" y="-16" width="2.5" height="32" fill="#000" opacity="0.28"/>`).join('')}
      <rect x="-72" y="-19" width="26" height="38" rx="4" fill="url(#it-metal)"/>
      <path d="M-46 -19 L-6 -30 L0 -30 L0 30 L-6 30 L-46 19 Z" fill="url(#it-metal)"/>
      <rect x="-3" y="-30" width="5" height="60" rx="2" fill="#4a4641"/>
    </g>
    <rect x="-64" y="-6" width="10" height="12" rx="2" fill="#1a1816"/>
    <circle class="mu-led" cx="-110" cy="0" r="2.6" fill="#2a3a2c"/>
    <text x="-140" y="5" font-family="IBM Plex Mono, monospace" font-size="15" font-weight="700" fill="#1c1a18" opacity="0.8">μ</text>`;

  // scratches and grime on the steel top
  let scratches = '';
  for (let k = 0; k < 70; k++) {
    const x = rand() * W, y = BACK + rand() * (H - BACK), len = 10 + rand() * 60, a = rand() * 180;
    scratches += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + Math.cos(a) * len).toFixed(0)}" y2="${(y + Math.sin(a) * len).toFixed(0)}" stroke="#8a847b" stroke-width="0.6" opacity="${(0.08 + rand() * 0.12).toFixed(2)}"/>`;
  }
  const screws = Array.from({ length: 9 }, () => [rand(), rand()]);

  // the beam: a wedge from the lens out past the edge, black
  const half = 21 * Math.PI / 180, reach = 900;
  const beam = [[0, -24], [reach, -reach * Math.tan(half) - 24], [reach, reach * Math.tan(half) + 24], [0, 24]].map(q => q.join(',')).join(' ');
  const SCOPE_X = 168;   // where the oscilloscope stands in the back row

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="it-pool" cx="360" cy="270" r="520" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#3d3833"/><stop offset="0.55" stop-color="#26231f"/><stop offset="1" stop-color="#110f0d"/>
        </radialGradient>
        <linearGradient id="it-back" x1="0" y1="0" x2="0" y2="${BACK}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0e0c0b"/><stop offset="1" stop-color="#1c1917"/>
        </linearGradient>
        <linearGradient id="it-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3a3733"/><stop offset="0.35" stop-color="#8e8a83"/><stop offset="0.55" stop-color="#5d5954"/><stop offset="1" stop-color="#25221f"/>
        </linearGradient>
        <radialGradient id="it-coffee" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#5a3a22" stop-opacity="0.5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
        <radialGradient id="it-scope" cx="${SCOPE_X + 66}" cy="${BACK}" r="250" fx="${SCOPE_X + 66}" fy="${BACK - 6}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#5dff92" stop-opacity="0.42"/><stop offset="0.45" stop-color="#5dff92" stop-opacity="0.13"/><stop offset="1" stop-color="#5dff92" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="it-hot"><stop offset="0" stop-color="#ffb35a" stop-opacity="0.8"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
        <filter id="it-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="3" dy="7" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/></filter>
        <filter id="it-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0"/></filter>
        <filter id="it-edge" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
        <radialGradient id="it-vignette" cx="${W / 2}" cy="${H / 2}" r="${W * 0.62}" gradientUnits="userSpaceOnUse">
          <stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#it-pool)"/>
      <rect width="${W}" height="${H}" filter="url(#it-grain)" opacity="0.4"/>
      ${scratches}
      <rect width="${W}" height="${BACK}" fill="url(#it-back)"/>
      <rect y="${BACK - 2}" width="${W}" height="3" fill="#0a0908"/>
      <circle cx="560" cy="396" r="32" fill="none" stroke="#1a130d" stroke-width="5" opacity="0.35"/>
      <!-- the oscilloscope's light on the work area, pulsing with the signal (two layers beating against each other) -->
      <ellipse class="it-pulse-a" cx="${SCOPE_X + 66}" cy="${BACK}" rx="300" ry="230" fill="url(#it-scope)"/>
      <ellipse class="it-pulse-b" cx="${SCOPE_X + 66}" cy="${BACK}" rx="220" ry="170" fill="url(#it-scope)"/>
      <!-- the back row -->
      ${at(18, ROW + 4, 0, tray)}
      ${at(SCOPE_X, ROW, 0, scope)}
      ${at(366, ROW + 8, 0, station)}
      ${at(532, ROW + 6, 0, psu)}
      ${at(672, ROW + 2, 0, cabinet)}
      <!-- cables: the soldering iron's, the probe from the oscilloscope to the flashlight -->
      <path d="M412 ${ROW + 96} C420 ${ROW + 140} 470 ${ROW + 140} 500 ${BACK - 4}" stroke="#151311" stroke-width="4" fill="none" ${shadow}/>
      <path d="M${SCOPE_X + 150} ${BACK - 4} C${SCOPE_X + 160} 210 300 240 262 270" stroke="#1b1a18" stroke-width="4" fill="none" ${shadow}/>
      <!-- the working area -->
      ${at(112, 372, 0, mug)}
      ${at(690, 330, 8, note)}
      ${at(540, 244, 12, screwdriver)}
      ${at(600, 384, -20, wrench)}
      ${screws.map(([u, v], k) => at(k < 6 ? 450 + u * 300 : 250 + u * 110, k < 6 ? 170 + v * 220 : 340 + v * 70, 0, screw())).join('')}
      <!-- Mu light: in front of the lens nothing can be seen -->
      <g class="mu-beam" transform="translate(${LENS[0]} ${LENS[1]}) rotate(${ANGLE})"><polygon points="${beam}" fill="#000" filter="url(#it-edge)"/></g>
      ${at(LENS[0], LENS[1], ANGLE, flashlight)}
      <circle cx="262" cy="272" r="5" fill="#8a2a22"/><rect x="257" y="270" width="10" height="3" fill="#b5b1aa"/>
      <rect width="${W}" height="${H}" fill="url(#it-vignette)"/>
    </svg>`;
}

// ── Overview ────────────────────────────────────────────────────────────────

async function initExpedition() {
  const [x, shots, base, gear, cavity] = await Promise.all([
    expeditionHeader('overview'), loadCatalog(), fetchYaml('../data/north-base.yaml'), fetchYaml('../data/items.yaml'),
    fetchYaml(`${ROOT}lore/data/map.yaml`),
  ]);
  const b = base || {}, g = gear || {};
  const content = document.getElementById('content');
  content.innerHTML = `
    <h1>${x.title || 'The Expedition'}</h1>
    ${has(x.tagline) ? `<p class="lede">${mdInline(x.tagline)}</p>` : ''}
    ${glance(x.glance || [])}
    <div class="badges">${canonBadge('ours')}</div>
    <h2>One-Shots</h2>
    ${shots.length ? `<div class="cover-grid">${shots.map(shotCover).join('')}</div>`
      : '<p class="empty">No one-shots yet. Copy one-shots/_template/ and add it to one-shots/catalog.yaml.</p>'}
    <h2>Expedition files</h2>
    <div class="grid">
      <a class="card" href="./north-base.html">
        <span class="card-art">${northBaseSvg(cavity)}</span>
        <span class="card-title">${b.name || 'North Base'}</span>
        ${has(b.summary) ? `<span class="card-tagline">${mdInline(b.summary)}</span>` : ''}
        <span class="card-meta"><span>${count((b.npcs || []).length, 'NPC')}</span><span>${count((b.places || []).length, 'place')}</span></span>
      </a>
      <a class="card" href="./items.html">
        <span class="card-art">${itemsSvg()}</span>
        <span class="card-title">${g.name || 'Items'}</span>
        ${has(g.summary) ? `<span class="card-tagline">${mdInline(g.summary)}</span>` : ''}
        <span class="card-meta"><span>${count((g.items || []).length, 'item')}</span></span>
      </a>
    </div>
    ${(x.sections || []).map(s => `<h2>${s.heading}</h2>${md(s.body)}`).join('')}
    ${openBox(x.open)}`;

  const stops = [...content.querySelectorAll('.shot-cover')].map((card, i) => {
    const cover = SHOT_COVERS[shots[i].cover];
    return cover ? cover.start(card) : () => {};
  });
  onPageCleanup(() => stops.forEach(stop => stop()));
}

// ── North Base ──────────────────────────────────────────────────────────────

async function initNorthBase() {
  const [, shots, base, { byId }, cavity] = await Promise.all([
    expeditionHeader('north-base', 'North Base'), loadCatalog(), fetchYaml('../data/north-base.yaml'), loadLore(),
    fetchYaml(`${ROOT}lore/data/map.yaml`),
  ]);
  const b = base || {};
  const shotById = Object.fromEntries(shots.map(s => [s.id, s]));
  document.getElementById('content').innerHTML = `
    <h1>${b.name || 'North Base'}</h1>
    ${has(b.summary) ? `<p class="lede">${mdInline(b.summary)}</p>` : ''}
    <div class="page-art">${northBaseSvg(cavity)}</div>
    ${(b.sections || []).map(s => `<h2>${s.heading}</h2>${md(s.body)}`).join('')}
    <h2>People</h2>
    ${roster(b.npcs, n => rosterSheet(n, {
      name: n.name,
      badges: `${has(n.role) ? `<span class="badge">${n.role}</span>` : ''}<span class="badge">NPC</span>`,
    }, md(n.text), shotById), 'people', 'north-base.yaml')}
    <h2>Out from the base</h2>
    ${roster(b.places, p => rosterSheet(p, {
      name: p.name,
      badges: has(p.area) ? `<span class="badge">${p.area}</span>` : '',
    }, md(p.text) + field('In the lore', has(p.lore) ? loreLink(p.lore, byId) : ''), shotById), 'places', 'north-base.yaml')}
    ${openBox(b.open)}`;
  scrollToHash();
}

// ── Items ───────────────────────────────────────────────────────────────────

// An item's rules at the table (HeartCore), e.g. "Consumable · Tier 1 · Rarity 2" and its text
function heartcoreBox(h) {
  if (!h) return '';
  const stats = [h.type && h.type[0].toUpperCase() + h.type.slice(1), h.tier != null && `Tier ${h.tier}`, h.rarity != null && `Rarity ${h.rarity}`,
    h.slots != null && `${h.slots} slot${h.slots === 1 ? '' : 's'}`, h.recall != null && `Recall ${h.recall}`].filter(Boolean);
  return field('At the table (HeartCore)', `${stats.length ? `<p>${stats.join(' · ')}</p>` : ''}${has(h.text) ? list(h.text) : ''}`);
}

async function initItems() {
  // Items read the lore objects file directly, so their names show with fan-made mode off too
  const [, shots, gear, objects] = await Promise.all([
    expeditionHeader('items', 'Items'), loadCatalog(), fetchYaml('../data/items.yaml'), fetchYaml(`${ROOT}lore/data/objects.yaml`),
  ]);
  const g = gear || {};
  const shotById = Object.fromEntries(shots.map(s => [s.id, s]));
  const objectById = Object.fromEntries((objects || []).map(o => [o.id, o]));
  document.getElementById('content').innerHTML = `
    <h1>${g.name || 'Items'}</h1>
    ${has(g.summary) ? `<p class="lede">${mdInline(g.summary)}</p>` : ''}
    <div class="page-art">${itemsSvg()}</div>
    ${roster(g.items, i => {
      const o = objectById[i.lore] || {};
      return rosterSheet(i, {
        name: o.name || i.lore,
        badges: (has(o.kind) ? `<span class="badge">${o.kind}</span>` : '') + canonBadge(o.canon),
      }, (has(o.summary) ? `<p>${mdInline(o.summary)}</p>` : '') + md(i.text)
        + field('In the lore', o.id ? `<a class="ref" href="${loreUrl({ ...o, collection: 'objects' })}"><span class="ref-kind">Objects</span>${o.name}</a>` : '')
        + heartcoreBox(i.heartcore), shotById);
    }, 'items', 'items.yaml')}`;
  scrollToHash();
}
