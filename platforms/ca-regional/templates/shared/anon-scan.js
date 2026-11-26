/* BoulderTree anonymity scanner (Traditions Eleven & Twelve). UMD: inlined in the browser as
 * window.btAnonScan, and require()-able in Node for tests. No network, no dependencies.
 *   anonIssues(text)                 -> ["a phone number", ...]
 *   scanFlyer({ name, type, bytes, typedText }) -> { block: [...], warn: [...], metadata: {...} }
 * File scanning is heuristic: it reads filename, typed text, PDF Info / XMP metadata, JPEG EXIF/APP strings,
 * PNG tEXt/iTXt chunks, and SVG text. It cannot read text inside images or compressed PDF page streams,
 * so the chair's anonymity checkbox stays required. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.btAnonScan = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var PHONE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  var NON_NAME = ("a an and the of for at in on to with by or Anonymous Cocaine Fellowship Group Groups Club Line Bottom Meeting Meetings Region Regional Area Areas Southwest Central Texas Austin Houston Dallas Fort Worth San Antonio Marcos El Paso Lockhart Buda Kyle TX World Conference Council Service Services Unity Tradition Traditions Seventh Six Seven Ten Eleven Twelve Step Steps Hall Church Center Room Zoom Hybrid In-Person Online Open Closed Format Newcomer Newcomers First What Expect Happening Next Need Help Now Hotline Website Ideas Struggles Feedback Flyers Flyer News Updates August Monday Tuesday Wednesday Thursday Friday Saturday Sunday Weekly Recovery Aftercare Family Families Loved Ones Book Study Speaker Discussion Home Upholds Supported Every Displays Connects Highlights Public Information Committee Literature Business Reserve Block Calendar Day Workshop Workshops Campout Campouts Call Text Email Contact Ask Please Thanks Hi Hello Microsoft Word Adobe Acrobat Photoshop Illustrator Canva Google Docs Apple Preview Quartz PDFContext Distiller Print Save Image Untitled Document Final Draft Copy New Year Spring Summer Fall Winter Annual Regional Picnic Potluck Dance Retreat Speakers Panel Night").split(/\s+/);
  function namePairs(t) {
    var re = /\b([A-Z][a-z]{1,}(?:-[A-Z][a-z]+)?)\s+([A-Z][a-z]{1,}(?:-[A-Z][a-z]+)?)\b/g, m, out = [];
    t = String(t || "");
    while ((m = re.exec(t))) { if (NON_NAME.indexOf(m[1]) < 0 && NON_NAME.indexOf(m[2]) < 0) out.push(m[0]); re.lastIndex = m.index + m[1].length + 1; }
    return out;
  }
  function anonIssues(t) {
    var i = []; t = String(t || "");
    if (PHONE.test(t)) i.push("a phone number");
    if (EMAIL.test(t)) i.push("an email address");
    var n = namePairs(t); if (n.length) i.push("what looks like a full name (" + n.join(", ") + ")");
    return i;
  }
  function latin1(bytes, start, end) {
    var s = "", e = Math.min(end, bytes.length);
    for (var i = start; i < e; i += 8192) s += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes, i, Math.min(i + 8192, e)));
    return s;
  }
  function decodePdfString(s) {
    if (/^\xFE\xFF/.test(s)) { var o = ""; for (var i = 2; i + 1 < s.length; i += 2) o += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1)); return o; }
    return s.replace(/\\([nrtbf()\\])/g, "$1");
  }
  // Extract human-readable metadata strings from common flyer formats.
  function extractMetadata(bytes, type, name) {
    var md = {};
    var head = latin1(bytes, 0, 2 * 1024 * 1024), tail = bytes.length > 2 * 1024 * 1024 ? latin1(bytes, bytes.length - 256 * 1024, bytes.length) : "";
    var text = head + tail, m;
    var isPdf = /pdf$/i.test(type) || /^%PDF/.test(head);
    if (isPdf) {
      ["Author", "Creator", "Producer", "Title", "Subject", "Keywords"].forEach(function (k) {
        var re = new RegExp("/" + k + "\\s*\\(((?:\\\\.|[^\\\\)])*)\\)", "g"), vals = [];
        while ((m = re.exec(text))) vals.push(decodePdfString(m[1]));
        if (vals.length) md["pdf:" + k] = vals.join(" | ");
      });
    }
    // XMP packets (PDF, JPEG, PNG, SVG)
    var xmp = /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/.exec(text);
    if (xmp) {
      [["dc:creator", "xmp:creator"], ["dc:rights", "xmp:rights"], ["photoshop:AuthorsPosition", "xmp:authorsPosition"], ["Iptc4xmpCore:CiEmailWork", "xmp:email"], ["Iptc4xmpCore:CiTelWork", "xmp:phone"]].forEach(function (p) {
        var re = new RegExp("<" + p[0] + "[^>]*>([\\s\\S]*?)</" + p[0] + ">"), r = re.exec(xmp[0]);
        if (r) md[p[1]] = r[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      });
      var attr = /(?:dc:creator|pdf:Author|xmp:Author)="([^"]+)"/.exec(xmp[0]); if (attr) md["xmp:author"] = attr[1];
    }
    // JPEG EXIF / APP segments: collect printable strings (Artist, Copyright, XPAuthor ASCII parts)
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      var strings = [], i = 2;
      while (i + 4 < bytes.length && bytes[i] === 0xff) {
        var marker = bytes[i + 1], len = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker === 0xda) break;
        if (marker >= 0xe1 && marker <= 0xef) {
          var seg = latin1(bytes, i + 4, i + 2 + len), sm, sre = /[\x20-\x7e]{5,}/g;
          while ((sm = sre.exec(seg))) if (!/^(Exif|http|MM\x00|II\*|Adobe|ICC_PROFILE|xmp)/.test(sm[0])) strings.push(sm[0].trim());
        }
        i += 2 + len;
      }
      if (strings.length) md["jpeg:strings"] = strings.slice(0, 40).join(" | ");
    }
    // PNG tEXt / iTXt chunks
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      var p = 8, chunks = [];
      while (p + 8 < bytes.length) {
        var clen = (bytes[p] << 24 >>> 0) + (bytes[p + 1] << 16) + (bytes[p + 2] << 8) + bytes[p + 3];
        var ctype = latin1(bytes, p + 4, p + 8);
        if (ctype === "tEXt" || ctype === "iTXt") chunks.push(latin1(bytes, p + 8, p + 8 + clen).replace(/\x00+/g, ": "));
        if (ctype === "IEND") break;
        p += 12 + clen;
      }
      if (chunks.length) md["png:text"] = chunks.join(" | ");
    }
    // SVG: all text content is visible on the flyer
    if (/svg/i.test(type) || /\.svg$/i.test(name || "")) md["svg:text"] = head.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
    return md;
  }
  function scanFlyer(input) {
    var block = [], warn = [];
    var fname = String(input.name || "").replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " ");
    var f = anonIssues(fname);
    if (f.length) (f.some(function (x) { return /phone|email/.test(x); }) ? block : warn).push("File name has " + f.join(" and ") + ". Rename the file before submitting.");
    var t = anonIssues(input.typedText);
    if (t.length) block.push("Typed details include " + t.join(" and ") + ".");
    var md = input.bytes ? extractMetadata(input.bytes, input.type || "", input.name) : {};
    Object.keys(md).forEach(function (k) {
      var issues = anonIssues(md[k]);
      if (!issues.length) return;
      var hard = issues.some(function (x) { return /phone|email/.test(x); }) || /svg:text/.test(k);
      (hard ? block : warn).push("File metadata (" + k + ") contains " + issues.join(" and ") + ".");
    });
    return { block: block, warn: warn, metadata: md };
  }
  return { anonIssues: anonIssues, namePairs: namePairs, extractMetadata: extractMetadata, scanFlyer: scanFlyer };
});
