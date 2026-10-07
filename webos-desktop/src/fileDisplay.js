import { FileKind } from "./shared/fileKindDetector.js";
import { os, StorageKeys, $, createElement, ServiceKeys } from "./framework.js";
import { ROM_EXTS } from "./shared/coreMap.js";
import { getDefaultApp, isUnassociated } from "./fileAssociations.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { formatSize } from "./utils/utils.js";
import { getEffectiveIcon } from "./shared/iconPack.js";

function viewerIcon(papirusIcon, size = 14) {
  const effective = getEffectiveIcon(papirusIcon);
  if (typeof effective === "string" && effective.startsWith("papirus:"))
    return `<img src="${resolveIconUrl(effective)}" style="width:${size}px;height:${size}px;" alt="" />`;
  let cls = effective;
  if (typeof cls === "string" && cls.startsWith("fa-") && !cls.includes(" ")) cls = "fas " + cls;
  return `<i class="${cls}" style="font-size:${size}px;"></i>`;
}

import {
  getExt,
  fileKindFromName,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isOfficeFile,
  isZipFile,
  isISOFile,
  isExeFile,
  isSwfFile,
  isEbookFile,
  isFontFile,
  isDiskFile,
  isShortcutFile,
  isHtmlFile,
  isMarkdownFile,
  isJsonFile,
  isCodeFile,
  mimeFromName,
  IMAGE_EXTS,
  VIDEO_EXTS,
  AUDIO_EXTS,
  ZIP_EXTS,
  EXE_EXTS,
  SWF_EXTS,
  EBOOK_EXTS,
  FONT_EXTS,
  DISK_EXTS,
  SHORTCUT_EXTS,
  HTML_EXTS,
  MARKDOWN_EXTS,
  TEXT_EXTS,
  CODE_EXTS,
  VIDEO_MIME_MAP,
  IMAGE_MIME_MAP,
  OFFICE_EXTS
} from "./shared/fileKindDetector.js";

export {
  getExt,
  fileKindFromName,
  isImageFile,
  isOfficeFile,
  isZipFile,
  isISOFile,
  isExeFile,
  isSwfFile,
  readFontBlob,
  OFFICE_EXTS
};

const CODE_ICON_COLORS = {
  js: "#f7df1e",
  mjs: "#f7df1e",
  cjs: "#f7df1e",
  ts: "#3178c6",
  tsx: "#61dafb",
  jsx: "#61dafb",
  py: "#ffd43b",
  css: "#1572B6",
  scss: "#cc6699",
  sass: "#cc6699",
  less: "#3b6ea5",
  java: "#e76f00",
  cs: "#2ea043",
  c: "#a8b9cc",
  h: "#a8b9cc",
  cpp: "#f34b7d",
  hpp: "#f34b7d",
  go: "#00ADD8",
  rs: "#e0a070",
  php: "#777bb4",
  rb: "#e5463e",
  swift: "#ff7a5c",
  kt: "#b794ff",
  kts: "#b794ff",
  dart: "#36d6c3",
  sh: "#9ae66e",
  bash: "#9ae66e",
  zsh: "#9ae66e",
  sql: "#ffa733",
  vue: "#41b883",
  svelte: "#ff5a36",
  dockerfile: "#4aa3ff",
  makefile: "#6bcb5a",
  yaml: "#ff5a5a",
  yml: "#ff5a5a",
  lua: "#8a87e0",
  scala: "#ff6b7d",
  sc: "#ff6b7d",
  zig: "#ffb347",
  nim: "#ffd24d",
  elm: "#7fd3e8"
};

const RECENT_FILES_MAX = 20;

function trackRecentFile(name, path) {
  try {
    const recent = os.storage.get(StorageKeys.recentFiles) || [];
    const key = Array.isArray(path) ? path.join("/") : path;
    const existing = recent.findIndex((f) => f.name === name && f.path === key);
    if (existing !== -1) recent.splice(existing, 1);
    recent.unshift({ name, path: key, kind: fileKindFromName(name), timestamp: Date.now() });
    if (recent.length > RECENT_FILES_MAX) recent.length = RECENT_FILES_MAX;
    os.storage.set(StorageKeys.recentFiles, recent);
  } catch (e) {
    console.error("[FileDisplay] trackRecentFile error:", e);
  }
}

const LARGE_FILE_THRESHOLD = 1024 * 1024;

function isRomFile(name) {
  return ROM_EXTS.includes(getExt(name));
}

export function isWallpaperPath(path) {
  return (
    Array.isArray(path) &&
    path.length >= 2 &&
    path[path.length - 2] === "Pictures" &&
    path[path.length - 1] === "Wallpapers"
  );
}

