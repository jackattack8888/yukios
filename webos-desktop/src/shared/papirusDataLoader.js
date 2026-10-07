import papirusAvailableJsonUrl from "../generated/papirus-available.json?url";
import papirusAvailableGzUrl from "../generated/papirus-available.json.gz?url";
import papirusSymlinksJsonUrl from "../generated/papirus-symlinks.json?url";
import papirusSymlinksGzUrl from "../generated/papirus-symlinks.json.gz?url";

export let PAPIRUS_AVAILABLE = {};
export let PAPIRUS_SYMLINKS = {};

async function fetchJsonCompressed(gzUrl, jsonUrl) {
  try {
    const gzRes = await fetch(gzUrl);
    if (gzRes.ok) {
      const buf = await gzRes.arrayBuffer();
      if (buf.byteLength > 0 && typeof DecompressionStream !== "undefined") {
        try {
          const ds = new DecompressionStream("gzip");
          const stream = new Blob([buf]).stream().pipeThrough(ds);
          const txt = await new Response(stream).text();
          return JSON.parse(txt);
        } catch {}
      }
    }
  } catch {}
  const res = await fetch(jsonUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${jsonUrl}: ${res.status}`);
  return res.json();
}

let papirusLoadPromise = null;

export function ensurePapirusData() {
  if (papirusLoadPromise) return papirusLoadPromise;
  papirusLoadPromise = (async () => {
    try {
      const [avail, sym] = await Promise.all([
        fetchJsonCompressed(papirusAvailableGzUrl, papirusAvailableJsonUrl),
        fetchJsonCompressed(papirusSymlinksGzUrl, papirusSymlinksJsonUrl)
      ]);
      if (avail && typeof avail === "object") PAPIRUS_AVAILABLE = avail;
      if (sym && typeof sym === "object") PAPIRUS_SYMLINKS = sym;
    } catch {}
  })();
  return papirusLoadPromise;
}

ensurePapirusData();

export const papirusReady = ensurePapirusData();
