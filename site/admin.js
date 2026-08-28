/* ============================================================
   Site Admin — manages the Blogger blog behind the site.
   - Site Settings are saved as JSON into a Blogger PAGE titled
     SITE-CONFIG (the public site + blog theme read it at load).
   - Posts are managed via the Blogger API v3.
   Sign-in: Google Identity Services token flow. Only the Google
   account that owns the blog can write — Google enforces this,
   the page itself holds no secrets.
   ============================================================ */
(function () {
  'use strict';
  var BASE = window.PB_CONFIG || {};
  var CLIENT_ID = (BASE.admin && BASE.admin.clientId) || '';
  var API = 'https://www.googleapis.com/blogger/v3';
  var CONFIG_TITLE = 'SITE-CONFIG';

  var state = {
    token: null,
    tokenClient: null,
    blogId: null,
    blogName: '',
    configPageId: null,
    configFound: false,
    cfg: null,            /* working copy shown in the form */
    formDirty: false,     /* true once the user edits anything */
    posts: []
  };
  function markDirty() { state.formDirty = true; }

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, isErr) {
    var t = document.createElement('div');
    t.className = 'ad-toast' + (isErr ? ' err' : '');
    t.textContent = msg;
    $('#ad-toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, isErr ? 7000 : 4000);
  }
  function blogBase() {
    var u = BASE.blogUrl || '';
    if (u && u.charAt(u.length - 1) !== '/') u += '/';
    return u;
  }
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var keys = path.split('.'), o = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (typeof o[keys[i]] !== 'object' || o[keys[i]] === null) o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }
  function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }
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

  /* defaults = config.js minus the bootstrap keys */
  function defaultCfg() {
    var d = deepCopy(BASE);
    delete d.blogUrl;
    delete d.admin;
    if (d.brand) delete d.brand.titleHtml;   /* legacy raw-HTML field, no longer supported */
    return d;
  }

  /* ---------- read the published SITE-CONFIG (public feed, no auth) ---------- */
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
  var jsonpN = 0;
  function jsonp(url, cb) {
    var name = '__adfeed' + (++jsonpN), done = false;
    var timer = setTimeout(function () { fin(null); }, 10000);
    function fin(d) {
      if (done) return; done = true; clearTimeout(timer);
      try { delete window[name]; } catch (e) { window[name] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
      cb(d);
    }
    window[name] = fin;
    var s = document.createElement('script');
    s.src = url + '&callback=' + name;
    s.onerror = function () { fin(null); };
    document.head.appendChild(s);
  }
  function loadPublishedConfig(done) {
    var base = blogBase();
    if (!base) { done(null); return; }
    jsonp(base + 'feeds/pages/default?alt=json-in-script&max-results=100', function (data) {
      var entries = (data && data.feed && data.feed.entry) || [];
      for (var i = 0; i < entries.length; i++) {
        var title = ((entries[i].title && entries[i].title.$t) || '').trim().toUpperCase();
        if (title !== CONFIG_TITLE) continue;
        state.configFound = true;
        /* harvest the page id from the feed entry so a later Save can PATCH
           this exact page even if the API pages.list momentarily fails */
        var idm = ((entries[i].id && entries[i].id.$t) || '').match(/page-(\d+)/);
        if (idm && !state.configPageId) state.configPageId = idm[1];
        try { done(extractConfigJson((entries[i].content && entries[i].content.$t) || '')); return; }
        catch (e) { toast('SITE-CONFIG page exists but its JSON is broken: ' + e.message, true); done(null); return; }
      }
      done(null);
    });
  }

  /* ---------- Blogger API ---------- */
  function api(method, path, body, params) {
    var qs = '';
    if (params) {
      qs = '?' + Object.keys(params).map(function (k) {
        var v = params[k];
        if (Array.isArray(v)) return v.map(function (x) { return k + '=' + encodeURIComponent(x); }).join('&');
        return k + '=' + encodeURIComponent(v);
      }).join('&');
    }
    return fetch(API + path + qs, {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + state.token,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 204) return {};
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
          if (r.status === 401) { state.token = null; renderAuth(); msg += ' — session expired, sign in again'; }
          if (r.status === 403) msg += ' — is this the Google account that owns the blog?';
          throw new Error(msg);
        }
        return j;
      });
    });
  }

  /* ---------- auth ---------- */
  function initAuth() {
    if (!CLIENT_ID) return;
    var tries = 0;
    (function wait() {
      if (window.google && google.accounts && google.accounts.oauth2) {
        state.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/blogger',
          callback: function (resp) {
            if (resp.error) { toast('Sign-in failed: ' + resp.error, true); return; }
            state.token = resp.access_token;
            renderAuth();
            afterSignIn();
          }
        });
      } else if (tries++ < 50) setTimeout(wait, 200);
    })();
  }
  function signIn() {
    if (!CLIENT_ID) {
      toast('No OAuth Client ID configured — see the Help tab / SETUP.md. Copy-paste mode still works.', true);
      showPanel('help');
      return;
    }
    if (!state.tokenClient) { toast('Google sign-in is still loading, try again in a second.', true); return; }
    state.tokenClient.requestAccessToken({ prompt: state.token ? '' : 'consent' });
  }
  function afterSignIn() {
    var url = blogBase();
    if (!url) { toast('Set blogUrl in config.js first.', true); return; }
    api('GET', '/blogs/byurl', null, { url: url })
      .then(function (blog) {
        state.blogId = blog.id;
        state.blogName = blog.name || '';
        renderAuth();
        renderStatus();
        renderShortcuts();
        return findConfigPage().then(loadPosts);
      })
      .catch(function (e) { toast('Could not open the blog: ' + e.message, true); });
  }
  function findConfigPage() {
    return api('GET', '/blogs/' + state.blogId + '/pages', null, { fetchBodies: 'false', maxResults: 100 })
      .then(function (res) {
        var items = res.items || [];
        for (var i = 0; i < items.length; i++) {
          if ((items[i].title || '').trim().toUpperCase() === CONFIG_TITLE) {
            state.configPageId = items[i].id;
            state.configFound = true;
            break;
          }
        }
        renderStatus();
      })
      .catch(function (e) { toast('Could not list pages: ' + e.message, true); });
  }

  /* ---------- settings form ---------- */
  var ROW_DEFS = {
    nav: {
      fields: [
        { key: 'text', ph: 'Text (e.g. News)' },
        { key: 'url', ph: 'Link (e.g. https://blog…/search/label/News)' }
      ], blank: { text: '', url: '' }
    },
    sections: {
      fields: [
        { key: 'title', ph: 'Row title (e.g. Updates)' },
        { key: 'label', ph: 'Blogger label (e.g. News)' }
      ], blank: { title: '', label: '' }
    },
    videos: {
      fields: [
        { key: 'id', ph: 'Video ID (e.g. dQw4w9WgXcQ)' },
        { key: 'title', ph: 'Caption (optional)' }
      ], blank: { id: '', title: '' }, thumb: true
    },
    social: {
      fields: [
        { key: 'type', select: ['instagram', 'youtube', 'facebook', 'x', 'linkedin', 'pinterest', 'whatsapp', 'email'] },
        { key: 'url', ph: 'Profile URL' }
      ], blank: { type: 'instagram', url: '' }
    }
  };
  function listFor(key) {
    if (key === 'social') return (state.cfg.footer && state.cfg.footer.social) || [];
    return state.cfg[key] || [];
  }
  function setListFor(key, list) {
    if (key === 'social') {
      if (!state.cfg.footer) state.cfg.footer = {};
      state.cfg.footer.social = list;
    } else state.cfg[key] = list;
  }
  function renderRows(key) {
    var def = ROW_DEFS[key];
    var host = $('#rows-' + key);
    var list = listFor(key);
    host.innerHTML = '';
    list.forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = 'ad-row';
      if (def.thumb) {
        var img = document.createElement('img');
        img.className = 'vthumb';
        img.alt = '';
        img.src = item.id ? 'https://i.ytimg.com/vi/' + encodeURIComponent(item.id) + '/mqdefault.jpg' : '';
        img.onerror = function () { this.style.visibility = 'hidden'; };
        row.appendChild(img);
      }
      def.fields.forEach(function (f) {
        var input;
        if (f.select) {
          input = document.createElement('select');
          f.select.forEach(function (opt) {
            var o = document.createElement('option');
            o.value = opt; o.textContent = opt;
            input.appendChild(o);
          });
          input.value = item[f.key] || f.select[0];
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.placeholder = f.ph || '';
          input.value = item[f.key] || '';
        }
        input.addEventListener('input', function () {
          item[f.key] = input.value.trim();
          markDirty();
          if (def.thumb && f.key === 'id') {
            var t = row.querySelector('.vthumb');
            t.style.visibility = 'visible';
            t.src = item.id ? 'https://i.ytimg.com/vi/' + encodeURIComponent(item.id) + '/mqdefault.jpg' : '';
          }
        });
        input.addEventListener('change', function () { input.dispatchEvent(new Event('input')); });
        row.appendChild(input);
      });
      function iconBtn(label, title, fn) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'ad-icon-btn'; b.textContent = label; b.title = title;
        b.addEventListener('click', fn);
        return b;
      }
      row.appendChild(iconBtn('↑', 'Move up', function () {
        if (idx === 0) return;
        list.splice(idx - 1, 0, list.splice(idx, 1)[0]);
        markDirty();
        renderRows(key);
      }));
      row.appendChild(iconBtn('↓', 'Move down', function () {
        if (idx === list.length - 1) return;
        list.splice(idx + 1, 0, list.splice(idx, 1)[0]);
        markDirty();
        renderRows(key);
      }));
      row.appendChild(iconBtn('×', 'Remove', function () {
        list.splice(idx, 1);
        markDirty();
        renderRows(key);
      }));
      host.appendChild(row);
    });
  }
  function fillScalars() {
    $all('[data-cfg]').forEach(function (input) {
      var v = getPath(state.cfg, input.getAttribute('data-cfg'));
      input.value = v == null ? '' : v;
      input.oninput = function () {
        setPath(state.cfg, input.getAttribute('data-cfg'), input.value);
        markDirty();
      };
    });
  }
  function renderForm() {
    fillScalars();
    Object.keys(ROW_DEFS).forEach(function (k) {
      setListFor(k, listFor(k));  /* ensure arrays exist so rows edit live refs */
      renderRows(k);
    });
  }
  function cleanedCfg() {
    var cfg = deepCopy(state.cfg);
    cfg.nav = (cfg.nav || []).filter(function (l) { return l.text; });
    cfg.sections = (cfg.sections || []).filter(function (s) { return s.title && s.label; });
    cfg.videos = (cfg.videos || []).filter(function (v) { return v.id; });
    if (cfg.footer) cfg.footer.social = (cfg.footer.social || []).filter(function (s) { return s.url && s.url !== '#'; });
    delete cfg.blogUrl;
    delete cfg.admin;
    if (cfg.brand) delete cfg.brand.titleHtml;
    return cfg;
  }
  function configPageContent() {
    return '<pre id="pb-site-config" style="display:none">' +
      esc(JSON.stringify(cleanedCfg(), null, 2)) +
      '</pre><p>This hidden page stores the website settings saved from the admin page. Do not delete it.</p>';
  }

  /* ---------- save ---------- */
  function saveConfig() {
    if (!state.token || !state.blogId) {
      toast('Sign in first — or use "Copy for manual paste".', true);
      return;
    }
    var btn = $('#ad-save-btn');
    btn.disabled = true;
    var content = configPageContent();
    var done = function (res) {
      btn.disabled = false;
      if (res && res.id) state.configPageId = res.id;
      state.configFound = true;
      renderStatus();
      toast('Saved. The live sites pick it up within a minute or two.');
    };
    var fail = function (e) {
      btn.disabled = false;
      toast('Save failed: ' + e.message, true);
    };
    function patchIt() {
      return api('PATCH', '/blogs/' + state.blogId + '/pages/' + state.configPageId, { content: content }).then(done).catch(fail);
    }
    function insertIt() {
      return api('POST', '/blogs/' + state.blogId + '/pages', { title: CONFIG_TITLE, content: content })
        .then(done)
        .catch(function (e) {
          fail(new Error(e.message + ' — if pages cannot be created by API, create an empty page titled ' + CONFIG_TITLE + ' in Blogger once, then Save again'));
        });
    }
    if (state.configPageId) { patchIt(); }
    else {
      /* re-check right before inserting so we never create a duplicate
         SITE-CONFIG page after a transient pages.list failure */
      findConfigPage().then(function () {
        if (state.configPageId) patchIt(); else insertIt();
      });
    }
  }
  function copyConfig() {
    var content = configPageContent();
    var show = function () {
      var card = $('#ad-manual-card');
      card.style.display = 'block';
      $('#ad-manual-json').value = content;
      card.scrollIntoView({ behavior: 'smooth' });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(function () {
        toast('Copied to clipboard.');
        show();
      }, show);
    } else show();
  }

  /* ---------- posts ---------- */
  function loadPosts() {
    if (!state.token || !state.blogId) return;
    var params = { fetchBodies: 'false', maxResults: 25, status: ['live', 'draft'] };
    api('GET', '/blogs/' + state.blogId + '/posts', null, params)
      .catch(function () {
        /* some deployments reject multi-status — retry plain */
        return api('GET', '/blogs/' + state.blogId + '/posts', null, { fetchBodies: 'false', maxResults: 25 });
      })
      .then(function (res) {
        state.posts = res.items || [];
        renderPosts();
      })
      .catch(function (e) { toast('Could not load posts: ' + e.message, true); });
  }
  function renderPosts() {
    $('#ad-posts-locked').style.display = state.token ? 'none' : 'block';
    $('#ad-posts-ui').style.display = state.token ? 'block' : 'none';
    var tb = $('#ad-posts-body');
    if (!tb) return;
    tb.innerHTML = '';
    if (!state.posts.length) {
      tb.innerHTML = '<tr><td colspan="3" style="color:var(--pb-muted)">No posts yet.</td></tr>';
      return;
    }
    state.posts.forEach(function (p) {
      var tr = document.createElement('tr');
      var when = p.published ? new Date(p.published).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      var isDraft = p.status && p.status !== 'LIVE';
      tr.innerHTML =
        '<td><div class="t">' + esc(p.title || '(untitled)') + '</div>' +
        '<div style="color:var(--pb-muted);font-size:11.5px">' + esc(when) + (isDraft ? ' <span class="ad-pill draft">draft</span>' : '') + '</div></td>' +
        '<td class="labels-cell"></td>' +
        '<td><div class="ad-actions"></div></td>';
      var labelsCell = tr.querySelector('.labels-cell');
      (p.labels || []).forEach(function (l) {
        var s = document.createElement('span');
        s.className = 'ad-pill'; s.textContent = l;
        labelsCell.appendChild(s);
      });
      var actions = tr.querySelector('.ad-actions');
      function actBtn(label, cls, fn) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'ad-btn small ' + cls; b.textContent = label;
        b.addEventListener('click', fn);
        actions.appendChild(b);
        return b;
      }
      var editUrl = 'https://www.blogger.com/blog/post/edit/' + state.blogId + '/' + p.id;
      actBtn('Edit', 'ghost', function () { window.open(editUrl, '_blank', 'noopener'); });
      actBtn('Labels', 'ghost', function () {
        var cur = (p.labels || []).join(', ');
        var next = window.prompt('Labels for this post (comma separated):', cur);
        if (next === null) return;
        var labels = next.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        api('PATCH', '/blogs/' + state.blogId + '/posts/' + p.id, { labels: labels })
          .then(function () { p.labels = labels; renderPosts(); toast('Labels updated.'); })
          .catch(function (e) { toast('Failed: ' + e.message, true); });
      });
      actBtn('Delete', 'danger', function () {
        if (!window.confirm('Delete "' + (p.title || 'this post') + '"? It goes to Blogger’s trash.')) return;
        api('DELETE', '/blogs/' + state.blogId + '/posts/' + p.id, null, { useTrash: 'true' })
          .then(function () {
            state.posts = state.posts.filter(function (x) { return x.id !== p.id; });
            renderPosts(); toast('Post deleted.');
          })
          .catch(function (e) { toast('Failed: ' + e.message, true); });
      });
      tb.appendChild(tr);
    });
  }
  function quickPost(asDraft) {
    if (!state.token || !state.blogId) { toast('Sign in first.', true); return; }
    var title = $('#np-title').value.trim();
    var body = $('#np-body').value.trim();
    if (!title) { toast('The post needs a title.', true); return; }
    var labels = $('#np-labels').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var image = $('#np-image').value.trim();
    if (image && !/^https?:\/\//i.test(image)) {
      toast('The image URL must start with http:// or https://', true);
      return;
    }
    var html = '';
    if (image) html += '<div class="separator"><img src="' + esc(image) + '" alt="' + esc(title) + '"/></div>';
    if (body.indexOf('<') === -1) {
      html += body.split(/\n{2,}/).map(function (para) {
        return '<p>' + esc(para).replace(/\n/g, '<br/>') + '</p>';
      }).join('');
    } else html += body;
    var btn = asDraft ? $('#np-draft') : $('#np-publish');
    btn.disabled = true;
    api('POST', '/blogs/' + state.blogId + '/posts', { title: title, content: html, labels: labels },
      asDraft ? { isDraft: 'true' } : null)
      .then(function (p) {
        btn.disabled = false;
        $('#np-title').value = ''; $('#np-body').value = ''; $('#np-image').value = '';
        toast(asDraft ? 'Draft saved.' : 'Published!');
        /* window.open here would be popup-blocked (no fresh user gesture),
           so offer the link instead */
        var out = $('#np-result');
        if (out) {
          out.innerHTML = !asDraft && p.url
            ? 'Published: <a href="' + esc(p.url) + '" target="_blank" rel="noopener"><b>' + esc(p.title || 'view the post') + '</b> &#8599;</a>'
            : (asDraft ? 'Draft saved — find it in the Recent posts list below.' : '');
        }
        loadPosts();
      })
      .catch(function (e) { btn.disabled = false; toast('Failed: ' + e.message, true); });
  }

  /* ---------- dashboard ---------- */
  function renderStatus() {
    var rows = [
      {
        ok: !!BASE.blogUrl,
        label: 'Blog linked',
        okText: BASE.blogUrl,
        noText: 'Set blogUrl in config.js and redeploy — until then nothing can be read or saved.'
      },
      {
        ok: !!CLIENT_ID,
        label: 'Google sign-in configured',
        okText: 'OAuth Client ID present',
        noText: 'No OAuth Client ID in config.js — only copy-paste saving works. SETUP.md has the 10-minute fix.'
      },
      {
        ok: !!state.token,
        label: 'Signed in',
        okText: state.blogName ? ('Connected to "' + state.blogName + '"') : 'Token active',
        noText: 'Use the Sign in button (top right) to enable direct saving and post management.'
      },
      {
        ok: state.configFound,
        label: CONFIG_TITLE + ' page on the blog',
        okText: 'Found — settings load from it',
        noText: 'Not found yet. It is created automatically the first time you Save.'
      }
    ];
    $('#ad-status').innerHTML = rows.map(function (r) {
      return '<li><span class="st ' + (r.ok ? 'ok' : 'no') + '">' + (r.ok ? '✓' : '•') + '</span>' +
        '<div><b>' + esc(r.label) + '</b><small>' + esc(r.ok ? (r.okText || '') : r.noText) + '</small></div></li>';
    }).join('');
    var banners = $('#ad-banners');
    banners.innerHTML = '';
    if (!BASE.blogUrl) {
      banners.innerHTML = '<div class="ad-banner warn"><b>No blog linked yet.</b> Edit <code>config.js</code>, set <code>blogUrl</code> to the Blogger address, and redeploy. The Site Settings form still works meanwhile (it edits the defaults).</div>';
    }
  }
  function renderShortcuts() {
    var id = state.blogId;
    var mk = function (href, name, sub) {
      return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(name) + '<span>' + esc(sub) + '</span></a>';
    };
    var host = $('#ad-shortcuts');
    if (!id) {
      host.innerHTML = mk('https://www.blogger.com', 'Open Blogger', 'sign in there with the site’s Google account');
      return;
    }
    host.innerHTML =
      mk('https://www.blogger.com/blog/posts/' + id, 'All posts', 'write & edit articles') +
      mk('https://www.blogger.com/blog/pages/' + id, 'Pages', 'Contact, SITE-CONFIG') +
      mk('https://www.blogger.com/blog/comments/' + id, 'Comments', 'moderate readers') +
      mk('https://www.blogger.com/blog/stats/' + id, 'Stats', 'traffic numbers') +
      mk('https://www.blogger.com/blog/layout/' + id, 'Layout', 'logo & menus') +
      mk('https://www.blogger.com/blog/themes/' + id, 'Theme', 'colors & design') +
      mk('https://www.blogger.com/blog/settings/' + id, 'Settings', 'title, description');
  }
  function renderAuth() {
    var chip = $('#ad-auth-chip');
    chip.classList.toggle('on', !!state.token);
    $('#ad-auth-text').textContent = state.token
      ? (state.blogName ? state.blogName : 'Signed in')
      : 'Not signed in';
    $('#ad-signin-btn').textContent = state.token ? 'Re-authorize' : 'Sign in with Google';
    renderPosts();
    renderStatus();
  }

  /* ---------- tabs ---------- */
  function showPanel(name) {
    $all('#ad-tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-panel') === name);
    });
    $all('.ad-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    var vb = $('#ad-view-blog');
    if (BASE.blogUrl) { vb.style.display = ''; vb.href = BASE.blogUrl; }
    $('#ad-signin-btn').addEventListener('click', signIn);
    $('#ad-save-btn').addEventListener('click', saveConfig);
    $('#ad-copy-btn').addEventListener('click', copyConfig);
    $('#np-publish').addEventListener('click', function () { quickPost(false); });
    $('#np-draft').addEventListener('click', function () { quickPost(true); });
    $('#ad-posts-refresh').addEventListener('click', loadPosts);
    $all('#ad-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { showPanel(b.getAttribute('data-panel')); });
    });
    $all('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-add');
        var list = listFor(key);
        list.push(deepCopy(ROW_DEFS[key].blank));
        setListFor(key, list);
        markDirty();
        renderRows(key);
      });
    });
    state.cfg = defaultCfg();
    renderForm();           /* bind handlers + show defaults immediately */
    renderStatus();
    renderShortcuts();
    renderAuth();
    initAuth();
    /* prefer the already-published config as the form's starting point —
       but never clobber edits the user already made while it loaded */
    loadPublishedConfig(function (remote) {
      if (remote) {
        delete remote.blogUrl;
        delete remote.admin;
        if (remote.brand) delete remote.brand.titleHtml;
        if (state.formDirty) {
          toast('The published settings arrived after you started editing — keeping your edits. Reload to discard them.', true);
        } else {
          state.cfg = mergeCfg(state.cfg, remote);
          renderForm();
        }
      }
      renderStatus();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
