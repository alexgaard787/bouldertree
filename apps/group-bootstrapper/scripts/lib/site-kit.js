// Shared build kit for the CA regional core site and its contingent group forks.
// Loads + validates the regional data feeds, renders templates, and builds region JSON-LD.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import * as C from "../../../../platforms/ca-regional/templates/shared/components.mjs";

export { C };
export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
export const CA = join(REPO, "platforms", "ca-regional");
export const DATA_DIR = join(CA, "data");
export const TEMPLATES = join(CA, "templates");
export const FORKS_DIR = join(REPO, "forks");
export const SITE_DIR = join(CA, "site");
export const HARNESS = join(REPO, "apps", "group-bootstrapper", "scripts", "validate-group-config.js");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function loadFeeds(dataDir = DATA_DIR) {
  // strictRequired off: flyers.schema.json uses oneOf[{required:[placeholder]},{required:[src]}] for "exactly one source".
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  ajv.addSchema(readJson(join(dataDir, "schema", "common.defs.json")));
  const feeds = {}, errors = [], raw = {};
  for (const name of ["region", "news", "flyers"]) {
    const text = readFileSync(join(dataDir, `${name}.json`), "utf8");
    raw[name] = text;
    let data;
    try { data = JSON.parse(text); } catch (e) { errors.push(`${name}.json: invalid JSON (${e.message})`); continue; }
    const validate = ajv.compile(readJson(join(dataDir, "schema", `${name}.schema.json`)));
    if (!validate(data)) for (const err of validate.errors) errors.push(`${name}.json ${err.instancePath || "/"} ${err.message}${err.params?.additionalProperty ? ` ("${err.params.additionalProperty}")` : ""}`);
    feeds[name] = data;
  }
  return { feeds, errors, hash: sha256(raw.region + raw.news + raw.flyers) };
}

export function assets() {
  const r = (p) => readFileSync(join(TEMPLATES, "shared", p), "utf8").trim();
  return { css: r("site.css"), js: r("site.js"), previewJs: r("group-preview.js") };
}
export const template = (name) => readFileSync(join(TEMPLATES, name, "index.template.html"), "utf8");

export function to24(t) {
  const m = String(t || "").trim().match(/^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// Meeting summaries the client runtime uses for "Happening Next" and .ics.
export function meetingsForRuntime(cfg, labelSuffix = "") {
  return (cfg.meetings || [])
    .filter((m) => !C.isVerify(m.day) && to24(m.time))
    .map((m) => ({
      day: m.day,
      time24: to24(m.time),
      timeLabel: C.to12h(to24(m.time)),
      durationMinutes: Number.isInteger(m.durationMinutes) ? m.durationMinutes : null,
      label: `${cfg.groupName} · ${cfg.venueLabel}${m.attendance === "hybrid" ? " + Zoom" : ""}${labelSuffix}`,
    }));
}

// Generated forks (spokes) found under forks/<slug>/ with a manifest. The region hub lists them by area.
export function listForks(forksDir = FORKS_DIR) {
  if (!existsSync(forksDir)) return [];
  return readdirSync(forksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(forksDir, d.name, "fork.manifest.json")))
    .map((d) => ({ slug: d.name, cfg: readJson(join(forksDir, d.name, "group.json")), manifest: readJson(join(forksDir, d.name, "fork.manifest.json")) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function regionJsonLd(region, forks) {
  const site = C.isHttp(region.links.regionalSite) ? region.links.regionalSite.replace(/#.*$/, "") : "";
  const org = {
    "@type": "Organization",
    "@id": `${site}#region`,
    name: `${region.fellowship} ${region.regionName}`,
    alternateName: [region.shortName, region.councilName],
    description: `${region.councilName} of ${region.fellowship}: meetings, help, and service across the ${region.regionName}. Self-supporting; no dues or fees.`,
    areaServed: region.areas.map((a) => ({ "@type": "AdministrativeArea", name: `${a.name} — ${region.regionName}` })),
  };
  if (site) org.url = site;
  if (!C.isVerify(region.hotline.number)) org.contactPoint = { "@type": "ContactPoint", contactType: "hotline", telephone: region.hotline.number };
  if (C.isHttp(region.links.worldServices)) org.parentOrganization = { "@type": "Organization", name: `${region.fellowship} World Services`, url: region.links.worldServices };
  const subs = forks.map(({ cfg }) => {
    const o = { "@type": "Organization", name: `${cfg.groupName} — ${C.isVerify(cfg.fellowship) || !cfg.fellowship ? region.fellowship : cfg.fellowship} Group` };
    if (C.isHttp(cfg.links?.website)) o.url = cfg.links.website;
    return o;
  });
  if (subs.length) org.subOrganization = subs;
  return { "@context": "https://schema.org", "@graph": [org] };
}
