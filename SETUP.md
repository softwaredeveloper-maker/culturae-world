# Culturae (culturae.world) — setup guide

A magazine site for your friend, styled after **punarjjanibharat.com** (saffron/brown/navy,
Playfair Display + Lora, hero carousel, card sections, quote banner, YouTube grid, dark footer).

**Known facts:** domain **culturae.world** bought on GoDaddy under **the friend’s Gmail (the one that bought the domain)**;
public address **info@culturae.world**. Target layout: main site on Vercel at
`culturae.world`, articles on Blogger at `blog.culturae.world`, everything owned by
the friend’s Gmail (the one that bought the domain).

Two pieces, use either or both:

| Piece | What it is | When to use |
|---|---|---|
| `theme.xml` | A full custom **Blogger theme** | Friend posts articles on Blogger; the blog itself looks like the reference site |
| `site/` | A **static site for Vercel** | The public face on Vercel; it pulls articles live from the Blogger blog via feeds |

**Recommended combo:** Blogger = free CMS where the friend writes posts. Vercel = the
polished homepage on a nice domain. The Vercel site reads the Blogger feeds automatically —
no redeploy needed when new articles are posted.

---

## Step 0 — accounts (you must do this part yourself)

I can't create accounts or handle passwords, so this part is manual. No new Gmail is
needed — the friend's **the friend’s Gmail (the one that bought the domain)** (which already owns the GoDaddy domain)
becomes the owner of everything:

1. **Blogger:** signed in as the friend’s Gmail (the one that bought the domain) → blogger.com → New Blog →
   name it "Culturae" → pick a `something.blogspot.com` address (anything; the custom
   domain comes later).
2. **Vercel:** at vercel.com/signup choose **Continue with Email** with
   the friend’s Gmail (the one that bought the domain) (it logs in with a code sent to the mail — no password needed).
   Hobby plan is free. Optional but better: a GitHub account with the same email first
   and sign up to Vercel with GitHub, so deploys happen on `git push`.
3. **info@culturae.world (the public address):** GoDaddy → your domain → **Email
   forwarding** (free with the domain) → create `info@culturae.world` → forward to
   `the friend’s Gmail (the one that bought the domain)`. Incoming mail to info@ then lands in the friend's Gmail.
   (To also *send as* info@culturae.world from Gmail, or get a real mailbox, that's a
   paid add-on — forwarding is enough to start.)

## Step 1 — Blogger blog + theme

1. Blogger dashboard → **Theme** → ⋮ (top right) → **Restore** → upload `theme.xml`.
   (Apply it to a **fresh blog** if possible. On a blog that already had a custom theme,
   Blogger keeps old widget settings for matching widget IDs — if the menus come up wrong
   or empty, just re-enter the links in **Layout** → the Menu / Quick Links widgets.)
2. **Layout** → the "(Header)" widget → upload the friend's logo (or leave it — the blog
   title shows as a styled text logo). The nav menu and footer Quick Links are editable
   LinkList widgets here too.
3. **Settings** → set Description (shows as the tagline), and set
   "Max posts on main page" to **5**.
4. Make posts and give each one a **label** — the homepage builds itself from labels:
   - `Featured` → hero carousel (top 3)
   - `News` → Updates row
   - `Events`, `Obituaries`, `Books`, `Awards` → their rows
   - a post can have several labels (e.g. `Featured` + `Events`)
   - **every post needs at least one image** — the first image becomes the card thumbnail
5. Create a page: **Pages → New page** titled `Contact` → its URL will be
   `/p/contact.html` (already wired in the menu).
6. Site-specific text (footer contact, quote banner, YouTube video IDs, section names) lives
   in one commented `EDIT ME: SITE CONFIG` block near the top of the theme —
   **Theme → Edit HTML**, it's right below the fonts.
7. Colors are changeable without code: **Theme → Customize → Advanced**.

## Step 2 — Vercel site

1. Edit `site/config.js` — everything is commented:
   - `blogUrl` → the friend's blog, e.g. `'https://friendsblog.blogspot.com/'`
     (until you set this, the site shows built-in demo content so you can preview the design)
   - `brand`, `nav` (point News/Events/etc. at `blogUrl + 'search/label/...'`),
     `quote`, `videos`, `footer`
2. Deploy — CLI route (no GitHub needed):
   ```
   npm i -g vercel
   cd punarjjani-blogger/site
   vercel login        # logs in with the NEW email (code sent to inbox)
   vercel --prod
   ```
   Or GitHub route: push `site/` to a repo under the new GitHub account →
   vercel.com/new → import → framework preset "Other" → deploy.
3. Custom domain: see "Step 2b — connecting culturae.world" below.

## Step 2b — connecting culturae.world (GoDaddy DNS)

All records are added in GoDaddy → culturae.world → **DNS → Manage DNS**.

