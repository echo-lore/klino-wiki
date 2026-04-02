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

  // At the very bottom — activate last section
  if (scrollY + viewH >= docH - 4) {
    const last = sectionEls[sectionEls.length - 1];
    if (last && last.id !== lastActiveId) {
      setActive(last.id);
    }
    return;
  }

  // Find the section whose top is closest to 30% from viewport top
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

/* ── Lightbox ─────────────────────────────────────────── */
const lb      = document.getElementById('lb');
const lbImg   = document.getElementById('lb-img');
const lbCap   = document.getElementById('lb-caption');
const lbStage = document.getElementById('lb-stage');
const btnZin  = document.getElementById('lb-zin');
const btnZout = document.getElementById('lb-zout');
const btnRst  = document.getElementById('lb-reset');
const btnCls  = document.getElementById('lb-close');
const btnPrev = document.getElementById('lb-prev');
const btnNext = document.getElementById('lb-next');
const lbCounterEl = document.getElementById('lb-counter');

// Navigation state for multi-image sequences (prologue)
let lbSources = [], lbCurIdx = -1;

let scale = 1, tx = 0, ty = 0;
let drag = false, dsx = 0, dsy = 0, dtx = 0, dty = 0;
let touches = {}, pinchD0 = 0, pinchS0 = 1, pinchMx = 0, pinchMy = 0, ptx0 = 0, pty0 = 0;

function commit() {
  const sw = lbStage.clientWidth, sh = lbStage.clientHeight;
  const iw = lbImg.naturalWidth || 400, ih = lbImg.naturalHeight || 400;
  const sw2 = iw * scale, sh2 = ih * scale;
  lbImg.style.width  = sw2 + 'px';
  lbImg.style.height = sh2 + 'px';
  lbImg.style.left   = ((sw - sw2) / 2 + tx) + 'px';
  lbImg.style.top    = ((sh - sh2) / 2 + ty) + 'px';
  lbImg.style.transform = 'none';
}

function clamp(v) { return Math.min(10, Math.max(0.08, v)); }

function zoomAt(factor, px, py) {
  const sw = lbStage.clientWidth, sh = lbStage.clientHeight;
  const vx = px - sw / 2, vy = py - sh / 2;
  const ns = clamp(scale * factor);
  tx = vx - (vx - tx) * (ns / scale);
  ty = vy - (vy - ty) * (ns / scale);
  scale = ns; commit();
}

function zoomCenter(f) { zoomAt(f, lbStage.clientWidth / 2, lbStage.clientHeight / 2); }

function fitImage() {
  const sw = lbStage.clientWidth, sh = lbStage.clientHeight;
  const iw = lbImg.naturalWidth, ih = lbImg.naturalHeight;
  if (!iw || !ih || !sw || !sh) { scale = 1; tx = 0; ty = 0; commit(); return; }
  scale = Math.min(sw / iw, sh / ih, 1);
  tx = 0; ty = 0; commit();
}

function updateNavUI() {
  const hasNav = lbSources.length > 1;
  btnPrev.hidden = !hasNav;
  btnNext.hidden = !hasNav;
  if (hasNav) {
    btnPrev.disabled = lbCurIdx === 0;
    btnNext.disabled = lbCurIdx === lbSources.length - 1;
    lbCounterEl.textContent = (lbCurIdx + 1) + '\u2009/\u2009' + lbSources.length;
    lbCounterEl.classList.add('active');
  } else {
    lbCounterEl.classList.remove('active');
  }
}

function open(src, alt, caption) {
  lbCap.textContent = caption || alt || '';
  lbImg.alt = alt || '';
  lbImg.style.left = '-9999px';
  lbImg.onload = () => { fitImage(); };
  lbImg.src = src;
  // Gallery mode = prologue (has nav); portrait mode = single image
  lb.classList.toggle('lb--gallery', lbSources.length > 1);
  lb.classList.add('on');
  document.body.style.overflow = 'hidden';
  updateNavUI();
}

function lbNavGo(idx) {
  if (!lbSources.length) return;
  idx = Math.max(0, Math.min(lbSources.length - 1, idx));
  lbCurIdx = idx;
  const s = lbSources[idx];
  open(s.src, s.alt, s.caption);
}

function close() {
  lb.classList.remove('on', 'lb--gallery');
  document.body.style.overflow = '';
  lbImg.src = '';
  lbSources = []; lbCurIdx = -1;
  btnPrev.hidden = true; btnNext.hidden = true;
  lbCounterEl.classList.remove('active');
}

btnCls.addEventListener('click', close);
btnZin.addEventListener('click', () => zoomCenter(1.5));
btnZout.addEventListener('click', () => zoomCenter(1 / 1.5));
btnRst.addEventListener('click', fitImage);
btnPrev.addEventListener('click', e => { e.stopPropagation(); lbNavGo(lbCurIdx - 1); });
btnNext.addEventListener('click', e => { e.stopPropagation(); lbNavGo(lbCurIdx + 1); });

