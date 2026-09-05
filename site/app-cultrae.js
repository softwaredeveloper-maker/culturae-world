/* ============================================================
   CULTRAE page runtime.
   The page ships fully rendered (static HTML). This script:
     1. binds behaviours (header, drawer, reveal, scroll-spy)
     2. re-renders when an override exists — a saved draft in this
        browser, or a live preview message from /admin
   ============================================================ */
(function () {
  'use strict';
  var R = window.CULTRAE_RENDER;
  var DRAFT_KEY = 'cultrae_draft';
  var current = null;

  function baseContent() {
    var el = document.getElementById('cultrae-content');
    try { return JSON.parse(el.textContent); } catch (e) { return {}; }
  }

  /* ---------- theme ---------- */
  function applyTheme(content) {
    var st = document.getElementById('cultrae-vars');
    if (st && R) st.textContent = R.cssVars(content.theme);
    var fl = document.getElementById('font-link');
    if (fl && R) {
      var href = R.fontHref(content.theme);
      if (fl.getAttribute('href') !== href) fl.setAttribute('href', href);
    }
    var meta = content.meta || {};
    if (meta.title) document.title = meta.title;
    var d = document.querySelector('meta[name="description"]');
    if (d && meta.description) d.setAttribute('content', meta.description);
    var fav = document.getElementById('favicon');
    if (fav && R) {
      var fh = R.faviconHref(content);
      if (fh) fav.setAttribute('href', fh);
    }
    var eff = (content.theme || {}).effects || {};
    document.documentElement.classList.toggle('no-reveal', eff.reveal === false);
    var bgc = ((content.theme || {}).colors || {}).ink;
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc && bgc) tc.setAttribute('content', bgc);
  }

  /* ---------- behaviours ---------- */
  var bound = { scroll: null };
  function bind() {
    var head = document.getElementById('head');
    var burger = document.getElementById('burger');
    var nav = document.getElementById('nav');
    var scrim = document.getElementById('scrim');

    if (bound.scroll) window.removeEventListener('scroll', bound.scroll);
    if (head) {
      bound.scroll = function () { head.classList.toggle('scrolled', window.scrollY > 12); };
      bound.scroll();
      window.addEventListener('scroll', bound.scroll, { passive: true });
    }

    function setNav(open) {
      if (!nav) return;
      nav.classList.toggle('open', open);
      if (scrim) scrim.classList.toggle('show', open);
      if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    if (burger) burger.addEventListener('click', function () { setNav(!nav.classList.contains('open')); });
    if (scrim) scrim.addEventListener('click', function () { setNav(false); });
    if (nav) nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setNav(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });

    /* reveal */
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    function revealAll() { items.forEach(function (el) { el.classList.add('in'); }); }
    if ('IntersectionObserver' in window && items.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: .08 });
      items.forEach(function (el) { io.observe(el); });
      /* failsafe: text must never stay invisible because the observer misfired */
      setTimeout(function () { if (!document.querySelector('.reveal.in')) revealAll(); }, 2000);
    } else {
      revealAll();
    }

    /* scroll-spy */
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    var targets = links.map(function (a) {
      var h = a.getAttribute('href') || '';
      return h.charAt(0) === '#' ? document.querySelector(h) : null;
    });
    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var i = targets.indexOf(en.target);
          links.forEach(function (a, k) { a.classList.toggle('active', k === i); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      targets.forEach(function (t) { if (t) spy.observe(t); });
    }
  }

  /* ---------- render ---------- */
  function render(content, rerender) {
    current = content;
    applyTheme(content);
    if (rerender && R) {
      var app = document.getElementById('app');
      if (app) app.innerHTML = R.renderBody(content);
    }
    bind();
  }

  /* ---------- boot ---------- */
  var base = baseContent();
  var draft = null;
  try {
    var raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) draft = JSON.parse(raw);
  } catch (e) { draft = null; }

  /* a draft only applies in this browser — it never affects other visitors */
  render(draft || base, !!draft);

  /* ---------- published content ----------
     The page already showed the version baked in at build time. Now check
     the published file for anything newer, so edits made in /admin go live
     for everyone without a redeploy. A local draft always wins (that editor
     is previewing), and any failure silently keeps the built-in content. */
  function looksLikeContent(o) {
    return !!o && typeof o === 'object' && Array.isArray(o.sections) && !!o.theme;
  }
  (function loadPublished() {
    if (draft) return;
    var cfg = window.CULTRAE_PUBLISH || {};
    if (!cfg.rawUrl || typeof fetch !== 'function') return;
    var url = cfg.rawUrl + (cfg.rawUrl.indexOf('?') < 0 ? '?' : '&') + 't=' + Math.floor(Date.now() / 60000);
    fetch(url, { cache: 'no-cache', mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (pub) {
        if (!looksLikeContent(pub)) return;
        if (JSON.stringify(pub) === JSON.stringify(base)) return;   /* already current */
        render(pub, true);
      })
      .catch(function () { /* offline or blocked — built-in content stands */ });
  })();

  /* live preview from the admin page (same-origin only) */
  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin) return;
    var msg = ev.data || {};
    if (msg.type === 'cultrae:preview' && msg.content) render(msg.content, true);
    if (msg.type === 'cultrae:scroll') {
      var t = document.querySelector(msg.selector || '#top');
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  window.CULTRAE = {
    get content() { return current; },
    base: base,
    render: render
  };
})();
