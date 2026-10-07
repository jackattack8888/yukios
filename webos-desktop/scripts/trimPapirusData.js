import { existsSync, readFileSync, writeFileSync, readdirSync, lstatSync } from "fs";
import { join, resolve } from "path";

const MANUAL_EXTRA_ICON_KEYS = [];
const PAPIRUS_SIZES = [16, 22, 24, 32, 48, 64];
const SIZE_FALLBACK_ORDER = [48, 32, 22, 24, 16, 64, 128, 96, 42, 84, 18, 8];
const REF_PATTERN = /papirus:([A-Za-z0-9/_.\-]+)/g;
const SCAN_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".html"]);

function findSrcDir() {
  const candidates = [resolve(process.cwd(), "src"), resolve(process.cwd(), "webos-desktop/src")];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error("[papirus-trim] src directory not found");
    process.exit(1);
  }
  return found;
}

function collectRefs(dir, into) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "dist" || name === "generated") continue;
    const full = join(dir, name);
    let st = null;
    try {
      st = lstatSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectRefs(full, into);
    } else if (st.isFile()) {
      const dot = name.lastIndexOf(".");
      if (dot < 0 || !SCAN_EXTENSIONS.has(name.slice(dot))) continue;
      let text = "";
      try {
        text = readFileSync(full, "utf-8");
      } catch {
        continue;
      }
      for (const match of text.matchAll(REF_PATTERN)) into.add(match[1]);
    }
  }
  return into;
}

function splitKey(raw) {
  const clean = raw.endsWith(".svg") || raw.endsWith(".SVG") ? raw.slice(0, -4) : raw;
  if (clean.includes("/")) {
    const parts = clean.split("/");
    const iconName = parts.pop();
    return { ctx: parts.join("/") || "apps", iconName };
  }
  return { ctx: "apps", iconName: clean };
}

function followChain(key, symlinks) {
  const chain = [key];
  const seen = new Set([key]);
  let current = key;
  for (let hops = 0; hops < 10; hops++) {
    const next = symlinks[current];
    if (!next || seen.has(next)) break;
    seen.add(next);
    chain.push(next);
    current = next;
  }
  return chain;
}

function pickBucket(requested, sizes) {
  if (!sizes || sizes.length === 0) return requested;
  const req = `${requested}x${requested}`;
  if (sizes.includes(req)) return requested;
  for (const s of SIZE_FALLBACK_ORDER) {
    if (sizes.includes(`${s}x${s}`)) return s;
  }
  return parseInt(sizes[0].split("x")[0], 10);
}

function sizeFor(px) {
  const n = Number(px);
  if (!Number.isFinite(n)) return 48;
  let best = PAPIRUS_SIZES[0];
  let bestDiff = Math.abs(n - best);
  for (let i = 1; i < PAPIRUS_SIZES.length; i++) {
    const diff = Math.abs(n - PAPIRUS_SIZES[i]);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = PAPIRUS_SIZES[i];
    }
  }
  return best;
}

function resolveBucket(raw, px, available, symlinks) {
  const { ctx, iconName } = splitKey(raw);
  const chain = followChain(`${ctx}/${iconName}`, symlinks);
  const key = chain[chain.length - 1];
  const entry = available[key] || available[key.toLowerCase()];
  return pickBucket(sizeFor(px), entry);
}

function main() {
  const srcDir = findSrcDir();
  const generatedDir = join(srcDir, "generated");
  const availPath = join(generatedDir, "papirus-available.json");
  const symPath = join(generatedDir, "papirus-symlinks.json");
  if (!existsSync(availPath) || !existsSync(symPath)) {
    console.error("[papirus-trim] generated data missing, run generatePapirusData.js first");
    process.exit(1);
  }
  const available = JSON.parse(readFileSync(availPath, "utf-8"));
  const symlinks = JSON.parse(readFileSync(symPath, "utf-8"));

  const refs = collectRefs(srcDir, new Set());
  const wanted = new Set(MANUAL_EXTRA_ICON_KEYS);
  for (const raw of refs) {
    const { ctx, iconName } = splitKey(raw);
    const key = `${ctx}/${iconName}`;
    wanted.add(key);
    wanted.add(key.toLowerCase());
    for (const chainKey of followChain(key, symlinks)) {
      wanted.add(chainKey);
      wanted.add(chainKey.toLowerCase());
    }
  }

  const trimmedAvailable = {};
  for (const key of Object.keys(available)) {
    if (wanted.has(key)) trimmedAvailable[key] = available[key];
  }
  const trimmedSymlinks = {};
  for (const key of Object.keys(symlinks)) {
    if (wanted.has(key)) trimmedSymlinks[key] = symlinks[key];
  }

  const checkedRefs = [...refs];
  for (const raw of checkedRefs) {
    for (const px of PAPIRUS_SIZES) {
      const before = resolveBucket(raw, px, available, symlinks);
      const after = resolveBucket(raw, px, trimmedAvailable, trimmedSymlinks);
      if (before !== after) {
        console.error(`[papirus-trim] MISMATCH for ${raw} at ${px}px: ${before} vs ${after}`);
        process.exit(1);
      }
    }
  }

  const availText = JSON.stringify(trimmedAvailable);
  const symText = JSON.stringify(trimmedSymlinks);
  let currentAvail = "";
  let currentSym = "";
  try {
    currentAvail = readFileSync(availPath, "utf-8");
    currentSym = readFileSync(symPath, "utf-8");
  } catch {}
  if (currentAvail !== availText) writeFileSync(availPath, availText, "utf-8");
  if (currentSym !== symText) writeFileSync(symPath, symText, "utf-8");
  console.log(
    `[papirus-trim] refs=${checkedRefs.length} kept=${Object.keys(trimmedAvailable).length}/${Object.keys(available).length} available, ${Object.keys(trimmedSymlinks).length}/${Object.keys(symlinks).length} symlinks`
  );
}

main();
