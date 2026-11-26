# Template layer: CA regional core and group forks

The regional site is the core product. Group sites are contingent forks generated from it.

```
templates/
├── shared/
│   ├── components.mjs     # Server-side HTML components used by both pages (help bar, news, flyers, lightbox,
│   │                      # struggles form, conference card, metrics, footer). Pure functions, escaped output.
│   ├── site.css           # Shared mobile-first styles (Open Sans + system fallback, #00594F, print sheet)
│   ├── site.js            # Shared client runtime: tabs, area routing, Happening Next, lightbox/download/print,
│   │                      # upload preview, struggles form, conference card + .ics, segmented metrics stubs
│   └── group-preview.js   # Regional-only Group Bootstrapper preview (lightweight mirror of the repo harness)
├── region/index.template.html   # Hub page → platforms/ca-regional/site/index.html (build-region.js)
└── group/index.template.html    # Fork page → forks/<slug>/index.html (bootstrap-group.js)
```

The templates use `{{VAR}}` for escaped values and `{{{VAR}}}` for trusted HTML from `components.mjs`. A missing variable is a build error. Every page is self-contained: CSS and JS are inlined, and a CSP meta tag blocks all network requests.

## Data that forks inherit (`platforms/ca-regional/data/`)

- `region.json`: identity, the hotline pointer ([VERIFY]), links, Aug 2027 conference facts, and areas for hub-and-spoke routing
- `news.json`: Regional Council and World Council items (placeholders until real items are posted)
- `flyers.json`: Regional and World Council flyers (`placeholder` renders an SVG; `src` points at a real file)
- `schema/*.schema.json`: JSON Schemas for each feed. Builds fail, and nothing is written, if a feed is invalid.

## Build

```bash
cd apps/group-bootstrapper && npm ci
node scripts/bootstrap-group.js examples/bottom-line-club-101.v2.json   # forks/bottom-line-club-101/
node scripts/build-region.js                                            # platforms/ca-regional/site/index.html (lists forks by area)
```

Generate the forks first, then the region, so the hub lists every spoke.
