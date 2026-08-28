/* ============================================================
   SITE CONFIG — everything you edit lives in this one file.
   After editing, redeploy to Vercel (or just `vercel --prod`).
   ============================================================ */
window.PB_CONFIG = {

  /* ---- Your Blogger blog (the content engine) ----
     Once the friend's Blogger blog exists, put its full URL here,
     e.g. 'https://yourfriendsblog.blogspot.com/'.
     Leave '' to show built-in DEMO content (for previewing the design). */
  blogUrl: '',

  /* ---- Admin page (/admin) ----
     clientId = a Google OAuth "Web application" Client ID (see SETUP.md,
     "Admin page" section). With it, the friend can sign in on /admin and
     save changes directly. Without it, /admin still works in copy-paste
     mode. Client IDs are public identifiers — safe to keep in this file. */
  admin: {
    clientId: ''
  },

  /* ---- Branding ---- */
  brand: {
    title: 'Culturae',                     /* site name shown in the header */
    tagline: 'Arts • Culture • Heritage',  /* change any time in /admin */
    logo: '',                              /* optional logo image URL; '' = text logo */
    homeUrl: '/'
  },

  /* ---- Top navigation ----
     Point label links at the Blogger blog so category pages work, e.g.
     'https://blog.culturae.world/search/label/News' (or the blogspot address).
     Until the blog exists they can stay '#'. */
  nav: [
    { text: 'Home', url: '/' },
    { text: 'News', url: '#' },
    { text: 'Featured', url: '#' },
    { text: 'Events', url: '#' },
    { text: 'Contact Us', url: '#' }
  ],

  /* ---- Hero carousel: 3 newest posts with this Blogger label ---- */
  heroLabel: 'Featured',

  /* ---- Homepage sections: one row of 5 cards per entry.
        "label" must EXACTLY match the label used on Blogger posts. ---- */
  sections: [
    { title: 'Updates',            label: 'News' },
    { title: 'Events',             label: 'Events' },
    { title: 'Obituaries',         label: 'Obituaries' },
    { title: 'Books & Literature', label: 'Books' },
    { title: 'Awards & Honours',   label: 'Awards' }
  ],

  /* ---- Quote banner (set text: '' to hide) ---- */
  quote: {
    image: '',
    text: 'Art is the bridge between the soul and the world',
    name: 'Your Featured Voice',
    role: 'Edit this in config.js'
  },

  /* ---- YouTube: {id:'VIDEOID', title:'...'} — [] hides the section ---- */
  videos: [
    { id: 'dQw4w9WgXcQ', title: 'Replace these with your friend’s videos (config.js)' },
    { id: 'dQw4w9WgXcQ', title: 'The ID is the part after v= in the YouTube URL' },
    { id: 'dQw4w9WgXcQ', title: 'Add as many as you like — 3 or 6 look best' }
  ],

  /* ---- Footer ---- */
  footer: {
    title: 'Culturae',
    about: 'Stories, events and voices from the world of arts and culture. Edit this text in /admin.',
    social: [
      { type: 'instagram', url: '#' },
      { type: 'youtube',   url: '#' },
      { type: 'facebook',  url: '#' },
      { type: 'x',         url: '#' }
    ],
    contact: {
      email: 'info@culturae.world',
      phone: '+91 00000 00000',
      whatsapp: '',              /* e.g. '919876543210' to show a WhatsApp link */
      address: ''
    },
    /* Newsletter: point "action" at a Google Form / Mailchimp URL. '' hides it. */
    newsletter: {
      title: 'Subscribe to our updates',
      action: '',
      field: 'email',
      note: ''
    }
  }
};
