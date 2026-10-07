let snapshot = { level: 1, charging: true, dischargingTime: Infinity, chargingTime: Infinity };
let listeners = new Set();
let handle = null;
let started = false;

function refreshFromHandle() {
  snapshot = {
    level: handle.level,
    charging: handle.charging,
    dischargingTime: Number.isFinite(handle.dischargingTime) ? handle.dischargingTime : Infinity,
    chargingTime: Number.isFinite(handle.chargingTime) ? handle.chargingTime : Infinity
  };
}

async function ensureStarted() {
  if (started) return;
  if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
  started = true;
  try {
    handle = await navigator.getBattery();
    refreshFromHandle();
    notify();
    handle.addEventListener("levelchange", () => {
      refreshFromHandle();
      notify();
    });
    handle.addEventListener("chargingchange", () => {
      refreshFromHandle();
      notify();
    });
  } catch (err) {
    console.warn("batteryService failed to start", err);
  }
}

function notify() {
  const current = getSnapshot();
  listeners.forEach((callback) => callback(current));
}

function subscribe(callback) {
  listeners.add(callback);
  ensureStarted();
  callback(getSnapshot());
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return {
    level: snapshot.level,
    charging: snapshot.charging,
    dischargingTime: snapshot.dischargingTime,
    chargingTime: snapshot.chargingTime,
    percent: Math.round(snapshot.level * 100)
  };
}

function getPercent() {
  return getSnapshot().percent;
}

function isCharging() {
  return snapshot.charging;
}

function getStatusText() {
  const current = getSnapshot();
  if (current.charging && current.percent >= 100) return "Fully Charged";
  if (current.charging) return "Charging";
  if (current.percent <= 20) return "Low Battery";
  return "On Battery";
}

function getFaIconClass() {
  if (isCharging()) return "fas fa-battery-full";
  const percent = getPercent();
  if (percent > 90) return "fas fa-battery-full";
  if (percent > 65) return "fas fa-battery-three-quarters";
  if (percent > 35) return "fas fa-battery-half";
  if (percent > 10) return "fas fa-battery-quarter";
  return "fas fa-battery-empty";
}

function getPapirusIcon() {
  const percent = getPercent();
  if (percent > 90) return "papirus:status/battery-100";
  if (percent > 65) return "papirus:status/battery-070";
  if (percent > 35) return "papirus:status/battery-050";
  if (percent > 10) return "papirus:status/battery-020";
  return "papirus:status/battery-000";
}

function getFillColor() {
  if (isCharging()) return "var(--charging)";
  const percent = getPercent();
  if (percent > 60) return "var(--charging)";
  if (percent > 30) return "var(--brand)";
  return "var(--error)";
}

function getBoltOrFaHtml() {
  if (isCharging()) return `<i class="fas fa-bolt" style="color: var(--charging)"></i>`;
  return `<i class="${getFaIconClass()}"></i>`;
}

function getTimeLeftText() {
  if (isCharging()) return "Charging";
  const dischargingTime = snapshot.dischargingTime;
  if (!Number.isFinite(dischargingTime) || dischargingTime <= 0) return "On Battery";
  const h = Math.floor(dischargingTime / 3600);
  const mm = String(Math.floor((dischargingTime % 3600) / 60)).padStart(2, "0");
  return `${h}:${mm} left`;
}

function getFooterText() {
  const pct = getPercent();
  if (isCharging()) return pct >= 100 ? "100% Fully Charged" : `${pct}% Charging`;
  const left = getTimeLeftText();
  if (left === "On Battery") return `${pct}% On Battery`;
  return `${pct}% - ${left}`;
}

export const batteryService = {
  subscribe,
  getSnapshot,
  getPercent,
  isCharging,
  getStatusText,
  getFaIconClass,
  getPapirusIcon,
  getFillColor,
  getBoltOrFaHtml,
  getTimeLeftText,
  getFooterText
};
