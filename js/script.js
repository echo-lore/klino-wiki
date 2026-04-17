(function () {
'use strict';

/* ── Reveal animation ─────────────────────────────────── */
document.documentElement.classList.add('js-ready');
const revealEls = Array.from(document.querySelectorAll('.reveal'));

const revealFallback = setTimeout(() => {
  revealEls.forEach(el => el.classList.add('visible'));
}, 700);

const ro = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      ro.unobserve(e.target);
    }
  });
}, { threshold: 0, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach(el => ro.observe(el));

window.addEventListener('load', () => {
  clearTimeout(revealFallback);
  revealEls.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) el.classList.add('visible');
  });
}, { once: true });

/* ── Active nav on scroll ─────────────────────────────── */
const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"]'));
const sectionEls = navLinks
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

let navRaf = null;
let lastActiveId = '';

function updateActiveNav() {
  navRaf = null;
  const scrollY = window.scrollY;
  const viewH = window.innerHeight;
  const docH = document.documentElement.scrollHeight;

  if (scrollY + viewH >= docH - 4) {
    const last = sectionEls[sectionEls.length - 1];
    if (last && last.id !== lastActiveId) {
      setActive(last.id);
    }
    return;
  }

  const threshold = scrollY + viewH * 0.30;
  let best = null;
  for (const s of sectionEls) {
    const top = s.getBoundingClientRect().top + scrollY;
    if (top <= threshold) best = s;
    else break;
  }
  const id = best ? best.id : (sectionEls[0] ? sectionEls[0].id : '');
  if (id && id !== lastActiveId) setActive(id);
}

function setActive(id) {
  lastActiveId = id;
  navLinks.forEach(a => {
    const matches = a.getAttribute('href') === '#' + id;
    a.classList.toggle('active', matches);
  });
}

window.addEventListener('scroll', () => {
  if (!navRaf) navRaf = requestAnimationFrame(updateActiveNav);
}, { passive: true });

window.addEventListener('load', updateActiveNav, { once: true });
updateActiveNav();

