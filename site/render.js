/* ============================================================
   CULTRAE renderer — shared by the static build (Node) and the
   admin live preview (browser). Content in, HTML/CSS out.
   Everything is escaped; the only markup authors can inject is
   the [label](url) inline-link form, with URLs scheme-checked.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CULTRAE_RENDER = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u)) return u;
    return '';
  }
  function safeImg(u) {
    u = String(u == null ? '' : u).trim();
    if (/^data:image\//i.test(u)) return u;
    return safeUrl(u);
  }
  /* escape, then allow only [label](url) links */
  function inline(s) {
    return esc(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
      var safe = safeUrl(url.replace(/&amp;/g, '&'));
      if (!safe) return label;
      var ext = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener"' : '';
      return '<a class="inline-link" href="' + esc(safe) + '"' + ext + '>' + label + '</a>';
    });
  }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  /* ---------------- icons ---------------- */
  var ICONS = {
    phone: '<path d="M6.6 10.8a15.9 15.9 0 006.6 6.6l2.2-2.2a1 1 0 011-.2 11.4 11.4 0 003.6.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.6 3.6 1 1 0 01-.3 1l-2.2 2.2z"/>',
    mail: '<path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>',
    whatsapp: '<path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a7.6 7.6 0 01-3.8-3.3c-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 00-.8.4A3.4 3.4 0 006 9.6a6 6 0 001.2 3.2 13.7 13.7 0 005.3 4.7c2 .8 2.7.9 3.7.7a3 3 0 002-1.4 2.5 2.5 0 00.2-1.4c-.1-.2-.3-.3-.6-.4zM12 22h-.1a10 10 0 01-5-1.4l-.4-.2-3.7 1 1-3.6-.3-.4A10 10 0 1112 22zm0-22a12 12 0 00-10.2 18.3L0 24l5.8-1.5A12 12 0 1012 0z"/>',
    instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 4 4 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 3.6a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-10.5a1.4 1.4 0 11-2.9 0 1.4 1.4 0 012.9 0z"/>',
    youtube: '<path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.5 15.5v-7l6.3 3.5-6.3 3.5z"/>',
    facebook: '<path d="M24 12a12 12 0 10-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0024 12z"/>',
    x: '<path d="M18.9 1.2h3.7l-8.1 9.3L24 22.8h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L0 1.2h7.7l5.3 7 5.9-7zm-1.3 19.5h2L6.6 3.3H4.4l13.2 17.4z"/>',
    linkedin: '<path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1a3.8 3.8 0 013.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.3zM5.3 7.4a2.1 2.1 0 110-4.1 2.1 2.1 0 010 4.1zM7.1 20.5H3.5V9h3.6v11.5z"/>',
    pinterest: '<path d="M12 0a12 12 0 00-4.4 23.2c-.1-.9-.2-2.4 0-3.4l1.4-6s-.4-.7-.4-1.8c0-1.7 1-3 2.2-3 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.3 3.8-5.5 0-2.9-2.1-4.9-5-4.9a5.2 5.2 0 00-5.4 5.2c0 1 .4 2.1.9 2.7l.1.4-.3 1.4c-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.7 0-3.8 2.8-7.3 8-7.3 4.2 0 7.5 3 7.5 7 0 4.2-2.6 7.6-6.3 7.6-1.2 0-2.4-.7-2.8-1.4l-.8 2.9c-.3 1-1 2.4-1.5 3.2A12 12 0 1012 0z"/>',
    behance: '<path d="M9.3 5.4c.7 0 1.4.1 2 .2a4 4 0 011.5.6c.4.3.8.7 1 1.2.2.5.3 1.1.3 1.8 0 .8-.2 1.5-.6 2s-.9 1-1.7 1.3c1 .3 1.7.8 2.2 1.5s.7 1.5.7 2.5c0 .8-.1 1.5-.5 2a4 4 0 01-1.2 1.4c-.5.4-1.1.6-1.8.8s-1.4.3-2.1.3H0V5.4h9.3zM8.8 11c.6 0 1-.1 1.4-.4s.5-.7.5-1.3c0-.3-.1-.6-.2-.9s-.3-.4-.5-.5l-.7-.2H3.4V11h5.4zm.3 5.9c.3 0 .6 0 .9-.1s.5-.2.7-.3.4-.4.5-.6.2-.6.2-1c0-.7-.2-1.3-.6-1.6s-1-.5-1.7-.5H3.4v4.1h5.7zM19 16.8c.5.4 1.1.7 2 .7.6 0 1.2-.2 1.6-.5s.7-.7.8-1h2.3c-.4 1.2-1 2-1.7 2.5s-1.7.8-2.9.8c-.8 0-1.5-.1-2.2-.4s-1.2-.6-1.6-1.1-.8-1-1-1.7-.4-1.4-.4-2.2c0-.8.1-1.5.4-2.1s.6-1.2 1.1-1.7 1-.8 1.6-1.1 1.3-.4 2.1-.4c.9 0 1.6.2 2.3.5s1.2.8 1.6 1.3.7 1.2.9 1.9.2 1.5.2 2.2H18.3c0 .9.4 1.7.7 2.3zm3.5-6c-.4-.4-1-.6-1.7-.6-.5 0-.9.1-1.2.3s-.6.4-.8.6-.3.5-.4.8-.1.5-.1.7h5c-.1-.8-.4-1.4-.8-1.8zM17.4 6.1h6.2v1.5h-6.2z"/>',
    vimeo: '<path d="M23.98 6.6c-.1 2.3-1.72 5.5-4.85 9.5-3.24 4.2-5.98 6.3-8.22 6.3-1.39 0-2.56-1.3-3.52-3.8-.64-2.3-1.28-4.7-1.92-7C4.75 9 4 7.7 3.2 7.7c-.17 0-.78.36-1.83 1.1L.28 7.4c1.15-1 2.28-2 3.4-3.02 1.53-1.32 2.68-2 3.45-2.08 1.81-.17 2.93 1.06 3.35 3.7.45 2.85.76 4.62.94 5.32.51 2.35 1.08 3.52 1.7 3.52.48 0 1.2-.76 2.16-2.27.96-1.51 1.48-2.66 1.55-3.45.14-1.34-.38-2.02-1.55-2.02-.55 0-1.13.13-1.72.38 1.14-3.75 3.32-5.57 6.55-5.47 2.39.07 3.52 1.63 3.39 4.67z"/>',
    pin: '<path d="M12 2a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/>',
    clock: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 10.6l4 2.3-.8 1.4-4.7-2.7V6h1.5v6.6z"/>',
    globe: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-2.7a15.6 15.6 0 00-1.4-3.6A8 8 0 0118.9 8zM12 4c.7 1 1.3 2.3 1.7 4h-3.4C10.7 6.3 11.3 5 12 4zM4.3 14a8 8 0 010-4h3a17 17 0 000 4h-3zm.8 2h2.7c.3 1.3.8 2.5 1.4 3.6A8 8 0 015.1 16zm2.7-8H5.1a8 8 0 013.9-3.6A15.6 15.6 0 007.8 8zM12 20c-.7-1-1.3-2.3-1.7-4h3.4c-.4 1.7-1 3-1.7 4zm2.1-6h-4.2a15 15 0 010-4h4.2a15 15 0 010 4zm.4 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.7a8 8 0 01-4.1 3.6zM16.9 14a17 17 0 000-4h3a8 8 0 010 4h-3z"/>',
    arrow: '<path d="M7 17L17 7M7 7h10v10" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    star: '<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/>',
    diamond: '<path d="M12 2l10 10-10 10L2 12 12 2z"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    square: '<path d="M4 4h16v16H4z"/>'
  };
  function icon(name, cls) {
    var d = ICONS[name];
    if (!d) return '';
    return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + d + '</svg>';
  }
  function iconNames() { return Object.keys(ICONS); }

  /* ---------------- theme -> CSS variables ---------------- */
  function cssVars(theme) {
    theme = theme || {};
    var c = theme.colors || {}, f = theme.fonts || {}, s = theme.scale || {},
        l = theme.layout || {}, b = theme.background || {}, e = theme.effects || {};
    var bgImg = safeImg(b.image);
    var lines = [
      '--ink:' + (c.ink || '#0a0a0b'),
      '--ink-2:' + (c.ink2 || '#101012'),
      '--ink-3:' + (c.ink3 || '#16161a'),
      '--line:' + (c.line || '#262529'),
      '--bone:' + (c.bone || '#ece7dd'),
      '--muted:' + (c.muted || '#9a958c'),
      '--faint:' + (c.faint || '#6a665f'),
      '--brass:' + (c.accent || '#c9a06a'),
      '--brass-dim:' + (c.accentDim || '#8c6f45'),
      "--display:'" + String(f.display || 'Cormorant Garamond').replace(/'/g, '') + "',Georgia,serif",
      "--sans:'" + String(f.body || 'Inter').replace(/'/g, '') + "',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
      '--display-weight:' + (f.displayWeight || '300'),
      '--hero-size:' + num(s.heroSize, 176) + 'px',
      '--hero-size-min:' + num(s.heroSizeMin, 52) + 'px',
      '--sec-size:' + num(s.sectionSize, 68) + 'px',
      '--body-size:' + num(s.bodySize, 16) + 'px',
      '--ls-hero:' + num(s.lsHero, .12) + 'em',
      '--ls-mark:' + num(s.lsMark, .42) + 'em',
      '--ls-nav:' + num(s.lsNav, .22) + 'em',
      '--ls-sec:' + num(s.lsSection, .1) + 'em',
      '--maxw:' + num(l.maxWidth, 1140) + 'px',
      '--sec-pad:' + num(l.sectionPadding, 132) + 'px',
      '--radius:' + num(l.radius, 0) + 'px',
      '--hero-h:' + num(l.heroHeight, 100) + 'svh',
      '--bg-image:' + (bgImg ? "url('" + bgImg.replace(/'/g, "\\'") + "')" : 'none'),
      '--bg-overlay:' + num(b.overlay, .78),
      '--bg-blur:' + num(b.blur, 0) + 'px',
      '--bg-position:' + (b.position || 'center'),
      '--bg-size:' + (b.size || 'cover'),
      '--bg-attach:' + (b.fixed === false ? 'scroll' : 'fixed'),
      '--glow-opacity:' + (b.glow === false ? '0' : '1'),
      '--grain-opacity:' + (b.grain ? '.045' : '0'),
      '--reveal-dist:' + num(e.revealDistance, 26) + 'px',
      '--anim-speed:' + num(e.speed, 900) + 'ms',
      '--divider:' + (e.dividers === false ? 'transparent' : (c.line || '#262529')),
      '--header-blur:' + (e.headerBlur === false ? '0px' : '14px')
    ];
    return ':root{' + lines.join(';') + '}';
  }

  function fontHref(theme) {
    var f = (theme && theme.fonts) || {};
    var fam = function (n, axes) {
      return 'family=' + String(n || '').trim().replace(/\s+/g, '+') + axes;
    };
    return 'https://fonts.googleapis.com/css2?' +
      fam(f.display || 'Cormorant Garamond', ':ital,wght@0,300;0,400;0,600;1,300') + '&' +
      fam(f.body || 'Inter', ':wght@400;500;600') + '&display=swap';
  }

  /* ---------------- pieces ---------------- */
  function navHtml(content) {
    var secs = (content.sections || []).filter(function (s) { return s.enabled !== false; });
    return '<ul>' + secs.map(function (s) {
      return '<li><a href="#' + esc(s.id) + '">' + esc(s.navLabel || s.title) + '</a></li>';
    }).join('') + '</ul>';
  }

  function headerHtml(content) {
    var h = content.header || {};
    return '' +
      '<div class="head-inner">' +
      (h.showMark === false ? '<span class="mark" aria-hidden="true"></span>'
        : '<a class="mark" href="#top">' + esc(h.mark || (content.hero && content.hero.title) || '') + '</a>') +
      '<button class="burger" id="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav">' +
      '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>' +
      '</button>' +
      '<nav class="nav" id="nav">' + navHtml(content) + '</nav>' +
      '</div>';
  }

  function heroHtml(content) {
    var h = content.hero || {};
    if (h.enabled === false) return '';
    var img = safeImg(h.image);
    var style = img
      ? ' style="--hero-img:url(\'' + esc(img.replace(/'/g, "\\'")) + '\');--hero-img-overlay:' + num(h.imageOverlay, .6) + '"'
      : '';
    return '' +
      '<section class="hero' + (img ? ' has-img' : '') + ' align-' + esc(h.align || 'left') + '" id="top"' + style + '>' +
      '<div class="wrap">' +
      (h.title ? '<h1>' + esc(h.title) + '</h1>' : '') +
      (h.tagline ? '<p class="tagline">' + esc(h.tagline) + '</p>' : '') +
      (h.lede ? '<p class="lede">' + inline(h.lede) + '</p>' : '') +
      (h.rule === false ? '' : '<div class="rule"></div>') +
      '</div>' +
      (h.scrollCue ? '<div class="scroll-cue">' + esc(h.scrollCue) + '</div>' : '') +
      '</section>';
  }

  function secHead(s, extra) {
    return '<div class="section-num">' + esc(s.num || '') + '</div>' +
      (s.title ? '<h2>' + esc(s.title) + '</h2>' : '') + (extra || '');
  }
  function bodyHtml(arr) {
    return (arr || []).filter(Boolean).map(function (p) { return '<p>' + inline(p) + '</p>'; }).join('');
  }

  function sectionHtml(s) {
    if (s.enabled === false) return '';
    var id = esc(s.id), out;
    if (s.type === 'prose') {
      out = '<div class="wrap split">' +
        '<div class="reveal">' + secHead(s) + '</div>' +
        '<div class="reveal">' +
        (s.standfirst ? '<p class="standfirst">' + inline(s.standfirst) + '</p>' : '') +
        '<div class="body">' + bodyHtml(s.body) + '</div>' +
        '</div></div>';
    } else if (s.type === 'list') {
      out = '<div class="wrap">' +
        '<div class="reveal">' + secHead(s) +
        (s.standfirst ? '<p class="standfirst">' + inline(s.standfirst) + '</p>' : '') + '</div>' +
        '<div class="proj reveal">' +
        (s.items || []).map(function (it) {
          return '<article class="proj-item">' +
            '<div class="proj-idx">' + esc(it.idx || '') + '</div>' +
            '<div>' + (it.title ? '<h3 class="proj-title">' + esc(it.title) + '</h3>' : '') +
            (it.text ? '<p class="proj-context">' + inline(it.text) + '</p>' : '') + '</div>' +
            '<div class="proj-time">' + esc(it.meta || '') + '</div>' +
            '</article>';
        }).join('') +
        '</div></div>';
    } else if (s.type === 'current') {
      out = '<div class="wrap split">' +
        '<div class="reveal">' + secHead(s) + '</div>' +
        '<div class="reveal">' +
        (s.standfirst ? '<p class="standfirst">' + inline(s.standfirst) + '</p>' : '') +
        (s.status ? '<div class="status-line"><span class="status-dot"></span> ' + esc(s.status) + '</div>' : '') +
        (s.itemTitle ? '<h3 class="current-title">' + esc(s.itemTitle) + '</h3>' : '') +
        '<div class="body">' + bodyHtml(s.body) + '</div>' +
        (s.quote ? '<div class="journal">' +
          (s.quoteLabel ? '<div class="label">' + esc(s.quoteLabel) + '</div>' : '') +
          '<blockquote>&ldquo;' + inline(s.quote) + '&rdquo;</blockquote></div>' : '') +
        '</div></div>';
    } else if (s.type === 'grid') {
      var cols = Math.min(4, Math.max(1, parseInt(s.columns, 10) || 3));
      out = '<div class="wrap">' +
        '<div class="reveal">' +
        '<div class="section-num">' + esc(s.num || '') + '</div>' +
        '<div class="archive-head">' + (s.title ? '<h2>' + esc(s.title) + '</h2>' : '') +
        (s.tag ? '<div class="vertical-tag">' + esc(s.tag) + '</div>' : '') + '</div>' +
        (s.standfirst ? '<p class="standfirst">' + inline(s.standfirst) + '</p>' : '') +
        '</div>' +
        '<div class="arch-grid reveal" style="--arch-cols:' + cols + '">' +
        (s.items || []).map(function (it) {
          var im = safeImg(it.image);
          return '<article class="arch-item">' +
            (im ? '<div class="arch-img"><img loading="lazy" src="' + esc(im) + '" alt="' + esc(it.title || '') + '"/></div>' : '') +
            (it.icon && ICONS[it.icon] ? '<div class="arch-icon">' + icon(it.icon) + '</div>' : '') +
            (it.meta ? '<div class="arch-cat">' + esc(it.meta) + '</div>' : '') +
            (it.title ? '<h3 class="arch-title">' + esc(it.title) + '</h3>' : '') +
            (it.text ? '<p class="arch-desc">' + inline(it.text) + '</p>' : '') +
            (it.idx ? '<div class="arch-idx">' + esc(it.idx) + '</div>' : '') +
            '</article>';
        }).join('') +
        '</div></div>';
    } else if (s.type === 'contact') {
      out = '<div class="wrap dialogue-grid">' +
        '<div class="reveal">' + secHead(s) +
        (s.standfirst ? '<p class="standfirst">' + inline(s.standfirst) + '</p>' : '') + '</div>' +
        '<div class="reveal">' +
        (s.rows || []).map(function (r) {
          var href = safeUrl(r.href);
          var ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
          var inner =
            (r.icon && ICONS[r.icon] ? icon(r.icon, 'row-ico') : '') +
            '<div class="contact-text">' +
            (r.label ? '<div class="contact-label">' + esc(r.label) + '</div>' : '') +
            '<div class="contact-value">' + esc(r.value || '') + ' <span class="arrow">&#8599;</span></div>' +
            '</div>';
          return href
            ? '<a class="contact-row" href="' + esc(href) + '"' + ext + '>' + inner + '</a>'
            : '<div class="contact-row">' + inner + '</div>';
        }).join('') +
        '</div></div>';
    } else {
      out = '<div class="wrap"><div class="reveal">' + secHead(s) +
        (s.standfirst ? '<p class="standfirst">' + inline(s.standfirst) + '</p>' : '') +
        '<div class="body">' + bodyHtml(s.body) + '</div></div></div>';
    }
    return '<section class="section" id="' + id + '">' + out + '</section>';
  }

  function footerHtml(content) {
    var f = content.footer || {};
    var year = new Date().getFullYear();
    var copy = String(f.copyright || '').replace('{year}', year);
    var social = (f.social || []).filter(function (x) { return safeUrl(x.url); });
    return '<div class="wrap">' +
      (f.mark ? '<div class="foot-mark">' + esc(f.mark) + '</div>' : '') +
      (f.tagline ? '<div class="foot-tag">' + esc(f.tagline) + '</div>' : '') +
      (social.length ? '<div class="foot-social">' + social.map(function (x) {
        return '<a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(x.icon || 'link') + '">' +
          (ICONS[x.icon] ? icon(x.icon) : esc(x.icon || '')) + '</a>';
      }).join('') + '</div>' : '') +
      '<div class="foot-base">' +
      '<span>' + esc(copy) + '</span>' +
      (f.showEmail !== false && f.email ? '<a href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a>' : '') +
      '</div></div>';
  }

  /* full page body (everything inside <body>, excluding scripts) */
  function renderBody(content) {
    content = content || {};
    return '' +
      '<header class="site-head' + ((content.header || {}).sticky === false ? ' static' : '') + '" id="head">' +
      headerHtml(content) + '</header>' +
      '<div class="nav-scrim" id="scrim"></div>' +
      '<main id="main">' +
      heroHtml(content) +
      (content.sections || []).map(sectionHtml).join('') +
      '</main>' +
      '<footer class="site-foot">' + footerHtml(content) + '</footer>';
  }

  function faviconHref(content) {
    var g = ((content.meta || {}).favicon || '').trim();
    if (!g) return '';
    if (/^(https?:|data:|\/)/i.test(g)) return g;
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="50" x="32" font-size="52" text-anchor="middle">' + g + '</text></svg>');
  }

  return {
    esc: esc, inline: inline, safeUrl: safeUrl, safeImg: safeImg,
    ICONS: ICONS, icon: icon, iconNames: iconNames,
    cssVars: cssVars, fontHref: fontHref, faviconHref: faviconHref,
    renderBody: renderBody
  };
}));
