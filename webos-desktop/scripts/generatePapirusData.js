import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, lstatSync, readlinkSync } from "fs";
import { join, resolve, dirname, sep } from "path";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const generatedDirCandidates = [
  resolve(scriptDir, "../src/generated"),
  resolve(process.cwd(), "src/generated"),
  resolve(process.cwd(), "webos-desktop/src/generated"),
];
let generatedDir = generatedDirCandidates.find((p) => existsSync(p) || existsSync(dirname(p)));
if (!generatedDir) generatedDir = generatedDirCandidates[0];
for (const c of generatedDirCandidates) {
  if (c.includes("webos-desktop/src/generated") && existsSync(join(c, ".."))) {
    generatedDir = c;
    break;
  }
}
if (!generatedDir.includes("webos-desktop")) {
  const fallback = resolve(scriptDir, "../src/generated");
  if (existsSync(fallback) || existsSync(join(fallback, ".."))) generatedDir = fallback;
}
const availPath = join(generatedDir, "papirus-available.json");
const symPath = join(generatedDir, "papirus-symlinks.json");
const repoUrl = "https://github.com/PapirusDevelopmentTeam/papirus-icon-theme.git";

function scanPapirus(root) {
  const available = {};
  const symlinks = {};
  const papirusRoot = join(root, "Papirus");
  if (!existsSync(papirusRoot)) return { available, symlinks };

  const sizes = readdirSync(papirusRoot);
  for (const size of sizes) {
    const sizePath = join(papirusRoot, size);
    let st;
    try {
      st = lstatSync(sizePath);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (!/^\d+x\d+$/.test(size)) continue;
    const contexts = readdirSync(sizePath);
    for (const ctx of contexts) {
      const ctxPath = join(sizePath, ctx);
      try {
        st = lstatSync(ctxPath);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const files = readdirSync(ctxPath);
      for (const file of files) {
        if (!file.endsWith(".svg")) continue;
        const name = file.slice(0, -4);
        const key = `${ctx}/${name}`;
        const fullPath = join(ctxPath, file);
        let lst;
        try {
          lst = lstatSync(fullPath);
        } catch {
          continue;
        }
        if (lst.isSymbolicLink()) {
          let target;
          try {
            target = readlinkSync(fullPath);
          } catch {
            continue;
          }
          const targetCtx = dirname(target);
          const targetBase = target.endsWith(".svg") ? target.slice(0, -4) : target;
          let resolvedKey;
          if (targetCtx === "." || targetCtx === "") {
            resolvedKey = `${ctx}/${targetBase}`;
          } else if (target.startsWith("/")) {
            resolvedKey = target.slice(1).replace(/\.svg$/, "");
          } else {
            const combined = join(ctx, targetBase);
            resolvedKey = combined.split(sep).join("/");
          }
          if (!symlinks[key]) symlinks[key] = resolvedKey;
        } else {
          if (!available[key]) available[key] = [];
          if (!available[key].includes(size)) available[key].push(size);
        }
      }
    }
  }

  for (const k of Object.keys(available)) {
    available[k].sort((a, b) => {
      const an = parseInt(a.split("x")[0], 10);
      const bn = parseInt(b.split("x")[0], 10);
      return an - bn;
    });
  }

  return { available, symlinks };
}

function main() {
  const tmpRoot = join(tmpdir(), `papirus-${Date.now()}`);
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {}

  console.log(`[papirus] cloning ${repoUrl} to ${tmpRoot}`);
  const clone = spawnSync("git", ["clone", "--depth", "1", repoUrl, tmpRoot], {
    stdio: "inherit",
  });
  if (clone.status !== 0) {
    console.error("[papirus] git clone failed");
    process.exit(1);
  }

  const { available, symlinks } = scanPapirus(tmpRoot);

  if (Object.keys(available).length === 0) {
    console.error("[papirus] no icons found, abort");
    process.exit(1);
  }

  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(availPath, JSON.stringify(available), "utf-8");
  writeFileSync(symPath, JSON.stringify(symlinks), "utf-8");
  console.log(`[papirus] wrote ${availPath} (${Object.keys(available).length} icons)`);
  console.log(`[papirus] wrote ${symPath} (${Object.keys(symlinks).length} symlinks)`);

  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {}
}

main();
