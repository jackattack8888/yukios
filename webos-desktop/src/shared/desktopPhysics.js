import { os } from "../framework.js";

let active = false;
let frameId = null;
let bodies = [];
let lastTime = 0;
let lastKickAt = 0;
const originalPositions = new Map();

function getBounds() {
  const bounds = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  try {
    const bar = document.getElementById("taskbar");
    if (!bar || !isVisible(bar)) return bounds;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return bounds;
    if (rect.height <= rect.width) {
      if (rect.top < window.innerHeight / 2) bounds.top = Math.max(0, rect.bottom);
      else bounds.bottom = Math.min(window.innerHeight, rect.top);
    } else {
      if (rect.left < window.innerWidth / 2) bounds.left = Math.max(0, rect.right);
      else bounds.right = Math.min(window.innerWidth, rect.left);
    }
  } catch {}
  return bounds;
}

function isVisible(el) {
  try {
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  } catch {
    return false;
  }
}

function collectElements() {
  const list = [];
  const seen = new Set();
  const addElement = (el, isIcon) => {
    if (!el || seen.has(el)) return;
    try {
      if (!isVisible(el)) return;
      if (!isIcon && el.offsetWidth > window.innerWidth * 0.9) return;
      seen.add(el);
      list.push({ el, type: isIcon ? "icon" : "window" });
    } catch {}
  };
  try {
    const icons = document.querySelectorAll("#desktop > .icon");
    icons.forEach((el) => {
      addElement(el, true);
    });
  } catch {}
  try {
    const open = os.window.getOpenWindows();
    for (const id of open.keys()) {
      try {
        const el = document.getElementById(id);
        if (!el) continue;
        addElement(el, false);
      } catch {}
    }
  } catch {}
  try {
    const windows = document.querySelectorAll(".window");
    windows.forEach((el) => {
      addElement(el, false);
    });
  } catch {}
  return list;
}

function step(now) {
  try {
    if (!lastTime) lastTime = now;
    const dt = Math.min(Math.max((now - lastTime) / 16.667, 0.5), 2);
    lastTime = now;
    const kick = now - lastKickAt >= 2000;
    if (kick) lastKickAt = now;
    const bounds = getBounds();
    for (const body of bodies) {
      try {
        if (body.settled || body.held) continue;
        body.vy += 0.6 * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.spin * dt;
        const w = body.el.offsetWidth || body.w;
        const h = body.el.offsetHeight || body.h;
        const floor = bounds.bottom;
        if (body.y + h >= floor) {
          body.y = floor - h;
          body.vy *= -body.rest;
          body.vx = body.vx * 0.9 + (Math.random() * 2 - 1) * dt;
          body.spin = (Math.random() * 4 - 2) * Math.sign(body.vx || 1);
          if (Math.abs(body.vy) < 2) body.vy = 0;
          body.impacts += 1;
          const budget = body.type === "icon" ? 5 : 5;
          if (body.impacts >= budget && Math.abs(body.vy) < 2 && (body.type === "icon" || body.kicks <= 0)) {
            body.vy = 0;
            body.vx = 0;
            body.y = floor - h;
            body.settled = true;
            body.el.style.left = body.x + "px";
            body.el.style.top = body.y + "px";
            body.el.style.transform = "rotate(" + body.angle.toFixed(1) + "deg)";
            continue;
          }
        }
        if (body.x < bounds.left) {
          body.x = bounds.left;
          body.vx *= -body.rest;
          body.spin *= -1;
        } else if (body.x + w > bounds.right) {
          body.x = bounds.right - w;
          body.vx *= -body.rest;
          body.spin *= -1;
        }
        if (body.y < bounds.top) {
          body.y = bounds.top;
          body.vy *= -body.rest;
        }
        if (kick && body.vy === 0 && body.type === "window" && body.kicks > 0 && body.y + h >= floor - 4) {
          body.kicks -= 1;
          body.vy = -(2.5 + Math.random() * 2.5);
          body.vx = Math.random() * 4 - 2;
          body.spin = Math.random() * 4 - 2;
        }
        body.el.style.left = body.x + "px";
        body.el.style.top = body.y + "px";
        body.el.style.transform = "rotate(" + body.angle.toFixed(1) + "deg)";
      } catch {}
    }
  } catch {}
  if (active) frameId = requestAnimationFrame(step);
}

export function isPhysicsChaosActive() {
  return active;
}

export function startPhysicsChaos() {
  if (active) return;
  try {
    const elements = collectElements();
    bodies = [];
    originalPositions.clear();
    for (const entry of elements) {
      try {
        const el = entry.el;
        originalPositions.set(el, { left: el.style.left, top: el.style.top, transform: el.style.transform });
        let x = parseFloat(el.style.left);
        let y = parseFloat(el.style.top);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          if (el.offsetParent !== null) {
            x = el.offsetLeft;
            y = el.offsetTop;
          } else {
            const rect = el.getBoundingClientRect();
            x = rect.left;
            y = rect.top;
          }
        }
        const dir = Math.random() < 0.5 ? -1 : 1;
        const isWin = entry.type === "window";
        bodies.push({
          el,
          x,
          y,
          vx: (Math.random() * 6 - 3) * dir,
          vy: Math.random() * -3,
          angle: 0,
          spin: (Math.random() * 3 + 1) * dir,
          rest: isWin ? 0.35 + Math.random() * 0.15 : 0.6 + Math.random() * 0.2,
          w: el.offsetWidth,
          h: el.offsetHeight,
          type: entry.type,
          impacts: 0,
          settled: false,
          held: false,
          dragDX: 0,
          dragDY: 0,
          kicks: isWin ? 1 : 0
        });
      } catch {}
    }
    if (bodies.length === 0) return;
    active = true;
    lastTime = 0;
    lastKickAt = performance.now();
    frameId = requestAnimationFrame(step);
  } catch {}
}

export function stopPhysicsChaos() {
  if (!active && frameId === null) return;
  try {
    active = false;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    for (const [el, pos] of originalPositions) {
      try {
        el.style.left = pos.left;
        el.style.top = pos.top;
        el.style.transform = pos.transform;
      } catch {}
    }
  } catch {}
  originalPositions.clear();
  bodies = [];
}

export function togglePhysicsChaos() {
  if (active) stopPhysicsChaos();
  else startPhysicsChaos();
  return active;
}

export function grabPhysicsBody(el) {
  try {
    const body = bodies.find((b) => b.el === el);
    if (!body) return;
    body.held = true;
    body.settled = false;
    body.vx = 0;
    body.vy = 0;
  } catch {}
}

export function notePhysicsDrag(el) {
  try {
    const body = bodies.find((b) => b.el === el);
    if (!body) return;
    body.held = true;
    body.settled = false;
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    body.dragDX = x - body.x;
    body.dragDY = y - body.y;
    body.x = x;
    body.y = y;
  } catch {}
}

export function releasePhysicsBody(el) {
  try {
    const body = bodies.find((b) => b.el === el);
    if (!body) return;
    body.held = false;
    const clamp = (v) => Math.max(-15, Math.min(15, v * 3));
    body.vx = clamp(body.dragDX || 0);
    body.vy = clamp(body.dragDY || 0);
    body.dragDX = 0;
    body.dragDY = 0;
    body.settled = false;
    body.impacts = 0;
  } catch {}
}
