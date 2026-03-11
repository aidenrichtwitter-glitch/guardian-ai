import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

function fileWritePlugin(): Plugin {
  return {
    name: "file-write",
    configureServer(server) {
      server.middlewares.use("/api/write-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath, content } = JSON.parse(body);
          if (!filePath || typeof content !== "string") { res.statusCode = 400; res.end("Missing filePath or content"); return; }

          const fs = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) { res.statusCode = 403; res.end("Path outside project"); return; }

          const dir = path.dirname(resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          let previousContent = "";
          if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, "utf-8");

          fs.writeFileSync(resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/read-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath } = JSON.parse(body);
          if (!filePath) { res.statusCode = 400; res.end("Missing filePath"); return; }

          const fs = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) { res.statusCode = 403; res.end("Path outside project"); return; }

          const exists = fs.existsSync(resolved);
          const content = exists ? fs.readFileSync(resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    },
  };
}

function projectManagementPlugin(): Plugin {
  return {
    name: "project-management",
    configureServer(server) {
      async function readBody(req: any): Promise<string> {
        let body = "";
        for await (const chunk of req) body += chunk;
        return body;
      }

      function validateProjectPath(projectName: string, filePath?: string): { valid: boolean; resolved: string; error?: string } {
        const projectRoot = process.cwd();
        if (projectName === "__main__") {
          if (!filePath) return { valid: true, resolved: projectRoot };
          const BLOCKED_MAIN_DIRS = new Set(["node_modules", ".git", "projects", ".local", ".agents", ".upm", ".config", ".cache", "dist", "attached_assets", "path", ".replit"]);
          const BLOCKED_MAIN_FILES = new Set([".env", ".env.local", ".env.development", ".env.production", ".gitattributes", ".gitignore", "bun.lock", "package-lock.json"]);
          const firstSeg = filePath.split(/[\/\\]/)[0];
          if (BLOCKED_MAIN_DIRS.has(firstSeg)) return { valid: false, resolved: "", error: "Access to this directory is blocked" };
          const fileName = filePath.split(/[\/\\]/).pop() || "";
          if (BLOCKED_MAIN_FILES.has(fileName) && !filePath.includes("/")) return { valid: false, resolved: "", error: "Access to this file is blocked" };
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
            return { valid: false, resolved: "", error: "File path traversal blocked" };
          }
          return { valid: true, resolved };
        }
        const projectsDir = path.resolve(projectRoot, "projects");
        if (!projectName || /[\/\\]|\.\./.test(projectName) || projectName === '.' || projectName.startsWith('.')) {
          return { valid: false, resolved: "", error: "Invalid project name" };
        }
        const projectDir = path.resolve(projectsDir, projectName);
        if (!projectDir.startsWith(projectsDir + path.sep) && projectDir !== projectsDir) {
          return { valid: false, resolved: "", error: "Path traversal blocked" };
        }
        if (filePath) {
          const resolved = path.resolve(projectDir, filePath);
          if (!resolved.startsWith(projectDir + path.sep) && resolved !== projectDir) {
            return { valid: false, resolved: "", error: "File path traversal blocked" };
          }
          return { valid: true, resolved };
        }
        return { valid: true, resolved: projectDir };
      }

      server.middlewares.use("/api/projects/list", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const fs = await import("fs");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) {
            fs.mkdirSync(projectsDir, { recursive: true });
          }
          const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
          const projects = entries
            .filter((e: any) => e.isDirectory())
            .map((e: any) => {
              const projPath = path.join(projectsDir, e.name);
              const pkgPath = path.join(projPath, "package.json");
              let description = "";
              let framework = "react";
              if (fs.existsSync(pkgPath)) {
                try {
                  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                  description = pkg.description || "";
                  framework = pkg._framework || "react";
                } catch {}
              }
              const stat = fs.statSync(projPath);
              return {
                name: e.name,
                path: `projects/${e.name}`,
                createdAt: stat.birthtime.toISOString(),
                framework,
                description,
              };
            });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, projects }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/create", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const body = JSON.parse(await readBody(req));
          const { name, framework = "react", description = "" } = body;
          if (!name || typeof name !== "string") { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          const projectDir = check.resolved;
          if (fs.existsSync(projectDir)) { res.statusCode = 409; res.end(JSON.stringify({ success: false, error: "Project already exists" })); return; }

          fs.mkdirSync(projectDir, { recursive: true });

          const pkgJson = JSON.stringify({
            name,
            version: "0.0.1",
            private: true,
            description,
            _framework: framework,
          }, null, 2);
          fs.writeFileSync(path.join(projectDir, "package.json"), pkgJson, "utf-8");

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, framework, description, path: `projects/${name}` }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/delete", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }

          fs.rmSync(check.resolved, { recursive: true, force: true });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/files-main", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const fs = await import("fs");
          const rootDir = process.cwd();
          const SKIP_DIRS = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "projects", "attached_assets", ".local", ".agents", ".upm", ".config", "path", ".replit"]);
          function walkDir(dir: string, base: string, maxDepth: number): any[] {
            if (maxDepth <= 0) return [];
            let names: string[];
            try { names = fs.readdirSync(dir); } catch { return []; }
            const result: any[] = [];
            for (const name of names) {
              if (name === ".DS_Store" || name === "bun.lock" || name === "package-lock.json") continue;
              const fullPath = path.join(dir, name);
              const relPath = base ? base + "/" + name : name;
              try {
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                  if (SKIP_DIRS.has(name)) continue;
                  const children = walkDir(fullPath, relPath, maxDepth - 1);
                  result.push({ name, path: relPath, type: "directory", children });
                } else if (stat.isFile()) {
                  result.push({ name, path: relPath, type: "file" });
                }
              } catch {}
            }
            return result.sort((a: any, b: any) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "directory" ? -1 : 1;
            });
          }
          const tree = walkDir(rootDir, "", 6);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name: "__main__", files: tree }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/files", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }

          const SKIP_DIRS = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache"]);
          function walkDir(dir: string, base: string): any[] {
            let names: string[];
            try {
              names = fs.readdirSync(dir);
            } catch {
              return [];
            }
            const result: any[] = [];
            for (const name of names) {
              if (name === ".DS_Store") continue;
              const fullPath = path.join(dir, name);
              const relPath = base ? base + "/" + name : name;
              try {
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                  if (SKIP_DIRS.has(name)) continue;
                  const children = walkDir(fullPath, relPath);
                  result.push({ name, path: relPath, type: "directory", children });
                } else if (stat.isFile()) {
                  result.push({ name, path: relPath, type: "file" });
                }
              } catch {}
            }
            return result.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "directory" ? -1 : 1;
            });
          }

          const tree = walkDir(check.resolved, "");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, files: tree }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/read-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, filePath } = JSON.parse(await readBody(req));
          if (!name || !filePath) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing name or filePath" })); return; }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          const exists = fs.existsSync(check.resolved);
          const content = exists ? fs.readFileSync(check.resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content, filePath }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/write-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, filePath, content } = JSON.parse(await readBody(req));
          if (!name || !filePath || typeof content !== "string") { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing name, filePath, or content" })); return; }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          const dir = path.dirname(check.resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          let previousContent = "";
          if (fs.existsSync(check.resolved)) previousContent = fs.readFileSync(check.resolved, "utf-8");

          fs.writeFileSync(check.resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      const previewProcesses = new Map<string, { process: any; port: number }>();
      const projectPort = (name: string): number => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        return 5100 + (((hash % 100) + 100) % 100);
      };

      server.middlewares.use("/api/projects/preview", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid project name" })); return; }

          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ error: "Project not found" })); return; }

          if (previewProcesses.has(name)) {
            const existing = previewProcesses.get(name)!;
            const processAlive = existing.process && !existing.process.killed && existing.process.exitCode === null;
            if (processAlive) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ port: existing.port, reused: true }));
              return;
            }
            previewProcesses.delete(name);
            console.log(`[Preview] Cleaned up dead process entry for ${name}`);
          }

          let port = projectPort(name);
          const usedPorts = new Set([...previewProcesses.values()].map(e => e.port));
          while (usedPorts.has(port)) port++;
          const { spawn, execSync } = await import("child_process");

          const net = await import("net");
          const portInUse = await new Promise<boolean>((resolve) => {
            const tester = net.createServer().once("error", (err: any) => {
              resolve(err.code === "EADDRINUSE");
            }).once("listening", () => {
              tester.close(() => resolve(false));
            }).listen(port);
          });
          if (portInUse) {
            console.log(`[Preview] Port ${port} still in use — killing`);
            try {
              if (process.platform === "win32") {
                try {
                  const out = execSync(`netstat -ano | findstr :${port}`, { stdio: "pipe", encoding: "utf-8", windowsHide: true });
                  const pids = new Set(out.split("\n").map((l: string) => l.trim().split(/\s+/).pop()).filter((p: any) => p && /^\d+$/.test(p) && p !== "0"));
                  for (const pid of pids) { console.log(`[Preview] Killing PID ${pid} on port ${port}`); try { execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {} }
                } catch {}
              } else {
                const netTcp = fs.readFileSync("/proc/net/tcp", "utf-8") + fs.readFileSync("/proc/net/tcp6", "utf-8");
                const portHex = port.toString(16).toUpperCase().padStart(4, "0");
                const lines = netTcp.split("\n").filter(l => l.includes(`:${portHex} `) && l.includes("0A"));
                for (const line of lines) {
                  const cols = line.trim().split(/\s+/);
                  const inode = cols[9];
                  if (!inode || inode === "0") continue;
                  const procDirs = fs.readdirSync("/proc").filter((d: string) => /^\d+$/.test(d));
                  for (const pid of procDirs) {
                    try {
                      const fds = fs.readdirSync(`/proc/${pid}/fd`);
                      for (const fd of fds) {
                        try {
                          const link = fs.readlinkSync(`/proc/${pid}/fd/${fd}`);
                          if (link === `socket:[${inode}]`) {
                            console.log(`[Preview] Killing PID ${pid} on port ${port}`);
                            try { process.kill(-parseInt(pid), 9); } catch {}
                            try { process.kill(parseInt(pid), 9); } catch {}
                          }
                        } catch {}
                      }
                    } catch {}
                  }
                }
              }
            } catch (e: any) { console.log(`[Preview] Port cleanup error: ${e.message}`); }
            await new Promise(r => setTimeout(r, 800));
          }

          const hasPkg = fs.existsSync(path.join(projectDir, "package.json"));
          const hasNodeModules = fs.existsSync(path.join(projectDir, "node_modules"));

          let pkg: any = {};
          if (hasPkg) {
            try { pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8")); } catch {}
          }

          const detectPackageManager = (): string => {
            if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) return "bun";
            if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
            if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
            return "npm";
          };

          const pm = detectPackageManager();

          if (hasPkg && !hasNodeModules) {
            try {
              const { execSync } = await import("child_process");
              const installCmd = pm === "npm" ? "npm install --legacy-peer-deps"
                : pm === "pnpm" ? "npx pnpm install --no-frozen-lockfile"
                : pm === "yarn" ? "npx yarn install --ignore-engines"
                : "npx bun install";
              console.log(`[Preview] Installing deps for ${name} with: ${installCmd}`);
              execSync(installCmd, { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
              console.log(`[Preview] Deps installed for ${name}`);
            } catch (installErr: any) {
              console.error(`[Preview] Install failed for ${name}:`, installErr.message?.slice(0, 300));
              try {
                const { execSync } = await import("child_process");
                console.log(`[Preview] Retrying with npm for ${name}`);
                execSync("npm install --legacy-peer-deps", { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
              } catch (retryErr: any) {
                console.error(`[Preview] Retry also failed for ${name}:`, retryErr.message?.slice(0, 300));
              }
            }
          }

          const detectDevCommand = (): { cmd: string; args: string[] } => {
            const scripts = pkg.scripts || {};
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            const portStr = String(port);

            const matchScript = (scriptBody: string): { cmd: string; args: string[] } | null => {
              if (scriptBody.includes("next")) return { cmd: "npx", args: ["next", "dev", "--port", portStr, "--hostname", "0.0.0.0"] };
              if (scriptBody.includes("react-scripts")) return { cmd: "npx", args: ["react-scripts", "start"] };
              if (scriptBody.includes("nuxt")) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
              if (scriptBody.includes("astro")) return { cmd: "npx", args: ["astro", "dev", "--port", portStr, "--host", "0.0.0.0"] };
              if (scriptBody.includes("ng ") || scriptBody.includes("ng serve")) return { cmd: "npx", args: ["ng", "serve", "--host", "0.0.0.0", "--port", portStr, "--disable-host-check"] };
              if (scriptBody.includes("remix")) return { cmd: "npx", args: ["remix", "vite:dev", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("gatsby")) return { cmd: "npx", args: ["gatsby", "develop", "-H", "0.0.0.0", "-p", portStr] };
              if (scriptBody.includes("webpack")) {
                const wpArgs = ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr];
                const cfgM = scriptBody.match(/(?:--config[=\s]|-c\s)(\S+)/);
                if (cfgM) wpArgs.splice(2, 0, "--config", cfgM[1]);
                return { cmd: "npx", args: wpArgs };
              }
              if (scriptBody.includes("rspack")) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("svelte") || scriptBody.includes("sveltekit")) return null;
              if (scriptBody.includes("vue-cli-service")) return { cmd: "npx", args: ["vue-cli-service", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("parcel")) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("ember")) return { cmd: "npx", args: ["ember", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("vite")) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
              return null;
            };

            const extractDevServerCmd = (scriptBody: string): string => {
              let cleaned = scriptBody;
              cleaned = cleaned.replace(/^cross-env\s+[\w=]+\s*/g, "");
              cleaned = cleaned.replace(/^dotenv\s+(-e\s+\S+\s+)*--\s*/g, "");
              cleaned = cleaned.replace(/^env-cmd\s+(-f\s+\S+\s+)*/g, "");
              if (cleaned.includes("concurrently")) {
                const parts = cleaned.match(/"([^"]+)"|'([^']+)'/g);
                if (parts) {
                  for (const part of parts) {
                    const inner = part.replace(/^["']|["']$/g, "");
                    const matched = matchScript(inner);
                    if (matched) return inner;
                  }
                }
                return cleaned;
              }
              if (cleaned.includes("&&")) {
                const segments = cleaned.split("&&").map(s => s.trim());
                for (const seg of segments) {
                  if (/^tsc\b|^tsc-watch|^node\s|^echo\b|^rm\s|^cp\s|^mkdir\s/.test(seg)) continue;
                  const matched = matchScript(seg);
                  if (matched) return seg;
                }
                const lastSeg = segments[segments.length - 1];
                return lastSeg || cleaned;
              }
              if (cleaned.includes("||")) {
                const segments = cleaned.split("||").map(s => s.trim());
                for (const seg of segments) {
                  const matched = matchScript(seg);
                  if (matched) return seg;
                }
              }
              return cleaned;
            };

            const isSvelteKit = deps["@sveltejs/kit"] || deps["sveltekit"];
            const isPnpmMonorepo = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));

            if (isPnpmMonorepo) {
              try {
                const wsYaml = fs.readFileSync(path.join(projectDir, "pnpm-workspace.yaml"), "utf-8");
                const hasPackages = wsYaml.includes("packages:");
                if (hasPackages) {
                  for (const key of Object.keys(scripts)) {
                    if (scripts[key].includes("--filter") && (key.includes("dev") || key === "lp:dev")) {
                      console.log(`[Preview] Detected pnpm monorepo, using script "${key}": ${scripts[key]}`);
                      return { cmd: pm === "pnpm" ? "pnpm" : "npx pnpm", args: ["run", key] };
                    }
                  }
                }
              } catch {}
            }

            if (scripts.dev) {
              if (isSvelteKit) {
                return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
              }
              const extracted = extractDevServerCmd(scripts.dev);
              const matched = matchScript(extracted);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }

            if (scripts.start) {
              const extracted = extractDevServerCmd(scripts.start);
              const matched = matchScript(extracted);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "start"] : ["run", "start"] };
            }

            if (scripts.serve || scripts["serve:rspack"]) {
              const serveScript = scripts.serve || scripts["serve:rspack"];
              const extracted = extractDevServerCmd(serveScript);
              const matched = matchScript(extracted);
              if (matched) return matched;
              const serveKey = scripts.serve ? "serve" : "serve:rspack";
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", serveKey] : ["run", serveKey] };
            }

            for (const key of ["develop", "dev:app", "dev:client", "dev:frontend", "dev:web", "watch"]) {
              if (scripts[key]) {
                const extracted = extractDevServerCmd(scripts[key]);
                const matched = matchScript(extracted);
                if (matched) return matched;
                return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", key] : ["run", key] };
              }
            }

            if (deps["next"]) return { cmd: "npx", args: ["next", "dev", "--port", portStr, "--hostname", "0.0.0.0"] };
            if (deps["react-scripts"]) return { cmd: "npx", args: ["react-scripts", "start"] };
            if (deps["nuxt"]) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
            if (deps["astro"]) return { cmd: "npx", args: ["astro", "dev", "--port", portStr, "--host", "0.0.0.0"] };
            if (deps["@angular/cli"]) return { cmd: "npx", args: ["ng", "serve", "--host", "0.0.0.0", "--port", portStr, "--disable-host-check"] };
            if (deps["@remix-run/dev"]) return { cmd: "npx", args: ["remix", "vite:dev", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["gatsby"]) return { cmd: "npx", args: ["gatsby", "develop", "-H", "0.0.0.0", "-p", portStr] };
            if (deps["webpack-dev-server"]) return { cmd: "npx", args: ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["@rspack/cli"] || deps["@rspack/core"]) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["parcel"]) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
            if (isSvelteKit) return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };

            if (fs.existsSync(path.join(projectDir, "vite.config.ts")) || fs.existsSync(path.join(projectDir, "vite.config.js")) || fs.existsSync(path.join(projectDir, "vite.config.mjs"))) {
              return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
            }

            if (!hasPkg) {
              const hasAnyHtml = fs.existsSync(path.join(projectDir, "index.html")) || 
                (fs.readdirSync(projectDir).some((f: string) => f.endsWith(".html")));
              if (hasAnyHtml) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
            }

            return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
          };

          if (!hasPkg) {
            let hasRootIndex = fs.existsSync(path.join(projectDir, "index.html"));
            if (!hasRootIndex) {
              try {
                const dirFiles = fs.readdirSync(projectDir);
                const htmlFiles = dirFiles.filter((f: string) => f.endsWith(".html") && f !== "index.html");
                if (htmlFiles.length > 0) {
                  const primaryHtml = htmlFiles[0];
                  const redirectContent = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/${primaryHtml}"><title>Redirect</title></head><body><a href="/${primaryHtml}">Open</a></body></html>`;
                  fs.writeFileSync(path.join(projectDir, "index.html"), redirectContent);
                  hasRootIndex = true;
                  console.log(`[Preview] Created index.html redirect to ${primaryHtml} for ${name}`);
                }
              } catch {}
            }
            if (hasRootIndex) {
              console.log(`[Preview] Static HTML project detected for ${name}, bootstrapping with vite`);
              const minPkg = { name, private: true, devDependencies: { vite: "^5" } };
              fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify(minPkg, null, 2));
              try {
                const { execSync: es } = await import("child_process");
                es("npm install", { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
              } catch (e: any) {
                console.log(`[Preview] Static HTML bootstrap install warning: ${e.message?.slice(0, 200)}`);
              }
              pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
            }
          }

          const patchPortInEnvFiles = () => {
            const envFiles = [".env", ".env.local", ".env.development", ".env.development.local"];
            for (const envFile of envFiles) {
              const envPath = path.join(projectDir, envFile);
              if (!fs.existsSync(envPath)) continue;
              try {
                let content = fs.readFileSync(envPath, "utf-8");
                let changed = false;
                if (/^PORT\s*=/m.test(content)) {
                  content = content.replace(/^PORT\s*=.*/m, `PORT=${port}`);
                  changed = true;
                }
                if (/^HOST\s*=/m.test(content)) {
                  content = content.replace(/^HOST\s*=.*/m, `HOST=0.0.0.0`);
                  changed = true;
                }
                if (changed) {
                  fs.writeFileSync(envPath, content);
                  console.log(`[Preview] Patched port/host in ${envFile} for ${name}`);
                }
              } catch {}
            }
          };
          patchPortInEnvFiles();

          const patchViteConfig = async () => {
            const viteConfigNames = ["vite.config.ts", "vite.config.js", "vite.config.mjs"];
            for (const vcName of viteConfigNames) {
              const vcPath = path.join(projectDir, vcName);
              if (!fs.existsSync(vcPath)) continue;
              try {
                let content = fs.readFileSync(vcPath, "utf-8");
                let changed = false;

                const isLibraryMode = /build\s*:\s*\{[\s\S]*?lib\s*:/m.test(content);
                if (isLibraryMode) {
                  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}) };
                  const hasReact = !!allDeps["react"];
                  const hasVue = !!allDeps["vue"];
                  const hasSvelte = !!allDeps["svelte"];
                  const hasReactPlugin = content.includes("plugin-react");
                  const hasVuePlugin = content.includes("plugin-vue");

                  if (hasReact && !hasReactPlugin) {
                    const pluginPkg = "@vitejs/plugin-react";
                    try {
                      const { execSync: es } = await import("child_process");
                      const missingLibPkgs: string[] = [];
                      if (!fs.existsSync(path.join(projectDir, "node_modules", "@vitejs/plugin-react"))) missingLibPkgs.push(pluginPkg);
                      if (!fs.existsSync(path.join(projectDir, "node_modules", "react-dom"))) missingLibPkgs.push("react-dom");
                      if (!fs.existsSync(path.join(projectDir, "node_modules", "react"))) missingLibPkgs.push("react");
                      if (missingLibPkgs.length > 0) {
                        console.log(`[Preview] Library-mode config for ${name}, installing: ${missingLibPkgs.join(", ")}`);
                        const installCmd = pm === "pnpm" ? `pnpm add -D ${missingLibPkgs.join(" ")}` : pm === "yarn" ? `yarn add -D ${missingLibPkgs.join(" ")}` : pm === "bun" ? `bun add -D ${missingLibPkgs.join(" ")}` : `npm install --save-dev --legacy-peer-deps ${missingLibPkgs.join(" ")}`;
                        es(installCmd, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
                      }
                    } catch (e: any) {
                      console.log(`[Preview] Failed to install lib-mode deps: ${e.message?.slice(0, 150)}`);
                    }
                    content = `import { defineConfig } from 'vite'\nimport react from '${pluginPkg}'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`;
                    changed = true;
                    console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode with React plugin for ${name}`);
                  } else if (hasVue && !hasVuePlugin) {
                    content = `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\n\nexport default defineConfig({\n  plugins: [vue()],\n})\n`;
                    changed = true;
                    console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode with Vue plugin for ${name}`);
                  } else if (!hasReact && !hasVue && !hasSvelte) {
                    content = `import { defineConfig } from 'vite'\n\nexport default defineConfig({})\n`;
                    changed = true;
                    console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode for ${name}`);
                  }
                }

                if (!changed) {
                  const portMatch = content.match(/port\s*:\s*(\d+)/);
                  if (portMatch && portMatch[1] !== String(port)) {
                    content = content.replace(/port\s*:\s*\d+/, `port: ${port}`);
                    changed = true;
                  }
                  if (/host\s*:\s*['"]localhost['"]/.test(content)) {
                    content = content.replace(/host\s*:\s*['"]localhost['"]/, `host: '0.0.0.0'`);
                    changed = true;
                  }
                  if (/open\s*:\s*true/.test(content)) {
                    content = content.replace(/open\s*:\s*true/g, "open: false");
                    changed = true;
                  }
                }

                if (changed) {
                  fs.writeFileSync(vcPath, content);
                  console.log(`[Preview] Patched ${vcName} for ${name}`);
                }
              } catch {}
            }
          };
          await patchViteConfig();

          const fixPostCSSAndTailwind = async () => {
            const isESM = pkg.type === "module";
            const postcssConfigs = ["postcss.config.js", "postcss.config.mjs", "postcss.config.cjs"];
            for (const pcName of postcssConfigs) {
              const pcPath = path.join(projectDir, pcName);
              if (!fs.existsSync(pcPath)) continue;
              try {
                const content = fs.readFileSync(pcPath, "utf-8");
                if (isESM && content.includes("module.exports") && !pcName.endsWith(".cjs")) {
                  const newName = pcName.replace(/\.(js|ts|mjs)$/, ".cjs");
                  const newPath = path.join(projectDir, newName);
                  fs.renameSync(pcPath, newPath);
                  console.log(`[Preview] Renamed ${pcName} -> ${newName} (ESM project uses module.exports)`);
                }
                if (!isESM && content.includes("export default") && !pcName.endsWith(".mjs")) {
                  const newName = pcName.replace(/\.(js|ts|cjs)$/, ".mjs");
                  const newPath = path.join(projectDir, newName);
                  fs.renameSync(pcPath, newPath);
                  console.log(`[Preview] Renamed ${pcName} -> ${newName} (CJS project uses export default)`);
                }
                const refsTailwind = content.includes("tailwindcss");
                const refsAutoprefixer = content.includes("autoprefixer");
                const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                const missingPkgs: string[] = [];
                if (refsTailwind && !allDeps["tailwindcss"]) missingPkgs.push("tailwindcss");
                if (refsAutoprefixer && !allDeps["autoprefixer"]) missingPkgs.push("autoprefixer");
                if (missingPkgs.length > 0) {
                  try {
                    const { execSync: es } = await import("child_process");
                    const installCmd = pm === "npm" ? `npm install --save-dev --legacy-peer-deps ${missingPkgs.join(" ")}` : `npx ${pm} add -D ${missingPkgs.join(" ")}`;
                    console.log(`[Preview] Installing missing PostCSS deps: ${missingPkgs.join(", ")}`);
                    es(installCmd, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
                  } catch (e: any) {
                    console.log(`[Preview] PostCSS dep install warning: ${e.message?.slice(0, 200)}`);
                  }
                }
              } catch {}
            }
            const tailwindConfigs = ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs"];
            for (const twName of tailwindConfigs) {
              const twPath = path.join(projectDir, twName);
              if (!fs.existsSync(twPath)) continue;
              try {
                const content = fs.readFileSync(twPath, "utf-8");
                if (isESM && content.includes("module.exports") && !twName.endsWith(".cjs")) {
                  const newName = twName.replace(/\.(js|ts|mjs)$/, ".cjs");
                  fs.renameSync(twPath, path.join(projectDir, newName));
                  console.log(`[Preview] Renamed ${twName} -> ${newName} (ESM compat)`);
                }
              } catch {}
            }
          };
          await fixPostCSSAndTailwind();

          const devCmd = detectDevCommand();
          console.log(`[Preview] Starting ${name} with: ${devCmd.cmd} ${devCmd.args.join(" ")}`);

          const isPnpmMonorepo = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));
          if (isPnpmMonorepo) {
            const scripts = pkg.scripts || {};
            const buildScript = scripts["packages:build"] || scripts.build;
            if (buildScript && (buildScript.includes("--filter") || buildScript.includes("packages"))) {
              const buildKey = scripts["packages:build"] ? "packages:build" : "build";
              console.log(`[Preview] Pre-building pnpm monorepo packages with: pnpm run ${buildKey}`);
              try {
                const { execSync: execSyncBuild } = await import("child_process");
                execSyncBuild(`pnpm run ${buildKey}`, { cwd: projectDir, stdio: "pipe", timeout: 90000, windowsHide: true });
                console.log(`[Preview] Monorepo packages built successfully`);
              } catch (e: any) {
                console.log(`[Preview] Monorepo package build warning: ${e.message?.slice(0, 200)}`);
              }
            }
          }

          const consoleBridgeScript = `<script data-guardian-console-bridge>
(function() {
  if (window.__guardianConsoleBridge) return;
  window.__guardianConsoleBridge = true;
  var origLog = console.log, origWarn = console.warn, origError = console.error, origInfo = console.info;
  function send(level, args, stack) {
    try {
      var serialized = [];
      for (var i = 0; i < args.length; i++) {
        try { serialized.push(typeof args[i] === 'object' ? JSON.parse(JSON.stringify(args[i])) : args[i]); }
        catch(e) { serialized.push(String(args[i])); }
      }
      window.parent.postMessage({ type: 'guardian-console-bridge', level: level, args: serialized, stack: stack || null }, '*');
    } catch(e) {}
  }
  console.log = function() { send('log', Array.prototype.slice.call(arguments)); origLog.apply(console, arguments); };
  console.warn = function() { send('warn', Array.prototype.slice.call(arguments)); origWarn.apply(console, arguments); };
  console.error = function() { send('error', Array.prototype.slice.call(arguments)); origError.apply(console, arguments); };
  console.info = function() { send('info', Array.prototype.slice.call(arguments)); origInfo.apply(console, arguments); };
  window.onerror = function(msg, source, line, column, error) {
    send('error', [String(msg)], error && error.stack ? error.stack : null);
    return false;
  };
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var msg = reason instanceof Error ? reason.message : String(reason);
    var stack = reason instanceof Error ? reason.stack : null;
    send('error', ['Unhandled Promise Rejection: ' + msg], stack);
  });
})();
</script>`;

          const indexHtmlPaths = [
            path.join(projectDir, "index.html"),
            path.join(projectDir, "public", "index.html"),
            path.join(projectDir, "src", "index.html"),
          ];
          for (const indexHtmlPath of indexHtmlPaths) {
            if (fs.existsSync(indexHtmlPath)) {
              const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
              if (!indexHtml.includes("guardian-console-bridge")) {
                const patched = indexHtml.replace(/<head([^>]*)>/, `<head$1>\n${consoleBridgeScript}`);
                if (patched !== indexHtml) {
                  fs.writeFileSync(indexHtmlPath, patched, "utf-8");
                  console.log(`[Preview] Injected console bridge into ${name}/${path.relative(projectDir, indexHtmlPath)}`);
                }
              }
            }
          }

          for (const indexHtmlPath of indexHtmlPaths) {
            if (fs.existsSync(indexHtmlPath)) {
              try {
                const indexContent = fs.readFileSync(indexHtmlPath, "utf-8");
                const scriptMatch = indexContent.match(/src=["']\/?(src\/[^"']+\.tsx?)["']/);
                if (scriptMatch) {
                  const entryFile = path.join(projectDir, scriptMatch[1]);
                  if (!fs.existsSync(entryFile)) {
                    const entryDir = path.dirname(entryFile);
                    if (!fs.existsSync(entryDir)) fs.mkdirSync(entryDir, { recursive: true });
                    const ext = entryFile.endsWith(".tsx") ? "tsx" : "ts";
                    if (ext === "tsx") {
                      fs.writeFileSync(entryFile, `import { createRoot } from "react-dom/client";\n\nfunction App() {\n  return (\n    <div style={{ fontFamily: "system-ui", padding: 32, textAlign: "center" }}>\n      <h1>Project Ready</h1>\n      <p>Edit <code>${scriptMatch[1]}</code> to get started.</p>\n    </div>\n  );\n}\n\ncreateRoot(document.getElementById("root")!).render(<App />);\n`);
                    } else {
                      fs.writeFileSync(entryFile, `document.getElementById("root")!.innerHTML = "<h1>Project Ready</h1><p>Edit <code>${scriptMatch[1]}</code> to start.</p>";\n`);
                    }
                    console.log(`[Preview] Created missing entry point ${scriptMatch[1]} for ${name}`);
                  }
                }
              } catch {}
              break;
            }
          }

          let hasTsconfigPaths = false;
          for (const tscfg of ["tsconfig.json", "tsconfig.app.json"]) {
            const tscfgPath = path.join(projectDir, tscfg);
            if (fs.existsSync(tscfgPath)) {
              try {
                const raw = fs.readFileSync(tscfgPath, "utf-8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/,\s*([\]}])/g, "$1");
                const parsed = JSON.parse(raw);
                const co = parsed.compilerOptions || {};
                if (co.baseUrl || co.paths) hasTsconfigPaths = true;
              } catch {}
              break;
            }
          }

          for (const cfgName of ["vite.config.ts", "vite.config.js", "vite.config.mjs"]) {
            const viteConfigPath = path.join(projectDir, cfgName);
            if (fs.existsSync(viteConfigPath)) {
              const viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");
              let content = viteConfigContent;
              if (!content.includes("usePolling")) {
                content = content.replace(
                  /defineConfig\(\{/,
                  `defineConfig({\n  server: {\n    watch: {\n      usePolling: true,\n      interval: 500,\n    },\n  },`
                );
                if (content !== viteConfigContent) {
                  console.log(`[Preview] Patched ${name}/${cfgName} with usePolling`);
                }
              }
              if (/base:\s*["']\/(__preview|__dev)[^"']*["']/.test(content)) {
                content = content.replace(/\s*base:\s*["']\/(__preview|__dev)[^"']*["'],?\n?/g, "\n");
                console.log(`[Preview] Removed stale base path from ${name}/${cfgName}`);
              }

              if (hasTsconfigPaths && !content.includes("tsconfigPaths") && !content.includes("tsconfig-paths")) {
                const tspPkgInstalled = fs.existsSync(path.join(projectDir, "node_modules", "vite-tsconfig-paths"));
                if (!tspPkgInstalled) {
                  try {
                    let installCmd = "npm install --legacy-peer-deps --save-dev vite-tsconfig-paths";
                    if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) installCmd = "npx pnpm add -D vite-tsconfig-paths";
                    else if (fs.existsSync(path.join(projectDir, "yarn.lock"))) installCmd = "yarn add -D vite-tsconfig-paths";
                    else if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) installCmd = "bun add -D vite-tsconfig-paths";
                    execSync(installCmd, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
                    console.log(`[Preview] Installed vite-tsconfig-paths for ${name}`);
                  } catch (installErr: any) {
                    console.log(`[Preview] Could not install vite-tsconfig-paths for ${name}: ${installErr.message?.slice(0, 100)}`);
                  }
                }
                if (fs.existsSync(path.join(projectDir, "node_modules", "vite-tsconfig-paths"))) {
                  const importLine = `import tsconfigPaths from 'vite-tsconfig-paths'\n`;
                  const pluginsMatch = content.match(/plugins\s*:\s*\[/);
                  if (pluginsMatch) {
                    content = importLine + content;
                    content = content.replace(/plugins\s*:\s*\[/, `plugins: [tsconfigPaths(), `);
                    console.log(`[Preview] Added tsconfigPaths plugin to ${name}/${cfgName}`);
                  }
                }
              }

              if (content !== viteConfigContent) {
                fs.writeFileSync(viteConfigPath, content, "utf-8");
              }
              break;
            }
          }

          for (const rspackCfg of ["rspack.config.js", "rspack.config.ts"]) {
            const rspackPath = path.join(projectDir, rspackCfg);
            if (fs.existsSync(rspackPath)) {
              try {
                let rsContent = fs.readFileSync(rspackPath, "utf-8");
                let changed = false;
                const portMatch = rsContent.match(/port:\s*(\d+)/);
                if (portMatch && portMatch[1] !== String(port)) {
                  rsContent = rsContent.replace(/port:\s*\d+/, `port: ${port}`);
                  changed = true;
                }
                if (rsContent.includes("devServer") && !rsContent.includes("host:")) {
                  rsContent = rsContent.replace(/(devServer:\s*\{)/, `$1\n    host: '0.0.0.0',`);
                  changed = true;
                } else if (rsContent.includes("host:") && !rsContent.includes("0.0.0.0")) {
                  rsContent = rsContent.replace(/host:\s*['"][^'"]*['"]/, `host: '0.0.0.0'`);
                  changed = true;
                }
                if (changed) {
                  fs.writeFileSync(rspackPath, rsContent, "utf-8");
                  console.log(`[Preview] Patched ${name}/${rspackCfg} with port ${port} and host 0.0.0.0`);
                }
              } catch {}
              break;
            }
          }

          const nodeVer = parseInt(process.versions.node.split(".")[0], 10);
          if (nodeVer < 22) {
            const iterMethods = "filter|map|find|some|every|reduce|forEach|flatMap|toSorted";
            const iterRe = new RegExp(`(\\b[a-zA-Z_$][a-zA-Z0-9_$]*)\\.(values|keys|entries)\\(\\)\\.(${iterMethods})\\(`, "g");
            const patchIteratorHelpers = (dir: string) => {
              try {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                  if (!f.endsWith(".js") && !f.endsWith(".mjs") && !f.endsWith(".cjs")) continue;
                  const fp = path.join(dir, f);
                  try {
                    const src = fs.readFileSync(fp, "utf-8");
                    if (iterRe.test(src)) {
                      iterRe.lastIndex = 0;
                      const patched = src.replace(iterRe, (_match: string, varName: string, iterMethod: string, arrayMethod: string) => {
                        return `Array.from(${varName}.${iterMethod}()).${arrayMethod}(`;
                      });
                      if (patched !== src) {
                        fs.writeFileSync(fp, patched, "utf-8");
                        console.log(`[Preview] Patched Node 22+ iterator helpers in ${name}/${path.relative(projectDir, fp)}`);
                      }
                    }
                  } catch {}
                }
              } catch {}
            };
            const vrDist = path.join(projectDir, "node_modules", "vue-router", "dist");
            if (fs.existsSync(vrDist)) patchIteratorHelpers(vrDist);
            const pnpmVR = path.join(projectDir, "node_modules", ".pnpm");
            if (fs.existsSync(pnpmVR)) {
              try {
                const pnpmDirs = fs.readdirSync(pnpmVR).filter((d: string) => d.startsWith("vue-router@"));
                for (const d of pnpmDirs) {
                  const dist = path.join(pnpmVR, d, "node_modules", "vue-router", "dist");
                  if (fs.existsSync(dist)) patchIteratorHelpers(dist);
                }
              } catch {}
            }
          }

          const portEnv: Record<string, string> = {
            ...process.env as Record<string, string>,
            BROWSER: "none",
            PORT: String(port),
            HOST: "0.0.0.0",
            HOSTNAME: "0.0.0.0",
            NODE_PATH: path.join(projectDir, "node_modules"),
            CHOKIDAR_USEPOLLING: "true",
          };

          const isReactScripts = devCmd.args.includes("react-scripts");
          if (isReactScripts) {
            portEnv.PORT = String(port);
            portEnv.HOST = "0.0.0.0";
            portEnv.SKIP_PREFLIGHT_CHECK = "true";
            portEnv.PUBLIC_URL = "";
            portEnv.NODE_OPTIONS = (portEnv.NODE_OPTIONS || "") + " --openssl-legacy-provider";
            try {
              const pkgPath = path.join(projectDir, "package.json");
              const pkgRaw = fs.readFileSync(pkgPath, "utf-8");
              const pkgObj = JSON.parse(pkgRaw);
              if (pkgObj.homepage) {
                delete pkgObj.homepage;
                fs.writeFileSync(pkgPath, JSON.stringify(pkgObj, null, 2));
                console.log(`[Preview] Removed homepage from ${name}/package.json for correct dev serving`);
              }
            } catch {}
          }

          const isWebpackDirect = devCmd.args.includes("webpack") || devCmd.args.includes("webpack-dev-server") || devCmd.args.includes("vue-cli-service");
          if (isWebpackDirect && !isReactScripts) {
            portEnv.NODE_OPTIONS = (portEnv.NODE_OPTIONS || "") + " --openssl-legacy-provider";
          }

          const isNextDev = devCmd.args.includes("next");
          if (isNextDev) {
            portEnv.HOSTNAME = "0.0.0.0";
            const nextLockPath = path.join(projectDir, ".next", "dev", "lock");
            try { if (fs.existsSync(nextLockPath)) { fs.unlinkSync(nextLockPath); console.log(`[Preview] Removed stale .next/dev/lock for ${name}`); } } catch {}
          }

          const isWin = process.platform === "win32";
          const child = spawn(devCmd.cmd, devCmd.args, {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: !isWin,
            windowsHide: true,
            env: portEnv,
          });
          if (!isWin) child.unref();

          let startupOutput = "";
          let serverReady = false;
          const startupErrors: string[] = [];

          const collectOutput = (data: Buffer) => {
            const text = data.toString();
            startupOutput += text;
            console.log(`[Preview:${name}] ${text.trim()}`);
            if (/ready|VITE.*ready|compiled|started server|listening|Local:/i.test(text)) {
              serverReady = true;
            }
            if (/error|ERR!|Cannot find|MODULE_NOT_FOUND|SyntaxError|ENOENT/i.test(text)) {
              startupErrors.push(text.trim().slice(0, 300));
            }
          };

          child.stdout?.on("data", collectOutput);
          child.stderr?.on("data", collectOutput);

          previewProcesses.set(name, { process: child, port });

          let exited = false;
          child.on("error", (err: any) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
            exited = true;
          });

          child.on("exit", (code: number | null) => {
            exited = true;
            if (code !== 0 && code !== null) {
              console.error(`[Preview] Process for ${name} exited with code ${code}`);
            }
            previewProcesses.delete(name);
          });

          const maxWait = 15000;
          const start = Date.now();
          while (Date.now() - start < maxWait && !serverReady && !exited) {
            await new Promise(r => setTimeout(r, 300));
          }

          const isValidNpmPackageName = (name: string): boolean => {
            return /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name) && name.length <= 214;
          };
          const NODE_BUILTINS = new Set(["fs", "path", "os", "child_process", "http", "https", "url", "util", "crypto", "stream", "events", "assert", "buffer", "net", "tls", "dns", "zlib", "querystring", "module", "vm", "cluster", "dgram", "readline", "tty", "worker_threads", "perf_hooks", "async_hooks", "v8", "inspector", "string_decoder", "timers", "console"]);
          const extractMissingPackages = (output: string): string[] => {
            const pkgs = new Set<string>();
            const addIfValid = (raw: string) => {
              const mod = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0];
              if (mod && !mod.startsWith(".") && !mod.startsWith("/") && !mod.startsWith("~") && !NODE_BUILTINS.has(mod) && isValidNpmPackageName(mod)) {
                pkgs.add(mod);
              }
            };
            const cannotFind = output.matchAll(/Cannot find (?:module|package) ['"]([^'"]+)['"]/g);
            for (const m of cannotFind) addIfValid(m[1]);
            const couldNotResolve = output.matchAll(/Could not resolve ["']([^"']+)["']/g);
            for (const m of couldNotResolve) addIfValid(m[1]);
            const moduleNotFound = output.matchAll(/Module not found.*['"]([^'"]+)['"]/g);
            for (const m of moduleNotFound) addIfValid(m[1]);
            return [...pkgs];
          };

          let retried = false;
          if (exited && !serverReady && !retried) {
            const missingPkgs = extractMissingPackages(startupOutput);
            if (missingPkgs.length > 0 && missingPkgs.length <= 5) {
              retried = true;
              console.log(`[Preview] Detected missing packages: ${missingPkgs.join(", ")} — installing and retrying`);
              try {
                const { execFileSync: efs } = await import("child_process");
                const installArgs = pm === "npm"
                  ? ["install", "--save-dev", "--legacy-peer-deps", ...missingPkgs]
                  : pm === "pnpm" ? ["add", "-D", ...missingPkgs]
                  : pm === "yarn" ? ["add", "-D", ...missingPkgs]
                  : ["add", "-D", ...missingPkgs];
                const installBin = pm === "npm" ? "npm" : pm;
                efs(installBin, installArgs, { cwd: projectDir, timeout: 60000, stdio: "pipe", windowsHide: true });
                console.log(`[Preview] Installed ${missingPkgs.join(", ")} — retrying startup`);

                const child2 = spawn(devCmd.cmd, devCmd.args, {
                  cwd: projectDir, stdio: "pipe", shell: true,
                  detached: !isWin, windowsHide: true, env: portEnv,
                });
                if (!isWin) child2.unref();
                startupOutput = "";
                serverReady = false;
                exited = false;
                startupErrors.length = 0;
                child2.stdout?.on("data", collectOutput);
                child2.stderr?.on("data", collectOutput);
                previewProcesses.set(name, { process: child2, port });
                child2.on("error", () => { exited = true; });
                child2.on("exit", (code: number | null) => {
                  exited = true;
                  if (code !== 0 && code !== null) previewProcesses.delete(name);
                });
                const start2 = Date.now();
                while (Date.now() - start2 < maxWait && !serverReady && !exited) {
                  await new Promise(r => setTimeout(r, 300));
                }
              } catch (e: any) {
                console.log(`[Preview] Auto-install retry failed: ${e.message?.slice(0, 200)}`);
              }
            }
          }

          res.setHeader("Content-Type", "application/json");
          if (exited && !serverReady) {
            previewProcesses.delete(name);
            res.end(JSON.stringify({
              port,
              started: false,
              error: `Dev server failed to start. ${startupErrors.join(" | ").slice(0, 800)}`,
              output: startupOutput.slice(-2000),
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              retried,
            }));
          } else {
            res.end(JSON.stringify({
              port,
              started: true,
              ready: serverReady,
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              packageManager: pm,
              retried,
            }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/restart-preview", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid project name" })); return; }

          const entry = previewProcesses.get(name);
          if (!entry) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ restarted: false, reason: "No active preview" }));
            return;
          }

          const oldPort = entry.port;
          try {
            if (process.platform === "win32") {
              const { execSync } = await import("child_process");
              try { execSync(`taskkill /pid ${entry.process.pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
            } else {
              try { process.kill(-entry.process.pid, "SIGKILL"); } catch { try { entry.process.kill("SIGKILL"); } catch {} }
            }
          } catch {}
          previewProcesses.delete(name);

          const waitForPortFree = async (port: number, maxWait: number) => {
            const net = await import("net");
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const inUse = await new Promise<boolean>(resolve => {
                const s = net.createServer();
                s.once("error", () => resolve(true));
                s.once("listening", () => { s.close(); resolve(false); });
                s.listen(port, "0.0.0.0");
              });
              if (!inUse) return true;
              await new Promise(r => setTimeout(r, 200));
            }
            return false;
          };
          const portFree = await waitForPortFree(oldPort, 3000);
          if (!portFree) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ restarted: false, reason: "Port still in use after 3s" }));
            return;
          }

          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          const { spawn } = await import("child_process");

          let pkg: any = {};
          const pkgPath = path.join(projectDir, "package.json");
          if (fs.existsSync(pkgPath)) {
            try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")); } catch {}
          }
          const scripts = pkg.scripts || {};
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

          const detectPMRestart = (): string => {
            if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) return "bun";
            if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
            if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
            return "npm";
          };
          const pmR = detectPMRestart();

          const restartDetect = (): { cmd: string; args: string[] } => {
            const portStr = String(oldPort);
            const matchScript = (scriptBody: string): { cmd: string; args: string[] } | null => {
              if (scriptBody.includes("next")) return { cmd: "npx", args: ["next", "dev", "--port", portStr] };
              if (scriptBody.includes("react-scripts")) return { cmd: "npx", args: ["react-scripts", "start"] };
              if (scriptBody.includes("nuxt")) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
              if (scriptBody.includes("astro")) return { cmd: "npx", args: ["astro", "dev", "--port", portStr] };
              if (scriptBody.includes("webpack")) {
                const wpArgs = ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr];
                const cfgM = scriptBody.match(/(?:--config[=\s]|-c\s)(\S+)/);
                if (cfgM) wpArgs.splice(2, 0, "--config", cfgM[1]);
                return { cmd: "npx", args: wpArgs };
              }
              if (scriptBody.includes("rspack")) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("svelte") || scriptBody.includes("sveltekit")) return null;
              if (scriptBody.includes("vue-cli-service")) return { cmd: "npx", args: ["vue-cli-service", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("parcel")) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("ember")) return { cmd: "npx", args: ["ember", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("vite")) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
              return null;
            };
            const isSvelteKit = deps["@sveltejs/kit"] || deps["sveltekit"];
            const isPnpmMono = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));
            if (isPnpmMono) {
              for (const key of Object.keys(scripts)) {
                if (scripts[key].includes("--filter") && (key.includes("dev") || key === "lp:dev")) {
                  return { cmd: "pnpm", args: ["run", key] };
                }
              }
            }
            if (scripts.dev) {
              if (isSvelteKit) return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
              const m = matchScript(scripts.dev); if (m) return m;
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }
            if (scripts.start) { const m = matchScript(scripts.start); if (m) return m; return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "start"] : ["run", "start"] }; }
            if (scripts.serve || scripts["serve:rspack"]) { const s = scripts.serve || scripts["serve:rspack"]; const m = matchScript(s); if (m) return m; const k = scripts.serve ? "serve" : "serve:rspack"; return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", k] : ["run", k] }; }
            if (deps["next"]) return { cmd: "npx", args: ["next", "dev", "--port", portStr] };
            if (deps["react-scripts"]) return { cmd: "npx", args: ["react-scripts", "start"] };
            if (deps["nuxt"]) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
            if (deps["astro"]) return { cmd: "npx", args: ["astro", "dev", "--port", portStr] };
            if (deps["@angular/cli"]) return { cmd: "npx", args: ["ng", "serve", "--host", "0.0.0.0", "--port", portStr, "--disable-host-check"] };
            if (deps["@remix-run/dev"]) return { cmd: "npx", args: ["remix", "vite:dev", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["gatsby"]) return { cmd: "npx", args: ["gatsby", "develop", "-H", "0.0.0.0", "-p", portStr] };
            if (deps["webpack-dev-server"]) return { cmd: "npx", args: ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["@rspack/cli"] || deps["@rspack/core"]) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["parcel"]) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
            if (isSvelteKit) return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
            return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
          };
          const restartCmd = restartDetect();
          console.log(`[Preview] Restarting ${name} with: ${restartCmd.cmd} ${restartCmd.args.join(" ")}`);

          const isWinR = process.platform === "win32";
          const child = spawn(restartCmd.cmd, restartCmd.args, {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: !isWinR,
            windowsHide: true,
            env: {
              ...process.env,
              BROWSER: "none",
              PORT: String(oldPort),
              HOST: "0.0.0.0",
              HOSTNAME: "0.0.0.0",
              CHOKIDAR_USEPOLLING: "true",
              ...(restartCmd.args.some((a: string) => ["webpack", "webpack-dev-server", "vue-cli-service", "react-scripts"].includes(a)) ? { NODE_OPTIONS: (process.env.NODE_OPTIONS || "") + " --openssl-legacy-provider" } : {}),
            },
          });
          if (!isWinR) child.unref();

          previewProcesses.set(name, { process: child, port: oldPort });

          child.stdout?.on("data", (d: Buffer) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
          child.stderr?.on("data", (d: Buffer) => console.log(`[Preview:${name}] ${d.toString().trim()}`));

          child.on("error", (err: any) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
          });
          child.on("exit", (code: number | null) => {
            if (code !== null && code !== 0) {
              console.error(`[Preview] Process for ${name} exited with code ${code}`);
            }
            previewProcesses.delete(name);
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ restarted: true, port: oldPort }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/install-deps", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, dependencies, devDependencies } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid project name" })); return; }

          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ error: "Project not found" })); return; }

          const pkgJsonPath = path.join(projectDir, "package.json");
          let pkgJsonValid = false;
          if (fs.existsSync(pkgJsonPath)) {
            try { JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")); pkgJsonValid = true; } catch {}
          }
          if (!pkgJsonValid) {
            fs.writeFileSync(pkgJsonPath, JSON.stringify({ name, version: "0.0.1", private: true }, null, 2));
          }

          const results: string[] = [];
          const { exec: execAsync } = await import("child_process");
          const validPkg = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;
          const notAPkg = new Set(["npm","npx","yarn","pnpm","bun","node","deno","run","dev","start","build","test","serve","watch","lint","deploy","preview","install","add","remove","uninstall","update","init","create","cd","ls","mkdir","rm","cp","mv","cat","echo","touch","git","curl","wget","then","and","or","the","a","an","to","in","of","for","with","from","your","this","that","it","is","are","was","be","has","have","do","does","if","not","no","yes","on","off","up","so","but","by","at","as","server","app","application","project","file","directory","folder","next","first","following","above","below","after","before","all","any","each","every","both","new","old"]);
          const filterPkgs = (arr: string[]) => (arr || []).filter((d: string) => {
            if (!validPkg.test(d) || /[;&|`$(){}]/.test(d)) return false;
            const base = d.replace(/@[^\s]*$/, '').toLowerCase();
            return !notAPkg.has(base) && (base.length > 1 || d.startsWith('@'));
          });
          const safeDeps = filterPkgs(dependencies || []);
          const safeDevDeps = filterPkgs(devDependencies || []);

          let pm = "npm";
          if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) pm = "bun";
          else if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml")) || fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"))) pm = "pnpm";
          else if (fs.existsSync(path.join(projectDir, "yarn.lock"))) pm = "yarn";

          const buildInstallCmd = (pkgs: string[], isDev: boolean): string => {
            const pkgStr = pkgs.join(" ");
            switch (pm) {
              case "bun": return `npx bun add${isDev ? " -d" : ""} ${pkgStr}`;
              case "pnpm": return `npx pnpm add${isDev ? " -D" : ""} ${pkgStr}`;
              case "yarn": return `npx yarn add${isDev ? " -D" : ""} ${pkgStr}`;
              default: return `npm install --legacy-peer-deps${isDev ? " --save-dev" : ""} ${pkgStr}`;
            }
          };

          const errors: string[] = [];
          const runInstall = (pkgs: string[], isDev: boolean): Promise<void> => new Promise((resolve) => {
            const cmd = buildInstallCmd(pkgs, isDev);
            console.log(`[Deps] Running: ${cmd} in ${name}`);
            execAsync(cmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, _stdout, stderr) => {
              if (err) {
                console.error(`[Deps] Failed: ${cmd}`, stderr?.slice(0, 300) || err.message?.slice(0, 300));
                if (pm !== "npm") {
                  const npmFallback = `npm install --legacy-peer-deps${isDev ? " --save-dev" : ""} ${pkgs.join(" ")}`;
                  console.log(`[Deps] Retrying with npm: ${npmFallback}`);
                  execAsync(npmFallback, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err2) => {
                    if (err2) errors.push(`Failed: Command failed: ${cmd}`);
                    resolve();
                  });
                } else {
                  errors.push(`Failed: Command failed: ${cmd}`);
                  resolve();
                }
              } else {
                resolve();
              }
            });
          });

          if (safeDeps.length > 0) {
            await runInstall(safeDeps, false);
            if (errors.length === 0) results.push(`Installed: ${safeDeps.join(", ")}`);
          }

          if (safeDevDeps.length > 0) {
            const prevErrors = errors.length;
            await runInstall(safeDevDeps, true);
            if (errors.length === prevErrors) results.push(`Installed dev: ${safeDevDeps.join(", ")}`);
          }

          res.setHeader("Content-Type", "application/json");
          const success = errors.length === 0;
          res.end(JSON.stringify({ success, results, errors }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/run-command", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, command } = JSON.parse(await readBody(req));
          if (!command || typeof command !== "string") { res.statusCode = 400; res.end(JSON.stringify({ error: "No command specified" })); return; }

          const check = validateProjectPath(name || "");
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const allowedPrefixes = [
            "npm ", "npx ", "yarn ", "pnpm ", "bun ",
            "node ", "deno ", "tsc", "tsx ",
            "corepack ", "nvm ", "fnm ",
            "mkdir ", "cp ", "mv ", "rm ", "touch ", "cat ", "ls ", "pwd",
            "chmod ", "chown ", "ln ",
            "git ", "curl ", "wget ",
            "python", "pip", "cargo ", "go ", "rustc", "gcc", "g++", "make",
            "docker ", "docker-compose ",
          ];
          const trimmed = command.trim().replace(/\s+#\s+.*$/, '').trim();
          if (/[\r\n\x00]/.test(trimmed)) { res.statusCode = 403; res.end(JSON.stringify({ error: "Control characters not allowed in commands" })); return; }

          if (/^curl-install:https?:\/\//i.test(trimmed)) {
            const scriptUrl = trimmed.replace(/^curl-install:/i, "");
            try {
              const fs = await import("fs");
              const projectDir = check.resolved;
              if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }
              const { exec: execAsync } = await import("child_process");
              const os = await import("os");
              const isWin = os.platform() === "win32";

              const WIN_NPM_ALTERNATIVES: Record<string, string> = {
                "bun.sh/install": "npm install -g bun",
                "get.pnpm.io/install.sh": "npm install -g pnpm",
                "install.python-poetry.org": "pip install poetry",
                "rustup.rs": "winget install Rustlang.Rustup",
                "deno.land/install.sh": "npm install -g deno",
              };

              if (isWin) {
                const winAlt = Object.entries(WIN_NPM_ALTERNATIVES).find(([k]) => scriptUrl.includes(k));
                if (winAlt) {
                  const altCmd = winAlt[1];
                  await new Promise<void>((resolve) => {
                    execAsync(altCmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: `${err.message?.slice(0, 400)} (ran: ${altCmd})`, output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: `Windows alternative: ${altCmd}\n${(stdout || "").slice(0, 4000)}` }));
                      }
                      resolve();
                    });
                  });
                  return;
                }

                const ps1Url = scriptUrl.replace(/\.sh$/, ".ps1");
                let usePsScript = false;
                try { const head = await fetch(ps1Url, { method: "HEAD" }); usePsScript = head.ok; } catch {}

                if (usePsScript) {
                  const psCmd = `irm ${ps1Url} | iex`;
                  const encodedCmd = Buffer.from(psCmd, "utf16le").toString("base64");
                  await new Promise<void>((resolve) => {
                    execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCmd}`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4000) }));
                      }
                      resolve();
                    });
                  });
                  return;
                }
              }

              const resp = await fetch(scriptUrl);
              if (!resp.ok) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ success: false, error: `Failed to download script: ${resp.status} ${resp.statusText}` })); return; }
              const script = await resp.text();
              const tmpScript = path.join(os.tmpdir(), `install-${Date.now()}.sh`);
              fs.writeFileSync(tmpScript, script, { mode: 0o755 });
              await new Promise<void>((resolve) => {
                execAsync(`bash "${tmpScript}"`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: { ...process.env, BUN_INSTALL: projectDir, CARGO_HOME: projectDir, RUSTUP_HOME: projectDir } }, (err, stdout, stderr) => {
                  try { fs.unlinkSync(tmpScript); } catch {}
                  res.setHeader("Content-Type", "application/json");
                  if (err) {
                    res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
                  } else {
                    res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4000) }));
                  }
                  resolve();
                });
              });
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
          }

          const devServerRe = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
          if (devServerRe.test(trimmed)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Dev server commands should use the Preview button instead" })); return; }
          const isAllowed = allowedPrefixes.some(p => trimmed.startsWith(p)) || trimmed === "npm install" || trimmed === "corepack enable";
          if (!isAllowed) { res.statusCode = 403; res.end(JSON.stringify({ error: `Command not allowed: ${trimmed.slice(0, 50)}` })); return; }
          if (/[;&|`$(){}]/.test(trimmed)) {
            res.statusCode = 403; res.end(JSON.stringify({ error: "Shell metacharacters not allowed" })); return;
          }
          if (/\.\.[\/\\]/.test(trimmed)) {
            res.statusCode = 403; res.end(JSON.stringify({ error: "Path traversal not allowed" })); return;
          }

          const fs = await import("fs");
          const projectDir = check.resolved;
          if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: `Project directory not found: ${projectDir}` })); return; }

          const { exec: execAsync } = await import("child_process");
          const os = await import("os");
          const isWin = os.platform() === "win32";
          let actualCmd = trimmed === "npm install" ? "npm install --legacy-peer-deps" : trimmed;

          const nodeHandled = await (async () => {
            if (/^rm\s+(-rf?\s+)?/i.test(actualCmd)) {
              const targets = actualCmd.replace(/^rm\s+(-rf?\s+)?/i, "").trim().split(/\s+/);
              const results: string[] = [];
              for (const t of targets) {
                const targetPath = path.resolve(projectDir, t);
                if (!targetPath.startsWith(projectDir)) { results.push(`Skipped (outside project): ${t}`); continue; }
                try {
                  fs.rmSync(targetPath, { recursive: true, force: true });
                  results.push(`Removed: ${t}`);
                } catch (e: any) { results.push(`Failed to remove ${t}: ${e.message}`); }
              }
              return { success: true, output: results.join("\n") };
            }
            if (/^mkdir\s+(-p\s+)?/i.test(actualCmd)) {
              const dir = actualCmd.replace(/^mkdir\s+(-p\s+)?/i, "").trim();
              const dirPath = path.resolve(projectDir, dir);
              if (!dirPath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try { fs.mkdirSync(dirPath, { recursive: true }); return { success: true, output: `Created: ${dir}` }; }
              catch (e: any) { return { success: false, error: e.message }; }
            }
            if (/^touch\s/i.test(actualCmd)) {
              const file = actualCmd.replace(/^touch\s+/i, "").trim();
              const filePath = path.resolve(projectDir, file);
              if (!filePath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, "", { flag: "a" });
                return { success: true, output: `Touched: ${file}` };
              } catch (e: any) { return { success: false, error: e.message }; }
            }
            if (/^cat\s/i.test(actualCmd)) {
              const file = actualCmd.replace(/^cat\s+/i, "").trim();
              const filePath = path.resolve(projectDir, file);
              if (!filePath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try { return { success: true, output: fs.readFileSync(filePath, "utf-8").slice(0, 4000) }; }
              catch (e: any) { return { success: false, error: e.message }; }
            }
            if (/^cp\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^cp\s+(-r\s+)?/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try { fs.cpSync(src, dest, { recursive: true, force: true }); return { success: true, output: `Copied: ${args[0]} → ${args[1]}` }; }
                catch (e: any) { return { success: false, error: e.message }; }
              }
            }
            if (/^mv\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^mv\s+/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try { fs.renameSync(src, dest); return { success: true, output: `Moved: ${args[0]} → ${args[1]}` }; }
                catch (e: any) { return { success: false, error: e.message }; }
              }
            }
            return null;
          })();

          if (nodeHandled) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(nodeHandled));
            return;
          }

          if (isWin && /^corepack\s/i.test(actualCmd)) {
            actualCmd = `npx ${actualCmd}`;
          }

          await new Promise<void>((resolve) => {
            execAsync(actualCmd, { cwd: projectDir, timeout: 60000, shell: true, maxBuffer: 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
              res.setHeader("Content-Type", "application/json");
              if (err) {
                res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
              } else {
                res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4000) }));
              }
              resolve();
            });
          });
        } catch (err: any) {
          const stderr = err.stderr ? String(err.stderr).slice(0, 2000) : "";
          const stdout = err.stdout ? String(err.stdout).slice(0, 2000) : "";
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: stdout, stderr }));
        }
      });

      server.middlewares.use("/api/programs/install", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { programs } = JSON.parse(await readBody(req));
          if (!Array.isArray(programs) || programs.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "No programs specified" }));
            return;
          }
          if (programs.length > 10) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Too many programs (max 10)" }));
            return;
          }

          const { execSync } = await import("child_process");
          const isWin = process.platform === "win32";
          const isMac = process.platform === "darwin";

          const programInstallMap: Record<string, { check: string; win?: string; mac?: string; linux?: string; label: string }> = {
            "g++": { check: "g++ --version", win: "choco install mingw -y", mac: "xcode-select --install", linux: "sudo apt-get install -y g++", label: "G++ (C++ Compiler)" },
            "gcc": { check: "gcc --version", win: "choco install mingw -y", mac: "xcode-select --install", linux: "sudo apt-get install -y gcc", label: "GCC (C Compiler)" },
            "clang": { check: "clang --version", win: "choco install llvm -y", mac: "xcode-select --install", linux: "sudo apt-get install -y clang", label: "Clang" },
            "cmake": { check: "cmake --version", win: "choco install cmake -y", mac: "brew install cmake", linux: "sudo apt-get install -y cmake", label: "CMake" },
            "make": { check: "make --version", win: "choco install make -y", mac: "xcode-select --install", linux: "sudo apt-get install -y make", label: "Make" },
            "python": { check: "python3 --version", win: "choco install python -y", mac: "brew install python3", linux: "sudo apt-get install -y python3", label: "Python 3" },
            "python3": { check: "python3 --version", win: "choco install python -y", mac: "brew install python3", linux: "sudo apt-get install -y python3", label: "Python 3" },
            "pip": { check: "pip3 --version", win: "python -m ensurepip", mac: "python3 -m ensurepip", linux: "sudo apt-get install -y python3-pip", label: "Pip" },
            "pip3": { check: "pip3 --version", win: "python -m ensurepip", mac: "python3 -m ensurepip", linux: "sudo apt-get install -y python3-pip", label: "Pip 3" },
            "node": { check: "node --version", win: "choco install nodejs -y", mac: "brew install node", linux: "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs", label: "Node.js" },
            "nodejs": { check: "node --version", win: "choco install nodejs -y", mac: "brew install node", linux: "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs", label: "Node.js" },
            "node.js": { check: "node --version", win: "choco install nodejs -y", mac: "brew install node", linux: "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs", label: "Node.js" },
            "rust": { check: "rustc --version", win: "choco install rust -y", mac: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y", linux: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y", label: "Rust" },
            "rustc": { check: "rustc --version", win: "choco install rust -y", mac: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y", linux: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y", label: "Rust" },
            "cargo": { check: "cargo --version", win: "choco install rust -y", mac: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y", linux: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y", label: "Cargo (Rust)" },
            "go": { check: "go version", win: "choco install golang -y", mac: "brew install go", linux: "sudo apt-get install -y golang", label: "Go" },
            "golang": { check: "go version", win: "choco install golang -y", mac: "brew install go", linux: "sudo apt-get install -y golang", label: "Go" },
            "java": { check: "java -version", win: "choco install openjdk -y", mac: "brew install openjdk", linux: "sudo apt-get install -y default-jdk", label: "Java (JDK)" },
            "jdk": { check: "java -version", win: "choco install openjdk -y", mac: "brew install openjdk", linux: "sudo apt-get install -y default-jdk", label: "Java (JDK)" },
            "docker": { check: "docker --version", win: "choco install docker-desktop -y", mac: "brew install --cask docker", linux: "sudo apt-get install -y docker.io", label: "Docker" },
            "git": { check: "git --version", win: "choco install git -y", mac: "brew install git", linux: "sudo apt-get install -y git", label: "Git" },
            "curl": { check: "curl --version", win: "choco install curl -y", mac: "brew install curl", linux: "sudo apt-get install -y curl", label: "cURL" },
            "wget": { check: "wget --version", win: "choco install wget -y", mac: "brew install wget", linux: "sudo apt-get install -y wget", label: "Wget" },
            "ffmpeg": { check: "ffmpeg -version", win: "choco install ffmpeg -y", mac: "brew install ffmpeg", linux: "sudo apt-get install -y ffmpeg", label: "FFmpeg" },
            "imagemagick": { check: "convert --version", win: "choco install imagemagick -y", mac: "brew install imagemagick", linux: "sudo apt-get install -y imagemagick", label: "ImageMagick" },
            "sqlite3": { check: "sqlite3 --version", win: "choco install sqlite -y", mac: "brew install sqlite", linux: "sudo apt-get install -y sqlite3", label: "SQLite" },
            "postgresql": { check: "psql --version", win: "choco install postgresql -y", mac: "brew install postgresql", linux: "sudo apt-get install -y postgresql", label: "PostgreSQL" },
            "redis": { check: "redis-server --version", win: "choco install redis -y", mac: "brew install redis", linux: "sudo apt-get install -y redis-server", label: "Redis" },
            "deno": { check: "deno --version", win: "choco install deno -y", mac: "brew install deno", linux: "curl -fsSL https://deno.land/install.sh | sh", label: "Deno" },
            "bun": { check: "bun --version", win: "powershell -c \"irm bun.sh/install.ps1|iex\"", mac: "curl -fsSL https://bun.sh/install | bash", linux: "curl -fsSL https://bun.sh/install | bash", label: "Bun" },
            "ruby": { check: "ruby --version", win: "choco install ruby -y", mac: "brew install ruby", linux: "sudo apt-get install -y ruby", label: "Ruby" },
            "php": { check: "php --version", win: "choco install php -y", mac: "brew install php", linux: "sudo apt-get install -y php", label: "PHP" },
          };

          const results: { program: string; label: string; alreadyInstalled: boolean; installed: boolean; error?: string; command?: string }[] = [];

          for (const prog of programs) {
            const key = prog.toLowerCase().replace(/[^a-z0-9.+]/g, "");
            const mapping = programInstallMap[key];
            if (!mapping) {
              results.push({ program: prog, label: prog, alreadyInstalled: false, installed: false, error: `Unknown program: ${prog}` });
              continue;
            }

            let alreadyInstalled = false;
            try {
              execSync(mapping.check, { timeout: 10000, stdio: "pipe", shell: true, windowsHide: true });
              alreadyInstalled = true;
            } catch {}

            if (alreadyInstalled) {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: true, installed: true });
              continue;
            }

            const installCmd = isWin ? mapping.win : isMac ? mapping.mac : mapping.linux;
            if (!installCmd) {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: false, error: `No install command for this platform` });
              continue;
            }

            try {
              execSync(installCmd, { timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: true, command: installCmd });
            } catch (err: any) {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: false, error: err.message?.slice(0, 200), command: installCmd });
            }
          }

          res.setHeader("Content-Type", "application/json");
          const allOk = results.every(r => r.installed || r.alreadyInstalled);
          res.end(JSON.stringify({ success: allOk, results }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/import-github", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { owner, repo, targetProject } = JSON.parse(await readBody(req));
          if (!owner || !repo || /[\/\\]|\.\./.test(owner) || /[\/\\]|\.\./.test(repo)) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid owner or repo" })); return;
          }
          if (targetProject && /[\/\\]|\.\./.test(targetProject)) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid target project name" })); return;
          }

          const fs = await import("fs");
          const { execSync } = await import("child_process");
          const os = await import("os");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

          const projectName = targetProject || repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          const projectDir = path.resolve(projectsDir, projectName);

          if (fs.existsSync(projectDir) && !targetProject) {
            res.statusCode = 409;
            res.end(JSON.stringify({ error: `Project '${projectName}' already exists. Delete it first or use a different name.` }));
            return;
          }
          if (targetProject && fs.existsSync(projectDir)) {
            const existingFiles = fs.readdirSync(projectDir);
            for (const f of existingFiles) {
              if (f === "node_modules" || f === ".git") continue;
              try { fs.rmSync(path.join(projectDir, f), { recursive: true, force: true }); } catch {}
            }
            console.log(`[Import] Cleared existing project '${projectName}' for clone into`);
          }

          const ghToken = process.env.GITHUB_TOKEN || "";
          const headers: Record<string, string> = { "User-Agent": "Guardian-AI" };
          if (ghToken) headers["Authorization"] = `token ${ghToken}`;

          const infoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" } });
          if (!infoResp.ok) {
            const status = infoResp.status;
            if (status === 404) { res.statusCode = 404; res.end(JSON.stringify({ error: `Repository ${owner}/${repo} not found or is private` })); }
            else if (status === 403) { res.statusCode = 429; res.end(JSON.stringify({ error: "GitHub API rate limit exceeded. Try again later." })); }
            else { res.statusCode = 502; res.end(JSON.stringify({ error: `GitHub API error: ${status}` })); }
            return;
          }
          const repoInfo: any = await infoResp.json();
          const defaultBranch = repoInfo.default_branch || "main";

          const MAX_TARBALL_SIZE = 200 * 1024 * 1024;
          console.log(`[Import] Downloading tarball for ${owner}/${repo} (branch: ${defaultBranch})...`);
          const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(defaultBranch)}`;
          const tarResp = await fetch(tarballUrl, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" }, redirect: "follow" });
          if (!tarResp.ok) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: `Failed to download tarball: ${tarResp.status}` }));
            return;
          }

          const contentLength = parseInt(tarResp.headers.get("content-length") || "0", 10);
          if (contentLength > MAX_TARBALL_SIZE) {
            res.statusCode = 413;
            res.end(JSON.stringify({ error: `Repository too large (${(contentLength / 1024 / 1024).toFixed(0)}MB). Max is ${MAX_TARBALL_SIZE / 1024 / 1024}MB.` }));
            return;
          }

          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-import-"));
          try {
          const tarPath = path.join(tmpDir, "repo.tar.gz");

          const arrayBuf = await tarResp.arrayBuffer();
          if (arrayBuf.byteLength > MAX_TARBALL_SIZE) {
            res.statusCode = 413;
            res.end(JSON.stringify({ error: `Repository too large (${(arrayBuf.byteLength / 1024 / 1024).toFixed(0)}MB). Max is ${MAX_TARBALL_SIZE / 1024 / 1024}MB.` }));
            return;
          }
          fs.writeFileSync(tarPath, Buffer.from(arrayBuf));
          const tarSize = fs.statSync(tarPath).size;
          console.log(`[Import] Tarball downloaded: ${(tarSize / 1024 / 1024).toFixed(1)}MB`);

          fs.mkdirSync(projectDir, { recursive: true });
          try {
            if (process.platform === "win32") {
              execSync(`tar xzf "${tarPath.replace(/\\/g, '/')}" --strip-components=1 -C "${projectDir.replace(/\\/g, '/')}"`, { timeout: 60000, stdio: "pipe", windowsHide: true });
            } else {
              execSync(`tar xzf "${tarPath}" --strip-components=1 -C "${projectDir}"`, { timeout: 60000, stdio: "pipe", windowsHide: true });
            }
          } catch (tarErr: any) {
            try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
            throw new Error(`Failed to extract tarball: ${tarErr.message?.slice(0, 200)}`);
          }
          console.log(`[Import] Extracted tarball to ${projectDir}`);

          const CLEANUP_PATTERNS = ["node_modules", ".git", ".next", ".nuxt", "dist", ".cache", ".turbo", ".vercel", ".output"];
          for (const pattern of CLEANUP_PATTERNS) {
            const cleanPath = path.join(projectDir, pattern);
            if (fs.existsSync(cleanPath)) {
              try { fs.rmSync(cleanPath, { recursive: true, force: true }); } catch {}
            }
          }
          const walkAndClean = (dir: string) => {
            try {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  if (entry.name === "node_modules" || entry.name === ".git") {
                    try { fs.rmSync(full, { recursive: true, force: true }); } catch {}
                  } else {
                    walkAndClean(full);
                  }
                } else if (entry.name === ".DS_Store") {
                  try { fs.unlinkSync(full); } catch {}
                }
              }
            } catch {}
          };
          walkAndClean(projectDir);

          let filesWritten = 0;
          const countFiles = (dir: string) => {
            try {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
                else filesWritten++;
              }
            } catch {}
          };
          countFiles(projectDir);

          let framework = "vanilla";
          const pkgPath = path.join(projectDir, "package.json");
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
              const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
              if (deps["next"]) framework = "nextjs";
              else if (deps["nuxt"] || deps["nuxt3"]) framework = "nuxt";
              else if (deps["@angular/core"]) framework = "angular";
              else if (deps["svelte"] || deps["@sveltejs/kit"]) framework = "svelte";
              else if (deps["astro"]) framework = "astro";
              else if (deps["vue"]) framework = "vue";
              else if (deps["react"]) framework = "react";
            } catch {}
          }

          let npmInstalled = false;
          let installError = "";
          if (fs.existsSync(pkgPath)) {
            const detectPM = (): string => {
              if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) return "bun";
              if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml")) || fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"))) return "pnpm";
              if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
              return "npm";
            };
            const detectedPM = detectPM();

            let isMonorepo = false;
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
              if (pkg.workspaces || fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml")) || fs.existsSync(path.join(projectDir, "lerna.json"))) {
                isMonorepo = true;
              }
            } catch {}

            const installCmd = detectedPM === "pnpm" ? "npx pnpm install --no-frozen-lockfile --ignore-scripts"
              : detectedPM === "yarn" ? "npx yarn install --ignore-engines --ignore-scripts"
              : detectedPM === "bun" ? "npx bun install --ignore-scripts"
              : "npm install --legacy-peer-deps --ignore-scripts";

            console.log(`[Import] Installing deps for ${projectName} with: ${installCmd} (pm: ${detectedPM}, monorepo: ${isMonorepo})`);
            try {
              execSync(installCmd, { cwd: projectDir, timeout: 180000, stdio: "pipe", shell: true, windowsHide: true });
              npmInstalled = true;
              console.log(`[Import] Deps installed for ${projectName}`);
              try {
                const rebuildCmd = detectedPM === "pnpm" ? "npx pnpm rebuild" : detectedPM === "yarn" ? "npx yarn rebuild" : "npm rebuild";
                execSync(rebuildCmd, { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
                console.log(`[Import] Native modules rebuilt for ${projectName}`);
              } catch (rebuildErr: any) {
                console.log(`[Import] Rebuild skipped/failed for ${projectName} (non-critical)`);
              }
            } catch (installErr: any) {
              installError = installErr.stderr?.toString().slice(-500) || installErr.message?.slice(0, 500) || "Unknown error";
              console.error(`[Import] Install failed for ${projectName} with ${detectedPM}:`, installError.slice(0, 300));
              if (detectedPM !== "npm") {
                try {
                  console.log(`[Import] Retrying with npm for ${projectName}`);
                  execSync("npm install --legacy-peer-deps --ignore-scripts", { cwd: projectDir, timeout: 180000, stdio: "pipe", shell: true, windowsHide: true });
                  npmInstalled = true;
                  installError = "";
                  console.log(`[Import] Deps installed for ${projectName} (npm fallback)`);
                  try { execSync("npm rebuild", { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true }); console.log(`[Import] Native modules rebuilt for ${projectName} (npm fallback)`); } catch { console.log(`[Import] Rebuild skipped for ${projectName} (npm fallback, non-critical)`); }
                } catch (retryErr: any) {
                  installError = retryErr.stderr?.toString().slice(-300) || retryErr.message?.slice(0, 300) || "Retry failed";
                }
              }
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            success: true,
            projectName,
            framework,
            filesWritten,
            npmInstalled,
            sourceRepo: `https://github.com/${owner}/${repo}`,
            defaultBranch,
            ...(installError ? { installError: installError.slice(0, 500) } : {}),
          }));
          } finally {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      let activePreviewPort: number | null = null;

      const proxyToPreview = async (req: any, res: any, port: number, targetPath: string) => {
        const http = await import("http");
        const proxyReq = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: targetPath,
            method: req.method,
            headers: { ...req.headers, host: `localhost:${port}` },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );
        proxyReq.on("error", () => {
          if (!res.headersSent) { res.statusCode = 502; res.end("Preview server not responding"); }
        });
        req.pipe(proxyReq, { end: true });
      };

      server.middlewares.use("/__preview", async (req, res) => {
        const match = req.url?.match(/^\/(\d+)(\/.*)?$/) || req.url?.match(/^\/__preview\/(\d+)(\/.*)?$/);
        if (!match) { res.statusCode = 400; res.end("Invalid preview URL"); return; }
        const port = parseInt(match[1], 10);
        const targetPath = match[2] || "/";

        if (port < 5100 || port > 5200) { res.statusCode = 400; res.end("Port out of preview range"); return; }

        activePreviewPort = port;
        await proxyToPreview(req, res, port, targetPath);
      });

      const PREVIEW_ASSET_PREFIXES = ["/_next/", "/__nextjs", "/__vite", "/@vite/", "/@id/", "/@fs/", "/node_modules/", "/src/", "/favicon.ico", "/opengraph-image", "/apple-touch-icon", "/manifest.json", "/sw.js", "/workbox-", "/static/", "/sockjs-node/", "/build/", "/_assets/", "/assets/", "/public/", "/polyfills", "/.vite/", "/hmr", "/__webpack_hmr"];
      server.middlewares.use(async (req, res, next) => {
        if (!activePreviewPort || !req.url) { next(); return; }
        const shouldProxy = PREVIEW_ASSET_PREFIXES.some(p => req.url!.startsWith(p));
        if (!shouldProxy) { next(); return; }
        await proxyToPreview(req, res, activePreviewPort, req.url);
      });

      server.middlewares.use("/api/projects/preview-info", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          const entry = previewProcesses.get(name);
          const replitDomain = process.env.REPLIT_DEV_DOMAIN || "";
          res.setHeader("Content-Type", "application/json");
          if (entry) {
            const proxyUrl = `/__preview/${entry.port}/`;
            res.end(JSON.stringify({ running: true, port: entry.port, proxyUrl, replitDomain }));
          } else {
            res.end(JSON.stringify({ running: false }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/stop-preview", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          const entry = previewProcesses.get(name);
          if (entry) {
            const pid = entry.process.pid;
            if (process.platform === "win32") {
              try { const { execSync } = await import("child_process"); execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
            } else {
              try { process.kill(-pid, 9); } catch {}
            }
            try { entry.process.kill("SIGKILL"); } catch {}
            try {
              const fs = await import("fs");
              const killPort = async (port: number) => {
                if (process.platform === "win32") {
                  try {
                    const { execSync } = await import("child_process");
                    const out = execSync(`netstat -ano | findstr :${port}`, { stdio: "pipe", encoding: "utf-8", windowsHide: true });
                    const pids = new Set(out.split("\n").map((l: string) => l.trim().split(/\s+/).pop()).filter((p: any) => p && /^\d+$/.test(p)));
                    for (const p of pids) { try { execSync(`taskkill /pid ${p} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {} }
                  } catch {}
                  return;
                }
                const netTcp = fs.readFileSync("/proc/net/tcp", "utf-8") + fs.readFileSync("/proc/net/tcp6", "utf-8");
                const portHex = port.toString(16).toUpperCase().padStart(4, "0");
                const lines = netTcp.split("\n").filter((l: string) => l.includes(`:${portHex} `));
                for (const line of lines) {
                  const cols = line.trim().split(/\s+/);
                  const inode = cols[9];
                  if (!inode || inode === "0") continue;
                  const procDirs = fs.readdirSync("/proc").filter((d: string) => /^\d+$/.test(d));
                  for (const p of procDirs) {
                    try {
                      const fds = fs.readdirSync(`/proc/${p}/fd`);
                      for (const fd of fds) {
                        try {
                          if (fs.readlinkSync(`/proc/${p}/fd/${fd}`) === `socket:[${inode}]`) {
                            try { process.kill(-parseInt(p), 9); } catch {}
                            try { process.kill(parseInt(p), 9); } catch {}
                          }
                        } catch {}
                      }
                    } catch {}
                  }
                }
              };
              await killPort(entry.port);
            } catch {}
            if (activePreviewPort === entry.port) activePreviewPort = null;
            previewProcesses.delete(name);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ stopped: true }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

function sourceDownloadPlugin(): Plugin {
  return {
    name: "source-download",
    configureServer(server) {
      server.middlewares.use("/api/download-source", async (_req, res) => {
        try {
          const archiver = (await import("archiver")).default;
          const projectRoot = process.cwd();

          res.setHeader("Content-Type", "application/zip");
          res.setHeader("Content-Disposition", "attachment; filename=lambda-recursive-source.zip");

          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.pipe(res);

          const includeDirs = ["src", "public", "supabase", "electron-browser"];
          const includeFiles = [
            "package.json", "package-lock.json", "tsconfig.json", "tsconfig.app.json",
            "tsconfig.node.json", "vite.config.ts", "tailwind.config.ts", "postcss.config.js",
            "index.html", "eslint.config.js", ".env", ".env.example", "replit.md",
            "components.json"
          ];

          for (const dir of includeDirs) {
            const fs = await import("fs");
            const dirPath = path.join(projectRoot, dir);
            if (fs.existsSync(dirPath)) {
              archive.directory(dirPath, dir, (entry) => {
                if (entry.name.includes("node_modules") || entry.name.includes(".cache")) return false;
                return entry;
              });
            }
          }

          for (const file of includeFiles) {
            const fs = await import("fs");
            const filePath = path.join(projectRoot, file);
            if (fs.existsSync(filePath)) {
              archive.file(filePath, { name: file });
            }
          }

          await archive.finalize();
        } catch (err) {
          console.error("Download source error:", err);
          res.statusCode = 500;
          res.end("Failed to create source archive");
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: ["**/projects/**", "**/.local/**", "**/node_modules/**", "**/.cache/**"],
    },
  },
  plugins: [
    react(),
    fileWritePlugin(),
    projectManagementPlugin(),
    sourceDownloadPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "λ Recursive — Self-Referential IDE",
        short_name: "λ Recursive",
        description: "A self-recursive development environment with AI-powered code evolution",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
