import "../styles/stylusMenu.css";
import { os, ServiceKeys } from "../framework.js";
import { $, $$, bindEvent, createElement, setText, toggleClass } from "../shared/domUtils.js";
import { renderRangeSlider, bindRangeSlider, getRangeSliderValue } from "../shared/rangeSlider.js";
import { createMagnifierEngine } from "../shared/magnifierEngine.js";

let penColor = "red";
let eraserOn = false;
let isDrawing = false;
let canvasEl = null;
let canvasCtx = null;
let strokeActive = false;
let magnifier = null;
let strokeWidth = 3;
let sliderEventsBound = false;
let eraserCursorEl = null;
let bgCanvasEl = null;
let bgObjectUrl = null;
let hasStrokes = false;

function getScreenshotService() {
  try {
    return os.app.getInstance(ServiceKeys.SCREENSHOT);
  } catch {
    return null;
  }
}

function notifyMissing() {
  os.notify.send("Stylus", "Screenshot service unavailable");
}

function doFullScreenshot() {
  const svc = getScreenshotService();
  if (svc && typeof svc.captureFull === "function") {
    svc.captureFull(true);
  } else {
    notifyMissing();
  }
}

function applyPen() {
  if (!canvasCtx) {
    return;
  }

  if (eraserOn) {
    canvasCtx.globalCompositeOperation = "destination-out";
  } else {
    canvasCtx.globalCompositeOperation = "source-over";
    canvasCtx.strokeStyle = penColor;
  }

  canvasCtx.lineCap = "round";
  canvasCtx.lineJoin = "round";
  canvasCtx.lineWidth = strokeWidth;
}

function updateEraserCursor(x, y) {
  if (!eraserCursorEl) {
    return;
  }

  eraserCursorEl.style.display = "block";
  eraserCursorEl.style.width = strokeWidth + "px";
  eraserCursorEl.style.height = strokeWidth + "px";
  eraserCursorEl.style.left = x - strokeWidth / 2 + "px";
  eraserCursorEl.style.top = y - strokeWidth / 2 + "px";
}

function hideEraserCursor() {
  if (!eraserCursorEl) {
    return;
  }

  eraserCursorEl.style.display = "none";
}

function syncEraserCursorMode() {
  toggleClass(canvasEl, "stylus-eraser-active", eraserOn);

  if (!eraserOn) {
    hideEraserCursor();
  }
}

function sizeCanvas() {
  if (!canvasEl || !canvasCtx) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;

  canvasEl.width = window.innerWidth * ratio;
  canvasEl.height = window.innerHeight * ratio;

  canvasCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  applyPen();
}

function onPointerDown(e) {
  if (!canvasCtx) {
    return;
  }

  strokeActive = true;
  hasStrokes = true;

  canvasCtx.beginPath();
  canvasCtx.moveTo(e.clientX, e.clientY);

  try {
    canvasEl.setPointerCapture(e.pointerId);
  } catch {
    strokeActive = true;
  }
}

function onPointerMove(e) {
  if (eraserOn) {
    updateEraserCursor(e.clientX, e.clientY);
  }

  if (!strokeActive || !canvasCtx) {
    return;
  }

  canvasCtx.lineTo(e.clientX, e.clientY);
  canvasCtx.stroke();
}

function onPointerUp() {
  strokeActive = false;
}

function startDraw() {
  if (canvasEl) {
    return;
  }

  hasStrokes = false;

  canvasEl = createElement("canvas", {
    id: "stylus-draw-layer",
    className: "stylus-draw-active"
  });

  document.body.appendChild(canvasEl);

  canvasCtx = canvasEl.getContext("2d");

  sizeCanvas();

  bindEvent(canvasEl, "pointerdown", onPointerDown);
  bindEvent(canvasEl, "pointermove", onPointerMove);
  bindEvent(canvasEl, "pointerup", onPointerUp);
  bindEvent(canvasEl, "pointerleave", hideEraserCursor);

  eraserCursorEl = createElement("div", {
    id: "stylus-eraser-cursor"
  });

  document.body.appendChild(eraserCursorEl);

  isDrawing = true;
}