**Main site → Vercel** (`culturae.world` + `www`):
1. Vercel → the project → Settings → **Domains** → add `culturae.world` and
   `www.culturae.world`. Vercel then shows the exact records it wants — use those values.
   Typically:
   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `76.76.21.21` (use whatever IP Vercel's Domains screen shows) |
   | CNAME | `www` | `cname.vercel-dns.com` |
2. GoDaddy pre-creates a "Parked" A record on `@` — delete/replace it.
   HTTPS is automatic once Vercel shows the domain as Valid (minutes to an hour).

**Blog → Blogger** (`blog.culturae.world`):
1. Blogger → Settings → Publishing → **Custom domain** → enter `blog.culturae.world`.
   Blogger will refuse once and show you TWO CNAMEs — one is always
   `blog → ghs.google.com`, the second is a per-blog verification code
   (`xxxxx → gv-yyyyy.dv.googlehosted.com`). Add both in GoDaddy, wait a few minutes,
   then save the custom domain again in Blogger. Turn on **HTTPS redirect** after it goes green.
2. After the switch, update `site/config.js`: `blogUrl: 'https://blog.culturae.world/'`
   and point the nav/label links at it, then redeploy. (Blogspot URLs keep redirecting
   to the new domain, so nothing breaks.)

**Order tip:** you can do everything on the free `.blogspot.com` + `.vercel.app` URLs
first and attach the domain last — nothing else changes.

## Step 3 — the admin page (`/admin`)

The Vercel site ships with an admin page at `https://<yoursite>/admin` where the friend can
update the website from the website:

- **Site Settings tab** — menu links, homepage rows, quote banner, YouTube videos, footer,
  contact details. Saving writes the settings into a hidden Blogger page called
  `SITE-CONFIG`; both the Vercel site *and* the Blogger blog read that page when they load,
  so changes go live everywhere within a minute or two — **no redeploys**.
- **Posts tab** — quick-post composer (title, labels, image URL, text), label editing,
  delete, and "Edit in Blogger" links. Full articles with photo uploads are still best
  written in Blogger's editor (linked from the Dashboard tab).
- **Dashboard tab** — live setup checks + shortcuts into the right Blogger screens.

**Security model:** the admin page contains no secrets and needs no password of its own —
every save goes through Google sign-in, and Google only accepts writes from the Google
account that owns the blog. Anyone else who opens `/admin` can look at the forms but
cannot save anything. (Never put passwords into Site Settings — the `SITE-CONFIG` page is
technically public.)

### Enabling Google sign-in (one-time, ~10 minutes, do it as the friend's account)

Without this the admin still works in **copy-paste mode** (it generates the config and the
friend pastes it into the `SITE-CONFIG` page in Blogger, HTML view). With it, saving is
one click:

1. console.cloud.google.com (signed in as **the friend’s Gmail (the one that bought the domain)**) → create a
   project (any name, e.g. "culturae-admin").
2. **APIs & Services → Library** → search "Blogger API" → Enable.
3. **APIs & Services → OAuth consent screen** → External → fill app name + emails →
   leave it in **Testing** mode and add **the friend’s Gmail (the one that bought the domain)** (and yours if you want)
   under **Test users**. No verification needed this way.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type **Web application** → under *Authorized JavaScript origins* add all of:
   - `https://<yourproject>.vercel.app`
   - `https://culturae.world`
   - `https://www.culturae.world`
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) into
   `site/config.js` → `admin.clientId`, redeploy.

## How the two connect

- The Vercel homepage fetches `blogUrl/feeds/posts/default/-/<Label>?alt=json-in-script`
  (JSONP, works cross-origin, no API key). New Blogger posts appear on the Vercel site
  automatically.
- Clicking any card opens the full article **on the Blogger blog**, which `theme.xml`
  makes look identical to the Vercel front — same header, cards, colors, fonts.
- The blog must stay **public** (not private) or the feeds won't serve.

## What to collect from the friend

- Logo (PNG with transparency, ~200×130) and the site name/tagline
- What the site is about → final section names + labels
- 5–10 first articles with photos, 3 of them marked `Featured`
- YouTube video IDs, social profile URLs, contact email/phone/WhatsApp
- The quote-banner person: photo, quote, name, role

## Who updates what (cheat-sheet for the friend)

| Task | Where |
|---|---|
| Write / edit an article | Blogger editor (photo upload works there), or `/admin` → Posts for quick ones |
| Which row a post appears in | Its **labels** (edit in Blogger or `/admin` → Posts → Labels) |
| Menu, homepage rows, quote, videos, footer, contact | `/admin` → Site Settings → Save |
| Logo image, blog menus | Blogger → Layout |
| Colors | Blogger → Theme → Customize |
| Site name / tagline on the blog | Blogger → Settings (title + description) |

## Files in this folder

```
theme.xml            ← upload to Blogger (built, ready)
site/                ← deploy to Vercel:
  index.html           homepage
  admin.html/admin.js  the /admin page
  config.js            defaults + blogUrl + admin.clientId
  style.css, app.js    build copies from src/ (don't edit here)
  vercel.json          clean URLs (/admin instead of /admin.html)
src/                 ← sources (style.css, app.js, theme-template.xml)
build.py             ← rebuilds theme.xml + copies assets after editing src/
```

Never edit `theme.xml` or `site/style.css`/`site/app.js` directly — edit `src/` and run
`python3 build.py`.

## What Blogger/this setup can't replicate from the reference

The reference is a custom Next.js app with user accounts. Not available here:
reader login, author profile pages, and its instant search overlay (search here uses
Blogger's standard `/search?q=`). Everything else on the homepage is replicated.
