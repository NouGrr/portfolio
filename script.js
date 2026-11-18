const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mouse = { x: innerWidth / 2, y: innerHeight * 0.4, moved: false };

/* ---------- Thème ---------- */
document.querySelector('.theme-toggle').addEventListener('click', () => {
  const current = root.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

/* ---------- Rechargement : on repart du haut, effets remis à zéro ---------- */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);
addEventListener('pageshow', (e) => {
  // retour arrière depuis le cache : on rejoue aussi le chargement
  if (e.persisted) location.reload();
});

/* ---------- Écran de chargement ---------- */
const finishLoading = () => root.classList.add('is-loaded');
if (reducedMotion) {
  finishLoading();
} else {
  // le logo se dessine (≈1,1 s) puis se remplit : on lève l'écran juste après
  setTimeout(finishLoading, 1750);
}

/* ---------- En-tête masqué en descendant ---------- */
const header = document.querySelector('.site-header');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  header.classList.toggle('is-hidden', y > lastY && y > 300);
  lastY = y;
}, { passive: true });

/* ---------- Apparitions ---------- */
document.querySelectorAll('.hof-item').forEach((el, i) => el.style.setProperty('--i', i % 4));
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal, .footer, .hof-title').forEach((el) => io.observe(el));

/* ---------- Lien de navigation actif ---------- */
const navLinks = [...document.querySelectorAll('.nav a')];
const navIo = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean).forEach((s) => navIo.observe(s));

/* ---------- Fiche projet ---------- */
const dialog = document.querySelector('.project-dialog');
const pdArt = dialog.querySelector('.pd-art');
const pdBody = dialog.querySelector('.pd-body');
let lastTrigger = null;

document.querySelectorAll('.hof-item').forEach((item) => {
  item.querySelector('.hof-frame').addEventListener('click', (e) => {
    lastTrigger = e.currentTarget;
    dialog.setAttribute('style', item.getAttribute('style'));
    pdArt.replaceChildren(item.querySelector('.hof-art svg').cloneNode(true));
    pdBody.replaceChildren(item.querySelector('.hof-detail').content.cloneNode(true));
    dialog.setAttribute('aria-label', 'Détail du projet ' + item.querySelector('.hof-detail').content.querySelector('h3').textContent);
    dialog.showModal();
    root.classList.add('dialog-open');
    document.body.style.overflow = 'hidden';
  });
});
dialog.querySelector('.pd-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  root.classList.remove('dialog-open');
  if (lastTrigger) lastTrigger.focus({ preventScroll: true });
});

/* ---------- Phrase qui s'allume mot à mot au défilement ---------- */
const statement = document.querySelector('[data-words]');
const highlights = ['rapides,', 'privés,', 'appareil,'];
statement.innerHTML = statement.textContent.trim().split(/\s+/)
  .map((w) => `<span class="w${highlights.includes(w) ? ' hl' : ''}">${w}</span>`).join(' ');
const words = statement.querySelectorAll('.w');

/* ---------- Fond : lignes topographiques animées ----------
   Les lignes ondulent lentement, glissent avec le défilement
   et s'allument en citron vert autour du curseur. */