function stopDraw() {
  strokeActive = false;
  isDrawing = false;

  if (bgCanvasEl && bgCanvasEl.parentNode) {
    bgCanvasEl.parentNode.removeChild(bgCanvasEl);
  }

  bgCanvasEl = null;

  if (bgObjectUrl) {
    URL.revokeObjectURL(bgObjectUrl);
  }

  bgObjectUrl = null;

  if (canvasEl && canvasEl.parentNode) {
    canvasEl.parentNode.removeChild(canvasEl);
  }

  canvasEl = null;
  canvasCtx = null;

  if (eraserCursorEl && eraserCursorEl.parentNode) {
    eraserCursorEl.parentNode.removeChild(eraserCursorEl);
  }

  eraserCursorEl = null;
}

function clearDraw() {
  hasStrokes = false;

  if (!canvasEl || !canvasCtx) {
    return;
  }

  canvasCtx.save();
  canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
  canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  canvasCtx.restore();
}

function paintNoteBackground(img, url) {
  startDraw();

  if (bgCanvasEl && bgCanvasEl.parentNode) {
    bgCanvasEl.parentNode.removeChild(bgCanvasEl);
  }

  if (bgObjectUrl) {
    URL.revokeObjectURL(bgObjectUrl);
  }

  bgObjectUrl = url;

  bgCanvasEl = createElement("canvas", {
    id: "stylus-draw-bg"
  });

  const ratio = window.devicePixelRatio || 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  bgCanvasEl.width = vw * ratio;
  bgCanvasEl.height = vh * ratio;

  const bgCtx = bgCanvasEl.getContext("2d");

  bgCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  bgCtx.fillStyle = "rgba(0, 0, 0, 0.65)";
  bgCtx.fillRect(0, 0, vw, vh);

  const scale = Math.min(vw / img.naturalWidth, vh / img.naturalHeight, 1);

  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;

  const dx = (vw - dw) / 2;
  const dy = (vh - dh) / 2;

  bgCtx.drawImage(img, dx, dy, dw, dh);

  if (canvasEl && canvasEl.parentNode) {
    canvasEl.parentNode.insertBefore(bgCanvasEl, canvasEl);
  } else {
    document.body.appendChild(bgCanvasEl);
  }
}

function onRegion(blob) {
  if (!blob) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const img = new Image();

  bindEvent(img, "load", () => {
    paintNoteBackground(img, url);
  });

  bindEvent(img, "error", () => {
    URL.revokeObjectURL(url);
  });

  img.src = url;
}

function createNote() {
  const svc = getScreenshotService();

  if (!svc || typeof svc.captureArea !== "function") {
    notifyMissing();
    return;
  }

  svc.captureArea(false, onRegion);
}

function saveDrawing() {
  if (!hasStrokes && !bgCanvasEl) {
    os.notify.send("Stylus", "Nothing to save yet");
    return;
  }

  try {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const off = createElement("canvas", {});

    off.width = vw;
    off.height = vh;

    const offCtx = off.getContext("2d");

    if (bgCanvasEl) {
      offCtx.drawImage(bgCanvasEl, 0, 0, vw, vh);
    }

    if (canvasEl) {
      offCtx.drawImage(canvasEl, 0, 0, vw, vh);
    }

    off.toBlob((blob) => {
      if (!blob) {
        os.notify.send("Stylus", "Failed to save drawing", {
          type: "error"
        });
        return;
      }

      os.fs
        .mkdir("Pictures/Screenshots")
        .then(() => {
          const name = `Screenshot-${Date.now()}.png`;
          return os.fs.writeBinaryFile("Pictures/Screenshots", name, blob);
        })
        .then(() => {
          os.notify.send("Stylus", "Drawing saved to Pictures/Screenshots");
        })
        .catch(() => {
          os.notify.send("Stylus", "Failed to save drawing", {
            type: "error"
          });
        });
    }, "image/png");
  } catch {
    os.notify.send("Stylus", "Failed to save drawing", {
      type: "error"
    });
  }
}

function ensureMagnifier() {
  if (!magnifier) {
    magnifier = createMagnifierEngine();
  }

  return magnifier;
}

function stopMagnifier() {
  if (magnifier && magnifier.active) {
    magnifier.stop();
  }
}

