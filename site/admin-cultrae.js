/* ============================================================
   CULTRAE site editor.
   Edits the whole page — every string, colour, size, image and
   icon — from one schema-driven form, with a live preview.
   ============================================================ */
(function () {
  'use strict';
  var R = window.CULTRAE_RENDER;
  var DRAFT_KEY = 'cultrae_draft';

  var state = { content: null, defaults: null, dirty: false, applied: false };

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
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
  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, state.content);
  }
  function set(path, val) {
    var keys = path.split('.'), o = state.content;
    for (var i = 0; i < keys.length - 1; i++) {
      if (typeof o[keys[i]] !== 'object' || o[keys[i]] === null) o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
    touch();
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function toast(msg, err) {
    var t = el('div', 'toast' + (err ? ' err' : ''));
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 6000 : 3200);
  }
  function slug(s) {
    return String(s || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  }

  /* ---------------- preview ---------------- */
  var pushTimer = null;
  function pushPreview() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var f = $('#frame');
      if (f && f.contentWindow) {
        f.contentWindow.postMessage({ type: 'cultrae:preview', content: state.content }, window.location.origin);
      }
    }, 90);
  }
  function touch() {
    state.dirty = true;
    state.applied = false;
    var chip = $('#state-chip');
    chip.className = 'chip dirty';
    chip.textContent = 'Unsaved changes';
    pushPreview();
  }

  /* ---------------- field builders ---------------- */
  function fldWrap(label, hint) {
    var f = el('div', 'fld');
    if (label) f.appendChild(el('label', null, esc(label)));
    if (hint) { var h = el('div', 'hint', esc(hint)); f._hint = h; }
    return f;
  }
  function bindInput(input, path, transform) {
    input.addEventListener('input', function () {
      set(path, transform ? transform(input.value) : input.value);
    });
  }

  function fText(def) {
    var f = fldWrap(def.l, def.hint);
    var i = el('input');
    i.type = 'text';
    i.value = get(def.p) == null ? '' : get(def.p);
    if (def.ph) i.placeholder = def.ph;
    bindInput(i, def.p);
    f.appendChild(i);
    if (f._hint) f.appendChild(f._hint);
    return f;
  }
  function fArea(def) {
    var f = fldWrap(def.l, def.hint);
    var t = el('textarea');
    t.value = get(def.p) == null ? '' : get(def.p);
    if (def.rows) t.rows = def.rows;
    bindInput(t, def.p);
    f.appendChild(t);
    if (f._hint) f.appendChild(f._hint);
    return f;
  }
  function fColor(def) {
    var f = fldWrap(def.l, def.hint);
    var box = el('div', 'swatch');
    var c = el('input'); c.type = 'color';
    var t = el('input'); t.type = 'text';
    var v = get(def.p) || '#000000';
    c.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
    t.value = v;
    c.addEventListener('input', function () { t.value = c.value; set(def.p, c.value); });
    t.addEventListener('input', function () {
      set(def.p, t.value);
      if (/^#[0-9a-f]{6}$/i.test(t.value)) c.value = t.value;
    });
    box.appendChild(c); box.appendChild(t);
    f.appendChild(box);
    return f;
  }
  function fRange(def) {
    var f = el('div', 'fld');
    var lab = el('label', null, esc(def.l));
    var out = el('span', 'rng-val');
    lab.appendChild(out);
    f.appendChild(lab);
    var i = el('input');
    i.type = 'range';
    i.min = def.min; i.max = def.max; i.step = def.step || 1;
    var cur = get(def.p);
    i.value = cur == null ? def.min : cur;
    var show = function () { out.textContent = i.value + (def.unit || ''); };
    show();
    i.addEventListener('input', function () { show(); set(def.p, parseFloat(i.value)); });
    f.appendChild(i);
    return f;
  }
  function fSelect(def) {
    var f = fldWrap(def.l, def.hint);
    var s = el('select');
    (def.o || []).forEach(function (o) {
      var opt = el('option');
      opt.value = o[0]; opt.textContent = o[1];
      s.appendChild(opt);
    });
    s.value = get(def.p);
    s.addEventListener('change', function () { set(def.p, s.value); });
    f.appendChild(s);
    return f;
  }
  function fToggle(def) {
    var f = el('div', 'tog');
    f.appendChild(el('span', null, esc(def.l)));
    var sw = el('label', 'switch');
    var i = el('input'); i.type = 'checkbox';
    var v = get(def.p);
    i.checked = def.invert ? v === true : v !== false;
    i.addEventListener('change', function () { set(def.p, def.invert ? i.checked : i.checked); });
    sw.appendChild(i); sw.appendChild(el('span', 'slider'));
    f.appendChild(sw);
    return f;
  }
  var FONTS = ['Cormorant Garamond', 'Playfair Display', 'Lora', 'EB Garamond', 'Libre Baskerville',
    'Marcellus', 'Spectral', 'Bodoni Moda', 'Italiana', 'Syne', 'Inter', 'Jost', 'Work Sans',
    'DM Sans', 'Manrope', 'Space Grotesk', 'Karla', 'Outfit'];
  function fFont(def) {
    var f = fldWrap(def.l, def.hint);
    var s = el('select');
    var cur = get(def.p);
    var list = FONTS.slice();
    if (cur && list.indexOf(cur) === -1) list.unshift(cur);
    list.forEach(function (n) {
      var o = el('option'); o.value = n; o.textContent = n; s.appendChild(o);
    });
    s.value = cur;
    s.addEventListener('change', function () { set(def.p, s.value); });
    f.appendChild(s);
    return f;
  }
  function fImage(def) {
    var f = fldWrap(def.l, def.hint);
    var i = el('input'); i.type = 'text'; i.placeholder = 'https://…';
    i.value = get(def.p) || '';
    bindInput(i, def.p);
    f.appendChild(i);
    var bar = el('div', 'addbar');
    var up = el('button', 'btn sm', 'Upload');
    up.type = 'button';
    var file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.style.display = 'none';
    up.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var fl = file.files && file.files[0];
      if (!fl) return;
      if (fl.size > 900000) { toast('That image is ' + Math.round(fl.size / 1024) + 'KB. Use an image URL instead — big uploads bloat the site.', true); return; }
      var rd = new FileReader();
      rd.onload = function () { i.value = rd.result; set(def.p, rd.result); };
      rd.readAsDataURL(fl);
    });
    var clr = el('button', 'btn sm', 'Clear');
    clr.type = 'button';
    clr.addEventListener('click', function () { i.value = ''; set(def.p, ''); });
    bar.appendChild(up); bar.appendChild(clr); bar.appendChild(file);
    f.appendChild(bar);
    if (f._hint) f.appendChild(f._hint);
    return f;
  }
  function fIcon(def) {
    var f = fldWrap(def.l, def.hint);
    var grid = el('div', 'icon-grid');
    var names = [''].concat(R.iconNames());
    names.forEach(function (n) {
      var b = el('button', 'icobtn-none');
      b.type = 'button';
      b.className = (get(def.p) === n ? 'on' : '') + (n ? '' : ' none');
      b.innerHTML = n ? R.icon(n) : '—';
      b.title = n || 'none';
      b.addEventListener('click', function () {
        set(def.p, n);
        Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      });
      grid.appendChild(b);
    });
    f.appendChild(grid);
    return f;
  }
  /* editable list of plain paragraphs */
  function fParas(def) {
    var f = fldWrap(def.l, def.hint || 'One box per paragraph. Links: [text](https://…) or [text](#section)');
    var host = el('div');
    function draw() {
      host.innerHTML = '';
      var arr = get(def.p) || [];
      arr.forEach(function (p, idx) {
        var row = el('div', 'fld');
        var t = el('textarea');
        t.value = p;
        t.addEventListener('input', function () { arr[idx] = t.value; touch(); });
        var bar = el('div', 'addbar');
        var del = el('button', 'btn sm danger', 'Remove');
        del.type = 'button';
        del.addEventListener('click', function () { arr.splice(idx, 1); touch(); draw(); });
        bar.appendChild(del);
        row.appendChild(t); row.appendChild(bar);
        host.appendChild(row);
      });
      var add = el('button', 'btn sm', '+ Add paragraph');
      add.type = 'button';
      add.addEventListener('click', function () {
        var a = get(def.p) || [];
        a.push('New paragraph.');
        set(def.p, a);
        draw();
      });
      host.appendChild(add);
    }
    draw();
    f.appendChild(host);
    if (f._hint) f.appendChild(f._hint);
    return f;
  }

  var BUILDERS = {
    text: fText, area: fArea, color: fColor, range: fRange, select: fSelect,
    toggle: fToggle, font: fFont, image: fImage, icon: fIcon, paras: fParas
  };
  function buildField(def) {
    var b = BUILDERS[def.t];
    return b ? b(def) : el('div');
  }
  function buildGroup(g) {
    var d = el('details', 'group');
    if (g.open) d.open = true;
    d.appendChild(el('summary', null, esc(g.title)));
    var inner = el('div', 'inner');
    (g.fields || []).forEach(function (def) {
      if (def.t === 'presets') inner.appendChild(buildPresets());
      else if (def.t === 'custom') inner.appendChild(def.build());
      else inner.appendChild(buildField(def));
    });
    d.appendChild(inner);
    return d;
  }

  /* ---------------- palette presets ---------------- */
  var PRESETS = [
    { nm: 'Obsidian & Brass', c: { ink: '#0a0a0b', ink2: '#101012', ink3: '#16161a', line: '#262529', bone: '#ece7dd', muted: '#9a958c', faint: '#6a665f', accent: '#c9a06a', accentDim: '#8c6f45' } },
    { nm: 'Midnight & Gold', c: { ink: '#080c14', ink2: '#0d1320', ink3: '#131b2c', line: '#1e2b40', bone: '#e8ecf3', muted: '#93a1b8', faint: '#5c6b83', accent: '#d4af37', accentDim: '#8f7522' } },
    { nm: 'Charcoal & Sage', c: { ink: '#0d0f0e', ink2: '#141816', ink3: '#1a201d', line: '#26302b', bone: '#e6ebe6', muted: '#94a49a', faint: '#63706a', accent: '#8fbc9a', accentDim: '#5d8168' } },
    { nm: 'Ink & Rust', c: { ink: '#0c0a09', ink2: '#141110', ink3: '#1c1715', line: '#2c2320', bone: '#f0e9e2', muted: '#a89a90', faint: '#6f645d', accent: '#c1633f', accentDim: '#8a452b' } },
    { nm: 'Slate & Ice', c: { ink: '#0b0d10', ink2: '#111418', ink3: '#171b21', line: '#252b33', bone: '#e9edf2', muted: '#93a0af', faint: '#5f6b78', accent: '#7fb3d5', accentDim: '#4f7d99' } },
    { nm: 'Gallery Light', c: { ink: '#f6f4f0', ink2: '#efece6', ink3: '#e8e4dc', line: '#d9d3c9', bone: '#1b1a17', muted: '#5f5a52', faint: '#8a837a', accent: '#8a6a3b', accentDim: '#6d5330' } }
  ];
  function buildPresets() {
    var f = fldWrap('Palette presets');
    var g = el('div', 'presets');
    PRESETS.forEach(function (p) {
      var b = el('button', 'preset');
      b.type = 'button';
      b.innerHTML =
        '<div class="dots">' +
        ['ink', 'bone', 'accent', 'line'].map(function (k) {
          return '<span class="dot" style="background:' + esc(p.c[k]) + '"></span>';
        }).join('') +
        '</div><div class="nm">' + esc(p.nm) + '</div>';
      b.addEventListener('click', function () {
        state.content.theme.colors = clone(p.c);
        touch();
        renderTab('design');
        toast('Palette: ' + p.nm);
      });
      g.appendChild(b);
    });
    f.appendChild(g);
    return f;
  }

  /* ---------------- tab schemas ---------------- */
  function designSchema() {
    return [
      { title: 'Palette', open: true, fields: [
        { t: 'presets' },
        { t: 'color', p: 'theme.colors.ink', l: 'Page background' },
        { t: 'color', p: 'theme.colors.bone', l: 'Main text' },
        { t: 'color', p: 'theme.colors.accent', l: 'Accent (headings, links)' },
        { t: 'color', p: 'theme.colors.accentDim', l: 'Accent — dim' },
        { t: 'color', p: 'theme.colors.muted', l: 'Secondary text' },
        { t: 'color', p: 'theme.colors.faint', l: 'Faint text' },
        { t: 'color', p: 'theme.colors.line', l: 'Lines & borders' },
        { t: 'color', p: 'theme.colors.ink2', l: 'Menu drawer' },
        { t: 'color', p: 'theme.colors.ink3', l: 'Card hover' }
      ] },
      { title: 'Typography', fields: [
        { t: 'font', p: 'theme.fonts.display', l: 'Display font (headings)' },
        { t: 'font', p: 'theme.fonts.body', l: 'Body font' },
        { t: 'select', p: 'theme.fonts.displayWeight', l: 'Display weight', o: [['300', 'Light'], ['400', 'Regular'], ['600', 'Semibold']] },
        { t: 'range', p: 'theme.scale.heroSize', l: 'Hero size — desktop', min: 60, max: 260, step: 2, unit: 'px' },
        { t: 'range', p: 'theme.scale.heroSizeMin', l: 'Hero size — mobile', min: 28, max: 90, step: 1, unit: 'px' },
        { t: 'range', p: 'theme.scale.sectionSize', l: 'Section heading size', min: 26, max: 120, step: 1, unit: 'px' },
        { t: 'range', p: 'theme.scale.bodySize', l: 'Body text size', min: 13, max: 20, step: .5, unit: 'px' },
        { t: 'range', p: 'theme.scale.lsHero', l: 'Hero letter-spacing', min: 0, max: .4, step: .01, unit: 'em' },
        { t: 'range', p: 'theme.scale.lsMark', l: 'Logo letter-spacing', min: 0, max: .8, step: .01, unit: 'em' },
        { t: 'range', p: 'theme.scale.lsNav', l: 'Menu letter-spacing', min: 0, max: .5, step: .01, unit: 'em' },
        { t: 'range', p: 'theme.scale.lsSection', l: 'Heading letter-spacing', min: 0, max: .4, step: .01, unit: 'em' }
      ] },
      { title: 'Layout & spacing', fields: [
        { t: 'range', p: 'theme.layout.maxWidth', l: 'Content width', min: 900, max: 1600, step: 10, unit: 'px' },
        { t: 'range', p: 'theme.layout.sectionPadding', l: 'Space between sections', min: 50, max: 240, step: 2, unit: 'px' },
        { t: 'range', p: 'theme.layout.radius', l: 'Corner rounding', min: 0, max: 26, step: 1, unit: 'px' },
        { t: 'range', p: 'theme.layout.heroHeight', l: 'Hero height', min: 55, max: 100, step: 1, unit: 'svh' }
      ] },
      { title: 'Background', fields: [
        { t: 'image', p: 'theme.background.image', l: 'Background image', hint: 'Paste an image URL or upload one. Empty = plain colour.' },
        { t: 'range', p: 'theme.background.overlay', l: 'Dark overlay', min: 0, max: 1, step: .02 },
        { t: 'range', p: 'theme.background.blur', l: 'Blur', min: 0, max: 24, step: 1, unit: 'px' },
        { t: 'select', p: 'theme.background.position', l: 'Position', o: [['center', 'Center'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']] },
        { t: 'select', p: 'theme.background.size', l: 'Fit', o: [['cover', 'Cover'], ['contain', 'Contain'], ['auto', 'Actual size']] },
        { t: 'toggle', p: 'theme.background.fixed', l: 'Stays still while scrolling' },
        { t: 'toggle', p: 'theme.background.glow', l: 'Soft accent glow' },
        { t: 'toggle', p: 'theme.background.grain', l: 'Film grain texture', invert: true }
      ] },
      { title: 'Motion & detail', fields: [
        { t: 'toggle', p: 'theme.effects.reveal', l: 'Fade sections in on scroll' },
        { t: 'range', p: 'theme.effects.revealDistance', l: 'Fade distance', min: 0, max: 80, step: 2, unit: 'px' },
        { t: 'range', p: 'theme.effects.speed', l: 'Animation speed', min: 200, max: 2000, step: 50, unit: 'ms' },
        { t: 'toggle', p: 'theme.effects.dividers', l: 'Divider lines between sections' },
        { t: 'toggle', p: 'theme.effects.headerBlur', l: 'Frosted header' }
      ] }
    ];
  }
  function contentSchema() {
    return [
      { title: 'Page & browser tab', open: true, fields: [
        { t: 'text', p: 'meta.title', l: 'Browser tab title' },
        { t: 'area', p: 'meta.description', l: 'Search / share description' },
        { t: 'text', p: 'meta.favicon', l: 'Tab icon', hint: 'A single character or emoji (◈ ✦ ❋ 🏛), or an image URL.' },
        { t: 'text', p: 'meta.url', l: 'Site address' }
      ] },
      { title: 'Header', fields: [
        { t: 'toggle', p: 'header.showMark', l: 'Show logo text' },
        { t: 'text', p: 'header.mark', l: 'Logo text' },
        { t: 'toggle', p: 'header.sticky', l: 'Header follows scroll' }
      ] },
      { title: 'Hero (top of page)', open: true, fields: [
        { t: 'toggle', p: 'hero.enabled', l: 'Show hero' },
        { t: 'text', p: 'hero.title', l: 'Big title' },
        { t: 'text', p: 'hero.tagline', l: 'Tagline' },
        { t: 'area', p: 'hero.lede', l: 'Intro paragraph' },
        { t: 'select', p: 'hero.align', l: 'Alignment', o: [['left', 'Left'], ['center', 'Centered']] },
        { t: 'toggle', p: 'hero.rule', l: 'Show accent rule' },
        { t: 'text', p: 'hero.scrollCue', l: 'Scroll hint', hint: 'Empty to hide.' },
        { t: 'image', p: 'hero.image', l: 'Hero background image' },
        { t: 'range', p: 'hero.imageOverlay', l: 'Hero image darkening', min: 0, max: 1, step: .02 }
      ] }
    ];
  }
  function footerSchema() {
    return [
      { title: 'Footer', open: true, fields: [
        { t: 'text', p: 'footer.mark', l: 'Footer wordmark' },
        { t: 'text', p: 'footer.tagline', l: 'Footer tagline' },
        { t: 'text', p: 'footer.copyright', l: 'Copyright line', hint: 'Use {year} for the current year.' },
        { t: 'toggle', p: 'footer.showEmail', l: 'Show email in footer' },
        { t: 'text', p: 'footer.email', l: 'Footer email' }
      ] },
      { title: 'Social links', open: true, fields: [
        { t: 'custom', build: socialEditor }
      ] }
    ];
  }

  /* ---------------- social editor ---------------- */
  function socialEditor() {
    var host = el('div');
    function draw() {
      host.innerHTML = '';
      var arr = state.content.footer.social || (state.content.footer.social = []);
      arr.forEach(function (row, idx) {
        var card = el('div', 'item open');
        var head = el('div', 'item-head');
        head.innerHTML = '<span class="t">' + esc(row.icon || 'link') + '</span>';
        var up = el('button', 'icobtn', '↑'), dn = el('button', 'icobtn', '↓'), rm = el('button', 'icobtn', '×');
        [up, dn, rm].forEach(function (b) { b.type = 'button'; });
        up.addEventListener('click', function () { if (idx) { arr.splice(idx - 1, 0, arr.splice(idx, 1)[0]); touch(); draw(); } });
        dn.addEventListener('click', function () { if (idx < arr.length - 1) { arr.splice(idx + 1, 0, arr.splice(idx, 1)[0]); touch(); draw(); } });
        rm.addEventListener('click', function () { arr.splice(idx, 1); touch(); draw(); });
        head.appendChild(up); head.appendChild(dn); head.appendChild(rm);
        card.appendChild(head);
        var body = el('div', 'item-body');
        body.appendChild(buildField({ t: 'icon', p: 'footer.social.' + idx + '.icon', l: 'Icon' }));
        body.appendChild(buildField({ t: 'text', p: 'footer.social.' + idx + '.url', l: 'Link', ph: 'https://…' }));
        card.appendChild(body);
        host.appendChild(card);
      });
      var add = el('button', 'btn sm', '+ Add social link');
      add.type = 'button';
      add.addEventListener('click', function () {
        arr.push({ icon: 'instagram', url: '' });
        touch(); draw();
      });
      host.appendChild(add);
    }
    draw();
    return host;
  }

  /* ---------------- sections editor ---------------- */
  var TYPE_LABEL = { prose: 'Text', list: 'List', current: 'Current', grid: 'Grid', contact: 'Contact' };
  var ITEM_FIELDS = {
    list: [
      { t: 'text', k: 'idx', l: 'Number / label' },
      { t: 'text', k: 'title', l: 'Title' },
      { t: 'text', k: 'meta', l: 'Timeline / right-hand text' },
      { t: 'area', k: 'text', l: 'Description' }
    ],
    grid: [
      { t: 'text', k: 'idx', l: 'Corner label' },
      { t: 'text', k: 'meta', l: 'Category' },
      { t: 'text', k: 'title', l: 'Title' },
      { t: 'area', k: 'text', l: 'Description' },
      { t: 'image', k: 'image', l: 'Image (optional)' },
      { t: 'icon', k: 'icon', l: 'Icon (optional)' }
    ],
    contact: [
      { t: 'icon', k: 'icon', l: 'Icon' },
      { t: 'text', k: 'label', l: 'Label' },
      { t: 'text', k: 'value', l: 'Shown text' },
      { t: 'text', k: 'href', l: 'Link', ph: 'tel:… mailto:… https://…' }
    ]
  };
  function itemsKey(type) { return type === 'contact' ? 'rows' : 'items'; }

  function itemsEditor(sIdx, type) {
    var host = el('div');
    var sec = state.content.sections[sIdx];
    var key = itemsKey(type);
    if (!sec[key]) sec[key] = [];
    function draw() {
      host.innerHTML = '';
      var arr = sec[key];
      arr.forEach(function (it, i) {
        var card = el('div', 'item');
        var head = el('div', 'item-head');
        var title = it.title || it.value || it.label || ('Item ' + (i + 1));
        head.innerHTML = '<span class="t">' + esc(title) + '</span>';
        var up = el('button', 'icobtn', '↑'), dn = el('button', 'icobtn', '↓'), rm = el('button', 'icobtn', '×');
        [up, dn, rm].forEach(function (b) { b.type = 'button'; });
        head.appendChild(up); head.appendChild(dn); head.appendChild(rm);
        head.addEventListener('click', function (e) {
          if (e.target === up || e.target === dn || e.target === rm) return;
          card.classList.toggle('open');
        });
        up.addEventListener('click', function () { if (i) { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); touch(); draw(); } });
        dn.addEventListener('click', function () { if (i < arr.length - 1) { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); touch(); draw(); } });
        rm.addEventListener('click', function () {
          if (!window.confirm('Remove "' + title + '"?')) return;
          arr.splice(i, 1); touch(); draw();
        });
        card.appendChild(head);
        var body = el('div', 'item-body');
        (ITEM_FIELDS[type] || []).forEach(function (fd) {
          body.appendChild(buildField({
            t: fd.t, l: fd.l, ph: fd.ph,
            p: 'sections.' + sIdx + '.' + key + '.' + i + '.' + fd.k
          }));
        });
        card.appendChild(body);
        host.appendChild(card);
      });
      var add = el('button', 'btn sm', '+ Add item');
      add.type = 'button';
      add.addEventListener('click', function () {
        var blank = {};
        (ITEM_FIELDS[type] || []).forEach(function (fd) { blank[fd.k] = ''; });
        if (type === 'list') { blank.idx = String(arr.length + 1).padStart(2, '0'); blank.title = 'New entry'; }
        if (type === 'grid') { blank.idx = 'Item ' + String(arr.length + 1).padStart(2, '0'); blank.title = 'New item'; }
        if (type === 'contact') { blank.icon = 'mail'; blank.label = 'Label'; blank.value = 'value'; }
        arr.push(blank);
        touch(); draw();
      });
      host.appendChild(add);
    }
    draw();
    return host;
  }

  function sectionCard(sec, idx) {
    var card = el('div', 'item' + (sec.enabled === false ? ' off' : ''));
    var head = el('div', 'item-head');
    head.innerHTML = '<span class="t">' + esc(sec.title || sec.id) + '</span>' +
      '<span class="badge">' + esc(TYPE_LABEL[sec.type] || sec.type) + '</span>';
    var eye = el('button', 'icobtn', sec.enabled === false ? '○' : '●');
    var up = el('button', 'icobtn', '↑'), dn = el('button', 'icobtn', '↓'), rm = el('button', 'icobtn', '×');
    [eye, up, dn, rm].forEach(function (b) { b.type = 'button'; });
    eye.title = 'Show / hide section';
    head.appendChild(eye); head.appendChild(up); head.appendChild(dn); head.appendChild(rm);
    head.addEventListener('click', function (e) {
      if ([eye, up, dn, rm].indexOf(e.target) >= 0) return;
      card.classList.toggle('open');
    });
    var arr = state.content.sections;
    eye.addEventListener('click', function () { sec.enabled = sec.enabled === false; touch(); renderTab('sections'); });
    up.addEventListener('click', function () { if (idx) { arr.splice(idx - 1, 0, arr.splice(idx, 1)[0]); touch(); renderTab('sections'); } });
    dn.addEventListener('click', function () { if (idx < arr.length - 1) { arr.splice(idx + 1, 0, arr.splice(idx, 1)[0]); touch(); renderTab('sections'); } });
    rm.addEventListener('click', function () {
      if (!window.confirm('Delete the "' + (sec.title || sec.id) + '" section?')) return;
      arr.splice(idx, 1); touch(); renderTab('sections');
    });
    card.appendChild(head);

    var body = el('div', 'item-body');
    var P = 'sections.' + idx + '.';
    body.appendChild(buildField({ t: 'text', p: P + 'navLabel', l: 'Menu label' }));
    body.appendChild(buildField({ t: 'text', p: P + 'num', l: 'Small label above heading' }));
    body.appendChild(buildField({ t: 'text', p: P + 'title', l: 'Heading' }));
    if (sec.type === 'grid') {
      body.appendChild(buildField({ t: 'text', p: P + 'tag', l: 'Right-hand tag' }));
      body.appendChild(buildField({ t: 'range', p: P + 'columns', l: 'Columns', min: 1, max: 4, step: 1 }));
    }
    body.appendChild(buildField({ t: 'area', p: P + 'standfirst', l: 'Intro line' }));
    if (sec.type === 'prose') {
      body.appendChild(buildField({ t: 'paras', p: P + 'body', l: 'Paragraphs' }));
    } else if (sec.type === 'current') {
      body.appendChild(buildField({ t: 'text', p: P + 'status', l: 'Status pill' }));
      body.appendChild(buildField({ t: 'text', p: P + 'itemTitle', l: 'Project title' }));
      body.appendChild(buildField({ t: 'paras', p: P + 'body', l: 'Update text' }));
      body.appendChild(buildField({ t: 'text', p: P + 'quoteLabel', l: 'Quote label' }));
      body.appendChild(buildField({ t: 'area', p: P + 'quote', l: 'Quote' }));
    } else if (ITEM_FIELDS[sec.type]) {
      var lab = el('div', 'fld');
      lab.appendChild(el('label', null, sec.type === 'contact' ? 'Contact rows' : 'Items'));
      body.appendChild(lab);
      body.appendChild(itemsEditor(idx, sec.type));
    }
    body.appendChild(buildField({ t: 'text', p: P + 'id', l: 'Anchor id', hint: 'Used by the menu link (#id). Keep it lowercase, no spaces.' }));
    card.appendChild(body);
    return card;
  }

  function renderSections(pane) {
    pane.innerHTML = '';
    pane.appendChild(el('div', 'note',
      'Click a section to open it. Use <b>●</b> to hide a section, arrows to reorder, <b>×</b> to delete.'));
    state.content.sections.forEach(function (s, i) { pane.appendChild(sectionCard(s, i)); });

    var bar = el('div', 'addbar');
    [['prose', 'Text section'], ['list', 'List section'], ['grid', 'Grid section'],
     ['current', 'Current section'], ['contact', 'Contact section']].forEach(function (t) {
      var b = el('button', 'btn sm', '+ ' + t[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        var n = state.content.sections.length + 1;
        var base = {
          id: slug('section ' + n) + '-' + n, type: t[0], enabled: true,
          navLabel: 'New ' + t[1].split(' ')[0], num: 'Section ' + String(n).padStart(2, '0'),
          title: 'New Section', standfirst: ''
        };
        if (t[0] === 'prose' || t[0] === 'current') base.body = ['Write here.'];
        if (t[0] === 'current') { base.status = 'In Session'; base.itemTitle = 'Project'; base.quoteLabel = 'Note'; base.quote = ''; }
        if (t[0] === 'list' || t[0] === 'grid') base.items = [];
        if (t[0] === 'grid') { base.tag = ''; base.columns = 3; }
        if (t[0] === 'contact') base.rows = [];
        state.content.sections.push(base);
        touch(); renderTab('sections');
      });
      bar.appendChild(b);
    });
    pane.appendChild(bar);
  }

  /* ---------------- publishing (GitHub contents API) ---------------- */
  var TOKEN_KEY = 'cultrae_publish_token';
  function getToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) window.localStorage.setItem(TOKEN_KEY, t);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }
  function b64utf8(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  function gh(method, url, token, body) {
    return fetch(url, {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var m = j.message || ('HTTP ' + r.status);
          if (r.status === 401) m = 'The token was rejected (401). It may be wrong or expired.';
          if (r.status === 403) m = 'Token lacks permission (403). It needs Contents: Read and write on this repository.';
          if (r.status === 404) m = 'Repository or file not found (404) — check the token has access to this repository.';
          if (r.status === 409 || r.status === 422) m = 'The file changed since this page loaded. Reload the editor and publish again.';
          throw new Error(m);
        }
        return j;
      });
    });
  }
  function publishLive(btn, statusEl) {
    var cfg = window.CULTRAE_PUBLISH || {};
    var token = getToken();
    if (!cfg.repo || !cfg.path) { toast('Publishing is not configured (publish-config.js).', true); return; }
    if (!token) { toast('Add a publishing token first.', true); return; }

    var api = 'https://api.github.com/repos/' + cfg.repo + '/contents/' + cfg.path;
    var ref = encodeURIComponent(cfg.branch || 'main');
    btn.disabled = true;
    statusEl.textContent = 'Publishing…';

    gh('GET', api + '?ref=' + ref, token)
      .catch(function (e) {
        if (/404/.test(e.message)) return {};   /* first publish — file may not exist yet */
        throw e;
      })
      .then(function (cur) {
        return gh('PUT', api, token, {
          message: 'Update site content from /admin',
          content: b64utf8(JSON.stringify(state.content, null, 2)),
          branch: cfg.branch || 'main',
          sha: cur && cur.sha ? cur.sha : undefined
        });
      })
      .then(function (res) {
        btn.disabled = false;
        state.dirty = false;
        var chip = $('#state-chip');
        chip.className = 'chip saved';
        chip.textContent = 'Published';
        /* the live site now serves this, so a local draft would only mask it */
        try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        var sha = (res.commit && res.commit.sha ? res.commit.sha.slice(0, 7) : '');
        statusEl.innerHTML = '✓ Published' + (sha ? ' (' + esc(sha) + ')' : '') +
          '. Visitors see it within a minute — they may need one refresh.';
        toast('Published to the live site.');
      })
      .catch(function (e) {
        btn.disabled = false;
        statusEl.textContent = '';
        toast('Publish failed: ' + e.message, true);
      });
  }

  /* ---------------- publish pane ---------------- */
  function renderPublish(pane) {
    pane.innerHTML = '';
    var cfg = window.CULTRAE_PUBLISH || {};

    /* --- live publishing --- */
    var live = el('details', 'group');
    live.open = true;
    live.appendChild(el('summary', null, 'Publish live'));
    var li = el('div', 'inner');
    li.appendChild(el('div', 'note',
      'Sends your changes to the live website for <b>everyone</b>. No redeploy needed — ' +
      'visitors pick it up on their next refresh.'));

    var tokField = fldWrap('Publishing token',
      'A GitHub fine-grained token for ' + (cfg.repo || 'the site repo') + ' with "Contents: Read and write". ' +
      'It is stored only in this browser and never sent anywhere except GitHub.');
    var tokRow = el('div', 'row-inline');
    var tok = el('input');
    tok.type = 'password';
    tok.placeholder = getToken() ? '•••••••••• saved' : 'github_pat_…';
    tok.autocomplete = 'off';
    tok.style.cssText = 'flex:1;background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 11px;color:var(--bone);font-family:var(--sans);font-size:13px;outline:none';
    var save = el('button', 'btn sm', 'Save');
    save.type = 'button';
    var forget = el('button', 'btn sm danger', 'Forget');
    forget.type = 'button';
    tokRow.appendChild(tok); tokRow.appendChild(save); tokRow.appendChild(forget);
    tokField.appendChild(tokRow);
    if (tokField._hint) tokField.appendChild(tokField._hint);
    li.appendChild(tokField);

    var status = el('div', 'hint');
    status.style.marginTop = '8px';

    var pubBar = el('div', 'addbar');
    var pub = el('button', 'btn primary', '⬆ Publish to live site');
    pub.type = 'button';
    pub.disabled = !getToken();
    pub.addEventListener('click', function () { publishLive(pub, status); });
    pubBar.appendChild(pub);

    save.addEventListener('click', function () {
      var v = tok.value.trim();
      if (!v) { toast('Paste a token first.', true); return; }
      setToken(v);
      tok.value = '';
      tok.placeholder = '•••••••••• saved';
      pub.disabled = false;
      toast('Token saved in this browser.');
    });
    forget.addEventListener('click', function () {
      setToken('');
      tok.value = '';
      tok.placeholder = 'github_pat_…';
      pub.disabled = true;
      toast('Token removed from this browser.');
    });

    li.appendChild(pubBar);
    li.appendChild(status);
    live.appendChild(li);
    pane.appendChild(live);

    /* --- other options --- */
    pane.appendChild(el('div', 'note',
      '<b>Apply to site</b> saves changes into this browser only — handy for reviewing a change ' +
      'on this device before publishing it to everyone.'));

    var bar = el('div', 'addbar');
    var apply = el('button', 'btn', 'Apply to site (this browser)');
    apply.type = 'button';
    apply.addEventListener('click', applyDraft);
    var dl = el('button', 'btn', 'Download content.json');
    dl.type = 'button';
    dl.addEventListener('click', download);
    var copy = el('button', 'btn', 'Copy JSON');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var txt = JSON.stringify(state.content, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Copied.'); }, function () { showJson(txt); });
      else showJson(txt);
    });
    var reset = el('button', 'btn danger', 'Reset everything');
    reset.type = 'button';
    reset.addEventListener('click', resetAll);
    [apply, dl, copy, reset].forEach(function (b) { bar.appendChild(b); });
    pane.appendChild(bar);

    var out = el('div');
    out.id = 'json-out';
    pane.appendChild(out);

    function showJson(txt) {
      out.innerHTML = '';
      var f = fldWrap('Copy this and save it as content.json');
      var t = el('textarea');
      t.value = txt; t.rows = 14; t.readOnly = true;
      f.appendChild(t);
      out.appendChild(f);
      t.select();
    }
  }

  /* ---------------- actions ---------------- */
  function applyDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content));
      state.applied = true;
      state.dirty = false;
      var chip = $('#state-chip');
      chip.className = 'chip saved';
      chip.textContent = 'Applied to this browser';
      toast('Saved. Open the site in this browser to see it.');
    } catch (e) {
      toast('Could not save: ' + e.message, true);
    }
  }
  function download() {
    var blob = new Blob([JSON.stringify(state.content, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Downloaded content.json');
  }
  function resetAll() {
    if (!window.confirm('Discard all changes and go back to the published site?')) return;
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    state.content = clone(state.defaults);
    state.dirty = false;
    var chip = $('#state-chip');
    chip.className = 'chip';
    chip.textContent = 'No changes';
    renderTab(currentTab);
    pushPreview();
    $('#frame').contentWindow.location.reload();
    toast('Reset to the published version.');
  }

  /* ---------------- tabs ---------------- */
  var currentTab = 'design';
  function renderTab(name) {
    currentTab = name;
    var pane = $('#pane-' + name);
    if (!pane) return;
    if (name === 'sections') { renderSections(pane); return; }
    if (name === 'publish') { renderPublish(pane); return; }
    pane.innerHTML = '';
    var schema = name === 'design' ? designSchema() : name === 'content' ? contentSchema() : footerSchema();
    schema.forEach(function (g) { pane.appendChild(buildGroup(g)); });
  }

  /* ---------------- boot ---------------- */
  function boot(content) {
    state.defaults = clone(content);
    var draft = null;
    try {
      var raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw);
    } catch (e) {}
    state.content = draft || clone(content);
    if (draft) {
      var chip = $('#state-chip');
      chip.className = 'chip saved';
      chip.textContent = 'Draft loaded';
    }

    ['design', 'content', 'sections', 'footer', 'publish'].forEach(function (t) { renderTab(t); });
    renderTab('design');

    $('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-t]');
      if (!b) return;
      Array.prototype.forEach.call($('#tabs').children, function (x) { x.classList.toggle('on', x === b); });
      Array.prototype.forEach.call(document.querySelectorAll('.pane'), function (p) {
        p.classList.toggle('on', p.id === 'pane-' + b.getAttribute('data-t'));
      });
      renderTab(b.getAttribute('data-t'));
    });

    $('#devices').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-w]');
      if (!b) return;
      Array.prototype.forEach.call($('#devices').children, function (x) { x.classList.toggle('on', x === b); });
      var w = b.getAttribute('data-w');
      var f = $('#frame');
      f.className = w === 'full' ? '' : w;
    });

    $('#btn-apply').addEventListener('click', applyDraft);
    $('#btn-export').addEventListener('click', download);
    $('#btn-reset').addEventListener('click', resetAll);

    $('#frame').addEventListener('load', pushPreview);
    window.addEventListener('beforeunload', function (e) {
      if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
    pushPreview();
  }

  fetch('content.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(boot)
    .catch(function (e) { toast('Could not load content.json: ' + e.message, true); });
})();
