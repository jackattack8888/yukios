import { os } from "../../framework.js";
import { FileKind } from "../../shared/fileKindDetector.js";
import { showTransferDialog } from "../../shared/transferDialog.js";

import { zipSync } from "fflate";
import { $, $$, setStyle } from "../../shared/domUtils.js";
import { pluralize, downloadBlob } from "../../utils/utils.js";
import { showArchiveDialog } from "./dialogs.js";

export async function copyItem(explorer, name, isFile, srcPath, destPath) {
  if (isFile) {
    const dialog = showTransferDialog({ title: "Copying", total: 1 });
    try {
      const kind = await explorer.fs.getFileKind(srcPath, name);
      const isBinary = kind === FileKind.IMAGE || kind === FileKind.VIDEO || kind === FileKind.AUDIO;

      const destDir = explorer.fs.resolveUserPath(destPath);
      const destFilePath = explorer.fs.join(destDir, name);
      const destExists = await os.fs.exists(destFilePath);

      let finalName = name;
      if (destExists) {
        finalName = await explorer.fs.getUniqueFileName(destPath, name);
      }

      if (isBinary) {
        const blob = await os.fs.readBinaryFile(srcPath, name);
        await os.fs.writeBinaryFile(destPath, finalName, blob, kind, null);
      } else {
        const content = await explorer.fs.getFileContent(srcPath, name);
        await os.fs.createFile(destPath, finalName, content, kind, null);
      }

      dialog.update(1, name);
      return finalName;
    } finally {
      dialog.complete();
    }
  } else {
    const srcEntries = await os.fs.readdir([...srcPath, name]).catch(() => ({}));
    const childNames = Object.keys(srcEntries).filter((childName) => srcEntries[childName]?.type === "file");
    const dialog = showTransferDialog({ title: `Copying "${name}"`, total: childNames.length });
    let cancelled = false;
    dialog.onCancel(() => {
      cancelled = true;
    });
    const uniqueName = await explorer.fs.getUniqueFileName(destPath, name);
    await os.fs.mkdir([...destPath, uniqueName]);
    try {
      let done = 0;
      for (const [childName, childData] of Object.entries(srcEntries)) {
        if (cancelled) break;
        if (childData?.type !== "file") continue;

        const childPath = [...srcPath, name];
        const childKind = await explorer.fs.getFileKind(childPath, childName);
        const isChildBinary =
          childKind === FileKind.IMAGE || childKind === FileKind.VIDEO || childKind === FileKind.AUDIO;

        let childContent;
        if (isChildBinary) {
          childContent = await os.fs.readBinaryFile(childPath, childName);
        } else {
          childContent = await explorer.fs.getFileContent(childPath, childName);
        }

        const destFolderPath = [...destPath, uniqueName];
        const destDir = explorer.fs.resolveUserPath(destFolderPath);
        const childExists = await os.fs.exists(explorer.fs.join(destDir, childName));
        const childFinalName = childExists ? await explorer.fs.getUniqueFileName(destFolderPath, childName) : childName;

        if (isChildBinary) {
          await os.fs.writeBinaryFile(destFolderPath, childFinalName, childContent, childKind, null);
        } else {
          await explorer.fs.createFile(destFolderPath, childFinalName, childContent, childKind, null);
        }

        done += 1;
        dialog.update(done, childName);
      }
    } finally {
      dialog.complete();
    }

    return uniqueName;
  }
}

