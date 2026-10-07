import { zipSync, unzipSync } from "fflate";
import { BaseApp, os, StorageKeys, ServiceKeys, $, $$, createElement } from "../framework.js";
import { showAboutDialog } from "../shared/aboutDialog.js";
import { CDN_BASES } from "../shared/assetResolver.js";

const CDN_BASE_URL = `${CDN_BASES.MAIN}/static/apps/boxedwine`;
const LIB_FILES = ["browserfs.boxedwine.js", "boxedwine-shell.js", "boxedwine.js"];
const EXE_SUFFIX = ".exe";
const ZIP_SUFFIX = ".zip";
const FALLBACK_DIR = "Games";
const WIN_ID = "boxedwine-win";
const CANVAS_ID = "boxedWineCanvas";
const RESOLUTION = "800x600";
const ROOT_ZIP = "/fullWine1.7.55-v8";
const ROOT_ZIP_PARTS = ["fullWine1.7.55-v8.part1", "fullWine1.7.55-v8.part2", "fullWine1.7.55-v8.part3"];
const ROOT_ZIP_TOTAL_SIZE = 50012741;
const OVERLAY_ZIP = "/wine1.7.55-v8-min-online";
const BOXEDWINE_STYLE_ID = "boxedwine-style";
const BOXEDWINE_CSS = `
.boxedwine-root{display:flex;flex-direction:column;height:100%;gap:8px;padding:8px;background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box}
.boxedwine-log{max-height:96px;overflow-y:auto;font-size:12px;color:var(--text-primary)}
.boxedwine-log-line{font-size:12px;color:var(--text-primary)}
.boxedwine-stage{flex:1;min-height:0;overflow:hidden;background:var(--bg-primary)}
.boxedwine-section{width:100%;height:100%;margin:0;padding:0;display:block}
.boxedwine-canvas{width:100%;height:100%;display:block}
canvas[style*="cursor: none;"]{cursor:default !important}
`;

let libsPromise = null;

