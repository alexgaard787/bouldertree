#!/usr/bin/env node
/**
 * validate-group-config.js — BoulderTree group.json validation harness (V1)
 *
 * Domain: 02 - CA Regional Website & Service only.
 *
 * What it does
 *   1. Validates a group.json against apps/group-bootstrapper/schema/group-config.schema.json (Ajv, draft 2020-12).
 *   2. Anonymity guardrails (Traditions Eleven & Twelve): blocks personal-contact field names
 *      (lastName, phone, personalEmail, ...) and capitalized two-word person-name patterns in
 *      name/contact fields; flags them as warnings in other free text.
 *   3. Commercial-link guardrails (Traditions Six & Seven): blocks denylisted / affiliate / UTM /
 *      shop-style links; allows zoom.us, ca.org, and the group's own site; warns on any other host.
 *   4. Flags every "[VERIFY]" value as a warning (or an error with --strict-verify).
 *   5. Emits Organization + Event JSON-LD (schema.org @graph) to stdout, a file (--out), or injects it
 *      into an HTML file between <!-- JSONLD:START --> and <!-- JSONLD:END --> markers (--inject).
 *
 * Usage
 *   node scripts/validate-group-config.js <group.json> [--schema path] [--out jsonld.json]
 *        [--inject index.html] [--allow-host example.org]... [--strict-verify] [--quiet] [--no-jsonld]
 *
 * Exit codes: 0 = valid (warnings allowed), 1 = validation/guardrail errors, 2 = usage or I/O error.
 * The report goes to stderr so stdout stays clean JSON-LD.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const VERIFY = "[VERIFY]";
const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = join(here, "..", "schema", "group-config.schema.json");

// ---------- guardrail configuration ----------
export const DENYLIST_FIELDS = [
  "lastname", "surname", "familyname", "fullname", "firstname", "membername", "contactname",
  "chairname", "secretaryname", "sponsorname", "phone", "phonenumber", "mobile", "cell", "cellphone",
  "telephone", "personalphone", "personalemail", "email", "homeaddress", "dob", "birthdate",
];
// Field names that are allowed even though they contain a denylisted stem.
const ALLOWED_FIELD_NAMES = new Set(["groupserviceemail", "groupname"]);

const NAME_FIELD_RE = /(name|contact|chair|secretary|host|leader|speaker|label)$/i;

// Words that make a capitalized pair "not a person" (fellowship, venue, and service vocabulary).
const NON_NAME_WORDS = new Set(`a an and the of for at in on to with by or
Anonymous Cocaine Fellowship Group Groups Club Line Bottom Meeting Meetings Region Regional Area Areas
Southwest Central Texas Austin Houston Dallas Fort Worth San Antonio Marcos El Paso Lockhart Buda Kyle TX
World Conference Council Service Services Unity Tradition Traditions Seventh Six Seven Ten Eleven Twelve
Step Steps Hall Church Center Room Zoom Hybrid In-Person Online Open Closed Format Newcomer Newcomers
First What Expect Happening Next Need Help Now Hotline Website Ideas Struggles Feedback Flyers Flyer News
Updates August Monday Tuesday Wednesday Thursday Friday Saturday Sunday Weekly Recovery Aftercare Family
Families Loved Ones Book Study Speaker Discussion Home Upholds Supported Every Displays Connects Regional
Highlights Public Information Committee H&I Literature Business Reserve Room Block Calendar
Day Workshop Workshops Campout Campouts Call Text Email Contact Ask Please Thanks Hi Hello`.split(/\s+/));

export const DENY_DOMAINS = [
  "amazon.", "amzn.", "ebay.", "etsy.", "shopify", "paypal.me", "venmo.", "cash.app", "gofundme.",
  "patreon.", "bit.ly", "tinyurl.", "rehab", "detox", "treatment", "recoverycenter", "addictioncenter",
  "sober-living", "soberliving", "casino", "bet365", "draftkings",
];
const AFFILIATE_PATTERNS = [
  /[?&]utm_[a-z]+=/i, /[?&](ref|aff|affiliate|affid|tag|partner|promo|coupon|clickid|gclid|fbclid)=/i,
  /\/(shop|store|buy|checkout|cart|product|products|deals?|coupons?)(\/|$|\?)/i,
  /^https?:\/\/(shop|store|buy)\./i,
];
const ALLOW_HOST_SUFFIXES = ["zoom.us", "zoomgov.com", "ca.org"];
const URL_RE = /\bhttps?:\/\/[^\s"'<>)]+/gi;

const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// ---------- helpers ----------
const isVerify = (v) => typeof v === "string" && v.includes(VERIFY);
const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v) && !isVerify(v);
const real = (v) => (v === undefined || v === null || isVerify(v) ? undefined : v);

function walk(node, path, visit) {
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}/${i}`, visit));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      visit({ key: k, value: v, path: `${path}/${k}`, isKey: true });
      walk(v, `${path}/${k}`, visit);
    }
  } else visit({ key: path.split("/").pop(), value: node, path, isKey: false });
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

export function findNamePairs(text) {
  const hits = [];
  const re = /\b([A-Z][a-z]{1,}(?:-[A-Z][a-z]+)?)\s+([A-Z][a-z]{1,}(?:-[A-Z][a-z]+)?)\b/g;
  let m;
  while ((m = re.exec(text))) {
    const [pair, a, b] = m;
    if (!NON_NAME_WORDS.has(a) && !NON_NAME_WORDS.has(b)) hits.push(pair);
    re.lastIndex = m.index + a.length + 1; // allow overlapping pairs
  }
  return hits;
}

// ---------- guardrails ----------
export function guardrails(cfg, { allowHosts = [], strictVerify = false } = {}) {
  const errors = [];
  const warnings = [];
  const ownHosts = [real(cfg?.links?.website), real(cfg?.groupServiceUrl), real(cfg?.links?.regionalSite), real(cfg?.links?.areaHub)]
    .filter(isHttp).map(hostOf);
  const allowed = [...ALLOW_HOST_SUFFIXES, ...ownHosts, ...allowHosts.map((h) => h.toLowerCase())];

  walk(cfg, "", ({ key, value, path, isKey }) => {
    if (isKey) {
      const k = key.toLowerCase().replace(/[^a-z]/g, "");
      if (!ALLOWED_FIELD_NAMES.has(k) && DENYLIST_FIELDS.includes(k)) {
        errors.push(`${path}: personal-contact field "${key}" is not allowed (Traditions Eleven & Twelve).`);
      }
      return;
    }
    if (typeof value !== "string") return;

    if (isVerify(value)) {
      (strictVerify ? errors : warnings).push(`${path}: [VERIFY] placeholder still unconfirmed.`);
    }
    if (EMAIL_RE.test(value) && !path.endsWith("/groupServiceEmail")) {
      errors.push(`${path}: contains an email address; only groupServiceEmail may hold one (Tradition Eleven).`);
    }
    if (PHONE_RE.test(value.replace(URL_RE, ""))) {
      errors.push(`${path}: contains a phone-number pattern; publish only an official regional hotline via a help page (Tradition Eleven).`);
    }
    const names = findNamePairs(value.replace(URL_RE, ""));
    if (names.length) {
      const msg = `${path}: possible personal name(s) ${names.map((n) => `"${n}"`).join(", ")} (Traditions Eleven & Twelve).`;
      if (NAME_FIELD_RE.test(key)) errors.push(msg);
      else warnings.push(`${msg} Review: use first name + last initial at most, or remove.`);
    }
    for (const url of value.match(URL_RE) ?? []) {
      const host = hostOf(url);
      const lower = url.toLowerCase();
      const denied = DENY_DOMAINS.find((d) => host.includes(d));
      const affiliate = AFFILIATE_PATTERNS.find((re) => re.test(lower));
      const isAllowed = allowed.some((h) => host === h || host.endsWith(`.${h}`));
      if (denied) errors.push(`${path}: commercial/treatment domain "${host}" blocked (Traditions Six & Seven).`);
      else if (affiliate) errors.push(`${path}: affiliate/tracking/shop link pattern ${affiliate} blocked (Traditions Six & Eleven).`);
      else if (!isAllowed) warnings.push(`${path}: host "${host}" is not on the allowlist; confirm it is non-commercial (Tradition Six) or pass --allow-host.`);
    }
  });
  return { errors, warnings };
}

// ---------- JSON-LD generator ----------
const DAY_IRI = (d) => `https://schema.org/${d}`;
const MODE = {
  "in-person": "https://schema.org/OfflineEventAttendanceMode",
  online: "https://schema.org/OnlineEventAttendanceMode",
  hybrid: "https://schema.org/MixedEventAttendanceMode",
};
const FREQ = { weekly: "P1W", biweekly: "P2W", monthly: "P1M" };
const MODE_LABEL = { "in-person": "In-Person", online: "Online", hybrid: "In-Person & Zoom Hybrid" };

export function to24h(t) {
  if (!t || isVerify(t)) return undefined;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  const ap = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}:00`;
}

export function buildJsonLd(cfg) {
  const fellowship = real(cfg.fellowship) || "Cocaine Anonymous";
  const groupName = real(cfg.groupName) || "Local Group";
  const site = isHttp(cfg?.links?.website) ? cfg.links.website.replace(/#.*$/, "") : "";
  const orgId = `${site}#group`;
  const region = real(cfg.region);
  const area = real(cfg.area);
  const venue = real(cfg.venueLabel);
  const loc = cfg.venueLocality || {};

  const org = {
    "@type": "Organization",
    "@id": orgId,
    name: `${groupName} — ${fellowship} Group`,
    description: [
      `${groupName} is a local ${fellowship} group`,
      venue ? ` meeting at ${venue}` : "",
      real(loc.city) ? ` in ${real(loc.city)}${real(loc.state) ? `, ${real(loc.state)}` : ""}` : "",
      ". Self-supporting through the 7th Tradition; no dues or fees; newcomers welcome.",
    ].join(""),
  };
  if (site) org.url = site;
  if (area || region) org.areaServed = { "@type": "AdministrativeArea", name: [area, region].filter(Boolean).join(" — ") };
  if (region) org.parentOrganization = { "@type": "Organization", name: `${fellowship} ${region}` };

  const events = (cfg.meetings || []).map((m, i) => {
    const attendance = real(m.attendance);
    const ev = {
      "@type": "Event",
      "@id": `${site}#meeting-${i + 1}`,
      name: `${groupName} Weekly Recovery Meeting${attendance ? ` (${MODE_LABEL[attendance]})` : ""}`,
      description: `${real(m.format) === "open" ? "Open" : real(m.format) === "closed" ? "Closed" : "Recovery"} meeting of the ${groupName} group. No dues or fees; no pressure to speak.`,
      eventStatus: "https://schema.org/EventScheduled",
      isAccessibleForFree: true,
      organizer: { "@id": orgId },
    };
    if (attendance) ev.eventAttendanceMode = MODE[attendance];
    const sched = { "@type": "Schedule" };
    const freq = FREQ[real(cfg.cadence)];
    if (freq) sched.repeatFrequency = freq;
    if (real(m.day)) sched.byDay = DAY_IRI(m.day);
    const t = to24h(m.time);
    if (t) sched.startTime = t;
    if (real(m.timezone)) sched.scheduleTimezone = m.timezone;
    if (Number.isInteger(m.durationMinutes)) sched.duration = `PT${m.durationMinutes}M`;
    if (Object.keys(sched).length > 1) ev.eventSchedule = sched;

    const locations = [];
    if (!attendance || attendance === "in-person" || attendance === "hybrid") {
      if (venue) {
        const address = { "@type": "PostalAddress" };
        if (real(cfg.venueAddress)) address.streetAddress = cfg.venueAddress;
        if (real(loc.city)) address.addressLocality = loc.city;
        if (real(loc.state)) address.addressRegion = loc.state;
        if (real(loc.country)) address.addressCountry = loc.country;
        const place = { "@type": "Place", name: venue };
        if (Object.keys(address).length > 1) place.address = address;
        locations.push(place);
      }
    }
    if (attendance === "online" || attendance === "hybrid") {
      const vl = { "@type": "VirtualLocation", name: `${groupName} Zoom room (link shared by the group)` };
      if (isHttp(cfg?.links?.onlineMeetingUrl)) vl.url = cfg.links.onlineMeetingUrl;
      locations.push(vl);
    }
    if (locations.length) ev.location = locations.length === 1 ? locations[0] : locations;
    return ev;
  });

  return { "@context": "https://schema.org", "@graph": [org, ...events] };
}

export function injectJsonLd(html, jsonld) {
  const block = `<!-- JSONLD:START -->\n<script type="application/ld+json" id="group-jsonld">\n${JSON.stringify(jsonld, null, 2).replace(/</g, "\\u003c")}\n</script>\n<!-- JSONLD:END -->`;
  if (!/<!-- JSONLD:START -->[\s\S]*?<!-- JSONLD:END -->/.test(html)) throw new Error("JSONLD markers not found in HTML");
  return html.replace(/<!-- JSONLD:START -->[\s\S]*?<!-- JSONLD:END -->/, block);
}

// ---------- CLI ----------
function parseArgs(argv) {
  const opts = { allowHosts: [], strictVerify: false, quiet: false, jsonld: true };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--schema") opts.schema = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--inject") opts.inject = argv[++i];
    else if (a === "--allow-host") opts.allowHosts.push(argv[++i]);
    else if (a === "--strict-verify") opts.strictVerify = true;
    else if (a === "--quiet") opts.quiet = true;
    else if (a === "--no-jsonld") opts.jsonld = false;
    else if (a === "-h" || a === "--help") opts.help = true;
    else rest.push(a);
  }
  opts.file = rest[0];
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.file) {
    console.error("Usage: node validate-group-config.js <group.json> [--schema path] [--out file] [--inject index.html] [--allow-host host] [--strict-verify] [--quiet] [--no-jsonld]");
    process.exit(opts.help ? 0 : 2);
  }
  const log = (...a) => { if (!opts.quiet) console.error(...a); };
  let schema, cfg;
  try {
    schema = JSON.parse(readFileSync(resolve(opts.schema || DEFAULT_SCHEMA), "utf8"));
    cfg = JSON.parse(readFileSync(resolve(opts.file), "utf8"));
  } catch (e) {
    console.error(`ERROR reading input: ${e.message}`);
    process.exit(2);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const errors = [];
  if (!validate(cfg)) {
    for (const err of validate.errors ?? []) {
      const extra = err.params?.additionalProperty ? ` ("${err.params.additionalProperty}")` : err.params?.allowedValues ? ` (allowed: ${err.params.allowedValues.join(", ")})` : "";
      errors.push(`schema ${err.instancePath || "/"} ${err.message}${extra}`);
    }
  }
  const g = guardrails(cfg, opts);
  errors.push(...g.errors);

  log(`validate-group-config: ${opts.file}`);
  log(`  schema: ${errors.filter((e) => e.startsWith("schema")).length ? "FAIL" : "PASS"} (${opts.schema || DEFAULT_SCHEMA})`);
  for (const e of errors) log(`  ERROR   ${e}`);
  for (const w of g.warnings) log(`  WARN    ${w}`);

  if (errors.length) {
    log(`RESULT: FAIL — ${errors.length} error(s), ${g.warnings.length} warning(s). No JSON-LD emitted.`);
    process.exit(1);
  }
  const jsonld = buildJsonLd(cfg);
  const text = JSON.stringify(jsonld, null, 2);
  if (opts.out) writeFileSync(resolve(opts.out), `${text}\n`);
  if (opts.inject) {
    const p = resolve(opts.inject);
    writeFileSync(p, injectJsonLd(readFileSync(p, "utf8"), jsonld));
    log(`  injected JSON-LD into ${p}`);
  }
  if (opts.jsonld && !opts.out) process.stdout.write(`${text}\n`);
  log(`RESULT: PASS — 0 errors, ${g.warnings.length} warning(s)${g.warnings.length ? " (resolve [VERIFY] items before launch)" : ""}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
