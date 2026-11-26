#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "schema", "group-config.schema.json");
const examplesDir = join(root, "examples");

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

let validate;
try {
  validate = ajv.compile(schema);
} catch (error) {
  console.error(`Failed to compile schema at ${schemaPath}`);
  console.error(error);
  process.exit(1);
}

const files = readdirSync(examplesDir)
  .filter((name) => name.endsWith(".json"))
  .sort();

if (files.length === 0) {
  console.error(`No example JSON files found in ${examplesDir}`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const path = join(examplesDir, file);
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${file} (invalid JSON)`);
    console.error(error);
    continue;
  }

  if (validate(data)) {
    console.log(`PASS ${file}`);
  } else {
    failed += 1;
    console.error(`FAIL ${file}`);
    for (const err of validate.errors ?? []) {
      const instance = err.instancePath || "/";
      const suffix = err.allowedValues
        ? ` (allowed: ${err.allowedValues.join(", ")})`
        : "";
      console.error(`  ${instance} ${err.message}${suffix}`);
    }
  }
}

if (failed > 0) {
  console.error(`Validation failed for ${failed} of ${files.length} example(s).`);
  process.exit(1);
}

console.log(`Validated ${files.length} example(s) against group-config.schema.json`);
