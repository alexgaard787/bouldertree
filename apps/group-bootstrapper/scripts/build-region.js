#!/usr/bin/env node
/**
 * build-region.js — renders the CA Southwest Regional core site (the hub) to
 * platforms/ca-regional/site/index.html from:
 *   platforms/ca-regional/data/{region,news,flyers}.json   (validated against data/schema/*.schema.json)
 *   platforms/ca-regional/templates/region/index.template.html + templates/shared/*
 *   forks/<slug>/group.json                               (generated group forks, listed under their area)
 * Output is one self-contained static HTML file (no network requests). Exit 1 on any data error; nothing is written.
 *
 * Usage: node scripts/build-region.js [--out path] [--check]
 *   --check  exit 1 if the committed site/index.html differs from a fresh build (used in CI)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { C, FORKS_DIR, REPO, SITE_DIR, assets, listForks, loadFeeds, meetingsForRuntime, regionJsonLd, template } from "./lib/site-kit.js";

export function buildRegion({ outFile = join(SITE_DIR, "index.html") } = {}) {
  const { feeds, errors } = loadFeeds();
  if (errors.length) return { errors };
  const { region, news, flyers } = feeds;
  const forks = listForks();
  const outDir = dirname(outFile);
  const forkHref = (slug) => relative(outDir, join(FORKS_DIR, slug, "index.html")).split("\\").join("/");

  const chips = region.areas.map((a) => `<li><a href="#area-${C.esc(a.slug)}" data-metric="seekers:area_link_click">${C.esc(a.name)}</a></li>`).join("\n      ");
  const panels = region.areas.map((a) => {
    const groups = forks.filter((f) => f.cfg.areaSlug === a.slug);
    const list = groups.length
      ? `<ul class="group-list">${groups.map(({ slug, cfg }) => {
          const m = (cfg.meetings || [])[0] || {};
          const sum = C.meetingSummary(m);
          return `<li><a href="${C.esc(forkHref(slug))}" data-metric="seekers:group_link_click"><strong>${C.esc(cfg.groupName)}</strong></a> · ${C.esc(sum.day)}s ${C.esc(sum.time)} · ${C.esc(cfg.venueLabel)} · ${C.esc(sum.mode)}${sum.format === "open" ? " · Open meeting" : ""}</li>`;
        }).join("")}</ul>`
      : `<p>No group pages have been generated for this area yet. Meeting list ${C.badge()}</p>`;
    return `<section class="area-panel" id="area-${C.esc(a.slug)}" aria-label="${C.esc(a.name)} meetings">
      <h4>${C.esc(a.name)}</h4>
      ${list}
      <p class="hint">Area page: <code>${C.esc(a.plannedPath)}</code> ${C.isHttp(a.url) ? `<a href="${C.esc(a.url)}">open</a>` : C.badge("URL")}</p>
    </section>`;
  }).join("\n    ");

  const meetings = forks.flatMap(({ cfg }) => meetingsForRuntime(cfg));
  const { css, js, previewJs } = assets();
  const starter = JSON.parse(readFileSync(join(REPO, "apps", "group-bootstrapper", "examples", "bottom-line-club-101.v2.json"), "utf8"));
  const vars = {
    TITLE: `${region.shortName} · Meetings, Help & Service`,
    DESCRIPTION: `${region.fellowship} meetings, help, and service across the ${region.regionName}. No dues or fees. Find a meeting by area, regional flyers, and the August 2027 World Conference room block.`,
    SHORT_NAME: region.shortName,
    COUNCIL_NAME: region.councilName,
    FELLOWSHIP: region.fellowship,
    REGION_NAME: region.regionName,
    JSONLD: C.scriptJson(regionJsonLd(region, forks)),
    CSS: css,
    HELPBAR: C.helpBar(region, "Happening Next: find a meeting by area"),
    HELP_CARD: C.helpCard(region),
    AREA_CHIPS: chips,
    AREA_PANELS: panels,
    MEETING_FINDER: C.isHttp(region.links.meetingFinder) ? `<a href="${C.esc(region.links.meetingFinder)}">open</a>` : C.badge(),
    FIRST_MEETING: C.firstMeetingCard(),
    AFTERCARE_FAMILY: C.aftercareFamily(region, "#areas"),
    NEWS: C.newsList(news),
    FLYERS: C.flyerGallery(flyers),
    UPLOAD: C.chairUpload(region),
    STRUGGLES: C.strugglesForm(region),
    CONFERENCE: C.conferenceCard(region),
    METRICS: C.metricsCard(),
    FOOTER: C.footer(region),
    LIGHTBOX: C.lightboxAndPrintSheet(),
    SITE_DATA: C.scriptJson({ page: "region", meetings }),
    STARTER_CONFIG: C.scriptJson(starter),
    SITE_JS: js,
    PREVIEW_JS: previewJs,
  };
  const html = C.renderTemplate(template("region"), vars);
  return { html, outFile, forks: forks.map((f) => f.slug) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outFile = outIdx >= 0 ? resolve(args[outIdx + 1]) : join(SITE_DIR, "index.html");
  const res = buildRegion({ outFile });
  if (res.errors) {
    for (const e of res.errors) console.error(`ERROR ${e}`);
    console.error("build-region: FAIL (no output written)");
    process.exit(1);
  }
  if (args.includes("--check")) {
    const same = existsSync(outFile) && readFileSync(outFile, "utf8") === res.html;
    console.error(same ? "build-region --check: site/index.html is up to date" : "build-region --check: site/index.html is STALE, run npm run build:region");
    process.exit(same ? 0 : 1);
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, res.html);
  console.error(`build-region: wrote ${relative(REPO, outFile)} (${res.html.length} bytes; group forks listed: ${res.forks.join(", ") || "none"})`);
}