export async function pasteToPath(explorer, destPath, inst) {
  const cb = explorer.getClipboard();
  if (!cb) return;

  const { action } = cb;
  let pastedCount = 0;
  const failedNames = [];
  const transferState = { cancelled: false };
  const totalItems = Array.isArray(cb.icons) ? cb.icons.length : 0;
  const dialog = showTransferDialog({ title: action === "cut" ? "Moving" : "Copying", total: totalItems });
  dialog.onCancel(() => {
    transferState.cancelled = true;
  });

  const copyFile = async (name, srcPath) => {
    const kind = await explorer.fs.getFileKind(srcPath, name);
    const isBinary = kind === FileKind.IMAGE || kind === FileKind.VIDEO || kind === FileKind.AUDIO;

    const destDir = explorer.fs.resolveUserPath(destPath);
    const destFilePath = explorer.fs.join(destDir, name);
    const destExists = await os.fs.exists(destFilePath);

    let finalName = name;
    if (destExists) {
      finalName = await explorer.fs.getUniqueFileName(destPath, name);
    }

    if (isBinary) {
      const blob = await os.fs.readBinaryFile(srcPath, name);
      await os.fs.writeBinaryFile(destPath, finalName, blob, kind, null);
    } else {
      const content = await explorer.fs.getFileContent(srcPath, name);
      await os.fs.createFile(destPath, finalName, content, kind, null);
    }

    return finalName;
  };

  const copyFolder = async (name, srcBasePath) => {
    const uniqueName = action === "copy" ? await explorer.fs.getUniqueFileName(destPath, name) : name;
    await os.fs.mkdir([...destPath, uniqueName]);
    const srcEntries = await os.fs.readdir([...srcBasePath, name]).catch(() => ({}));

    for (const [childName, childData] of Object.entries(srcEntries)) {
      if (transferState.cancelled) break;
      if (childData?.type !== "file") continue;

      const childPath = [...srcBasePath, name];
      const childKind = await explorer.fs.getFileKind(childPath, childName);
      const isChildBinary =
        childKind === FileKind.IMAGE || childKind === FileKind.VIDEO || childKind === FileKind.AUDIO;

      let childContent;
      if (isChildBinary) {
        childContent = await os.fs.readBinaryFile(childPath, childName);
      } else {
        childContent = await explorer.fs.getFileContent(childPath, childName);
      }

      const destFolderPath = [...destPath, uniqueName];
      const destDir = explorer.fs.resolveUserPath(destFolderPath);
      const childExists = await os.fs.exists(explorer.fs.join(destDir, childName));

      const childFinalName = childExists ? await explorer.fs.getUniqueFileName(destFolderPath, childName) : childName;

      if (isChildBinary) {
        await os.fs.writeBinaryFile(destFolderPath, childFinalName, childContent, childKind, null);
      } else {
        await explorer.fs.createFile(destFolderPath, childFinalName, childContent, childKind, null);
      }
    }

    return uniqueName;
  };

  try {
    if (cb.source === "explorer") {
      for (const iconData of cb.icons) {
        if (transferState.cancelled) break;
        const { name, path: srcPath, isFile } = iconData.data;
        try {
          if (isFile) {
            const result = await copyFile(name, srcPath);
            if (result !== null) {
              if (action === "cut") await os.fs.delete(srcPath, name);
              pastedCount++;
            }
          } else {
            await copyFolder(name, srcPath);
            if (action === "cut") await os.fs.delete(srcPath, name);
            pastedCount++;
          }
        } catch {
          failedNames.push(name);
        }
        dialog.update(pastedCount + failedNames.length, name);
      }

      if (action === "cut" && !transferState.cancelled) {
        explorer.setClipboard(null);
        if (cb.sourceInst) await explorer.renderInstance(cb.sourceInst);
      }
    } else if (cb.source === "desktop") {
      for (const iconData of cb.icons) {
        if (transferState.cancelled) break;
        const { isDesktopFile, isFolderIcon, fileName, folderName, app, name } = iconData.data;
        const displayName = isDesktopFile ? fileName : isFolderIcon ? folderName : `${name || app}.desktop`;
        try {
          if (isDesktopFile) {
            const result = await copyFile(fileName, ["Desktop"]);
            if (result !== null) {
              if (action === "cut") {
                await os.fs.delete(["Desktop"], fileName);
                iconData.element?.remove();
              }
              pastedCount++;
            }
          } else if (isFolderIcon) {
            await copyFolder(folderName, ["Desktop"]);
            if (action === "cut") {
              await os.fs.delete(["Desktop"], folderName);
              iconData.element?.remove();
            }
            pastedCount++;
          } else {
            const srcFileName = `${name || app}.desktop`;
            const result = await copyFile(srcFileName, ["Desktop"]);
            if (result !== null) {
              if (action === "cut") iconData.element?.remove();
              pastedCount++;
            }
          }
        } catch {
          failedNames.push(displayName);
        }
        dialog.update(pastedCount + failedNames.length, displayName);
      }

      if (action === "cut" && !transferState.cancelled) explorer.setClipboard(null);
    }
  } finally {
    dialog.complete();
  }

  if (transferState.cancelled) {
    os.notify.send("Paste cancelled");
  } else if (failedNames.length > 0) {
    os.notify.send(`Could not paste ${failedNames.length} ${pluralize(failedNames.length, "item")}`);
  }

  if (pastedCount > 0) {
    os.notify.send(`${pastedCount} ${pluralize(pastedCount, "item")} pasted`);
    await explorer.renderInstance(inst);
  }
}

