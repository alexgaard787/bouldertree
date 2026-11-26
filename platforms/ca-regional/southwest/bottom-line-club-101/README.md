# Bottom Line at Club 101: Southwest Region fork (Prototype V1)

Open `index.html` directly in a browser. There is no build step and nothing loads from the network (enforced by a Content-Security-Policy meta tag).

Regenerate the `<head>` JSON-LD after editing the config:

```bash
cd apps/group-bootstrapper && npm ci
node scripts/validate-group-config.js examples/bottom-line-club-101.v2.json \
  --inject ../../platforms/ca-regional/southwest/bottom-line-club-101/index.html --no-jsonld
```

Also update the embedded `<script type="application/json" id="group-config">` block in `index.html` to match the example. The in-page Group Bootstrapper preview runs from that block.

## Launch checklist (every item is `[VERIFY]` today)

- [ ] Regional hotline number (official regional line only, never a personal number)
- [ ] Meeting timezone (expected America/Chicago, but not yet confirmed)
- [ ] Club 101 street address, plus Austin, TX as the city (taken from the Drive spec docs)
- [ ] Zoom link and passcode process
- [ ] Group site URL, regional site URL, area hub URLs (`/areas/<slug>/`)
- [ ] Flyer submission and Group Struggles form endpoints (must auto-purge contact data)
- [ ] Aug 2027 World Conference: city, hotel, dates, booking URL, and the $0-upfront terms
- [ ] Family / loved-ones resources
- [ ] Approved C.A. logo files and self-hosted Open Sans (the page currently uses a system-font fallback so it makes no Google Fonts request)
- [ ] Remove `<meta name="robots" content="noindex, nofollow">`