lb.addEventListener('click', e => { if (e.target === lb || e.target === lbStage) close(); });
document.addEventListener('keydown', e => {
  if (!lb.classList.contains('on')) return;
  if (e.key === 'Escape') { close(); return; }
  if (lbSources.length > 1) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); lbNavGo(lbCurIdx - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); lbNavGo(lbCurIdx + 1); }
  }
});

lbStage.addEventListener('wheel', e => {
  if (lb.classList.contains('lb--gallery')) return;
  e.preventDefault();
  zoomAt(e.deltaY < 0 ? 1.18 : 0.85, e.offsetX, e.offsetY);
}, { passive: false });

lbStage.addEventListener('mousedown', e => {
  if (lb.classList.contains('lb--gallery')) return;
  drag = true; dsx = e.clientX; dsy = e.clientY; dtx = tx; dty = ty;
  lbStage.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  tx = dtx + e.clientX - dsx;
  ty = dty + e.clientY - dsy;
  commit();
});
window.addEventListener('mouseup', () => { drag = false; lbStage.style.cursor = ''; });

lbStage.addEventListener('touchstart', e => {
  if (lb.classList.contains('lb--gallery')) return;
  touches = {};
  Array.from(e.touches).forEach(t => { touches[t.identifier] = { x: t.clientX, y: t.clientY }; });
  const ids = Object.keys(touches);
  if (ids.length === 1) {
    drag = true; dsx = touches[ids[0]].x; dsy = touches[ids[0]].y; dtx = tx; dty = ty;
  } else if (ids.length === 2) {
    drag = false;
    const a = touches[ids[0]], b = touches[ids[1]];
    pinchD0 = Math.hypot(b.x - a.x, b.y - a.y);
    pinchS0 = scale;
    pinchMx = (a.x + b.x) / 2 - lbStage.getBoundingClientRect().left;
    pinchMy = (a.y + b.y) / 2 - lbStage.getBoundingClientRect().top;
    ptx0 = tx; pty0 = ty;
  }
}, { passive: true });

lbStage.addEventListener('touchmove', e => {
  e.preventDefault();
  Array.from(e.touches).forEach(t => { touches[t.identifier] = { x: t.clientX, y: t.clientY }; });
  const ids = Object.keys(touches);
  if (ids.length === 1 && drag) {
    tx = dtx + touches[ids[0]].x - dsx;
    ty = dty + touches[ids[0]].y - dsy;
    commit();
  } else if (ids.length === 2) {
    const a = touches[ids[0]], b = touches[ids[1]];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const ns = clamp(pinchS0 * (d / pinchD0));
    const mx = (a.x + b.x) / 2 - lbStage.getBoundingClientRect().left;
    const my = (a.y + b.y) / 2 - lbStage.getBoundingClientRect().top;
    const sw = lbStage.clientWidth, sh = lbStage.clientHeight;
    const vx = pinchMx - sw / 2, vy = pinchMy - sh / 2;
    tx = vx - (vx - ptx0) * (ns / pinchS0) + (mx - pinchMx);
    ty = vy - (vy - pty0) * (ns / pinchS0) + (my - pinchMy);
    scale = ns; commit();
  }
}, { passive: false });

lbStage.addEventListener('touchend', e => {
  Array.from(e.changedTouches).forEach(t => { delete touches[t.identifier]; });
  if (Object.keys(touches).length === 0) drag = false;
}, { passive: true });

// Character card images — lightbox disabled, portraits are display-only

// Prologue images — gallery mode with prev/next
(function() {
  const pImgs = Array.from(document.querySelectorAll('.prologue-slide img'));
  if (!pImgs.length) return;
  const sources = pImgs.map(im => ({
    src: im.src,
    alt: im.alt,
    caption: im.closest('.prologue-slide')?.dataset.caption || im.alt
  }));
  pImgs.forEach((img, i) => {
    img.addEventListener('click', () => {
      lbSources = sources;
      lbCurIdx = i;
      open(sources[i].src, sources[i].alt, sources[i].caption);
    });
  });
})();

/* ── Prologue Slider ─────────────────────────────────── */
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

  // Build dots
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

  // Touch swipe
  let ts = 0, tx2 = 0;
  strip.addEventListener('touchstart', e => { ts = e.touches[0].clientX; }, { passive: true });
  strip.addEventListener('touchend', e => {
    tx2 = e.changedTouches[0].clientX;
    const d = ts - tx2;
    if (Math.abs(d) > 45) go(d > 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  // Keyboard — only when lightbox is closed
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('on')) {
      if (e.key === 'ArrowLeft') go(cur - 1);
      if (e.key === 'ArrowRight') go(cur + 1);
    }
  });

  go(0);
})();

