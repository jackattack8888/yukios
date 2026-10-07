import "../styles/magnifier.css";
import { $, setStyle, createElement } from "../shared/domUtils.js";
import { BaseApp } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
import { createMagnifierEngine } from "../shared/magnifierEngine.js";

export class MagnifierApp extends BaseApp {
  constructor(services) {
    super(services);
    this.panel = null;
    this.engine = createMagnifierEngine();
    this.registerGlobalShortcut();
  }

  registerGlobalShortcut() {
    const handler = (e) => {
      if (e.target.closest("input, textarea, [contenteditable]")) return;
      if (KeybindManager.matches(e, "global.magnifier")) {
        e.preventDefault();
        if (this.panel) this.close();
        else this.open();
      }
    };
    document.addEventListener("keydown", handler);
    this.shortcutHandler = handler;
  }

  open() {
    if (this.panel) return;

    this.panel = createElement("div");
    this.panel.className = "magnifier-panel";
    this.panel.innerHTML = this.buildUI();
    document.body.appendChild(this.panel);
    this.makeDraggable(this.panel);

    const close = createElement("button");
    close.className = "magnifier-close";
    close.innerHTML = '<i class="fas fa-times"></i>';
    close.addEventListener("click", () => this.close());
    this.panel.querySelector(".magnifier-panel-header").appendChild(close);

    this.setupEvents();
    this.engine.start();
  }

  buildUI() {
    return `
      <div class="magnifier-panel-header">
        <span class="magnifier-panel-title">
          <i class="fas fa-search-plus"></i> Magnifier
        </span>
      </div>
      <div class="magnifier-body">
        <div class="magnifier-zoom-row">
          <button class="magnifier-btn" id="magnifier-zoom-out">
            <i class="fas fa-minus"></i>
          </button>
          <span class="magnifier-pct" id="magnifier-zoom-level">200%</span>
          <button class="magnifier-btn" id="magnifier-zoom-in">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="magnifier-hint">Ctrl+M to close</div>
      </div>
    `;
  }

  makeDraggable(el) {
    const header = el.querySelector(".magnifier-panel-header");
    let dragging = false;
    let startX, startY, origX, origY, origRight;

    const onDown = (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      origRight = el.style.right;
      startX = e.clientX;
      startY = e.clientY;
      el.style.right = "auto";
    };

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setStyle(el, { left: origX + dx + "px", top: origY + dy + "px" });
    };

    const onUp = () => {
      dragging = false;
    };

    header.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  setupEvents() {
    if (!this.panel) return;
    this.panel.querySelector("#magnifier-zoom-in").addEventListener("click", () => {
      if (this.engine.zoom < 400) this.setZoom(this.engine.zoom + 25);
    });
    this.panel.querySelector("#magnifier-zoom-out").addEventListener("click", () => {
      if (this.engine.zoom > 100) this.setZoom(this.engine.zoom - 25);
    });
  }

  close() {
    this.engine.stop();
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  setZoom(level) {
    this.engine.setZoom(level);
    const label = $("#magnifier-zoom-level");
    if (label) label.textContent = this.engine.zoom + "%";
  }

  onClose(winId) {
    if (this.shortcutHandler) {
      document.removeEventListener("keydown", this.shortcutHandler);
      this.shortcutHandler = null;
    }
    this.close();
  }
}
