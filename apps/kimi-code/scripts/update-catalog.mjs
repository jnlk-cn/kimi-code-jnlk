#!/usr/bin/env node
/**
 * Fetches models.dev/api.json (or reads a local dump), strips fields not needed
 * by kimi-code, and writes the result as JSON.
 *
 * Two outputs:
 * - Release builds: `dist/built-in-catalog.json` (inlined via tsdown; not committed)
 * - Fork runtime catalog: repo-root `catalog/api.json` (committed; fetched by
 *   DEFAULT_CATALOG_URL from GitHub raw). The mirror is filtered by
 *   `catalog-allowlist.json` so only verified-compatible providers/models ship.
 *
 * Node's fetch ignores HTTP(S)_PROXY unless started with `--use-env-proxy`.
 * The `catalog:mirror` npm script passes that flag. Alternatively download with
 * curl and pass `--from <file>`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const scriptDir = import.meta.dirname;
const repoRoot = resolve(scriptDir, "../../..");
const allowlistPath = resolve(scriptDir, "catalog-allowlist.json");
const args = process.argv.slice(2);
const outFile = resolveOutputFile(args);
const fromFile = resolveFromFile(args);
const mirror = args.includes("--mirror");
const modelsUrl = process.env.MODELS_DEV_URL || "https://models.dev/api.json";

const KEEP_PROVIDER = new Set(["id", "name", "api", "env", "npm", "type", "models"]);
const KEEP_MODEL = new Set([
  "id",
  "name",
  "family",
  "limit",
  "tool_call",
  "reasoning",
  "reasoning_options",
  "interleaved",
  "modalities",
  // Message-level tool declarations capability — kosong's
  // catalogModelToCapability reads it; stripping it here would silently
  // disable tool-select for catalog-imported aliases.
  "dynamically_loaded_tools",
]);

function argValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function resolveOutputFile(argv) {
  if (argv.includes("--mirror")) {
    return resolve(repoRoot, "catalog/api.json");
  }
  const value = argValue(argv, "--out");
  if (value !== undefined) return resolve(process.cwd(), value);
  return resolve(scriptDir, "../dist/built-in-catalog.json");
}

function resolveFromFile(argv) {
  const value = argValue(argv, "--from");
  if (value === undefined) return undefined;
  return resolve(process.cwd(), value);
}

function stripModel(model) {
  if (typeof model !== "object" || model === null) return undefined;
  const result = {};
  for (const key of Object.keys(model)) {
    if (KEEP_MODEL.has(key)) result[key] = model[key];
  }
  return result;
}

function stripProvider(provider) {
  if (typeof provider !== "object" || provider === null) return undefined;
  const result = {};
  for (const key of Object.keys(provider)) {
    if (!KEEP_PROVIDER.has(key)) continue;
    const value = provider[key];
    if (key === "models") {
      const stripped = {};
      for (const [mId, m] of Object.entries(value)) {
        const s = stripModel(m);
        if (s !== undefined) stripped[mId] = s;
      }
      if (Object.keys(stripped).length > 0) result[key] = stripped;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function stripCatalog(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("invalid payload shape");
  }
  const stripped = {};
  for (const [k, v] of Object.entries(raw)) {
    const p = stripProvider(v);
    if (p !== undefined && Object.keys(p).length > 0) stripped[k] = p;
  }
  return stripped;
}

function loadAllowlist() {
  const raw = JSON.parse(readFileSync(allowlistPath, "utf-8"));
  if (typeof raw !== "object" || raw === null || typeof raw.providers !== "object") {
    throw new Error(`Invalid allowlist at ${allowlistPath}`);
  }
  return raw.providers;
}

/**
 * Keep only allowlisted providers/models. Optional `api` / `type` on an
 * allowlist entry override the upstream snapshot (so the official endpoint
 * wins even if models.dev points at a gateway).
 */
function applyAllowlist(catalog, providers) {
  const filtered = {};
  const missing = [];
  for (const [providerId, spec] of Object.entries(providers)) {
    const entry = catalog[providerId];
    if (entry === undefined) {
      missing.push(providerId);
      continue;
    }
    const modelIds = Array.isArray(spec.models) ? spec.models : [];
    if (modelIds.length === 0) {
      throw new Error(`Allowlist provider "${providerId}" lists no models`);
    }
    const models = {};
    const missingModels = [];
    for (const modelId of modelIds) {
      const model = entry.models?.[modelId];
      if (model === undefined) {
        missingModels.push(modelId);
        continue;
      }
      models[modelId] = model;
    }
    if (missingModels.length > 0) {
      throw new Error(
        `Allowlist provider "${providerId}" missing models in upstream: ${missingModels.join(", ")}`,
      );
    }
    const next = { ...entry, models };
    if (typeof spec.api === "string" && spec.api.length > 0) next.api = spec.api;
    if (typeof spec.type === "string" && spec.type.length > 0) next.type = spec.type;
    if (typeof next.id !== "string" || next.id.length === 0) next.id = providerId;
    filtered[providerId] = next;
  }
  if (missing.length > 0) {
    throw new Error(`Allowlist providers missing from upstream: ${missing.join(", ")}`);
  }
  return filtered;
}

async function loadCatalogObject() {
  if (fromFile !== undefined) {
    console.log(`Reading ${fromFile} ...`);
    return stripCatalog(JSON.parse(readFileSync(fromFile, "utf-8")));
  }
  console.log(`Fetching ${modelsUrl} ...`);
  const res = await fetch(modelsUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return stripCatalog(await res.json());
}

async function main() {
  let catalog = await loadCatalogObject();
  if (mirror) {
    const allowlist = loadAllowlist();
    catalog = applyAllowlist(catalog, allowlist);
    console.log(
      `Allowlist: ${Object.keys(catalog).join(", ") || "(empty)"} (${Object.values(catalog).reduce((n, p) => n + Object.keys(p.models ?? {}).length, 0)} models)`,
    );
  }
  const json = JSON.stringify(catalog);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, json, "utf-8");
  console.log(`Wrote ${outFile} (${(json.length / 1024).toFixed(1)} KB JSON)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