function refreshZoomLabel(menu) {
  const label = $(".stylus-zoom-value", menu);

  if (label && magnifier) {
    setText(label, magnifier.zoom + "%");
  }
}

function refreshDrawUI(menu) {
  const drawBtn = $(".stylus-draw-btn", menu);
  const drawRow = $(".stylus-draw-row", menu);

  toggleClass(drawBtn, "is-active", isDrawing);
  toggleClass(drawRow, "is-visible", isDrawing);

  const allDots = $$(".stylus-color-dot", menu);

  allDots.forEach((dot) => {
    const isSelected = dot.getAttribute("data-color") === penColor && !eraserOn;

    toggleClass(dot, "is-active", isSelected);
  });

  const customBtn = $(".stylus-custom-color", menu);

  if (customBtn) {
    const isCustom = !["red", "blue", "green", "yellow", "purple", "white"].includes(penColor);

    toggleClass(customBtn, "is-active", isCustom);
    customBtn.style.setProperty("--stylus-custom-color", penColor);
  }

  const eraserBtn = $(".stylus-eraser-btn", menu);

  toggleClass(eraserBtn, "is-active", eraserOn);
}

function refreshMagnifierUI(menu) {
  const magBtn = $(".stylus-magnifier-btn", menu);
  const zoomRow = $(".stylus-zoom-row", menu);

  const active = Boolean(magnifier && magnifier.active);

  toggleClass(magBtn, "is-active", active);
  toggleClass(zoomRow, "is-visible", active);

  refreshZoomLabel(menu);
}

