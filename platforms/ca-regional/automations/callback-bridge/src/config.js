// Guards: the stub refuses to go live while any value is still [VERIFY].
export function findVerify(obj, path = "$", out = []) {
  if (typeof obj === "string") { if (obj.includes("[VERIFY]")) out.push(path); }
  else if (Array.isArray(obj)) obj.forEach((v, i) => findVerify(v, `${path}[${i}]`, out));
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (k !== "$comment") findVerify(v, `${path}.${k}`, out);
  return out;
}

export function assertLiveReady(config) {
  const open = findVerify(config);
  if (open.length) throw new Error(`Callback bridge is not live-ready; unresolved [VERIFY] at: ${open.join(", ")}`);
  if (!Array.isArray(config.tiers) || config.tiers.length !== 3) throw new Error("Exactly 3 fallback tiers are required.");
  return true;
}
