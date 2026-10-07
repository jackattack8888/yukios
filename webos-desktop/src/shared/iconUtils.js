import { SYSTEM_APPS } from "../AppRegistryConfig.js";
import { resolveIconUrl, resolvePapirusUrl } from "../shared/assetResolver.js";
import { $$ } from "./domUtils.js";
import { getEffectiveIcon } from "./iconPack.js";

export function isFontAwesomeIcon(icon) {
  return typeof icon === "string" && /^fa[bsr]?\s/.test(icon);
}

export function isPapirusIcon(icon) {
  return typeof icon === "string" && /^papirus:/.test(icon);
}

export function getPapirusUrl(icon, size = 48) {
  if (!isPapirusIcon(icon)) return null;
  return resolvePapirusUrl(icon, size);
}

export function resolveIconHtml(icon, options = {}) {
  const { faClass = "", faStyle = "", imgClass = "", alt = "", imgLoading = "lazy", size = 48 } = options;
  icon = getEffectiveIcon(icon);
  if (typeof icon === "string" && icon.startsWith("fa-") && !icon.includes(" ")) icon = "fas " + icon;
  if (isPapirusIcon(icon)) {
    const resolved = resolvePapirusUrl(icon, size);
    const bucket = [16, 22, 24, 32, 48, 64].includes(size) ? size : 48;
    const papirusClass = `papirus-icon papirus-icon--${bucket}${imgClass ? ` ${imgClass}` : ""}`;
    const altAttr = alt ? ` alt="${alt}"` : ` alt=""`;
    const loadingAttr = imgLoading ? ` loading="${imgLoading}"` : "";
    return `<img src="${resolved}" class="${papirusClass}"${altAttr}${loadingAttr} />`;
  }
  if (isFontAwesomeIcon(icon)) {
    const cls = faClass ? `${faClass} ${icon}` : icon;
    return `<i class="${cls}"${faStyle ? ` style="${faStyle}"` : ""}></i>`;
  }
  const altAttr = alt ? ` alt="${alt}"` : "";
  return `<img src="${icon}"${imgClass ? ` class="${imgClass}"` : ""}${altAttr}${imgLoading ? ` loading="${imgLoading}"` : ""} />`;
}

export function resolveDesktopIcon(content, fileName = null) {
  let icon = null;

  if (content) {
    try {
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      if (parsed) {
        if (parsed.type === "youtube-embed") {
          icon = resolveIconUrl("static/icons/youtube.webp");
        } else {
          icon = parsed.icon || parsed.path || SYSTEM_APPS[parsed.app]?.icon;
        }
      }
    } catch (e) {}
  }

  if (!icon && fileName && typeof document !== "undefined") {
    const label = fileName.replace(".desktop", "");
    const desktopIcons = $$(".icon.selectable:not(.desktop-file-icon)");
    const match = desktopIcons.find((i) => {
      const div = i.querySelector("div");
      return div && div.textContent.trim() === label;
    });

    if (match) {
      const img = match.querySelector("img");
      const fa = match.querySelector("i");
      if (img) icon = img.getAttribute("src");
      else if (fa) icon = Array.from(fa.classList).join(" ");
    }
  }

  if (!icon) {
    return resolveIconUrl("static/icons/file.webp");
  }

  icon = getEffectiveIcon(icon);

  if (isPapirusIcon(icon)) {
    return resolvePapirusUrl(icon, 48);
  }

  if (typeof icon === "string" && icon.startsWith("fa-") && !icon.includes(" ")) {
    icon = "fas " + icon;
  }

  if (
    typeof icon === "string" &&
    (isFontAwesomeIcon(icon) ||
      icon.startsWith("fa") ||
      icon.includes(" fa-") ||
      icon.startsWith("fas ") ||
      icon.startsWith("fab ") ||
      icon.startsWith("far "))
  ) {
    return icon;
  }

  if (typeof icon === "string" && (icon.startsWith("http") || icon.startsWith("/"))) {
    return icon;
  }

  return resolveIconUrl(icon);
}
