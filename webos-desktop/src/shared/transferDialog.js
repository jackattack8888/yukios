import "../styles/transferDialog.css";
import { os, $, bindEvent, createElement, setHTML, setText } from "../framework.js";

let transferSequence = 0;

function buildDialogHTML(title, cancellable, indeterminate) {
  const progressAttrs = indeterminate ? "" : 'max="100" value="0"';
  const cancelHTML = cancellable
    ? '<div class="transfer-dialog-actions"><button type="button" class="transfer-dialog-cancel">Cancel</button></div>'
    : "";
  return `
    <div class="transfer-dialog-root${indeterminate ? " is-indeterminate" : ""}">
      <div class="transfer-dialog-status"><span class="transfer-dialog-count">Starting</span></div>
      <progress class="transfer-dialog-progress" ${progressAttrs}></progress>
      <div class="transfer-dialog-label">${title}</div>
      ${cancelHTML}
    </div>
  `;
}

export function showTransferDialog(options = {}) {
  const title = options.title || "Transferring";
  const rawTotal = options.total;
  const knownTotal = Number.isFinite(rawTotal) && rawTotal > 0;
  const total = knownTotal ? Math.floor(rawTotal) : 0;
  const cancellable = options.cancellable !== false;

  const dialogState = { done: 0, finished: false, cancelled: false, handlers: [] };
  const dialogId = `transfer-dialog-${Date.now()}-${transferSequence++}`;

  let host = null;
  let useWindow = false;
  let overlay = null;

  const fireCancel = () => {
    const pending = dialogState.handlers.slice();
    dialogState.handlers.length = 0;
    for (const handler of pending) {
      try {
        handler();
      } catch {}
    }
  };

  const closeHost = () => {
    if (useWindow && host) {
      try {
        os.window.close(host);
      } catch {}
      host = null;
    } else if (overlay) {
      overlay.remove();
      overlay = null;
      host = null;
    }
  };

  const requestCancel = () => {
    if (dialogState.finished || dialogState.cancelled) return;
    dialogState.cancelled = true;
    fireCancel();
    dialogState.finished = true;
    closeHost();
  };

  const mountFallback = () => {
    overlay = createElement("div", { className: "transfer-dialog-overlay" });
    setHTML(
      overlay,
      `<div class="transfer-dialog-box" role="dialog" aria-label="${title}">${buildDialogHTML(title, cancellable, !knownTotal)}</div>`
    );
    document.body.appendChild(overlay);
    host = overlay;
    useWindow = false;
  };

  try {
    if (os && os.window && typeof os.window.create === "function") {
      const win = os.window.create(dialogId, title, "320px", "auto", { icon: "fas fa-copy" });
      if (win) {
        host = win;
        useWindow = true;
        host.classList.add("transfer-dialog-window");
        host.style.height = "auto";
        setHTML(host, buildDialogHTML(title, cancellable, !knownTotal));
      } else {
        mountFallback();
      }
    } else {
      mountFallback();
    }
  } catch {
    if (!host) mountFallback();
  }

  const progressEl = host ? $(".transfer-dialog-progress", host) : null;
  const labelEl = host ? $(".transfer-dialog-label", host) : null;
  const countEl = host ? $(".transfer-dialog-count", host) : null;
  const cancelBtn = host ? $(".transfer-dialog-cancel", host) : null;

  if (cancelBtn) bindEvent(cancelBtn, "click", requestCancel);
  if (host) {
    bindEvent(host, "remove", () => {
      if (dialogState.finished) return;
      dialogState.finished = true;
      dialogState.cancelled = true;
      fireCancel();
    });
  }

  const update = (done, label) => {
    if (dialogState.finished) return;
    if (knownTotal) {
      const safeDone = Math.max(0, Math.min(total, Number(done) || 0));
      dialogState.done = safeDone;
      if (progressEl) {
        progressEl.max = total;
        progressEl.value = safeDone;
      }
      if (countEl) {
        const percent = total > 0 ? Math.round((safeDone / total) * 100) : 0;
        setText(countEl, `${safeDone} of ${total} (${percent}%)`);
      }
    } else if (progressEl) {
      progressEl.removeAttribute("value");
      progressEl.removeAttribute("max");
      if (countEl) setText(countEl, "Working");
    }
    if (typeof label === "string" && labelEl) setText(labelEl, label);
  };

  const complete = () => {
    if (dialogState.finished) return;
    dialogState.finished = true;
    closeHost();
  };

  const cancel = () => {
    requestCancel();
  };

  const onCancel = (handler) => {
    if (typeof handler !== "function") return () => {};
    if (dialogState.cancelled) {
      try {
        handler();
      } catch {}
      return () => {};
    }
    dialogState.handlers.push(handler);
    return () => {
      const index = dialogState.handlers.indexOf(handler);
      if (index !== -1) dialogState.handlers.splice(index, 1);
    };
  };

  return { update, complete, cancel, onCancel };
}
