import { $ } from "./domUtils.js";

export function createMagnifierEngine() {
  let desktop = null;
  let cursorX = 0;
  let cursorY = 0;
  let savedTransform = "";
  let savedOrigin = "";
  let moveHandler = null;

  const engine = {
    zoom: 200,
    active: false,
    start() {
      const found = $("#desktop");
      if (!found) return false;
      desktop = found;
      savedTransform = desktop.style.transform;
      savedOrigin = desktop.style.transformOrigin;
      engine.active = true;
      applyTransform();
      moveHandler = (e) => {
        cursorX = e.clientX;
        cursorY = e.clientY;
        applyTransform();
      };
      document.addEventListener("mousemove", moveHandler, { passive: true });
      return true;
    },
    stop() {
      if (desktop) {
        desktop.style.transform = savedTransform;
        desktop.style.transformOrigin = savedOrigin;
      }
      savedTransform = "";
      savedOrigin = "";
      if (moveHandler) {
        document.removeEventListener("mousemove", moveHandler);
        moveHandler = null;
      }
      desktop = null;
      engine.active = false;
    },
    setZoom(level) {
      const clamped = Math.min(400, Math.max(100, level));
      engine.zoom = clamped;
      if (engine.active) applyTransform();
    }
  };

  function applyTransform() {
    if (!desktop) return;
    desktop.style.transformOrigin = `${cursorX}px ${cursorY}px`;
    desktop.style.transform = `scale(${engine.zoom / 100})`;
  }

  return engine;
}
