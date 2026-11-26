// Server-side HTML components shared by the regional site and every group fork.
// Pure functions: data in, escaped HTML string out. No network, no file I/O.
export const VERIFY = "[VERIFY]";
export const isVerify = (v) => typeof v === "string" && v.includes(VERIFY);
export const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v) && !isVerify(v);

export function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export const badge = (label) => `<span class="verify">[VERIFY]${label ? " " + esc(label) : ""}</span>`;
export const valueOrBadge = (v, label) => (isVerify(v) || v == null ? badge(label) : esc(v));
export const scriptJson = (obj) => JSON.stringify(obj, null, 2).replace(/</g, "\\u003c");

const SOURCE_LABEL = { "regional-council": "Regional Council", "world-council": "World Council" };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function to12h(t) {
  const m = String(t || "").match(/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]) return `${h}:${m[2]} ${m[3].toLowerCase()}.m.`;
  const ap = h >= 12 ? "p.m." : "a.m.";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

export function flyerPlaceholderSrc(p) {
  const t = (x) => esc(x || "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100"><rect width="850" height="1100" fill="#fff"/><rect width="850" height="220" fill="${t(p.color)}"/><text x="425" y="130" font-family="Open Sans,Arial,sans-serif" font-size="56" font-weight="700" fill="#fff" text-anchor="middle">${t(p.heading)}</text><text x="425" y="420" font-family="Open Sans,Arial,sans-serif" font-size="40" fill="#1A1A1A" text-anchor="middle">${t(p.subheading)}</text><text x="425" y="520" font-family="Open Sans,Arial,sans-serif" font-size="34" fill="#5C4400" text-anchor="middle">${t(p.note)}</text><text x="425" y="1040" font-family="Open Sans,Arial,sans-serif" font-size="26" fill="#4A4A4A" text-anchor="middle">PLACEHOLDER FLYER · C.A. Southwest Region</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export const flyerSrc = (f, assetPrefix = "") => (f.src ? (f.src.startsWith("data:") ? f.src : assetPrefix + f.src) : flyerPlaceholderSrc(f.placeholder));

export function helpBar(region, nextText) {
  return `<section class="helpbar" aria-label="Need help now">
  <div class="wrap">
    <a class="btn light" href="#help" data-metric="seekers:hotline_click">Need Help Now</a>
    <span class="next" id="happening-next" aria-live="polite">${esc(nextText)}</span>
  </div>
</section>`;
}

export function helpCard(region) {
  const h = region.hotline;
  const num = isVerify(h.number) ? badge("regional hotline") : `<a href="tel:${esc(h.number.replace(/[^\d+]/g, ""))}">${esc(h.number)}</a>`;
  const crisis = (region.crisisPointers || []).map((c) => `<li>${esc(c.label)}: <strong>${esc(c.action)}</strong></li>`).join("");
  return `<div class="card accent" id="help">
    <h3>Need help now?</h3>
    <p><strong>${esc(h.label)}:</strong> ${num}</p>
    <p class="hint">${esc(h.note || "")}</p>
    ${crisis ? `<ul>${crisis}</ul>` : ""}
  </div>`;
}

export function firstMeetingCard(extra = "") {
  return `<div class="card" id="first-meeting">
    <details id="first-meeting-details">
      <summary><strong>First Meeting? What to Expect</strong></summary>
      <ul class="checks">
        <li>The only requirement is a desire to stop using cocaine and all other mind-altering substances.</li>
        <li>There are no dues or fees. A basket may go around; you never have to put anything in it.</li>
        <li>You do not have to speak. You can just listen. You can say "I'll pass."</li>
        <li>You do not need to have anything figured out. Arrive a little early if you'd like to meet people.</li>
        <li>On Zoom, you can keep your camera off and use just a first name.</li>
        <li>When you are ready, you can choose a home group. Ask anyone after a meeting how that works.</li>
        ${extra}
      </ul>
    </details>
  </div>`;
}

export function aftercareFamily(region, findHref = "#areas") {
  return `<div class="grid two">
    <div class="card" id="aftercare">
      <h3>Leaving treatment or sober living?</h3>
      <p>Coming to a meeting in your first days home helps. Find a meeting near you, ask for phone numbers from people who offer them at the meeting, and come back next week.</p>
      <p class="hint">C.A. does not endorse or affiliate with any treatment center or sober living home (Tradition Six).</p>
      <a href="${esc(findHref)}" data-metric="seekers:aftercare_click">Find a meeting near you</a>
    </div>
    <div class="card" id="family">
      <h3>For families and loved ones</h3>
      <p>Open meetings welcome anyone, so you can come and listen. Family support pointers for the region are being gathered. ${isHttp(region.links.familyResources) ? `<a href="${esc(region.links.familyResources)}">Family resources</a>` : badge("family resources")}</p>
      <a href="#first-meeting" data-metric="seekers:family_click">What a meeting is like</a>
    </div>
  </div>`;
}

export function newsList(news, { heading = "Regional & World Council news", inheritedNote = "" } = {}) {
  const items = news.items.filter((n) => n.status !== "archived").map((n) => `<li>
      <span class="src">${esc(SOURCE_LABEL[n.source])}</span>${n.status === "placeholder" ? ' <span class="sample">PLACEHOLDER</span>' : ""}
      <h4>${esc(n.title)}</h4>
      <p>${esc(n.summary)}</p>
      <p class="hint">Date: ${valueOrBadge(n.date)}${n.url ? ` · ${isHttp(n.url) ? `<a href="${esc(n.url)}">Read more</a>` : `Link ${badge()}`}` : ""}</p>
    </li>`).join("\n    ");
  return `<div class="card" id="news">
    <h3>${esc(heading)}</h3>
    ${inheritedNote ? `<p class="inherited">${esc(inheritedNote)}</p>` : ""}
    <ul class="news" data-feed="news">
    ${items}
    </ul>
  </div>`;
}

export function flyerGallery(flyers, { inheritedNote = "", assetPrefix = "" } = {}) {
  const items = flyers.items.map((f, i) => `<li><button type="button" data-i="${i}" data-title="${esc(f.title)}" data-name="${esc(f.id)}${f.src && /\.pdf$/.test(f.src) ? ".pdf" : f.src ? "" : ".svg"}" data-src="${esc(flyerSrc(f, assetPrefix))}" data-pdf="${f.src && /pdf/.test(f.src) ? "1" : ""}" aria-label="Open flyer full page: ${esc(f.title)}"><img alt="" src="${esc(flyerSrc(f, assetPrefix))}"><span>${esc(f.title)}</span></button></li>`).join("\n      ");
  return `<div class="card" id="flyers">
    <h3>Regional &amp; World Council flyers</h3>
    ${inheritedNote ? `<p class="inherited">${esc(inheritedNote)}</p>` : ""}
    <p class="hint">Tap a flyer to open it full page. From there you can download it or print a clean sheet with no zooming or screenshots.</p>
    <ul class="gallery" id="gallery" data-feed="flyers">
      ${items}
    </ul>
  </div>`;
}

export function lightboxAndPrintSheet() {
  return `<dialog class="lightbox" id="lightbox" aria-labelledby="lb-title">
  <div class="lb-inner">
    <div class="lb-bar">
      <h2 id="lb-title">Flyer</h2>
      <div class="lb-actions">
        <button class="btn light" type="button" id="lb-prev" aria-label="Previous flyer">‹</button>
        <button class="btn light" type="button" id="lb-next" aria-label="Next flyer">›</button>
        <button class="btn light" type="button" id="lb-zoom">Actual size</button>
        <a class="btn light" id="lb-download" href="#flyers" download>Download</a>
        <button class="btn light" type="button" id="lb-print">Print</button>
        <button class="btn light" type="button" id="lb-close">Close</button>
      </div>
    </div>
    <div class="lb-stage" id="lb-stage"></div>
  </div>
</dialog>
<div id="print-sheet" aria-hidden="true"></div>`;
}

export function chairUpload(region) {
  return `<div class="card" id="upload">
    <h3>Chairs: submit a flyer (preview)</h3>
    <form id="upload-form" novalidate>
      <label for="up-file">Flyer file (image or PDF)</label>
      <input type="file" id="up-file" accept="image/*,application/pdf">
      <label for="up-title">Event title</label>
      <input type="text" id="up-title" autocomplete="off">
      <label for="up-cat">Category</label>
      <select id="up-cat">
        <option>Unity / Campouts</option><option>Workshops / Speakers</option><option>Area / Service</option><option>Other</option>
      </select>
      <label for="up-date">Event date (used to auto-archive the flyer after the event)</label>
      <input type="date" id="up-date">
      <label class="opt"><input type="checkbox" id="up-anon"> This flyer shows no last names, no full-face photos, and no personal phone numbers or emails.</label>
      <p><button class="btn" type="submit">Preview submission</button></p>
      <p class="msg" id="up-msg" role="status"></p>
      <div id="up-preview"></div>
      <p class="hint">Prototype: the file stays in this browser (FileReader only). Nothing is uploaded. Submission endpoint ${isHttp(region.links.flyerSubmissionEndpoint) ? "configured" : badge()}</p>
    </form>
  </div>`;
}

export function chairUploadPointer(regionHref) {
  return `<div class="card" id="upload">
    <h3>Chairs: submit a flyer</h3>
    <p>Flyers are submitted once on the regional site and show up here automatically.</p>
    <p><a class="btn secondary" href="${esc(regionHref)}#upload">Submit a flyer on the regional site</a></p>
  </div>`;
}

export function strugglesForm(region, { groupPrefill = "" } = {}) {
  const topics = [
    "Meeting attendance, newcomer welcome, or group stability",
    "Flyer upload, full-page viewing, or printing/sharing issues",
    "Meeting directory / schedule updates or hotline routing",
    "Unity, H&I, or regional/world service coordination",
    "Other group or website support need",
  ];
  return `<div class="card" id="struggles">
    <h3>Group Struggles &amp; Website Ideas</h3>
    <form id="struggles-form" novalidate>
      <label for="sf-group">Group / area name &amp; meeting schedule (optional)</label>
      <input type="text" id="sf-group" autocomplete="off" value="${esc(groupPrefill)}">
      <p class="hint">Please leave out personal names and phone numbers.</p>
      <fieldset>
        <legend>What are you working through right now?</legend>
        ${topics.map((t, i) => `<label class="opt"><input type="checkbox" name="sf-topic[]" value="${esc(t)}" data-key="${["attendance", "flyers", "directory", "unity", "other"][i]}"> ${esc(t)}</label>`).join("\n        ")}
      </fieldset>
      <label for="sf-support">How can the website or regional committee better support your group?</label>
      <textarea id="sf-support"></textarea>
      <label for="sf-follow">Preferred follow-up path</label>
      <select id="sf-follow">
        <option>Website / Internet Chair update</option>
        <option>Regional Unity Committee connection</option>
        <option>Hotline / H&amp;I / PI committee pointer</option>
        <option>No reply needed, just flagging for the council</option>
      </select>
      <p><button class="btn" type="submit">Preview submission</button></p>
      <p class="msg" id="sf-msg" role="status"></p>
      <pre class="out" id="sf-out" hidden></pre>
      <p class="hint">Prototype: shows what would be sent to the regional feedback channel. Nothing leaves this browser. Endpoint ${isHttp(region.links.groupStrugglesEndpoint) ? "configured" : badge()}</p>
    </form>
  </div>`;
}

export function conferenceCard(region) {
  const c = region.conference2027;
  if (!c.enabled) return "";
  const upfront = c.noUpfrontPayment === true ? "" : ` ${badge("$0 upfront")}`;
  const book = isHttp(c.bookingUrl)
    ? `<a class="btn" href="${esc(c.bookingUrl)}" rel="noopener" data-metric="sphere:conf_booking_click">Open the official room-block booking page</a>`
    : `<a class="btn" href="#conference" aria-disabled="true" id="conf-book" data-metric="sphere:conf_booking_click">Open the official room-block booking page</a> ${badge("booking URL")}`;
  return `<div class="card accent" id="conference">
    <h3>${esc(c.title)}: Reserve a Room Now${upfront}</h3>
    <p>Reserving a room in the official conference block is described as needing <strong>no payment today</strong>. Booking early helps the fellowship meet its room-block quota so costs and room rates stay on track.</p>
    <dl class="facts">
      <dt>When</dt><dd>${esc(isVerify(c.monthYear) ? "" : c.monthYear)} ${isVerify(c.startDate) ? badge("dates") : `${esc(c.startDate)} to ${esc(c.endDate)}`}</dd>
      <dt>Where</dt><dd>${valueOrBadge(c.city, "city")} · ${valueOrBadge(c.hotel, "hotel")}</dd>
    </dl>
    <p>${book}</p>
    <fieldset>
      <legend>Where are you? (anonymous, saved on this device only)</legend>
      <label class="opt"><input type="radio" name="conf-status" value="booked"> I booked a room</label>
      <label class="opt"><input type="radio" name="conf-status" value="planning"> I'm planning to book</label>
      <label class="opt"><input type="radio" name="conf-status" value="not-yet"> Not yet</label>
    </fieldset>
    <div class="grid three">
      <div><label for="conf-group">Group / area label (optional)</label><input type="text" id="conf-group" autocomplete="off"></div>
      <div><label for="conf-in">Check-in (optional)</label><input type="date" id="conf-in" min="2027-08-01" max="2027-08-31"></div>
      <div><label for="conf-out">Check-out (optional)</label><input type="date" id="conf-out" min="2027-08-01" max="2027-09-01"></div>
    </div>
    <p class="hint">No names, emails, or phone numbers are asked for or stored.</p>
    <p class="msg" id="conf-msg" role="status"></p>
    <label for="conf-remind">Remind me to book on</label>
    <input type="date" id="conf-remind">
    <p><button class="btn secondary" type="button" id="conf-ics">Download calendar reminder (.ics)</button></p>
    <p class="hint">The reminder uses the date you pick. If you enter check-in/check-out, your stay is added too.</p>
  </div>`;
}

export function metricsCard() {
  return `<div class="card" id="metrics">
    <h3>Privacy-first metrics (this device only)</h3>
    <p class="hint">Counts only, split into People Seeking Recovery and People Active in the C.A. Sphere. No names, IP addresses, or third-party trackers. Nothing is sent anywhere. Reporting endpoint ${badge()}</p>
    <pre class="out" id="metrics-out"></pre>
    <p><button class="btn secondary" type="button" id="metrics-reset">Clear counts</button></p>
  </div>`;
}

export function footer(region, extra = "") {
  return `<footer>
  <div class="wrap">
    <p>${esc(region.fellowship)} is self-supporting through its own contributions and is not affiliated with any outside organization, treatment center, or business. Our public relations policy is based on attraction rather than promotion.</p>
    ${extra}
    <p>${esc(region.shortName)} · Regional site ${isHttp(region.links.regionalSite) ? `<a href="${esc(region.links.regionalSite)}">link</a>` : badge()} · C.A. logos and brand assets ${badge("approved files")}</p>
  </div>
</footer>`;
}

export function meetingSummary(m) {
  const time = to12h(m.time) || "[VERIFY]";
  const mode = { hybrid: "In-Person + Zoom", "in-person": "In-Person", online: "Online" }[m.attendance] || "[VERIFY]";
  return { day: isVerify(m.day) ? "[VERIFY]" : m.day, time, mode, format: m.format };
}

export function renderTemplate(tpl, vars) {
  const out = tpl.replace(/\{\{\{\s*([A-Z0-9_]+)\s*\}\}\}|\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, raw, escd) => {
    const k = raw || escd;
    if (!(k in vars)) throw new Error(`Template variable ${k} missing`);
    return raw ? String(vars[k]) : esc(vars[k]);
  });
  return out.replace(/[ \t]+$/gm, "");
}
export { DAYS };
