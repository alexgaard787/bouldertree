// Transient caller-number store. Numbers live only in memory here (the hosting
// platform's equivalent must be an expiring key-value store, [VERIFY]) and are
// deleted the moment the callback connects, or when the TTL runs out.
export class TransientStore {
  constructor({ clock, ttlMs }) {
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }
  put(id, number) {
    this.map.set(id, { number, expiresAt: this.clock.now() + this.ttlMs });
  }
  get(id) {
    const e = this.map.get(id);
    if (!e) return null;
    if (this.clock.now() >= e.expiresAt) { this.map.delete(id); return null; }
    return e.number;
  }
  purge(id) { return this.map.delete(id); }
  sweep() {
    let n = 0;
    for (const [id, e] of this.map) if (this.clock.now() >= e.expiresAt) { this.map.delete(id); n++; }
    return n;
  }
  get size() { return this.map.size; }
}
