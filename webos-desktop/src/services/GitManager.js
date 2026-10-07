import { getLibraryUrl } from "../shared/cdnConfig.js";

let gitLibPromise = null;

function loadGitLib() {
  if (!gitLibPromise) {
    gitLibPromise = (async () => {
      if (__SINGLE_FILE__) {
        const git = await import(/* @vite-ignore */ getLibraryUrl("isomorphicGit", "module"));
        const httpMod = await import(/* @vite-ignore */ getLibraryUrl("isomorphicGit", "httpWeb"));
        return { git, http: httpMod.default || httpMod };
      }
      const git = await import("isomorphic-git");
      const httpMod = await import("isomorphic-git/http/web");
      return { git, http: httpMod.default || httpMod };
    })();
  }
  return gitLibPromise;
}

export class GitManager {
  constructor(fsManager) {
    this.fsManager = fsManager;
    this.storage = fsManager.storage;
    this.gitFs = null;
  }

  createFS() {
    if (this.gitFs) return this.gitFs;
    const storage = this.storage;

    const fs = {
      promises: {
        readFile: async (path, opts) => {
          const isUtf8 = opts === "utf8" || (opts && opts.encoding === "utf8");
          if (isUtf8) return await storage.pRead("readFile", path, "utf8");
          return await storage.pRead("readFile", path);
        },
        writeFile: async (path, data) => {
          const dataSize = data instanceof Uint8Array ? data.length : typeof data === "string" ? data.length : 0;
          try {
            await storage.p("unlink", path);
          } catch {}
          if (data instanceof Uint8Array) {
            await storage.p("writeFile", path, data);
          } else if (typeof data === "string") {
            await storage.p("writeFile", path, data);
          } else {
            await storage.p("writeFile", path, new Uint8Array(data));
          }
        },
        unlink: async (path) => {
          await storage.p("unlink", path);
        },
        readdir: async (path) => {
          return await storage.pRead("readdir", path);
        },
        mkdir: async (path, opts) => {
          if (opts && opts.recursive) {
            const segments = path.split("/").filter(Boolean);
            let current = "";
            for (const seg of segments) {
              current += "/" + seg;
              try {
                await storage.p("mkdir", current);
              } catch (e) {
                if (e.code !== "EEXIST") throw e;
              }
            }
          } else {
            await storage.p("mkdir", path, opts || {});
          }
        },
        rmdir: async (path) => {
          await storage.p("rmdir", path);
        },
        stat: async (path) => {
          const r = await storage.pStat(path);
          return {
            isDirectory: () => r.isDirectory(),
            isFile: () => r.isFile(),
            isSymbolicLink: () => false,
            size: r.size,
            mtime: r.mtime instanceof Date ? r.mtime : new Date(r.mtime),
            ctime: r.ctime instanceof Date ? r.ctime : new Date(r.ctime),
            mode: r.mode
          };
        },
        lstat: async (path) => {
          return await fs.promises.stat(path);
        },
        symlink: async () => {},
        readlink: async () => new Uint8Array(0),
        rename: async (oldPath, newPath) => {
          await storage.p("rename", oldPath, newPath);
        }
      }
    };

    this.gitFs = fs;
    return fs;
  }

  get fs() {
    return this.createFS();
  }

  async clone(url, dir, onProgress, depth) {
    const { git, http } = await loadGitLib();
    const opts = {
      fs: this.fs,
      http,
      dir,
      url,
      corsProxy: "https://cors.isomorphic-git.org",
      onProgress
    };
    if (depth > 0) opts.depth = depth;
    const result = await git.clone(opts);

    await this.storage.fsReady;
    await this.storage.resolveFs();

    return result;
  }

  async init(dir) {
    const { git, http } = await loadGitLib();
    const exists = await this.storage.exists(dir);
    if (!exists) {
      await this.storage.mkdir(dir, { recursive: true });
    }
    return await git.init({ fs: this.fs, dir });
  }

