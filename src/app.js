/* ============================================================
   Heritage Magazine — site engine
   Used in TWO places with the same file:
     1. Inside the Blogger theme (theme.xml) — window.PB_ON_BLOGGER=true,
        feeds are fetched same-origin (/feeds/posts/default...).
     2. On the static Vercel site (site/) — PB_CONFIG.blogUrl points at the
        Blogger blog and feeds are fetched via JSONP (works cross-origin).
        If blogUrl is empty, built-in DEMO content is shown instead.
   Reads window.PB_CONFIG (defined in theme <head> or site/config.js).
   ============================================================ */
(function () {
  'use strict';
  var CFG = window.PB_CONFIG || {};

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return (p[0] ? p[0][0] : '?') + (p[1] ? p[1][0] : '');
  }
  var AVATAR_COLORS = ['#79603c', '#e07b1a', '#1a2c8c', '#5f4b2f', '#0f766e'];
  function avatarColor(name) {
    var h = 0, s = String(name || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }
  function decodeEntities(s) {
    var ta = document.createElement('textarea');
    ta.innerHTML = s;
    return ta.value;
  }
  /* Only allow URLs that cannot smuggle script (config values travel through
     the public SITE-CONFIG page, so schemes are validated at every sink). */
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (u.charAt(0) === '/' || u.charAt(0) === '#') return u;
    if (/^(mailto|tel):/i.test(u)) return u;
    return '';
  }
  function safeImg(u) {
    u = String(u == null ? '' : u).trim();
    if (/^data:image\//i.test(u)) return u;
    return safeUrl(u);
  }
  function blogBase() {
    var u = CFG.blogUrl || '';
    if (u && u.charAt(u.length - 1) !== '/') u += '/';
    return u;
  }

  /* ---------- remote config (the admin page saves here) ----------
     A Blogger PAGE titled SITE-CONFIG holds a JSON block. If present, it
     overrides the local defaults — so edits made in /admin go live on both
     the Vercel site and the Blogger blog without any redeploy. */
  function isPlainObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function mergeCfg(base, over) {
    var out = {}, k;
    for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k]; }
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      out[k] = (isPlainObj(out[k]) && isPlainObj(over[k])) ? mergeCfg(out[k], over[k]) : over[k];
    }
    return out;
  }
  function extractConfigJson(html) {
    /* DOMParser produces an inert document: no scripts run, no images load,
       no event handlers fire — unlike innerHTML on a live element. */
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var pre = doc.querySelector('#pb-site-config');
    var txt = (pre ? pre.textContent : doc.body.textContent) || '';
    var start = txt.indexOf('{'), end = txt.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return JSON.parse(txt.slice(start, end + 1));
  }
  function applyRemoteConfig(data) {
    try {
      var entries = (data && data.feed && data.feed.entry) || [];
      for (var i = 0; i < entries.length; i++) {
        var title = ((entries[i].title && entries[i].title.$t) || '').trim().toUpperCase();
        if (title !== 'SITE-CONFIG') continue;
        var remote = extractConfigJson((entries[i].content && entries[i].content.$t) || '');
        if (remote) {
          /* never let the remote page rewire where config is loaded from,
             and never accept raw HTML fields from it */
          delete remote.blogUrl;
          delete remote.admin;
          if (remote.brand) delete remote.brand.titleHtml;
          CFG = mergeCfg(CFG, remote);
          window.PB_CONFIG = CFG;
        }
        return;
      }
    } catch (e) {
      if (window.console) console.warn('SITE-CONFIG could not be parsed:', e);
    }
  }
  function loadRemoteConfig(done) {
    var base = blogBase();
    if (window.PB_MOCK || (!base && !window.PB_ON_BLOGGER)) { done(); return; }
    var path = 'feeds/pages/default?alt=json' + (base ? '-in-script' : '') + '&max-results=100';
    if (base) {
      feedJSONP(base + path, function (data) { applyRemoteConfig(data); done(); });
    } else {
      fetch('/' + path)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) { applyRemoteConfig(data); done(); })
        .catch(function () { done(); });
    }
  }

  /* Upgrade Blogger thumbnail URLs (s72-c) to a bigger crop. */
  function bigThumb(url, size) {
    if (!url) return null;
    var repl = size || 'w640-h400-p-k-no-nu';
    return url
      .replace(/\/(s|w)\d+(-h\d+)?(-[a-z-]+)?\//, '/' + repl + '/')
      .replace(/=(s|w)\d+(-h\d+)?(-[a-z-]+)?$/, '=' + repl);
  }
  function svgPlaceholder(label, hue1, hue2) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + (hue1 || '#79603c') + '"/>' +
      '<stop offset="1" stop-color="' + (hue2 || '#e07b1a') + '"/></linearGradient></defs>' +
      '<rect width="640" height="400" fill="url(#g)"/>' +
      '<circle cx="320" cy="170" r="58" fill="#ffffff" opacity=".18"/>' +
      '<path d="M298 146l76 24-76 24z" fill="#ffffff" opacity=".55"/>' +
      '<text x="320" y="300" font-family="Georgia,serif" font-size="30" fill="#ffffff" opacity=".85" text-anchor="middle">' +
      String(label || 'Image').replace(/[<>&"]/g, '') + '</text></svg>');
  }
  var PLACEHOLDER = svgPlaceholder('No image', '#1a2438', '#223046');
  window.PB_PLACEHOLDER = PLACEHOLDER;

  /* ---------- built-in demo content (used when no blog is linked) ---------- */
  var DEMO_PALETTES = {
    'Featured': ['#7c2d12', '#e07b1a'], 'News': ['#1a2c8c', '#3b82f6'],
    'Events': ['#7c2d12', '#f59e0b'], 'Obituaries': ['#374151', '#6b7280'],
    'Books': ['#14532d', '#22c55e'], 'Awards': ['#713f12', '#eab308']
  };
  var DEMO_TITLES = {
    'Featured': ['A Night of Kathakali Under the Monsoon Sky', 'The Veena Masters Keeping an Ancient Sound Alive', 'Theyyam: Where Gods Walk Among the Devotees'],
    'News': ['State Academy Announces Fellowships for Young Performers', 'Heritage Theatre Reopens After Two-Year Restoration', 'New Digital Archive to Document Folk Traditions', 'Cultural Exchange Programme Invites Applications', 'Annual Dance Conference Dates Announced'],
    'Events': ['Classical Dance Festival Comes to the River Ghats', 'Weekend Percussion Workshop for Beginners', 'An Evening of Storytelling and Shadow Puppetry', 'Temple Festival Season Opens with Panchavadyam', 'Youth Theatre Collective Stages New Production'],
    'Obituaries': ['Remembering a Beloved Guru of the Old School', 'Folk Singer Who Carried a Century of Songs', 'A Quiet Custodian of a Vanishing Art Form', 'The Drummer Whose Rhythm Defined a Generation', 'Farewell to a Legendary Stage Actress'],
    'Books': ['New Biography Traces a Dancer’s Sixty-Year Journey', 'Illustrated Guide to Temple Murals Released', 'Anthology of Folk Songs Gets English Translation', 'Memoir of a Touring Theatre Troupe Launched', 'Scholars Compile History of Regional Cinema'],
    'Awards': ['National Honours Announced for Senior Artistes', 'Young Percussionist Wins International Prize', 'Lifetime Achievement Award for Veteran Vocalist', 'State Awards Celebrate Folk Art Revival', 'Academy Names This Year’s Yuva Fellows']
  };
  var DEMO_AUTHORS = ['Content Desk', 'Arts Editor', 'Staff Reporter', 'Guest Writer'];
  function demoPosts(label, max) {
    var titles = DEMO_TITLES[label] || DEMO_TITLES['News'];
    var pal = DEMO_PALETTES[label] || DEMO_PALETTES['News'];
    var out = [];
    for (var i = 0; i < Math.min(max, titles.length); i++) {
      out.push({
        title: titles[i],
        url: '#demo',
        image: svgPlaceholder(label || 'Story', pal[0], pal[1]),
        excerpt: 'This is sample content shown because no blog is connected yet. Link your Blogger blog in config.js and real posts will appear here automatically.',
        author: DEMO_AUTHORS[i % DEMO_AUTHORS.length],
        date: new Date(Date.now() - i * 86400000).toISOString(),
        labels: label ? [label] : ['News']
      });
    }
    return out;
  }

  /* ---------- feed access ---------- */
  var jsonpCounter = 0;
  function feedJSONP(url, cb) {
    var name = '__pbfeed' + (++jsonpCounter);
    var done = false;
    var timer = setTimeout(function () { finish(null); }, 10000);
    function finish(data) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { delete window[name]; } catch (e) { window[name] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
      cb(data);
    }
    window[name] = function (data) { finish(data); };
    var s = document.createElement('script');
    s.src = url + '&callback=' + name;
    s.onerror = function () { finish(null); };
    document.head.appendChild(s);
  }
  function fetchFeed(label, max, cb) {
    if (window.PB_MOCK) { window.PB_MOCK(label, max, cb); return; }
    var base = blogBase();
    if (!base && !window.PB_ON_BLOGGER) {
      /* static site with no blog linked yet: demo content */
      setTimeout(function () { cb(demoPosts(label, max)); }, 150);
      return;
    }
    var path = 'feeds/posts/default' +
      (label ? '/-/' + encodeURIComponent(label) : '') +
      '?alt=json' + (base ? '-in-script' : '') + '&max-results=' + max;
    if (base) {
      /* cross-origin (Vercel -> Blogger): JSONP */
      feedJSONP(base + path, function (data) {
        cb(data && data.feed ? (data.feed.entry || []).map(parseEntry) : []);
      });
    } else {
      /* same origin (Blogger theme): plain fetch */
      fetch('/' + path)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          cb(data && data.feed ? (data.feed.entry || []).map(parseEntry) : []);
        })
        .catch(function () { cb([]); });
    }
  }
  function parseEntry(e) {
    var link = '';
    (e.link || []).forEach(function (l) { if (l.rel === 'alternate') link = l.href; });
    var thumb = e.media$thumbnail ? bigThumb(e.media$thumbnail.url) : null;
    if (!thumb) {
      var html = (e.content && e.content.$t) || (e.summary && e.summary.$t) || '';
      var m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      /* the captured src still carries feed HTML entities (&amp; etc.) */
      if (m) thumb = decodeEntities(m[1]);
    }
    var text = ((e.summary && e.summary.$t) || (e.content && e.content.$t) || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      title: (e.title && e.title.$t) || '(untitled)',
      url: link,
      image: thumb || PLACEHOLDER,
      excerpt: text.slice(0, 160),
      author: (e.author && e.author[0] && e.author[0].name && e.author[0].name.$t) || '',
      date: (e.published && e.published.$t) || '',
      labels: (e.category || []).map(function (c) { return c.term; })
    };
  }

  /* ---------- card renderer ---------- */
  function cardHTML(p) {
    return '' +
      '<a class="pb-link-cover" href="' + esc(safeUrl(p.url) || '#') + '" aria-label="' + esc(p.title) + '"></a>' +
      '<span class="pb-card-img"><img loading="lazy" src="' + esc(safeImg(p.image) || PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=window.PB_PLACEHOLDER;"/></span>' +
      '<span class="pb-card-body">' +
      '<span class="pb-card-title">' + esc(p.title) + '</span>' +
      '<span class="pb-card-excerpt">' + esc(p.excerpt) + '</span>' +
      '<span class="pb-card-meta">' +
      '<span class="pb-avatar" style="background:' + avatarColor(p.author) + '">' + esc(initials(p.author)) + '</span>' +
      '<span class="who">' + esc(p.author || fmtDate(p.date)) + '</span>' +
      '<span class="read">Read More</span>' +
      '</span></span>';
  }

  /* ---------- hero carousel ---------- */
  function buildHero() {
    var host = $('#pb-hero-frame');
    if (!host) return;
    var heroLabel = CFG.heroLabel || 'Featured';
    fetchFeed(heroLabel, 3, function (posts) {
      if (!posts.length) { fetchFeed(null, 3, render); return; }
      render(posts);
    });
    function render(posts) {
      if (!posts.length) { host.parentNode.style.display = 'none'; return; }
      host.innerHTML = '';
      var dots = el('div', 'pb-hero-dots');
      posts.forEach(function (p, i) {
        var slide = el('a', 'pb-hero-slide' + (i === 0 ? ' active' : ''));
        slide.href = safeUrl(p.url) || '#';
        slide.innerHTML =
          '<img src="' + esc(safeImg(bigThumb(p.image, 'w1600-h620-p-k-no-nu') || p.image) || PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=window.PB_PLACEHOLDER;"/>' +
          '<span class="pb-hero-caption">' +
          (p.labels && p.labels.length ? '<span class="chip">' + esc(p.labels[0]) + '</span>' : '') +
          '<h3>' + esc(p.title) + '</h3></span>';
        host.appendChild(slide);
        var dot = el('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        if (i === 0) dot.className = 'active';
        (function (k) { dot.addEventListener('click', function () { go(k); }); })(i);
        dots.appendChild(dot);
      });
      host.appendChild(dots);
      var idx = 0, n = posts.length, timer = null;
      function go(i) {
        idx = (i + n) % n;
        $all('.pb-hero-slide', host).forEach(function (s, k) { s.classList.toggle('active', k === idx); });
        $all('.pb-hero-dots button', host).forEach(function (d, k) { d.classList.toggle('active', k === idx); });
      }
      function play() { if (n > 1) timer = setInterval(function () { go(idx + 1); }, 5000); }
      host.addEventListener('mouseenter', function () { clearInterval(timer); });
      host.addEventListener('mouseleave', play);
      play();
    }
  }

  /* ---------- homepage label sections ---------- */
  function buildSections() {
    var mount = $('#pb-sections');
    if (!mount) return;
    (CFG.sections || []).forEach(function (s) {
      var sec = el('section', 'pb-section');
      var labelBase = window.PB_ON_BLOGGER ? '/' : blogBase();
      var moreUrl = safeUrl(s.url) ||
        (s.label && labelBase ? labelBase + 'search/label/' + encodeURIComponent(s.label) : null);
      sec.innerHTML =
        '<div class="pb-wrap">' +
        '<div class="pb-section-head"><h2>' + esc(s.title) + '</h2><span class="rule"></span>' +
        (moreUrl ? '<a class="more" href="' + esc(moreUrl) + '">More &#8594;</a>' : '') +
        '</div>' +
        '<div class="pb-grid">' +
        '<div class="pb-skeleton"></div><div class="pb-skeleton"></div><div class="pb-skeleton"></div>' +
        '<div class="pb-skeleton"></div><div class="pb-skeleton"></div>' +
        '</div></div>';
      mount.appendChild(sec);
      fetchFeed(s.label, s.count || 5, function (posts) {
        var grid = $('.pb-grid', sec);
        if (!posts.length) { sec.style.display = 'none'; return; }
        grid.innerHTML = '';
        posts.forEach(function (p) {
          grid.appendChild(el('article', 'pb-card', cardHTML(p)));
        });
      });
    });
  }

  /* ---------- quote banner ---------- */
  function buildQuote() {
    var host = $('#pb-quote');
    if (!host) return;
    var q = CFG.quote;
    if (!q || !q.text) { host.style.display = 'none'; return; }
    var qImg = q.image ? safeImg(q.image) : '';
    host.innerHTML =
      '<div class="pb-wrap"><div class="pb-quote-inner">' +
      (qImg ? '<img src="' + esc(qImg) + '" alt="' + esc(q.name || '') + '"/>' : '') +
      '<div class="pb-quote-text">' +
      '<blockquote>' + esc(q.text) + '</blockquote>' +
      (q.name ? '<div class="name">' + esc(q.name) + '</div>' : '') +
      (q.role ? '<div class="role">' + esc(q.role) + '</div>' : '') +
      '</div></div></div>';
  }

  /* ---------- YouTube videos ---------- */
  function buildVideos() {
    var band = $('#pb-videos');
    if (!band) return;
    var vids = CFG.videos || [];
    if (!vids.length) { band.style.display = 'none'; return; }
    var grid = $('.pb-video-grid', band);
    vids.forEach(function (v) {
      var thumb = safeImg(v.thumb) || ('https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg');
      var b = el('button', 'pb-video');
      b.type = 'button';
      b.setAttribute('aria-label', 'Play ' + (v.title || 'video'));
      b.innerHTML =
        '<img loading="lazy" src="' + esc(thumb) + '" alt=""/>' +
        '<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' +
        (v.title ? '<span class="vtitle">' + esc(v.title) + '</span>' : '');
      b.addEventListener('click', function () {
        b.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) +
          '?autoplay=1" title="' + esc(v.title || 'YouTube video') + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      });
      grid.appendChild(b);
    });
  }

  /* ---------- footer (about / social / contact / subscribe) ---------- */
  var ICONS = {
    instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 4 4 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 3.6a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-10.5a1.4 1.4 0 11-2.9 0 1.4 1.4 0 012.9 0z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.5 15.5v-7l6.3 3.5-6.3 3.5z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><path d="M24 12a12 12 0 10-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0024 12z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18.9 1.2h3.7l-8.1 9.3L24 22.8h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L0 1.2h7.7l5.3 7 5.9-7zm-1.3 19.5h2L6.6 3.3H4.4l13.2 17.4z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1a3.8 3.8 0 013.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.3zM5.3 7.4a2.1 2.1 0 110-4.1 2.1 2.1 0 010 4.1zM7.1 20.5H3.5V9h3.6v11.5z"/></svg>',
    pinterest: '<svg viewBox="0 0 24 24"><path d="M12 0a12 12 0 00-4.4 23.2c-.1-.9-.2-2.4 0-3.4l1.4-6s-.4-.7-.4-1.8c0-1.7 1-3 2.2-3 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.3 3.8-5.5 0-2.9-2.1-4.9-5-4.9a5.2 5.2 0 00-5.4 5.2c0 1 .4 2.1.9 2.7l.1.4-.3 1.4c-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.7 0-3.8 2.8-7.3 8-7.3 4.2 0 7.5 3 7.5 7 0 4.2-2.6 7.6-6.3 7.6-1.2 0-2.4-.7-2.8-1.4l-.8 2.9c-.3 1-1 2.4-1.5 3.2A12 12 0 1012 0z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a7.6 7.6 0 01-3.8-3.3c-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 00-.8.4A3.4 3.4 0 006 9.6a6 6 0 001.2 3.2 13.7 13.7 0 005.3 4.7c2 .8 2.7.9 3.7.7a3 3 0 002-1.4 2.5 2.5 0 00.2-1.4c-.1-.2-.3-.3-.6-.4zM12 22h-.1a10 10 0 01-5-1.4l-.4-.2-3.7 1 1-3.6-.3-.4A10 10 0 1112 22zm0-22a12 12 0 00-10.2 18.3L0 24l5.8-1.5A12 12 0 1012 0z"/></svg>',
    email: '<svg viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.9 15.9 0 006.6 6.6l2.2-2.2a1 1 0 011-.2 11.4 11.4 0 003.6.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.6 3.6 1 1 0 01-.3 1l-2.2 2.2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg>'
  };
  function buildFooter() {
    var f = CFG.footer || {};
    var aboutHost = $('#pb-footer-about');
    if (aboutHost) {
      aboutHost.innerHTML =
        '<div class="pb-brand-title">' + esc(f.title || document.title || 'My Blog') + '</div>' +
        (f.about ? '<p class="pb-footer-about">' + esc(f.about) + '</p>' : '') +
        '<div class="pb-social">' +
        (f.social || []).map(function (s) {
          var ic = ICONS[s.type] || ICONS.email;
          return '<a href="' + esc(safeUrl(s.url) || '#') + '" target="_blank" rel="noopener" aria-label="' + esc(s.type) + '">' + ic + '</a>';
        }).join('') +
        '</div>';
    }
    var contactHost = $('#pb-footer-contact');
    if (contactHost) {
      var c = f.contact || {};
      var rows = '';
      if (c.email) rows += '<p>' + ICONS.email + '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></p>';
      if (c.phone) rows += '<p>' + ICONS.phone + '<a href="tel:' + esc(String(c.phone).replace(/\s+/g, '')) + '">' + esc(c.phone) + '</a></p>';
      if (c.whatsapp) rows += '<p>' + ICONS.whatsapp + '<a href="https://wa.me/' + esc(String(c.whatsapp).replace(/[^0-9]/g, '')) + '" target="_blank" rel="noopener">WhatsApp us</a></p>';
      if (c.address) rows += '<p>' + ICONS.pin + '<span>' + esc(c.address) + '</span></p>';
      contactHost.innerHTML = rows || '<p>Add contact details in the site config.</p>';
    }
    var subHost = $('#pb-footer-subscribe');
    if (subHost) {
      var n = f.newsletter || {};
      var action = safeUrl(n.action);
      if (!action) { subHost.style.display = 'none'; }
      else {
        subHost.innerHTML =
          '<h4>' + esc(n.title || 'Subscribe to our updates') + '</h4>' +
          '<form class="pb-subscribe-form" method="post" action="' + esc(action) + '" target="_blank">' +
          '<input type="email" required name="' + esc(n.field || 'email') + '" placeholder="Enter your email"/>' +
          '<button type="submit">Subscribe</button></form>' +
          (n.note ? '<div class="pb-footer-note">' + esc(n.note) + '</div>' : '');
      }
    }
  }

  /* ---------- header: static-site brand/nav/search (theme renders these server-side) ---------- */
  /* Two-tone brand text, built ONLY from escaped pieces (last word gets the accent). */
  function brandTitleHtml(title) {
    var t = String(title || '').trim();
    if (!t) return '';
    var parts = t.split(/\s+/);
    if (parts.length < 2) return esc(t);
    var last = parts.pop();
    return esc(parts.join(' ')) + ' <span class="accent">' + esc(last) + '</span>';
  }
  function buildStaticHeader() {
    var brandHost = $('#pb-brand-js');
    if (brandHost) {
      var b = CFG.brand || {};
      var logo = safeImg(b.logo);
      brandHost.innerHTML =
        '<a class="pb-brand" href="' + esc(safeUrl(b.homeUrl) || '/') + '">' +
        (logo
          ? '<img src="' + esc(logo) + '" alt="' + esc(b.title || 'Home') + '"/>'
          : '<span><span class="pb-brand-title">' + brandTitleHtml(b.title || document.title) + '</span>' +
            (b.tagline ? '<span class="pb-brand-tagline">' + esc(b.tagline) + '</span>' : '') + '</span>') +
        '</a>';
    }
    var navHost = $('#pb-nav');
    if (navHost && navHost.hasAttribute('data-js')) {
      navHost.innerHTML = '<ul>' + (CFG.nav || []).map(function (l) {
        return '<li><a href="' + esc(safeUrl(l.url) || '#') + '">' + esc(l.text) + '</a></li>';
      }).join('') + '</ul>';
    }
    var searchHost = $('#pb-search-js');
    if (searchHost) {
      var base = blogBase();
      if (!base) { searchHost.style.display = 'none'; }
      else {
        searchHost.innerHTML =
          '<form action="' + esc(base) + 'search" method="get" role="search">' +
          '<input aria-label="Search" name="q" placeholder="Search here" type="search"/>' +
          '<button aria-label="Search" type="submit">' +
          '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
          '</button></form>';
      }
    }
  }

  /* ---------- header interactions ---------- */
  function initHeader() {
    var btn = $('#pb-menu-btn'), nav = $('#pb-nav');
    if (btn && nav) {
      btn.addEventListener('click', function () { nav.classList.toggle('open'); });
    }
  }

  /* ---------- server-rendered bits (Blogger theme only) ---------- */
  function upgradeThumbs() {
    $all('img.pb-thumb').forEach(function (img) {
      var raw = img.getAttribute('data-pbthumb');
      var big = bigThumb(raw);
      if (big) img.src = big;
      else img.src = PLACEHOLDER;
      img.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    });
  }
  function fillAvatars() {
    $all('.pb-avatar[data-name]').forEach(function (a) {
      var name = a.getAttribute('data-name') || '';
      a.textContent = initials(name);
      a.style.background = avatarColor(name);
    });
  }

  /* ---------- footer quick links + document title (static site only) ---------- */
  function buildFooterExtras() {
    var ql = $('#pb-footer-quicklinks');
    if (ql) {
      ql.innerHTML = (CFG.nav || []).map(function (l) {
        return '<li><a href="' + esc(safeUrl(l.url) || '#') + '">' + esc(l.text) + '</a></li>';
      }).join('');
    }
    var cn = $('#pb-copy-name');
    if (cn) {
      var nm = (CFG.footer && CFG.footer.title) || (CFG.brand && CFG.brand.title);
      if (nm) cn.textContent = nm;
    }
    if (!window.PB_ON_BLOGGER && CFG.brand && CFG.brand.title) {
      document.title = CFG.brand.title + (CFG.brand.tagline ? ' — ' + CFG.brand.tagline : '');
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    buildStaticHeader();
    initHeader();
    upgradeThumbs();
    fillAvatars();
    buildFooter();
    buildFooterExtras();
    if (document.body.classList.contains('pb-is-home')) {
      buildHero();
      buildSections();
      buildQuote();
      buildVideos();
    }
    var y = document.getElementById('pb-year');
    if (y) y.textContent = new Date().getFullYear();
  }
  function start() { loadRemoteConfig(boot); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
