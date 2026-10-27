// one-shots/<folder>/webapp/js/app.js
// Rendering for one one-shot's pages. Reads ../data/ and links into the lore (lore/data/).
// Depends on: shared/js/core.js, jsyaml (CDN), marked (CDN).

const SHOT_NAV = [
  { id: 'overview',   label: 'Overview',   href: './' },
  { id: 'locations',  label: 'Locations',  href: './locations.html' },
  { id: 'characters', label: 'Characters', href: './characters.html' },
  { id: 'timeline',   label: 'Timeline',   href: './timeline.html' },
  { id: 'audio',      label: 'Audio',      href: './audio.html' },
];

async function shotHeader(active, pageTitle) {
  const o = (await fetchYaml('../data/overview.yaml')) || {};
  renderHeader({ title: o.title || 'One-Shot', nav: SHOT_NAV, active });
  document.title = pageTitle ? `${pageTitle} — ${o.title}` : o.title;
  return o;
}

function emptyNote(what, file) {
  return `<p class="empty">No ${what} yet. Add them to data/${file}.</p>`;
}

// Pills + one sheet, selected by #<id> in the URL
function pickerPage(items, renderSheet) {
  const content = document.getElementById('content');
  content.insertAdjacentHTML('beforeend', `
    <div class="pills spaced" id="picker">${items.map(i => `<button class="pill" data-id="${i.id}">${i.name}</button>`).join('')}</div>
    <div id="sheet"></div>`);
  function route() {
    const item = items.find(i => i.id === location.hash.slice(1)) || items[0];
    document.querySelectorAll('#picker .pill').forEach(p => p.classList.toggle('active', p.dataset.id === item.id));
    document.getElementById('sheet').innerHTML = renderSheet(item);
  }
  document.getElementById('picker').addEventListener('click', e => {
    const btn = e.target.closest('.pill');
    if (btn) location.hash = btn.dataset.id;
  });
  window.addEventListener('hashchange', route);
  onPageCleanup(() => window.removeEventListener('hashchange', route));
  route();
}

// ── Overview ────────────────────────────────────────────────────────────────

async function initShotOverview() {
  const o = await shotHeader('overview');
  const { byId } = await loadLore();
  document.getElementById('content').innerHTML = `
    <h1>${o.title || 'Untitled One-Shot'}</h1>
    ${has(o.tagline) ? `<p class="lede">${mdInline(o.tagline)}</p>` : ''}
    ${glance([
      { label: 'Status', value: o.status }, { label: 'System', value: o.system },
      { label: 'Players', value: o.players }, { label: 'Duration', value: o.duration },
      { label: 'When', value: o.when },
    ])}
    ${has(o.tags) ? `<div class="card-tags">${o.tags.map(t => `<span class="badge">${t}</span>`).join('')}</div>` : ''}
    ${has(o.premise) ? `<h2>Premise</h2>${md(o.premise)}` : ''}
    <h2>Lore</h2>
    ${has(o.lore_refs) ? loreLinks(o.lore_refs, byId) : '<p class="dim">No lore references yet. Add lore ids to lore_refs in data/overview.yaml.</p>'}
    ${has(o.lore_changes) ? `<div class="box section"><div class="label">Changes to the lore ${canonBadge('ours')}</div>${list(o.lore_changes)}</div>` : ''}
    ${(o.sections || []).map(s => `<h2>${s.heading}</h2>${md(s.body)}`).join('')}
    ${openBox(o.open)}`;
}

// ── Locations ───────────────────────────────────────────────────────────────

