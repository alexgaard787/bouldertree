/* Group Struggles & Website Ideas triage (Blueprint Webhook #7). UMD: window.btTriage in the browser,
 * require()-able in Node. Builds an identity-free payload that matches
 * platforms/ca-regional/data/schema/struggles-payload.schema.json. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.btTriage = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var ROUTES = {
    "internet-chair": "Regional Internet Chair",
    "unity-area-liaisons": "Regional Unity Chair & Area Liaisons",
    "hotline-hi-pi": "Hotline / H&I / Public Information committee chair",
    "council-service-log": "Regional Council Service Log"
  };
  // Topic keys come from the form ("CA Regional — Aug 2027 Conference Card & Group Feedback Form").
  // Routing follows the Webhooks Blueprint. [VERIFY] the attendance and other mappings with the council.
  var TOPIC_ROUTE = {
    attendance: ["unity-area-liaisons"],
    flyers: ["internet-chair"],
    directory: ["internet-chair", "hotline-hi-pi"],
    unity: ["unity-area-liaisons"],
    other: ["council-service-log"]
  };
  var FOLLOW_ROUTE = {
    "internet-chair": "internet-chair",
    "unity": "unity-area-liaisons",
    "hotline-hi-pi-pr": "hotline-hi-pi",
    "no-reply": "council-service-log"
  };
  var URGENCY = ["routine", "soon", "urgent"];
  function triage(input) {
    var topics = (input.topics || []).filter(function (t) { return TOPIC_ROUTE[t]; });
    var routes = [];
    var push = function (r) { if (routes.indexOf(r) < 0) routes.push(r); };
    var follow = FOLLOW_ROUTE[input.followUp] || "council-service-log";
    if (follow !== "council-service-log") push(follow);
    topics.forEach(function (t) { TOPIC_ROUTE[t].forEach(push); });
    if (!routes.length) push("council-service-log");
    var urgency = URGENCY.indexOf(input.urgency) >= 0 ? input.urgency : "routine";
    var payload = {
      schemaVersion: "1.0.0",
      kind: "group-struggles",
      scope: input.scope || "region",
      groupOrArea: input.groupOrArea ? String(input.groupOrArea).slice(0, 120) : null,
      topics: topics,
      details: String(input.details || "").slice(0, 2000),
      urgency: urgency,
      followUp: Object.prototype.hasOwnProperty.call(FOLLOW_ROUTE, input.followUp) ? input.followUp : "no-reply",
      routing: { primary: routes[0], all: routes, replyRequested: follow !== "council-service-log" },
      submittedMonth: input.month || new Date().toISOString().slice(0, 7)
    };
    return payload;
  }
  return { ROUTES: ROUTES, TOPIC_ROUTE: TOPIC_ROUTE, FOLLOW_ROUTE: FOLLOW_ROUTE, URGENCY: URGENCY, triage: triage };
});
