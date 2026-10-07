import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const requireFn = createRequire(import.meta.url);
const currentDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDir, "..");
const repoRoot = resolve(packageRoot, "..");
const repoFolderName = "webos-desktop";
const cacheLocation = ".prettier-cache";
const batchSize = 150;
const formattableExtensions = new Set([".js", ".jsx", ".css", ".json", ".html"]);

function runGit(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8", shell: false });
  if (result.error) return [];
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectChangedPaths() {
  const tracked = runGit(["diff", "--name-only", "HEAD", "--diff-filter=ACMR"]);
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])];
}

function toPackageRelativePaths(paths) {
  const prefix = `${repoFolderName}/`;
  return paths
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
    .filter(Boolean);
}

function isFormattable(relativePath) {
  const dotIndex = relativePath.lastIndexOf(".");
  if (dotIndex === -1) return false;
  if (!formattableExtensions.has(relativePath.slice(dotIndex).toLowerCase())) return false;
  return existsSync(join(packageRoot, relativePath));
}

function collectFormattableFiles() {
  const seen = new Set();
  const files = [];
  for (const relativePath of toPackageRelativePaths(collectChangedPaths())) {
    if (seen.has(relativePath)) continue;
    if (!isFormattable(relativePath)) continue;
    seen.add(relativePath);
    files.push(relativePath);
  }
  return files.sort();
}

function runPrettier(files) {
  const prettierBin = requireFn.resolve("prettier/bin/prettier.cjs");
  for (let start = 0; start < files.length; start += batchSize) {
    const batch = files.slice(start, start + batchSize);
    const result = spawnSync(
      process.execPath,
      [prettierBin, "--write", "--cache", `--cache-location=${cacheLocation}`, ...batch],
      { cwd: packageRoot, stdio: "inherit", shell: false }
    );
    if (result.status !== 0) {
      return result.status === null ? 1 : result.status;
    }
  }
  return 0;
}

const files = collectFormattableFiles();
if (files.length === 0) {
  console.log("No changed files to format.");
} else {
  console.log(`Formatting ${files.length} changed file(s)...`);
  process.exit(runPrettier(files));
}