/* ── Universe level tabs ─────────────────────────────── */
(function() {
  const tabBtns  = Array.from(document.querySelectorAll('.utab-btn'));
  const panels   = Array.from(document.querySelectorAll('.upanel'));
  if (!tabBtns.length) return;

  function activateTab(tabId) {
    tabBtns.forEach(b => {
      const on = b.dataset.tab === tabId;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.id === 'upanel-' + tabId;
      p.classList.toggle('active', on);
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
})();

/* ── Search / filter ─────────────────────────────────── */
const searchInput = document.getElementById('search-input');
const searchCount = document.getElementById('search-count');
const searchClear = document.getElementById('search-clear');
const noResults   = document.getElementById('no-results');
const allCards    = Array.from(document.querySelectorAll('article.char-card'));

const cardData = allCards.map(card => ({
  el:   card,
  text: card.textContent.toLowerCase()
}));

function runSearch() {
  const raw = searchInput.value;
  const q   = raw.trim().toLowerCase();
  searchClear.classList.toggle('visible', raw.length > 0);

  if (!q) {
    allCards.forEach(c => c.classList.remove('hidden'));
    searchCount.textContent = '';
    if (noResults) noResults.style.display = 'none';
    return;
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  let shown = 0;

  cardData.forEach(({ el, text }) => {
    const match = tokens.every(t => text.includes(t));
    el.classList.toggle('hidden', !match);
    if (match) shown++;
  });

  searchCount.textContent = shown > 0 ? `${shown} из ${allCards.length}` : '';
  if (noResults) noResults.style.display = shown === 0 ? 'block' : 'none';

  if (shown > 0) {
    const charSection = document.getElementById('characters');
    if (charSection) {
      const topbar = document.querySelector('.topbar');
      const offset = topbar ? topbar.offsetHeight + 8 : 60;
      window.scrollTo({ top: charSection.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    }
  }
}

searchInput.addEventListener('input', runSearch);
searchClear.addEventListener('click', () => { searchInput.value = ''; runSearch(); searchInput.focus(); });
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { searchInput.value = ''; runSearch(); searchInput.blur(); }
});

/* ── Keyboard shortcut: press "/" to focus search ────── */
(function() {
  document.addEventListener('keydown', e => {
    if (e.key !== '/') return;
    const tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    const inp = document.getElementById('search-input');
    if (inp) { inp.focus(); inp.select(); }
  });
})();

/* ── Font size toggle ────────────────────────────────── */
(function() {
  const btn = document.getElementById('font-size-btn');
  if (!btn) return;
  const KEY = 'echolore-fontlarge';
  function apply(large) {
    document.documentElement.classList.toggle('font-large', large);
    btn.classList.toggle('active', large);
    try { localStorage.setItem(KEY, large ? '1' : '0'); } catch(e) {}
  }
  try { if (localStorage.getItem(KEY) === '1') apply(true); } catch(e) {}
  btn.addEventListener('click', () => {
    apply(!document.documentElement.classList.contains('font-large'));
  });
})();

/* ── Tag filter ──────────────────────────────────────── */
(function() {
  const bar     = document.getElementById('tag-filter-bar');
  const countEl = document.getElementById('tag-filter-count');
  if (!bar) return;
  const btns  = bar.querySelectorAll('.tag-filter-btn');
  const cards = Array.from(document.querySelectorAll('#characters .char-card'));

  function getFilters(card) {
    const filters = new Set(['all']);
    card.querySelectorAll('.char-tags .tag').forEach(t => {
      const cls = Array.from(t.classList).find(c => c !== 'tag');
      if (cls) filters.add(cls);
    });
    return filters;
  }

  function applyFilter(filter) {
    let visible = 0;
    cards.forEach(card => {
      const show = getFilters(card).has(filter);
      card.classList.toggle('tag-hidden', !show);
      if (show) visible++;
    });
    if (countEl) {
      countEl.textContent = filter === 'all'
        ? cards.length + ' персонажей'
        : visible + ' из ' + cards.length;
    }
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  if (countEl) countEl.textContent = cards.length + ' персонажей';
})();

/* ── Relationships filter ────────────────────────────── */
(function() {
  const btns = Array.from(document.querySelectorAll('.rel-filter-btn'));
  const items = Array.from(document.querySelectorAll('.rel-item'));
  
  if (!btns.length) return;

  function applyFilter(filter) {
    items.forEach(item => {
      if (filter === 'all') {
        item.style.display = 'grid';
      } else {
        item.style.display = item.dataset.relType === filter ? 'grid' : 'none';
      }
    });
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  applyFilter('all');
})();

/* ── Prologue Slider ─────────────────────────────── */
(function() {
  const strip  = document.getElementById('ps-strip');
  const dotsEl = document.getElementById('ps-dots');
  const capEl  = document.getElementById('ps-caption');
  const curEl  = document.getElementById('ps-cur');
  const totEl  = document.getElementById('ps-tot');
  const prevBtn = document.getElementById('ps-prev');
  const nextBtn = document.getElementById('ps-next');
  if (!strip) return;

  const slides = Array.from(strip.querySelectorAll('.prologue-slide'));
  const N = slides.length;
  let cur = 0;
  totEl.textContent = N;

  slides.forEach((_, i) => {
    const d = document.createElement('button');
    d.className = 'ps-dot' + (i === 0 ? ' on' : '');
    d.setAttribute('aria-label', `Слайд ${i + 1}`);
    d.addEventListener('click', () => go(i));
    dotsEl.appendChild(d);
  });

  function go(n) {
    cur = Math.max(0, Math.min(N - 1, n));
    strip.style.transform = `translateX(-${cur * 100}%)`;
    curEl.textContent = cur + 1;
    capEl.textContent = slides[cur].dataset.caption || '';
    Array.from(dotsEl.children).forEach((d, i) => d.classList.toggle('on', i === cur));
    prevBtn.disabled = cur === 0;
    nextBtn.disabled = cur === N - 1;
  }

  prevBtn.addEventListener('click', () => go(cur - 1));
  nextBtn.addEventListener('click', () => go(cur + 1));

  let ts = 0, tx2 = 0;
  strip.addEventListener('touchstart', e => { ts = e.touches[0].clientX; }, { passive: true });
  strip.addEventListener('touchend', e => {
    tx2 = e.changedTouches[0].clientX;
    const d = ts - tx2;
    if (Math.abs(d) > 45) go(d > 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') go(cur - 1);
    if (e.key === 'ArrowRight') go(cur + 1);
  });

  go(0);
})();

/* ── Stars canvas ────────────────────────────────────── */
(function() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const isMobile = window.innerWidth <= 720 && window.matchMedia('(pointer: coarse)').matches;
  if (isMobile && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function initStars() {
    const count = Math.min(Math.floor((W * H) / 8000), 180);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.05 + 0.20,
        alpha: Math.random() * 0.55 + 0.15,
        speed: Math.random() * 0.003 + 0.001,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.12
          ? (Math.random() < 0.5 ? 'rgba(212,169,62,' : 'rgba(180,78,78,')
          : 'rgba(228,220,206,'
      });
    }
  }

  let raf;
  let lastT = 0;
  function draw(t) {
    raf = requestAnimationFrame(draw);
    if (t - lastT < 32) return;
    lastT = t;
    ctx.clearRect(0, 0, W, H);
    const time = t * 0.001;
    for (const s of stars) {
      const a = s.alpha * (0.5 + 0.5 * Math.sin(time * s.speed * 60 + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.hue + a.toFixed(3) + ')';
      ctx.fill();
    }
  }

  window.addEventListener('resize', () => { resize(); initStars(); }, { passive: true });
  resize(); initStars();
  raf = requestAnimationFrame(draw);
})();

/* ── Scroll progress bar ─────────────────────────────── */
(function() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  let spRaf = null;
  function update() {
    spRaf = null;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (docH > 0 ? Math.min(100, (scrollTop / docH) * 100) : 0) + '%';
  }
  window.addEventListener('scroll', () => {
    if (!spRaf) spRaf = requestAnimationFrame(update);
  }, { passive: true });
  update();
})();

/* ── Abilities filter ────────────────────────────────── */
(function() {
  const filterBtns = Array.from(document.querySelectorAll('.ability-filter-btn'));
  const abilityCards = Array.from(document.querySelectorAll('.ability-card'));

  if (!filterBtns.length) return;

  function applyFilter(filter) {
    abilityCards.forEach(card => {
      if (filter === 'all') {
        card.style.display = 'flex';
      } else {
        card.style.display = card.dataset.filter === filter ? 'flex' : 'none';
      }
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  applyFilter('all');
})();

/* ── Relationship Graph Visualization ─────────────── */
(function() {
  const canvas = document.getElementById('relationship-graph');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationId = null;
  let hoveredNode = null;

  const nodes = [
    { id: 'setri', label: 'Сетри', color: '#c06060', faction: 'silv', x: 0, y: 0 },
    { id: 'sai', label: 'Сай', color: '#c06060', faction: 'silv', x: 0, y: 0 },
    { id: 'sedas', label: 'Альбатар', color: '#c06060', faction: 'silv', x: 0, y: 0 },
    { id: 'matra', label: 'Матра', color: '#c06060', faction: 'silv', x: 0, y: 0 },
    { id: 'alester', label: 'Алестер', color: '#a070d8', faction: 'thair', x: 0, y: 0 },
    { id: 'daller', label: 'Даллер', color: '#a070d8', faction: 'thair', x: 0, y: 0 },
    { id: 'mor', label: 'Мор', color: '#a070d8', faction: 'thair', x: 0, y: 0 },
    { id: 'dallas', label: 'Даллас', color: '#78b8e8', faction: 'kvant', x: 0, y: 0 },
    { id: 'jake', label: 'Джейк', color: '#78b8e8', faction: 'kvant', x: 0, y: 0 },
    { id: 'teij', label: 'Тейдж', color: '#55a878', faction: 'living', x: 0, y: 0 },
    { id: 'neil', label: 'Нейл', color: '#55a878', faction: 'living', x: 0, y: 0 },
    { id: 'sota', label: 'Сота', color: '#d4a93e', faction: 'special', x: 0, y: 0 },
    { id: 'kota', label: 'Кота', color: '#9090b0', faction: 'mystery', x: 0, y: 0 },
    { id: 'tora', label: 'Тора', color: '#d08840', faction: 'anomaly', x: 0, y: 0 }
  ];

  const connections = [
    { from: 'setri', to: 'sota', type: 'close' },
    { from: 'setri', to: 'teij', type: 'close' },
    { from: 'sai', to: 'sedas', type: 'close' },
    { from: 'sedas', to: 'matra', type: 'close' },
    { from: 'dallas', to: 'setri', type: 'close' },
    { from: 'neil', to: 'teij', type: 'close' },
    { from: 'alester', to: 'daller', type: 'family' },
    { from: 'jake', to: 'dallas', type: 'family' },
    { from: 'mor', to: 'daller', type: 'loyalty' },
  ];

  function initializePositions() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
      node.vx = 0;
      node.vy = 0;
    });
  }

  function updatePositions() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const k = 80;
    const c = 0.1;
    const repulsion = 5000;

    nodes.forEach(node => {
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 10) {
        node.vx += (dx / dist) * 0.02;
        node.vy += (dy / dist) * 0.02;
      }

      nodes.forEach(other => {
        if (node === other) return;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        if (dist < 300) {
          const force = repulsion / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
      });

      connections.forEach(conn => {
        if (conn.from === node.id) {
          const other = nodes.find(n => n.id === conn.to);
          if (other) {
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const force = (dist - 120) * k / dist;
            node.vx += (dx / dist) * force * 0.05;
            node.vy += (dy / dist) * force * 0.05;
          }
        }
      });

      node.vx *= c;
      node.vy *= c;
      node.x += node.vx;
      node.y += node.vy;

      const margin = 40;
      node.x = Math.max(margin, Math.min(canvas.width - margin, node.x));
      node.y = Math.max(margin, Math.min(canvas.height - margin, node.y));
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    connections.forEach(conn => {
      const from = nodes.find(n => n.id === conn.from);
      const to = nodes.find(n => n.id === conn.to);
      if (!from || !to) return;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);

      if (conn.type === 'close') {
        ctx.strokeStyle = 'rgba(212,169,62,0.5)';
        ctx.lineWidth = 2.5;
      } else if (conn.type === 'family') {
        ctx.strokeStyle = 'rgba(136,112,208,0.5)';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(85,168,120,0.4)';
        ctx.lineWidth = 1.5;
      }

      if (hoveredNode && (conn.from === hoveredNode.id || conn.to === hoveredNode.id)) {
        ctx.globalAlpha = 1;
        ctx.lineWidth += 1;
      } else if (hoveredNode) {
        ctx.globalAlpha = 0.2;
      } else {
        ctx.globalAlpha = 1;
      }

      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    nodes.forEach(node => {
      const isHovered = hoveredNode && hoveredNode.id === node.id;
      const isConnected = hoveredNode && connections.some(c => 
        (c.from === hoveredNode.id && c.to === node.id) ||
        (c.to === hoveredNode.id && c.from === node.id)
      );

      ctx.beginPath();
      ctx.arc(node.x, node.y, isHovered ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      
      if (isHovered) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else if (hoveredNode && !isConnected) {
        ctx.globalAlpha = 0.3;
      }

      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (isHovered) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  function animate() {
    updatePositions();
    draw();
    animationId = requestAnimationFrame(animate);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    hoveredNode = null;
    nodes.forEach(node => {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      if (dist < 12) {
        hoveredNode = node;
      }
    });

    if (hoveredNode) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hoveredNode = null;
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('click', () => {
    if (hoveredNode) {
      window.location.hash = 'char-' + hoveredNode.id;
    }
  });

  resizeCanvas();
  initializePositions();
  animate();

  window.addEventListener('resize', resizeCanvas, { passive: true });

  document.getElementById('graph-character-count').textContent = nodes.length;
  document.getElementById('graph-connection-count').textContent = connections.length;
})();

/* ── View counter ────────────────────────────────────── */
(function() {
  const el = document.getElementById('view-count');
  if (!el) return;
  fetch('https://api.counterapi.dev/v1/echo-lore/klino-wiki/up', { method: 'GET', mode: 'cors' })
    .then(r => r.json())
    .then(data => {
      if (data && data.count !== undefined) el.textContent = data.count.toLocaleString('ru');
    })
    .catch(() => {
      const counter = document.getElementById('view-counter');
      if (counter) counter.style.display = 'none';
    });
})();

})();
