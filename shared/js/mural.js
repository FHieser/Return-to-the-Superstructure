// shared/js/mural.js
// The mural for the one-shot Rooms page (data/rooms.yaml):
//   renderMural(el, mural)   a wallpapered wall, painted over with strokes of black, with words on it;
//                            the words listed in mural.moving twitch as if they wanted to change position,
//                            and mural.eye adds a minimal sprayed eye above the words that follows the cursor.
// It returns a function that stops the animation.

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
        for (let b = 0, n = 2 + Math.floor(rnd() * 3); b < n; b++) {
          const by = yAt(t) + (rnd() - 0.5) * w * 0.7, bx = x - dir * rnd() * 10;
          bristles.push(`<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(bx + dir * (6 + rnd() * rnd() * 30)).toFixed(1)}" y2="${(by + (rnd() - 0.5) * 5).toFixed(1)}" stroke-width="${(1 + rnd() * 2.5).toFixed(1)}" stroke-opacity="${(0.6 + rnd() * 0.4).toFixed(2)}"/>`);
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
        <div aria-hidden="true">
          ${mural.eye ? `<svg class="mural-eye" viewBox="0 0 120 60">
            <path d="M6 30 Q60 -6 114 30 Q60 66 6 30 Z" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"/>
            <circle class="mural-pupil" cx="60" cy="30" r="10" fill="currentColor"/>
          </svg>` : ''}
          ${linesHtml}
        </div>
      </div>
    </div>`;

  const stops = [];

  // The eye: its pupil looks towards the cursor, wherever it is on the page
  const pupil = el.querySelector('.mural-pupil');
  if (pupil) {
    const eye = el.querySelector('.mural-eye');
    const follow = e => {
      const r = eye.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1, reach = Math.min(1, d / (r.width * 1.5));
      pupil.setAttribute('transform', `translate(${(dx / d * reach * 30).toFixed(1)} ${(dy / d * reach * 9).toFixed(1)})`);
    };
    window.addEventListener('pointermove', follow);
    stops.push(() => window.removeEventListener('pointermove', follow));
  }
  const stopAll = () => stops.forEach(stop => stop());

  // The moving words twitch as if they wanted to change position: the letters jump a little many times a second,
  // and every so often the whole word lurches in some direction before it is pulled back
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return stopAll;
  const words = [...el.querySelectorAll('.mural-word.moving')].map(w => ({
    pull: [0, 0], nextPull: 0,
    letters: [...w.querySelectorAll('.mural-letter')].filter(s => /[\p{L}\p{N}]/u.test(s.textContent)).map(s => ({ s, next: 0 })),
  }));
  if (!words.length) return stopAll;
  const jitter = () => (Math.random() - 0.5) * 0.09;
  let raf = 0;
  function frame(t) {
    for (const w of words) {
      if (t > w.nextPull) {
        const pulling = w.pull[0] === 0 && w.pull[1] === 0 && Math.random() < 0.6;
        const a = Math.random() * Math.PI * 2;
        w.pull = pulling ? [Math.cos(a) * (0.1 + Math.random() * 0.15), Math.sin(a) * 0.1] : [0, 0];
        w.nextPull = t + (pulling ? 250 + Math.random() * 600 : 600 + Math.random() * 1600);
      }
      for (const l of w.letters) {
        if (t < l.next) continue;
        const k = 0.5 + Math.random() * 0.5;
        l.s.style.transform = `translate(${(w.pull[0] * k + jitter()).toFixed(3)}em, ${(w.pull[1] * k + jitter()).toFixed(3)}em) rotate(${((Math.random() - 0.5) * 9).toFixed(1)}deg)`;
        l.next = t + 40 + Math.random() * 90;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  stops.push(() => cancelAnimationFrame(raf));
  return stopAll;
}
