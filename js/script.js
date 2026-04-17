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
const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"], .mob-nav-link[href^="#"]'));
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

  // Build sources once
  const sources = pImgs.map(img => {
    const slide = img.closest('.prologue-slide');
    const cap = slide ? slide.getAttribute('data-caption') : '';
    return { src: img.getAttribute('src'), alt: img.getAttribute('alt') || '', caption: cap || '' };
  });

  pImgs.forEach((img, i) => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', e => {
      e.preventDefault();
      lbSources = sources;
      lbCurIdx = i;
      lbNavGo(i);
    });
  });
})();

/* ── Prologue slider ─────────────────────────────────── */
(function() {
  const strip = document.getElementById('ps-strip');
  const slides = Array.from(document.querySelectorAll('.prologue-slide'));
  const caption = document.getElementById('ps-caption');
  const dotsWrap = document.getElementById('ps-dots');
  const prev = document.getElementById('ps-prev');
  const next = document.getElementById('ps-next');
  const curEl = document.getElementById('ps-cur');
  const totEl = document.getElementById('ps-tot');
  const wrap = document.querySelector('.prologue-slider-wrap');
  if (!strip || !wrap || !slides.length) return;

  let idx = 0;
  const total = slides.length;
  if (totEl) totEl.textContent = String(total);

  // Dots
  let dots = [];
  if (dotsWrap) {
    dotsWrap.innerHTML = '';
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ps-dot';
      b.setAttribute('aria-label', `Слайд ${i+1}`);
      b.addEventListener('click', () => go(i, true));
      dotsWrap.appendChild(b);
      dots.push(b);
    });
  }

  // Progress line (Stage 2)
  let prog = wrap.querySelector('.ps-progress');
  let progFill = null;
  if (!prog) {
    prog = document.createElement('div');
    prog.className = 'ps-progress';
    prog.innerHTML = '<div class="ps-progress-fill"></div>';
    wrap.appendChild(prog);
  }
  progFill = prog.querySelector('.ps-progress-fill');

  function setCaption() {
    const s = slides[idx];
    if (!caption) return;
    caption.textContent = s.getAttribute('data-caption') || '';
    caption.setAttribute('aria-live', 'polite');
  }

  function update() {
    if (curEl) curEl.textContent = String(idx + 1);
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === total - 1;
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    slides.forEach((sl, i) => sl.classList.toggle('is-active', i === idx));

    if (progFill) {
      const pct = total <= 1 ? 100 : (idx / (total - 1)) * 100;
      progFill.style.width = pct.toFixed(2) + '%';
    }
  }

  function go(i, smooth) {
    idx = Math.max(0, Math.min(total - 1, i));
    const w = wrap.clientWidth || 1;
    strip.scrollTo({ left: idx * w, behavior: smooth ? 'smooth' : 'auto' });
    setCaption();
    update();
  }

  // Keep idx synced with scroll
  let raf = null;
  strip.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const w = wrap.clientWidth || 1;
      const ni = Math.round(strip.scrollLeft / w);
      const cl = Math.max(0, Math.min(total - 1, ni));
      if (cl !== idx) {
        idx = cl;
        setCaption();
        update();
      }
    });
  }, { passive: true });

  if (prev) prev.addEventListener('click', () => go(idx - 1, true));
  if (next) next.addEventListener('click', () => go(idx + 1, true));

  window.addEventListener('resize', () => go(idx, false));

  // Pointer swipe (Stage 2)
  let down = false, x0 = 0, lx = 0;
  strip.addEventListener('pointerdown', e => {
    down = true; x0 = e.clientX; lx = e.clientX;
    strip.setPointerCapture(e.pointerId);
  });
  strip.addEventListener('pointermove', e => { if (down) lx = e.clientX; });
  strip.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    const dx = lx - x0;
    if (Math.abs(dx) > 42) {
      if (dx < 0) go(idx + 1, true);
      else go(idx - 1, true);
    } else {
      go(idx, true);
    }
  });

  // Keyboard control only when focus is inside prologue
  document.addEventListener('keydown', e => {
    const active = document.activeElement;
    if (!wrap.contains(active)) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(idx - 1, true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1, true); }
  });

  setCaption();
  update();
  go(0, false);
})();

/* ── Font size toggle ─────────────────────────────────── */
(function() {
  const btn = document.getElementById('font-size-btn');
  if (!btn) return;

  const KEY = 'echo_font_scale';
  const body = document.body;

  function apply(scale) {
    body.style.fontSize = scale === 1 ? '' : (17 * scale) + 'px';
    body.classList.toggle('font-lg', scale > 1);
    btn.classList.toggle('active', scale > 1);
  }

  let scale = 1;
  try {
    const saved = parseFloat(localStorage.getItem(KEY) || '1');
    if (!Number.isNaN(saved) && saved >= 1 && saved <= 1.25) scale = saved;
  } catch (_) {}

  apply(scale);

  btn.addEventListener('click', () => {
    scale = (scale >= 1.25) ? 1 : 1.12;
    try { localStorage.setItem(KEY, String(scale)); } catch (_) {}
    apply(scale);
  });
})();

/* ── Mobile nav overlay ──────────────────────────────── */
(function() {
  const btn = document.getElementById('hamburger-btn');
  const overlay = document.getElementById('mobile-nav-overlay');
  if (!btn || !overlay) return;

  const links = Array.from(overlay.querySelectorAll('.mob-nav-link'));

  function openNav() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('mob-nav-open');
  }
  function closeNav() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mob-nav-open');
  }

  btn.addEventListener('click', () => {
    overlay.classList.contains('open') ? closeNav() : openNav();
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) closeNav(); });
  links.forEach(a => a.addEventListener('click', () => closeNav()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeNav(); });
})();

/* ── Scroll progress bar ─────────────────────────────── */
(function() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  let raf = null;
  function tick() {
    raf = null;
    const doc = document.documentElement;
    const max = (doc.scrollHeight - window.innerHeight) || 1;
    const pct = Math.max(0, Math.min(100, (window.scrollY / max) * 100));
    bar.style.width = pct.toFixed(2) + '%';
  }

  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  window.addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(tick); });
  tick();
})();

/* ── Character cards: smooth collapse (Stage 2) ───────── */
(function() {
  const cards = Array.from(document.querySelectorAll('article.char-card'));
  if (!cards.length) return;

  cards.forEach(card => {
    const toggle = card.querySelector('.char-toggle');
    const body = card.querySelector('.char-body');
    if (!toggle || !body) return;

    const inner = body.querySelector('.char-body-inner') || body;

    // Init
    const open = card.classList.contains('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) body.style.height = '0px';

    function setOpen(on) {
      card.classList.toggle('open', on);
      toggle.setAttribute('aria-expanded', on ? 'true' : 'false');

      if (on) {
        body.style.height = inner.scrollHeight + 'px';
        requestAnimationFrame(() => { body.style.height = 'auto'; });
      } else {
        const h = inner.scrollHeight;
        body.style.height = h + 'px';
        requestAnimationFrame(() => { body.style.height = '0px'; });
      }
    }

    toggle.addEventListener('click', () => setOpen(!card.classList.contains('open')));

    // Recalc on resize when open
    window.addEventListener('resize', () => {
      if (card.classList.contains('open')) {
        body.style.height = inner.scrollHeight + 'px';
        requestAnimationFrame(() => { body.style.height = 'auto'; });
      }
    });
  });
})();

})();
