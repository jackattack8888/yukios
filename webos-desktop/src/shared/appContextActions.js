import { os } from "../framework.js";
import { StorageKeys } from "../StorageKeys.js";
import { showFileProperties } from "../fileDisplay.js";
import { addAppToDesktop, isAppOnDesktop } from "./desktopShortcuts.js";

export { addAppToDesktop, isAppOnDesktop };

export function isAppPinnedToTaskbar(appId) {
  const pinnedItems = os.windowManager?.taskbarSystem?.getPinnedItems?.() || [];
  return pinnedItems.some((item) => item.appId === appId);
}

export function toggleTaskbarPin(appId, appData) {
  const displayName = appData.title || appId;
  if (isAppPinnedToTaskbar(appId)) {
    const taskbar = os.windowManager?.taskbarSystem;
    if (taskbar) {
      const pinned = taskbar.getPinnedItems();
      const filtered = pinned.filter((item) => item.appId !== appId);
      taskbar.savePinnedItems(filtered);
      taskbar.renderPinnedItems?.();
      taskbar.syncPinnedStates?.();
      try {
        const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(appId) : appId;
        document.querySelectorAll(`.taskbar-item[data-app-id="${esc}"].pinned`).forEach((el) => {
          const elWinId = el.id.replace("taskbar-", "");
          if (taskbar.manager?.openWindows?.has(elWinId)) el.classList.remove("pinned");
          else el.remove();
        });
      } catch {}
      try {
        const order = os.storage.get(StorageKeys.taskbarOrder) || [];
        const cleaned = order.filter((id) => id !== appId);
        if (cleaned.length !== order.length) os.storage.set(StorageKeys.taskbarOrder, cleaned);
      } catch {}
    } else {
      os.windowManager?.taskbarSystem?.unpinFromTaskbar(`${appId}-pinned`);
    }
  } else {
    os.window.pinAppToTaskbar(appId, displayName, appData.icon || "fas fa-star");
  }
}

export function showAppProperties(appId, appData) {
  const fileName = `${appData.title || appId}.desktop`;
  showFileProperties(["Desktop", fileName], fileName, false);
}

export function isAppFavorite(appId) {
  const favorites = os.storage.get(StorageKeys.favoritesKey) || [];
  return favorites.includes(appId);
}

export function toggleAppFavorite(appId) {
  const favorites = os.storage.get(StorageKeys.favoritesKey) || [];
  const idx = favorites.indexOf(appId);
  const nowFavorite = idx < 0;
  if (nowFavorite) favorites.push(appId);
  else favorites.splice(idx, 1);
  os.storage.set(StorageKeys.favoritesKey, favorites);
  return nowFavorite;
}
