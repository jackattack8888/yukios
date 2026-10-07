import { BusEvents } from "../core/EventBus.js";
import { os } from "../os/index.js";
import { buildLoadingIndicator } from "./loadingIndicator.js";

export function normalizePath(path) {
  if (Array.isArray(path)) return path;
  if (typeof path === "string") return path.split("/").filter(Boolean);
  return Object.values(path ?? {}).filter((v) => typeof v === "string");
}

export function fileNameToDisplayName(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildLoadingStateHTML({ winId, iconClass, wrapperClass, textClass, logClass, displayName }) {
  const wc = wrapperClass || "yuki-loading-indicator emu-state emu-load-wrap";
  const ic = iconClass || "fas fa-spinner fa-spin";
  const indicator = buildLoadingIndicator({ label: `Starting <strong>${displayName}</strong>…`, iconClass: ic });
  return `
    <div id="${winId}-inner" class="${wc}">
      ${indicator}
      <div class="${textClass || "emu-state-text"} emu-state-text--accent" style="display:none">Starting <strong>${displayName}</strong>…</div>
      <div id="${winId}-log" class="${logClass || "emu-state-text--muted"}"></div>
    </div>`;
}

export function buildErrorHTML({
  msg,
  wrapperClass = "emu-state emu-state--error",
  iconClass = "fa-solid fa-triangle-exclamation emu-state-icon",
  textClass = "emu-state-text emu-state--error"
}) {
  return `<div class="${wrapperClass}"><i class="${iconClass}"></i><div class="${textClass}">${msg}</div></div>`;
}

export function setLog(logEl, msg) {
  if (logEl) logEl.textContent = msg;
}

export async function saveEmulatorFile({ file, dir, kind = "other", icon, extraDirs = [], emitChanged = false }) {
  const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
  await os.fs.writeBinaryFile(dir, file.name, blob, kind, icon);
  for (const extra of extraDirs) {
    await os.fs.writeBinaryFile(extra.dir, file.name, blob, extra.kind ?? kind, icon);
  }
  if (emitChanged) os.events.emit(BusEvents.FILE_CHANGED, { path: file.name });
  return blob;
}

export async function renderEmulatorFileList({
  container,
  dir,
  filter,
  emptyHTML,
  cardHTML,
  cardSelector,
  deleteBtnSelector,
  deleteAction,
  onCardClick,
  onReload
}) {
  if (!container) return;
  try {
    await os.fs.mkdir(dir).catch(() => {});
    const entries = await os.fs.readdir(dir).catch(() => null);
    const files = Array.isArray(entries)
      ? entries
      : Object.keys(entries ?? {}).filter((k) => entries?.[k]?.type === "file");
    const matched = files.filter((f) => !f.startsWith(".") && filter(f));
    if (matched.length === 0) {
      container.innerHTML = emptyHTML;
      return;
    }
    container.innerHTML = matched.map((f) => cardHTML(f)).join("");
    container.querySelectorAll(cardSelector).forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(deleteBtnSelector)) return;
        onCardClick(card.dataset.userFile);
      });
    });
    container.querySelectorAll(deleteBtnSelector).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteAction(btn.dataset.file);
        await onReload();
      });
    });
  } catch {}
}

function defaultSpinner(count) {
  return `<div class="yuki-loading-indicator"><i class="fa-solid fa-spinner fa-spin emu-state-icon" style="animation-duration:1.4s;opacity:0.7"></i><div class="emu-state-text">Saving ${count} file(s)…</div></div>`;
}

function defaultSuccess(count) {
  return `<i class="fa-solid fa-circle-check emu-state-icon"></i><div class="emu-state-text">Saved ${count} file(s)!</div>`;
}

function defaultError(msg) {
  return `<div class="emu-state emu-state--error"><i class="fa-solid fa-triangle-exclamation emu-state-icon"></i><div class="emu-state-text emu-state--error">${msg}</div></div>`;
}

