/* ============================================================
   Where the published content lives.
   Public information only — no secrets. The publishing token is
   never stored here; it lives in the editor's own browser.
   ============================================================ */
window.CULTRAE_PUBLISH = {
  /* GitHub repository that holds the site */
  repo: 'softwaredeveloper-maker/culturae-world',
  branch: 'main',
  path: 'site/content.json',

  /* Public read URL the live site polls for the newest content.
     Set to '' to switch live publishing off (site then shows the
     content baked in at build time). */
  rawUrl: 'https://raw.githubusercontent.com/softwaredeveloper-maker/culturae-world/main/site/content.json'
};
