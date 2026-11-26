/* BoulderTree CA regional runtime: shared by the regional site and every group fork.
 * Reads the #site-data JSON block. No network calls. Every feature is optional
 * and only wires up when its markup is present. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var DATA = {};
  try { DATA = JSON.parse(($("#site-data") || {}).textContent || "{}"); } catch (e) { DATA = {}; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  /* ---------- Zero-surveillance segmented metrics (Blueprint Automation #10) ----------
   * Segments: "People Seeking Recovery" (seekers) and "People Active in the C.A. Sphere" (sphere).
   * Only allowlisted event names are counted, in monthly buckets. No timestamps, IDs, IPs, cookies, or text. */
  var METRICS_KEY = "bt.metrics.v1", SCOPE = DATA.page === "group" ? "group:" + (DATA.slug || "") : "region";
  var SEGMENT_LABEL = { seekers: "People Seeking Recovery", sphere: "People Active in the C.A. Sphere" };
  var ALLOWED = {
    seekers: ["hotline_click", "happening_next_view", "area_link_click", "area_view", "group_link_click", "first_meeting_view", "aftercare_click", "family_click", "meeting_calendar_add"],
    sphere: ["flyer_lightbox_open", "flyer_download", "flyer_print", "flyer_upload_started", "flyer_upload_blocked", "flyer_upload_previewed", "struggles_form_submitted", "struggles_attendance", "struggles_flyers", "struggles_directory", "struggles_unity", "struggles_other", "struggles_urgent", "conf_booking_click", "conf_status_booked", "conf_status_planning", "conf_status_not-yet", "conf_calendar_add", "bootstrapper_download"]
  };
  var metrics = {
    track: function (segment, event) {
      if (!ALLOWED[segment] || ALLOWED[segment].indexOf(event) < 0) return;   // unknown events are dropped
      var month = new Date().toISOString().slice(0, 7);
      var all = store.get(METRICS_KEY, {});
      all[month] = all[month] || {};
      all[month][SCOPE] = all[month][SCOPE] || { seekers: {}, sphere: {} };
      var seg = all[month][SCOPE][segment];
      seg[event] = (seg[event] || 0) + 1;
      store.set(METRICS_KEY, all);
      if (window.console) console.debug("[metrics stub]", SCOPE, SEGMENT_LABEL[segment], event);
      renderMetrics();
    },
    snapshot: function () {
      var all = store.get(METRICS_KEY, {}), out = { schemaVersion: "1.0.0", kind: "ca-service-metrics", months: {} };
      Object.keys(all).forEach(function (month) {
        out.months[month] = {};
        Object.keys(all[month]).forEach(function (scope) {
          var o = {}; o[SEGMENT_LABEL.seekers] = all[month][scope].seekers || {}; o[SEGMENT_LABEL.sphere] = all[month][scope].sphere || {};
          out.months[month][scope] = o;
        });
      });
      return out;
    }
  };
  window.caMetrics = metrics;
  function renderMetrics() { var o = $("#metrics-out"); if (o) o.textContent = JSON.stringify(metrics.snapshot().months, null, 2); }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-metric]");
    if (t) { var p = t.getAttribute("data-metric").split(":"); metrics.track(p[0], p[1]); }
  });
  if ($("#metrics-reset")) $("#metrics-reset").addEventListener("click", function () { store.set(METRICS_KEY, {}); renderMetrics(); });

  /* ---------- Two-section tabs + hub-and-spoke area routing (hash based; all visible without JS) ---------- */
  function route() {
    var id = decodeURIComponent(location.hash.slice(1)), target = id ? document.getElementById(id) : null;
    var inB = !!(target && $("#groups") && $("#groups").contains(target));
    if ($("#seekers") && $("#groups")) {
      $("#seekers").hidden = inB; $("#groups").hidden = !inB;
      if ($("#tab-a")) $("#tab-a").setAttribute("aria-current", String(!inB));
      if ($("#tab-b")) $("#tab-b").setAttribute("aria-current", String(inB));
    }
    $$(".area-panel").forEach(function (p) { p.classList.toggle("active", p === target); });
    if (target && /^area-/.test(id)) metrics.track("seekers", "area_view");
    if (target) target.scrollIntoView();
  }
  window.addEventListener("hashchange", route); route();
  if ($("#first-meeting-details")) $("#first-meeting-details").addEventListener("toggle", function () { if (this.open) metrics.track("seekers", "first_meeting_view"); });

  /* ---------- Happening Next (viewer's clock; meeting timezone may still be [VERIFY]) ---------- */
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function nextOccurrence(day, hhmm) {
    var di = DAYS.indexOf(day), m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
    if (di < 0 || !m) return null;
    var now = new Date(), d = new Date(now), add = (di - now.getDay() + 7) % 7;
    d.setHours(+m[1], +m[2], 0, 0); d.setDate(now.getDate() + add);
    if (d <= now) d.setDate(d.getDate() + 7);
    return d;
  }
  var upcoming = (DATA.meetings || []).map(function (mt) { return { m: mt, at: nextOccurrence(mt.day, mt.time24) }; })
    .filter(function (x) { return x.at; }).sort(function (a, b) { return a.at - b.at; });
  if (upcoming.length && $("#happening-next")) {
    var u = upcoming[0];
    $("#happening-next").textContent = "Happening Next: " + u.at.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ", " + u.m.timeLabel + " · " + u.m.label;
  }

  /* ---------- Download + calendar helpers ---------- */
  function download(name, mime, text) {
    var url = URL.createObjectURL(new Blob([text], { type: mime }));
    var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function icsEscape(s) { return String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }
  function ymd(s) { return s.replace(/-/g, ""); }
  function ics(events) {
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BoulderTree//CA Southwest//EN", "CALSCALE:GREGORIAN"];
    events.forEach(function (e, i) {
      lines.push("BEGIN:VEVENT", "UID:" + stamp + "-" + i + "@bouldertree.local", "DTSTAMP:" + stamp);
      e.forEach(function (l) { lines.push(l); });
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR"); return lines.join("\r\n") + "\r\n";
  }
  var meetingIcs = $("#ics-meeting");
  if (meetingIcs && DATA.meetings && DATA.meetings[0]) {
    meetingIcs.addEventListener("click", function (e) {
      e.preventDefault();
      var mt = DATA.meetings[0], at = nextOccurrence(mt.day, mt.time24); if (!at) return;
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      var dt = at.getFullYear() + p(at.getMonth() + 1) + p(at.getDate()) + "T" + p(at.getHours()) + p(at.getMinutes()) + "00";
      // Floating local time (no TZID) while the meeting timezone is [VERIFY].
      download((DATA.slug || "meeting") + ".ics", "text/calendar", ics([[
        "DTSTART:" + dt, "DURATION:PT" + (mt.durationMinutes || 60) + "M", "RRULE:FREQ=WEEKLY;BYDAY=" + mt.day.slice(0, 2).toUpperCase(),
        "SUMMARY:" + icsEscape(mt.label), "DESCRIPTION:" + icsEscape("Open to all. No dues or fees. Timezone, address, and Zoom link: see the group page.")
      ]]));
    });
  }

  /* ---------- Flyers: full-page lightbox, download, print-ready sheet ---------- */
  var lb = $("#lightbox"), stage = $("#lb-stage"), cur = 0;
  function flyerButtons() { return $$("#gallery button[data-src]"); }
  function openFlyer(i) {
    var btns = flyerButtons(); if (!btns.length || !lb) return;
    cur = (i + btns.length) % btns.length; var b = btns[cur], title = b.getAttribute("data-title"), src = b.getAttribute("data-src");
    $("#lb-title").textContent = title;
    stage.className = "lb-stage";
    stage.innerHTML = b.getAttribute("data-pdf") ? '<object type="application/pdf" data="' + esc(src) + '" aria-label="' + esc(title) + '"><p class="pdf-note">PDF preview unavailable. Use Download.</p></object>' : '<img alt="Flyer: ' + esc(title) + '" src="' + esc(src) + '">';
    var dl = $("#lb-download"); dl.href = src; dl.setAttribute("download", b.getAttribute("data-name") || "flyer");
    if (!lb.open) { if (lb.showModal) lb.showModal(); else lb.setAttribute("open", ""); }
    metrics.track("sphere", "flyer_lightbox_open");
  }
  if (lb && $("#gallery")) {
    $("#gallery").addEventListener("click", function (e) { var b = e.target.closest("button[data-src]"); if (b) openFlyer(flyerButtons().indexOf(b)); });
    $("#lb-close").addEventListener("click", function () { lb.close(); });
    $("#lb-prev").addEventListener("click", function () { openFlyer(cur - 1); });
    $("#lb-next").addEventListener("click", function () { openFlyer(cur + 1); });
    $("#lb-zoom").addEventListener("click", function () { var a = stage.classList.toggle("actual"); this.textContent = a ? "Fit to screen" : "Actual size"; });
    $("#lb-download").addEventListener("click", function () { metrics.track("sphere", "flyer_download"); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") openFlyer(cur + 1); if (e.key === "ArrowLeft") openFlyer(cur - 1); });
    $("#lb-print").addEventListener("click", function () {
      var b = flyerButtons()[cur];
      if (b.getAttribute("data-pdf")) { window.open(b.getAttribute("data-src"), "_blank", "noopener"); return; }
      $("#print-sheet").innerHTML = '<img alt="" src="' + esc(b.getAttribute("data-src")) + '"><p>' + esc(b.getAttribute("data-title")) + "</p>";
      document.body.classList.add("print-flyer"); metrics.track("sphere", "flyer_print");
      var img = $("#print-sheet img"), go = function () { window.print(); };
      if (img.complete) go(); else img.onload = go;
    });
    window.addEventListener("afterprint", function () { document.body.classList.remove("print-flyer"); });
  }

  /* ---------- Anonymity heuristics: shared scanner (templates/shared/anon-scan.js) ---------- */
  var scan = window.btAnonScan;
  var anonIssues = scan.anonIssues;
  window.btAnon = scan;

  /* ---------- Chair flyer upload: anonymity check BEFORE preview (Blueprint Automation #5) ---------- */
  if ($("#upload-form")) {
    var upFile = null, upScan = null;
    var showScan = function (r) {
      var box = $("#up-scan"), html = "";
      if (r.block.length) html += '<p class="msg err">Blocked until fixed:</p><ul>' + r.block.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      if (r.warn.length) html += '<p class="msg">Please double-check:</p><ul>' + r.warn.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      if (!r.block.length && !r.warn.length) html = '<p class="msg ok">No names, phone numbers, or emails found in the file name, details, or file metadata.</p>';
      box.innerHTML = html;
    };
    var typed = function () { return [$("#up-title").value, $("#up-area").value].join(" "); };
    var stripMetadata = function (dataUrl, cb) {
      // Re-encode raster images through a canvas: drops EXIF/XMP/IPTC (camera, author, GPS).
      var img = new Image();
      img.onload = function () {
        try { var c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); cb(c.toDataURL("image/png"), true); }
        catch (e) { cb(dataUrl, false); }
      };
      img.onerror = function () { cb(dataUrl, false); };
      img.src = dataUrl;
    };
    $("#up-file").addEventListener("change", function () {
      var f = this.files && this.files[0]; upFile = null; upScan = null; $("#up-preview").innerHTML = ""; $("#up-scan").innerHTML = ""; $("#up-msg").textContent = "";
      if (!f) return;
      if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$|^application\/pdf$/.test(f.type)) { $("#up-msg").className = "msg err"; $("#up-msg").textContent = "Please choose a PNG, JPG, GIF, WebP, SVG, or PDF."; return; }
      if (f.size > 15 * 1024 * 1024) { $("#up-msg").className = "msg err"; $("#up-msg").textContent = "File is over 15 MB."; return; }
      metrics.track("sphere", "flyer_upload_started");
      var rb = new FileReader();
      rb.onload = function () {
        var bytes = new Uint8Array(rb.result);
        upScan = scan.scanFlyer({ name: f.name, type: f.type, bytes: bytes, typedText: typed() });
        showScan(upScan);
        if (upScan.block.length) { metrics.track("sphere", "flyer_upload_blocked"); return; }   // no preview until fixed
        var rd = new FileReader();
        rd.onload = function () {
          var raster = /^image\/(png|jpeg|webp)$/.test(f.type);
          var done = function (src, stripped) {
            upFile = { src: src, pdf: f.type === "application/pdf", name: f.name.replace(/\.[a-z0-9]+$/i, "") + (stripped ? ".png" : f.name.match(/\.[a-z0-9]+$/i)[0]), stripped: stripped };
            $("#up-preview").innerHTML = upFile.pdf ? '<p class="hint">PDF ready: ' + esc(f.name) + "</p>" : '<img alt="Preview of your flyer" src="' + src + '" class="up-thumb">' + (stripped ? '<p class="hint">Photo metadata removed.</p>' : "");
          };
          if (raster) stripMetadata(rd.result, done); else done(rd.result, false);
        };
        rd.readAsDataURL(f);
      };
      rb.readAsArrayBuffer(f);
    });
    $("#upload-form").addEventListener("submit", function (e) {
      e.preventDefault(); var m = $("#up-msg"), title = $("#up-title").value.trim(), probs = [];
      var t = anonIssues(typed());
      if (t.length) probs.push("remove " + t.join(" and ") + " from the details");
      if (upScan && upScan.block.length) probs.push("fix the file issues listed above");
      if (!upFile && !(upScan && upScan.block.length)) probs.push("choose a file");
      if (!title) probs.push("add an event title");
      if (!$("#up-end").value) probs.push("add the event end date (used for automatic archiving)");
      if (!$("#up-anon").checked) probs.push("confirm the anonymity checklist");
      if (probs.length) { m.className = "msg err"; m.textContent = "Before submitting, please " + probs.join("; ") + "."; if (t.length) metrics.track("sphere", "flyer_upload_blocked"); return; }
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" data-title="' + esc(title + " (your preview)") + '" data-name="' + esc(upFile.name) + '" data-src="' + esc(upFile.src) + '" data-pdf="' + (upFile.pdf ? "1" : "") + '" aria-label="Open flyer full page: ' + esc(title) + '">' + (upFile.pdf ? '<span class="pdf-tile">PDF</span>' : '<img alt="" src="' + esc(upFile.src) + '">') + "<span>" + esc(title) + " (your preview)</span></button>";
      $("#gallery").appendChild(li); metrics.track("sphere", "flyer_upload_previewed");
      m.className = "msg ok"; m.textContent = "Preview added to the flyer gallery (this browser only). Category: " + $("#up-cat").value + ". It would be archived after " + $("#up-end").value + ". Nothing was uploaded. Endpoint [VERIFY].";
    });
  }

  /* ---------- Group Struggles & Website Ideas: triage router (Blueprint Webhook #7), local preview only ---------- */
  if ($("#struggles-form")) {
    $("#struggles-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var checked = $$('input[name="sf-topic[]"]:checked'), urg = document.querySelector('input[name="sf-urgency"]:checked');
      var payload = window.btTriage.triage({
        scope: SCOPE, groupOrArea: $("#sf-group").value.trim() || null,
        topics: checked.map(function (c) { return c.getAttribute("data-key"); }),
        details: $("#sf-support").value.trim(), urgency: urg ? urg.value : "routine", followUp: $("#sf-follow").value
      });
      var issues = anonIssues((payload.groupOrArea || "") + " " + payload.details), m = $("#sf-msg");
      if (!payload.topics.length && !payload.details) { m.className = "msg err"; m.textContent = "Pick at least one topic or write a note."; return; }
      if (issues.length) { m.className = "msg err"; m.textContent = "To protect anonymity, please remove " + issues.join(" and ") + "."; return; }
      payload.topics.forEach(function (k) { metrics.track("sphere", "struggles_" + k); });
      if (payload.urgency === "urgent") metrics.track("sphere", "struggles_urgent");
      metrics.track("sphere", "struggles_form_submitted");
      var R = window.btTriage.ROUTES;
      m.className = "msg ok"; m.textContent = "Preview only. This would be routed to " + payload.routing.all.map(function (r) { return R[r]; }).join(", ") + " (" + payload.urgency + "). Endpoint [VERIFY]. Payload:";
      var o = $("#sf-out"); o.hidden = false; o.textContent = JSON.stringify(payload, null, 2);
    });
  }

  /* ---------- Aug 2027 conference card: anonymous status + .ics ---------- */
  if ($("#conference")) {
    var CONF_KEY = "bt.conf2027.v1", conf = store.get(CONF_KEY, {});
    var confMsg = function () {
      var lbl = { booked: "You marked: booked a room.", planning: "You marked: planning to book.", "not-yet": "You marked: not yet." }[conf.status];
      $("#conf-msg").className = "msg ok"; $("#conf-msg").textContent = lbl ? lbl + " Saved on this device only, with no name attached." : "";
    };
    if (conf.status) { var r0 = document.querySelector('input[name="conf-status"][value="' + conf.status + '"]'); if (r0) r0.checked = true; }
    ["group", "in", "out"].forEach(function (k) { if (conf[k]) $("#conf-" + k).value = conf[k]; });
    confMsg();
    $$('input[name="conf-status"]').forEach(function (r) {
      r.addEventListener("change", function () { conf.status = r.value; store.set(CONF_KEY, conf); metrics.track("sphere", "conf_status_" + r.value); confMsg(); });
    });
    ["group", "in", "out"].forEach(function (k) {
      $("#conf-" + k).addEventListener("change", function () {
        var v = this.value.trim();
        if (k === "group" && anonIssues(v).length) { $("#conf-msg").className = "msg err"; $("#conf-msg").textContent = "Please use a group or area name only, no personal names or numbers."; return; }
        conf[k] = v; store.set(CONF_KEY, conf);
      });
    });
    if ($("#conf-book")) $("#conf-book").addEventListener("click", function (e) { e.preventDefault(); $("#conf-msg").className = "msg err"; $("#conf-msg").textContent = "The official booking link is not confirmed yet [VERIFY]."; });
    var rd = new Date(); rd.setDate(rd.getDate() + 7); $("#conf-remind").value = rd.toISOString().slice(0, 10);
    $("#conf-ics").addEventListener("click", function () {
      var rem = $("#conf-remind").value; if (!rem) { $("#conf-msg").className = "msg err"; $("#conf-msg").textContent = "Pick a reminder date."; return; }
      var evs = [["DTSTART;VALUE=DATE:" + ymd(rem), "SUMMARY:" + icsEscape("Reserve my August 2027 World Conference room (room block)"), "DESCRIPTION:" + icsEscape("Booking link, hotel, and $0-upfront terms: see the regional site."), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reserve conference room", "TRIGGER:PT9H", "END:VALARM"]];
      var ci = $("#conf-in").value, co = $("#conf-out").value;
      if (ci && co && co > ci) evs.push(["DTSTART;VALUE=DATE:" + ymd(ci), "DTEND;VALUE=DATE:" + ymd(co), "SUMMARY:" + icsEscape("August 2027 World Conference stay"), "DESCRIPTION:" + icsEscape("Official dates and hotel: see the regional site.")]);
      download("world-conference-2027-reminder.ics", "text/calendar", ics(evs)); metrics.track("sphere", "conf_calendar_add");
    });
  }

  if ($("#metrics-export")) $("#metrics-export").addEventListener("click", function () { download("ca-service-metrics.json", "application/json", JSON.stringify(metrics.snapshot(), null, 2)); });
  renderMetrics();
})();
