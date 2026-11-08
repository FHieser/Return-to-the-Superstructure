// shared/js/mural.js
// Pictures for the one-shot Rooms page (data/rooms.yaml):
//   renderMural(el, mural)   a wallpapered wall, painted over with strokes of black, with words on it;
//                            the words listed in mural.moving strain as if they wanted to change position.
//   renderPicture(el, pic)   a developed photograph; pic.shows: eye = a giant eye that opens when you look at it.
// Both return a function that stops their animation.

function muralEscape(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// Fixed pseudo-random numbers, so a picture looks the same on every visit
function muralRandom(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function renderMural(el, mural) {
  const lines = mural.lines || [];
  const moving = (mural.moving || []).map(w => String(w).toLowerCase());
  const uid = 'mural' + Math.random().toString(36).slice(2, 8);
  const rnd = muralRandom(14);

  // Stains on the wallpaper: soft blotches, and water marks with a darker rim
  const blotches = Array.from({ length: 7 }, () =>
    `<ellipse cx="${(rnd() * 1000).toFixed(0)}" cy="${(rnd() * 600).toFixed(0)}" rx="${(30 + rnd() * 110).toFixed(0)}" ry="${(25 + rnd() * 80).toFixed(0)}"/>`).join('');
  const rims = [[150, 545, 70, 38], [880, 110, 55, 70], [610, 560, 95, 30]].map(([x, y, rx, ry]) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('');

  // The black paint: single brush strokes, roughly horizontal, each with a ragged edge and bristle marks at its ends
  const strokes = [];
  const bristles = [];
  for (let y = 78; y <= 450; y += 30 + rnd() * 8) {
    const parts = rnd() < 0.35 ? 2 : 1;
    for (let p = 0; p < parts; p++) {
      const x0 = parts === 1 ? 70 + rnd() * 45 : (p === 0 ? 70 + rnd() * 40 : 420 + rnd() * 120);
      const x1 = parts === 1 ? 885 + rnd() * 45 : (p === 0 ? 520 + rnd() * 120 : 885 + rnd() * 45);
      const w = 42 + rnd() * 18, bend = (rnd() - 0.5) * 22, tilt = (rnd() - 0.5) * 16;
      const yAt = t => y + tilt * (t - 0.5) + bend * Math.sin(t * Math.PI);
      const top = [], bottom = [];
      const n = Math.round((x1 - x0) / 14);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t;
        const taper = Math.min(1, t * 12, (1 - t) * 12) * 0.35 + 0.65;
        top.push(`${x.toFixed(1)},${(yAt(t) - w / 2 * taper + (rnd() - 0.5) * 5).toFixed(1)}`);
        bottom.unshift(`${x.toFixed(1)},${(yAt(t) + w / 2 * taper + (rnd() - 0.5) * 5).toFixed(1)}`);
      }
      strokes.push(`<polygon points="${top.concat(bottom).join(' ')}" fill-opacity="${(0.9 + rnd() * 0.1).toFixed(2)}"/>`);
      for (const [x, dir, t] of [[x0, -1, 0], [x1, 1, 1]]) {
        for (let b = 0; b < 6; b++) {
          const by = yAt(t) + (rnd() - 0.5) * w * 0.8;
          bristles.push(`<line x1="${x.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(x + dir * (8 + rnd() * 34)).toFixed(1)}" y2="${(by + (rnd() - 0.5) * 4).toFixed(1)}" stroke-width="${(1.5 + rnd() * 4).toFixed(1)}"/>`);
        }
      }
    }
  }
  const drips = Array.from({ length: 13 }, () => {
    const w = 4 + rnd() * 9;
    return `<rect x="${(100 + rnd() * 800).toFixed(0)}" y="440" width="${w.toFixed(1)}" height="${(45 + rnd() * rnd() * 110).toFixed(0)}" rx="${(w / 2).toFixed(1)}"/>`;
  }).join('');

  // Hand-painted look: every line sits a little crooked and off-centre
  const tilt = [-2.5, 1.8, -1, 1.2, -1.6];
  const offset = [-7, 9, 1, -3, 5];
  const size = [1, 1.1, 0.85, 1.15, 0.95];
  const word = w => {
    const moves = moving.includes(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
    return `<span class="mural-word${moves ? ' moving' : ''}">${[...w].map(c => `<span class="mural-letter">${muralEscape(c)}</span>`).join('')}</span>`;
  };
  const linesHtml = lines.map((l, i) => `
    <p class="mural-line" style="--tilt:${tilt[i % 5]}deg;--offset:${offset[i % 5]}%;--size:${size[i % 5]}">
      ${String(l).split(/\s+/).filter(Boolean).map(word).join(' ')}
    </p>`).join('');

  el.innerHTML = `
    <div class="mural">
      <svg class="mural-wall" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="${uid}-paper" width="60" height="80" patternUnits="userSpaceOnUse">
            <rect width="60" height="80" fill="#d9c9a5"/>
            <rect x="0" width="4" height="80" fill="#cdbb94"/>
            <rect x="30" width="2" height="80" fill="#d2c19c"/>
            <path d="M45 22 l6 9 -6 9 -6 -9z M15 62 l6 9 -6 9 -6 -9z M15 -18 l6 9 -6 9 -6 -9z" fill="#c9b68e"/>
          </pattern>
          <filter id="${uid}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7"/>
            <feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  1.4 0 0 0 -0.7"/>
          </filter>
          <filter id="${uid}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
          <filter id="${uid}-rim" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>
        <rect width="1000" height="600" fill="url(#${uid}-paper)"/>
        <g fill="#8a6a3a" opacity="0.28" filter="url(#${uid}-blur)">${blotches}</g>
        <g fill="#a78a55" fill-opacity="0.18" stroke="#6e5126" stroke-opacity="0.45" stroke-width="3" filter="url(#${uid}-rim)">${rims}</g>
        <rect width="1000" height="600" filter="url(#${uid}-grain)" opacity="0.6"/>
        <g fill="#080808">${strokes.join('')}${drips}</g>
        <g stroke="#080808" stroke-linecap="round">${bristles.join('')}</g>
      </svg>
      <div class="mural-words" role="img" aria-label="${muralEscape(lines.join(' / '))}">
        <div aria-hidden="true">${linesHtml}</div>
      </div>
    </div>`;

  // The moving words strain against their place: every few seconds they pull in some direction,
  // each letter dragging a little behind the others, then they get pulled back
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const words = [...el.querySelectorAll('.mural-word.moving')].map(w => ({
    target: [0, 0], next: 0,
    letters: [...w.querySelectorAll('.mural-letter')].map((s, i) => ({
      s, x: 0, y: 0, vx: 0, vy: 0, k: 9 + Math.random() * 10, lag: i * 0.05, p: Math.random() * 6.3,
    })),
  }));
  if (!words.length) return () => {};
  let raf = 0, last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    for (const w of words) {
      if (t > w.next) {
        const pulling = w.target[0] === 0 && w.target[1] === 0;
        const a = Math.random() * Math.PI * 2;
        w.target = pulling ? [Math.cos(a) * (0.12 + Math.random() * 0.2), Math.sin(a) * 0.12] : [0, 0];
        w.next = t + (pulling ? 500 + Math.random() * 900 : 1500 + Math.random() * 3000);
        w.letters.forEach(l => (l.delay = t + l.lag * 1000));
      }
      for (const l of w.letters) {
        const [tx, ty] = t > l.delay ? w.target : [l.tx || 0, l.ty || 0];
        if (t > l.delay) { l.tx = tx; l.ty = ty; }
        l.vx += ((tx - l.x) * l.k - l.vx * 5) * dt;
        l.vy += ((ty - l.y) * l.k - l.vy * 5) * dt;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        const tremble = Math.sin(t / 90 + l.p) * 0.006;
        l.s.style.transform = `translate(${(l.x + tremble).toFixed(3)}em, ${(l.y - tremble).toFixed(3)}em) rotate(${(l.vx * 25).toFixed(2)}deg)`;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

function renderPicture(el, pic) {
  const uid = 'pic' + Math.random().toString(36).slice(2, 8);
  if (pic.shows !== 'eye') { el.innerHTML = ''; return () => {}; }
  const rnd = muralRandom(5);
  const veins = Array.from({ length: 9 }, () => {
    const side = rnd() < 0.5 ? -1 : 1, y = 150 + (rnd() - 0.5) * 70;
    const x0 = 200 + side * (150 + rnd() * 25), x1 = 200 + side * (75 + rnd() * 20);
    return `<path d="M${x0.toFixed(0)} ${y.toFixed(0)} Q${((x0 + x1) / 2).toFixed(0)} ${(y + (rnd() - 0.5) * 30).toFixed(0)} ${x1.toFixed(0)} ${(150 + (y - 150) * 0.5).toFixed(0)}"/>`;
  }).join('');
  const lashes = Array.from({ length: 13 }, (_, i) => {
    const t = (i + 1) / 14, x = 30 + 340 * t, y = 150 + Math.sin(t * Math.PI) * 4;
    return `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + (t - 0.5) * 14).toFixed(1)}" y2="${(y + 14 + Math.sin(t * Math.PI) * 6).toFixed(1)}"/>`;
  }).join('');
  const almond = 'M30 150 Q200 30 370 150 Q200 270 30 150 Z';

  el.innerHTML = `
    <figure class="photo" tabindex="0" aria-label="${muralEscape(pic.caption || 'Photograph')}: a giant eye. Look at it.">
      <svg viewBox="0 0 400 300" aria-hidden="true">
        <defs>
          <radialGradient id="${uid}-iris"><stop offset="0" stop-color="#2a241c"/><stop offset="0.45" stop-color="#5c5040"/><stop offset="1" stop-color="#2b251d"/></radialGradient>
          <radialGradient id="${uid}-white" cx="50%" cy="45%" r="60%"><stop offset="0.5" stop-color="#cfc6b2"/><stop offset="1" stop-color="#8e8571"/></radialGradient>
          <clipPath id="${uid}-lids"><path class="photo-lids" d="${almond}"/></clipPath>
          <filter id="${uid}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
            <feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.07  1.3 0 0 0 -0.55"/>
          </filter>
        </defs>
        <rect width="400" height="300" fill="#2a2620"/>
        <path d="${almond}" fill="#3a352c"/>
        <g clip-path="url(#${uid}-lids)">
          <rect width="400" height="300" fill="url(#${uid}-white)"/>
          <g fill="none" stroke="#7a3a30" stroke-opacity="0.45" stroke-width="1.2">${veins}</g>
          <g class="photo-iris">
            <circle cx="200" cy="150" r="64" fill="url(#${uid}-iris)"/>
            <circle cx="200" cy="150" r="64" fill="none" stroke="#17130e" stroke-width="5"/>
            <circle class="photo-pupil" cx="200" cy="150" r="24" fill="#070605"/>
            <circle cx="183" cy="133" r="7" fill="#e8e2d4" opacity="0.7"/>
          </g>
        </g>
        <path class="photo-lids photo-lid-line" d="${almond}" fill="none" stroke="#14110d" stroke-width="5"/>
        <g class="photo-lashes" stroke="#14110d" stroke-width="3" stroke-linecap="round">${lashes}</g>
        <rect width="400" height="300" filter="url(#${uid}-grain)"/>
      </svg>
      ${pic.caption ? `<figcaption>${muralEscape(pic.caption)}</figcaption>` : ''}
    </figure>`;

  // Looking at it (pointer over it, focus, or a tap) opens the eye; the pupil then follows you
  const fig = el.querySelector('.photo');
  const iris = el.querySelector('.photo-iris');
  const look = on => fig.classList.toggle('open', on);
  const follow = e => {
    const r = fig.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 2, dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    iris.style.transform = `translate(${(dx * 40).toFixed(1)}px, ${(dy * 22).toFixed(1)}px)`;
  };
  fig.addEventListener('pointerenter', () => look(true));
  fig.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') look(false); });
  fig.addEventListener('pointermove', follow);
  fig.addEventListener('click', e => { if (e.pointerType !== 'mouse') look(!fig.classList.contains('open')); });
  fig.addEventListener('focus', () => look(true));
  fig.addEventListener('blur', () => look(false));
  return () => {};
}
