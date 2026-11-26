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

  /* ---------- Privacy-first segmented metrics (Seekers vs. C.A. Sphere) ---------- */
  var METRICS_KEY = "bt.metrics.v1", SCOPE = DATA.page === "group" ? "group:" + (DATA.slug || "") : "region";
  var metrics = {
    track: function (segment, event) {
      if (segment !== "seekers" && segment !== "sphere") return;
      var month = new Date().toISOString().slice(0, 7);   // monthly bucket only, no timestamps or identities
      var all = store.get(METRICS_KEY, {});
      all[month] = all[month] || {};
      all[month][SCOPE] = all[month][SCOPE] || { seekers: {}, sphere: {} };
      var seg = all[month][SCOPE][segment];
      seg[event] = (seg[event] || 0) + 1;
      store.set(METRICS_KEY, all);
      if (window.console) console.debug("[metrics stub]", SCOPE, segment, event);
      renderMetrics();
    }
  };
  window.caMetrics = metrics;
  function renderMetrics() { var o = $("#metrics-out"); if (o) o.textContent = JSON.stringify(store.get(METRICS_KEY, {}), null, 2); }
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

  /* ---------- Anonymity heuristics (mirror of validate-group-config.js) ---------- */
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
  window.btAnon = { anonIssues: anonIssues, namePairs: namePairs };

  /* ---------- Chair flyer upload preview (FileReader only) ---------- */
  if ($("#upload-form")) {
    var upFile = null;
    $("#up-file").addEventListener("change", function () {
      var f = this.files && this.files[0]; upFile = null; $("#up-preview").innerHTML = "";
      if (!f) return;
      if (!/^image\/|^application\/pdf$/.test(f.type)) { $("#up-msg").className = "msg err"; $("#up-msg").textContent = "Please choose an image or PDF."; return; }
      if (f.size > 15 * 1024 * 1024) { $("#up-msg").className = "msg err"; $("#up-msg").textContent = "File is over 15 MB."; return; }
      metrics.track("sphere", "flyer_upload_started");
      var r = new FileReader();
      r.onload = function () {
        upFile = { src: r.result, pdf: f.type === "application/pdf", name: f.name };
        $("#up-preview").innerHTML = upFile.pdf ? '<p class="hint">PDF ready: ' + esc(f.name) + "</p>" : '<img alt="Preview of your flyer" src="' + r.result + '" class="up-thumb">';
      };
      r.readAsDataURL(f);
    });
    $("#upload-form").addEventListener("submit", function (e) {
      e.preventDefault(); var m = $("#up-msg"), title = $("#up-title").value.trim(), probs = [];
      if (!upFile) probs.push("choose a file");
      if (!title) probs.push("add an event title");
      if (!$("#up-anon").checked) probs.push("confirm the anonymity checklist");
      var a = anonIssues(title); if (a.length) probs.push("remove " + a.join(" and ") + " from the title");
      if (probs.length) { m.className = "msg err"; m.textContent = "Before submitting, please " + probs.join("; ") + "."; return; }
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" data-title="' + esc(title + " (your preview)") + '" data-name="' + esc(upFile.name) + '" data-src="' + esc(upFile.src) + '" data-pdf="' + (upFile.pdf ? "1" : "") + '" aria-label="Open flyer full page: ' + esc(title) + '">' + (upFile.pdf ? '<span class="pdf-tile">PDF</span>' : '<img alt="" src="' + esc(upFile.src) + '">') + "<span>" + esc(title) + " (your preview)</span></button>";
      $("#gallery").appendChild(li); metrics.track("sphere", "flyer_upload_previewed");
      m.className = "msg ok"; m.textContent = "Preview added to the flyer gallery (this browser only). Nothing was uploaded. Endpoint [VERIFY].";
    });
  }

  /* ---------- Group Struggles & Website Ideas (local preview only) ---------- */
  if ($("#struggles-form")) {
    $("#struggles-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var checked = $$('input[name="sf-topic[]"]:checked');
      var payload = { scope: SCOPE, groupOrArea: $("#sf-group").value.trim() || null, workingThrough: checked.map(function (c) { return c.value; }), howWeCanHelp: $("#sf-support").value.trim(), followUp: $("#sf-follow").value };
      var issues = anonIssues((payload.groupOrArea || "") + " " + payload.howWeCanHelp), m = $("#sf-msg");
      if (!checked.length && !payload.howWeCanHelp) { m.className = "msg err"; m.textContent = "Pick at least one topic or write a note."; return; }
      if (issues.length) { m.className = "msg err"; m.textContent = "To protect anonymity, please remove " + issues.join(" and ") + "."; return; }
      checked.forEach(function (c) { metrics.track("sphere", "struggles_" + c.getAttribute("data-key")); });
      metrics.track("sphere", "struggles_form_submitted");
      m.className = "msg ok"; m.textContent = "Preview only. This is what would be sent once the endpoint is set up [VERIFY]:";
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

  renderMetrics();
})();
