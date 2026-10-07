import { createElement } from "./domUtils.js";

export function createTrayPinButton() {
  return createElement("button", {
    className: "tray-pin-btn",
    attributes: { title: "Pin" },
    html: '<i class="fas fa-thumbtack"></i>'
  });
}

export function setTrayPinState(panel, btn, pinned) {
  if (panel) panel.classList.toggle("tray-pinned", pinned);
  if (btn) {
    btn.classList.toggle("active", pinned);
    btn.title = pinned ? "Unpin" : "Pin";
  }
}
