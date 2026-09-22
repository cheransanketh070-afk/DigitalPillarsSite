# Digital Pillars UI / Motion Upgrade

The existing page content and HTML structure are preserved.

## Replace
- `css/v4.css` — original CSS is preserved, with the V6 structural/motion patch appended.
- `js/app.js` — smoother scene navigation, RAF-based pointer tilt, queued scene changes, preserved AI/review/brief behavior.
- `js/world.js` — higher-quality/higher-FPS WebGL loop, pointer parallax, more procedural geometry/particles, visibility-aware rendering.
- `js/service.js` — RAF-smoothed service-card tilt plus preserved brief form behavior.

## Intentionally unchanged
- `index.html`
- all six service HTML pages
- visible text/content
- links/routes
- `404.html`, `README.md`, `package.json`, `vercel.json`
- GitHub workflow
- validation script
- reference video asset

## Validation
Run:

```bash
npm run build
```

Expected:

`Digital Pillars validation passed.`
