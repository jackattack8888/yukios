import { CDN_MIRRORS, setCdnMirror, getCdnMirror, resolveIconUrl } from ".././shared/assetResolver.js";

import { BaseApp, StorageKeys, os, $, createElement } from "../framework.js";
import { isTaskbarTop } from "../utils/utils.js";
import { getTrayPosition } from "../tray/tray.js";
import { getEffectiveIcon } from "../shared/iconPack.js";
import { setTrayPinState } from "../shared/trayPin.js";
class NetworkTrayApp extends BaseApp {
  constructor(services) {
    super(services);
    this.winId = "network-tray-window";
    this.popupId = "network-tray-popup";
    this.popupVisible = false;
    this.pinned = false;
    this.connecting = false;
    this.currentCdn = getCdnMirror();
    this.initTray();
  }

  getSignalStrength(cdnId) {
    const signalMap = {
      jsdelivr: 4,
      quantil: 3,
      originfastly: 3,
      gcore: 3,
      esmsh: 2,
      statically: 2,
      staticdelivr: 2
    };
    return signalMap[cdnId] || 2;
  }

  getWifiIcon(signalStrength) {
    return "papirus:status/network-wireless-connected-100";
  }

  initTray() {
    this.registerTray(this.winId, "papirus:status/network-wireless-connected-100", "Network", {
      resident: true,
      showInTray: true,
      priority: 100,
      onClick: () => {
        this.togglePopup();
      },
      contextMenuItems: [
        { label: "Network Settings", icon: "papirus:actions/configure", action: () => this.openNetworkSettings() },
        { type: "divider" }
      ]
    });
    this.updateTrayIcon();
  }

  updateTrayIcon() {
    const signalStrength = this.getSignalStrength(this.currentCdn);
    const iconClass = this.getWifiIcon(signalStrength);
    this.unregisterTray(this.winId);
    this.registerTray(this.winId, iconClass, "Network", {
      resident: true,
      showInTray: true,
      priority: 100,
      onClick: () => {
        this.togglePopup();
      },
      contextMenuItems: [
        { label: "Network Settings", icon: "papirus:actions/configure", action: () => this.openNetworkSettings() },
        { type: "divider" }
      ]
    });
  }

  openNetworkSettings() {
    os.app.launch("settingsApp", null, { section: "pane-network" });
  }

  togglePopup() {
    if (this.popupVisible) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  openPopup() {
    if (this.popupVisible) return;

    const existingPopup = $("#" + this.popupId);
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = createElement("div");
    popup.id = this.popupId;
    popup.className = "network-tray-popup";
    popup.innerHTML = this.buildPopupContent();

    document.body.appendChild(popup);
    popup.style.display = "block";
    popup.style.visibility = "hidden";
    const btn = document.querySelector('[data-win-id="network-tray-window"]') || $("#app-tray");
    const pos = getTrayPosition(btn, popup);
    popup.style.left = pos.left;
    popup.style.right = pos.right;
    popup.style.top = pos.top;
    popup.style.bottom = pos.bottom;
    popup.style.visibility = "";

    this.popupVisible = true;
    this.bindEvents(popup);

    document.addEventListener("click", this.handleOutsideClick);
  }

  getPopupIconHtml(papirusIcon) {
    const effective = getEffectiveIcon(papirusIcon);
    if (typeof effective === "string" && effective.startsWith("papirus:")) {
      return `<img src="${resolveIconUrl(effective)}" class="papirus-icon papirus-icon--16" alt="" />`;
    }
    if (typeof effective === "string" && effective.startsWith("fa")) {
      return `<i class="${effective}"></i>`;
    }
    return `<img src="${effective}" class="papirus-icon papirus-icon--16" alt="" />`;
  }

  buildPopupContent() {
    const currentCdn = getCdnMirror();
    const cdnList = CDN_MIRRORS.map((cdn) => {
      const signalStrength = this.getSignalStrength(cdn.id);
      const isConnected = cdn.id === currentCdn;
      return `
        <div class="network-item ${isConnected ? "connected" : ""}" data-cdn="${cdn.id}">
          <div class="network-signal">
            ${this.buildSignalBars(signalStrength)}
          </div>
          <div class="network-info">
            <div class="network-name">${cdn.name}</div>
            <div class="network-status">${isConnected ? "Connected" : "Available"}</div>
          </div>
          ${isConnected ? `<div class="network-badge">${this.getPopupIconHtml("papirus:actions/object-select")}</div>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="network-popup-content">
        <div class="network-header">
          ${this.getPopupIconHtml("papirus:status/network-wireless-connected-100")}
          <span>Network</span>
          <button class="tray-pin-btn" title="Pin"><i class="fas fa-thumbtack"></i></button>
          <button class="network-close-btn" title="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="network-list">
          ${cdnList}
        </div>
        <div class="network-footer">
          <button class="network-settings-btn" id="network-settings-btn">
            ${this.getPopupIconHtml("papirus:actions/configure")}
            <span>Network Settings</span>
          </button>
        </div>
      </div>
    `;
  }

  buildSignalBars(strength) {
    let bars = "";
    for (let i = 1; i <= 4; i++) {
      const active = i <= strength ? "active" : "";
      bars += `<div class="signal-bar ${active}"></div>`;
    }
    return bars;
  }

  closePopup() {
    const popup = $("#" + this.popupId);
    if (popup) {
      popup.classList.add("closing");
      popup.addEventListener(
        "animationend",
        () => {
          popup.remove();
        },
        { once: true }
      );
    }
    this.popupVisible = false;
    document.removeEventListener("click", this.handleOutsideClick);
  }

  handleOutsideClick = (e) => {
    if (this.pinned) return;
    const popup = $("#" + this.popupId);
    const trayEl = $("#app-tray");
    if (popup && !e.target.closest("#network-tray-popup") && !e.target.closest("#app-tray")) {
      this.closePopup();
    }
  };

  open(options = {}) {
    this.togglePopup();
  }

  bindEvents(popup) {
    const networkItems = popup.querySelectorAll(".network-item");
    const settingsBtn = popup.querySelector("#network-settings-btn");
    const closeBtn = popup.querySelector(".network-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closePopup();
      });
    }
    const pinBtn = popup.querySelector(".tray-pin-btn");
    if (pinBtn) {
      setTrayPinState(popup, pinBtn, this.pinned);
      pinBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.pinned = !this.pinned;
        setTrayPinState(popup, pinBtn, this.pinned);
      });
    }

    networkItems.forEach((item) => {
      item.addEventListener("click", () => {
        const cdnId = item.dataset.cdn;
        if (cdnId !== this.currentCdn && !this.connecting) {
          this.connectToCdn(cdnId, item);
        }
      });
    });

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.openNetworkSettings();
        this.closePopup();
      });
    }
  }

  async connectToCdn(cdnId, itemElement) {
    this.connecting = true;
    const originalContent = itemElement.innerHTML;

    itemElement.classList.add("connecting");
    itemElement.innerHTML = `
      <div class="network-signal">
        <div class="connecting-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
      </div>
      <div class="network-info">
        <div class="network-name">Connecting...</div>
        <div class="network-status">Establishing connection</div>
      </div>
    `;

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setCdnMirror(cdnId);
    this.currentCdn = cdnId;

    const cdn = CDN_MIRRORS.find((c) => c.id === cdnId);
    this.notify(
      "Network Connected",
      `Connected to ${cdn.name}`,
      "success",
      2000,
      "papirus:status/network-wireless-connected-100"
    );

    this.updateTrayIcon();
    this.connecting = false;
  }

  onClose(winId) {
    this.closePopup();
  }
}

export { NetworkTrayApp };