/* ── Stars canvas ────────────────────────────────────── */
(function() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  // Skip stars on reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Skip on coarse pointer (touch) devices with small screens for performance
  const isMobile = window.innerWidth <= 720 && window.matchMedia('(pointer: coarse)').matches;
  if (isMobile && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function initStars() {
    // Reduce count: cap lower for perf, especially mobile
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
    // Throttle to ~30fps for performance
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

/* ── Back to top ─────────────────────────────────────── */
(function() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  let bttRaf = null;
  window.addEventListener('scroll', () => {
    if (!bttRaf) bttRaf = requestAnimationFrame(() => {
      btn.classList.toggle('visible', window.scrollY > 500);
      bttRaf = null;
    });
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
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

/* ── Custom cursor ───────────────────────────────────── */
(function() {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const cur = document.createElement('div');
  cur.id = 'custom-cursor';
  cur.innerHTML = '<div class="cur-outer"></div><div class="cur-inner"></div>';
  document.body.appendChild(cur);

  let mx = -100, my = -100, cx = -100, cy = -100, raf;

  function loop() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cur.style.left = cx + 'px';
    cur.style.top  = cy + 'px';
    raf = requestAnimationFrame(loop);
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });

  document.addEventListener('mouseleave', () => { cur.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { cur.style.opacity = ''; });

  document.addEventListener('mouseover', e => {
    const t = e.target;
    const isClickable = t.closest('a, button, [role="button"], .char-card, .ps-btn, .lb-btn, .tag-filter-btn, .img-slot img, .utab-btn');
    const isText = t.closest('p, h2, h3, blockquote, .prologue-text, .tl-text, .char-body, .upanel');
    document.body.classList.toggle('cur-hover', !!isClickable);
    document.body.classList.toggle('cur-text',  !isClickable && !!isText);
  }, { passive: true });
})();

/* ── Echo quote button ───────────────────────────────── */
(function() {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const btn = document.createElement('button');
  btn.id = 'echo-quote-btn';
  btn.textContent = 'Сохранить эхо';
  document.body.appendChild(btn);

  let hideTimer;
  function show(x, y) {
    btn.style.display = 'block';
    const bw = 162;
    btn.style.left = Math.min(x, window.innerWidth - bw - 12) + 'px';
    btn.style.top  = (y - 44) + 'px';
    btn.classList.remove('copied');
    btn.textContent = 'Сохранить эхо';
    clearTimeout(hideTimer);
  }
  function hide() { hideTimer = setTimeout(() => { btn.style.display = 'none'; }, 200); }

  document.addEventListener('mouseup', e => {
    if (e.target === btn) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text.length < 15) { hide(); return; }
      const range = sel.getRangeAt(0);
      const inMain = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer.closest('main')
        : range.commonAncestorContainer.parentElement?.closest('main');
      if (!inMain) { hide(); return; }
      show(e.clientX, e.clientY);
    }, 10);
  });

  document.addEventListener('mousedown', e => { if (e.target !== btn) hide(); });

  btn.addEventListener('click', () => {
    const sel  = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return;
    const quote = `«${text}»\n— Эхо Безликих · Лоркомпендиум KlinoArt`;
    navigator.clipboard.writeText(quote).then(() => {
      btn.classList.add('copied'); btn.textContent = '✓ Скопировано';
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { btn.style.display = 'none'; }, 1700);
      window.getSelection()?.removeAllRanges();
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = quote;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      btn.classList.add('copied'); btn.textContent = '✓ Скопировано';
      hideTimer = setTimeout(() => { btn.style.display = 'none'; }, 1700);
    });
  });

  btn.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  btn.addEventListener('mouseleave', hide);
})();

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
  // Restore preference
  try { if (localStorage.getItem(KEY) === '1') apply(true); } catch(e) {}
  btn.addEventListener('click', () => {
    apply(!document.documentElement.classList.contains('font-large'));
  });
})();

/* ── Collapsible character cards ─────────────────────── */
(function() {
  const cards = document.querySelectorAll('article.char-card');
  cards.forEach(card => {
    const body = card.querySelector('.char-body');
    if (!body || body.querySelectorAll('.char-field').length < 4) return;

    const btn = document.createElement('button');
    btn.className = 'char-collapse-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Свернуть / развернуть');
    btn.textContent = 'Свернуть';
    card.querySelector('.char-info').appendChild(btn);

    btn.addEventListener('click', () => {
      const collapsed = card.classList.toggle('char-card--collapsed');
      btn.textContent = collapsed ? 'Развернуть' : 'Свернуть';
    });
  });
})();


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
