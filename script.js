const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mouse = { x: innerWidth / 2, y: innerHeight * 0.4, moved: false, t: 0 };

/* ---------- Niveaux de performance ----------
   0 = complet, 1 = allégé, 2 = minimal.
   - on part du niveau mémorisé à la visite précédente ;
   - les petites configurations démarrent en allégé ;
   - un affichage sans accélération graphique démarre en minimal ;
   - pendant la visite, on descend d'un cran dès que la cadence s'effondre. */
const softwareGpu = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return true; // WebGL refusé faute d'accélération matérielle
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (e) { return false; }
})();
let tier = 0;
// niveau retenu 7 jours : un ralentissement passager ne bride pas un bon PC indéfiniment
const TIER_TTL = 7 * 24 * 3600e3;
const saveTier = () => { try { localStorage.setItem('perf-tier', `${tier}:${Date.now()}`); } catch (e) {} };
try {
  const [t, at] = (localStorage.getItem('perf-tier') || '').split(':');
  if (Date.now() - at < TIER_TTL) tier = Math.min(2, +t || 0);
} catch (e) {}
const cores = navigator.hardwareConcurrency || 8, memory = navigator.deviceMemory || 8;
if (cores <= 4 || memory <= 4 || navigator.connection?.saveData) tier = Math.max(tier, 1);
if (softwareGpu || memory <= 2 || cores <= 2) tier = 2;
const tierListeners = [];
const applyTierClasses = () => {
  root.classList.toggle('perf-lite', tier >= 1);
  root.classList.toggle('perf-min', tier >= 2);
};
const setTier = (t) => {
  if (t <= tier) return;
  tier = t;
  applyTierClasses();
  saveTier();
  tierListeners.forEach((fn) => fn());
};
applyTierClasses();

/* Animations CSS mises en pause hors écran (elles continuaient de tourner pour rien) */
const animIo = new IntersectionObserver((entries) => {
  entries.forEach((e) => e.target.classList.toggle('anim-off', !e.isIntersecting));
}, { rootMargin: '100px 0px' });
document.querySelectorAll('section, .hof-item, .footer').forEach((el) => animIo.observe(el));

/* Visibilité des blocs animés : on ne calcule rien pour ce qui est hors écran */
const visIo = new IntersectionObserver((entries) => {
  entries.forEach((e) => { e.target._vis = e.isIntersecting; });
}, { rootMargin: '200px 0px' });
const watch = (el) => { if (el) { el._vis = false; visIo.observe(el); } return el; };

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
document.querySelectorAll('.reveal, .hof-title').forEach((el) => io.observe(el));

/* Contact : la signature se trace et les lignes se dévoilent quand le bloc est bien à l'écran */
const footer = document.querySelector('.footer');
const footerIo = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    footerIo.unobserve(entry.target);
  });
}, { threshold: 0.3 });
document.querySelectorAll('.footer-panel, .footer-col').forEach((el) => footerIo.observe(el));
document.querySelectorAll('.footer-col').forEach((col) => {
  [...col.children].forEach((el, i) => el.style.setProperty('--i', i));
});

/* Survol des liens du pied de page : les lettres défilent une à une vers le haut
   et une copie colorée remonte par en dessous */
