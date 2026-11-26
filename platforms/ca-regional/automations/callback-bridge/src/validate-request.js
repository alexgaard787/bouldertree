// Dependency-free check that mirrors callback-request.schema.json.
const PATHS = ["seeking-recovery", "family-friend", "professional-referral", "member-service"];
const ALLOWED = new Set(["pathType", "alias", "areaSlug", "callbackNumber", "consent"]);

export function validateRequest(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) return ["body must be an object"];
  for (const k of Object.keys(body)) if (!ALLOWED.has(k)) errors.push(`field not allowed: ${k}`);
  if (!PATHS.includes(body.pathType)) errors.push("pathType invalid");
  if (body.alias !== undefined && !(typeof body.alias === "string" && /^[A-Za-z][A-Za-z'.-]*$/.test(body.alias) && body.alias.length <= 30)) errors.push("alias must be one word (first name or alias only)");
  if (!(typeof body.areaSlug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.areaSlug))) errors.push("areaSlug invalid");
  if (!(typeof body.callbackNumber === "string" && /^\+[1-9][0-9]{7,14}$/.test(body.callbackNumber))) errors.push("callbackNumber must be E.164");
  if (body.consent !== true) errors.push("consent required");
  return errors;
}
