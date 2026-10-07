import { BaseApp, os, $ } from "../framework.js";
import { getLibraryUrl } from "../shared/cdnConfig.js";

export class ErudaApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  async open() {
    const winId = "eruda";
    if (this.hasOpenWindow(winId)) return;

    const win = os.window.create(winId, "Dev Tools (Eruda)", "450px", "400px", {
      icon: "fas fa-code"
    });

    win.innerHTML = this.buildUI();
    this.trackWindow(winId, win);

    await this.initEruda();
  }

  buildUI() {
    return `
      <div class="window-content" style="padding: 0; height: 100%; overflow: hidden;">
        <div id="eruda-container" style="width: 100%; height: 100%;"></div>
      </div>
    `;
  }

  async initEruda() {
    const container = $("#eruda-container");
    if (container) {
      if (__SINGLE_FILE__) {
        if (!window.eruda) {
          const script = document.createElement("script");
          script.src = getLibraryUrl("eruda");
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error("eruda failed to load"));
          });
        }
        const erudaLib = window.eruda.default || window.eruda;
        erudaLib.init({
          container: container
        });
        erudaLib.show();
        os.notify.send("Dev Tools", "Eruda debugging tool launched");
        return;
      }
      const eruda = await import("eruda");
      eruda.default.init({
        container: container
      });
      eruda.default.show();
      os.notify.send("Dev Tools", "Eruda debugging tool launched");
    }
  }

  onClose(winId) {
    this.untrackWindow(winId);
  }
}