document.querySelectorAll('.footer-col a').forEach((a) => {
  const text = a.textContent.trim();
  a.setAttribute('aria-label', text);
  a.innerHTML = `<span class="roll" aria-hidden="true">${[...text].map((ch, i) =>
    `<span class="ch" style="--c:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</span>`;
});
// le relief du pied de page n'anime que lorsqu'il est visible
new IntersectionObserver(([e]) => footer.classList.toggle('in-view', e.isIntersecting)).observe(footer);

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

  // Réglages de qualité selon le niveau : grille plus grosse, recalculs plus rares,
  // demi-cadence en allégé ; en minimal le fond est dessiné une fois et reste fixe
  let cell = 14, every = 3, dprMax = 1.5, glows = 2, skip = 1, still = false, dirty = true;
  const quality = () => {
    if (tier >= 2) { cell = 16; dprMax = 1; glows = 0; still = true; }
    else if (tier >= 1) { cell = 18; every = 2; dprMax = 1; glows = 1; skip = 2; }
  };
  quality();
  let cols = 0, rows = 0, values = new Float32Array(0);
  const levels = 16;
  const thresholds = Array.from({ length: levels - 1 }, (_, k) => 0.15 + ((k + 1) / levels) * 0.7);

  const buildPath = (t, offsetY) => {
    const scale = 1 / 260;
    const oy = offsetY / cell;
    const fy = Math.floor(oy);
    const shift = (oy - fy) * cell; // décalage sub-cellule pour un défilement fluide
    for (let j = 0; j < rows; j++) {
      const row = j * cols, fyv = (j + fy) * cell * scale;
      for (let i = 0; i < cols; i++) values[row + i] = field(i * cell * scale, fyv, t);
    }
    // Marching squares, sans aucune allocation dans la boucle
    const path = new Path2D();
    for (let l = 0; l < thresholds.length; l++) {
      const th = thresholds[l];
      for (let j = 0; j < rows - 1; j++) {
        const r0 = j * cols, r1 = r0 + cols;
        const y = j * cell - shift, y2 = y + cell;
        for (let i = 0; i < cols - 1; i++) {
          const a = values[r0 + i], b = values[r0 + i + 1];
          const c = values[r1 + i + 1], d = values[r1 + i];
          const idx = (a > th) | ((b > th) << 1) | ((c > th) << 2) | ((d > th) << 3);
          if (idx === 0 || idx === 15) continue;
          const x = i * cell, x2 = x + cell;
          switch (idx) {
            case 1: case 14: path.moveTo(x, y + cell * (th - a) / (d - a)); path.lineTo(x + cell * (th - a) / (b - a), y); break;
            case 2: case 13: path.moveTo(x + cell * (th - a) / (b - a), y); path.lineTo(x2, y + cell * (th - b) / (c - b)); break;
            case 3: case 12: path.moveTo(x, y + cell * (th - a) / (d - a)); path.lineTo(x2, y + cell * (th - b) / (c - b)); break;
            case 4: case 11: path.moveTo(x2, y + cell * (th - b) / (c - b)); path.lineTo(x + cell * (th - d) / (c - d), y2); break;
            case 6: case 9: path.moveTo(x + cell * (th - a) / (b - a), y); path.lineTo(x + cell * (th - d) / (c - d), y2); break;
            case 7: case 8: path.moveTo(x, y + cell * (th - a) / (d - a)); path.lineTo(x + cell * (th - d) / (c - d), y2); break;
            case 5:
              path.moveTo(x, y + cell * (th - a) / (d - a)); path.lineTo(x + cell * (th - a) / (b - a), y);
              path.moveTo(x2, y + cell * (th - b) / (c - b)); path.lineTo(x + cell * (th - d) / (c - d), y2); break;
            case 10:
              path.moveTo(x + cell * (th - a) / (b - a), y); path.lineTo(x2, y + cell * (th - b) / (c - b));
              path.moveTo(x, y + cell * (th - a) / (d - a)); path.lineTo(x + cell * (th - d) / (c - d), y2); break;
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
  let path = null;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, dprMax);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cols = Math.ceil(w / cell) + 2; rows = Math.ceil(h / cell) + 3;
    values = new Float32Array(cols * rows);
    path = null; dirty = true;
  };
  tierListeners.push(() => { quality(); resize(); });

  // Traînée de la lueur
  const trail = Array.from({ length: 5 }, () => ({ x: mouse.x, y: mouse.y }));
  let energy = 0, prevX = mouse.x, prevY = mouse.y, frameCount = 0;

  const draw = (time) => {
    if (still) {
      if (!dirty) return;
      dirty = false;
      path = buildPath(0, 0);
    } else {
      frameCount++;
      if (frameCount % skip) return; // demi-cadence en mode allégé
      const t = time / 1000 * 0.25;
      // les lignes défilent à 35 % de la vitesse de la page (parallaxe)
      if (!path || (frameCount / skip) % every === 0) path = buildPath(t, scrollY * 0.35);
    }

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
    const speed = Math.hypot(mouse.x - prevX, mouse.y - prevY);
    prevX = mouse.x; prevY = mouse.y;
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
    for (let k = 0; k < glows; k++) {
      const p = trail[k ? trail.length - 1 : 0];
      const r = (180 + energy * 140) * (k ? 0.7 : 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, glowColor);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = k ? 0.45 : 1;
      ctx.strokeStyle = g;
      ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
  };

  const recolor = () => { readColors(); dirty = true; };
  readColors();
  resize();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
  return { draw };
})();

/* ---------- Projets : colonnes qui défilent verticalement à des vitesses opposées ---------- */
const hofGrid = watch(document.querySelector('.hof-grid'));
const hofItems = [...hofGrid.querySelectorAll('.hof-item')];
let hofY = 0, hofWritten = NaN, hofCols = 1;
// nombre de colonnes mis en cache : le lire à chaque image forçait un recalcul des styles
const readHofCols = () => { hofCols = getComputedStyle(hofGrid).gridTemplateColumns.split(' ').length; hofWritten = NaN; };
readHofCols();
addEventListener('resize', readHofCols);

const updateRows = (r) => {
  // -1 quand la grille entre par le bas, +1 quand elle sort par le haut
  const p = Math.max(-1, Math.min(1, ((innerHeight - r.top) / (innerHeight + r.height)) * 2 - 1));
  hofY += (p - hofY) * 0.12;
  if (Math.abs(hofY - hofWritten) < 0.0005) return; // déjà en place : aucune écriture
  hofWritten = hofY;
  const amp = hofCols > 2 ? 70 : 34;
  hofItems.forEach((item, i) => {
    const dir = (i % hofCols) % 2 === 0 ? 1 : -1; // colonnes paires montent, impaires descendent
    item.style.transform = `translate3d(0, ${(dir * hofY * amp).toFixed(2)}px, 0)`;
  });
};

/* ---------- Effets de titres ---------- */

// 1. Lettres du grand titre qui s'élargissent à l'approche de la souris (axe de largeur d'Archivo)
const flexChars = [];
document.querySelectorAll('[data-flex]').forEach((el) => {
  el.innerHTML = [...el.textContent].map((ch) => `<span class="fx">${ch}</span>`).join('');
  el.querySelectorAll('.fx').forEach((span) => flexChars.push({ el: span, w: 62, g: 800, cx: 0, cy: 0 }));
});
const heroTitle = watch(document.querySelector('.mega'));
let flexSettled = true;
// coupé dès le mode allégé : changer la largeur des lettres oblige à recomposer tout le titre
const flexActive = () => tier === 0 && finePointer && mouse.moved && heroTitle._vis && !(flexSettled && performance.now() - mouse.t > 100);
// lecture groupée des positions (une seule mise en page par image)
const readFlex = () => {
  const hr = heroTitle.getBoundingClientRect();
  if (hr.bottom < 0 || hr.top > innerHeight) return 0;
  flexChars.forEach((c) => {
    const r = c.el.getBoundingClientRect();
    c.cx = r.left + r.width / 2; c.cy = r.top + r.height / 2;
  });
  return Math.max(260, hr.height * 0.6);
};
const writeFlex = (reach) => {
  let moving = false;
  flexChars.forEach((c) => {
    const d = Math.hypot(mouse.x - c.cx, mouse.y - c.cy);
    const t = Math.max(0, 1 - d / reach);
    const ease = t * t * (3 - 2 * t);
    const tw = 62 + ease * 26, tg = 800 + ease * 100;
    if (Math.abs(tw - c.w) < 0.05 && Math.abs(tg - c.g) < 0.5) return;
    moving = true;
    c.w += (tw - c.w) * 0.12;
    c.g += (tg - c.g) * 0.12;
    c.el.style.fontVariationSettings = `"wdth" ${c.w.toFixed(1)}, "wght" ${c.g.toFixed(0)}`;
  });
  flexSettled = !moving;
};

// 2. Mot en contour qui se remplit au défilement
const fillTexts = [...document.querySelectorAll('.fill-text')].map((el) => ({ el: watch(el), v: '' }));
const writeFill = (f, top) => {
  const p = (innerHeight * 0.9 - top) / (innerHeight * 0.5);
  const v = `${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}%`;
  if (v !== f.v) { f.v = v; f.el.style.setProperty('--fill', v); }
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

/* ---------- Boucle : fond, phrase et bandeau ----------
   Chaque image : d'abord toutes les lectures (positions), puis toutes les écritures,
   pour éviter les mises en page forcées en cascade. */
const track = watch(document.querySelector('.marquee-track'));
watch(statement);
let marqueeX = 0, velocity = 0, prevScroll = scrollY, marqueeHalf = 0, lastLit = -1;
const fTrack = watch(document.querySelector('.footer-marquee-track'));
let fX = 0, fHalf = 0, fDir = -1;
const readMarquee = () => { marqueeHalf = track.scrollWidth / 2; fHalf = fTrack.scrollWidth / 2; };
readMarquee();
addEventListener('resize', readMarquee);
document.fonts?.ready.then(() => { readMarquee(); readHofCols(); });

// surveillance de la cadence : on descend d'un niveau quand trop d'images sont lentes
// (on attend la fin du chargement, qui est toujours un peu chargé)
let lastTime = 0, samples = 0, slow = 0, monitorFrom = performance.now() + 2000;
const monitor = (time) => {
  const dt = time - lastTime;
  lastTime = time;
  if (tier >= 2 || time < monitorFrom || dt <= 0 || dt > 250) return; // onglet en arrière-plan : on ignore
  samples++;
  if (dt > 22) slow++;
  if (samples >= 60) {
    if (slow > 20) { setTier(tier + 1); monitorFrom = time + 1000; }
    samples = slow = 0;
  }
};

const frame = (time) => {
  requestAnimationFrame(frame);
  monitor(time);
  if (dialog.open) return; // la page est masquée par la fiche projet : inutile d'animer

  // --- lectures ---
  const sr = statement._vis ? statement.getBoundingClientRect() : null;
  const hr = hofGrid._vis ? hofGrid.getBoundingClientRect() : null;
  const reach = flexActive() ? readFlex() : 0;
  const fillTops = fillTexts.map((f) => (f.el._vis ? f.el.getBoundingClientRect().top : null));
  const footerTop = footer.getBoundingClientRect().top;
  const y = scrollY;

  // --- écritures ---
  if (sr) {
    const progress = (innerHeight * 0.85 - sr.top) / (sr.height + innerHeight * 0.35);
    const lit = Math.floor(Math.max(0, Math.min(1, progress)) * words.length);
    if (lit !== lastLit) {
      words.forEach((w, i) => w.classList.toggle('on', i < lit));
      lastLit = lit;
    }
  }

  const delta = y - prevScroll;
  prevScroll = y;
  velocity += (delta - velocity) * 0.1;
  if (track._vis && marqueeHalf) {
    marqueeX -= 1.2 + Math.abs(velocity) * 0.6;
    if (-marqueeX >= marqueeHalf) marqueeX += marqueeHalf;
    track.style.transform = `translate3d(${marqueeX.toFixed(1)}px,0,0)`;
  }

  // bande du pied de page : vers la gauche en descendant, vers la droite en remontant
  if (delta > 0.5) fDir = -1; else if (delta < -0.5) fDir = 1;
  if (fTrack._vis && fHalf) {
    fX += fDir * (0.9 + Math.min(Math.abs(velocity), 60) * 0.5);
    if (fX <= -fHalf) fX += fHalf; else if (fX > 0) fX -= fHalf;
    fTrack.style.transform = `translate3d(${fX.toFixed(1)}px,0,0)`;
  }

  if (hr && tier < 2) updateRows(hr);
  if (reach) writeFlex(reach);
  fillTexts.forEach((f, i) => { if (fillTops[i] !== null) writeFill(f, fillTops[i]); });

  // le fond n'est redessiné que s'il est visible (le pied de page opaque le recouvre en bas)
  if (footerTop > 0) bg.draw(time);
};
if (reducedMotion) {
  words.forEach((w) => w.classList.add('on'));
  bg.draw(0);
  fillTexts.forEach((f) => f.el.style.setProperty('--fill', '100%'));
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
  mouse.t = performance.now();
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
