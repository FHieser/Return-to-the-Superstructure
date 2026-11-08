// expedition/webapp/js/expedition.js
// The Expedition page, the overview of the one-shots: the one-shot cards (one-shots/catalog.yaml) and what they share
// (expedition/data/expedition.yaml), with recurring NPCs, places and items.
// Depends on: shared/js/core.js, jsyaml (CDN), marked (CDN).

const EXPEDITION_GROUPS = [
  { id: 'npcs',   label: 'NPCs' },
  { id: 'places', label: 'Places' },
  { id: 'items',  label: 'Items' },
];

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

async function initExpedition() {
  // Items read the lore objects file directly, so their names show with fan-made mode off too
  const [x, shots, objects, { byId }] = await Promise.all([
    fetchYaml('../data/expedition.yaml'), loadCatalog(), fetchYaml(`${ROOT}lore/data/objects.yaml`), loadLore(),
  ]);
  const data = x || {};
  const shotById = Object.fromEntries(shots.map(s => [s.id, s]));
  const objectById = Object.fromEntries((objects || []).map(o => [o.id, o]));

  renderHeader({
    title: data.title || 'The Expedition',
    nav: [{ id: 'one-shots', label: 'One-Shots' }, ...EXPEDITION_GROUPS].map(g => ({ id: g.id, label: g.label, href: `#${g.id}` })),
  });

  const render = {
    npcs: n => rosterSheet(n, {
      name: n.name,
      badges: `${has(n.role) ? `<span class="badge">${n.role}</span>` : ''}<span class="badge">NPC</span>`,
    }, md(n.text), shotById),
    places: p => rosterSheet(p, {
      name: p.name,
      badges: has(p.area) ? `<span class="badge">${p.area}</span>` : '',
    }, md(p.text) + field('In the lore', has(p.lore) ? loreLink(p.lore, byId) : ''), shotById),
    items: i => {
      const o = objectById[i.lore] || {};
      return rosterSheet(i, {
        name: o.name || i.lore,
        badges: (has(o.kind) ? `<span class="badge">${o.kind}</span>` : '') + canonBadge(o.canon),
      }, (has(o.summary) ? `<p>${mdInline(o.summary)}</p>` : '') + md(i.text)
        + field('In the lore', o.id ? `<a class="ref" href="${loreUrl({ ...o, collection: 'objects' })}"><span class="ref-kind">Objects</span>${o.name}</a>` : ''), shotById);
    },
  };

  document.getElementById('content').innerHTML = `
    <h1>${data.title || 'The Expedition'}</h1>
    ${has(data.tagline) ? `<p class="lede">${mdInline(data.tagline)}</p>` : ''}
    ${glance(data.glance || [])}
    <div class="badges">${canonBadge('ours')}</div>
    <h2 id="one-shots" class="roster-head">One-Shots</h2>
    ${shots.length ? `<div class="grid">${shots.map(shotCard).join('')}</div>`
      : '<p class="empty">No one-shots yet. Copy one-shots/_template/ and add it to one-shots/catalog.yaml.</p>'}
    ${(data.sections || []).map(s => `<h2>${s.heading}</h2>${md(s.body)}`).join('')}
    ${EXPEDITION_GROUPS.map(g => `
      <h2 id="${g.id}" class="roster-head">${g.label}</h2>
      ${has(data[g.id]) ? `<div class="roster">${data[g.id].map(render[g.id]).join('')}</div>`
        : `<p class="empty">No recurring ${g.label.toLowerCase()} yet. Add them to expedition/data/expedition.yaml.</p>`}`).join('')}
    ${openBox(data.open)}`;

  // Jump to #npcs / #holly etc. once the content is in the page
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
