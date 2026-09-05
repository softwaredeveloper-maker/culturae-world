#!/usr/bin/env node
/* Generate site/index.html from site/content.json using site/render.js.
   The page ships fully rendered so it works with JS off and for crawlers;
   the same renderer then powers live editing in /admin.
   Run: node build-site.js                                            */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, 'site');
const R = require(path.join(SITE, 'render.js'));
const content = JSON.parse(fs.readFileSync(path.join(SITE, 'content.json'), 'utf8'));

const meta = content.meta || {};
const esc = R.esc;
const jsonForScript = JSON.stringify(content, null, 2).replace(/<\//g, '<\\/');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="theme-color" content="${esc((content.theme && content.theme.colors && content.theme.colors.ink) || '#0a0a0b')}"/>
  <title>${esc(meta.title || 'CULTRAE')}</title>
  <meta name="description" content="${esc(meta.description || '')}"/>
  <meta property="og:title" content="${esc(meta.title || '')}"/>
  <meta property="og:description" content="${esc(meta.description || '')}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${esc(meta.url || '')}"/>
  <link id="favicon" rel="icon" href="${esc(R.faviconHref(content))}"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link id="font-link" href="${esc(R.fontHref(content.theme))}" rel="stylesheet"/>
  <link rel="stylesheet" href="cultrae.css"/>
  <style id="cultrae-vars">${R.cssVars(content.theme)}</style>
  <script>document.documentElement.className += ' js';</script>
</head>
<body>
  <div class="bg-layer"></div><div class="bg-veil"></div><div class="bg-glow"></div><div class="bg-grain"></div>

  <div id="app">${R.renderBody(content)}</div>

  <script id="cultrae-content" type="application/json">${jsonForScript}</script>
  <script src="render.js"></script>
  <script src="publish-config.js"></script>
  <script src="app-cultrae.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(SITE, 'index.html'), html);
console.log(`site/index.html  ${html.length.toLocaleString()} bytes`);
console.log(`  sections: ${(content.sections || []).map(s => s.id).join(', ')}`);