export async function handleEmulatorUpload({
  zone,
  files,
  dir,
  kind = "other",
  icon,
  extraDirs = [],
  emitChanged = false,
  spinnerHTML,
  successHTML,
  errorHTML,
  onSaved,
  onReload
}) {
  const originalHTML = zone.innerHTML;
  const count = files.length;
  zone.innerHTML = spinnerHTML || defaultSpinner(count);
  try {
    for (const file of files) {
      await saveEmulatorFile({ file, dir, kind, icon, extraDirs, emitChanged });
    }
    onSaved?.();
    zone.innerHTML = successHTML || defaultSuccess(count);
    setTimeout(() => {
      zone.innerHTML = originalHTML;
      onReload?.();
    }, 1500);
  } catch (err) {
    zone.innerHTML = errorHTML ? errorHTML(err.message) : defaultError(err.message);
    setTimeout(() => {
      zone.innerHTML = originalHTML;
    }, 2500);
  }
}

export const SNAPSHOT_DIR = ["Snapshots"];
export const EMULATOR_LAST_PLAYED_KEY = "yukios:emulator:lastPlayed";
export const EMULATOR_SAVE_REQUEST = "yuki-emu-export-save";
export const EMULATOR_SAVE_RESPONSE = "yuki-emu-save-data";

export function snapshotKeyForRom(fileName) {
  const base = String(fileName ?? "")
    .split("/")
    .pop()
    .split("\\")
    .pop();
  const stripped = base
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase();
  const dashed = stripped
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-.]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return dashed || "rom";
}

export async function ensureSnapshotDir() {
  try {
    await os.fs.mkdir(SNAPSHOT_DIR);
  } catch {}
  return SNAPSHOT_DIR;
}

export async function readSnapshotBlob(fileName) {
  try {
    const blob = await os.fs.readBinaryFile(SNAPSHOT_DIR, fileName);
    if (blob && blob.size > 0) return blob;
  } catch {}
  try {
    const fallback = await os.fs.read([...SNAPSHOT_DIR, fileName]);
    if (fallback instanceof Blob && fallback.size > 0) return fallback;
  } catch {}
  return null;
}

export async function loadEmulatorSnapshots(key) {
  const saveBlob = await readSnapshotBlob(`${key}.sav`);
  const shotBlob = await readSnapshotBlob(`${key}.png`);
  return { saveBlob, shotBlob };
}

export async function writeEmulatorSnapshot(fileName, blob) {
  try {
    await ensureSnapshotDir();
    await os.fs.writeBinaryFile(SNAPSHOT_DIR, fileName, blob, "other");
    return true;
  } catch {}
  return false;
}

export function readLastPlayedRom() {
  try {
    return os.storage.get(EMULATOR_LAST_PLAYED_KEY);
  } catch {}
  return null;
}

export function recordLastPlayedRom(fileName) {
  try {
    os.storage.set(EMULATOR_LAST_PLAYED_KEY, { name: fileName, at: Date.now() });
  } catch {}
}

export function normalizeSavePayload(payload) {
  try {
    if (!payload) return null;
    if (payload instanceof Blob) return payload.size > 0 ? payload : null;
    if (payload instanceof ArrayBuffer) return payload.byteLength > 0 ? new Blob([payload]) : null;
    if (ArrayBuffer.isView(payload)) return payload.byteLength > 0 ? new Blob([payload]) : null;
  } catch {}
  return null;
}

export async function dataUrlToBlob(dataUrl) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (blob && blob.size > 0) return blob;
  } catch {}
  return null;
}

export async function captureIframeScreenshot(iframe) {
  try {
    const doc = iframe?.contentDocument;
    if (!doc) return null;
    const canvas = doc.querySelector("canvas");
    if (!canvas) return null;
    return await new Promise((resolve) => {
      let finished = false;
      const finish = (blob) => {
        if (finished) return;
        finished = true;
        resolve(blob && blob.size > 0 ? blob : null);
      };
      try {
        canvas.toBlob((blob) => finish(blob), "image/png");
      } catch {
        finish(null);
      }
      setTimeout(() => finish(null), 1500);
    });
  } catch {}
  return null;
}

export async function readDirectEmulatorSave(iframe) {
  try {
    const innerWin = iframe?.contentWindow;
    if (!innerWin) return null;
    const pending = normalizeSavePayload(innerWin.yukiPendingSave);
    if (pending) return pending;
    const emu = innerWin.EJS_emulator;
    if (emu && typeof emu.saveState === "function") {
      const fromEmu = normalizeSavePayload(await emu.saveState());
      if (fromEmu) return fromEmu;
    }
    if (typeof innerWin.EJS_saveState === "function") {
      return normalizeSavePayload(await innerWin.EJS_saveState());
    }
  } catch {}
  return null;
}

