const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Thème ---------- */
document.querySelector('.theme-toggle').addEventListener('click', () => {
  const current = root.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

/* ---------- Écran de chargement ---------- */
const finishLoading = () => root.classList.add('is-loaded');
if (reducedMotion) {
  finishLoading();
} else {
  const num = document.getElementById('loader-num');
  const start = performance.now();
  const duration = 1300;
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    num.textContent = Math.round((1 - Math.pow(1 - t, 3)) * 100);
    if (t < 1) requestAnimationFrame(tick);
    else setTimeout(finishLoading, 180);
  };
  requestAnimationFrame(tick);
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
const revealTargets = document.querySelectorAll('.reveal, .footer');
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
revealTargets.forEach((el) => io.observe(el));

/* ---------- Lien de navigation actif ---------- */
const navLinks = [...document.querySelectorAll('.nav a')];
const navIo = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean).forEach((s) => navIo.observe(s));

/* ---------- Phrase qui s'allume mot à mot au défilement ---------- */
const statement = document.querySelector('[data-words]');
const highlights = ['rapides,', 'privés,', 'appareil,'];
statement.innerHTML = statement.textContent.trim().split(/\s+/)
  .map((w) => `<span class="w${highlights.includes(w) ? ' hl' : ''}">${w}</span>`).join(' ');
const words = statement.querySelectorAll('.w');

/* ---------- Bandeau défilant (accélère avec le scroll) ---------- */
const track = document.querySelector('.marquee-track');
let marqueeX = 0;
let velocity = 0;
let prevScroll = scrollY;

const frame = () => {
  // phrase
  const r = statement.getBoundingClientRect();
  const progress = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35);
  const lit = Math.floor(Math.max(0, Math.min(1, progress)) * words.length);
  words.forEach((w, i) => w.classList.toggle('on', i < lit));

  // bandeau
  const delta = scrollY - prevScroll;
  prevScroll = scrollY;
  velocity += (delta - velocity) * 0.1;
  if (!reducedMotion) {
    marqueeX -= 1.2 + Math.abs(velocity) * 0.6;
    const half = track.scrollWidth / 2;
    if (-marqueeX >= half) marqueeX += half;
    track.style.transform = `translate3d(${marqueeX}px,0,0)`;
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- Curseur et effets souris ---------- */
if (finePointer && !reducedMotion) {
  root.classList.add('has-cursor');
  const cursor = document.querySelector('.cursor');
  const label = cursor.querySelector('.cursor-label');
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  const pos = { ...mouse };

  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    root.classList.add('cursor-active');
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('cursor-active'));
  addEventListener('pointerdown', () => root.classList.add('cursor-down'));
  addEventListener('pointerup', () => root.classList.remove('cursor-down'));

  document.addEventListener('pointerover', (e) => {
    const link = e.target.closest('a, button');
    const card = e.target.closest('[data-cursor]');
    const showLabel = card && !link;
    root.classList.toggle('cursor-hover', !!link);
    root.classList.toggle('cursor-label-on', !!showLabel);
    if (showLabel) label.textContent = card.dataset.cursor;
  });

  const follow = () => {
    pos.x += (mouse.x - pos.x) * 0.22;
    pos.y += (mouse.y - pos.y) * 0.22;
    cursor.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);

  // Clic n'importe où sur une carte : ouvre le lien principal
  document.querySelectorAll('.card').forEach((card) => {
    const primary = card.querySelector('.link-primary');
    card.addEventListener('click', (e) => {
      if (!e.target.closest('a') && primary) window.open(primary.href, '_blank', 'noopener');
    });

    // Inclinaison 3D, halo et parallaxe
    const maxTilt = card.classList.contains('card-wide') ? 2 : 5;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.classList.add('is-tilting');
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.setProperty('--ry', `${(x - 0.5) * maxTilt * 2}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * maxTilt * 2}deg`);
      card.style.setProperty('--px', `${(x - 0.5) * 20}px`);
      card.style.setProperty('--py', `${(y - 0.5) * 14}px`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      ['--rx', '--ry', '--px', '--py'].forEach((p) => card.style.removeProperty(p));
    });
  });

  // Éléments magnétiques
  document.querySelectorAll('.pill, .theme-toggle, .wordmark, .release-card').forEach((el) => {
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
