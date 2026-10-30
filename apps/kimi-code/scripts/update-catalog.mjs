#!/usr/bin/env node
/**
 * Fetches models.dev/api.json (or reads a local dump), filters it through this
 * fork's verified-provider allowlist, strips fields kimi-code does not read,
 * and writes the result as JSON.
 *
 * Outputs:
 * - Release / native builds: `dist/built-in-catalog.json` (inlined via tsdown)
 * - Fork mirror: `catalog/api.json` with `--mirror`, committed so older builds
 *   and external docs can download exactly what this fork ships
 *
 * Node's fetch ignores HTTP(S)_PROXY unless started with `--use-env-proxy`;
 * the `catalog:mirror` script passes that flag. Alternatively download the
 * payload with curl and pass `--from <file>`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const scriptDir = import.meta.dirname;
const repoRoot = resolve(scriptDir, "../../..");
const allowlistPath = resolve(scriptDir, "catalog-allowlist.json");
const args = process.argv.slice(2);
const modelsUrl = process.env.MODELS_DEV_URL || "https://models.dev/api.json";

const KEEP_PROVIDER = new Set(["id", "name", "api", "env", "npm", "type", "models"]);
const KEEP_MODEL = new Set([
  "id",
  "name",
  "family",
  "limit",
  "tool_call",
  "reasoning",
  "interleaved",
  "modalities",
  // Message-level tool declarations capability — kosong's
  // catalogModelToCapability reads it; stripping it here would silently
  // disable tool-select for catalog-imported aliases.
  "dynamically_loaded_tools",
  // Thinking effort levels. Without them the built-in catalog cannot offer
  // per-model effort choices (DeepSeek V4 needs them for `high`/`max`).
  "reasoning_options",
]);

function argValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function resolveOutputFile() {
  if (args.includes("--mirror")) return resolve(repoRoot, "catalog/api.json");
  const value = argValue("--out");
  if (value !== undefined) return resolve(process.cwd(), value);
  return resolve(scriptDir, "../dist/built-in-catalog.json");
}

function resolveFromFile() {
  const value = argValue("--from");
  return value === undefined ? undefined : resolve(process.cwd(), value);
}

function readAllowlist() {
  if (args.includes("--all")) return undefined;
  const payload = JSON.parse(readFileSync(allowlistPath, "utf-8"));
  if (typeof payload !== "object" || payload === null || typeof payload.providers !== "object") {
    throw new Error(`Invalid allowlist at ${allowlistPath}`);
  }
  return payload.providers;
}

function stripModel(model) {
  if (typeof model !== "object" || model === null) return undefined;
  const result = {};
  for (const key of Object.keys(model)) {
    if (KEEP_MODEL.has(key)) result[key] = model[key];
  }
  return result;
}

function stripProvider(provider, allowedModels) {
  if (typeof provider !== "object" || provider === null) return undefined;
  const result = {};
  for (const key of Object.keys(provider)) {
    if (!KEEP_PROVIDER.has(key)) continue;
    const value = provider[key];
    if (key === "models") {
      const stripped = {};
      for (const [mId, m] of Object.entries(value)) {
        if (allowedModels !== undefined && !allowedModels.has(mId)) continue;
        const s = stripModel(m);
        if (s !== undefined) stripped[mId] = s;
      }
      if (Object.keys(stripped).length > 0) result[key] = stripped;
    } else {
      result[key] = value;
    }
  }
  if (result.models === undefined) return undefined;
  return result;
}

function filtered(catalog, allowlist) {
  const out = {};
  for (const [id, provider] of Object.entries(catalog)) {
    const allowed = allowlist === undefined ? undefined : allowlist[id];
    if (allowlist !== undefined && allowed === undefined) continue;
    const allowedModels =
      allowed === undefined || !Array.isArray(allowed.models)
        ? undefined
        : new Set(allowed.models);
    const merged = allowed === undefined ? provider : { ...provider };
    if (allowed !== undefined) {
      if (typeof allowed.api === "string") merged.api = allowed.api;
      if (typeof allowed.type === "string") merged.type = allowed.type;
      if (typeof allowed.npm === "string") merged.npm = allowed.npm;
      if (typeof allowed.env === "string") merged.env = allowed.env;
    }
    const stripped = stripProvider(merged, allowedModels);
    if (stripped !== undefined) out[id] = stripped;
  }
  return out;
}

function loadCatalog() {
  const fromFile = resolveFromFile();
  if (fromFile === undefined) {
    return fetch(modelsUrl, { headers: { Accept: "application/json" } }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }
  return Promise.resolve(JSON.parse(readFileSync(fromFile, "utf-8")));
}

async function main() {
  const outFile = resolveOutputFile();
  const allowlist = readAllowlist();
  const raw = await loadCatalog();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("invalid payload shape");
  }
  const catalog = filtered(raw, allowlist);
  const providers = Object.keys(catalog);
  if (providers.length === 0) {
    throw new Error("allowlist produced an empty catalog");
  }
  const json = JSON.stringify(catalog);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, json, "utf-8");
  console.log(
    `Wrote ${outFile} (${providers.length} providers: ${providers.join(", ")}; ${(json.length / 1024).toFixed(0)} KB)`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