async function initLocations() {
  await shotHeader('locations', 'Locations');
  const [locations, { byId }] = await Promise.all([fetchYaml('../data/locations.yaml'), loadLore()]);
  const content = document.getElementById('content');
  content.innerHTML = '<h1>Locations</h1>';
  if (!has(locations)) { content.insertAdjacentHTML('beforeend', emptyNote('locations', 'locations.yaml')); return; }

  const nameOf = Object.fromEntries(locations.map(l => [l.id, l.name]));
  pickerPage(locations, l => `
    <article class="sheet">
      <div class="sheet-head"><h2>${l.name}</h2><div class="badges">${has(l.area) ? `<span class="badge">${l.area}</span>` : ''}</div></div>
      ${list(l.description)}
      ${field('Features', list(l.features))}
      ${field('Denizens', loreLinks(l.denizens, byId))}
      ${field('Connections', has(l.connections) ? l.connections.map(c => `<a class="ref" href="#${c}">${nameOf[c] || c}</a>`).join('') : '')}
      ${field('In the lore', has(l.lore_ref) ? loreLink(l.lore_ref, byId) : '')}
      ${has(l.gm_notes) ? `<div class="box gm section"><div class="label">GM only</div>${list(l.gm_notes)}</div>` : ''}
      ${openBox(l.open)}
    </article>`);
}

// ── Characters ──────────────────────────────────────────────────────────────

async function initCharacters() {
  await shotHeader('characters', 'Characters');
  const [chars, { byId }] = await Promise.all([fetchYaml('../data/characters.yaml'), loadLore()]);
  const content = document.getElementById('content');
  content.innerHTML = '<h1>Characters</h1>';
  if (!has(chars)) { content.insertAdjacentHTML('beforeend', emptyNote('characters', 'characters.yaml')); return; }

  pickerPage(chars, c => `
    <article class="sheet">
      <div class="sheet-head">
        <h2>${c.name}</h2>
        <div class="badges">${has(c.role) ? `<span class="badge">${c.role}</span>` : ''}${c.type === 'npc' ? '<span class="badge">NPC</span>' : '<span class="badge solid">Player</span>'}</div>
      </div>
      ${list(c.description)}
      ${field('Wants', list(c.wants))}
      ${field('Gear', list(c.gear))}
      ${field('In the lore', has(c.lore_ref) ? loreLink(c.lore_ref, byId) : '')}
      ${has(c.secrets) ? `<div class="box gm section"><div class="label">GM only</div>${list(c.secrets)}</div>` : ''}
      ${openBox(c.open)}
    </article>`);
}

// ── Timeline (session flow) ─────────────────────────────────────────────────

async function initShotTimeline() {
  await shotHeader('timeline', 'Timeline');
  const phases = await fetchYaml('../data/timeline.yaml');
  document.getElementById('content').innerHTML = `
    <h1>Timeline</h1>
    ${has(phases) ? phases.map(p => `
      <section class="tl-era">
        <div class="label">${p.phase}</div>
        ${md(p.note)}
        ${(p.beats || []).map(b => `
          <div class="tl-event${b.type === 'warning' ? ' beat-warning' : ''}${b.optional ? ' beat-optional' : ''}">
            <div class="tl-date">${b.label || ''}${b.optional ? ' · OPTIONAL' : ''}</div>
            <h3>${b.title || ''}</h3>
            ${md(b.text)}
          </div>`).join('')}
      </section>`).join('')
    : emptyNote('beats', 'timeline.yaml')}`;
}

// ── Audio ───────────────────────────────────────────────────────────────────

function videoId(url) {
  const m = String(url || '').match(/[?&]v=([^&]+)/) || String(url || '').match(/youtu\.be\/([^?]+)/);
  return m ? m[1] : null;
}

async function initAudio() {
  await shotHeader('audio', 'Audio');
  const tracks = await fetchYaml('../data/audio.yaml');
  document.getElementById('content').innerHTML = `
    <h1>Audio</h1>
    ${has(tracks) ? `<div class="grid">${tracks.map(t => {
      const id = videoId(t.url);
      return `<div class="sheet">
        <div class="label">${t.title || ''}</div>
        ${has(t.use) ? `<p class="dim">${mdInline(t.use)}</p>` : ''}
        ${id ? `<iframe style="width:100%;aspect-ratio:16/9;border:0" src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>` : `<a href="${t.url}">${t.url}</a>`}
      </div>`;
    }).join('')}</div>` : emptyNote('tracks', 'audio.yaml')}`;
}
