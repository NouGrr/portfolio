document.documentElement.classList.add('js');

// Thème clair / sombre
const root = document.documentElement;
document.querySelector('.theme-toggle').addEventListener('click', () => {
  const current = root.dataset.theme
    || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const next = current === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

// Filtres des projets
const chips = document.querySelectorAll('.chip');
const cards = document.querySelectorAll('.card');
chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const filter = chip.dataset.filter;
    chips.forEach((c) => {
      const active = c === chip;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-pressed', String(active));
    });
    cards.forEach((card) => {
      card.hidden = filter !== 'all' && card.dataset.cat !== filter;
    });
  });
});

// Apparition au défilement
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('is-visible'));
}

// Lien de navigation actif
const navLinks = [...document.querySelectorAll('.nav a')];
const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const navIo = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => navIo.observe(s));

document.getElementById('year').textContent = new Date().getFullYear();

// Effets qui suivent le curseur (souris uniquement, désactivés si mouvement réduit)
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (finePointer && !reducedMotion) {
  root.classList.add('has-cursor');
  const glow = document.querySelector('.cursor-glow');
  const ring = document.querySelector('.cursor-ring');
  const dot = document.querySelector('.cursor-dot');

  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...mouse };
  const glowPos = { ...mouse };

  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    root.classList.add('cursor-active');
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('cursor-active'));
  addEventListener('pointerdown', () => root.classList.add('cursor-down'));
  addEventListener('pointerup', () => root.classList.remove('cursor-down'));

  // Anneau agrandi au survol des éléments cliquables
  document.addEventListener('pointerover', (e) => {
    root.classList.toggle('cursor-hover', !!e.target.closest('a, button'));
  });

  // Boucle d'animation : point exact, anneau et halo avec un léger retard
  const loop = () => {
    ringPos.x += (mouse.x - ringPos.x) * 0.2;
    ringPos.y += (mouse.y - ringPos.y) * 0.2;
    glowPos.x += (mouse.x - glowPos.x) * 0.07;
    glowPos.y += (mouse.y - glowPos.y) * 0.07;
    dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    glow.style.transform = `translate3d(${glowPos.x}px, ${glowPos.y}px, 0)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Cartes : halo, bordure lumineuse, inclinaison 3D et parallaxe de l'illustration
  cards.forEach((card) => {
    const isWide = card.classList.contains('card-wide');
    const maxTilt = isWide ? 2 : 5;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;   // 0 → 1
      const y = (e.clientY - r.top) / r.height;   // 0 → 1
      card.classList.add('is-tilting');
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.setProperty('--ry', `${(x - 0.5) * maxTilt * 2}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * maxTilt * 2}deg`);
      card.style.setProperty('--px', `${(x - 0.5) * 18}px`);
      card.style.setProperty('--py', `${(y - 0.5) * 12}px`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      ['--rx', '--ry', '--px', '--py'].forEach((p) => card.style.removeProperty(p));
    });
  });

  // Boutons magnétiques
  document.querySelectorAll('.btn, .chip, .theme-toggle').forEach((el) => {
    el.classList.add('magnetic');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.classList.add('is-pulled');
      el.style.setProperty('--tx', `${(e.clientX - r.left - r.width / 2) * 0.25}px`);
      el.style.setProperty('--ty', `${(e.clientY - r.top - r.height / 2) * 0.35}px`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-pulled');
      el.style.removeProperty('--tx');
      el.style.removeProperty('--ty');
    });
  });
}