const bg = (() => {
  const canvas = document.querySelector('.bg-lines');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, lineColor = '#0001', glowColor = '#d4ff3a';
  const seed = Math.random() * 1000;

  // Bruit de valeur lissé
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  // Champ animé : déformation du domaine qui évolue avec le temps
  const field = (x, y, t) => {
    const wx = x + 0.35 * Math.sin(t * 0.9 + y * 1.7);
    const wy = y + 0.35 * Math.cos(t * 0.7 + x * 1.3);
    return noise(wx + t * 0.12, wy) * 0.62 + noise(wx * 2.1 + 5.2 - t * 0.2, wy * 2.1 + 1.3) * 0.28 + noise(wx * 4.3, wy * 4.3 + t * 0.3) * 0.1;
  };

  const cell = 12;
  let cols = 0, rows = 0, values = new Float32Array(0);
  const levels = 16;

  const buildPath = (t, offsetY) => {
    const scale = 1 / 260;
    const oy = offsetY / cell;
    const fy = Math.floor(oy);
    const shift = (oy - fy) * cell; // décalage sub-cellule pour un défilement fluide
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        values[j * cols + i] = field(i * cell * scale, (j + fy) * cell * scale, t);
      }
    }
    const path = new Path2D();
    for (let l = 1; l < levels; l++) {
      const th = 0.15 + (l / levels) * 0.7;
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = values[j * cols + i], b = values[j * cols + i + 1];
          const c = values[(j + 1) * cols + i + 1], d = values[(j + 1) * cols + i];
          const idx = (a > th) | ((b > th) << 1) | ((c > th) << 2) | ((d > th) << 3);
          if (idx === 0 || idx === 15) continue;
          const x = i * cell, y = j * cell - shift;
          const top = [x + cell * (th - a) / (b - a), y];
          const right = [x + cell, y + cell * (th - b) / (c - b)];
          const bottom = [x + cell * (th - d) / (c - d), y + cell];
          const left = [x, y + cell * (th - a) / (d - a)];
          const seg = (p, q) => { path.moveTo(p[0], p[1]); path.lineTo(q[0], q[1]); };
          switch (idx) {
            case 1: case 14: seg(left, top); break;
            case 2: case 13: seg(top, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(right, bottom); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, bottom); break;
            case 5: seg(left, top); seg(right, bottom); break;
            case 10: seg(top, right); seg(left, bottom); break;
          }
        }
      }
    }
    return path;
  };

  const readColors = () => {
    const s = getComputedStyle(root);
    lineColor = s.getPropertyValue('--bg-line').trim() || lineColor;
    glowColor = s.getPropertyValue('--bg-glow').trim() || glowColor;
  };
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cols = Math.ceil(w / cell) + 2; rows = Math.ceil(h / cell) + 3;
    values = new Float32Array(cols * rows);
  };

  // Traînée de la lueur
  const trail = Array.from({ length: 5 }, () => ({ x: mouse.x, y: mouse.y }));
  let energy = 0, prev = { x: mouse.x, y: mouse.y }, path = null, frameCount = 0;

  const draw = (time) => {
    const t = time / 1000 * 0.25;
    // les lignes défilent à 35 % de la vitesse de la page (parallaxe)
    if (!path || frameCount++ % 2 === 0) path = buildPath(t, scrollY * 0.35);

    if (!finePointer || !mouse.moved) {
      mouse.x = w * (0.5 + 0.32 * Math.sin(time / 4200));
      mouse.y = h * (0.45 + 0.25 * Math.sin(time / 3100));
    }
    trail[0].x += (mouse.x - trail[0].x) * 0.25;
    trail[0].y += (mouse.y - trail[0].y) * 0.25;
    for (let i = 1; i < trail.length; i++) {
      trail[i].x += (trail[i - 1].x - trail[i].x) * 0.3;
      trail[i].y += (trail[i - 1].y - trail[i].y) * 0.3;
    }
    const speed = Math.hypot(mouse.x - prev.x, mouse.y - prev.y);
    prev = { x: mouse.x, y: mouse.y };
    energy += (Math.min(speed / 40, 1) - energy) * 0.08;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.stroke(path);

    // lueur : on retrace les lignes avec un dégradé radial centré sur la souris
    ctx.lineWidth = 1.6;
    [0, trail.length - 1].forEach((i, k) => {
      const p = trail[i];
      const r = (180 + energy * 140) * (k ? 0.7 : 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, glowColor);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = k ? 0.45 : 1;
      ctx.strokeStyle = g;
      ctx.stroke(path);
    });
    ctx.globalAlpha = 1;
  };

  readColors();
  resize();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); path = null; }, 150); });
  new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  return { draw };
})();

/* ---------- Projets : colonnes qui défilent verticalement à des vitesses opposées ---------- */
const hofGrid = document.querySelector('.hof-grid');
const hofItems = [...hofGrid.querySelectorAll('.hof-item')];
let hofY = 0;

const updateRows = () => {
  if (reducedMotion) return;
  const r = hofGrid.getBoundingClientRect();
  // -1 quand la grille entre par le bas, +1 quand elle sort par le haut
  const p = Math.max(-1, Math.min(1, ((innerHeight - r.top) / (innerHeight + r.height)) * 2 - 1));
  hofY += (p - hofY) * 0.12;
  const cols = getComputedStyle(hofGrid).gridTemplateColumns.split(' ').length;
  const amp = cols > 2 ? 70 : 34;
  hofItems.forEach((item, i) => {
    const dir = (i % cols) % 2 === 0 ? 1 : -1; // colonnes paires montent, impaires descendent
    item.style.transform = `translate3d(0, ${(dir * hofY * amp).toFixed(2)}px, 0)`;
  });
};

/* ---------- Effets de titres ---------- */

