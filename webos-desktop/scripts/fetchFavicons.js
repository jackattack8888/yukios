import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { decodeIco, isIcoBuffer } from "./lib/icoDecoder.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const manifestPath = join(currentDir, "../src/registry/AppManifest.js");
const primaryOut = resolve(currentDir, "../../static/icons/favicons");
const cachePath = join(currentDir, "faviconCache.json");
const FETCH_ENABLED = false;
const force = process.argv.includes("--force");
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_HTML = 15000;
const TIMEOUT_HEAD = 8000;
const TIMEOUT_IMAGE = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const requireFn = createRequire(import.meta.url);

let sharp = null;
try {
  sharp = requireFn("sharp");
} catch {}

function serviceKeyToSlug(key) {
  return key
    .replace(/App$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function ensureDirs() {
  mkdirSync(primaryOut, { recursive: true });
  const gitkeepPrimary = join(primaryOut, ".gitkeep");
  if (!existsSync(gitkeepPrimary)) writeFileSync(gitkeepPrimary, "");
}

function loadWebApps() {
  const text = readFileSync(manifestPath, "utf-8");
  const serviceEntries = [...text.matchAll(/serviceKey:\s*"([^"]+)"/g)].map((m) => ({ key: m[1], index: m.index }));
  const targetEntries = [...text.matchAll(/targetUrl:\s*"([^"]+)"/g)].map((m) => ({ url: m[1], index: m.index }));
  const apps = [];
  for (let i = 0; i < serviceEntries.length; i++) {
    const svc = serviceEntries[i];
    const nextSvcIndex = i + 1 < serviceEntries.length ? serviceEntries[i + 1].index : Infinity;
    let best = null;
    for (const t of targetEntries) {
      if (t.index > svc.index && t.index < nextSvcIndex) {
        best = t;
        break;
      }
    }
    if (best) apps.push({ serviceKey: svc.key, targetUrl: best.url });
  }
  return apps;
}

function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_HTML) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const opts = { ...options, signal: controller.signal, redirect: "follow" };
  return fetch(url, opts).finally(() => clearTimeout(timer));
}

