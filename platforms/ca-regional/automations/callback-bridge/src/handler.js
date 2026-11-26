// SPEC STUB (Blueprint Webhook #1 + #2). No live telephony: every side effect
// goes through injected adapters (telephony, sms, scheduler, clock). Real
// adapters, numbers, and providers are [VERIFY] and are NOT in this repo.
//
// Timeline (from POST receipt):
//   T+0-2s   acknowledge (202) and hold the number transiently
//   T+5s     SMS to caller: "A volunteer will call you shortly"
//   T+15-30s voice bridge starts the 3-tier ladder
//   ladder   tier 1 0-45s -> tier 2 45-90s (+ masked SMS to volunteer) -> tier 3 90s+ (+ SMS with Happening Next + First Meeting guide)
//   connect  caller number purged immediately; otherwise purged at TTL
import { TransientStore } from "./transient-store.js";
import { validateRequest } from "./validate-request.js";
import { redactingLogger } from "./redact.js";
import { assertLiveReady } from "./config.js";

export function createCallbackBridge({ config, telephony, sms, scheduler, clock, newId, logger = redactingLogger(), areaName = (s) => s, happeningNext = () => null }) {
  if (config.live === true) assertLiveReady(config);
  const t = config.timing;
  const store = new TransientStore({ clock, ttlMs: config.transientTtlMs });
  const state = new Map(); // id -> { tier, connected, req (no number) }

  function tierAt(elapsed) {
    return config.tiers.find((x) => elapsed >= x.fromMs && (x.toMs === null || elapsed < x.toMs));
  }

  function dial(id, tier) {
    const s = state.get(id);
    if (!s || s.connected) return;
    const number = store.get(id);
    if (!number) { logger.log("ladder.expired", { id, tier: tier.tier }); return; }
    s.tier = tier.tier;
    telephony.bridge({ requestId: id, tier: tier.tier, target: tier.target, callerNumber: number });
    logger.log("ladder.dial", { id, tier: tier.tier });
    if (tier.tier === 2) {
      // Masked: first name/alias + city only. Never the caller's number.
      sms.send({ to: tier.target, body: `Callback request from ${s.req.alias || "someone"} in ${areaName(s.req.areaSlug)}. Answer through the bridge; their number is hidden.` });
    }
    if (tier.tier === 3) {
      const next = happeningNext(s.req.areaSlug);
      sms.send({ to: number, body: `We're still trying to reach a volunteer.${next ? ` Next meeting: ${next}.` : ""} First meeting guide: ${config.firstMeetingGuideUrl}` });
    }
  }

  async function handle(body) {
    const started = clock.now();
    const errors = validateRequest(body);
    if (errors.length) return { status: 400, body: { errors } };
    const id = newId();
    store.put(id, body.callbackNumber);
    state.set(id, { tier: 0, connected: false, req: { pathType: body.pathType, alias: body.alias, areaSlug: body.areaSlug } });
    logger.log("request.accepted", { id, pathType: body.pathType, areaSlug: body.areaSlug, callbackNumber: body.callbackNumber });

    scheduler.schedule(t.smsAtMs, () => {
      const n = store.get(id);
      if (n && !state.get(id).connected) sms.send({ to: n, body: "C.A. here. A volunteer will call you back shortly. Reply STOP to cancel." });
    });
    for (const tier of config.tiers) {
      scheduler.schedule(t.voiceBridgeAtMs + tier.fromMs, () => dial(id, tierAt(tier.fromMs)));
    }
    scheduler.schedule(config.transientTtlMs, () => { if (store.purge(id)) logger.log("purge.ttl", { id }); state.delete(id); });
    return { status: 202, body: { requestId: id, ackMs: clock.now() - started } };
  }

  function onCallConnected(id) {
    const s = state.get(id);
    if (!s) return false;
    s.connected = true;
    store.purge(id);
    logger.log("purge.connected", { id, tier: s.tier });
    return true;
  }

  function onCancel(id) {   // caller replied STOP
    store.purge(id);
    state.delete(id);
    logger.log("purge.cancelled", { id });
  }

  return { handle, onCallConnected, onCancel, store, sweep: () => store.sweep(), _state: state };
}