function closeMenu() {
  stopDraw();
  stopMagnifier();

  const el = $("#stylus-menu");

  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function buildMenu() {
  const menu = createElement("div", {
    id: "stylus-menu",
    className: "stylus-menu"
  });

  const title = createElement("div", {
    className: "stylus-title",
    html: `Stylus tools <i class="fas fa-gear stylus-gear"></i>`
  });

  menu.appendChild(title);

  const fullBtn = createElement("button", {
    className: "stylus-btn stylus-pill",
    html: `<i class="fas fa-camera"></i><span>Screen capture</span>`
  });

  bindEvent(fullBtn, "click", doFullScreenshot);
  menu.appendChild(fullBtn);

  const noteBtn = createElement("button", {
    className: "stylus-btn stylus-pill stylus-note-btn",
    html: `<i class="fas fa-sticky-note"></i><span>Create note</span>`
  });

  bindEvent(noteBtn, "click", createNote);
  menu.appendChild(noteBtn);

  const drawBtn = createElement("button", {
    className: "stylus-btn stylus-pill stylus-draw-btn",
    html: `<i class="fas fa-pen"></i><span>Laser pointer</span>`
  });

  menu.appendChild(drawBtn);

  const drawRow = createElement("div", {
    className: "stylus-draw-row"
  });

  const colors = [
    {
      name: "red",
      value: "#ff0000"
    },
    {
      name: "blue",
      value: "#0066ff"
    },
    {
      name: "green",
      value: "#00c853"
    },
    {
      name: "yellow",
      value: "#ffd600"
    },
    {
      name: "purple",
      value: "#aa00ff"
    },
    {
      name: "white",
      value: "#ffffff"
    }
  ];

  colors.forEach(({ name, value }) => {
    const dot = createElement("button", {
      className: "stylus-color-dot is-" + name
    });

    dot.setAttribute("data-color", name);
    dot.setAttribute("aria-label", name + " pen");
    dot.style.setProperty("--stylus-color", value);

    bindEvent(dot, "click", () => {
      penColor = value;
      eraserOn = false;

      applyPen();
      syncEraserCursorMode();
      refreshDrawUI(menu);
    });

    drawRow.appendChild(dot);
  });

  const customColorInput = createElement("input", {
    type: "color",
    className: "stylus-custom-color-input"
  });

  customColorInput.value = "#ff6600";
  customColorInput.setAttribute("aria-label", "Custom pen color");

  const customColorBtn = createElement("button", {
    className: "stylus-color-dot stylus-custom-color",
    html: `<i class="fas fa-palette"></i>`
  });

  customColorBtn.setAttribute("aria-label", "Custom pen color");
  customColorBtn.appendChild(customColorInput);

  bindEvent(customColorBtn, "click", () => {
    customColorInput.click();
  });

  bindEvent(customColorInput, "input", (e) => {
    penColor = e.target.value;
    eraserOn = false;

    applyPen();
    syncEraserCursorMode();
    refreshDrawUI(menu);
  });

  drawRow.appendChild(customColorBtn);

  const sizeRow = createElement("div", {
    className: "stylus-size-row",
    html: `<span>Size</span>${renderRangeSlider("stylusStrokeWidth", 1, 40, 1, strokeWidth)}<span class="stylus-size-value">${strokeWidth}</span>`
  });

  drawRow.appendChild(sizeRow);

  const eraserBtn = createElement("button", {
    className: "stylus-btn stylus-pill stylus-eraser-btn",
    html: `<i class="fas fa-eraser"></i><span>Eraser</span>`
  });

  bindEvent(eraserBtn, "click", () => {
    eraserOn = !eraserOn;

    applyPen();
    syncEraserCursorMode();
    refreshDrawUI(menu);
  });

  drawRow.appendChild(eraserBtn);

  const clearBtn = createElement("button", {
    className: "stylus-btn stylus-pill",
    html: `<i class="fas fa-trash-alt"></i><span>Clear all</span>`
  });

  bindEvent(clearBtn, "click", clearDraw);
  drawRow.appendChild(clearBtn);

  const saveBtn = createElement("button", {
    className: "stylus-btn stylus-pill stylus-save-btn",
    html: `<i class="fas fa-save"></i><span>Save</span>`
  });

  bindEvent(saveBtn, "click", saveDrawing);
  drawRow.appendChild(saveBtn);

  menu.appendChild(drawRow);

  bindEvent(drawBtn, "click", () => {
    if (isDrawing) {
      stopDraw();
    } else {
      startDraw();
    }

    refreshDrawUI(menu);
  });

  const magBtn = createElement("button", {
    className: "stylus-btn stylus-pill stylus-magnifier-btn",
    html: `<i class="fas fa-search-plus"></i><span>Magnifying glass</span>`
  });

  menu.appendChild(magBtn);

  const zoomRow = createElement("div", {
    className: "stylus-zoom-row"
  });

  const zoomOut = createElement("button", {
    className: "stylus-btn stylus-pill",
    html: `<i class="fas fa-minus"></i><span>Zoom out</span>`
  });

  const zoomValue = createElement("span", {
    className: "stylus-zoom-value",
    text: "200%"
  });

  const zoomIn = createElement("button", {
    className: "stylus-btn stylus-pill",
    html: `<i class="fas fa-plus"></i><span>Zoom in</span>`
  });

  bindEvent(zoomOut, "click", () => {
    const engine = ensureMagnifier();

    engine.setZoom(engine.zoom - 25);
    refreshZoomLabel(menu);
  });

  bindEvent(zoomIn, "click", () => {
    const engine = ensureMagnifier();

    engine.setZoom(engine.zoom + 25);
    refreshZoomLabel(menu);
  });

  zoomRow.appendChild(zoomOut);
  zoomRow.appendChild(zoomValue);
  zoomRow.appendChild(zoomIn);

  menu.appendChild(zoomRow);

  bindEvent(magBtn, "click", () => {
    const engine = ensureMagnifier();

    if (engine.active) {
      engine.stop();
    } else {
      engine.start();
    }

    refreshMagnifierUI(menu);
  });

  document.body.appendChild(menu);

  if (!sliderEventsBound) {
    bindRangeSlider();
    sliderEventsBound = true;
  }

  const strokeSlider = $("#stylusStrokeWidth", menu);

  bindEvent(strokeSlider, "input", () => {
    strokeWidth = getRangeSliderValue("stylusStrokeWidth", menu);

    const sizeValue = $(".stylus-size-value", menu);

    setText(sizeValue, String(strokeWidth));

    applyPen();
  });

  refreshDrawUI(menu);
  refreshMagnifierUI(menu);
}

export function toggleStylusMenu() {
  const existing = $("#stylus-menu");

  if (existing) {
    closeMenu();
    return;
  }

  buildMenu();
}