export function resolveFileIcon(name, isFolder = false) {
  if (isFolder) return resolveIconUrl("static/icons/file.webp");
  if (isImageFile(name)) return "@content";
  if (isVideoFile(name)) return resolveIconUrl("static/icons/obs.webp");
  if (isAudioFile(name)) return resolveIconUrl("static/icons/spot.webp");
  if (isRomFile(name)) return "rom";
  if (isSwfFile(name)) return resolveIconUrl("static/icons/flash.webp");
  if (isZipFile(name)) return resolveIconUrl("static/icons/zip.webp");
  if (isExeFile(name)) return getExt(name) === "exe" ? "fas fa-wine-glass" : resolveIconUrl("static/icons/jsdos.webp");
  if (isOfficeFile(name)) return resolveIconUrl("static/icons/office.webp");
  if (isEbookFile(name)) return resolveIconUrl("static/icons/office.webp");
  if (isFontFile(name)) return getEffectiveIcon("papirus:mimetypes/application-x-font-ttf");
  if (isDiskFile(name)) return resolveIconUrl("static/icons/zip.webp");
  if (isShortcutFile(name)) return resolveIconUrl("static/icons/notepad.webp");
  if (isHtmlFile(name)) return resolveIconUrl("static/icons/chrome.webp");
  if (isJsonFile(name)) return resolveIconUrl("static/icons/notepad.webp");
  return getEffectiveIcon("papirus:mimetypes/text-x-generic");
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function buildFileIconHTML(
  name,
  { thumbnailSrc = null, size = 64, radius = 8, storedIcon = null, isFolder = false } = {}
) {
  const s = `width:${size}px;height:${size}px;border-radius:${radius}px;`;

  function faIconDiv(iconClass, { color = "var(--brand)", bg = "" } = {}) {
    const bgStyle = bg ? `background:${bg};` : "";
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:50px;color:${color};${bgStyle}"><i class="${iconClass}"></i></div>`;
  }

  function papirusDiv(papirusIcon, { bg = "" } = {}) {
    const bgStyle = bg ? `background:${bg};` : "";
    const url = resolveIconUrl(papirusIcon);
    return `<div style="${s}display:flex;align-items:center;justify-content:center;${bgStyle}"><img src="${url}" style="width:${Math.round(size * 0.62)}px;height:${Math.round(size * 0.62)}px;object-fit:contain;" loading="lazy" alt="" /></div>`;
  }

  function renderPapirus(papirusIcon, opts = {}) {
    const effective = getEffectiveIcon(papirusIcon);
    if (typeof effective === "string" && effective.startsWith("papirus:")) return papirusDiv(effective, opts);
    let faCandidate = effective;
    if (typeof faCandidate === "string" && faCandidate.startsWith("fa-") && !faCandidate.includes(" "))
      faCandidate = "fas " + faCandidate;
    if (typeof faCandidate === "string" && (faCandidate.startsWith("fa") || faCandidate.includes(" fa-")))
      return faIconDiv(faCandidate, opts);
    return papirusDiv(papirusIcon, opts);
  }

  if (isFolder) {
    return `<img src="${resolveIconUrl("static/icons/file.webp")}" style="${s}object-fit:cover;">`;
  }

  let iconSource = thumbnailSrc || storedIcon;

  if (iconSource && typeof iconSource === "string") {
    const effective = getEffectiveIcon(iconSource);
    if (typeof effective === "string" && effective.startsWith("papirus:")) {
      return papirusDiv(effective, { bg: "var(--surface-1)" });
    }
    let faCandidate = effective;
    if (typeof faCandidate === "string" && faCandidate.startsWith("fa-") && !faCandidate.includes(" "))
      faCandidate = "fas " + faCandidate;
    if (typeof faCandidate === "string" && (faCandidate.startsWith("fa") || faCandidate.includes(" fa-"))) {
      return faIconDiv(faCandidate);
    }
    if (
      typeof effective === "string" &&
      (effective.startsWith("data:") || effective.startsWith("blob:") || effective.startsWith("http"))
    ) {
      return `<img src="${effective}" style="${s}object-fit:cover;">`;
    }
  }

  if (isHtmlFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;background:var(--surface-1);"><img src="${resolveIconUrl("static/icons/chrome.webp")}" style="width:${Math.round(size * 0.62)}px;height:${Math.round(size * 0.62)}px;object-fit:contain;" loading="lazy" alt=""></div>`;
  }
  if (isMarkdownFile(name)) {
    return renderPapirus("papirus:mimetypes/text-x-markdown", { bg: "var(--surface-1)" });
  }
  if (isISOFile(name)) {
    return renderPapirus("papirus:devices/media-optical", { bg: "var(--surface-1)" });
  }
  if (isRomFile(name)) {
    return renderPapirus("papirus:apps/preferences-desktop-gaming", { bg: "var(--surface-1)" });
  }
  if (isSwfFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/flash.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isZipFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/zip.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isExeFile(name)) {
    if (getExt(name) === "exe") return faIconDiv("fas fa-wine-glass");
    return `<img src="${resolveIconUrl("static/icons/jsdos.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isAudioFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/spot.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isJsonFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/notepad.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isCodeFile(name)) {
    return renderPapirus("papirus:mimetypes/text-x-script", { bg: "var(--surface-1)" });
  }
  if (isImageFile(name) && thumbnailSrc && thumbnailSrc !== "@content") {
    return `<img src="${thumbnailSrc}" style="${s}object-fit:cover;">`;
  }
  if (isVideoFile(name)) {
    if (thumbnailSrc && thumbnailSrc !== "@content") {
      return `<img src="${thumbnailSrc}" style="${s}object-fit:cover;">`;
    }
    if (storedIcon && storedIcon !== "@content" && storedIcon !== "rom") {
      const resolvedStored = resolveIconUrl(getEffectiveIcon(storedIcon));
      if (/\.(webp|png|jpg|jpeg|gif|avif|svg)$/i.test(resolvedStored)) {
        return `<img src="${resolvedStored}" style="${s}object-fit:cover;">`;
      }
    }
    return renderPapirus("papirus:mimetypes/video-x-generic", { bg: "var(--bg-primary)" });
  }
  if (isOfficeFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/office.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isEbookFile(name)) {
    return renderPapirus("papirus:mimetypes/application-epub+zip", { bg: "var(--surface-1)" });
  }
  if (isFontFile(name)) {
    return renderPapirus("papirus:mimetypes/application-x-font-ttf", { bg: "var(--surface-1)" });
  }
  if (isDiskFile(name)) {
    return renderPapirus("papirus:devices/drive-harddisk", { bg: "var(--surface-1)" });
  }
  if (storedIcon && storedIcon !== "@content" && storedIcon !== "rom") {
    const effectiveStored = getEffectiveIcon(storedIcon);
    if (typeof effectiveStored === "string" && effectiveStored.startsWith("papirus:")) {
      return papirusDiv(effectiveStored, { bg: "var(--surface-1)" });
    }
    let faStored = effectiveStored;
    if (typeof faStored === "string" && faStored.startsWith("fa-") && !faStored.includes(" "))
      faStored = "fas " + faStored;
    if (typeof faStored === "string" && (faStored.startsWith("fa") || faStored.includes(" fa-"))) {
      return faIconDiv(faStored, { bg: "var(--surface-1)" });
    }
    return `<img src="${resolveIconUrl(effectiveStored)}" style="${s}object-fit:cover;">`;
  }
  if (isShortcutFile(name)) {
    return renderPapirus("papirus:actions/link", { bg: "var(--surface-1)" });
  }
  return renderPapirus("papirus:mimetypes/text-x-generic", { bg: "var(--surface-1)" });
}

function setupImageViewer(win) {
  const container = win.querySelector(".img-viewer-container");
  const img = container.querySelector("img");
  const controls = container.querySelector(".img-viewer-controls");
  const zoomInBtn = controls.querySelector(".img-zoom-in");
  const zoomOutBtn = controls.querySelector(".img-zoom-out");
  const fullscreenBtn = container.querySelector(".img-fullscreen-btn");

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let fitScale = 1;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let startTX = 0;
  let startTY = 0;

  function update() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function calcFitScale() {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return 1;
    return Math.min(cw / nw, ch / nh, 1);
  }

  function fitToContainer() {
    fitScale = calcFitScale();
    scale = fitScale;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    tx = (cw - img.naturalWidth * scale) / 2;
    ty = (ch - img.naturalHeight * scale) / 2;
    img.style.removeProperty("max-width");
    img.style.removeProperty("max-height");
    update();
  }

  function zoomAt(newScale, cx, cy) {
    const rect = container.getBoundingClientRect();
    const originX = cx - rect.left;
    const originY = cy - rect.top;
    const oldScale = scale;
    scale = Math.max(0.1, Math.min(10, newScale));
    tx = originX - (originX - tx) * (scale / oldScale);
    ty = originY - (originY - ty) * (scale / oldScale);
    update();
  }

  function applyImageReady() {
    img.style.removeProperty("opacity");
    fitToContainer();
    update();
  }

  img.onload = applyImageReady;
  if (img.complete && img.naturalWidth > 0) applyImageReady();

  container.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomAt(scale * factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  img.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    const atFit = Math.abs(scale - fitScale) < 0.01;
    if (atFit) {
      const rect = container.getBoundingClientRect();
      scale = 1;
      tx = (rect.width - img.naturalWidth) / 2;
      ty = (rect.height - img.naturalHeight) / 2;
      update();
    } else {
      fitToContainer();
    }
  });

  function cancelPan() {
    if (isPanning) {
      isPanning = false;
      img.classList.remove("dragging");
    }
  }

  function onPanMouseDown(e) {
    if (e.button !== 0) return;
    if (e.altKey || e.metaKey) return;
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    startTX = tx;
    startTY = ty;
    img.classList.add("dragging");
  }

  function onPanMouseMove(e) {
    if (!isPanning) return;
    if (e.altKey || e.metaKey || win.classList.contains("dragging")) {
      cancelPan();
      return;
    }
    tx = startTX + (e.clientX - panStartX);
    ty = startTY + (e.clientY - panStartY);
    update();
  }

  function onPanMouseUp() {
    cancelPan();
  }

  img.addEventListener("mousedown", onPanMouseDown);

  document.addEventListener("mousemove", onPanMouseMove);

  document.addEventListener("mouseup", onPanMouseUp);

  zoomInBtn.addEventListener("click", () => {
    const rect = container.getBoundingClientRect();
    zoomAt(scale * 1.5, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  zoomOutBtn.addEventListener("click", () => {
    const rect = container.getBoundingClientRect();
    zoomAt(scale / 1.5, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  fullscreenBtn.addEventListener("click", () => {
    os.window.maximize(win);
  });

  const ro = new ResizeObserver(() => {
    if (win.classList.contains("dragging")) return;
    if (Math.abs(scale - fitScale) < 0.01) fitToContainer();
  });
  ro.observe(container);
  win.addEventListener("remove", () => {
    document.removeEventListener("mousemove", onPanMouseMove);
    document.removeEventListener("mouseup", onPanMouseUp);
    ro.disconnect();
  });
}

export function openMediaViewer(name, src, kind, storedIcon = null, opts = {}) {
  const isVideo = kind === FileKind.VIDEO || isVideoFile(name);
  const isAudio = kind === FileKind.AUDIO || isAudioFile(name);
  const isImage = !isVideo && !isAudio;

  const [defaultWidth, defaultHeight] = isAudio ? ["400px", "120px"] : ["500px", "400px"];
  const width = typeof opts.width === "number" ? `${opts.width}px` : defaultWidth;
  const height = typeof opts.height === "number" ? `${opts.height}px` : defaultHeight;
  let icon;
  if (storedIcon) {
    const effective = getEffectiveIcon(storedIcon);
    if (typeof effective === "string" && effective.startsWith("papirus:")) {
      icon = resolveIconUrl(effective);
    } else if (
      typeof effective === "string" &&
      (effective.startsWith("http") || effective.startsWith("data:") || effective.startsWith("/"))
    ) {
      icon = effective;
    } else {
      icon = isAudio ? resolveIconUrl("static/icons/spot.webp") : resolveIconUrl("static/icons/file.webp");
    }
  } else {
    icon = isAudio ? resolveIconUrl("static/icons/spot.webp") : resolveIconUrl("static/icons/file.webp");
  }

  let media;
  if (isVideo) {
    media = `<video src="${src}" crossorigin="anonymous" controls autoplay loop style="max-width:100%;max-height:100%"></video>`;
  } else if (isAudio) {
    media = `<audio src="${src}" crossorigin="anonymous" controls autoplay style="width:90%"></audio>`;
  }

  const winId = opts.forceId || `media-${Date.now()}`;
  const createOptions = {
    icon,
    autoMount: false,
    skipAutoSetup: true
  };
  if (opts.forceId) {
    createOptions.forceId = opts.forceId;
  }
  if (typeof opts.x === "number" && typeof opts.y === "number") {
    createOptions.position = { x: opts.x, y: opts.y };
  }
  const win = os.window.create(winId, name, width, height, createOptions);
  win.dataset.appId = "mediaViewer";
  win.dataset.fileName = name;
  win.dataset.mediaKind = isVideo ? "video" : isAudio ? "audio" : "image";
  if (Array.isArray(opts.path)) {
    win.dataset.filePath = JSON.stringify(opts.path);
  }
  if (typeof storedIcon === "string" && storedIcon.length > 0) {
    win.dataset.storedIcon = storedIcon;
  }

  const headerHtml = `
    <div class="window-header">
      <span><img src="${icon}" style="width:20px;height:20px;margin-right:6px;vertical-align:middle;">${name}</span>
      ${os.window.getWindowControls(icon)}
    </div>
  `;

  if (isImage) {
    win.innerHTML =
      headerHtml +
      `
      <div class="window-content" style="width:100%;height:100%;overflow:hidden;padding:0;">
        <div class="img-viewer-container">
          <img src="${src}" style="opacity:0;">
          <div class="img-viewer-controls">
            <button class="img-zoom-out" title="Zoom Out">${viewerIcon("papirus:actions/zoom-out", 14)}</button>
            <button class="img-zoom-in" title="Zoom In">${viewerIcon("papirus:actions/zoom-in", 14)}</button>
          </div>
          <div class="img-viewer-fullscreen">
            <button class="img-fullscreen-btn" title="Fullscreen">${viewerIcon("papirus:actions/view-fullscreen", 14)}</button>
          </div>
        </div>
      </div>
    `;
  } else {
    win.innerHTML =
      headerHtml +
      `
      <div class="window-content" style="width:100%;height:100%;overflow:hidden;">
        <div style="display:flex;justify-content:center;align-items:center;height:100%;background:var(--bg-primary);">
          ${media}
        </div>
      </div>
    `;
  }

  const desktop = $("#desktop");
  if (desktop) desktop.appendChild(win);
  os.window.setupWindowControls(win);
  os.window.makeDraggable(win);
  os.window.makeResizable(win);
  os.window.addToTaskbar(win.id, name, icon);
  os.window.focus(win);
  requestAnimationFrame(() => (win.style.opacity = ""));

  if (isImage) setupImageViewer(win);

  if (isVideo || isAudio) {
    const mediaEl = $("video, audio", win);
    if (mediaEl) mediaEl.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  return win;
}

function base64ToBlob(dataURL) {
  const [header, b64] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

function getContentSize(content) {
  if (!content) return 0;
  if (typeof content === "string") return new Blob([content]).size;
  if (content instanceof Blob) return content.size;
  if (content instanceof ArrayBuffer) return content.byteLength;
  return 0;
}

async function confirmLargeFile(name, size) {
  const sizeStr = formatSize(size);
  return os.dialog.confirm(
    "Large File Warning",
    `The file "${name}" is quite large (${sizeStr}).\n\nOpening it in Notepad may cause performance issues.\n\nDo you want to continue?`,
    "Continue",
    "Cancel"
  );
}

async function openExecutable(name, path) {
  try {
    if (getExt(name) === "exe") {
      const boxedWineApp = os.app.getInstance(ServiceKeys.BOXEDWINE);
      if (boxedWineApp) {
        boxedWineApp.open({ path, name });
        return;
      }
    }
    const jsDosApp = os.app.getInstance(ServiceKeys.JSDOS);
    if (jsDosApp) jsDosApp.launchExe(name, path);
  } catch (err) {
    console.error("[FileDisplay] openExecutable error:", err);
  }
}

async function openSwfFile(name, path) {
  try {
    const ruffleApp = os.app.getInstance(ServiceKeys.RUFFLE);
    if (!ruffleApp) return;
    let arrayBuffer = null;

    const blob = await os.fs.readBinaryFile(path, name);
    if (blob && blob.size > 0) {
      arrayBuffer = await blob.arrayBuffer();
    } else {
      const content = await os.fs.getFileContent(path, name);
      if (content instanceof Blob && content.size > 0) {
        arrayBuffer = await content.arrayBuffer();
      } else if (content instanceof ArrayBuffer && content.byteLength > 0) {
        arrayBuffer = content;
      } else if (typeof content === "string" && content) {
        arrayBuffer = content.startsWith("data:")
          ? await base64ToBlob(content).arrayBuffer()
          : Uint8Array.from(content, (c) => c.charCodeAt(0)).buffer;
      }
    }

    if (!arrayBuffer) return;
    const displayName = name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    ruffleApp.launchRuffle(displayName, name, arrayBuffer);
  } catch (err) {
    console.error("[FileDisplay] openSwfFile error:", err);
  }
}

async function openRomFile(name, path) {
  try {
    const emulatorApp = os.app.getInstance(ServiceKeys.EMULATOR);
    if (emulatorApp) {
      emulatorApp.launchROM(name, path);
    } else {
      os.dialog.alert("Can't Open", "ROM emulation isn't available right now.");
    }
  } catch (err) {
    console.error("[FileDisplay] openRomFile error:", err);
  }
}

export async function openMediaFile(name, path, opts = {}) {
  try {
    const ext = getExt(name);

    const kind = isVideoFile(name) ? FileKind.VIDEO : isAudioFile(name) ? FileKind.AUDIO : FileKind.IMAGE;

    const mime = isAudioFile(name)
      ? mimeFromName(name)
      : isVideoFile(name)
        ? (VIDEO_MIME_MAP[getExt(name)] ?? "application/octet-stream")
        : (IMAGE_MIME_MAP[ext] ?? "application/octet-stream");

    const getMediaSrc = async (b) => {
      const typedBlob = b.type ? b : new Blob([b], { type: mime });
      return await readFileAsDataURL(typedBlob);
    };

    const storedIcon = await os.fs.getFileIcon([...path, name]);

    const blob = await os.fs.readBinaryFile(path, name);
    if (blob && blob.size > 0) {
      openMediaViewer(name, await getMediaSrc(blob), kind, storedIcon, {
        path,
        forceId: opts.forceId,
        width: opts.width,
        height: opts.height,
        x: opts.x,
        y: opts.y
      });
      return;
    }
    const content = await os.fs.getFileContent(path, name);
    if (content instanceof Blob && content.size > 0) {
      openMediaViewer(name, await getMediaSrc(content), kind, storedIcon, {
        path,
        forceId: opts.forceId,
        width: opts.width,
        height: opts.height,
        x: opts.x,
        y: opts.y
      });
      return;
    }
    if (typeof content === "string" && content) {
      let src;
      if (content.startsWith("http") || content.startsWith("/") || content.startsWith("data:")) {
        src = content;
      } else {
        const typedBlob = new Blob([Uint8Array.from(content, (c) => c.charCodeAt(0))], { type: mime });
        src = await getMediaSrc(typedBlob);
      }
      openMediaViewer(name, src, kind, storedIcon, {
        path,
        forceId: opts.forceId,
        width: opts.width,
        height: opts.height,
        x: opts.x,
        y: opts.y
      });
    }
  } catch (err) {
    console.error("[FileDisplay] openMediaFile error:", err);
  }
}

async function openOfficeFile(name, path) {
  try {
    const officeApp = os.app.getInstance(ServiceKeys.OFFICE);
    const notepadApp = os.app.getInstance(ServiceKeys.NOTEPAD);
    if (!officeApp) {
      const content = await os.fs.getFileContent(path, name);
      notepadApp.open(name, content, path);
      return;
    } else {
      const blob = await os.fs.readBinaryFile(path, name);
      if (blob && blob.size > 0) {
        officeApp.loadContent(name, await blob.arrayBuffer(), path);
      } else {
        officeApp.loadContent(name, await os.fs.getFileContent(path, name), path);
      }
      return;
    }
  } catch (err) {
    console.error("[FileDisplay] openOfficeFile error:", err);
  }
}

async function openMarkdown(name, path, content) {
  try {
    const markdownApp = os.app.getInstance(ServiceKeys.MARKDOWN);
    const notepadApp = os.app.getInstance(ServiceKeys.NOTEPAD);
    if (markdownApp) {
      markdownApp.open(name, content, path);
    } else {
      notepadApp.open(name, content, path);
    }
  } catch (err) {
    console.error("[FileDisplay] openMarkdown error:", err);
  }
}

async function openHtmlFile(name, path, content) {
  try {
    const browserApp = os.app.getInstance(ServiceKeys.BROWSER);
    const notepadApp = os.app.getInstance(ServiceKeys.NOTEPAD);
    if (browserApp) {
      browserApp.openHtml(content, name, path);
    } else {
      notepadApp.open(name, content, path);
    }
  } catch (err) {
    console.error("[FileDisplay] openHtmlFile error:", err);
  }
}

async function openTextFile(name, path, content) {
  try {
    const notepadApp = os.app.getInstance(ServiceKeys.NOTEPAD);
    const size = getContentSize(content);
    if (size > LARGE_FILE_THRESHOLD) {
      const confirmed = await confirmLargeFile(name, size);
      if (!confirmed) return;
    }
    notepadApp.open(name, content, path);
  } catch (err) {
    console.error("[FileDisplay] openTextFile error:", err);
  }
}

async function readFontBlob(name, path) {
  const blob = await os.fs.readBinaryFile(path, name);
  if (blob && blob.size) return blob;
  const content = await os.fs.getFileContent(path, name);
  if (content instanceof Blob && content.size) return content;
  if (typeof content === "string" && content) {
    if (content.startsWith("data:") || content.startsWith("http://") || content.startsWith("https://")) {
      try {
        const resp = await fetch(content);
        if (resp.ok) return resp.blob();
      } catch {}
    }
    const bytes = Uint8Array.from(content, (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: "application/octet-stream" });
  }
  return null;
}

async function openFontFile(name, path) {
  try {
    const blob = await readFontBlob(name, path);
    if (!blob || !blob.size) return os.dialog.alert("Error", "Could not read font file");
    const ext = getExt(name);
    const formatMap = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };
    const format = formatMap[ext] || "truetype";
    const fontFamily = name.replace(/\.[^.]+$/, "");
    const fontUrl = URL.createObjectURL(blob);

    const style = createElement("style");
    style.id = "font-preview-" + Date.now();
    style.textContent = `@font-face { font-family: 'FontPreview'; src: url('${fontUrl}') format('${format}'); }`;
    document.head.appendChild(style);

    const winId = `font-preview-${Date.now()}`;
    const win = os.window.create(winId, name, "550px", "480px", {
      icon: getEffectiveIcon("papirus:mimetypes/application-x-font-ttf")
    });

    const contentEl = win.querySelector(".window-content");
    if (contentEl) {
      contentEl.style.padding = "20px";
      contentEl.style.overflowY = "auto";
    }
    (contentEl || win).innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-family:'FontPreview';font-size:64px;line-height:1.2;color:var(--text-primary);padding:20px 0;">
          Aa Bb
        </div>
        <div style="font-family:'FontPreview';font-size:28px;line-height:1.3;color:var(--text-primary);">
          The quick brown fox jumps over the lazy dog.
        </div>
      </div>
      <div style="border-bottom:1px solid var(--glass-border);margin:16px 0;"></div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:13px;">
        <span style="opacity:0.6;">Family:</span><span>${fontFamily}</span>
        <span style="opacity:0.6;">Format:</span><span>${format}</span>
        <span style="opacity:0.6;">Size:</span><span>${formatSize(blob.size)}</span>
      </div>
      <div style="border-bottom:1px solid var(--glass-border);margin:16px 0;"></div>
      <div style="font-family:'FontPreview';font-size:18px;line-height:1.6;color:var(--text-secondary);">
        <div style="font-size:36px;margin-bottom:8px;">Aa Bb Cc Dd Ee Ff Gg</div>
        <div style="font-size:24px;margin-bottom:8px;">Hh Ii Jj Kk Ll Mm Nn Oo Pp</div>
        <div style="font-size:18px;margin-bottom:8px;">Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz</div>
        <div style="font-size:14px;">0123456789 !@#$%^&amp;*() {}[] &lt;&gt;?/</div>
      </div>`;
  } catch (err) {
    console.error("[FileDisplay] openFontFile error:", err);
    os.dialog.alert("Error", "Failed to open font file");
  }
}

function isShortcutName(fileName) {
  return fileName.toLowerCase().endsWith(".shortcut.json");
}

function parseShortcutPayload(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function openShortcutTarget(name, path) {
  const raw = await os.fs.getFileContent(path, name);
  const text = typeof raw === "string" ? raw : null;
  const payload = text ? parseShortcutPayload(text) : null;
  if (!payload || !payload.targetPath) throw new Error("invalid shortcut");
  const parts = String(payload.targetPath).split("/").filter(Boolean);
  const targetName = payload.targetName || parts[parts.length - 1];
  const targetDir = parts.slice(0, -1);
  let entries = null;
  try {
    entries = await os.fs.readdir(targetDir);
  } catch {}
  const entry = entries ? entries[targetName] : null;
  if (entry && entry.type !== "file") {
    const explorerApp = os.app.getInstance(ServiceKeys.EXPLORER);
    if (explorerApp && explorerApp.open) explorerApp.open(targetDir.concat(targetName));
    return;
  }
  await openFileWith({ name: targetName, path: targetDir });
}

export async function openFileWith({ name, path }) {
  try {
    if (isShortcutName(name)) {
      try {
        await openShortcutTarget(name, path);
      } catch {
        os.dialog.alert("Shortcut", "Shortcut target is not available");
      }
      return;
    }
    if (isZipFile(name)) return;
    if (name.toLowerCase().endsWith(".img")) {
      const v86App = os.app.getInstance(ServiceKeys.V86);
      if (v86App?.launchImage) {
        v86App.launchImage(name, path);
      } else {
        os.app.launch("v86");
      }
      return;
    }
    if (isISOFile(name)) {
      try {
        const mountPoint = await os.fs.mountISO(path, name);
        if (mountPoint) os.events.emit("iso:mounted", { mountPoint, path, name });
      } catch (e) {
        os.notify.send("Disc Image", `Failed to mount "${name}": ${e.message}`, { type: "error" });
      }
      return;
    }
    trackRecentFile(name, path);

    const defaultApp = getDefaultApp(name);
    if (defaultApp) {
      const handled = await openFileWithApp(defaultApp.appId, { name, path });
      if (handled) return;
    }

    if (isUnassociated(name)) {
      const { showChooseAppDialog } = await import("./shared/chooseAppDialog.js");
      await showChooseAppDialog({ ext: getExt(name), name, path });
      return;
    }

    if (
      isExeFile(name) ||
      name.toLowerCase().endsWith(".jsdos") ||
      name.toLowerCase().endsWith(".com") ||
      name.toLowerCase().endsWith(".bat")
    )
      return openExecutable(name, path);
    if (isSwfFile(name)) return openSwfFile(name, path);
    if (isRomFile(name)) return openRomFile(name, path);
    if (isVideoFile(name) || isAudioFile(name) || isImageFile(name)) return openMediaFile(name, path);
    if (isOfficeFile(name)) return openOfficeFile(name, path);
    if (isFontFile(name)) return openFontFile(name, path);

    const content = await os.fs.getFileContent(path, name);

    if (isMarkdownFile(name)) return openMarkdown(name, path, content);
    if (isHtmlFile(name)) return openHtmlFile(name, path, content);
    return openTextFile(name, path, content);
  } catch (err) {
    console.error("[FileDisplay] openFileWith error:", err);
    os.notify.send("File Display", `Failed to open ${name}`, { type: "error" });
  }
}

export async function openFileWithApp(appId, { name, path }) {
  try {
    switch (appId) {
      case "mediaViewer":
        await openMediaFile(name, path);
        return true;
      case "fontViewer":
        await openFontFile(name, path);
        return true;
      case "browserApp":
        await openHtmlFile(name, path, await os.fs.getFileContent(path, name));
        return true;
      case "markdownApp":
        await openMarkdown(name, path, await os.fs.getFileContent(path, name));
        return true;
      case "notepadApp":
        await openTextFile(name, path, await os.fs.getFileContent(path, name));
        return true;
      case "monacoApp": {
        const monacoApp = os.app.getInstance(ServiceKeys.MONACO);
        if (monacoApp?.open) {
          monacoApp.open(name, await os.fs.getFileContent(path, name), path);
          return true;
        }
        return false;
      }
      case "officeApp":
        await openOfficeFile(name, path);
        return true;
      case "emulatorApp":
        await openRomFile(name, path);
        return true;
      case "jsDosApp":
        await openExecutable(name, path);
        return true;
      case "boxedWineApp": {
        const boxedWineApp = os.app.getInstance(ServiceKeys.BOXEDWINE);
        if (boxedWineApp?.open) {
          boxedWineApp.open({ path, name });
          return true;
        }
        return false;
      }
      case "ruffleApp":
        await openSwfFile(name, path);
        return true;
      case "v86app": {
        const v86App = os.app.getInstance(ServiceKeys.V86);
        if (v86App?.launchImage) {
          v86App.launchImage(name, path);
          return true;
        }
        return false;
      }
      default:
        if (os.app.hasApp(appId)) {
          os.app.launch(appId, { fileName: name, filePath: path, title: name });
          return true;
        }
        return false;
    }
  } catch (err) {
    console.error("[FileDisplay] openFileWithApp error:", err);
    os.notify.send("File Display", `Failed to open ${name} with ${appId}`, { type: "error" });
    return false;
  }
}

function resolveDesktopIconFromDOM(name) {
  const label = name.replace(/\.desktop$/i, "");
  const desktop = $("#desktop");
  if (!desktop) return null;
  const iconEl = desktop.querySelector(
    `.icon.selectable[data-file-name="${CSS.escape(name)}"], .icon.selectable[data-folder-name="${CSS.escape(name)}"]`
  );
  if (iconEl) {
    const img = iconEl.querySelector("img");
    if (img) return img.getAttribute("src") || null;
    const faIcon = iconEl.querySelector("i");
    if (faIcon) return faIcon.className;
    return null;
  }
  const labelIcon = Array.from(desktop.querySelectorAll(".icon.selectable")).find(
    (el) => el.querySelector("div, span")?.textContent?.trim() === label
  );
  if (labelIcon) {
    const img = labelIcon.querySelector("img");
    if (img) return img.getAttribute("src") || null;
    const faIcon = labelIcon.querySelector("i");
    if (faIcon) return faIcon.className;
  }
  return null;
}

function stripext(name) {
  return SHORTCUT_EXTS.some((ext) => name.toLowerCase().endsWith(`.${ext}`))
    ? name.slice(0, name.lastIndexOf("."))
    : name;
}

export async function showFileProperties(path, name, isFolder, onRename = null) {
  try {
    const displayLabel = isFolder ? name : stripext(name);
    let iconSrc;
    if (isFolder) {
      iconSrc = getEffectiveIcon("papirus:places/folder-blue");
    } else {
      const domIcon = resolveDesktopIconFromDOM(name);
      iconSrc =
        domIcon &&
        !domIcon.startsWith("fa") &&
        !domIcon.startsWith("papirus:") &&
        !domIcon.startsWith("http") &&
        !domIcon.startsWith("data:")
          ? resolveIconUrl(domIcon)
          : domIcon || resolveFileIcon(name);
    }
    let contents = "";
    let size;
    if (isFolder) {
      const { size: totalSize, files: fileCount, dirs: folderCount } = await os.fs.calcDirSize(path);
      const parts = [];
      if (fileCount > 0) parts.push(`${fileCount} File${fileCount !== 1 ? "s" : ""}`);
      if (folderCount > 0) parts.push(`${folderCount} Folder${folderCount !== 1 ? "s" : ""}`);
      contents = parts.join(", ") || "Empty";
      size = totalSize > 0 ? formatSize(totalSize) : "Empty";
    } else {
      size = await getItemSize(path);
    }
    const kind = fileKindFromName(name);
    const ext = name.split(".").pop().toLowerCase();
    let type = isFolder ? "Folder" : kind;

    if (!isFolder) {
      const extLabels = {
        json: "JSON",
        js: "JavaScript",
        ts: "TypeScript",
        jsx: "JSX",
        tsx: "TSX",
        css: "CSS",
        xml: "XML",
        yaml: "YAML",
        yml: "YAML",
        ini: "INI",
        cfg: "Config",
        log: "Log",
        sh: "Shell Script",
        bash: "Shell Script",
        zsh: "Shell Script",
        rtf: "Rich Text",
        py: "Python",
        rb: "Ruby",
        rs: "Rust",
        go: "Go",
        java: "Java",
        cpp: "C++",
        c: "C",
        h: "Header",
        hpp: "C++ Header",
        md: "Markdown",
        csv: "CSV",
        sql: "SQL",
        toml: "TOML",
        html: "HTML",
        htm: "HTML"
      };

      if (kind === FileKind.TEXT) {
        type = extLabels[ext] || "Text";
      } else if (kind === FileKind.IMAGE) {
        type = "Image";
      } else if (kind === FileKind.VIDEO) {
        type = "Video";
      } else if (kind === FileKind.AUDIO) {
        type = "Audio";
      } else if (kind === FileKind.ROM) {
        type = "ROM";
      } else if (kind === FileKind.FONT) {
        type = "Font";
      } else if (isShortcutFile(name)) {
        type = "Shortcut";
      } else {
        type = "File";
      }
    }
    const location = Array.isArray(path) ? path.join("/") : path;
    const modified = await getModifiedDate(path);

    const title = `Properties: ${displayLabel}`;
    const propsWin = os.window.create(`${Date.now()}-props`, title, "400px", "auto");

    propsWin.innerHTML = `
      <div class="window-header"><span>${title}</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content" style="padding:20px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          ${
            iconSrc.startsWith("papirus:")
              ? `<img src="${resolveIconUrl(iconSrc)}" style="width:48px;height:48px;object-fit:contain;padding:4px;background:var(--surface-1);border:1px solid var(--glass-border);border-radius:6px;">`
              : iconSrc.startsWith("fa")
                ? `<i class="${iconSrc}" style="font-size:34px;color:var(--brand);width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:var(--surface-1);border:1px solid var(--glass-border);border-radius:6px;"></i>`
                : `<img src="${resolveIconUrl(iconSrc)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`
          }
          <div style="flex:1;">
            <input id="props-rename-input" type="text" value="${displayLabel}" style="font-size:18px;font-weight:600;padding:4px;border-radius:6px;border:1px solid var(--glass-border);background:var(--glass);color:inherit;width:100%;">
            <div style="opacity:0.7;font-size:13px;margin-top:4px;">${type}</div>
          </div>
        </div>

        <div style="border-bottom:1px solid var(--glass-border);margin-bottom:16px;"></div>

        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;opacity:0.9;">Details</div>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;font-size:13px;">
            <div style="opacity:0.7;">Type:</div><div>${type}</div>
            <div style="opacity:0.7;">Location:</div><div>${location}</div>
            <div style="opacity:0.7;">Size:</div><div>${size}</div>
            ${isFolder ? `<div style="opacity:0.7;">Contents:</div><div>${contents}</div>` : ""}
            <div style="opacity:0.7;">Modified:</div><div>${modified}</div>
          </div>
        </div>
      </div>
    `;

    const renameInput = propsWin.querySelector("#props-rename-input");

    renameInput.onkeydown = async (e) => {
      if (e.key === "Enter") {
        const newName = renameInput.value.trim();
        const shortcutExt = SHORTCUT_EXTS.find((e) => name.toLowerCase().endsWith(`.${e}`));
        const targetName = shortcutExt ? `${newName}.${shortcutExt}` : newName;
        if (!newName || targetName === name) return;

        try {
          await os.fs.rename(path.slice(0, -1), name, targetName);
          os.window.close(propsWin);
          if (onRename) onRename();
        } catch (err) {
          os.dialog.alert("Error", err.message || "Failed to rename");
        }
      }
    };
  } catch (err) {
    console.error("Properties error:", err);
    os.dialog.alert("Error", "Failed to show properties");
  }
}

async function getItemSize(path) {
  try {
    const pathStr = Array.isArray(path) ? path.join("/") : path;
    const dirPath = pathStr.substring(0, pathStr.lastIndexOf("/")) || "";
    const fileName = pathStr.substring(pathStr.lastIndexOf("/") + 1);

    const meta = await os.fs.getMetadata(dirPath, fileName);
    if (meta.size !== undefined && meta.size !== null) {
      return formatSize(meta.size);
    }

    const text = await os.fs.read(path);
    if (typeof text === "string" && text) {
      return formatSize(new Blob([text]).size);
    }
    const content = await os.fs.read(path, { encoding: "binary" });
    const bytes = content instanceof Uint8Array ? content.length : new Blob([content]).size;
    return formatSize(bytes);
  } catch {
    return "Unknown";
  }
}

async function getModifiedDate(path) {
  try {
    return new Date().toLocaleString();
  } catch {
    return "Unknown";
  }
}

export function decodeDataURLContent(content) {
  if (!content) return "";
  if (content.startsWith("data:")) {
    try {
      const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match && base64Match[1]) return atob(base64Match[1]);
      const plainMatch = content.match(/^data:[^,]+,(.+)$/);
      if (plainMatch && plainMatch[1]) return decodeURIComponent(plainMatch[1]);
    } catch (err) {
      return content;
    }
  }
  return content;
}

export function generateThumbnail(src, maxDimension = 128) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= maxDimension && height <= maxDimension) {
        resolve(src);
        return;
      }
      try {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        const canvas = createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    if (src instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(src);
      reader.readAsDataURL(src);
    } else {
      img.src = src;
    }
  });
}