function decodeDataUri(uri) {
  if (!uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  if (comma === -1) return null;
  const meta = uri.slice(5, comma);
  const data = uri.slice(comma + 1);
  const isBase64 = meta.includes(";base64");
  if (isBase64) {
    try {
      const b64 = data.replace(/\s/g, "");
      if (!b64 || b64 === "=") return null;
      return Buffer.from(b64, "base64");
    } catch {
      return null;
    }
  }
  try {
    const decoded = decodeURIComponent(data);
    if (!decoded) return null;
    return Buffer.from(decoded, "utf-8");
  } catch {
    try {
      return Buffer.from(data, "utf-8");
    } catch {
      return null;
    }
  }
}

function parseFaviconLinks(html, baseUrl) {
  const results = [];
  const linkTagRegex = /<link[^>]*>/gi;
  let m;
  while ((m = linkTagRegex.exec(html)) !== null) {
    const tag = m[0];
    const relMatch = tag.match(/rel\s*=\s*["']([^"']*)["']/i);
    if (!relMatch) continue;
    const rel = relMatch[1].toLowerCase();
    const isIcon = rel.includes("icon");
    const isManifest = rel.includes("manifest");
    if (!isIcon && !isManifest) continue;
    if (isManifest) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    let href = hrefMatch[1].trim();
    if (!href) continue;
    if (href.startsWith("data:;")) {
      if (href === "data:;base64,=" || href.length < 20) continue;
    }
    const sizesMatch = tag.match(/sizes\s*=\s*["']([^"']+)["']/i);
    const sizes = sizesMatch ? sizesMatch[1] : "";
    let absolute;
    if (href.startsWith("data:")) {
      absolute = href;
    } else {
      try {
        absolute = new URL(href, baseUrl).href;
      } catch {
        continue;
      }
    }
    let sizeValue = 0;
    if (sizes) {
      const parts = sizes.split(/\s+/);
      for (const part of parts) {
        const dim = part.split("x");
        const w = parseInt(dim[0], 10);
        if (!Number.isNaN(w) && w > sizeValue) sizeValue = w;
      }
    }
    if (rel.includes("apple-touch-icon") && sizeValue === 0) sizeValue = 180;
    if (rel.includes("apple-touch-icon-precomposed") && sizeValue === 0) sizeValue = 180;
    results.push({ href: absolute, sizes, rel, sizeValue });
  }
  results.sort((a, b) => {
    if (b.sizeValue !== a.sizeValue) return b.sizeValue - a.sizeValue;
    const aApple = a.rel.includes("apple-touch-icon") ? 1 : 0;
    const bApple = b.rel.includes("apple-touch-icon") ? 1 : 0;
    if (bApple !== aApple) return bApple - aApple;
    return 0;
  });
  return results;
}

async function fetchManifestIcons(html, baseUrl) {
  const icons = [];
  const manifestLinkRegex = /<link[^>]*>/gi;
  let mm;
  let manifestHref = null;
  while ((mm = manifestLinkRegex.exec(html)) !== null) {
    const tag = mm[0];
    const relMatch = tag.match(/rel\s*=\s*["']([^"']*)["']/i);
    if (!relMatch) continue;
    if (!relMatch[1].toLowerCase().includes("manifest")) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) {
      manifestHref = hrefMatch[1];
      break;
    }
  }
  if (!manifestHref) return icons;
  let manifestUrl;
  try {
    manifestUrl = new URL(manifestHref, baseUrl).href;
  } catch {
    return icons;
  }
  try {
    const res = await fetchWithTimeout(
      manifestUrl,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json,*/*" } },
      TIMEOUT_HTML
    );
    if (!res.ok) return icons;
    const text = await res.text();
    const json = JSON.parse(text);
    if (!json.icons || !Array.isArray(json.icons)) return icons;
    for (const icon of json.icons) {
      if (!icon.src) continue;
      let src;
      try {
        src = new URL(icon.src, manifestUrl).href;
      } catch {
        continue;
      }
      let sizeValue = 0;
      if (icon.sizes) {
        const parts = String(icon.sizes).split(/\s+/);
        for (const part of parts) {
          const w = parseInt(part.split("x")[0], 10);
          if (!Number.isNaN(w) && w > sizeValue) sizeValue = w;
        }
      }
      icons.push({ href: src, sizes: icon.sizes || "", rel: "manifest-icon", sizeValue });
    }
    icons.sort((a, b) => b.sizeValue - a.sizeValue);
  } catch {}
  return icons;
}

function buildFallbackList(targetUrl) {
  const u = new URL(targetUrl);
  const host = u.hostname;
  const origin = u.origin;
  const list = [];
  const hostSpecific = {
    "newgrounds.com": ["https://www.newgrounds.com/_guard/favicon.ico", "https://www.newgrounds.com/favicon.ico"],
    "www.newgrounds.com": ["https://www.newgrounds.com/_guard/favicon.ico"],
    "mail.google.com": ["https://ssl.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png"],
    "docs.google.com": ["https://ssl.gstatic.com/images/branding/product/1x/docs_2020q4_32dp.png"],
    "chat.deepseek.com": ["https://www.deepseek.com/favicon.ico", "https://chat.deepseek.com/favicon.ico"],
    "codepen.io": [],
    "gitlab.com": ["https://about.gitlab.com/favicon.ico"],
    "grok.x.ai": ["https://x.ai/favicon.ico"],
    "notion.so": ["https://www.notion.so/front-static/favicon.ico"],
    "www.notion.so": ["https://www.notion.so/front-static/favicon.ico"],
    "outlook.live.com": ["https://outlook.live.com/mail/favicon.ico"],
    "tiktok.com": ["https://www.tiktok.com/favicon.ico"],
    "www.tiktok.com": ["https://www.tiktok.com/favicon.ico"],
    "proton.me": [],
    "play.geforcenow.com": []
  };
  const overrides = hostSpecific[host] || [];
  for (const o of overrides) if (!list.includes(o)) list.push(o);
  const faviconIco = `${origin}/favicon.ico`;
  if (!list.includes(faviconIco)) list.push(faviconIco);
  if (host.startsWith("www.")) {
    const bare = host.slice(4);
    const bareOrigin = `${u.protocol}//${bare}`;
    const bareFavicon = `${bareOrigin}/favicon.ico`;
    if (!list.includes(bareFavicon)) list.push(bareFavicon);
  } else {
    const wwwHost = `www.${host}`;
    const wwwOrigin = `${u.protocol}//${wwwHost}`;
    const wwwFavicon = `${wwwOrigin}/favicon.ico`;
    if (["notion.so", "tiktok.com", "newgrounds.com"].includes(host) && !list.includes(wwwFavicon)) {
      list.splice(1, 0, wwwFavicon);
    }
  }
  const duck = `https://icons.duckduckgo.com/ip3/${host}.ico`;
  if (!list.includes(duck)) list.push(duck);
  const google = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  if (!list.includes(google)) list.push(google);
  if (host === "mail.google.com" || host === "docs.google.com") {
    const s2Google = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    if (!list.includes(s2Google)) list.push(s2Google);
  }
  const wwwVariant = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  if (host === "tiktok.com" || host === "notion.so") {
    const altDuck = `https://icons.duckduckgo.com/ip3/${wwwVariant}.ico`;
    if (!list.includes(altDuck)) list.push(altDuck);
  }
  return [...new Set(list)];
}

async function tryFetchImage(candidate) {
  if (candidate.startsWith("data:")) {
    const buf = decodeDataUri(candidate);
    if (!buf || buf.length < 50) return { ok: false, status: 0, buffer: null, contentType: "" };
    let ct = "image/svg+xml";
    if (candidate.includes("image/png")) ct = "image/png";
    else if (candidate.includes("image/jpeg")) ct = "image/jpeg";
    else if (candidate.includes("image/webp")) ct = "image/webp";
    return { ok: true, status: 200, buffer: buf, contentType: ct, sourceUrl: candidate };
  }
  let headStatus = null;
  try {
    const headRes = await fetchWithTimeout(
      candidate,
      { method: "HEAD", headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" } },
      TIMEOUT_HEAD
    );
    headStatus = headRes.status;
  } catch (e) {
    headStatus = e.cause ? e.cause.message : e.message;
  }
  try {
    const res = await fetchWithTimeout(
      candidate,
      { headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" } },
      TIMEOUT_IMAGE
    );
    if (!res.ok) return { ok: false, status: res.status, buffer: null, contentType: "", headStatus };
    const ct = res.headers.get("content-type") || "";
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (buffer.length < 80) return { ok: false, status: res.status, buffer: null, contentType: ct, headStatus };
    const ctLower = ct.toLowerCase();
    if (ctLower.includes("text/html") || ctLower.includes("application/xhtml+xml"))
      return { ok: false, status: res.status, buffer: null, contentType: ct, headStatus };
    const headStr = buffer.toString("utf8", 0, 2000).trim().toLowerCase();
    const headSlice = headStr.slice(0, 500);
    if (headSlice.startsWith("<!doctype") || headSlice.startsWith("<html") || headSlice.includes("<html"))
      return { ok: false, status: res.status, buffer: null, contentType: ct, headStatus };
    return { ok: true, status: res.status, buffer, contentType: ct, headStatus, sourceUrl: candidate };
  } catch (e) {
    return { ok: false, status: 0, buffer: null, contentType: "", headStatus, error: e.message };
  }
}

async function collectCandidates(targetUrl) {
  const parsed = [];
  let html = "";
  try {
    const res = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7"
        }
      },
      TIMEOUT_HTML
    );
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html") || ct.includes("application/xhtml") || ct === "") {
        html = await res.text();
      } else {
        html = "";
      }
    }
  } catch {}
  if (html) {
    const links = parseFaviconLinks(html, targetUrl);
    for (const l of links) parsed.push(l.href);
    try {
      const manifestIcons = await fetchManifestIcons(html, targetUrl);
      for (const mi of manifestIcons) if (!parsed.includes(mi.href)) parsed.push(mi.href);
    } catch {}
    const filtered = parsed.filter((href) => {
      if (href.startsWith("data:;")) return false;
      if (href === "data:;base64,=") return false;
      if (href.length < 8) return false;
      return true;
    });
    parsed.length = 0;
    for (const f of filtered) parsed.push(f);
  }
  const fallbacks = buildFallbackList(targetUrl);
  const combined = [...parsed];
  for (const fb of fallbacks) if (!combined.includes(fb)) combined.push(fb);
  return combined;
}

const KNOWN_IMAGE_EXTENSIONS = ["webp", "svg", "png", "ico", "jpg", "gif"];

function detectExtension(buffer, contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("svg")) return "svg";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("icon") || ct.includes("ico")) return "ico";
  if (ct.includes("webp")) return "webp";
  if (buffer.length >= 12) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "gif";
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "webp";
    if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) return "ico";
  }
  const head = buffer.toString("utf8", 0, 500).trim();
  if (head.startsWith("<svg") || head.includes("<svg")) return "svg";
  return "png";
}

function suffixedPath(outPath, ext) {
  const dot = outPath.lastIndexOf(".");
  return (dot < 0 ? outPath : outPath.slice(0, dot)) + "." + ext;
}

function writeRawWithExtension(buffer, contentType, outPath) {
  const target = suffixedPath(outPath, detectExtension(buffer, contentType));
  writeFileSync(target, buffer);
  if (target !== outPath) {
    try {
      rmSync(outPath, { force: true });
    } catch {}
  }
  return target;
}

async function convertToWebp(buffer, contentType, outPath) {
  if (sharp) {
    try {
      const head = buffer.toString("utf8", 0, 500).trim();
      const ico = isIcoBuffer(buffer) ? decodeIco(buffer) : null;
      const isSvgString = !ico && (contentType.includes("svg") || head.startsWith("<svg") || head.includes("<svg"));

      let pipeline;
      if (ico && ico.format === "raw") {
        pipeline = sharp(ico.data, { raw: { width: ico.width, height: ico.height, channels: 4 } });
      } else if (ico) {
        pipeline = sharp(ico.data);
      } else if (isSvgString) {
        pipeline = sharp(Buffer.from(buffer.toString("utf8")), { density: 128 });
      } else {
        pipeline = sharp(buffer, { animated: false });
      }

      const outBuffer = await pipeline
        .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 85 })
        .toBuffer();
      writeFileSync(outPath, outBuffer);
      return { bytes: outBuffer.length, converted: true };
    } catch (e) {
      try {
        const target = writeRawWithExtension(buffer, contentType, outPath);
        return { bytes: buffer.length, converted: false, error: e.message, fileName: target };
      } catch (err) {
        throw err;
      }
    }
  } else {
    const target = writeRawWithExtension(buffer, contentType, outPath);
    return { bytes: buffer.length, converted: false, fileName: target };
  }
}

function existingPrimaryFile(slug) {
  for (const ext of KNOWN_IMAGE_EXTENSIONS) {
    const candidate = join(primaryOut, `${slug}.${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function shouldSkip(slug) {
  if (force) return false;
  const primaryFile = existingPrimaryFile(slug);
  if (!primaryFile) return false;
  try {
    const stat = statSync(primaryFile);
    const age = Date.now() - stat.mtimeMs;
    if (age < SEVEN_DAYS && stat.size > 0) return true;
  } catch {}
  return false;
}

async function processApp(app, cache) {
  const slug = serviceKeyToSlug(app.serviceKey);
  const outPrimary = join(primaryOut, `${slug}.webp`);
  if (shouldSkip(slug)) {
    try {
      const stat = statSync(existingPrimaryFile(slug) || outPrimary);
      console.log(
        `[skip] ${slug} (${app.serviceKey} -> ${app.targetUrl}) exists ${stat.size} bytes age ${((Date.now() - stat.mtimeMs) / 1000 / 3600) | 0}h`
      );
      const existing = cache.find((c) => c.slug === slug);
      if (existing) {
        existing.bytes = stat.size;
        existing.status = "cached";
      } else {
        cache.push({
          slug,
          url: app.targetUrl,
          sourceUrl: existing ? existing.sourceUrl : "",
          fetchedAt: new Date().toISOString(),
          bytes: stat.size,
          status: "cached"
        });
      }
      return { slug, status: "cached" };
    } catch {}
  }
  const candidates = await collectCandidates(app.targetUrl);
  let success = null;
  let lastHead = null;
  for (const cand of candidates) {
    const result = await tryFetchImage(cand);
    lastHead = result.headStatus !== undefined ? result.headStatus : result.status;
    if (result.ok && result.buffer) {
      success = result;
      break;
    }
  }
  if (!success) {
    console.log(`[fail] ${slug} (${app.targetUrl}) all ${candidates.length} candidates failed lastHead=${lastHead}`);
    cache.push({
      slug,
      url: app.targetUrl,
      sourceUrl: candidates[0] || "",
      fetchedAt: new Date().toISOString(),
      bytes: 0,
      status: "fail"
    });
    return { slug, status: "fail" };
  }
  try {
    const conv = await convertToWebp(success.buffer, success.contentType, outPrimary);
    const bytes = conv.bytes;
    const convertedLabel = conv.converted ? "webp" : sharp ? "fallback" : "no-sharp";
    console.log(
      `[ok] ${slug} <- ${success.sourceUrl} head=${success.headStatus ?? "-"} get=${success.status} bytes=${success.buffer.length} -> ${bytes} ${convertedLabel}`
    );
    const entry = {
      slug,
      url: app.targetUrl,
      sourceUrl: success.sourceUrl,
      fetchedAt: new Date().toISOString(),
      bytes,
      status: "ok"
    };
    const idx = cache.findIndex((c) => c.slug === slug);
    if (idx >= 0) cache[idx] = entry;
    else cache.push(entry);
    return { slug, status: "ok", bytes };
  } catch (e) {
    console.log(`[fail] ${slug} write error ${e.message}`);
    cache.push({
      slug,
      url: app.targetUrl,
      sourceUrl: success.sourceUrl,
      fetchedAt: new Date().toISOString(),
      bytes: 0,
      status: "fail"
    });
    return { slug, status: "fail" };
  }
}

async function main() {
  if (!FETCH_ENABLED) {
    console.log("[fetchFavicons] disabled via FETCH_ENABLED flag, skipping.");
    return;
  }
  ensureDirs();
  const apps = loadWebApps();
  console.log(`Found ${apps.length} web apps`);
  for (const a of apps) console.log(` - ${a.serviceKey} -> ${a.targetUrl} => ${serviceKeyToSlug(a.serviceKey)}.webp`);
  if (!sharp) console.log("WARN sharp not available, saving original bytes as .webp");
  let cache = [];
  if (existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, "utf-8"));
      if (!Array.isArray(cache)) cache = [];
    } catch {
      cache = [];
    }
  }
  let okCount = 0;
  let failCount = 0;
  let cachedCount = 0;
  for (const app of apps) {
    try {
      const res = await processApp(app, cache);
      if (res.status === "ok") okCount++;
      else if (res.status === "cached") cachedCount++;
      else failCount++;
    } catch (e) {
      console.log(`[fail] ${app.serviceKey} exception ${e.message}`);
      failCount++;
    }
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
  console.log(`Done ok=${okCount} cached=${cachedCount} fail=${failCount} total=${apps.length}`);
  console.log(`Primary: ${primaryOut}`);
  console.log(`Cache: ${cachePath}`);
  if (failCount > 0) {
    const fails = cache.filter((c) => c.status === "fail").map((c) => c.slug);
    console.log(`Failed slugs: ${fails.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