export function requestIframeSaveOverMessage(iframe, timeoutMs) {
  const wait = timeoutMs || 900;
  return new Promise((resolve) => {
    let done = false;
    function finish(blob) {
      if (done) return;
      done = true;
      try {
        window.removeEventListener("message", onSaveMessage);
      } catch {}
      resolve(blob);
    }
    function onSaveMessage(event) {
      try {
        if (event.source !== iframe?.contentWindow) return;
        const data = event.data;
        if (!data || data.type !== EMULATOR_SAVE_RESPONSE) return;
        if (!data.dataUrl) {
          finish(null);
          return;
        }
        dataUrlToBlob(data.dataUrl).then(finish);
      } catch {}
    }
    try {
      window.addEventListener("message", onSaveMessage);
      iframe?.contentWindow?.postMessage({ type: EMULATOR_SAVE_REQUEST }, "*");
    } catch {
      finish(null);
      return;
    }
    setTimeout(() => finish(null), wait);
  });
}

export async function exportEmulatorSave(iframe) {
  const direct = await readDirectEmulatorSave(iframe);
  if (direct) return direct;
  return requestIframeSaveOverMessage(iframe, 900);
}

export function buildEmulatorBridgeScript() {
  return `window.yukiPendingSave = null;
try {
  var yukiNativeSave = window.EJS_onSaveState;
  window.EJS_onSaveState = function (state) {
    window.yukiPendingSave = state;
    if (typeof yukiNativeSave === 'function') { try { yukiNativeSave(state); } catch {} }
  };
} catch {}
window.addEventListener('message', async (event) => {
  var incoming = event.data;
  var kind = typeof incoming === 'string' ? incoming : incoming && incoming.type;
  if (kind !== 'yuki-emu-export-save') return;
  var reply = function (payload) {
    var target = null;
    try {
      if (payload instanceof Blob) target = payload;
      else if (payload instanceof ArrayBuffer) target = new Blob([payload]);
      else if (typeof ArrayBuffer === 'function' && ArrayBuffer.isView(payload)) target = new Blob([payload]);
      else if (payload && payload.buffer instanceof ArrayBuffer) target = new Blob([payload]);
    } catch {}
    if (!target || target.size === 0) {
      try { event.source.postMessage({ type: 'yuki-emu-save-data', dataUrl: null }, '*'); } catch {}
      return;
    }
    try {
      var reader = new FileReader();
      reader.onload = function () {
        try { event.source.postMessage({ type: 'yuki-emu-save-data', dataUrl: reader.result }, '*'); } catch {}
      };
      reader.onerror = function () {
        try { event.source.postMessage({ type: 'yuki-emu-save-data', dataUrl: null }, '*'); } catch {}
      };
      reader.readAsDataURL(target);
    } catch {}
  };
  try {
    var emu = window.EJS_emulator;
    if (emu && typeof emu.saveState === 'function') { reply(await emu.saveState()); return; }
    if (typeof window.EJS_saveState === 'function') { reply(await window.EJS_saveState()); return; }
    reply(window.yukiPendingSave);
  } catch { reply(null); }
});`;
}

export function resizeEmulatorWindow(win, width, height) {
  try {
    const api = os.window;
    if (!api || !win) return false;
    if (typeof api.resize === "function") {
      api.resize(win, `${width}px`, `${height}px`);
      return true;
    }
    if (typeof api.setSize === "function") {
      api.setSize(win, width, height);
      return true;
    }
  } catch {}
  return false;
}

export function applyEmulatorContentSize(iframe, win) {
  const doc = iframe?.contentDocument;
  if (!doc) return false;
  const canvas = doc.querySelector("canvas");
  const width = (canvas && canvas.width) || doc.documentElement?.scrollWidth || 0;
  const height = (canvas && canvas.height) || doc.documentElement?.scrollHeight || 0;
  if (!width || !height) return false;
  return resizeEmulatorWindow(win, width, height);
}

export function pollEmulatorContentSize(iframe, win, rounds) {
  const total = rounds || 10;
  let count = 0;
  const timer = setInterval(() => {
    count += 1;
    try {
      applyEmulatorContentSize(iframe, win);
    } catch {}
    if (count >= total) clearInterval(timer);
  }, 500);
  return timer;
}
