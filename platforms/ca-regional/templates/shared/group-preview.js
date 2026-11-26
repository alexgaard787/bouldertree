/* Group Bootstrapper preview (regional site): edit a group.json, see in-page checks and the fork's JSON-LD.
 * Lightweight mirror of apps/group-bootstrapper/scripts/validate-group-config.js. The repo harness is authoritative. */
(function () {
  "use strict";
  var VERIFY = "[VERIFY]";
  var $ = function (s) { return document.querySelector(s); };
  if (!$("#cfg")) return;
  var download = function (name, mime, text) {
    var url = URL.createObjectURL(new Blob([text], { type: mime }));
    var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  };
  var metrics = window.caMetrics || { track: function () {} };
  /* ---------- Anonymity heuristics shared by forms + bootstrapper ---------- */
  var PHONE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  var NON_NAME = ("a an and the of for at in on to with by or Anonymous Cocaine Fellowship Group Groups Club Line Bottom Meeting Meetings Region Regional Area Areas Southwest Central Texas Austin Houston Dallas Fort Worth San Antonio Marcos El Paso Lockhart Buda Kyle TX World Conference Council Service Services Unity Tradition Traditions Seventh Six Seven Ten Eleven Twelve Step Steps Hall Church Center Room Zoom Hybrid In-Person Online Open Closed Format Newcomer Newcomers First What Expect Happening Next Need Help Now Hotline Website Ideas Struggles Feedback Flyers Flyer News Updates August Monday Tuesday Wednesday Thursday Friday Saturday Sunday Weekly Recovery Aftercare Family Families Loved Ones Book Study Speaker Discussion Home Upholds Supported Every Displays Connects Highlights Public Information Committee Literature Business Reserve Block Calendar Day Workshop Workshops Campout Campouts Call Text Email Contact Ask Please Thanks Hi Hello").split(/\s+/);
  function namePairs(t) {
    var re = /\b([A-Z][a-z]{1,}(?:-[A-Z][a-z]+)?)\s+([A-Z][a-z]{1,}(?:-[A-Z][a-z]+)?)\b/g, m, out = [];
    while ((m = re.exec(t))) { if (NON_NAME.indexOf(m[1]) < 0 && NON_NAME.indexOf(m[2]) < 0) out.push(m[0]); re.lastIndex = m.index + m[1].length + 1; }
    return out;
  }
  function anonIssues(t) {
    var i = []; if (PHONE.test(t)) i.push("a phone number"); if (EMAIL.test(t)) i.push("an email address");
    var n = namePairs(t); if (n.length) i.push("what looks like a full name (" + n.join(", ") + ")"); return i;
  }

  /* ---------- Group Bootstrapper preview: lightweight mirror of validate-group-config.js ---------- */
  var DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  var TOP = ["isSample","schemaVersion","slug","fellowship","groupName","region","area","areaSlug","venueLabel","venueAddress","venueLocality","cadence","welcomeCopy","seventhTraditionNote","traditionsNote","meetings","groupServiceEmail","groupServiceUrl","links","sections","traditionsCompliance","worldConference2027"];
  var DENY_FIELDS = ["lastname","surname","familyname","fullname","firstname","membername","contactname","chairname","secretaryname","sponsorname","phone","phonenumber","mobile","cell","cellphone","telephone","personalphone","personalemail","email","homeaddress","dob","birthdate"];
  var DENY_DOMAINS = ["amazon.","amzn.","ebay.","etsy.","shopify","paypal.me","venmo.","cash.app","gofundme.","patreon.","bit.ly","tinyurl.","rehab","detox","treatment","recoverycenter","addictioncenter","sober-living","soberliving","casino"];
  var AFF = [/[?&]utm_[a-z]+=/i, /[?&](ref|aff|affiliate|affid|tag|partner|promo|coupon|clickid|gclid|fbclid)=/i, /\/(shop|store|buy|checkout|cart|product|products|deals?|coupons?)(\/|$|\?)/i, /^https?:\/\/(shop|store|buy)\./i];
  var isV = function (v) { return typeof v === "string" && v.indexOf(VERIFY) >= 0; };
  var real = function (v) { return v == null || isV(v) ? undefined : v; };
  var isHttp = function (v) { return typeof v === "string" && /^https?:\/\//i.test(v) && !isV(v); };
  function host(u) { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ""; } }
  function check(cfg) {
    var errs = [], warns = [];
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return { errs: ["group.json must be an object"], warns: [] };
    ["isSample","groupName","venueLabel","meetings"].forEach(function (k) { if (!(k in cfg)) errs.push("missing required field: " + k); });
    Object.keys(cfg).forEach(function (k) { if (TOP.indexOf(k) < 0) errs.push('unknown field "' + k + '" (schema allows no extra fields)'); });
    if (cfg.meetings && (!Array.isArray(cfg.meetings) || !cfg.meetings.length)) errs.push("meetings must be a non-empty list");
    (Array.isArray(cfg.meetings) ? cfg.meetings : []).forEach(function (m, i) {
      ["day","time","timezone","format","attendance"].forEach(function (k) { if (!(k in m)) errs.push("meetings[" + i + "]." + k + " is required"); });
      if (m.day && !isV(m.day) && DAYS.indexOf(m.day) < 0) errs.push("meetings[" + i + "].day must be a weekday name");
      if (m.attendance && !isV(m.attendance) && ["in-person","online","hybrid"].indexOf(m.attendance) < 0) errs.push("meetings[" + i + "].attendance must be in-person, online, or hybrid");
      if (m.format && !isV(m.format) && ["open","closed"].indexOf(m.format) < 0) errs.push("meetings[" + i + "].format must be open or closed");
      if (m.time && !isV(m.time) && !to24h(m.time)) errs.push("meetings[" + i + "].time must look like 19:30 or 7:30 p.m.");
    });
    var tc = cfg.traditionsCompliance;
    if (tc) ["noPersonalLastNames","noCommercialEndorsement","autoPurgeTransientContactLogs"].forEach(function (k) { if (tc[k] !== true) errs.push("traditionsCompliance." + k + " must be true"); });
    var own = [cfg.links && cfg.links.website, cfg.groupServiceUrl, cfg.links && cfg.links.regionalSite, cfg.links && cfg.links.areaHub].filter(isHttp).map(host);
    var allow = ["zoom.us","zoomgov.com","ca.org"].concat(own);
    (function walk(n, p) {
      if (Array.isArray(n)) return n.forEach(function (v, i) { walk(v, p.replace(/\.$/, "") + "[" + i + "]."); });
      if (n && typeof n === "object") return Object.keys(n).forEach(function (k) {
        var kk = k.toLowerCase().replace(/[^a-z]/g, "");
        if (kk !== "groupserviceemail" && kk !== "groupname" && DENY_FIELDS.indexOf(kk) >= 0) errs.push(p + k + ': personal-contact field not allowed (Traditions 11 & 12)');
        walk(n[k], p + k + ".");
      });
      if (typeof n !== "string") return;
      var path = p.replace(/\.$/, ""), key = path.split(".").pop();
      if (isV(n)) warns.push(path + ": [VERIFY]");
      if (EMAIL.test(n) && key !== "groupServiceEmail") errs.push(path + ": email address not allowed here (Tradition 11)");
      var noUrl = n.replace(/\bhttps?:\/\/[^\s"'<>)]+/gi, "");
      if (PHONE.test(noUrl)) errs.push(path + ": phone-number pattern (Tradition 11)");
      var np = namePairs(noUrl);
      if (np.length) (/(name|contact|chair|secretary|host|leader|speaker|label)$/i.test(key) ? errs : warns).push(path + ": possible personal name " + np.join(", ") + " (Traditions 11 & 12)");
      (n.match(/\bhttps?:\/\/[^\s"'<>)]+/gi) || []).forEach(function (u) {
        var h = host(u), lo = u.toLowerCase();
        if (DENY_DOMAINS.some(function (d) { return h.indexOf(d) >= 0; })) errs.push(path + ": commercial/treatment domain " + h + " (Traditions 6 & 7)");
        else if (AFF.some(function (r) { return r.test(lo); })) errs.push(path + ": affiliate/tracking/shop link (Traditions 6 & 11)");
        else if (!allow.some(function (a) { return h === a || h.slice(-a.length - 1) === "." + a; })) warns.push(path + ": host " + h + " not on allowlist, confirm non-commercial");
      });
    })(cfg, "");
    return { errs: errs, warns: warns };
  }
  function to24h(t) {
    if (!t || isV(t)) return undefined;
    var m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?$/i); if (!m) return undefined;
    var h = +m[1], ap = (m[3] || "").toLowerCase().replace(/\./g, "");
    if (h > 23 || +m[2] > 59) return undefined;
    if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
    return (h < 10 ? "0" : "") + h + ":" + m[2] + ":00";
  }
  // Port of buildJsonLd() in apps/group-bootstrapper/scripts/validate-group-config.js — keep in sync.
  function buildJsonLd(cfg) {
    var MODE = { "in-person": "https://schema.org/OfflineEventAttendanceMode", online: "https://schema.org/OnlineEventAttendanceMode", hybrid: "https://schema.org/MixedEventAttendanceMode" };
    var FREQ = { weekly: "P1W", biweekly: "P2W", monthly: "P1M" };
    var LABEL = { "in-person": "In-Person", online: "Online", hybrid: "In-Person & Zoom Hybrid" };
    var fellowship = real(cfg.fellowship) || "Cocaine Anonymous", groupName = real(cfg.groupName) || "Local Group";
    var site = isHttp(cfg.links && cfg.links.website) ? cfg.links.website.replace(/#.*$/, "") : "";
    var orgId = site + "#group", region = real(cfg.region), area = real(cfg.area), venue = real(cfg.venueLabel), loc = cfg.venueLocality || {};
    var org = { "@type": "Organization", "@id": orgId, name: groupName + " — " + fellowship + " Group",
      description: groupName + " is a local " + fellowship + " group" + (venue ? " meeting at " + venue : "") + (real(loc.city) ? " in " + real(loc.city) + (real(loc.state) ? ", " + real(loc.state) : "") : "") + ". Self-supporting through the 7th Tradition; no dues or fees; newcomers welcome." };
    if (site) org.url = site;
    if (area || region) org.areaServed = { "@type": "AdministrativeArea", name: [area, region].filter(Boolean).join(" — ") };
    if (region) org.parentOrganization = { "@type": "Organization", name: fellowship + " " + region };
    var events = (cfg.meetings || []).map(function (m, i) {
      var att = real(m.attendance), fmt = real(m.format);
      var ev = { "@type": "Event", "@id": site + "#meeting-" + (i + 1), name: groupName + " Weekly Recovery Meeting" + (att ? " (" + LABEL[att] + ")" : ""),
        description: (fmt === "open" ? "Open" : fmt === "closed" ? "Closed" : "Recovery") + " meeting of the " + groupName + " group. No dues or fees; no pressure to speak.",
        eventStatus: "https://schema.org/EventScheduled", isAccessibleForFree: true, organizer: { "@id": orgId } };
      if (att) ev.eventAttendanceMode = MODE[att];
      var s = { "@type": "Schedule" };
      if (FREQ[real(cfg.cadence)]) s.repeatFrequency = FREQ[cfg.cadence];
      if (real(m.day)) s.byDay = "https://schema.org/" + m.day;
      if (to24h(m.time)) s.startTime = to24h(m.time);
      if (real(m.timezone)) s.scheduleTimezone = m.timezone;
      if (typeof m.durationMinutes === "number" && m.durationMinutes % 1 === 0) s.duration = "PT" + m.durationMinutes + "M";
      if (Object.keys(s).length > 1) ev.eventSchedule = s;
      var locs = [];
      if ((!att || att === "in-person" || att === "hybrid") && venue) {
        var ad = { "@type": "PostalAddress" };
        if (real(cfg.venueAddress)) ad.streetAddress = cfg.venueAddress;
        if (real(loc.city)) ad.addressLocality = loc.city;
        if (real(loc.state)) ad.addressRegion = loc.state;
        if (real(loc.country)) ad.addressCountry = loc.country;
        var pl = { "@type": "Place", name: venue }; if (Object.keys(ad).length > 1) pl.address = ad; locs.push(pl);
      }
      if (att === "online" || att === "hybrid") {
        var vl = { "@type": "VirtualLocation", name: groupName + " Zoom room (link shared by the group)" };
        if (isHttp(cfg.links && cfg.links.onlineMeetingUrl)) vl.url = cfg.links.onlineMeetingUrl; locs.push(vl);
      }
      if (locs.length) ev.location = locs.length === 1 ? locs[0] : locs;
      return ev;
    });
    return { "@context": "https://schema.org", "@graph": [org].concat(events) };
  }

  var baseCfg = JSON.parse($("#starter-config").textContent);
  window.bouldertree = { buildJsonLd: buildJsonLd, check: check };
  var ta = $("#cfg"), timer;
  ta.value = JSON.stringify(baseCfg, null, 2);
  function refresh() {
    var m = $("#cfg-msg"), list = $("#cfg-issues"), cfg;
    try { cfg = JSON.parse(ta.value); } catch (e) { m.className = "msg err"; m.textContent = "Not valid JSON: " + e.message; list.innerHTML = ""; $("#ld-out").textContent = ""; return; }
    var r = check(cfg);
    list.innerHTML = r.errs.map(function (x) { return '<li class="msg err">Error: ' + x.replace(/</g, "&lt;") + "</li>"; }).join("") +
      r.warns.map(function (x) { return "<li>Check: " + x.replace(/</g, "&lt;") + "</li>"; }).join("");
    if (r.errs.length) { m.className = "msg err"; m.textContent = r.errs.length + " error(s). The bootstrapper will not generate a fork until they are fixed."; $("#ld-out").textContent = "(JSON-LD is not generated while there are errors.)"; return; }
    m.className = "msg ok"; m.textContent = "Passes the in-page checks with " + r.warns.length + " item(s) to confirm. Run bootstrap-group.js to generate the fork.";
    $("#ld-out").textContent = JSON.stringify(buildJsonLd(cfg), null, 2);
  }
  ta.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(refresh, 250); });
  $("#cfg-reset").addEventListener("click", function () { ta.value = JSON.stringify(baseCfg, null, 2); refresh(); });
  $("#cfg-dl").addEventListener("click", function () { download("group.json", "application/json", ta.value); metrics.track("sphere", "bootstrapper_download"); });
  $("#ld-copy").addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText($("#ld-out").textContent); });
  refresh();
})();