export async function downloadItems(explorer, itemName, isFile, inst) {
  const effectiveItems =
    inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];

  if (effectiveItems.length === 1 && isFile) {
    const content = await os.fs.read([...inst.currentPath, itemName]);
    const data = content || (await explorer.fs.getFileContent(inst.currentPath, itemName)) || "";
    downloadBlob(new Blob([data]), itemName);
    return;
  }

  const folder = inst.cachedFolder || (await os.fs.readdir(inst.currentPath));
  const fileNames = effectiveItems.filter((name) => folder[name]?.type === "file");
  const dialog = showTransferDialog({ title: "Preparing download", total: fileNames.length });
  let cancelled = false;
  dialog.onCancel(() => {
    cancelled = true;
  });
  const zipEntries = {};

  try {
    let done = 0;
    for (const name of fileNames) {
      if (cancelled) break;
      const blob = await os.fs.read([...inst.currentPath, name]);
      if (blob) {
        zipEntries[name] = new Uint8Array(await blob.arrayBuffer());
      } else {
        const text = await explorer.fs.getFileContent(inst.currentPath, name);
        zipEntries[name] = new TextEncoder().encode(typeof text === "string" ? text : "");
      }
      done += 1;
      dialog.update(done, name);
    }

    if (cancelled) {
      os.notify.send("Download cancelled");
      return;
    }

    if (Object.keys(zipEntries).length === 0) return;

    const zipped = zipSync(zipEntries);
    downloadBlob(new Blob([zipped], { type: "application/zip" }), "archive.zip");
    os.notify.send("Download ready");
  } catch {
    os.notify.send("Download failed");
  } finally {
    dialog.complete();
  }
}

export async function createArchiveFromItems(explorer, itemName, isFile, inst) {
  const effectiveItems =
    inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];

  let defaultName = "archive";
  if (effectiveItems.length === 1) {
    const singleItem = effectiveItems[0];
    const dotIndex = singleItem.lastIndexOf(".");
    defaultName = dotIndex > 0 ? singleItem.substring(0, dotIndex) : singleItem;
  }

  showArchiveDialog({
    title: "Create Archive",
    defaultValue: defaultName,
    onConfirm: async (archiveName, archiveType, compressionLevel) => {
      const dialog = showTransferDialog({ title: `Creating "${archiveName}"` });
      let cancelled = false;
      dialog.onCancel(() => {
        cancelled = true;
      });

      try {
        const folder = inst.cachedFolder || (await os.fs.readdir(inst.currentPath));
        const items = effectiveItems.map((item) => ({
          path: inst.currentPath,
          name: item,
          isFile: folder[item]?.type === "file"
        }));

        dialog.update(0, archiveName);

        const result = await explorer.archiveExtractor.createArchive(items, {
          format: archiveType,
          compressionLevel,
          outputPath: inst.currentPath,
          archiveName
        });

        if (cancelled) return;

        if (result.success) {
          await explorer.renderInstance(inst);
          os.notify.send(`Archive "${result.name}" created`);
        }
      } catch {
        if (!cancelled) os.notify.send("Could not create archive");
      } finally {
        dialog.complete();
      }
    }
  });
}
