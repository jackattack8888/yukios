import { performanceManager } from "./performanceManager.js";
export function isReducedActivity() {
  try {
    if (typeof document !== "undefined" && document.hidden) return true;
  } catch {}
  try {
    if (performanceManager && performanceManager.getMode() === "performance") return true;
  } catch {}
  return false;
}
export function throttledInterval(baseMs, slowMs) {
  return isReducedActivity() ? slowMs : baseMs;
}
export function createAdaptiveInterval(fn, baseMs, slowMs) {
  let timer = null;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    try {
      fn();
    } finally {
      if (!stopped) timer = setTimeout(tick, throttledInterval(baseMs, slowMs));
    }
  };
  timer = setTimeout(tick, throttledInterval(baseMs, slowMs));
  const onVis = () => {
    if (stopped || !timer) return;
    clearTimeout(timer);
    timer = setTimeout(tick, throttledInterval(baseMs, slowMs));
  };
  try {
    document.addEventListener("visibilitychange", onVis);
  } catch {}
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    try {
      document.removeEventListener("visibilitychange", onVis);
    } catch {}
  };
}
export function guardVisible(fn) {
  return (...args) => {
    try {
      if (typeof document !== "undefined" && document.hidden) return;
    } catch {}
    return fn(...args);
  };
}