async function resolveBaseUrl() {
  return CDN_BASE_URL;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadBoxedWineLibs(baseUrl) {
  if (!libsPromise) {
    libsPromise = (async () => {
      for (const file of LIB_FILES.slice(0, 2)) {
        await loadScript(`${baseUrl}/${file}`);
      }
      window.Module = window.Module || {};
      window.Module.locateFile = (path) => `${baseUrl}/${String(path).split("/").pop()}`;
      await loadScript(`${baseUrl}/${LIB_FILES[2]}`);
    })();
  }
  return libsPromise;
}

async function fetchRootZipData(baseUrl, onPart) {
  const target = new Uint8Array(ROOT_ZIP_TOTAL_SIZE);
  let offset = 0;
  for (let index = 0; index < ROOT_ZIP_PARTS.length; index++) {
    const response = await fetch(`${baseUrl}/${ROOT_ZIP_PARTS[index]}`);
    if (!response.ok) throw new Error(`Failed to load ${ROOT_ZIP_PARTS[index]} (${response.status})`);
    const chunk = new Uint8Array(await response.arrayBuffer());
    target.set(chunk, offset);
    offset += chunk.length;
    if (onPart) onPart(index + 1, ROOT_ZIP_PARTS.length);
  }
  if (offset !== ROOT_ZIP_TOTAL_SIZE) throw new Error("Wine filesystem size mismatch after joining parts");
  return target;
}

function bytesToBase64(bytes) {
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function largestExeInZip(bytes) {
  const entries = Object.entries(unzipSync(bytes));
  const matches = entries.filter(([entryName]) => entryName.toLowerCase().endsWith(EXE_SUFFIX));
  matches.sort(([, aBytes], [, bBytes]) => bBytes.length - aBytes.length);
  const [entryName] = matches[0] || [];
  return entryName ? entryName.split("/").pop() : null;
}

export class BoxedWineApp extends BaseApp {
  constructor(services) {
    super(services);
    this.booted = false;
    this.booting = false;
  }

  async open(opts = {}) {
    if (await this.isSingletonOpen(WIN_ID)) {
      const target = this.resolveTarget(opts);
      if (target) await this.bootInto(target.dir, target.name);
      return;
    }
    const win = os.window.create(WIN_ID, "BoxedWine", "860px", "620px", {
      icon: "fas fa-wine-glass",
      appId: "boxedWineApp"
    });
    this.trackWindow(WIN_ID, win);
    const styleTag = $(`#${BOXEDWINE_STYLE_ID}`) ? "" : `<style id="${BOXEDWINE_STYLE_ID}">${BOXEDWINE_CSS}</style>`;
    win.innerHTML = `${styleTag}
      <div class="boxedwine-root">
        <div class="app-menubar">
          <div class="app-menubar-item" data-menu="file">
            <span>File</span>
            <div class="notepad-dropdown">
              <div class="dropdown-item" data-action="open">Open file...</div>
              <div class="dropdown-separator"></div>
              <div class="dropdown-item" data-action="exit">Exit</div>
            </div>
          </div>
          <div class="app-menubar-item" data-menu="help">
            <span>Help</span>
            <div class="notepad-dropdown">
              <div class="dropdown-item" data-action="about">About BoxedWine</div>
            </div>
          </div>
        </div>
        <div id="${WIN_ID}-log" class="boxedwine-log"></div>
        <div id="${WIN_ID}-stage" class="boxedwine-stage"></div>
      </div>
    `;
    win.classList.add("notepad-window");
    win.addEventListener("remove", () => this.cleanupRunner());
    this.setupMenus(win);
    const target = this.resolveTarget(opts);
    if (target) {
      await this.loadTarget(target.dir, target.name, win);
      return;
    }
    const last = os.storage.get(StorageKeys.boxedWineLastApp);
    if (last && last.name) {
      await this.loadTarget(last.dir || FALLBACK_DIR, last.name, win);
      return;
    }
    this.appendLog(win, "BoxedWine ready. Open an EXE or ZIP file.");
  }

  resolveTarget(opts) {
    if (!opts) return null;
    if (typeof opts === "string") {
      if (!opts) return null;
      return this.splitFullPath(opts);
    }
    if (opts.path !== undefined && opts.name) {
      return { dir: opts.path, name: opts.name };
    }
    if (opts.name && opts.path === undefined) {
      return { dir: FALLBACK_DIR, name: opts.name };
    }
    if (typeof opts.path === "string" && !opts.name) {
      const lower = opts.path.toLowerCase();
      if (lower.endsWith(EXE_SUFFIX) || lower.endsWith(ZIP_SUFFIX)) {
        return this.splitFullPath(opts.path);
      }
      return null;
    }
    if (typeof opts.file === "string" && opts.file) {
      return this.splitFullPath(opts.file);
    }
    return null;
  }

  splitFullPath(full) {
    const sep = full.lastIndexOf("/");
    if (sep < 0) return { dir: FALLBACK_DIR, name: full };
    return { dir: full.slice(0, sep) || FALLBACK_DIR, name: full.slice(sep + 1) };
  }

  async chooseFile(win) {
    const explorerApp = os.app.getInstance(ServiceKeys.EXPLORER);
    if (!explorerApp) {
      await os.dialog.alert("BoxedWine", "File browser is unavailable right now.");
      return;
    }
    const picked = await os.dialog.fileOpen({ initialPath: [FALLBACK_DIR] });
    if (!picked || typeof picked !== "string") return;
    const target = this.splitFullPath(picked);
    if (!target.name) return;
    await this.loadTarget(target.dir, target.name, win);
  }

  async bootInto(dir, name) {
    const win = $(`#${WIN_ID}`);
    if (!win) return;
    await this.loadTarget(dir, name, win);
  }

  setupMenus(win) {
    const menuItems = $$(".app-menubar-item", win);
    let activeMenu = null;

    const closeAllMenus = () => {
      menuItems.forEach((m) => m.classList.remove("active"));
      activeMenu = null;
    };

    menuItems.forEach((menuItem) => {
      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menuItem.classList.contains("active")) {
          closeAllMenus();
        } else {
          closeAllMenus();
          menuItem.classList.add("active");
          activeMenu = menuItem;
        }
      });

      menuItem.addEventListener("mouseenter", () => {
        if (activeMenu && activeMenu !== menuItem) {
          closeAllMenus();
          menuItem.classList.add("active");
          activeMenu = menuItem;
        }
      });
    });

    $$(".dropdown-item[data-action]", win).forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleAction(win, item.dataset.action);
        closeAllMenus();
      });
    });

    const closeHandler = (e) => {
      if (!win.contains(e.target)) closeAllMenus();
    };
    document.addEventListener("click", closeHandler);
    win.addEventListener("remove", () => document.removeEventListener("click", closeHandler));
  }

  handleAction(win, action) {
    if (action === "open") this.chooseFile(win);
    else if (action === "exit") os.window.close(win);
    else if (action === "about") this.showAboutDialog();
  }

  showAboutDialog() {
    showAboutDialog({
      title: "BoxedWine",
      version: "1.7.55",
      description: "Run 16 and 32 bit Windows apps in your browser.",
      icon: "fas fa-wine-glass",
      iconType: "fontawesome"
    });
  }

  async loadTarget(dir, name, win) {
    const lower = name.toLowerCase();
    if (!lower.endsWith(EXE_SUFFIX) && !lower.endsWith(ZIP_SUFFIX)) {
      await os.dialog.alert("BoxedWine", "BoxedWine opens EXE and ZIP files only.");
      return;
    }
    if (this.booted || this.booting) {
      await os.dialog.alert("BoxedWine", "BoxedWine is already running. Close the window to run a different file.");
      return;
    }
    this.booting = true;
    try {
      await this.bootExe(dir, name, win);
    } finally {
      this.booting = false;
    }
  }

  async bootExe(dir, name, win) {
    this.appendLog(win, `Reading ${name}`);
    let blob = null;
    try {
      blob = await os.fs.readBinaryFile(dir, name);
    } catch (blobErr) {
      blob = null;
    }
    if (!blob || blob.size === 0) {
      this.appendLog(win, `Could not read ${name}`);
      await os.dialog.alert("BoxedWine", `Could not read ${name} from storage.`);
      return;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const lower = name.toLowerCase();
    let payloadBytes = null;
    let exeName = null;
    if (lower.endsWith(ZIP_SUFFIX)) {
      this.appendLog(win, `Scanning ${name} for the largest EXE`);
      try {
        exeName = largestExeInZip(bytes);
      } catch (zipErr) {
        exeName = null;
      }
      if (!exeName) {
        await os.dialog.alert("BoxedWine", "No EXE found inside this ZIP. Choose an EXE directly.");
        return;
      }
      payloadBytes = bytes;
    } else {
      payloadBytes = zipSync({ [name]: bytes });
      exeName = name;
    }
    this.appendLog(win, "Loading emulator libraries");
    let baseUrl = null;
    try {
      baseUrl = await resolveBaseUrl();
      await loadBoxedWineLibs(baseUrl);
    } catch (libErr) {
      this.appendLog(win, "Could not load emulator libraries");
      await os.dialog.alert("BoxedWine", "Could not load the emulator libraries.");
      libsPromise = null;
      return;
    }
    const urlParams = [
      `inline-default-ondemand-root-overlay=${OVERLAY_ZIP}`,
      `resolution=${RESOLUTION}`,
      `root=${ROOT_ZIP}`,
      `app-payload=${bytesToBase64(payloadBytes)}`,
      `p=${exeName.split(" ").join("%20")}`
    ].join("&");
    this.appendLog(win, "Loading Wine filesystem");
    let rootZipData = null;
    try {
      rootZipData = await fetchRootZipData(baseUrl, (done, total) =>
        this.appendLog(win, `Loading Wine filesystem (${done}/${total})`)
      );
    } catch (partErr) {
      this.appendLog(win, "Could not load Wine filesystem");
      await os.dialog.alert("BoxedWine", "Could not load the Wine filesystem.");
      libsPromise = null;
      return;
    }
    window.BoxedWineConfig = {
      ...(window.BoxedWineConfig || {}),
      consoleLog: (log) => this.appendLog(win, String(log)),
      urlParams
    };
    window.BoxedWineConfig.rootZipData = rootZipData;
    window.BoxedWineConfig.locateRootBaseUrl = baseUrl;
    window.BoxedWineConfig.locateAppBaseUrl = baseUrl;
    window.BoxedWineConfig.locateOverlayBaseUrl = baseUrl;
    os.storage.set(StorageKeys.boxedWineLastApp, { dir, name });
    this.showCanvas(win, name);
    os.window.setTitle(WIN_ID, `BoxedWine - ${name}`);
    this.appendLog(win, `Booting ${exeName} with BoxedWine`);
    try {
      window.BoxedWineShell(() => {
        this.booted = true;
        this.appendLog(win, "BoxedWine is ready");
      });
    } catch (bootErr) {
      this.appendLog(win, `Boot failed: ${bootErr.message || bootErr}`);
    }
  }

  showCanvas(win, name) {
    const stage = $(`#${WIN_ID}-stage`, win);
    if (!stage) return;
    stage.innerHTML = "";
    const section = createElement("section");
    section.className = "boxedwine-section";
    const canvas = createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.className = "boxedwine-canvas";
    canvas.setAttribute("aria-label", `BoxedWine ${name}`);
    section.appendChild(canvas);
    stage.appendChild(section);
    const log = $(`#${WIN_ID}-log`, win);
    if (log) log.style.display = "none";
  }

  appendLog(win, message) {
    const log = $(`#${WIN_ID}-log`, win);
    if (!log) return;
    const line = createElement("div");
    line.className = "boxedwine-log-line";
    line.textContent = message;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  cleanupRunner() {
    try {
      if (window.BoxedWineConfig) window.BoxedWineConfig.isRunning = false;
    } catch {}
    this.booted = false;
    this.booting = false;
    this.untrackWindow(WIN_ID);
  }

  onClose(winId) {
    this.cleanupRunner(winId);
  }
}
