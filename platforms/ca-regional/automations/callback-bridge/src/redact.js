// Log redaction: no caller number ever reaches a log line in full.
const E164 = /\+?[0-9][0-9().\s-]{7,}[0-9]/g;

export function maskNumber(n) {
  const d = String(n || "").replace(/\D/g, "");
  return d.length < 4 ? "[redacted]" : `[redacted …${d.slice(-2)}]`;
}

export function redact(value) {
  if (typeof value === "string") return value.replace(E164, (m) => maskNumber(m));
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "id" || k === "requestId") out[k] = v;
      else out[k] = /^(to|from)$|number|phone/i.test(k) && typeof v === "string" ? maskNumber(v) : redact(v);
    }
    return out;
  }
  return value;
}

export function redactingLogger(sink = () => {}) {
  return { log: (event, data = {}) => sink(event, redact(data)) };
}