  async add(dir, filepath) {
    const { git, http } = await loadGitLib();
    return await git.add({ fs: this.fs, dir, filepath });
  }

  async remove(dir, filepath) {
    const { git, http } = await loadGitLib();
    return await git.remove({ fs: this.fs, dir, filepath });
  }

  async commit(dir, message, author) {
    const { git, http } = await loadGitLib();
    return await git.commit({ fs: this.fs, dir, author, message });
  }

  async status(dir, filepath) {
    const { git, http } = await loadGitLib();
    return await git.status({ fs: this.fs, dir, filepath });
  }

  async statusMatrix(dir) {
    const { git, http } = await loadGitLib();
    return await git.statusMatrix({ fs: this.fs, dir });
  }

  async log(dir, options = {}) {
    const { git, http } = await loadGitLib();
    return await git.log({ fs: this.fs, dir, ...options });
  }

  async branch(dir, name) {
    const { git, http } = await loadGitLib();
    return await git.branch({ fs: this.fs, dir, ref: name });
  }

  async listBranches(dir) {
    const { git, http } = await loadGitLib();
    return await git.listBranches({ fs: this.fs, dir });
  }

  async currentBranch(dir) {
    const { git, http } = await loadGitLib();
    return await git.currentBranch({ fs: this.fs, dir });
  }

  async checkout(dir, ref) {
    const { git, http } = await loadGitLib();
    return await git.checkout({ fs: this.fs, dir, ref });
  }

  async pull(dir, author, onAuth, onProgress) {
    const { git, http } = await loadGitLib();
    return await git.pull({
      fs: this.fs,
      http,
      dir,
      author,
      corsProxy: "https://cors.isomorphic-git.org",
      onAuth,
      onProgress
    });
  }

  async push(dir, onAuth, onProgress) {
    const { git, http } = await loadGitLib();
    return await git.push({
      fs: this.fs,
      http,
      dir,
      corsProxy: "https://cors.isomorphic-git.org",
      onAuth,
      onProgress
    });
  }

  async fetch(dir, onAuth, onProgress) {
    const { git, http } = await loadGitLib();
    return await git.fetch({
      fs: this.fs,
      http,
      dir,
      corsProxy: "https://cors.isomorphic-git.org",
      onAuth,
      onProgress
    });
  }

  async listRemotes(dir) {
    const { git, http } = await loadGitLib();
    return await git.listRemotes({ fs: this.fs, dir });
  }

  async addRemote(dir, remote, url) {
    const { git, http } = await loadGitLib();
    return await git.addRemote({ fs: this.fs, dir, remote, url });
  }

  async deleteRemote(dir, remote) {
    const { git, http } = await loadGitLib();
    return await git.deleteRemote({ fs: this.fs, dir, remote });
  }

  async listFiles(dir, ref) {
    const { git, http } = await loadGitLib();
    return await git.listFiles({ fs: this.fs, dir, ref });
  }

  async diff(dir) {
    const matrix = await this.statusMatrix(dir);
    const files = matrix.filter(([, head, workdir]) => head !== workdir);
    return files.map(([filepath]) => filepath);
  }

  async stash(dir) {
    const { git, http } = await loadGitLib();
    return await git.stash({ fs: this.fs, dir });
  }

  async stashPop(dir) {
    const { git, http } = await loadGitLib();
    return await git.stash({ fs: this.fs, dir, action: "pop" });
  }

  async findRoot(dir) {
    const { git, http } = await loadGitLib();
    return await git.findRoot({ fs: this.fs, dir });
  }

  async resolveRef(dir, ref) {
    const { git, http } = await loadGitLib();
    return await git.resolveRef({ fs: this.fs, dir, ref });
  }

  lsFiles(dir, ref) {
    return this.listFiles(dir, ref);
  }

  async isIgnored(dir, filepath) {
    const { git, http } = await loadGitLib();
    return await git.isIgnored({ fs: this.fs, dir, filepath });
  }
}