// 1. Lettres du grand titre qui s'élargissent à l'approche de la souris (axe de largeur d'Archivo)
const flexChars = [];
document.querySelectorAll('[data-flex]').forEach((el) => {
  el.innerHTML = [...el.textContent].map((ch) => `<span class="fx">${ch}</span>`).join('');
  el.querySelectorAll('.fx').forEach((span) => flexChars.push({ el: span, w: 62, g: 800 }));
});
const heroTitle = document.querySelector('.mega');
const updateFlex = () => {
  if (!finePointer || !mouse.moved) return;
  const hr = heroTitle.getBoundingClientRect();
  if (hr.bottom < 0 || hr.top > innerHeight) return;
  const reach = Math.max(260, hr.height * 0.6);
  flexChars.forEach((c) => {
    const r = c.el.getBoundingClientRect();
    const d = Math.hypot(mouse.x - (r.left + r.width / 2), mouse.y - (r.top + r.height / 2));
    const t = Math.max(0, 1 - d / reach);
    const ease = t * t * (3 - 2 * t);
    c.w += (62 + ease * 26 - c.w) * 0.12;
    c.g += (800 + ease * 100 - c.g) * 0.12;
    c.el.style.fontVariationSettings = `"wdth" ${c.w.toFixed(1)}, "wght" ${c.g.toFixed(0)}`;
  });
};

// 2. Mot en contour qui se remplit au défilement
const fillTexts = [...document.querySelectorAll('.fill-text')];
const updateFill = () => {
  fillTexts.forEach((el) => {
    const r = el.getBoundingClientRect();
    const p = (innerHeight * 0.9 - r.top) / (innerHeight * 0.5);
    el.style.setProperty('--fill', `${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}%`);
  });
};

// 3. Lettres brouillées qui se remettent en place
const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/';
const scramble = (el) => {
  if (el._scrambling) return;
  el._scrambling = true;
  const text = el.dataset.text || (el.dataset.text = el.textContent);
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', text);
  const total = 18 + text.length;
  let frameNo = 0;
  const step = () => {
    const done = Math.floor((frameNo / total) * text.length * 1.4 - 2);
    el.innerHTML = [...text].map((ch, i) => {
      if (ch === ' ' || i <= done) return ch;
      return `<span class="sc" aria-hidden="true">${glyphs[Math.floor(Math.random() * glyphs.length)]}</span>`;
    }).join('');
    frameNo++;
    if (done < text.length) setTimeout(step, 32);
    else { el.textContent = text; el._scrambling = false; }
  };
  step();
};
if (!reducedMotion) {
  const scIo = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => scramble(entry.target), 250);
      scIo.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-scramble]').forEach((el) => scIo.observe(el));
  document.querySelectorAll('[data-scramble-hover]').forEach((el) => {
    el.closest('li').addEventListener('pointerenter', () => scramble(el));
  });
}

/* ---------- Boucle : fond, phrase et bandeau ---------- */
const track = document.querySelector('.marquee-track');
let marqueeX = 0, velocity = 0, prevScroll = scrollY;

const frame = (time) => {
  const r = statement.getBoundingClientRect();
  const progress = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35);
  const lit = Math.floor(Math.max(0, Math.min(1, progress)) * words.length);
  words.forEach((w, i) => w.classList.toggle('on', i < lit));

  const delta = scrollY - prevScroll;
  prevScroll = scrollY;
  velocity += (delta - velocity) * 0.1;
  marqueeX -= 1.2 + Math.abs(velocity) * 0.6;
  const half = track.scrollWidth / 2;
  if (-marqueeX >= half) marqueeX += half;
  track.style.transform = `translate3d(${marqueeX}px,0,0)`;

  bg.draw(time);
  updateRows();
  updateFlex();
  updateFill();
  requestAnimationFrame(frame);
};
if (reducedMotion) {
  words.forEach((w) => w.classList.add('on'));
  bg.draw(0);
  fillTexts.forEach((el) => el.style.setProperty('--fill', '100%'));
} else {
  requestAnimationFrame(frame);
}

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- Curseur et effets souris ---------- */
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.moved = true;
}, { passive: true });

if (finePointer && !reducedMotion) {
  root.classList.add('has-cursor');

  // Éléments magnétiques
  document.querySelectorAll('.pill, .theme-toggle, .site-header .logo, .release-card').forEach((el) => {
    el.classList.add('magnetic');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.classList.add('is-pulled');
      el.style.setProperty('--tx', `${(e.clientX - r.left - r.width / 2) * 0.25}px`);
      el.style.setProperty('--ty', `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-pulled');
      el.style.removeProperty('--tx');
      el.style.removeProperty('--ty');
    });
  });
}
