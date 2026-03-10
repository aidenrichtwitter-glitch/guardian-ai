// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { VitePWA } from "file:///home/runner/workspace/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "/home/runner/workspace";
function fileWritePlugin() {
  return {
    name: "file-write",
    configureServer(server) {
      server.middlewares.use("/api/write-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath, content } = JSON.parse(body);
          if (!filePath || typeof content !== "string") {
            res.statusCode = 400;
            res.end("Missing filePath or content");
            return;
          }
          const fs = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) {
            res.statusCode = 403;
            res.end("Path outside project");
            return;
          }
          const dir = path.dirname(resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          let previousContent = "";
          if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, "utf-8");
          fs.writeFileSync(resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/read-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath } = JSON.parse(body);
          if (!filePath) {
            res.statusCode = 400;
            res.end("Missing filePath");
            return;
          }
          const fs = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) {
            res.statusCode = 403;
            res.end("Path outside project");
            return;
          }
          const exists = fs.existsSync(resolved);
          const content = exists ? fs.readFileSync(resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    }
  };
}
function projectManagementPlugin() {
  return {
    name: "project-management",
    configureServer(server) {
      async function readBody(req) {
        let body = "";
        for await (const chunk of req) body += chunk;
        return body;
      }
      function validateProjectPath(projectName, filePath) {
        const projectRoot = process.cwd();
        const projectsDir = path.resolve(projectRoot, "projects");
        if (!projectName || /[\/\\]|\.\./.test(projectName) || projectName === "." || projectName.startsWith(".")) {
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
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const fs = await import("fs");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) {
            fs.mkdirSync(projectsDir, { recursive: true });
          }
          const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
          const projects = entries.filter((e) => e.isDirectory()).map((e) => {
            const projPath = path.join(projectsDir, e.name);
            const pkgPath = path.join(projPath, "package.json");
            let description = "";
            let framework = "react";
            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                description = pkg.description || "";
                framework = pkg._framework || "react";
              } catch {
              }
            }
            const stat = fs.statSync(projPath);
            return {
              name: e.name,
              path: `projects/${e.name}`,
              createdAt: stat.birthtime.toISOString(),
              framework,
              description
            };
          });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, projects }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/create", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const body = JSON.parse(await readBody(req));
          const { name, framework = "react", description = "" } = body;
          if (!name || typeof name !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing project name" }));
            return;
          }
          const check = validateProjectPath(name);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          const projectDir = check.resolved;
          if (fs.existsSync(projectDir)) {
            res.statusCode = 409;
            res.end(JSON.stringify({ success: false, error: "Project already exists" }));
            return;
          }
          fs.mkdirSync(projectDir, { recursive: true });
          const pkgJson = JSON.stringify({
            name,
            version: "0.0.1",
            private: true,
            description,
            _framework: framework
          }, null, 2);
          fs.writeFileSync(path.join(projectDir, "package.json"), pkgJson, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, framework, description, path: `projects/${name}` }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/delete", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing project name" }));
            return;
          }
          const check = validateProjectPath(name);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: "Project not found" }));
            return;
          }
          fs.rmSync(check.resolved, { recursive: true, force: true });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/files", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let walkDir = function(dir, base) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const result = [];
            for (const entry of entries) {
              if (entry.name === "node_modules" || entry.name === ".cache" || entry.name === "dist") continue;
              const relPath = path.join(base, entry.name);
              if (entry.isDirectory()) {
                result.push({ name: entry.name, path: relPath, type: "directory", children: walkDir(path.join(dir, entry.name), relPath) });
              } else {
                result.push({ name: entry.name, path: relPath, type: "file" });
              }
            }
            return result.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "directory" ? -1 : 1;
            });
          };
          const { name } = JSON.parse(await readBody(req));
          if (!name) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing project name" }));
            return;
          }
          const check = validateProjectPath(name);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: "Project not found" }));
            return;
          }
          const tree = walkDir(check.resolved, "");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, files: tree }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/read-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, filePath } = JSON.parse(await readBody(req));
          if (!name || !filePath) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing name or filePath" }));
            return;
          }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          const exists = fs.existsSync(check.resolved);
          const content = exists ? fs.readFileSync(check.resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content, filePath }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/write-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, filePath, content } = JSON.parse(await readBody(req));
          if (!name || !filePath || typeof content !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing name, filePath, or content" }));
            return;
          }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          const dir = path.dirname(check.resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          let previousContent = "";
          if (fs.existsSync(check.resolved)) previousContent = fs.readFileSync(check.resolved, "utf-8");
          fs.writeFileSync(check.resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      const previewProcesses = /* @__PURE__ */ new Map();
      const projectPort = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
        return 5100 + (hash % 100 + 100) % 100;
      };
      server.middlewares.use("/api/projects/preview", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid project name" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Project not found" }));
            return;
          }
          if (previewProcesses.has(name)) {
            const existing = previewProcesses.get(name);
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
          const usedPorts = new Set([...previewProcesses.values()].map((e) => e.port));
          while (usedPorts.has(port)) port++;
          const { spawn, execSync } = await import("child_process");
          const net = await import("net");
          const portInUse = await new Promise((resolve) => {
            const tester = net.createServer().once("error", (err) => {
              resolve(err.code === "EADDRINUSE");
            }).once("listening", () => {
              tester.close(() => resolve(false));
            }).listen(port);
          });
          if (portInUse) {
            console.log(`[Preview] Port ${port} still in use \u2014 killing`);
            try {
              const netTcp = fs.readFileSync("/proc/net/tcp", "utf-8") + fs.readFileSync("/proc/net/tcp6", "utf-8");
              const portHex = port.toString(16).toUpperCase().padStart(4, "0");
              const lines = netTcp.split("\n").filter((l) => l.includes(`:${portHex} `) && l.includes("0A"));
              for (const line of lines) {
                const cols = line.trim().split(/\s+/);
                const inode = cols[9];
                if (!inode || inode === "0") continue;
                const procDirs = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d));
                for (const pid of procDirs) {
                  try {
                    const fds = fs.readdirSync(`/proc/${pid}/fd`);
                    for (const fd of fds) {
                      try {
                        const link = fs.readlinkSync(`/proc/${pid}/fd/${fd}`);
                        if (link === `socket:[${inode}]`) {
                          console.log(`[Preview] Killing PID ${pid} on port ${port}`);
                          try {
                            process.kill(-parseInt(pid), 9);
                          } catch {
                          }
                          try {
                            process.kill(parseInt(pid), 9);
                          } catch {
                          }
                        }
                      } catch {
                      }
                    }
                  } catch {
                  }
                }
              }
            } catch (e) {
              console.log(`[Preview] Port cleanup error: ${e.message}`);
            }
            await new Promise((r) => setTimeout(r, 800));
          }
          const hasPkg = fs.existsSync(path.join(projectDir, "package.json"));
          const hasNodeModules = fs.existsSync(path.join(projectDir, "node_modules"));
          let pkg = {};
          if (hasPkg) {
            try {
              pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
            } catch {
            }
          }
          const detectPackageManager = () => {
            if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) return "bun";
            if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
            if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
            return "npm";
          };
          const pm = detectPackageManager();
          if (hasPkg && !hasNodeModules) {
            try {
              const { execSync: execSync2 } = await import("child_process");
              const installCmd = pm === "npm" ? "npm install --legacy-peer-deps" : pm === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : pm === "yarn" ? "npx yarn install --ignore-engines" : "npx bun install";
              console.log(`[Preview] Installing deps for ${name} with: ${installCmd}`);
              execSync2(installCmd, { cwd: projectDir, timeout: 12e4, stdio: "pipe", shell: true });
              console.log(`[Preview] Deps installed for ${name}`);
            } catch (installErr) {
              console.error(`[Preview] Install failed for ${name}:`, installErr.message?.slice(0, 300));
              try {
                const { execSync: execSync2 } = await import("child_process");
                console.log(`[Preview] Retrying with npm for ${name}`);
                execSync2("npm install --legacy-peer-deps", { cwd: projectDir, timeout: 12e4, stdio: "pipe", shell: true });
              } catch (retryErr) {
                console.error(`[Preview] Retry also failed for ${name}:`, retryErr.message?.slice(0, 300));
              }
            }
          }
          const detectDevCommand = () => {
            const scripts = pkg.scripts || {};
            const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
            const portStr = String(port);
            const matchScript = (scriptBody) => {
              if (scriptBody.includes("next")) return { cmd: "npx", args: ["next", "dev", "--port", portStr] };
              if (scriptBody.includes("react-scripts")) return { cmd: "npx", args: ["react-scripts", "start"] };
              if (scriptBody.includes("nuxt")) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
              if (scriptBody.includes("astro")) return { cmd: "npx", args: ["astro", "dev", "--port", portStr] };
              if (scriptBody.includes("ng ") || scriptBody.includes("ng serve")) return { cmd: "npx", args: ["ng", "serve", "--host", "0.0.0.0", "--port", portStr, "--disable-host-check"] };
              if (scriptBody.includes("remix")) return { cmd: "npx", args: ["remix", "vite:dev", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("gatsby")) return { cmd: "npx", args: ["gatsby", "develop", "-H", "0.0.0.0", "-p", portStr] };
              if (scriptBody.includes("webpack")) return { cmd: "npx", args: ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("rspack")) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("svelte") || scriptBody.includes("sveltekit")) return null;
              if (scriptBody.includes("parcel")) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("ember")) return { cmd: "npx", args: ["ember", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("vite")) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
              return null;
            };
            const isSvelteKit = deps["@sveltejs/kit"] || deps["sveltekit"];
            const isPnpmMonorepo2 = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));
            if (isPnpmMonorepo2) {
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
            }
            if (scripts.dev) {
              if (isSvelteKit) {
                return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
              }
              const matched = matchScript(scripts.dev);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }
            if (scripts.start) {
              const matched = matchScript(scripts.start);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "start"] : ["run", "start"] };
            }
            if (scripts.serve || scripts["serve:rspack"]) {
              const serveScript = scripts.serve || scripts["serve:rspack"];
              const matched = matchScript(serveScript);
              if (matched) return matched;
              const serveKey = scripts.serve ? "serve" : "serve:rspack";
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", serveKey] : ["run", serveKey] };
            }
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
            if (fs.existsSync(path.join(projectDir, "vite.config.ts")) || fs.existsSync(path.join(projectDir, "vite.config.js")) || fs.existsSync(path.join(projectDir, "vite.config.mjs"))) {
              return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
            }
            return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
          };
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
                execSyncBuild(`pnpm run ${buildKey}`, { cwd: projectDir, stdio: "pipe", timeout: 9e4 });
                console.log(`[Preview] Monorepo packages built successfully`);
              } catch (e) {
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
            path.join(projectDir, "src", "index.html")
          ];
          for (const indexHtmlPath of indexHtmlPaths) {
            if (fs.existsSync(indexHtmlPath)) {
              const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
              if (!indexHtml.includes("guardian-console-bridge")) {
                const patched = indexHtml.replace(/<head([^>]*)>/, `<head$1>
${consoleBridgeScript}`);
                if (patched !== indexHtml) {
                  fs.writeFileSync(indexHtmlPath, patched, "utf-8");
                  console.log(`[Preview] Injected console bridge into ${name}/${path.relative(projectDir, indexHtmlPath)}`);
                }
              }
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
                  `defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 500,
    },
  },`
                );
                if (content !== viteConfigContent) {
                  console.log(`[Preview] Patched ${name}/${cfgName} with usePolling`);
                }
              }
              if (/base:\s*["']\/(__preview|__dev)[^"']*["']/.test(content)) {
                content = content.replace(/\s*base:\s*["']\/(__preview|__dev)[^"']*["'],?\n?/g, "\n");
                console.log(`[Preview] Removed stale base path from ${name}/${cfgName}`);
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
                  rsContent = rsContent.replace(/(devServer:\s*\{)/, `$1
    host: '0.0.0.0',`);
                  changed = true;
                } else if (rsContent.includes("host:") && !rsContent.includes("0.0.0.0")) {
                  rsContent = rsContent.replace(/host:\s*['"][^'"]*['"]/, `host: '0.0.0.0'`);
                  changed = true;
                }
                if (changed) {
                  fs.writeFileSync(rspackPath, rsContent, "utf-8");
                  console.log(`[Preview] Patched ${name}/${rspackCfg} with port ${port} and host 0.0.0.0`);
                }
              } catch {
              }
              break;
            }
          }
          const portEnv = {
            ...process.env,
            BROWSER: "none",
            PORT: String(port),
            HOST: "0.0.0.0",
            HOSTNAME: "0.0.0.0",
            NODE_PATH: path.join(projectDir, "node_modules")
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
            } catch {
            }
          }
          const isWebpackDirect = devCmd.args.includes("webpack") || devCmd.args.includes("webpack-dev-server");
          if (isWebpackDirect && !isReactScripts) {
            portEnv.NODE_OPTIONS = (portEnv.NODE_OPTIONS || "") + " --openssl-legacy-provider";
          }
          const isNextDev = devCmd.args.includes("next");
          if (isNextDev) {
            portEnv.HOSTNAME = "0.0.0.0";
            const nextLockPath = path.join(projectDir, ".next", "dev", "lock");
            try {
              if (fs.existsSync(nextLockPath)) {
                fs.unlinkSync(nextLockPath);
                console.log(`[Preview] Removed stale .next/dev/lock for ${name}`);
              }
            } catch {
            }
          }
          const child = spawn(devCmd.cmd, devCmd.args, {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: true,
            env: portEnv
          });
          child.unref();
          let startupOutput = "";
          let serverReady = false;
          const startupErrors = [];
          const collectOutput = (data) => {
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
          child.on("error", (err) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
            exited = true;
          });
          child.on("exit", (code) => {
            exited = true;
            if (code !== 0 && code !== null) {
              console.error(`[Preview] Process for ${name} exited with code ${code}`);
            }
            previewProcesses.delete(name);
          });
          const maxWait = 15e3;
          const start = Date.now();
          while (Date.now() - start < maxWait && !serverReady && !exited) {
            await new Promise((r) => setTimeout(r, 300));
          }
          res.setHeader("Content-Type", "application/json");
          if (exited && !serverReady) {
            previewProcesses.delete(name);
            res.end(JSON.stringify({
              port,
              started: false,
              error: `Dev server failed to start. ${startupErrors.join(" | ").slice(0, 800)}`,
              output: startupOutput.slice(-2e3),
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`
            }));
          } else {
            res.end(JSON.stringify({
              port,
              started: true,
              ready: serverReady,
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              packageManager: pm
            }));
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/restart-preview", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid project name" }));
            return;
          }
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
              try {
                execSync(`taskkill /pid ${entry.process.pid} /T /F`, { stdio: "pipe" });
              } catch {
              }
            } else {
              try {
                process.kill(-entry.process.pid, "SIGKILL");
              } catch {
                try {
                  entry.process.kill("SIGKILL");
                } catch {
                }
              }
            }
          } catch {
          }
          previewProcesses.delete(name);
          const waitForPortFree = async (port, maxWait) => {
            const net = await import("net");
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const inUse = await new Promise((resolve) => {
                const s = net.createServer();
                s.once("error", () => resolve(true));
                s.once("listening", () => {
                  s.close();
                  resolve(false);
                });
                s.listen(port, "0.0.0.0");
              });
              if (!inUse) return true;
              await new Promise((r) => setTimeout(r, 200));
            }
            return false;
          };
          const portFree = await waitForPortFree(oldPort, 3e3);
          if (!portFree) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ restarted: false, reason: "Port still in use after 3s" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          const { spawn } = await import("child_process");
          let pkg = {};
          const pkgPath = path.join(projectDir, "package.json");
          if (fs.existsSync(pkgPath)) {
            try {
              pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            } catch {
            }
          }
          const scripts = pkg.scripts || {};
          const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
          const detectPMRestart = () => {
            if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) return "bun";
            if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
            if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
            return "npm";
          };
          const pmR = detectPMRestart();
          const restartDetect = () => {
            const portStr = String(oldPort);
            const matchScript = (scriptBody) => {
              if (scriptBody.includes("next")) return { cmd: "npx", args: ["next", "dev", "--port", portStr] };
              if (scriptBody.includes("react-scripts")) return { cmd: "npx", args: ["react-scripts", "start"] };
              if (scriptBody.includes("nuxt")) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
              if (scriptBody.includes("astro")) return { cmd: "npx", args: ["astro", "dev", "--port", portStr] };
              if (scriptBody.includes("webpack")) return { cmd: "npx", args: ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("rspack")) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("svelte") || scriptBody.includes("sveltekit")) return null;
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
              const m = matchScript(scripts.dev);
              if (m) return m;
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }
            if (scripts.start) {
              const m = matchScript(scripts.start);
              if (m) return m;
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "start"] : ["run", "start"] };
            }
            if (scripts.serve || scripts["serve:rspack"]) {
              const s = scripts.serve || scripts["serve:rspack"];
              const m = matchScript(s);
              if (m) return m;
              const k = scripts.serve ? "serve" : "serve:rspack";
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", k] : ["run", k] };
            }
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
          const child = spawn(restartCmd.cmd, restartCmd.args, {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: true,
            env: { ...process.env, BROWSER: "none", PORT: String(oldPort), HOST: "0.0.0.0", HOSTNAME: "0.0.0.0" }
          });
          child.unref();
          previewProcesses.set(name, { process: child, port: oldPort });
          child.stdout?.on("data", (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
          child.stderr?.on("data", (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
          child.on("error", (err) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
          });
          child.on("exit", (code) => {
            if (code !== null && code !== 0) {
              console.error(`[Preview] Process for ${name} exited with code ${code}`);
            }
            previewProcesses.delete(name);
          });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ restarted: true, port: oldPort }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/install-deps", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, dependencies, devDependencies } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid project name" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Project not found" }));
            return;
          }
          const pkgJsonPath = path.join(projectDir, "package.json");
          let pkgJsonValid = false;
          if (fs.existsSync(pkgJsonPath)) {
            try {
              JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
              pkgJsonValid = true;
            } catch {
            }
          }
          if (!pkgJsonValid) {
            fs.writeFileSync(pkgJsonPath, JSON.stringify({ name, version: "0.0.1", private: true }, null, 2));
          }
          const results = [];
          const { exec: execAsync } = await import("child_process");
          const validPkg = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;
          const notAPkg = /* @__PURE__ */ new Set(["npm", "npx", "yarn", "pnpm", "bun", "node", "deno", "run", "dev", "start", "build", "test", "serve", "watch", "lint", "deploy", "preview", "install", "add", "remove", "uninstall", "update", "init", "create", "cd", "ls", "mkdir", "rm", "cp", "mv", "cat", "echo", "touch", "git", "curl", "wget", "then", "and", "or", "the", "a", "an", "to", "in", "of", "for", "with", "from", "your", "this", "that", "it", "is", "are", "was", "be", "has", "have", "do", "does", "if", "not", "no", "yes", "on", "off", "up", "so", "but", "by", "at", "as", "server", "app", "application", "project", "file", "directory", "folder", "next", "first", "following", "above", "below", "after", "before", "all", "any", "each", "every", "both", "new", "old"]);
          const filterPkgs = (arr) => (arr || []).filter((d) => {
            if (!validPkg.test(d) || /[;&|`$(){}]/.test(d)) return false;
            const base = d.replace(/@[^\s]*$/, "").toLowerCase();
            return !notAPkg.has(base) && (base.length > 1 || d.startsWith("@"));
          });
          const safeDeps = filterPkgs(dependencies || []);
          const safeDevDeps = filterPkgs(devDependencies || []);
          let pm = "npm";
          if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) pm = "bun";
          else if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml")) || fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"))) pm = "pnpm";
          else if (fs.existsSync(path.join(projectDir, "yarn.lock"))) pm = "yarn";
          const buildInstallCmd = (pkgs, isDev) => {
            const pkgStr = pkgs.join(" ");
            switch (pm) {
              case "bun":
                return `npx bun add${isDev ? " -d" : ""} ${pkgStr}`;
              case "pnpm":
                return `npx pnpm add${isDev ? " -D" : ""} ${pkgStr}`;
              case "yarn":
                return `npx yarn add${isDev ? " -D" : ""} ${pkgStr}`;
              default:
                return `npm install --legacy-peer-deps${isDev ? " --save-dev" : ""} ${pkgStr}`;
            }
          };
          const errors = [];
          const runInstall = (pkgs, isDev) => new Promise((resolve) => {
            const cmd = buildInstallCmd(pkgs, isDev);
            console.log(`[Deps] Running: ${cmd} in ${name}`);
            execAsync(cmd, { cwd: projectDir, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err, _stdout, stderr) => {
              if (err) {
                console.error(`[Deps] Failed: ${cmd}`, stderr?.slice(0, 300) || err.message?.slice(0, 300));
                if (pm !== "npm") {
                  const npmFallback = `npm install --legacy-peer-deps${isDev ? " --save-dev" : ""} ${pkgs.join(" ")}`;
                  console.log(`[Deps] Retrying with npm: ${npmFallback}`);
                  execAsync(npmFallback, { cwd: projectDir, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err2) => {
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
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/run-command", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, command } = JSON.parse(await readBody(req));
          if (!command || typeof command !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "No command specified" }));
            return;
          }
          const check = validateProjectPath(name || "");
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const allowedPrefixes = [
            "npm ",
            "npx ",
            "yarn ",
            "pnpm ",
            "bun ",
            "node ",
            "deno ",
            "tsc",
            "tsx ",
            "corepack ",
            "nvm ",
            "fnm ",
            "mkdir ",
            "cp ",
            "mv ",
            "rm ",
            "touch ",
            "cat ",
            "ls ",
            "pwd",
            "chmod ",
            "chown ",
            "ln ",
            "git ",
            "curl ",
            "wget ",
            "python",
            "pip",
            "cargo ",
            "go ",
            "rustc",
            "gcc",
            "g++",
            "make",
            "docker ",
            "docker-compose "
          ];
          const trimmed = command.trim().replace(/\s+#\s+.*$/, "").trim();
          if (/[\r\n\x00]/.test(trimmed)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Control characters not allowed in commands" }));
            return;
          }
          if (/^curl-install:https?:\/\//i.test(trimmed)) {
            const scriptUrl = trimmed.replace(/^curl-install:/i, "");
            try {
              const fs2 = await import("fs");
              const projectDir2 = check.resolved;
              if (!fs2.existsSync(projectDir2)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ success: false, error: "Project not found" }));
                return;
              }
              const { exec: execAsync2 } = await import("child_process");
              const os2 = await import("os");
              const isWin2 = os2.platform() === "win32";
              const WIN_NPM_ALTERNATIVES = {
                "bun.sh/install": "npm install -g bun",
                "get.pnpm.io/install.sh": "npm install -g pnpm",
                "install.python-poetry.org": "pip install poetry",
                "rustup.rs": "winget install Rustlang.Rustup",
                "deno.land/install.sh": "npm install -g deno"
              };
              if (isWin2) {
                const winAlt = Object.entries(WIN_NPM_ALTERNATIVES).find(([k]) => scriptUrl.includes(k));
                if (winAlt) {
                  const altCmd = winAlt[1];
                  await new Promise((resolve) => {
                    execAsync2(altCmd, { cwd: projectDir2, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: `${err.message?.slice(0, 400)} (ran: ${altCmd})`, output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: `Windows alternative: ${altCmd}
${(stdout || "").slice(0, 4e3)}` }));
                      }
                      resolve();
                    });
                  });
                  return;
                }
                const ps1Url = scriptUrl.replace(/\.sh$/, ".ps1");
                let usePsScript = false;
                try {
                  const head = await fetch(ps1Url, { method: "HEAD" });
                  usePsScript = head.ok;
                } catch {
                }
                if (usePsScript) {
                  const psCmd = `irm ${ps1Url} | iex`;
                  const encodedCmd = Buffer.from(psCmd, "utf16le").toString("base64");
                  await new Promise((resolve) => {
                    execAsync2(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCmd}`, { cwd: projectDir2, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4e3) }));
                      }
                      resolve();
                    });
                  });
                  return;
                }
              }
              const resp = await fetch(scriptUrl);
              if (!resp.ok) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: `Failed to download script: ${resp.status} ${resp.statusText}` }));
                return;
              }
              const script = await resp.text();
              const tmpScript = path.join(os2.tmpdir(), `install-${Date.now()}.sh`);
              fs2.writeFileSync(tmpScript, script, { mode: 493 });
              await new Promise((resolve) => {
                execAsync2(`bash "${tmpScript}"`, { cwd: projectDir2, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, BUN_INSTALL: projectDir2, CARGO_HOME: projectDir2, RUSTUP_HOME: projectDir2 } }, (err, stdout, stderr) => {
                  try {
                    fs2.unlinkSync(tmpScript);
                  } catch {
                  }
                  res.setHeader("Content-Type", "application/json");
                  if (err) {
                    res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
                  } else {
                    res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4e3) }));
                  }
                  resolve();
                });
              });
            } catch (err) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
          }
          const devServerRe = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
          if (devServerRe.test(trimmed)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Dev server commands should use the Preview button instead" }));
            return;
          }
          const isAllowed = allowedPrefixes.some((p) => trimmed.startsWith(p)) || trimmed === "npm install" || trimmed === "corepack enable";
          if (!isAllowed) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: `Command not allowed: ${trimmed.slice(0, 50)}` }));
            return;
          }
          if (/[;&|`$(){}]/.test(trimmed)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Shell metacharacters not allowed" }));
            return;
          }
          if (/\.\.[\/\\]/.test(trimmed)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Path traversal not allowed" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = check.resolved;
          if (!fs.existsSync(projectDir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: `Project directory not found: ${projectDir}` }));
            return;
          }
          const { exec: execAsync } = await import("child_process");
          const os = await import("os");
          const isWin = os.platform() === "win32";
          let actualCmd = trimmed === "npm install" ? "npm install --legacy-peer-deps" : trimmed;
          const nodeHandled = await (async () => {
            if (/^rm\s+(-rf?\s+)?/i.test(actualCmd)) {
              const targets = actualCmd.replace(/^rm\s+(-rf?\s+)?/i, "").trim().split(/\s+/);
              const results = [];
              for (const t of targets) {
                const targetPath = path.resolve(projectDir, t);
                if (!targetPath.startsWith(projectDir)) {
                  results.push(`Skipped (outside project): ${t}`);
                  continue;
                }
                try {
                  fs.rmSync(targetPath, { recursive: true, force: true });
                  results.push(`Removed: ${t}`);
                } catch (e) {
                  results.push(`Failed to remove ${t}: ${e.message}`);
                }
              }
              return { success: true, output: results.join("\n") };
            }
            if (/^mkdir\s+(-p\s+)?/i.test(actualCmd)) {
              const dir = actualCmd.replace(/^mkdir\s+(-p\s+)?/i, "").trim();
              const dirPath = path.resolve(projectDir, dir);
              if (!dirPath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try {
                fs.mkdirSync(dirPath, { recursive: true });
                return { success: true, output: `Created: ${dir}` };
              } catch (e) {
                return { success: false, error: e.message };
              }
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
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
            if (/^cat\s/i.test(actualCmd)) {
              const file = actualCmd.replace(/^cat\s+/i, "").trim();
              const filePath = path.resolve(projectDir, file);
              if (!filePath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try {
                return { success: true, output: fs.readFileSync(filePath, "utf-8").slice(0, 4e3) };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
            if (/^cp\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^cp\s+(-r\s+)?/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try {
                  fs.cpSync(src, dest, { recursive: true, force: true });
                  return { success: true, output: `Copied: ${args[0]} \u2192 ${args[1]}` };
                } catch (e) {
                  return { success: false, error: e.message };
                }
              }
            }
            if (/^mv\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^mv\s+/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try {
                  fs.renameSync(src, dest);
                  return { success: true, output: `Moved: ${args[0]} \u2192 ${args[1]}` };
                } catch (e) {
                  return { success: false, error: e.message };
                }
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
          await new Promise((resolve) => {
            execAsync(actualCmd, { cwd: projectDir, timeout: 6e4, shell: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
              res.setHeader("Content-Type", "application/json");
              if (err) {
                res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
              } else {
                res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4e3) }));
              }
              resolve();
            });
          });
        } catch (err) {
          const stderr = err.stderr ? String(err.stderr).slice(0, 2e3) : "";
          const stdout = err.stdout ? String(err.stdout).slice(0, 2e3) : "";
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: stdout, stderr }));
        }
      });
      server.middlewares.use("/api/programs/install", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
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
          const programInstallMap = {
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
            "bun": { check: "bun --version", win: 'powershell -c "irm bun.sh/install.ps1|iex"', mac: "curl -fsSL https://bun.sh/install | bash", linux: "curl -fsSL https://bun.sh/install | bash", label: "Bun" },
            "ruby": { check: "ruby --version", win: "choco install ruby -y", mac: "brew install ruby", linux: "sudo apt-get install -y ruby", label: "Ruby" },
            "php": { check: "php --version", win: "choco install php -y", mac: "brew install php", linux: "sudo apt-get install -y php", label: "PHP" }
          };
          const results = [];
          for (const prog of programs) {
            const key = prog.toLowerCase().replace(/[^a-z0-9.+]/g, "");
            const mapping = programInstallMap[key];
            if (!mapping) {
              results.push({ program: prog, label: prog, alreadyInstalled: false, installed: false, error: `Unknown program: ${prog}` });
              continue;
            }
            let alreadyInstalled = false;
            try {
              execSync(mapping.check, { timeout: 1e4, stdio: "pipe", shell: true });
              alreadyInstalled = true;
            } catch {
            }
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
              execSync(installCmd, { timeout: 12e4, stdio: "pipe", shell: true });
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: true, command: installCmd });
            } catch (err) {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: false, error: err.message?.slice(0, 200), command: installCmd });
            }
          }
          res.setHeader("Content-Type", "application/json");
          const allOk = results.every((r) => r.installed || r.alreadyInstalled);
          res.end(JSON.stringify({ success: allOk, results }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/import-github", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { owner, repo } = JSON.parse(await readBody(req));
          if (!owner || !repo || /[\/\\]|\.\./.test(owner) || /[\/\\]|\.\./.test(repo)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid owner or repo" }));
            return;
          }
          const fs = await import("fs");
          const { execSync } = await import("child_process");
          const os = await import("os");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });
          const projectName = repo.toLowerCase().replace(/[^a-z0-9-]/g, "-");
          const projectDir = path.resolve(projectsDir, projectName);
          if (fs.existsSync(projectDir)) {
            res.statusCode = 409;
            res.end(JSON.stringify({ error: `Project '${projectName}' already exists. Delete it first or use a different name.` }));
            return;
          }
          const ghToken = process.env.GITHUB_TOKEN || "";
          const headers = { "User-Agent": "Guardian-AI" };
          if (ghToken) headers["Authorization"] = `token ${ghToken}`;
          const infoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" } });
          if (!infoResp.ok) {
            const status = infoResp.status;
            if (status === 404) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Repository ${owner}/${repo} not found or is private` }));
            } else if (status === 403) {
              res.statusCode = 429;
              res.end(JSON.stringify({ error: "GitHub API rate limit exceeded. Try again later." }));
            } else {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: `GitHub API error: ${status}` }));
            }
            return;
          }
          const repoInfo = await infoResp.json();
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
              execSync(`tar xzf "${tarPath}" --strip-components=1 -C "${projectDir}"`, { timeout: 6e4, stdio: "pipe" });
            } catch (tarErr) {
              try {
                fs.rmSync(projectDir, { recursive: true, force: true });
              } catch {
              }
              throw new Error(`Failed to extract tarball: ${tarErr.message?.slice(0, 200)}`);
            }
            console.log(`[Import] Extracted tarball to ${projectDir}`);
            const CLEANUP_PATTERNS = ["node_modules", ".git", ".next", ".nuxt", "dist", ".cache", ".turbo", ".vercel", ".output"];
            for (const pattern of CLEANUP_PATTERNS) {
              const cleanPath = path.join(projectDir, pattern);
              if (fs.existsSync(cleanPath)) {
                try {
                  fs.rmSync(cleanPath, { recursive: true, force: true });
                } catch {
                }
              }
            }
            const walkAndClean = (dir) => {
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  const full = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                    if (entry.name === "node_modules" || entry.name === ".git") {
                      try {
                        fs.rmSync(full, { recursive: true, force: true });
                      } catch {
                      }
                    } else {
                      walkAndClean(full);
                    }
                  } else if (entry.name === ".DS_Store") {
                    try {
                      fs.unlinkSync(full);
                    } catch {
                    }
                  }
                }
              } catch {
              }
            };
            walkAndClean(projectDir);
            let filesWritten = 0;
            const countFiles = (dir) => {
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
                  else filesWritten++;
                }
              } catch {
              }
            };
            countFiles(projectDir);
            let framework = "vanilla";
            const pkgPath = path.join(projectDir, "package.json");
            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
                if (deps["next"]) framework = "nextjs";
                else if (deps["nuxt"] || deps["nuxt3"]) framework = "nuxt";
                else if (deps["@angular/core"]) framework = "angular";
                else if (deps["svelte"] || deps["@sveltejs/kit"]) framework = "svelte";
                else if (deps["astro"]) framework = "astro";
                else if (deps["vue"]) framework = "vue";
                else if (deps["react"]) framework = "react";
              } catch {
              }
            }
            let npmInstalled = false;
            let installError = "";
            if (fs.existsSync(pkgPath)) {
              const detectPM = () => {
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
              } catch {
              }
              const installCmd = detectedPM === "pnpm" ? "npx pnpm install --no-frozen-lockfile --ignore-scripts" : detectedPM === "yarn" ? "npx yarn install --ignore-engines --ignore-scripts" : detectedPM === "bun" ? "npx bun install --ignore-scripts" : "npm install --legacy-peer-deps --ignore-scripts";
              console.log(`[Import] Installing deps for ${projectName} with: ${installCmd} (pm: ${detectedPM}, monorepo: ${isMonorepo})`);
              try {
                execSync(installCmd, { cwd: projectDir, timeout: 18e4, stdio: "pipe", shell: true });
                npmInstalled = true;
                console.log(`[Import] Deps installed for ${projectName}`);
              } catch (installErr) {
                installError = installErr.stderr?.toString().slice(-500) || installErr.message?.slice(0, 500) || "Unknown error";
                console.error(`[Import] Install failed for ${projectName} with ${detectedPM}:`, installError.slice(0, 300));
                if (detectedPM !== "npm") {
                  try {
                    console.log(`[Import] Retrying with npm for ${projectName}`);
                    execSync("npm install --legacy-peer-deps --ignore-scripts", { cwd: projectDir, timeout: 18e4, stdio: "pipe", shell: true });
                    npmInstalled = true;
                    installError = "";
                    console.log(`[Import] Deps installed for ${projectName} (npm fallback)`);
                  } catch (retryErr) {
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
              ...installError ? { installError: installError.slice(0, 500) } : {}
            }));
          } finally {
            try {
              fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {
            }
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      let activePreviewPort = null;
      const proxyToPreview = async (req, res, port, targetPath) => {
        const http = await import("http");
        const proxyReq = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: targetPath,
            method: req.method,
            headers: { ...req.headers, host: `localhost:${port}` }
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );
        proxyReq.on("error", () => {
          if (!res.headersSent) {
            res.statusCode = 502;
            res.end("Preview server not responding");
          }
        });
        req.pipe(proxyReq, { end: true });
      };
      server.middlewares.use("/__preview", async (req, res) => {
        const match = req.url?.match(/^\/(\d+)(\/.*)?$/) || req.url?.match(/^\/__preview\/(\d+)(\/.*)?$/);
        if (!match) {
          res.statusCode = 400;
          res.end("Invalid preview URL");
          return;
        }
        const port = parseInt(match[1], 10);
        const targetPath = match[2] || "/";
        if (port < 5100 || port > 5200) {
          res.statusCode = 400;
          res.end("Port out of preview range");
          return;
        }
        activePreviewPort = port;
        await proxyToPreview(req, res, port, targetPath);
      });
      const PREVIEW_ASSET_PREFIXES = ["/_next/", "/__nextjs", "/__vite", "/@vite/", "/@id/", "/@fs/", "/node_modules/", "/src/", "/favicon.ico", "/opengraph-image", "/apple-touch-icon", "/manifest.json", "/sw.js", "/workbox-", "/static/", "/sockjs-node/", "/build/", "/_assets/", "/assets/", "/public/", "/polyfills", "/.vite/", "/hmr", "/__webpack_hmr"];
      server.middlewares.use(async (req, res, next) => {
        if (!activePreviewPort || !req.url) {
          next();
          return;
        }
        const shouldProxy = PREVIEW_ASSET_PREFIXES.some((p) => req.url.startsWith(p));
        if (!shouldProxy) {
          next();
          return;
        }
        await proxyToPreview(req, res, activePreviewPort, req.url);
      });
      server.middlewares.use("/api/projects/preview-info", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
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
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/stop-preview", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          const entry = previewProcesses.get(name);
          if (entry) {
            const pid = entry.process.pid;
            try {
              process.kill(-pid, 9);
            } catch {
            }
            try {
              entry.process.kill("SIGKILL");
            } catch {
            }
            try {
              const fs = await import("fs");
              const killPort = async (port) => {
                const netTcp = fs.readFileSync("/proc/net/tcp", "utf-8") + fs.readFileSync("/proc/net/tcp6", "utf-8");
                const portHex = port.toString(16).toUpperCase().padStart(4, "0");
                const lines = netTcp.split("\n").filter((l) => l.includes(`:${portHex} `));
                for (const line of lines) {
                  const cols = line.trim().split(/\s+/);
                  const inode = cols[9];
                  if (!inode || inode === "0") continue;
                  const procDirs = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d));
                  for (const p of procDirs) {
                    try {
                      const fds = fs.readdirSync(`/proc/${p}/fd`);
                      for (const fd of fds) {
                        try {
                          if (fs.readlinkSync(`/proc/${p}/fd/${fd}`) === `socket:[${inode}]`) {
                            try {
                              process.kill(-parseInt(p), 9);
                            } catch {
                            }
                            try {
                              process.kill(parseInt(p), 9);
                            } catch {
                            }
                          }
                        } catch {
                        }
                      }
                    } catch {
                    }
                  }
                }
              };
              await killPort(entry.port);
            } catch {
            }
            if (activePreviewPort === entry.port) activePreviewPort = null;
            previewProcesses.delete(name);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ stopped: true }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}
function sourceDownloadPlugin() {
  return {
    name: "source-download",
    configureServer(server) {
      server.middlewares.use("/api/download-source", async (_req, res) => {
        try {
          const archiver = (await import("file:///home/runner/workspace/node_modules/archiver/index.js")).default;
          const projectRoot = process.cwd();
          res.setHeader("Content-Type", "application/zip");
          res.setHeader("Content-Disposition", "attachment; filename=lambda-recursive-source.zip");
          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.pipe(res);
          const includeDirs = ["src", "public", "supabase", "electron-browser"];
          const includeFiles = [
            "package.json",
            "package-lock.json",
            "tsconfig.json",
            "tsconfig.app.json",
            "tsconfig.node.json",
            "vite.config.ts",
            "tailwind.config.ts",
            "postcss.config.js",
            "index.html",
            "eslint.config.js",
            ".env",
            ".env.example",
            "replit.md",
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
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true,
    hmr: {
      overlay: false
    },
    watch: {
      ignored: ["**/projects/**", "**/.local/**", "**/node_modules/**", "**/.cache/**"]
    }
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]
      },
      manifest: {
        name: "\u03BB Recursive \u2014 Self-Referential IDE",
        short_name: "\u03BB Recursive",
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
            purpose: "any maskable"
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIHR5cGUgUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcblxuZnVuY3Rpb24gZmlsZVdyaXRlUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJmaWxlLXdyaXRlXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvd3JpdGUtZmlsZVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBsZXQgYm9keSA9IFwiXCI7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkgKz0gY2h1bms7XG4gICAgICAgICAgY29uc3QgeyBmaWxlUGF0aCwgY29udGVudCB9ID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICBpZiAoIWZpbGVQYXRoIHx8IHR5cGVvZiBjb250ZW50ICE9PSBcInN0cmluZ1wiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKFwiTWlzc2luZyBmaWxlUGF0aCBvciBjb250ZW50XCIpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdFJvb3QgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBmaWxlUGF0aCk7XG4gICAgICAgICAgaWYgKCFyZXNvbHZlZC5zdGFydHNXaXRoKHByb2plY3RSb290KSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShyZXNvbHZlZCk7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIGZzLm1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgbGV0IHByZXZpb3VzQ29udGVudCA9IFwiXCI7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocmVzb2x2ZWQpKSBwcmV2aW91c0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWQsIFwidXRmLThcIik7XG5cbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHJlc29sdmVkLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBmaWxlUGF0aCwgcHJldmlvdXNDb250ZW50LCBieXRlc1dyaXR0ZW46IGNvbnRlbnQubGVuZ3RoIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9yZWFkLWZpbGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5ICs9IGNodW5rO1xuICAgICAgICAgIGNvbnN0IHsgZmlsZVBhdGggfSA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgICAgaWYgKCFmaWxlUGF0aCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChcIk1pc3NpbmcgZmlsZVBhdGhcIik7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHByb2Nlc3MuY3dkKCk7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBwYXRoLnJlc29sdmUocHJvamVjdFJvb3QsIGZpbGVQYXRoKTtcbiAgICAgICAgICBpZiAoIXJlc29sdmVkLnN0YXJ0c1dpdGgocHJvamVjdFJvb3QpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKFwiUGF0aCBvdXRzaWRlIHByb2plY3RcIik7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZXhpc3RzID0gZnMuZXhpc3RzU3luYyhyZXNvbHZlZCk7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IGV4aXN0cyA/IGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZCwgXCJ1dGYtOFwiKSA6IFwiXCI7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGV4aXN0cywgY29udGVudCB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBwcm9qZWN0TWFuYWdlbWVudFBsdWdpbigpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwicHJvamVjdC1tYW5hZ2VtZW50XCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgYXN5bmMgZnVuY3Rpb24gcmVhZEJvZHkocmVxOiBhbnkpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICBsZXQgYm9keSA9IFwiXCI7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5ICs9IGNodW5rO1xuICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdmFsaWRhdGVQcm9qZWN0UGF0aChwcm9qZWN0TmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZyk6IHsgdmFsaWQ6IGJvb2xlYW47IHJlc29sdmVkOiBzdHJpbmc7IGVycm9yPzogc3RyaW5nIH0ge1xuICAgICAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHByb2Nlc3MuY3dkKCk7XG4gICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBcInByb2plY3RzXCIpO1xuICAgICAgICBpZiAoIXByb2plY3ROYW1lIHx8IC9bXFwvXFxcXF18XFwuXFwuLy50ZXN0KHByb2plY3ROYW1lKSB8fCBwcm9qZWN0TmFtZSA9PT0gJy4nIHx8IHByb2plY3ROYW1lLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgcmVzb2x2ZWQ6IFwiXCIsIGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RzRGlyLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgIGlmICghcHJvamVjdERpci5zdGFydHNXaXRoKHByb2plY3RzRGlyICsgcGF0aC5zZXApICYmIHByb2plY3REaXIgIT09IHByb2plY3RzRGlyKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCByZXNvbHZlZDogXCJcIiwgZXJyb3I6IFwiUGF0aCB0cmF2ZXJzYWwgYmxvY2tlZFwiIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpbGVQYXRoKSB7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghcmVzb2x2ZWQuc3RhcnRzV2l0aChwcm9qZWN0RGlyICsgcGF0aC5zZXApICYmIHJlc29sdmVkICE9PSBwcm9qZWN0RGlyKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIHJlc29sdmVkOiBcIlwiLCBlcnJvcjogXCJGaWxlIHBhdGggdHJhdmVyc2FsIGJsb2NrZWRcIiB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgcmVzb2x2ZWQgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgcmVzb2x2ZWQ6IHByb2plY3REaXIgfTtcbiAgICAgIH1cblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvbGlzdFwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIik7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3RzRGlyKSkge1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3RzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZW50cmllcyA9IGZzLnJlYWRkaXJTeW5jKHByb2plY3RzRGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICAgICAgY29uc3QgcHJvamVjdHMgPSBlbnRyaWVzXG4gICAgICAgICAgICAuZmlsdGVyKChlOiBhbnkpID0+IGUuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgIC5tYXAoKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBwcm9qUGF0aCA9IHBhdGguam9pbihwcm9qZWN0c0RpciwgZS5uYW1lKTtcbiAgICAgICAgICAgICAgY29uc3QgcGtnUGF0aCA9IHBhdGguam9pbihwcm9qUGF0aCwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgIGxldCBkZXNjcmlwdGlvbiA9IFwiXCI7XG4gICAgICAgICAgICAgIGxldCBmcmFtZXdvcmsgPSBcInJlYWN0XCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBrZ1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb24gPSBwa2cuZGVzY3JpcHRpb24gfHwgXCJcIjtcbiAgICAgICAgICAgICAgICAgIGZyYW1ld29yayA9IHBrZy5fZnJhbWV3b3JrIHx8IFwicmVhY3RcIjtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKHByb2pQYXRoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBlLm5hbWUsXG4gICAgICAgICAgICAgICAgcGF0aDogYHByb2plY3RzLyR7ZS5uYW1lfWAsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBzdGF0LmJpcnRodGltZS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGZyYW1ld29yayxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBwcm9qZWN0cyB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvY3JlYXRlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZnJhbWV3b3JrID0gXCJyZWFjdFwiLCBkZXNjcmlwdGlvbiA9IFwiXCIgfSA9IGJvZHk7XG4gICAgICAgICAgaWYgKCFuYW1lIHx8IHR5cGVvZiBuYW1lICE9PSBcInN0cmluZ1wiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIk1pc3NpbmcgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSk7XG4gICAgICAgICAgaWYgKCFjaGVjay52YWxpZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogY2hlY2suZXJyb3IgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IGNoZWNrLnJlc29sdmVkO1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA5OyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlByb2plY3QgYWxyZWFkeSBleGlzdHNcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgY29uc3QgcGtnSnNvbiA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICB2ZXJzaW9uOiBcIjAuMC4xXCIsXG4gICAgICAgICAgICBwcml2YXRlOiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICBfZnJhbWV3b3JrOiBmcmFtZXdvcmssXG4gICAgICAgICAgfSwgbnVsbCwgMik7XG4gICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIHBrZ0pzb24sIFwidXRmLThcIik7XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgbmFtZSwgZnJhbWV3b3JrLCBkZXNjcmlwdGlvbiwgcGF0aDogYHByb2plY3RzLyR7bmFtZX1gIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9kZWxldGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJNaXNzaW5nIHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgY29uc3QgY2hlY2sgPSB2YWxpZGF0ZVByb2plY3RQYXRoKG5hbWUpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjaGVjay5yZXNvbHZlZCkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUHJvamVjdCBub3QgZm91bmRcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgZnMucm1TeW5jKGNoZWNrLnJlc29sdmVkLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIG5hbWUgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL2ZpbGVzXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiTWlzc2luZyBwcm9qZWN0IG5hbWVcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGNvbnN0IGNoZWNrID0gdmFsaWRhdGVQcm9qZWN0UGF0aChuYW1lKTtcbiAgICAgICAgICBpZiAoIWNoZWNrLnZhbGlkKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBjaGVjay5lcnJvciB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY2hlY2sucmVzb2x2ZWQpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA0OyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlByb2plY3Qgbm90IGZvdW5kXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGZ1bmN0aW9uIHdhbGtEaXIoZGlyOiBzdHJpbmcsIGJhc2U6IHN0cmluZyk6IGFueVtdIHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICAgICAgICBpZiAoZW50cnkubmFtZSA9PT0gXCJub2RlX21vZHVsZXNcIiB8fCBlbnRyeS5uYW1lID09PSBcIi5jYWNoZVwiIHx8IGVudHJ5Lm5hbWUgPT09IFwiZGlzdFwiKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgY29uc3QgcmVsUGF0aCA9IHBhdGguam9pbihiYXNlLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7IG5hbWU6IGVudHJ5Lm5hbWUsIHBhdGg6IHJlbFBhdGgsIHR5cGU6IFwiZGlyZWN0b3J5XCIsIGNoaWxkcmVuOiB3YWxrRGlyKHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpLCByZWxQYXRoKSB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7IG5hbWU6IGVudHJ5Lm5hbWUsIHBhdGg6IHJlbFBhdGgsIHR5cGU6IFwiZmlsZVwiIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGEudHlwZSA9PT0gYi50eXBlKSByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGEudHlwZSA9PT0gXCJkaXJlY3RvcnlcIiA/IC0xIDogMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHRyZWUgPSB3YWxrRGlyKGNoZWNrLnJlc29sdmVkLCBcIlwiKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgbmFtZSwgZmlsZXM6IHRyZWUgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3JlYWQtZmlsZVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG5hbWUsIGZpbGVQYXRoIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSB8fCAhZmlsZVBhdGgpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiTWlzc2luZyBuYW1lIG9yIGZpbGVQYXRoXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGZzLmV4aXN0c1N5bmMoY2hlY2sucmVzb2x2ZWQpO1xuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBleGlzdHMgPyBmcy5yZWFkRmlsZVN5bmMoY2hlY2sucmVzb2x2ZWQsIFwidXRmLThcIikgOiBcIlwiO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBleGlzdHMsIGNvbnRlbnQsIGZpbGVQYXRoIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy93cml0ZS1maWxlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZmlsZVBhdGgsIGNvbnRlbnQgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFuYW1lIHx8ICFmaWxlUGF0aCB8fCB0eXBlb2YgY29udGVudCAhPT0gXCJzdHJpbmdcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJNaXNzaW5nIG5hbWUsIGZpbGVQYXRoLCBvciBjb250ZW50XCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShjaGVjay5yZXNvbHZlZCk7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIGZzLm1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgbGV0IHByZXZpb3VzQ29udGVudCA9IFwiXCI7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoY2hlY2sucmVzb2x2ZWQpKSBwcmV2aW91c0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoY2hlY2sucmVzb2x2ZWQsIFwidXRmLThcIik7XG5cbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGNoZWNrLnJlc29sdmVkLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBmaWxlUGF0aCwgcHJldmlvdXNDb250ZW50LCBieXRlc1dyaXR0ZW46IGNvbnRlbnQubGVuZ3RoIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBwcmV2aWV3UHJvY2Vzc2VzID0gbmV3IE1hcDxzdHJpbmcsIHsgcHJvY2VzczogYW55OyBwb3J0OiBudW1iZXIgfT4oKTtcbiAgICAgIGNvbnN0IHByb2plY3RQb3J0ID0gKG5hbWU6IHN0cmluZyk6IG51bWJlciA9PiB7XG4gICAgICAgIGxldCBoYXNoID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lLmxlbmd0aDsgaSsrKSBoYXNoID0gKChoYXNoIDw8IDUpIC0gaGFzaCArIG5hbWUuY2hhckNvZGVBdChpKSkgfCAwO1xuICAgICAgICByZXR1cm4gNTEwMCArICgoKGhhc2ggJSAxMDApICsgMTAwKSAlIDEwMCk7XG4gICAgICB9O1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9wcmV2aWV3XCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUgfHwgL1tcXC9cXFxcXXxcXC5cXC4vLnRlc3QobmFtZSkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJJbnZhbGlkIHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBuYW1lKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJQcm9qZWN0IG5vdCBmb3VuZFwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBpZiAocHJldmlld1Byb2Nlc3Nlcy5oYXMobmFtZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSkhO1xuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc0FsaXZlID0gZXhpc3RpbmcucHJvY2VzcyAmJiAhZXhpc3RpbmcucHJvY2Vzcy5raWxsZWQgJiYgZXhpc3RpbmcucHJvY2Vzcy5leGl0Q29kZSA9PT0gbnVsbDtcbiAgICAgICAgICAgIGlmIChwcm9jZXNzQWxpdmUpIHtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBwb3J0OiBleGlzdGluZy5wb3J0LCByZXVzZWQ6IHRydWUgfSkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQ2xlYW5lZCB1cCBkZWFkIHByb2Nlc3MgZW50cnkgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgcG9ydCA9IHByb2plY3RQb3J0KG5hbWUpO1xuICAgICAgICAgIGNvbnN0IHVzZWRQb3J0cyA9IG5ldyBTZXQoWy4uLnByZXZpZXdQcm9jZXNzZXMudmFsdWVzKCldLm1hcChlID0+IGUucG9ydCkpO1xuICAgICAgICAgIHdoaWxlICh1c2VkUG9ydHMuaGFzKHBvcnQpKSBwb3J0Kys7XG4gICAgICAgICAgY29uc3QgeyBzcGF3biwgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG5cbiAgICAgICAgICBjb25zdCBuZXQgPSBhd2FpdCBpbXBvcnQoXCJuZXRcIik7XG4gICAgICAgICAgY29uc3QgcG9ydEluVXNlID0gYXdhaXQgbmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRlc3RlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKS5vbmNlKFwiZXJyb3JcIiwgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIHJlc29sdmUoZXJyLmNvZGUgPT09IFwiRUFERFJJTlVTRVwiKTtcbiAgICAgICAgICAgIH0pLm9uY2UoXCJsaXN0ZW5pbmdcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICB0ZXN0ZXIuY2xvc2UoKCkgPT4gcmVzb2x2ZShmYWxzZSkpO1xuICAgICAgICAgICAgfSkubGlzdGVuKHBvcnQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChwb3J0SW5Vc2UpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUG9ydCAke3BvcnR9IHN0aWxsIGluIHVzZSBcdTIwMTQga2lsbGluZ2ApO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgbmV0VGNwID0gZnMucmVhZEZpbGVTeW5jKFwiL3Byb2MvbmV0L3RjcFwiLCBcInV0Zi04XCIpICsgZnMucmVhZEZpbGVTeW5jKFwiL3Byb2MvbmV0L3RjcDZcIiwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgY29uc3QgcG9ydEhleCA9IHBvcnQudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkucGFkU3RhcnQoNCwgXCIwXCIpO1xuICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IG5ldFRjcC5zcGxpdChcIlxcblwiKS5maWx0ZXIobCA9PiBsLmluY2x1ZGVzKGA6JHtwb3J0SGV4fSBgKSAmJiBsLmluY2x1ZGVzKFwiMEFcIikpO1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xzID0gbGluZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbm9kZSA9IGNvbHNbOV07XG4gICAgICAgICAgICAgICAgaWYgKCFpbm9kZSB8fCBpbm9kZSA9PT0gXCIwXCIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb2NEaXJzID0gZnMucmVhZGRpclN5bmMoXCIvcHJvY1wiKS5maWx0ZXIoKGQ6IHN0cmluZykgPT4gL15cXGQrJC8udGVzdChkKSk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwaWQgb2YgcHJvY0RpcnMpIHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZkcyA9IGZzLnJlYWRkaXJTeW5jKGAvcHJvYy8ke3BpZH0vZmRgKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmZCBvZiBmZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluayA9IGZzLnJlYWRsaW5rU3luYyhgL3Byb2MvJHtwaWR9L2ZkLyR7ZmR9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGluayA9PT0gYHNvY2tldDpbJHtpbm9kZX1dYCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEtpbGxpbmcgUElEICR7cGlkfSBvbiBwb3J0ICR7cG9ydH1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgcHJvY2Vzcy5raWxsKC1wYXJzZUludChwaWQpLCA5KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBwcm9jZXNzLmtpbGwocGFyc2VJbnQocGlkKSwgOSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkgeyBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFBvcnQgY2xlYW51cCBlcnJvcjogJHtlLm1lc3NhZ2V9YCk7IH1cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCA4MDApKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBoYXNQa2cgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBhY2thZ2UuanNvblwiKSk7XG4gICAgICAgICAgY29uc3QgaGFzTm9kZU1vZHVsZXMgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiKSk7XG5cbiAgICAgICAgICBsZXQgcGtnOiBhbnkgPSB7fTtcbiAgICAgICAgICBpZiAoaGFzUGtnKSB7XG4gICAgICAgICAgICB0cnkgeyBwa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIFwidXRmLThcIikpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGV0ZWN0UGFja2FnZU1hbmFnZXIgPSAoKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImJ1bi5sb2NrYlwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJidW4ubG9ja1wiKSkpIHJldHVybiBcImJ1blwiO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS1sb2NrLnlhbWxcIikpKSByZXR1cm4gXCJwbnBtXCI7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ5YXJuLmxvY2tcIikpKSByZXR1cm4gXCJ5YXJuXCI7XG4gICAgICAgICAgICByZXR1cm4gXCJucG1cIjtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgcG0gPSBkZXRlY3RQYWNrYWdlTWFuYWdlcigpO1xuXG4gICAgICAgICAgaWYgKGhhc1BrZyAmJiAhaGFzTm9kZU1vZHVsZXMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQgPSBwbSA9PT0gXCJucG1cIiA/IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCJcbiAgICAgICAgICAgICAgICA6IHBtID09PSBcInBucG1cIiA/IFwibnB4IHBucG0gaW5zdGFsbCAtLW5vLWZyb3plbi1sb2NrZmlsZVwiXG4gICAgICAgICAgICAgICAgOiBwbSA9PT0gXCJ5YXJuXCIgPyBcIm5weCB5YXJuIGluc3RhbGwgLS1pZ25vcmUtZW5naW5lc1wiXG4gICAgICAgICAgICAgICAgOiBcIm5weCBidW4gaW5zdGFsbFwiO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEluc3RhbGxpbmcgZGVwcyBmb3IgJHtuYW1lfSB3aXRoOiAke2luc3RhbGxDbWR9YCk7XG4gICAgICAgICAgICAgIGV4ZWNTeW5jKGluc3RhbGxDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gRGVwcyBpbnN0YWxsZWQgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGluc3RhbGxFcnI6IGFueSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gSW5zdGFsbCBmYWlsZWQgZm9yICR7bmFtZX06YCwgaW5zdGFsbEVyci5tZXNzYWdlPy5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUmV0cnlpbmcgd2l0aCBucG0gZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgICAgICBleGVjU3luYyhcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwc1wiLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICB9IGNhdGNoIChyZXRyeUVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW1ByZXZpZXddIFJldHJ5IGFsc28gZmFpbGVkIGZvciAke25hbWV9OmAsIHJldHJ5RXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDMwMCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGV0ZWN0RGV2Q29tbWFuZCA9ICgpOiB7IGNtZDogc3RyaW5nOyBhcmdzOiBzdHJpbmdbXSB9ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBwa2cuc2NyaXB0cyB8fCB7fTtcbiAgICAgICAgICAgIGNvbnN0IGRlcHMgPSB7IC4uLihwa2cuZGVwZW5kZW5jaWVzIHx8IHt9KSwgLi4uKHBrZy5kZXZEZXBlbmRlbmNpZXMgfHwge30pIH07XG4gICAgICAgICAgICBjb25zdCBwb3J0U3RyID0gU3RyaW5nKHBvcnQpO1xuXG4gICAgICAgICAgICBjb25zdCBtYXRjaFNjcmlwdCA9IChzY3JpcHRCb2R5OiBzdHJpbmcpOiB7IGNtZDogc3RyaW5nOyBhcmdzOiBzdHJpbmdbXSB9IHwgbnVsbCA9PiB7XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwibmV4dFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJuZXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwicmVhY3Qtc2NyaXB0c1wiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyZWFjdC1zY3JpcHRzXCIsIFwic3RhcnRcIl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJudXh0XCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm51eHRcIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJhc3Ryb1wiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJhc3Ryb1wiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcIm5nIFwiKSB8fCBzY3JpcHRCb2R5LmluY2x1ZGVzKFwibmcgc2VydmVcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmdcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0ciwgXCItLWRpc2FibGUtaG9zdC1jaGVja1wiXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJlbWl4XCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJlbWl4XCIsIFwidml0ZTpkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiZ2F0c2J5XCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcImdhdHNieVwiLCBcImRldmVsb3BcIiwgXCItSFwiLCBcIjAuMC4wLjBcIiwgXCItcFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcIndlYnBhY2tcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wid2VicGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJzcGFja1wiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyc3BhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJzdmVsdGVcIikgfHwgc2NyaXB0Qm9keS5pbmNsdWRlcyhcInN2ZWx0ZWtpdFwiKSkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwicGFyY2VsXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInBhcmNlbFwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJlbWJlclwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJlbWJlclwiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInZpdGVcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBpc1N2ZWx0ZUtpdCA9IGRlcHNbXCJAc3ZlbHRlanMva2l0XCJdIHx8IGRlcHNbXCJzdmVsdGVraXRcIl07XG4gICAgICAgICAgICBjb25zdCBpc1BucG1Nb25vcmVwbyA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS13b3Jrc3BhY2UueWFtbFwiKSk7XG5cbiAgICAgICAgICAgIGlmIChpc1BucG1Nb25vcmVwbykge1xuICAgICAgICAgICAgICBjb25zdCB3c1lhbWwgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS13b3Jrc3BhY2UueWFtbFwiKSwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgY29uc3QgaGFzUGFja2FnZXMgPSB3c1lhbWwuaW5jbHVkZXMoXCJwYWNrYWdlczpcIik7XG4gICAgICAgICAgICAgIGlmIChoYXNQYWNrYWdlcykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHNjcmlwdHMpKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0c1trZXldLmluY2x1ZGVzKFwiLS1maWx0ZXJcIikgJiYgKGtleS5pbmNsdWRlcyhcImRldlwiKSB8fCBrZXkgPT09IFwibHA6ZGV2XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gRGV0ZWN0ZWQgcG5wbSBtb25vcmVwbywgdXNpbmcgc2NyaXB0IFwiJHtrZXl9XCI6ICR7c2NyaXB0c1trZXldfWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IHBtID09PSBcInBucG1cIiA/IFwicG5wbVwiIDogXCJucHggcG5wbVwiLCBhcmdzOiBbXCJydW5cIiwga2V5XSB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2NyaXB0cy5kZXYpIHtcbiAgICAgICAgICAgICAgaWYgKGlzU3ZlbHRlS2l0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ2aXRlXCIsIFwiZGV2XCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IG1hdGNoZWQgPSBtYXRjaFNjcmlwdChzY3JpcHRzLmRldik7XG4gICAgICAgICAgICAgIGlmIChtYXRjaGVkKSByZXR1cm4gbWF0Y2hlZDtcbiAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBwbSA9PT0gXCJucG1cIiA/IFwibnBtXCIgOiBgbnB4ICR7cG19YCwgYXJnczogcG0gPT09IFwibnBtXCIgPyBbXCJydW5cIiwgXCJkZXZcIl0gOiBbXCJydW5cIiwgXCJkZXZcIl0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNjcmlwdHMuc3RhcnQpIHtcbiAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlZCA9IG1hdGNoU2NyaXB0KHNjcmlwdHMuc3RhcnQpO1xuICAgICAgICAgICAgICBpZiAobWF0Y2hlZCkgcmV0dXJuIG1hdGNoZWQ7XG4gICAgICAgICAgICAgIHJldHVybiB7IGNtZDogcG0gPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtfWAsIGFyZ3M6IHBtID09PSBcIm5wbVwiID8gW1wicnVuXCIsIFwic3RhcnRcIl0gOiBbXCJydW5cIiwgXCJzdGFydFwiXSB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2NyaXB0cy5zZXJ2ZSB8fCBzY3JpcHRzW1wic2VydmU6cnNwYWNrXCJdKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHNlcnZlU2NyaXB0ID0gc2NyaXB0cy5zZXJ2ZSB8fCBzY3JpcHRzW1wic2VydmU6cnNwYWNrXCJdO1xuICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gbWF0Y2hTY3JpcHQoc2VydmVTY3JpcHQpO1xuICAgICAgICAgICAgICBpZiAobWF0Y2hlZCkgcmV0dXJuIG1hdGNoZWQ7XG4gICAgICAgICAgICAgIGNvbnN0IHNlcnZlS2V5ID0gc2NyaXB0cy5zZXJ2ZSA/IFwic2VydmVcIiA6IFwic2VydmU6cnNwYWNrXCI7XG4gICAgICAgICAgICAgIHJldHVybiB7IGNtZDogcG0gPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtfWAsIGFyZ3M6IHBtID09PSBcIm5wbVwiID8gW1wicnVuXCIsIHNlcnZlS2V5XSA6IFtcInJ1blwiLCBzZXJ2ZUtleV0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRlcHNbXCJuZXh0XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm5leHRcIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wicmVhY3Qtc2NyaXB0c1wiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyZWFjdC1zY3JpcHRzXCIsIFwic3RhcnRcIl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wibnV4dFwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcImFzdHJvXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcImFzdHJvXCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIkBhbmd1bGFyL2NsaVwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJuZ1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyLCBcIi0tZGlzYWJsZS1ob3N0LWNoZWNrXCJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIkByZW1peC1ydW4vZGV2XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJlbWl4XCIsIFwidml0ZTpkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcImdhdHNieVwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJnYXRzYnlcIiwgXCJkZXZlbG9wXCIsIFwiLUhcIiwgXCIwLjAuMC4wXCIsIFwiLXBcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wid2VicGFjay1kZXYtc2VydmVyXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIndlYnBhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiQHJzcGFjay9jbGlcIl0gfHwgZGVwc1tcIkByc3BhY2svY29yZVwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyc3BhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wicGFyY2VsXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInBhcmNlbFwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChpc1N2ZWx0ZUtpdCkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ2aXRlXCIsIFwiZGV2XCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuXG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ2aXRlLmNvbmZpZy50c1wiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ2aXRlLmNvbmZpZy5qc1wiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ2aXRlLmNvbmZpZy5tanNcIikpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ2aXRlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBkZXZDbWQgPSBkZXRlY3REZXZDb21tYW5kKCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBTdGFydGluZyAke25hbWV9IHdpdGg6ICR7ZGV2Q21kLmNtZH0gJHtkZXZDbWQuYXJncy5qb2luKFwiIFwiKX1gKTtcblxuICAgICAgICAgIGNvbnN0IGlzUG5wbU1vbm9yZXBvID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwbnBtLXdvcmtzcGFjZS55YW1sXCIpKTtcbiAgICAgICAgICBpZiAoaXNQbnBtTW9ub3JlcG8pIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBwa2cuc2NyaXB0cyB8fCB7fTtcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkU2NyaXB0ID0gc2NyaXB0c1tcInBhY2thZ2VzOmJ1aWxkXCJdIHx8IHNjcmlwdHMuYnVpbGQ7XG4gICAgICAgICAgICBpZiAoYnVpbGRTY3JpcHQgJiYgKGJ1aWxkU2NyaXB0LmluY2x1ZGVzKFwiLS1maWx0ZXJcIikgfHwgYnVpbGRTY3JpcHQuaW5jbHVkZXMoXCJwYWNrYWdlc1wiKSkpIHtcbiAgICAgICAgICAgICAgY29uc3QgYnVpbGRLZXkgPSBzY3JpcHRzW1wicGFja2FnZXM6YnVpbGRcIl0gPyBcInBhY2thZ2VzOmJ1aWxkXCIgOiBcImJ1aWxkXCI7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUHJlLWJ1aWxkaW5nIHBucG0gbW9ub3JlcG8gcGFja2FnZXMgd2l0aDogcG5wbSBydW4gJHtidWlsZEtleX1gKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jOiBleGVjU3luY0J1aWxkIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICAgIGV4ZWNTeW5jQnVpbGQoYHBucG0gcnVuICR7YnVpbGRLZXl9YCwgeyBjd2Q6IHByb2plY3REaXIsIHN0ZGlvOiBcInBpcGVcIiwgdGltZW91dDogOTAwMDAgfSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNb25vcmVwbyBwYWNrYWdlcyBidWlsdCBzdWNjZXNzZnVsbHlgKTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNb25vcmVwbyBwYWNrYWdlIGJ1aWxkIHdhcm5pbmc6ICR7ZS5tZXNzYWdlPy5zbGljZSgwLCAyMDApfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY29uc29sZUJyaWRnZVNjcmlwdCA9IGA8c2NyaXB0IGRhdGEtZ3VhcmRpYW4tY29uc29sZS1icmlkZ2U+XG4oZnVuY3Rpb24oKSB7XG4gIGlmICh3aW5kb3cuX19ndWFyZGlhbkNvbnNvbGVCcmlkZ2UpIHJldHVybjtcbiAgd2luZG93Ll9fZ3VhcmRpYW5Db25zb2xlQnJpZGdlID0gdHJ1ZTtcbiAgdmFyIG9yaWdMb2cgPSBjb25zb2xlLmxvZywgb3JpZ1dhcm4gPSBjb25zb2xlLndhcm4sIG9yaWdFcnJvciA9IGNvbnNvbGUuZXJyb3IsIG9yaWdJbmZvID0gY29uc29sZS5pbmZvO1xuICBmdW5jdGlvbiBzZW5kKGxldmVsLCBhcmdzLCBzdGFjaykge1xuICAgIHRyeSB7XG4gICAgICB2YXIgc2VyaWFsaXplZCA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRyeSB7IHNlcmlhbGl6ZWQucHVzaCh0eXBlb2YgYXJnc1tpXSA9PT0gJ29iamVjdCcgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGFyZ3NbaV0pKSA6IGFyZ3NbaV0pOyB9XG4gICAgICAgIGNhdGNoKGUpIHsgc2VyaWFsaXplZC5wdXNoKFN0cmluZyhhcmdzW2ldKSk7IH1cbiAgICAgIH1cbiAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyB0eXBlOiAnZ3VhcmRpYW4tY29uc29sZS1icmlkZ2UnLCBsZXZlbDogbGV2ZWwsIGFyZ3M6IHNlcmlhbGl6ZWQsIHN0YWNrOiBzdGFjayB8fCBudWxsIH0sICcqJyk7XG4gICAgfSBjYXRjaChlKSB7fVxuICB9XG4gIGNvbnNvbGUubG9nID0gZnVuY3Rpb24oKSB7IHNlbmQoJ2xvZycsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpOyBvcmlnTG9nLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIGNvbnNvbGUud2FybiA9IGZ1bmN0aW9uKCkgeyBzZW5kKCd3YXJuJywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7IG9yaWdXYXJuLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIGNvbnNvbGUuZXJyb3IgPSBmdW5jdGlvbigpIHsgc2VuZCgnZXJyb3InLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTsgb3JpZ0Vycm9yLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIGNvbnNvbGUuaW5mbyA9IGZ1bmN0aW9uKCkgeyBzZW5kKCdpbmZvJywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7IG9yaWdJbmZvLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIHdpbmRvdy5vbmVycm9yID0gZnVuY3Rpb24obXNnLCBzb3VyY2UsIGxpbmUsIGNvbHVtbiwgZXJyb3IpIHtcbiAgICBzZW5kKCdlcnJvcicsIFtTdHJpbmcobXNnKV0sIGVycm9yICYmIGVycm9yLnN0YWNrID8gZXJyb3Iuc3RhY2sgOiBudWxsKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd1bmhhbmRsZWRyZWplY3Rpb24nLCBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciByZWFzb24gPSBldmVudC5yZWFzb247XG4gICAgdmFyIG1zZyA9IHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yID8gcmVhc29uLm1lc3NhZ2UgOiBTdHJpbmcocmVhc29uKTtcbiAgICB2YXIgc3RhY2sgPSByZWFzb24gaW5zdGFuY2VvZiBFcnJvciA/IHJlYXNvbi5zdGFjayA6IG51bGw7XG4gICAgc2VuZCgnZXJyb3InLCBbJ1VuaGFuZGxlZCBQcm9taXNlIFJlamVjdGlvbjogJyArIG1zZ10sIHN0YWNrKTtcbiAgfSk7XG59KSgpO1xuPC9zY3JpcHQ+YDtcblxuICAgICAgICAgIGNvbnN0IGluZGV4SHRtbFBhdGhzID0gW1xuICAgICAgICAgICAgcGF0aC5qb2luKHByb2plY3REaXIsIFwiaW5kZXguaHRtbFwiKSxcbiAgICAgICAgICAgIHBhdGguam9pbihwcm9qZWN0RGlyLCBcInB1YmxpY1wiLCBcImluZGV4Lmh0bWxcIiksXG4gICAgICAgICAgICBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJzcmNcIiwgXCJpbmRleC5odG1sXCIpLFxuICAgICAgICAgIF07XG4gICAgICAgICAgZm9yIChjb25zdCBpbmRleEh0bWxQYXRoIG9mIGluZGV4SHRtbFBhdGhzKSB7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbmRleEh0bWxQYXRoKSkge1xuICAgICAgICAgICAgICBjb25zdCBpbmRleEh0bWwgPSBmcy5yZWFkRmlsZVN5bmMoaW5kZXhIdG1sUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgaWYgKCFpbmRleEh0bWwuaW5jbHVkZXMoXCJndWFyZGlhbi1jb25zb2xlLWJyaWRnZVwiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGNoZWQgPSBpbmRleEh0bWwucmVwbGFjZSgvPGhlYWQoW14+XSopPi8sIGA8aGVhZCQxPlxcbiR7Y29uc29sZUJyaWRnZVNjcmlwdH1gKTtcbiAgICAgICAgICAgICAgICBpZiAocGF0Y2hlZCAhPT0gaW5kZXhIdG1sKSB7XG4gICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGluZGV4SHRtbFBhdGgsIHBhdGNoZWQsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEluamVjdGVkIGNvbnNvbGUgYnJpZGdlIGludG8gJHtuYW1lfS8ke3BhdGgucmVsYXRpdmUocHJvamVjdERpciwgaW5kZXhIdG1sUGF0aCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZm9yIChjb25zdCBjZmdOYW1lIG9mIFtcInZpdGUuY29uZmlnLnRzXCIsIFwidml0ZS5jb25maWcuanNcIiwgXCJ2aXRlLmNvbmZpZy5tanNcIl0pIHtcbiAgICAgICAgICAgIGNvbnN0IHZpdGVDb25maWdQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIGNmZ05hbWUpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModml0ZUNvbmZpZ1BhdGgpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHZpdGVDb25maWdDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHZpdGVDb25maWdQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICBsZXQgY29udGVudCA9IHZpdGVDb25maWdDb250ZW50O1xuICAgICAgICAgICAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoXCJ1c2VQb2xsaW5nXCIpKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgIC9kZWZpbmVDb25maWdcXChcXHsvLFxuICAgICAgICAgICAgICAgICAgYGRlZmluZUNvbmZpZyh7XFxuICBzZXJ2ZXI6IHtcXG4gICAgd2F0Y2g6IHtcXG4gICAgICB1c2VQb2xsaW5nOiB0cnVlLFxcbiAgICAgIGludGVydmFsOiA1MDAsXFxuICAgIH0sXFxuICB9LGBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZW50ICE9PSB2aXRlQ29uZmlnQ29udGVudCkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQYXRjaGVkICR7bmFtZX0vJHtjZmdOYW1lfSB3aXRoIHVzZVBvbGxpbmdgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKC9iYXNlOlxccypbXCInXVxcLyhfX3ByZXZpZXd8X19kZXYpW15cIiddKltcIiddLy50ZXN0KGNvbnRlbnQpKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvXFxzKmJhc2U6XFxzKltcIiddXFwvKF9fcHJldmlld3xfX2RldilbXlwiJ10qW1wiJ10sP1xcbj8vZywgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZW1vdmVkIHN0YWxlIGJhc2UgcGF0aCBmcm9tICR7bmFtZX0vJHtjZmdOYW1lfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChjb250ZW50ICE9PSB2aXRlQ29uZmlnQ29udGVudCkge1xuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModml0ZUNvbmZpZ1BhdGgsIGNvbnRlbnQsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZm9yIChjb25zdCByc3BhY2tDZmcgb2YgW1wicnNwYWNrLmNvbmZpZy5qc1wiLCBcInJzcGFjay5jb25maWcudHNcIl0pIHtcbiAgICAgICAgICAgIGNvbnN0IHJzcGFja1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgcnNwYWNrQ2ZnKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHJzcGFja1BhdGgpKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbGV0IHJzQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhyc3BhY2tQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9ydE1hdGNoID0gcnNDb250ZW50Lm1hdGNoKC9wb3J0OlxccyooXFxkKykvKTtcbiAgICAgICAgICAgICAgICBpZiAocG9ydE1hdGNoICYmIHBvcnRNYXRjaFsxXSAhPT0gU3RyaW5nKHBvcnQpKSB7XG4gICAgICAgICAgICAgICAgICByc0NvbnRlbnQgPSByc0NvbnRlbnQucmVwbGFjZSgvcG9ydDpcXHMqXFxkKy8sIGBwb3J0OiAke3BvcnR9YCk7XG4gICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJzQ29udGVudC5pbmNsdWRlcyhcImRldlNlcnZlclwiKSAmJiAhcnNDb250ZW50LmluY2x1ZGVzKFwiaG9zdDpcIikpIHtcbiAgICAgICAgICAgICAgICAgIHJzQ29udGVudCA9IHJzQ29udGVudC5yZXBsYWNlKC8oZGV2U2VydmVyOlxccypcXHspLywgYCQxXFxuICAgIGhvc3Q6ICcwLjAuMC4wJyxgKTtcbiAgICAgICAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocnNDb250ZW50LmluY2x1ZGVzKFwiaG9zdDpcIikgJiYgIXJzQ29udGVudC5pbmNsdWRlcyhcIjAuMC4wLjBcIikpIHtcbiAgICAgICAgICAgICAgICAgIHJzQ29udGVudCA9IHJzQ29udGVudC5yZXBsYWNlKC9ob3N0OlxccypbJ1wiXVteJ1wiXSpbJ1wiXS8sIGBob3N0OiAnMC4wLjAuMCdgKTtcbiAgICAgICAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhyc3BhY2tQYXRoLCByc0NvbnRlbnQsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFBhdGNoZWQgJHtuYW1lfS8ke3JzcGFja0NmZ30gd2l0aCBwb3J0ICR7cG9ydH0gYW5kIGhvc3QgMC4wLjAuMGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwb3J0RW52OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICAgLi4ucHJvY2Vzcy5lbnYgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgICAgICAgICAgIEJST1dTRVI6IFwibm9uZVwiLFxuICAgICAgICAgICAgUE9SVDogU3RyaW5nKHBvcnQpLFxuICAgICAgICAgICAgSE9TVDogXCIwLjAuMC4wXCIsXG4gICAgICAgICAgICBIT1NUTkFNRTogXCIwLjAuMC4wXCIsXG4gICAgICAgICAgICBOT0RFX1BBVEg6IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiKSxcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgaXNSZWFjdFNjcmlwdHMgPSBkZXZDbWQuYXJncy5pbmNsdWRlcyhcInJlYWN0LXNjcmlwdHNcIik7XG4gICAgICAgICAgaWYgKGlzUmVhY3RTY3JpcHRzKSB7XG4gICAgICAgICAgICBwb3J0RW52LlBPUlQgPSBTdHJpbmcocG9ydCk7XG4gICAgICAgICAgICBwb3J0RW52LkhPU1QgPSBcIjAuMC4wLjBcIjtcbiAgICAgICAgICAgIHBvcnRFbnYuU0tJUF9QUkVGTElHSFRfQ0hFQ0sgPSBcInRydWVcIjtcbiAgICAgICAgICAgIHBvcnRFbnYuUFVCTElDX1VSTCA9IFwiXCI7XG4gICAgICAgICAgICBwb3J0RW52Lk5PREVfT1BUSU9OUyA9IChwb3J0RW52Lk5PREVfT1BUSU9OUyB8fCBcIlwiKSArIFwiIC0tb3BlbnNzbC1sZWdhY3ktcHJvdmlkZXJcIjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZ1JhdyA9IGZzLnJlYWRGaWxlU3luYyhwa2dQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICBjb25zdCBwa2dPYmogPSBKU09OLnBhcnNlKHBrZ1Jhdyk7XG4gICAgICAgICAgICAgIGlmIChwa2dPYmouaG9tZXBhZ2UpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgcGtnT2JqLmhvbWVwYWdlO1xuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGtnUGF0aCwgSlNPTi5zdHJpbmdpZnkocGtnT2JqLCBudWxsLCAyKSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZW1vdmVkIGhvbWVwYWdlIGZyb20gJHtuYW1lfS9wYWNrYWdlLmpzb24gZm9yIGNvcnJlY3QgZGV2IHNlcnZpbmdgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGlzV2VicGFja0RpcmVjdCA9IGRldkNtZC5hcmdzLmluY2x1ZGVzKFwid2VicGFja1wiKSB8fCBkZXZDbWQuYXJncy5pbmNsdWRlcyhcIndlYnBhY2stZGV2LXNlcnZlclwiKTtcbiAgICAgICAgICBpZiAoaXNXZWJwYWNrRGlyZWN0ICYmICFpc1JlYWN0U2NyaXB0cykge1xuICAgICAgICAgICAgcG9ydEVudi5OT0RFX09QVElPTlMgPSAocG9ydEVudi5OT0RFX09QVElPTlMgfHwgXCJcIikgKyBcIiAtLW9wZW5zc2wtbGVnYWN5LXByb3ZpZGVyXCI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaXNOZXh0RGV2ID0gZGV2Q21kLmFyZ3MuaW5jbHVkZXMoXCJuZXh0XCIpO1xuICAgICAgICAgIGlmIChpc05leHREZXYpIHtcbiAgICAgICAgICAgIHBvcnRFbnYuSE9TVE5BTUUgPSBcIjAuMC4wLjBcIjtcbiAgICAgICAgICAgIGNvbnN0IG5leHRMb2NrUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIi5uZXh0XCIsIFwiZGV2XCIsIFwibG9ja1wiKTtcbiAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKG5leHRMb2NrUGF0aCkpIHsgZnMudW5saW5rU3luYyhuZXh0TG9ja1BhdGgpOyBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFJlbW92ZWQgc3RhbGUgLm5leHQvZGV2L2xvY2sgZm9yICR7bmFtZX1gKTsgfSB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY2hpbGQgPSBzcGF3bihkZXZDbWQuY21kLCBkZXZDbWQuYXJncywge1xuICAgICAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICAgICAgc3RkaW86IFwicGlwZVwiLFxuICAgICAgICAgICAgc2hlbGw6IHRydWUsXG4gICAgICAgICAgICBkZXRhY2hlZDogdHJ1ZSxcbiAgICAgICAgICAgIGVudjogcG9ydEVudixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjaGlsZC51bnJlZigpO1xuXG4gICAgICAgICAgbGV0IHN0YXJ0dXBPdXRwdXQgPSBcIlwiO1xuICAgICAgICAgIGxldCBzZXJ2ZXJSZWFkeSA9IGZhbHNlO1xuICAgICAgICAgIGNvbnN0IHN0YXJ0dXBFcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgICBjb25zdCBjb2xsZWN0T3V0cHV0ID0gKGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGV4dCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHN0YXJ0dXBPdXRwdXQgKz0gdGV4dDtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlldzoke25hbWV9XSAke3RleHQudHJpbSgpfWApO1xuICAgICAgICAgICAgaWYgKC9yZWFkeXxWSVRFLipyZWFkeXxjb21waWxlZHxzdGFydGVkIHNlcnZlcnxsaXN0ZW5pbmd8TG9jYWw6L2kudGVzdCh0ZXh0KSkge1xuICAgICAgICAgICAgICBzZXJ2ZXJSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoL2Vycm9yfEVSUiF8Q2Fubm90IGZpbmR8TU9EVUxFX05PVF9GT1VORHxTeW50YXhFcnJvcnxFTk9FTlQvaS50ZXN0KHRleHQpKSB7XG4gICAgICAgICAgICAgIHN0YXJ0dXBFcnJvcnMucHVzaCh0ZXh0LnRyaW0oKS5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgY29sbGVjdE91dHB1dCk7XG4gICAgICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgY29sbGVjdE91dHB1dCk7XG5cbiAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLnNldChuYW1lLCB7IHByb2Nlc3M6IGNoaWxkLCBwb3J0IH0pO1xuXG4gICAgICAgICAgbGV0IGV4aXRlZCA9IGZhbHNlO1xuICAgICAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBlcnJvciBmb3IgJHtuYW1lfTpgLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY2hpbGQub24oXCJleGl0XCIsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDAgJiYgY29kZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBmb3IgJHtuYW1lfSBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc3QgbWF4V2FpdCA9IDE1MDAwO1xuICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgbWF4V2FpdCAmJiAhc2VydmVyUmVhZHkgJiYgIWV4aXRlZCkge1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDMwMCkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIGlmIChleGl0ZWQgJiYgIXNlcnZlclJlYWR5KSB7XG4gICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgICBzdGFydGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgZXJyb3I6IGBEZXYgc2VydmVyIGZhaWxlZCB0byBzdGFydC4gJHtzdGFydHVwRXJyb3JzLmpvaW4oXCIgfCBcIikuc2xpY2UoMCwgODAwKX1gLFxuICAgICAgICAgICAgICBvdXRwdXQ6IHN0YXJ0dXBPdXRwdXQuc2xpY2UoLTIwMDApLFxuICAgICAgICAgICAgICBkZXRlY3RlZENvbW1hbmQ6IGAke2RldkNtZC5jbWR9ICR7ZGV2Q21kLmFyZ3Muam9pbihcIiBcIil9YCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICAgIHN0YXJ0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHJlYWR5OiBzZXJ2ZXJSZWFkeSxcbiAgICAgICAgICAgICAgZGV0ZWN0ZWRDb21tYW5kOiBgJHtkZXZDbWQuY21kfSAke2RldkNtZC5hcmdzLmpvaW4oXCIgXCIpfWAsXG4gICAgICAgICAgICAgIHBhY2thZ2VNYW5hZ2VyOiBwbSxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9yZXN0YXJ0LXByZXZpZXdcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSB8fCAvW1xcL1xcXFxdfFxcLlxcLi8udGVzdChuYW1lKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgcmVzdGFydGVkOiBmYWxzZSwgcmVhc29uOiBcIk5vIGFjdGl2ZSBwcmV2aWV3XCIgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG9sZFBvcnQgPSBlbnRyeS5wb3J0O1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgIHRyeSB7IGV4ZWNTeW5jKGB0YXNra2lsbCAvcGlkICR7ZW50cnkucHJvY2Vzcy5waWR9IC9UIC9GYCwgeyBzdGRpbzogXCJwaXBlXCIgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7IHByb2Nlc3Mua2lsbCgtZW50cnkucHJvY2Vzcy5waWQsIFwiU0lHS0lMTFwiKTsgfSBjYXRjaCB7IHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR0tJTExcIik7IH0gY2F0Y2gge30gfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcblxuICAgICAgICAgIGNvbnN0IHdhaXRGb3JQb3J0RnJlZSA9IGFzeW5jIChwb3J0OiBudW1iZXIsIG1heFdhaXQ6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmV0ID0gYXdhaXQgaW1wb3J0KFwibmV0XCIpO1xuICAgICAgICAgICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydCA8IG1heFdhaXQpIHtcbiAgICAgICAgICAgICAgY29uc3QgaW5Vc2UgPSBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPihyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuICAgICAgICAgICAgICAgIHMub25jZShcImVycm9yXCIsICgpID0+IHJlc29sdmUodHJ1ZSkpO1xuICAgICAgICAgICAgICAgIHMub25jZShcImxpc3RlbmluZ1wiLCAoKSA9PiB7IHMuY2xvc2UoKTsgcmVzb2x2ZShmYWxzZSk7IH0pO1xuICAgICAgICAgICAgICAgIHMubGlzdGVuKHBvcnQsIFwiMC4wLjAuMFwiKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGlmICghaW5Vc2UpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMjAwKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCBwb3J0RnJlZSA9IGF3YWl0IHdhaXRGb3JQb3J0RnJlZShvbGRQb3J0LCAzMDAwKTtcbiAgICAgICAgICBpZiAoIXBvcnRGcmVlKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyByZXN0YXJ0ZWQ6IGZhbHNlLCByZWFzb246IFwiUG9ydCBzdGlsbCBpbiB1c2UgYWZ0ZXIgM3NcIiB9KSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIiwgbmFtZSk7XG4gICAgICAgICAgY29uc3QgeyBzcGF3biB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcblxuICAgICAgICAgIGxldCBwa2c6IGFueSA9IHt9O1xuICAgICAgICAgIGNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGtnUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBwa2cuc2NyaXB0cyB8fCB7fTtcbiAgICAgICAgICBjb25zdCBkZXBzID0geyAuLi4ocGtnLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihwa2cuZGV2RGVwZW5kZW5jaWVzIHx8IHt9KSB9O1xuXG4gICAgICAgICAgY29uc3QgZGV0ZWN0UE1SZXN0YXJ0ID0gKCk6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJidW4ubG9ja2JcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiYnVuLmxvY2tcIikpKSByZXR1cm4gXCJidW5cIjtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0tbG9jay55YW1sXCIpKSkgcmV0dXJuIFwicG5wbVwiO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwieWFybi5sb2NrXCIpKSkgcmV0dXJuIFwieWFyblwiO1xuICAgICAgICAgICAgcmV0dXJuIFwibnBtXCI7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCBwbVIgPSBkZXRlY3RQTVJlc3RhcnQoKTtcblxuICAgICAgICAgIGNvbnN0IHJlc3RhcnREZXRlY3QgPSAoKTogeyBjbWQ6IHN0cmluZzsgYXJnczogc3RyaW5nW10gfSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwb3J0U3RyID0gU3RyaW5nKG9sZFBvcnQpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hTY3JpcHQgPSAoc2NyaXB0Qm9keTogc3RyaW5nKTogeyBjbWQ6IHN0cmluZzsgYXJnczogc3RyaW5nW10gfSB8IG51bGwgPT4ge1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcIm5leHRcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJlYWN0LXNjcmlwdHNcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVhY3Qtc2NyaXB0c1wiLCBcInN0YXJ0XCJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwibnV4dFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiYXN0cm9cIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiYXN0cm9cIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJ3ZWJwYWNrXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIndlYnBhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJyc3BhY2tcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicnNwYWNrXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwic3ZlbHRlXCIpIHx8IHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJzdmVsdGVraXRcIikpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInZpdGVcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgaXNTdmVsdGVLaXQgPSBkZXBzW1wiQHN2ZWx0ZWpzL2tpdFwiXSB8fCBkZXBzW1wic3ZlbHRla2l0XCJdO1xuICAgICAgICAgICAgY29uc3QgaXNQbnBtTW9ubyA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS13b3Jrc3BhY2UueWFtbFwiKSk7XG4gICAgICAgICAgICBpZiAoaXNQbnBtTW9ubykge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhzY3JpcHRzKSkge1xuICAgICAgICAgICAgICAgIGlmIChzY3JpcHRzW2tleV0uaW5jbHVkZXMoXCItLWZpbHRlclwiKSAmJiAoa2V5LmluY2x1ZGVzKFwiZGV2XCIpIHx8IGtleSA9PT0gXCJscDpkZXZcIikpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7IGNtZDogXCJwbnBtXCIsIGFyZ3M6IFtcInJ1blwiLCBrZXldIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2NyaXB0cy5kZXYpIHtcbiAgICAgICAgICAgICAgaWYgKGlzU3ZlbHRlS2l0KSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCJkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGNvbnN0IG0gPSBtYXRjaFNjcmlwdChzY3JpcHRzLmRldik7IGlmIChtKSByZXR1cm4gbTtcbiAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBwbVIgPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtUn1gLCBhcmdzOiBwbVIgPT09IFwibnBtXCIgPyBbXCJydW5cIiwgXCJkZXZcIl0gOiBbXCJydW5cIiwgXCJkZXZcIl0gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzY3JpcHRzLnN0YXJ0KSB7IGNvbnN0IG0gPSBtYXRjaFNjcmlwdChzY3JpcHRzLnN0YXJ0KTsgaWYgKG0pIHJldHVybiBtOyByZXR1cm4geyBjbWQ6IHBtUiA9PT0gXCJucG1cIiA/IFwibnBtXCIgOiBgbnB4ICR7cG1SfWAsIGFyZ3M6IHBtUiA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBcInN0YXJ0XCJdIDogW1wicnVuXCIsIFwic3RhcnRcIl0gfTsgfVxuICAgICAgICAgICAgaWYgKHNjcmlwdHMuc2VydmUgfHwgc2NyaXB0c1tcInNlcnZlOnJzcGFja1wiXSkgeyBjb25zdCBzID0gc2NyaXB0cy5zZXJ2ZSB8fCBzY3JpcHRzW1wic2VydmU6cnNwYWNrXCJdOyBjb25zdCBtID0gbWF0Y2hTY3JpcHQocyk7IGlmIChtKSByZXR1cm4gbTsgY29uc3QgayA9IHNjcmlwdHMuc2VydmUgPyBcInNlcnZlXCIgOiBcInNlcnZlOnJzcGFja1wiOyByZXR1cm4geyBjbWQ6IHBtUiA9PT0gXCJucG1cIiA/IFwibnBtXCIgOiBgbnB4ICR7cG1SfWAsIGFyZ3M6IHBtUiA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBrXSA6IFtcInJ1blwiLCBrXSB9OyB9XG4gICAgICAgICAgICBpZiAoZGVwc1tcIm5leHRcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJyZWFjdC1zY3JpcHRzXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJlYWN0LXNjcmlwdHNcIiwgXCJzdGFydFwiXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJudXh0XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm51eHRcIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiYXN0cm9cIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiYXN0cm9cIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiQGFuZ3VsYXIvY2xpXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm5nXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHIsIFwiLS1kaXNhYmxlLWhvc3QtY2hlY2tcIl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiQHJlbWl4LXJ1bi9kZXZcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVtaXhcIiwgXCJ2aXRlOmRldlwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiZ2F0c2J5XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcImdhdHNieVwiLCBcImRldmVsb3BcIiwgXCItSFwiLCBcIjAuMC4wLjBcIiwgXCItcFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJ3ZWJwYWNrLWRldi1zZXJ2ZXJcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wid2VicGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJAcnNwYWNrL2NsaVwiXSB8fCBkZXBzW1wiQHJzcGFjay9jb3JlXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJzcGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJwYXJjZWxcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicGFyY2VsXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGlzU3ZlbHRlS2l0KSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCJkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCByZXN0YXJ0Q21kID0gcmVzdGFydERldGVjdCgpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUmVzdGFydGluZyAke25hbWV9IHdpdGg6ICR7cmVzdGFydENtZC5jbWR9ICR7cmVzdGFydENtZC5hcmdzLmpvaW4oXCIgXCIpfWApO1xuXG4gICAgICAgICAgY29uc3QgY2hpbGQgPSBzcGF3bihyZXN0YXJ0Q21kLmNtZCwgcmVzdGFydENtZC5hcmdzLCB7XG4gICAgICAgICAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgICAgICAgICBzdGRpbzogXCJwaXBlXCIsXG4gICAgICAgICAgICBzaGVsbDogdHJ1ZSxcbiAgICAgICAgICAgIGRldGFjaGVkOiB0cnVlLFxuICAgICAgICAgICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBCUk9XU0VSOiBcIm5vbmVcIiwgUE9SVDogU3RyaW5nKG9sZFBvcnQpLCBIT1NUOiBcIjAuMC4wLjBcIiwgSE9TVE5BTUU6IFwiMC4wLjAuMFwiIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY2hpbGQudW5yZWYoKTtcblxuICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuc2V0KG5hbWUsIHsgcHJvY2VzczogY2hpbGQsIHBvcnQ6IG9sZFBvcnQgfSk7XG5cbiAgICAgICAgICBjaGlsZC5zdGRvdXQ/Lm9uKFwiZGF0YVwiLCAoZDogQnVmZmVyKSA9PiBjb25zb2xlLmxvZyhgW1ByZXZpZXc6JHtuYW1lfV0gJHtkLnRvU3RyaW5nKCkudHJpbSgpfWApKTtcbiAgICAgICAgICBjaGlsZC5zdGRlcnI/Lm9uKFwiZGF0YVwiLCAoZDogQnVmZmVyKSA9PiBjb25zb2xlLmxvZyhgW1ByZXZpZXc6JHtuYW1lfV0gJHtkLnRvU3RyaW5nKCkudHJpbSgpfWApKTtcblxuICAgICAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBlcnJvciBmb3IgJHtuYW1lfTpgLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY2hpbGQub24oXCJleGl0XCIsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgICAgICAgICBpZiAoY29kZSAhPT0gbnVsbCAmJiBjb2RlICE9PSAwKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtQcmV2aWV3XSBQcm9jZXNzIGZvciAke25hbWV9IGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgcmVzdGFydGVkOiB0cnVlLCBwb3J0OiBvbGRQb3J0IH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL2luc3RhbGwtZGVwc1wiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG5hbWUsIGRlcGVuZGVuY2llcywgZGV2RGVwZW5kZW5jaWVzIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSB8fCAvW1xcL1xcXFxdfFxcLlxcLi8udGVzdChuYW1lKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIG5hbWUpO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwNDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlByb2plY3Qgbm90IGZvdW5kXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgIGxldCBwa2dKc29uVmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwa2dKc29uUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ0pzb25QYXRoLCBcInV0Zi04XCIpKTsgcGtnSnNvblZhbGlkID0gdHJ1ZTsgfSBjYXRjaCB7fVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXBrZ0pzb25WYWxpZCkge1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwa2dKc29uUGF0aCwgSlNPTi5zdHJpbmdpZnkoeyBuYW1lLCB2ZXJzaW9uOiBcIjAuMC4xXCIsIHByaXZhdGU6IHRydWUgfSwgbnVsbCwgMikpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgY29uc3QgeyBleGVjOiBleGVjQXN5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgY29uc3QgdmFsaWRQa2cgPSAvXihAW2EtejAtOS5fLV0rXFwvKT9bYS16MC05Ll8tXSsoQFteXFxzXSopPyQvO1xuICAgICAgICAgIGNvbnN0IG5vdEFQa2cgPSBuZXcgU2V0KFtcIm5wbVwiLFwibnB4XCIsXCJ5YXJuXCIsXCJwbnBtXCIsXCJidW5cIixcIm5vZGVcIixcImRlbm9cIixcInJ1blwiLFwiZGV2XCIsXCJzdGFydFwiLFwiYnVpbGRcIixcInRlc3RcIixcInNlcnZlXCIsXCJ3YXRjaFwiLFwibGludFwiLFwiZGVwbG95XCIsXCJwcmV2aWV3XCIsXCJpbnN0YWxsXCIsXCJhZGRcIixcInJlbW92ZVwiLFwidW5pbnN0YWxsXCIsXCJ1cGRhdGVcIixcImluaXRcIixcImNyZWF0ZVwiLFwiY2RcIixcImxzXCIsXCJta2RpclwiLFwicm1cIixcImNwXCIsXCJtdlwiLFwiY2F0XCIsXCJlY2hvXCIsXCJ0b3VjaFwiLFwiZ2l0XCIsXCJjdXJsXCIsXCJ3Z2V0XCIsXCJ0aGVuXCIsXCJhbmRcIixcIm9yXCIsXCJ0aGVcIixcImFcIixcImFuXCIsXCJ0b1wiLFwiaW5cIixcIm9mXCIsXCJmb3JcIixcIndpdGhcIixcImZyb21cIixcInlvdXJcIixcInRoaXNcIixcInRoYXRcIixcIml0XCIsXCJpc1wiLFwiYXJlXCIsXCJ3YXNcIixcImJlXCIsXCJoYXNcIixcImhhdmVcIixcImRvXCIsXCJkb2VzXCIsXCJpZlwiLFwibm90XCIsXCJub1wiLFwieWVzXCIsXCJvblwiLFwib2ZmXCIsXCJ1cFwiLFwic29cIixcImJ1dFwiLFwiYnlcIixcImF0XCIsXCJhc1wiLFwic2VydmVyXCIsXCJhcHBcIixcImFwcGxpY2F0aW9uXCIsXCJwcm9qZWN0XCIsXCJmaWxlXCIsXCJkaXJlY3RvcnlcIixcImZvbGRlclwiLFwibmV4dFwiLFwiZmlyc3RcIixcImZvbGxvd2luZ1wiLFwiYWJvdmVcIixcImJlbG93XCIsXCJhZnRlclwiLFwiYmVmb3JlXCIsXCJhbGxcIixcImFueVwiLFwiZWFjaFwiLFwiZXZlcnlcIixcImJvdGhcIixcIm5ld1wiLFwib2xkXCJdKTtcbiAgICAgICAgICBjb25zdCBmaWx0ZXJQa2dzID0gKGFycjogc3RyaW5nW10pID0+IChhcnIgfHwgW10pLmZpbHRlcigoZDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXZhbGlkUGtnLnRlc3QoZCkgfHwgL1s7JnxgJCgpe31dLy50ZXN0KGQpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBjb25zdCBiYXNlID0gZC5yZXBsYWNlKC9AW15cXHNdKiQvLCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIHJldHVybiAhbm90QVBrZy5oYXMoYmFzZSkgJiYgKGJhc2UubGVuZ3RoID4gMSB8fCBkLnN0YXJ0c1dpdGgoJ0AnKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3Qgc2FmZURlcHMgPSBmaWx0ZXJQa2dzKGRlcGVuZGVuY2llcyB8fCBbXSk7XG4gICAgICAgICAgY29uc3Qgc2FmZURldkRlcHMgPSBmaWx0ZXJQa2dzKGRldkRlcGVuZGVuY2llcyB8fCBbXSk7XG5cbiAgICAgICAgICBsZXQgcG0gPSBcIm5wbVwiO1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImJ1bi5sb2NrYlwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJidW4ubG9ja1wiKSkpIHBtID0gXCJidW5cIjtcbiAgICAgICAgICBlbHNlIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0tbG9jay55YW1sXCIpKSB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIikpKSBwbSA9IFwicG5wbVwiO1xuICAgICAgICAgIGVsc2UgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwieWFybi5sb2NrXCIpKSkgcG0gPSBcInlhcm5cIjtcblxuICAgICAgICAgIGNvbnN0IGJ1aWxkSW5zdGFsbENtZCA9IChwa2dzOiBzdHJpbmdbXSwgaXNEZXY6IGJvb2xlYW4pOiBzdHJpbmcgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGtnU3RyID0gcGtncy5qb2luKFwiIFwiKTtcbiAgICAgICAgICAgIHN3aXRjaCAocG0pIHtcbiAgICAgICAgICAgICAgY2FzZSBcImJ1blwiOiByZXR1cm4gYG5weCBidW4gYWRkJHtpc0RldiA/IFwiIC1kXCIgOiBcIlwifSAke3BrZ1N0cn1gO1xuICAgICAgICAgICAgICBjYXNlIFwicG5wbVwiOiByZXR1cm4gYG5weCBwbnBtIGFkZCR7aXNEZXYgPyBcIiAtRFwiIDogXCJcIn0gJHtwa2dTdHJ9YDtcbiAgICAgICAgICAgICAgY2FzZSBcInlhcm5cIjogcmV0dXJuIGBucHggeWFybiBhZGQke2lzRGV2ID8gXCIgLURcIiA6IFwiXCJ9ICR7cGtnU3RyfWA7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6IHJldHVybiBgbnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzJHtpc0RldiA/IFwiIC0tc2F2ZS1kZXZcIiA6IFwiXCJ9ICR7cGtnU3RyfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICBjb25zdCBydW5JbnN0YWxsID0gKHBrZ3M6IHN0cmluZ1tdLCBpc0RldjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4gPT4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNtZCA9IGJ1aWxkSW5zdGFsbENtZChwa2dzLCBpc0Rldik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0RlcHNdIFJ1bm5pbmc6ICR7Y21kfSBpbiAke25hbWV9YCk7XG4gICAgICAgICAgICBleGVjQXN5bmMoY21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzaGVsbDogdHJ1ZSwgbWF4QnVmZmVyOiAyICogMTAyNCAqIDEwMjQgfSwgKGVyciwgX3N0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbRGVwc10gRmFpbGVkOiAke2NtZH1gLCBzdGRlcnI/LnNsaWNlKDAsIDMwMCkgfHwgZXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDMwMCkpO1xuICAgICAgICAgICAgICAgIGlmIChwbSAhPT0gXCJucG1cIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgbnBtRmFsbGJhY2sgPSBgbnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzJHtpc0RldiA/IFwiIC0tc2F2ZS1kZXZcIiA6IFwiXCJ9ICR7cGtncy5qb2luKFwiIFwiKX1gO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtEZXBzXSBSZXRyeWluZyB3aXRoIG5wbTogJHtucG1GYWxsYmFja31gKTtcbiAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhucG1GYWxsYmFjaywgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc2hlbGw6IHRydWUsIG1heEJ1ZmZlcjogMiAqIDEwMjQgKiAxMDI0IH0sIChlcnIyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIyKSBlcnJvcnMucHVzaChgRmFpbGVkOiBDb21tYW5kIGZhaWxlZDogJHtjbWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChgRmFpbGVkOiBDb21tYW5kIGZhaWxlZDogJHtjbWR9YCk7XG4gICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBpZiAoc2FmZURlcHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgcnVuSW5zdGFsbChzYWZlRGVwcywgZmFsc2UpO1xuICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPT09IDApIHJlc3VsdHMucHVzaChgSW5zdGFsbGVkOiAke3NhZmVEZXBzLmpvaW4oXCIsIFwiKX1gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc2FmZURldkRlcHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgcHJldkVycm9ycyA9IGVycm9ycy5sZW5ndGg7XG4gICAgICAgICAgICBhd2FpdCBydW5JbnN0YWxsKHNhZmVEZXZEZXBzLCB0cnVlKTtcbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoID09PSBwcmV2RXJyb3JzKSByZXN1bHRzLnB1c2goYEluc3RhbGxlZCBkZXY6ICR7c2FmZURldkRlcHMuam9pbihcIiwgXCIpfWApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBlcnJvcnMubGVuZ3RoID09PSAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzLCByZXN1bHRzLCBlcnJvcnMgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvcnVuLWNvbW1hbmRcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lLCBjb21tYW5kIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghY29tbWFuZCB8fCB0eXBlb2YgY29tbWFuZCAhPT0gXCJzdHJpbmdcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIk5vIGNvbW1hbmQgc3BlY2lmaWVkXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGNoZWNrID0gdmFsaWRhdGVQcm9qZWN0UGF0aChuYW1lIHx8IFwiXCIpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBhbGxvd2VkUHJlZml4ZXMgPSBbXG4gICAgICAgICAgICBcIm5wbSBcIiwgXCJucHggXCIsIFwieWFybiBcIiwgXCJwbnBtIFwiLCBcImJ1biBcIixcbiAgICAgICAgICAgIFwibm9kZSBcIiwgXCJkZW5vIFwiLCBcInRzY1wiLCBcInRzeCBcIixcbiAgICAgICAgICAgIFwiY29yZXBhY2sgXCIsIFwibnZtIFwiLCBcImZubSBcIixcbiAgICAgICAgICAgIFwibWtkaXIgXCIsIFwiY3AgXCIsIFwibXYgXCIsIFwicm0gXCIsIFwidG91Y2ggXCIsIFwiY2F0IFwiLCBcImxzIFwiLCBcInB3ZFwiLFxuICAgICAgICAgICAgXCJjaG1vZCBcIiwgXCJjaG93biBcIiwgXCJsbiBcIixcbiAgICAgICAgICAgIFwiZ2l0IFwiLCBcImN1cmwgXCIsIFwid2dldCBcIixcbiAgICAgICAgICAgIFwicHl0aG9uXCIsIFwicGlwXCIsIFwiY2FyZ28gXCIsIFwiZ28gXCIsIFwicnVzdGNcIiwgXCJnY2NcIiwgXCJnKytcIiwgXCJtYWtlXCIsXG4gICAgICAgICAgICBcImRvY2tlciBcIiwgXCJkb2NrZXItY29tcG9zZSBcIixcbiAgICAgICAgICBdO1xuICAgICAgICAgIGNvbnN0IHRyaW1tZWQgPSBjb21tYW5kLnRyaW0oKS5yZXBsYWNlKC9cXHMrI1xccysuKiQvLCAnJykudHJpbSgpO1xuICAgICAgICAgIGlmICgvW1xcclxcblxceDAwXS8udGVzdCh0cmltbWVkKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkNvbnRyb2wgY2hhcmFjdGVycyBub3QgYWxsb3dlZCBpbiBjb21tYW5kc1wiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBpZiAoL15jdXJsLWluc3RhbGw6aHR0cHM/OlxcL1xcLy9pLnRlc3QodHJpbW1lZCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdFVybCA9IHRyaW1tZWQucmVwbGFjZSgvXmN1cmwtaW5zdGFsbDovaSwgXCJcIik7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gY2hlY2sucmVzb2x2ZWQ7XG4gICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwNDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQcm9qZWN0IG5vdCBmb3VuZFwiIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgICAgIGNvbnN0IHsgZXhlYzogZXhlY0FzeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICBjb25zdCBvcyA9IGF3YWl0IGltcG9ydChcIm9zXCIpO1xuICAgICAgICAgICAgICBjb25zdCBpc1dpbiA9IG9zLnBsYXRmb3JtKCkgPT09IFwid2luMzJcIjtcblxuICAgICAgICAgICAgICBjb25zdCBXSU5fTlBNX0FMVEVSTkFUSVZFUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICBcImJ1bi5zaC9pbnN0YWxsXCI6IFwibnBtIGluc3RhbGwgLWcgYnVuXCIsXG4gICAgICAgICAgICAgICAgXCJnZXQucG5wbS5pby9pbnN0YWxsLnNoXCI6IFwibnBtIGluc3RhbGwgLWcgcG5wbVwiLFxuICAgICAgICAgICAgICAgIFwiaW5zdGFsbC5weXRob24tcG9ldHJ5Lm9yZ1wiOiBcInBpcCBpbnN0YWxsIHBvZXRyeVwiLFxuICAgICAgICAgICAgICAgIFwicnVzdHVwLnJzXCI6IFwid2luZ2V0IGluc3RhbGwgUnVzdGxhbmcuUnVzdHVwXCIsXG4gICAgICAgICAgICAgICAgXCJkZW5vLmxhbmQvaW5zdGFsbC5zaFwiOiBcIm5wbSBpbnN0YWxsIC1nIGRlbm9cIixcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICBpZiAoaXNXaW4pIHtcbiAgICAgICAgICAgICAgICBjb25zdCB3aW5BbHQgPSBPYmplY3QuZW50cmllcyhXSU5fTlBNX0FMVEVSTkFUSVZFUykuZmluZCgoW2tdKSA9PiBzY3JpcHRVcmwuaW5jbHVkZXMoaykpO1xuICAgICAgICAgICAgICAgIGlmICh3aW5BbHQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFsdENtZCA9IHdpbkFsdFsxXTtcbiAgICAgICAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhhbHRDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDIgKiAxMDI0ICogMTAyNCB9LCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGAke2Vyci5tZXNzYWdlPy5zbGljZSgwLCA0MDApfSAocmFuOiAke2FsdENtZH0pYCwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApLCBzdGRlcnI6IChzdGRlcnIgfHwgXCJcIikuc2xpY2UoMCwgMjAwMCkgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiBgV2luZG93cyBhbHRlcm5hdGl2ZTogJHthbHRDbWR9XFxuJHsoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApfWAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcHMxVXJsID0gc2NyaXB0VXJsLnJlcGxhY2UoL1xcLnNoJC8sIFwiLnBzMVwiKTtcbiAgICAgICAgICAgICAgICBsZXQgdXNlUHNTY3JpcHQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0cnkgeyBjb25zdCBoZWFkID0gYXdhaXQgZmV0Y2gocHMxVXJsLCB7IG1ldGhvZDogXCJIRUFEXCIgfSk7IHVzZVBzU2NyaXB0ID0gaGVhZC5vazsgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICAgICAgaWYgKHVzZVBzU2NyaXB0KSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwc0NtZCA9IGBpcm0gJHtwczFVcmx9IHwgaWV4YDtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVuY29kZWRDbWQgPSBCdWZmZXIuZnJvbShwc0NtZCwgXCJ1dGYxNmxlXCIpLnRvU3RyaW5nKFwiYmFzZTY0XCIpO1xuICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZXhlY0FzeW5jKGBwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUV4ZWN1dGlvblBvbGljeSBCeXBhc3MgLUVuY29kZWRDb21tYW5kICR7ZW5jb2RlZENtZH1gLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzaGVsbDogdHJ1ZSwgbWF4QnVmZmVyOiAyICogMTAyNCAqIDEwMjQgfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZT8uc2xpY2UoMCwgNTAwKSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApLCBzdGRlcnI6IChzdGRlcnIgfHwgXCJcIikuc2xpY2UoMCwgMjAwMCkgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChzY3JpcHRVcmwpO1xuICAgICAgICAgICAgICBpZiAoIXJlc3Aub2spIHsgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gZG93bmxvYWQgc2NyaXB0OiAke3Jlc3Auc3RhdHVzfSAke3Jlc3Auc3RhdHVzVGV4dH1gIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGF3YWl0IHJlc3AudGV4dCgpO1xuICAgICAgICAgICAgICBjb25zdCB0bXBTY3JpcHQgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGBpbnN0YWxsLSR7RGF0ZS5ub3coKX0uc2hgKTtcbiAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh0bXBTY3JpcHQsIHNjcmlwdCwgeyBtb2RlOiAwbzc1NSB9KTtcbiAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICBleGVjQXN5bmMoYGJhc2ggXCIke3RtcFNjcmlwdH1cImAsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDIgKiAxMDI0ICogMTAyNCwgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBCVU5fSU5TVEFMTDogcHJvamVjdERpciwgQ0FSR09fSE9NRTogcHJvamVjdERpciwgUlVTVFVQX0hPTUU6IHByb2plY3REaXIgfSB9LCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgdHJ5IHsgZnMudW5saW5rU3luYyh0bXBTY3JpcHQpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDUwMCksIG91dHB1dDogKHN0ZG91dCB8fCBcIlwiKS5zbGljZSgwLCA0MDAwKSwgc3RkZXJyOiAoc3RkZXJyIHx8IFwiXCIpLnNsaWNlKDAsIDIwMDApIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IChzdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCkgfSkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGV2U2VydmVyUmUgPSAvXig/Om5wbVxccysoPzpydW5cXHMrKT8oPzpkZXZ8c3RhcnQpfHlhcm5cXHMrKD86ZGV2fHN0YXJ0KXxwbnBtXFxzKyg/OmRldnxzdGFydCl8YnVuXFxzKyg/OmRldnxzdGFydCl8bnB4XFxzK3ZpdGUoPzpcXHN8JCkpL2k7XG4gICAgICAgICAgaWYgKGRldlNlcnZlclJlLnRlc3QodHJpbW1lZCkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJEZXYgc2VydmVyIGNvbW1hbmRzIHNob3VsZCB1c2UgdGhlIFByZXZpZXcgYnV0dG9uIGluc3RlYWRcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGFsbG93ZWRQcmVmaXhlcy5zb21lKHAgPT4gdHJpbW1lZC5zdGFydHNXaXRoKHApKSB8fCB0cmltbWVkID09PSBcIm5wbSBpbnN0YWxsXCIgfHwgdHJpbW1lZCA9PT0gXCJjb3JlcGFjayBlbmFibGVcIjtcbiAgICAgICAgICBpZiAoIWlzQWxsb3dlZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBgQ29tbWFuZCBub3QgYWxsb3dlZDogJHt0cmltbWVkLnNsaWNlKDAsIDUwKX1gIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgaWYgKC9bOyZ8YCQoKXt9XS8udGVzdCh0cmltbWVkKSkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJTaGVsbCBtZXRhY2hhcmFjdGVycyBub3QgYWxsb3dlZFwiIH0pKTsgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoL1xcLlxcLltcXC9cXFxcXS8udGVzdCh0cmltbWVkKSkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJQYXRoIHRyYXZlcnNhbCBub3QgYWxsb3dlZFwiIH0pKTsgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IGNoZWNrLnJlc29sdmVkO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwNDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb2plY3QgZGlyZWN0b3J5IG5vdCBmb3VuZDogJHtwcm9qZWN0RGlyfWAgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IHsgZXhlYzogZXhlY0FzeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgIGNvbnN0IG9zID0gYXdhaXQgaW1wb3J0KFwib3NcIik7XG4gICAgICAgICAgY29uc3QgaXNXaW4gPSBvcy5wbGF0Zm9ybSgpID09PSBcIndpbjMyXCI7XG4gICAgICAgICAgbGV0IGFjdHVhbENtZCA9IHRyaW1tZWQgPT09IFwibnBtIGluc3RhbGxcIiA/IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCIgOiB0cmltbWVkO1xuXG4gICAgICAgICAgY29uc3Qgbm9kZUhhbmRsZWQgPSBhd2FpdCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKC9ecm1cXHMrKC1yZj9cXHMrKT8vaS50ZXN0KGFjdHVhbENtZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0cyA9IGFjdHVhbENtZC5yZXBsYWNlKC9ecm1cXHMrKC1yZj9cXHMrKT8vaSwgXCJcIikudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgdCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0RGlyLCB0KTtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFBhdGguc3RhcnRzV2l0aChwcm9qZWN0RGlyKSkgeyByZXN1bHRzLnB1c2goYFNraXBwZWQgKG91dHNpZGUgcHJvamVjdCk6ICR7dH1gKTsgY29udGludWU7IH1cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgZnMucm1TeW5jKHRhcmdldFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChgUmVtb3ZlZDogJHt0fWApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkgeyByZXN1bHRzLnB1c2goYEZhaWxlZCB0byByZW1vdmUgJHt0fTogJHtlLm1lc3NhZ2V9YCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IHJlc3VsdHMuam9pbihcIlxcblwiKSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKC9ebWtkaXJcXHMrKC1wXFxzKyk/L2kudGVzdChhY3R1YWxDbWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGRpciA9IGFjdHVhbENtZC5yZXBsYWNlKC9ebWtkaXJcXHMrKC1wXFxzKyk/L2ksIFwiXCIpLnRyaW0oKTtcbiAgICAgICAgICAgICAgY29uc3QgZGlyUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0RGlyLCBkaXIpO1xuICAgICAgICAgICAgICBpZiAoIWRpclBhdGguc3RhcnRzV2l0aChwcm9qZWN0RGlyKSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIgfTtcbiAgICAgICAgICAgICAgdHJ5IHsgZnMubWtkaXJTeW5jKGRpclBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IGBDcmVhdGVkOiAke2Rpcn1gIH07IH1cbiAgICAgICAgICAgICAgY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoL150b3VjaFxccy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgICBjb25zdCBmaWxlID0gYWN0dWFsQ21kLnJlcGxhY2UoL150b3VjaFxccysvaSwgXCJcIikudHJpbSgpO1xuICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0RGlyLCBmaWxlKTtcbiAgICAgICAgICAgICAgaWYgKCFmaWxlUGF0aC5zdGFydHNXaXRoKHByb2plY3REaXIpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUGF0aCBvdXRzaWRlIHByb2plY3RcIiB9O1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIGZzLm1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoZmlsZVBhdGgsIFwiXCIsIHsgZmxhZzogXCJhXCIgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiBgVG91Y2hlZDogJHtmaWxlfWAgfTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZS5tZXNzYWdlIH07IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgvXmNhdFxccy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgICBjb25zdCBmaWxlID0gYWN0dWFsQ21kLnJlcGxhY2UoL15jYXRcXHMrL2ksIFwiXCIpLnRyaW0oKTtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZmlsZSk7XG4gICAgICAgICAgICAgIGlmICghZmlsZVBhdGguc3RhcnRzV2l0aChwcm9qZWN0RGlyKSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIgfTtcbiAgICAgICAgICAgICAgdHJ5IHsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsIFwidXRmLThcIikuc2xpY2UoMCwgNDAwMCkgfTsgfVxuICAgICAgICAgICAgICBjYXRjaCAoZTogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZS5tZXNzYWdlIH07IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgvXmNwXFxzL2kudGVzdChhY3R1YWxDbWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBhY3R1YWxDbWQucmVwbGFjZSgvXmNwXFxzKygtclxccyspPy9pLCBcIlwiKS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzcmMgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgYXJnc1swXSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzdCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0RGlyLCBhcmdzWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAoIXNyYy5zdGFydHNXaXRoKHByb2plY3REaXIpIHx8ICFkZXN0LnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiIH07XG4gICAgICAgICAgICAgICAgdHJ5IHsgZnMuY3BTeW5jKHNyYywgZGVzdCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IGBDb3BpZWQ6ICR7YXJnc1swXX0gXHUyMTkyICR7YXJnc1sxXX1gIH07IH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZTogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZS5tZXNzYWdlIH07IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKC9ebXZcXHMvaS50ZXN0KGFjdHVhbENtZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgYXJncyA9IGFjdHVhbENtZC5yZXBsYWNlKC9ebXZcXHMrL2ksIFwiXCIpLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNyYyA9IHBhdGgucmVzb2x2ZShwcm9qZWN0RGlyLCBhcmdzWzBdKTtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXN0ID0gcGF0aC5yZXNvbHZlKHByb2plY3REaXIsIGFyZ3NbMV0pO1xuICAgICAgICAgICAgICAgIGlmICghc3JjLnN0YXJ0c1dpdGgocHJvamVjdERpcikgfHwgIWRlc3Quc3RhcnRzV2l0aChwcm9qZWN0RGlyKSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIgfTtcbiAgICAgICAgICAgICAgICB0cnkgeyBmcy5yZW5hbWVTeW5jKHNyYywgZGVzdCk7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG91dHB1dDogYE1vdmVkOiAke2FyZ3NbMF19IFx1MjE5MiAke2FyZ3NbMV19YCB9OyB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0pKCk7XG5cbiAgICAgICAgICBpZiAobm9kZUhhbmRsZWQpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShub2RlSGFuZGxlZCkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpc1dpbiAmJiAvXmNvcmVwYWNrXFxzL2kudGVzdChhY3R1YWxDbWQpKSB7XG4gICAgICAgICAgICBhY3R1YWxDbWQgPSBgbnB4ICR7YWN0dWFsQ21kfWA7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGV4ZWNBc3luYyhhY3R1YWxDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiA2MDAwMCwgc2hlbGw6IHRydWUsIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZT8uc2xpY2UoMCwgNTAwKSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApLCBzdGRlcnI6IChzdGRlcnIgfHwgXCJcIikuc2xpY2UoMCwgMjAwMCkgfSkpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IChzdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCkgfSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIGNvbnN0IHN0ZGVyciA9IGVyci5zdGRlcnIgPyBTdHJpbmcoZXJyLnN0ZGVycikuc2xpY2UoMCwgMjAwMCkgOiBcIlwiO1xuICAgICAgICAgIGNvbnN0IHN0ZG91dCA9IGVyci5zdGRvdXQgPyBTdHJpbmcoZXJyLnN0ZG91dCkuc2xpY2UoMCwgMjAwMCkgOiBcIlwiO1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlPy5zbGljZSgwLCA1MDApLCBvdXRwdXQ6IHN0ZG91dCwgc3RkZXJyIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2dyYW1zL2luc3RhbGxcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBwcm9ncmFtcyB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvZ3JhbXMpIHx8IHByb2dyYW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiTm8gcHJvZ3JhbXMgc3BlY2lmaWVkXCIgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocHJvZ3JhbXMubGVuZ3RoID4gMTApIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlRvbyBtYW55IHByb2dyYW1zIChtYXggMTApXCIgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgY29uc3QgaXNXaW4gPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCI7XG4gICAgICAgICAgY29uc3QgaXNNYWMgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiO1xuXG4gICAgICAgICAgY29uc3QgcHJvZ3JhbUluc3RhbGxNYXA6IFJlY29yZDxzdHJpbmcsIHsgY2hlY2s6IHN0cmluZzsgd2luPzogc3RyaW5nOyBtYWM/OiBzdHJpbmc7IGxpbnV4Pzogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+ID0ge1xuICAgICAgICAgICAgXCJnKytcIjogeyBjaGVjazogXCJnKysgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIG1pbmd3IC15XCIsIG1hYzogXCJ4Y29kZS1zZWxlY3QgLS1pbnN0YWxsXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGcrK1wiLCBsYWJlbDogXCJHKysgKEMrKyBDb21waWxlcilcIiB9LFxuICAgICAgICAgICAgXCJnY2NcIjogeyBjaGVjazogXCJnY2MgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIG1pbmd3IC15XCIsIG1hYzogXCJ4Y29kZS1zZWxlY3QgLS1pbnN0YWxsXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGdjY1wiLCBsYWJlbDogXCJHQ0MgKEMgQ29tcGlsZXIpXCIgfSxcbiAgICAgICAgICAgIFwiY2xhbmdcIjogeyBjaGVjazogXCJjbGFuZyAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgbGx2bSAteVwiLCBtYWM6IFwieGNvZGUtc2VsZWN0IC0taW5zdGFsbFwiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBjbGFuZ1wiLCBsYWJlbDogXCJDbGFuZ1wiIH0sXG4gICAgICAgICAgICBcImNtYWtlXCI6IHsgY2hlY2s6IFwiY21ha2UgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIGNtYWtlIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgY21ha2VcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgY21ha2VcIiwgbGFiZWw6IFwiQ01ha2VcIiB9LFxuICAgICAgICAgICAgXCJtYWtlXCI6IHsgY2hlY2s6IFwibWFrZSAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgbWFrZSAteVwiLCBtYWM6IFwieGNvZGUtc2VsZWN0IC0taW5zdGFsbFwiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBtYWtlXCIsIGxhYmVsOiBcIk1ha2VcIiB9LFxuICAgICAgICAgICAgXCJweXRob25cIjogeyBjaGVjazogXCJweXRob24zIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBweXRob24gLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBweXRob24zXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHB5dGhvbjNcIiwgbGFiZWw6IFwiUHl0aG9uIDNcIiB9LFxuICAgICAgICAgICAgXCJweXRob24zXCI6IHsgY2hlY2s6IFwicHl0aG9uMyAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgcHl0aG9uIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgcHl0aG9uM1wiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBweXRob24zXCIsIGxhYmVsOiBcIlB5dGhvbiAzXCIgfSxcbiAgICAgICAgICAgIFwicGlwXCI6IHsgY2hlY2s6IFwicGlwMyAtLXZlcnNpb25cIiwgd2luOiBcInB5dGhvbiAtbSBlbnN1cmVwaXBcIiwgbWFjOiBcInB5dGhvbjMgLW0gZW5zdXJlcGlwXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHB5dGhvbjMtcGlwXCIsIGxhYmVsOiBcIlBpcFwiIH0sXG4gICAgICAgICAgICBcInBpcDNcIjogeyBjaGVjazogXCJwaXAzIC0tdmVyc2lvblwiLCB3aW46IFwicHl0aG9uIC1tIGVuc3VyZXBpcFwiLCBtYWM6IFwicHl0aG9uMyAtbSBlbnN1cmVwaXBcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcHl0aG9uMy1waXBcIiwgbGFiZWw6IFwiUGlwIDNcIiB9LFxuICAgICAgICAgICAgXCJub2RlXCI6IHsgY2hlY2s6IFwibm9kZSAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgbm9kZWpzIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgbm9kZVwiLCBsaW51eDogXCJjdXJsIC1mc1NMIGh0dHBzOi8vZGViLm5vZGVzb3VyY2UuY29tL3NldHVwX2x0cy54IHwgc3VkbyAtRSBiYXNoIC0gJiYgc3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgbm9kZWpzXCIsIGxhYmVsOiBcIk5vZGUuanNcIiB9LFxuICAgICAgICAgICAgXCJub2RlanNcIjogeyBjaGVjazogXCJub2RlIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBub2RlanMgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBub2RlXCIsIGxpbnV4OiBcImN1cmwgLWZzU0wgaHR0cHM6Ly9kZWIubm9kZXNvdXJjZS5jb20vc2V0dXBfbHRzLnggfCBzdWRvIC1FIGJhc2ggLSAmJiBzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBub2RlanNcIiwgbGFiZWw6IFwiTm9kZS5qc1wiIH0sXG4gICAgICAgICAgICBcIm5vZGUuanNcIjogeyBjaGVjazogXCJub2RlIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBub2RlanMgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBub2RlXCIsIGxpbnV4OiBcImN1cmwgLWZzU0wgaHR0cHM6Ly9kZWIubm9kZXNvdXJjZS5jb20vc2V0dXBfbHRzLnggfCBzdWRvIC1FIGJhc2ggLSAmJiBzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBub2RlanNcIiwgbGFiZWw6IFwiTm9kZS5qc1wiIH0sXG4gICAgICAgICAgICBcInJ1c3RcIjogeyBjaGVjazogXCJydXN0YyAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgcnVzdCAteVwiLCBtYWM6IFwiY3VybCAtLXByb3RvICc9aHR0cHMnIC0tdGxzdjEuMiAtc1NmIGh0dHBzOi8vc2gucnVzdHVwLnJzIHwgc2ggLXMgLS0gLXlcIiwgbGludXg6IFwiY3VybCAtLXByb3RvICc9aHR0cHMnIC0tdGxzdjEuMiAtc1NmIGh0dHBzOi8vc2gucnVzdHVwLnJzIHwgc2ggLXMgLS0gLXlcIiwgbGFiZWw6IFwiUnVzdFwiIH0sXG4gICAgICAgICAgICBcInJ1c3RjXCI6IHsgY2hlY2s6IFwicnVzdGMgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIHJ1c3QgLXlcIiwgbWFjOiBcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCIsIGxpbnV4OiBcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCIsIGxhYmVsOiBcIlJ1c3RcIiB9LFxuICAgICAgICAgICAgXCJjYXJnb1wiOiB7IGNoZWNrOiBcImNhcmdvIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBydXN0IC15XCIsIG1hYzogXCJjdXJsIC0tcHJvdG8gJz1odHRwcycgLS10bHN2MS4yIC1zU2YgaHR0cHM6Ly9zaC5ydXN0dXAucnMgfCBzaCAtcyAtLSAteVwiLCBsaW51eDogXCJjdXJsIC0tcHJvdG8gJz1odHRwcycgLS10bHN2MS4yIC1zU2YgaHR0cHM6Ly9zaC5ydXN0dXAucnMgfCBzaCAtcyAtLSAteVwiLCBsYWJlbDogXCJDYXJnbyAoUnVzdClcIiB9LFxuICAgICAgICAgICAgXCJnb1wiOiB7IGNoZWNrOiBcImdvIHZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgZ29sYW5nIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgZ29cIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZ29sYW5nXCIsIGxhYmVsOiBcIkdvXCIgfSxcbiAgICAgICAgICAgIFwiZ29sYW5nXCI6IHsgY2hlY2s6IFwiZ28gdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBnb2xhbmcgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBnb1wiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBnb2xhbmdcIiwgbGFiZWw6IFwiR29cIiB9LFxuICAgICAgICAgICAgXCJqYXZhXCI6IHsgY2hlY2s6IFwiamF2YSAtdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBvcGVuamRrIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgb3Blbmpka1wiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBkZWZhdWx0LWpka1wiLCBsYWJlbDogXCJKYXZhIChKREspXCIgfSxcbiAgICAgICAgICAgIFwiamRrXCI6IHsgY2hlY2s6IFwiamF2YSAtdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBvcGVuamRrIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgb3Blbmpka1wiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBkZWZhdWx0LWpka1wiLCBsYWJlbDogXCJKYXZhIChKREspXCIgfSxcbiAgICAgICAgICAgIFwiZG9ja2VyXCI6IHsgY2hlY2s6IFwiZG9ja2VyIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBkb2NrZXItZGVza3RvcCAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIC0tY2FzayBkb2NrZXJcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZG9ja2VyLmlvXCIsIGxhYmVsOiBcIkRvY2tlclwiIH0sXG4gICAgICAgICAgICBcImdpdFwiOiB7IGNoZWNrOiBcImdpdCAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgZ2l0IC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgZ2l0XCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGdpdFwiLCBsYWJlbDogXCJHaXRcIiB9LFxuICAgICAgICAgICAgXCJjdXJsXCI6IHsgY2hlY2s6IFwiY3VybCAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgY3VybCAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIGN1cmxcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgY3VybFwiLCBsYWJlbDogXCJjVVJMXCIgfSxcbiAgICAgICAgICAgIFwid2dldFwiOiB7IGNoZWNrOiBcIndnZXQgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIHdnZXQgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCB3Z2V0XCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHdnZXRcIiwgbGFiZWw6IFwiV2dldFwiIH0sXG4gICAgICAgICAgICBcImZmbXBlZ1wiOiB7IGNoZWNrOiBcImZmbXBlZyAtdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBmZm1wZWcgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBmZm1wZWdcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZmZtcGVnXCIsIGxhYmVsOiBcIkZGbXBlZ1wiIH0sXG4gICAgICAgICAgICBcImltYWdlbWFnaWNrXCI6IHsgY2hlY2s6IFwiY29udmVydCAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgaW1hZ2VtYWdpY2sgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBpbWFnZW1hZ2lja1wiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBpbWFnZW1hZ2lja1wiLCBsYWJlbDogXCJJbWFnZU1hZ2lja1wiIH0sXG4gICAgICAgICAgICBcInNxbGl0ZTNcIjogeyBjaGVjazogXCJzcWxpdGUzIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBzcWxpdGUgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBzcWxpdGVcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgc3FsaXRlM1wiLCBsYWJlbDogXCJTUUxpdGVcIiB9LFxuICAgICAgICAgICAgXCJwb3N0Z3Jlc3FsXCI6IHsgY2hlY2s6IFwicHNxbCAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgcG9zdGdyZXNxbCAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIHBvc3RncmVzcWxcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcG9zdGdyZXNxbFwiLCBsYWJlbDogXCJQb3N0Z3JlU1FMXCIgfSxcbiAgICAgICAgICAgIFwicmVkaXNcIjogeyBjaGVjazogXCJyZWRpcy1zZXJ2ZXIgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIHJlZGlzIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgcmVkaXNcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcmVkaXMtc2VydmVyXCIsIGxhYmVsOiBcIlJlZGlzXCIgfSxcbiAgICAgICAgICAgIFwiZGVub1wiOiB7IGNoZWNrOiBcImRlbm8gLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIGRlbm8gLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBkZW5vXCIsIGxpbnV4OiBcImN1cmwgLWZzU0wgaHR0cHM6Ly9kZW5vLmxhbmQvaW5zdGFsbC5zaCB8IHNoXCIsIGxhYmVsOiBcIkRlbm9cIiB9LFxuICAgICAgICAgICAgXCJidW5cIjogeyBjaGVjazogXCJidW4gLS12ZXJzaW9uXCIsIHdpbjogXCJwb3dlcnNoZWxsIC1jIFxcXCJpcm0gYnVuLnNoL2luc3RhbGwucHMxfGlleFxcXCJcIiwgbWFjOiBcImN1cmwgLWZzU0wgaHR0cHM6Ly9idW4uc2gvaW5zdGFsbCB8IGJhc2hcIiwgbGludXg6IFwiY3VybCAtZnNTTCBodHRwczovL2J1bi5zaC9pbnN0YWxsIHwgYmFzaFwiLCBsYWJlbDogXCJCdW5cIiB9LFxuICAgICAgICAgICAgXCJydWJ5XCI6IHsgY2hlY2s6IFwicnVieSAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgcnVieSAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIHJ1YnlcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcnVieVwiLCBsYWJlbDogXCJSdWJ5XCIgfSxcbiAgICAgICAgICAgIFwicGhwXCI6IHsgY2hlY2s6IFwicGhwIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBwaHAgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBwaHBcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcGhwXCIsIGxhYmVsOiBcIlBIUFwiIH0sXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IHsgcHJvZ3JhbTogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBhbHJlYWR5SW5zdGFsbGVkOiBib29sZWFuOyBpbnN0YWxsZWQ6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nOyBjb21tYW5kPzogc3RyaW5nIH1bXSA9IFtdO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBwcm9nIG9mIHByb2dyYW1zKSB7XG4gICAgICAgICAgICBjb25zdCBrZXkgPSBwcm9nLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTkuK10vZywgXCJcIik7XG4gICAgICAgICAgICBjb25zdCBtYXBwaW5nID0gcHJvZ3JhbUluc3RhbGxNYXBba2V5XTtcbiAgICAgICAgICAgIGlmICghbWFwcGluZykge1xuICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeyBwcm9ncmFtOiBwcm9nLCBsYWJlbDogcHJvZywgYWxyZWFkeUluc3RhbGxlZDogZmFsc2UsIGluc3RhbGxlZDogZmFsc2UsIGVycm9yOiBgVW5rbm93biBwcm9ncmFtOiAke3Byb2d9YCB9KTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBhbHJlYWR5SW5zdGFsbGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBleGVjU3luYyhtYXBwaW5nLmNoZWNrLCB7IHRpbWVvdXQ6IDEwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICBhbHJlYWR5SW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgaWYgKGFscmVhZHlJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvZ3JhbTogcHJvZywgbGFiZWw6IG1hcHBpbmcubGFiZWwsIGFscmVhZHlJbnN0YWxsZWQ6IHRydWUsIGluc3RhbGxlZDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQgPSBpc1dpbiA/IG1hcHBpbmcud2luIDogaXNNYWMgPyBtYXBwaW5nLm1hYyA6IG1hcHBpbmcubGludXg7XG4gICAgICAgICAgICBpZiAoIWluc3RhbGxDbWQpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvZ3JhbTogcHJvZywgbGFiZWw6IG1hcHBpbmcubGFiZWwsIGFscmVhZHlJbnN0YWxsZWQ6IGZhbHNlLCBpbnN0YWxsZWQ6IGZhbHNlLCBlcnJvcjogYE5vIGluc3RhbGwgY29tbWFuZCBmb3IgdGhpcyBwbGF0Zm9ybWAgfSk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBleGVjU3luYyhpbnN0YWxsQ21kLCB7IHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvZ3JhbTogcHJvZywgbGFiZWw6IG1hcHBpbmcubGFiZWwsIGFscmVhZHlJbnN0YWxsZWQ6IGZhbHNlLCBpbnN0YWxsZWQ6IHRydWUsIGNvbW1hbmQ6IGluc3RhbGxDbWQgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeyBwcm9ncmFtOiBwcm9nLCBsYWJlbDogbWFwcGluZy5sYWJlbCwgYWxyZWFkeUluc3RhbGxlZDogZmFsc2UsIGluc3RhbGxlZDogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZT8uc2xpY2UoMCwgMjAwKSwgY29tbWFuZDogaW5zdGFsbENtZCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICBjb25zdCBhbGxPayA9IHJlc3VsdHMuZXZlcnkociA9PiByLmluc3RhbGxlZCB8fCByLmFscmVhZHlJbnN0YWxsZWQpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBhbGxPaywgcmVzdWx0cyB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9pbXBvcnQtZ2l0aHViXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgb3duZXIsIHJlcG8gfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFvd25lciB8fCAhcmVwbyB8fCAvW1xcL1xcXFxdfFxcLlxcLi8udGVzdChvd25lcikgfHwgL1tcXC9cXFxcXXxcXC5cXC4vLnRlc3QocmVwbykpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiSW52YWxpZCBvd25lciBvciByZXBvXCIgfSkpOyByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgIGNvbnN0IG9zID0gYXdhaXQgaW1wb3J0KFwib3NcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdHNEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdHNEaXIpKSBmcy5ta2RpclN5bmMocHJvamVjdHNEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgY29uc3QgcHJvamVjdE5hbWUgPSByZXBvLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTktXS9nLCAnLScpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLnJlc29sdmUocHJvamVjdHNEaXIsIHByb2plY3ROYW1lKTtcblxuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwOTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogYFByb2plY3QgJyR7cHJvamVjdE5hbWV9JyBhbHJlYWR5IGV4aXN0cy4gRGVsZXRlIGl0IGZpcnN0IG9yIHVzZSBhIGRpZmZlcmVudCBuYW1lLmAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGdoVG9rZW4gPSBwcm9jZXNzLmVudi5HSVRIVUJfVE9LRU4gfHwgXCJcIjtcbiAgICAgICAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBcIlVzZXItQWdlbnRcIjogXCJHdWFyZGlhbi1BSVwiIH07XG4gICAgICAgICAgaWYgKGdoVG9rZW4pIGhlYWRlcnNbXCJBdXRob3JpemF0aW9uXCJdID0gYHRva2VuICR7Z2hUb2tlbn1gO1xuXG4gICAgICAgICAgY29uc3QgaW5mb1Jlc3AgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8ke293bmVyfS8ke3JlcG99YCwgeyBoZWFkZXJzOiB7IC4uLmhlYWRlcnMsIFwiQWNjZXB0XCI6IFwiYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52Mytqc29uXCIgfSB9KTtcbiAgICAgICAgICBpZiAoIWluZm9SZXNwLm9rKSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0dXMgPSBpbmZvUmVzcC5zdGF0dXM7XG4gICAgICAgICAgICBpZiAoc3RhdHVzID09PSA0MDQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogYFJlcG9zaXRvcnkgJHtvd25lcn0vJHtyZXBvfSBub3QgZm91bmQgb3IgaXMgcHJpdmF0ZWAgfSkpOyB9XG4gICAgICAgICAgICBlbHNlIGlmIChzdGF0dXMgPT09IDQwMykgeyByZXMuc3RhdHVzQ29kZSA9IDQyOTsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkdpdEh1YiBBUEkgcmF0ZSBsaW1pdCBleGNlZWRlZC4gVHJ5IGFnYWluIGxhdGVyLlwiIH0pKTsgfVxuICAgICAgICAgICAgZWxzZSB7IHJlcy5zdGF0dXNDb2RlID0gNTAyOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBHaXRIdWIgQVBJIGVycm9yOiAke3N0YXR1c31gIH0pKTsgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCByZXBvSW5mbzogYW55ID0gYXdhaXQgaW5mb1Jlc3AuanNvbigpO1xuICAgICAgICAgIGNvbnN0IGRlZmF1bHRCcmFuY2ggPSByZXBvSW5mby5kZWZhdWx0X2JyYW5jaCB8fCBcIm1haW5cIjtcblxuICAgICAgICAgIGNvbnN0IE1BWF9UQVJCQUxMX1NJWkUgPSAyMDAgKiAxMDI0ICogMTAyNDtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRG93bmxvYWRpbmcgdGFyYmFsbCBmb3IgJHtvd25lcn0vJHtyZXBvfSAoYnJhbmNoOiAke2RlZmF1bHRCcmFuY2h9KS4uLmApO1xuICAgICAgICAgIGNvbnN0IHRhcmJhbGxVcmwgPSBgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8ke293bmVyfS8ke3JlcG99L3RhcmJhbGwvJHtlbmNvZGVVUklDb21wb25lbnQoZGVmYXVsdEJyYW5jaCl9YDtcbiAgICAgICAgICBjb25zdCB0YXJSZXNwID0gYXdhaXQgZmV0Y2godGFyYmFsbFVybCwgeyBoZWFkZXJzOiB7IC4uLmhlYWRlcnMsIFwiQWNjZXB0XCI6IFwiYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52Mytqc29uXCIgfSwgcmVkaXJlY3Q6IFwiZm9sbG93XCIgfSk7XG4gICAgICAgICAgaWYgKCF0YXJSZXNwLm9rKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMjtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogYEZhaWxlZCB0byBkb3dubG9hZCB0YXJiYWxsOiAke3RhclJlc3Auc3RhdHVzfWAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBwYXJzZUludCh0YXJSZXNwLmhlYWRlcnMuZ2V0KFwiY29udGVudC1sZW5ndGhcIikgfHwgXCIwXCIsIDEwKTtcbiAgICAgICAgICBpZiAoY29udGVudExlbmd0aCA+IE1BWF9UQVJCQUxMX1NJWkUpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDEzO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBgUmVwb3NpdG9yeSB0b28gbGFyZ2UgKCR7KGNvbnRlbnRMZW5ndGggLyAxMDI0IC8gMTAyNCkudG9GaXhlZCgwKX1NQikuIE1heCBpcyAke01BWF9UQVJCQUxMX1NJWkUgLyAxMDI0IC8gMTAyNH1NQi5gIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB0bXBEaXIgPSBmcy5ta2R0ZW1wU3luYyhwYXRoLmpvaW4ob3MudG1wZGlyKCksIFwiZ3VhcmRpYW4taW1wb3J0LVwiKSk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB0YXJQYXRoID0gcGF0aC5qb2luKHRtcERpciwgXCJyZXBvLnRhci5nelwiKTtcblxuICAgICAgICAgIGNvbnN0IGFycmF5QnVmID0gYXdhaXQgdGFyUmVzcC5hcnJheUJ1ZmZlcigpO1xuICAgICAgICAgIGlmIChhcnJheUJ1Zi5ieXRlTGVuZ3RoID4gTUFYX1RBUkJBTExfU0laRSkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MTM7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBSZXBvc2l0b3J5IHRvbyBsYXJnZSAoJHsoYXJyYXlCdWYuYnl0ZUxlbmd0aCAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDApfU1CKS4gTWF4IGlzICR7TUFYX1RBUkJBTExfU0laRSAvIDEwMjQgLyAxMDI0fU1CLmAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHRhclBhdGgsIEJ1ZmZlci5mcm9tKGFycmF5QnVmKSk7XG4gICAgICAgICAgY29uc3QgdGFyU2l6ZSA9IGZzLnN0YXRTeW5jKHRhclBhdGgpLnNpemU7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIFRhcmJhbGwgZG93bmxvYWRlZDogJHsodGFyU2l6ZSAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDEpfU1CYCk7XG5cbiAgICAgICAgICBmcy5ta2RpclN5bmMocHJvamVjdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV4ZWNTeW5jKGB0YXIgeHpmIFwiJHt0YXJQYXRofVwiIC0tc3RyaXAtY29tcG9uZW50cz0xIC1DIFwiJHtwcm9qZWN0RGlyfVwiYCwgeyB0aW1lb3V0OiA2MDAwMCwgc3RkaW86IFwicGlwZVwiIH0pO1xuICAgICAgICAgIH0gY2F0Y2ggKHRhckVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkgeyBmcy5ybVN5bmMocHJvamVjdERpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBleHRyYWN0IHRhcmJhbGw6ICR7dGFyRXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDIwMCl9YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBFeHRyYWN0ZWQgdGFyYmFsbCB0byAke3Byb2plY3REaXJ9YCk7XG5cbiAgICAgICAgICBjb25zdCBDTEVBTlVQX1BBVFRFUk5TID0gW1wibm9kZV9tb2R1bGVzXCIsIFwiLmdpdFwiLCBcIi5uZXh0XCIsIFwiLm51eHRcIiwgXCJkaXN0XCIsIFwiLmNhY2hlXCIsIFwiLnR1cmJvXCIsIFwiLnZlcmNlbFwiLCBcIi5vdXRwdXRcIl07XG4gICAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIENMRUFOVVBfUEFUVEVSTlMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNsZWFuUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBwYXR0ZXJuKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGNsZWFuUGF0aCkpIHtcbiAgICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKGNsZWFuUGF0aCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHdhbGtBbmRDbGVhbiA9IChkaXI6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGwgPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5Lm5hbWUgPT09IFwibm9kZV9tb2R1bGVzXCIgfHwgZW50cnkubmFtZSA9PT0gXCIuZ2l0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKGZ1bGwsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgd2Fsa0FuZENsZWFuKGZ1bGwpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZW50cnkubmFtZSA9PT0gXCIuRFNfU3RvcmVcIikge1xuICAgICAgICAgICAgICAgICAgdHJ5IHsgZnMudW5saW5rU3luYyhmdWxsKTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH07XG4gICAgICAgICAgd2Fsa0FuZENsZWFuKHByb2plY3REaXIpO1xuXG4gICAgICAgICAgbGV0IGZpbGVzV3JpdHRlbiA9IDA7XG4gICAgICAgICAgY29uc3QgY291bnRGaWxlcyA9IChkaXI6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSkge1xuICAgICAgICAgICAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSBjb3VudEZpbGVzKHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpKTtcbiAgICAgICAgICAgICAgICBlbHNlIGZpbGVzV3JpdHRlbisrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb3VudEZpbGVzKHByb2plY3REaXIpO1xuXG4gICAgICAgICAgbGV0IGZyYW1ld29yayA9IFwidmFuaWxsYVwiO1xuICAgICAgICAgIGNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGtnUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICBjb25zdCBkZXBzID0geyAuLi4ocGtnLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihwa2cuZGV2RGVwZW5kZW5jaWVzIHx8IHt9KSB9O1xuICAgICAgICAgICAgICBpZiAoZGVwc1tcIm5leHRcIl0pIGZyYW1ld29yayA9IFwibmV4dGpzXCI7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGRlcHNbXCJudXh0XCJdIHx8IGRlcHNbXCJudXh0M1wiXSkgZnJhbWV3b3JrID0gXCJudXh0XCI7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGRlcHNbXCJAYW5ndWxhci9jb3JlXCJdKSBmcmFtZXdvcmsgPSBcImFuZ3VsYXJcIjtcbiAgICAgICAgICAgICAgZWxzZSBpZiAoZGVwc1tcInN2ZWx0ZVwiXSB8fCBkZXBzW1wiQHN2ZWx0ZWpzL2tpdFwiXSkgZnJhbWV3b3JrID0gXCJzdmVsdGVcIjtcbiAgICAgICAgICAgICAgZWxzZSBpZiAoZGVwc1tcImFzdHJvXCJdKSBmcmFtZXdvcmsgPSBcImFzdHJvXCI7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGRlcHNbXCJ2dWVcIl0pIGZyYW1ld29yayA9IFwidnVlXCI7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGRlcHNbXCJyZWFjdFwiXSkgZnJhbWV3b3JrID0gXCJyZWFjdFwiO1xuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBucG1JbnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgICBsZXQgaW5zdGFsbEVycm9yID0gXCJcIjtcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwa2dQYXRoKSkge1xuICAgICAgICAgICAgY29uc3QgZGV0ZWN0UE0gPSAoKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiYnVuLmxvY2tiXCIpKSB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImJ1bi5sb2NrXCIpKSkgcmV0dXJuIFwiYnVuXCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0tbG9jay55YW1sXCIpKSB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIikpKSByZXR1cm4gXCJwbnBtXCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInlhcm4ubG9ja1wiKSkpIHJldHVybiBcInlhcm5cIjtcbiAgICAgICAgICAgICAgcmV0dXJuIFwibnBtXCI7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgZGV0ZWN0ZWRQTSA9IGRldGVjdFBNKCk7XG5cbiAgICAgICAgICAgIGxldCBpc01vbm9yZXBvID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBwa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwa2dQYXRoLCBcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgaWYgKHBrZy53b3Jrc3BhY2VzIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS13b3Jrc3BhY2UueWFtbFwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJsZXJuYS5qc29uXCIpKSkge1xuICAgICAgICAgICAgICAgIGlzTW9ub3JlcG8gPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQgPSBkZXRlY3RlZFBNID09PSBcInBucG1cIiA/IFwibnB4IHBucG0gaW5zdGFsbCAtLW5vLWZyb3plbi1sb2NrZmlsZSAtLWlnbm9yZS1zY3JpcHRzXCJcbiAgICAgICAgICAgICAgOiBkZXRlY3RlZFBNID09PSBcInlhcm5cIiA/IFwibnB4IHlhcm4gaW5zdGFsbCAtLWlnbm9yZS1lbmdpbmVzIC0taWdub3JlLXNjcmlwdHNcIlxuICAgICAgICAgICAgICA6IGRldGVjdGVkUE0gPT09IFwiYnVuXCIgPyBcIm5weCBidW4gaW5zdGFsbCAtLWlnbm9yZS1zY3JpcHRzXCJcbiAgICAgICAgICAgICAgOiBcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyAtLWlnbm9yZS1zY3JpcHRzXCI7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBJbnN0YWxsaW5nIGRlcHMgZm9yICR7cHJvamVjdE5hbWV9IHdpdGg6ICR7aW5zdGFsbENtZH0gKHBtOiAke2RldGVjdGVkUE19LCBtb25vcmVwbzogJHtpc01vbm9yZXBvfSlgKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGV4ZWNTeW5jKGluc3RhbGxDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxODAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7XG4gICAgICAgICAgICAgIG5wbUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBEZXBzIGluc3RhbGxlZCBmb3IgJHtwcm9qZWN0TmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGluc3RhbGxFcnI6IGFueSkge1xuICAgICAgICAgICAgICBpbnN0YWxsRXJyb3IgPSBpbnN0YWxsRXJyLnN0ZGVycj8udG9TdHJpbmcoKS5zbGljZSgtNTAwKSB8fCBpbnN0YWxsRXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDUwMCkgfHwgXCJVbmtub3duIGVycm9yXCI7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtJbXBvcnRdIEluc3RhbGwgZmFpbGVkIGZvciAke3Byb2plY3ROYW1lfSB3aXRoICR7ZGV0ZWN0ZWRQTX06YCwgaW5zdGFsbEVycm9yLnNsaWNlKDAsIDMwMCkpO1xuICAgICAgICAgICAgICBpZiAoZGV0ZWN0ZWRQTSAhPT0gXCJucG1cIikge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gUmV0cnlpbmcgd2l0aCBucG0gZm9yICR7cHJvamVjdE5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICBleGVjU3luYyhcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyAtLWlnbm9yZS1zY3JpcHRzXCIsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxODAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICBucG1JbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgaW5zdGFsbEVycm9yID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBEZXBzIGluc3RhbGxlZCBmb3IgJHtwcm9qZWN0TmFtZX0gKG5wbSBmYWxsYmFjaylgKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChyZXRyeUVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICBpbnN0YWxsRXJyb3IgPSByZXRyeUVyci5zdGRlcnI/LnRvU3RyaW5nKCkuc2xpY2UoLTMwMCkgfHwgcmV0cnlFcnIubWVzc2FnZT8uc2xpY2UoMCwgMzAwKSB8fCBcIlJldHJ5IGZhaWxlZFwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICAgICAgZnJhbWV3b3JrLFxuICAgICAgICAgICAgZmlsZXNXcml0dGVuLFxuICAgICAgICAgICAgbnBtSW5zdGFsbGVkLFxuICAgICAgICAgICAgc291cmNlUmVwbzogYGh0dHBzOi8vZ2l0aHViLmNvbS8ke293bmVyfS8ke3JlcG99YCxcbiAgICAgICAgICAgIGRlZmF1bHRCcmFuY2gsXG4gICAgICAgICAgICAuLi4oaW5zdGFsbEVycm9yID8geyBpbnN0YWxsRXJyb3I6IGluc3RhbGxFcnJvci5zbGljZSgwLCA1MDApIH0gOiB7fSksXG4gICAgICAgICAgfSkpO1xuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0cnkgeyBmcy5ybVN5bmModG1wRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBsZXQgYWN0aXZlUHJldmlld1BvcnQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgICBjb25zdCBwcm94eVRvUHJldmlldyA9IGFzeW5jIChyZXE6IGFueSwgcmVzOiBhbnksIHBvcnQ6IG51bWJlciwgdGFyZ2V0UGF0aDogc3RyaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGh0dHAgPSBhd2FpdCBpbXBvcnQoXCJodHRwXCIpO1xuICAgICAgICBjb25zdCBwcm94eVJlcSA9IGh0dHAucmVxdWVzdChcbiAgICAgICAgICB7XG4gICAgICAgICAgICBob3N0bmFtZTogXCIxMjcuMC4wLjFcIixcbiAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICBwYXRoOiB0YXJnZXRQYXRoLFxuICAgICAgICAgICAgbWV0aG9kOiByZXEubWV0aG9kLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5yZXEuaGVhZGVycywgaG9zdDogYGxvY2FsaG9zdDoke3BvcnR9YCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgKHByb3h5UmVzKSA9PiB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKHByb3h5UmVzLnN0YXR1c0NvZGUgfHwgMjAwLCBwcm94eVJlcy5oZWFkZXJzKTtcbiAgICAgICAgICAgIHByb3h5UmVzLnBpcGUocmVzLCB7IGVuZDogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHByb3h5UmVxLm9uKFwiZXJyb3JcIiwgKCkgPT4ge1xuICAgICAgICAgIGlmICghcmVzLmhlYWRlcnNTZW50KSB7IHJlcy5zdGF0dXNDb2RlID0gNTAyOyByZXMuZW5kKFwiUHJldmlldyBzZXJ2ZXIgbm90IHJlc3BvbmRpbmdcIik7IH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJlcS5waXBlKHByb3h5UmVxLCB7IGVuZDogdHJ1ZSB9KTtcbiAgICAgIH07XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvX19wcmV2aWV3XCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBjb25zdCBtYXRjaCA9IHJlcS51cmw/Lm1hdGNoKC9eXFwvKFxcZCspKFxcLy4qKT8kLykgfHwgcmVxLnVybD8ubWF0Y2goL15cXC9fX3ByZXZpZXdcXC8oXFxkKykoXFwvLiopPyQvKTtcbiAgICAgICAgaWYgKCFtYXRjaCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChcIkludmFsaWQgcHJldmlldyBVUkxcIik7IHJldHVybjsgfVxuICAgICAgICBjb25zdCBwb3J0ID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IG1hdGNoWzJdIHx8IFwiL1wiO1xuXG4gICAgICAgIGlmIChwb3J0IDwgNTEwMCB8fCBwb3J0ID4gNTIwMCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChcIlBvcnQgb3V0IG9mIHByZXZpZXcgcmFuZ2VcIik7IHJldHVybjsgfVxuXG4gICAgICAgIGFjdGl2ZVByZXZpZXdQb3J0ID0gcG9ydDtcbiAgICAgICAgYXdhaXQgcHJveHlUb1ByZXZpZXcocmVxLCByZXMsIHBvcnQsIHRhcmdldFBhdGgpO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IFBSRVZJRVdfQVNTRVRfUFJFRklYRVMgPSBbXCIvX25leHQvXCIsIFwiL19fbmV4dGpzXCIsIFwiL19fdml0ZVwiLCBcIi9Adml0ZS9cIiwgXCIvQGlkL1wiLCBcIi9AZnMvXCIsIFwiL25vZGVfbW9kdWxlcy9cIiwgXCIvc3JjL1wiLCBcIi9mYXZpY29uLmljb1wiLCBcIi9vcGVuZ3JhcGgtaW1hZ2VcIiwgXCIvYXBwbGUtdG91Y2gtaWNvblwiLCBcIi9tYW5pZmVzdC5qc29uXCIsIFwiL3N3LmpzXCIsIFwiL3dvcmtib3gtXCIsIFwiL3N0YXRpYy9cIiwgXCIvc29ja2pzLW5vZGUvXCIsIFwiL2J1aWxkL1wiLCBcIi9fYXNzZXRzL1wiLCBcIi9hc3NldHMvXCIsIFwiL3B1YmxpYy9cIiwgXCIvcG9seWZpbGxzXCIsIFwiLy52aXRlL1wiLCBcIi9obXJcIiwgXCIvX193ZWJwYWNrX2htclwiXTtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIGlmICghYWN0aXZlUHJldmlld1BvcnQgfHwgIXJlcS51cmwpIHsgbmV4dCgpOyByZXR1cm47IH1cbiAgICAgICAgY29uc3Qgc2hvdWxkUHJveHkgPSBQUkVWSUVXX0FTU0VUX1BSRUZJWEVTLnNvbWUocCA9PiByZXEudXJsIS5zdGFydHNXaXRoKHApKTtcbiAgICAgICAgaWYgKCFzaG91bGRQcm94eSkgeyBuZXh0KCk7IHJldHVybjsgfVxuICAgICAgICBhd2FpdCBwcm94eVRvUHJldmlldyhyZXEsIHJlcywgYWN0aXZlUHJldmlld1BvcnQsIHJlcS51cmwpO1xuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3ByZXZpZXctaW5mb1wiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG5hbWUgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgY29uc3QgZW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChuYW1lKTtcbiAgICAgICAgICBjb25zdCByZXBsaXREb21haW4gPSBwcm9jZXNzLmVudi5SRVBMSVRfREVWX0RPTUFJTiB8fCBcIlwiO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICAgICAgY29uc3QgcHJveHlVcmwgPSBgL19fcHJldmlldy8ke2VudHJ5LnBvcnR9L2A7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgcnVubmluZzogdHJ1ZSwgcG9ydDogZW50cnkucG9ydCwgcHJveHlVcmwsIHJlcGxpdERvbWFpbiB9KSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBydW5uaW5nOiBmYWxzZSB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvc3RvcC1wcmV2aWV3XCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICAgICAgY29uc3QgcGlkID0gZW50cnkucHJvY2Vzcy5waWQ7XG4gICAgICAgICAgICB0cnkgeyBwcm9jZXNzLmtpbGwoLXBpZCwgOSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgIHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR0tJTExcIik7IH0gY2F0Y2gge31cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgICAgIGNvbnN0IGtpbGxQb3J0ID0gYXN5bmMgKHBvcnQ6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ldFRjcCA9IGZzLnJlYWRGaWxlU3luYyhcIi9wcm9jL25ldC90Y3BcIiwgXCJ1dGYtOFwiKSArIGZzLnJlYWRGaWxlU3luYyhcIi9wcm9jL25ldC90Y3A2XCIsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9ydEhleCA9IHBvcnQudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkucGFkU3RhcnQoNCwgXCIwXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gbmV0VGNwLnNwbGl0KFwiXFxuXCIpLmZpbHRlcigobDogc3RyaW5nKSA9PiBsLmluY2x1ZGVzKGA6JHtwb3J0SGV4fSBgKSk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjb2xzID0gbGluZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGlub2RlID0gY29sc1s5XTtcbiAgICAgICAgICAgICAgICAgIGlmICghaW5vZGUgfHwgaW5vZGUgPT09IFwiMFwiKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHByb2NEaXJzID0gZnMucmVhZGRpclN5bmMoXCIvcHJvY1wiKS5maWx0ZXIoKGQ6IHN0cmluZykgPT4gL15cXGQrJC8udGVzdChkKSk7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHAgb2YgcHJvY0RpcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmZHMgPSBmcy5yZWFkZGlyU3luYyhgL3Byb2MvJHtwfS9mZGApO1xuICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmQgb2YgZmRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMucmVhZGxpbmtTeW5jKGAvcHJvYy8ke3B9L2ZkLyR7ZmR9YCkgPT09IGBzb2NrZXQ6WyR7aW5vZGV9XWApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBwcm9jZXNzLmtpbGwoLXBhcnNlSW50KHApLCA5KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IHByb2Nlc3Mua2lsbChwYXJzZUludChwKSwgOSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgYXdhaXQga2lsbFBvcnQoZW50cnkucG9ydCk7XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICBpZiAoYWN0aXZlUHJldmlld1BvcnQgPT09IGVudHJ5LnBvcnQpIGFjdGl2ZVByZXZpZXdQb3J0ID0gbnVsbDtcbiAgICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3RvcHBlZDogdHJ1ZSB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIHNvdXJjZURvd25sb2FkUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJzb3VyY2UtZG93bmxvYWRcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9kb3dubG9hZC1zb3VyY2VcIiwgYXN5bmMgKF9yZXEsIHJlcykgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGFyY2hpdmVyID0gKGF3YWl0IGltcG9ydChcImFyY2hpdmVyXCIpKS5kZWZhdWx0O1xuICAgICAgICAgIGNvbnN0IHByb2plY3RSb290ID0gcHJvY2Vzcy5jd2QoKTtcblxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi96aXBcIik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtRGlzcG9zaXRpb25cIiwgXCJhdHRhY2htZW50OyBmaWxlbmFtZT1sYW1iZGEtcmVjdXJzaXZlLXNvdXJjZS56aXBcIik7XG5cbiAgICAgICAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoXCJ6aXBcIiwgeyB6bGliOiB7IGxldmVsOiA5IH0gfSk7XG4gICAgICAgICAgYXJjaGl2ZS5waXBlKHJlcyk7XG5cbiAgICAgICAgICBjb25zdCBpbmNsdWRlRGlycyA9IFtcInNyY1wiLCBcInB1YmxpY1wiLCBcInN1cGFiYXNlXCIsIFwiZWxlY3Ryb24tYnJvd3NlclwiXTtcbiAgICAgICAgICBjb25zdCBpbmNsdWRlRmlsZXMgPSBbXG4gICAgICAgICAgICBcInBhY2thZ2UuanNvblwiLCBcInBhY2thZ2UtbG9jay5qc29uXCIsIFwidHNjb25maWcuanNvblwiLCBcInRzY29uZmlnLmFwcC5qc29uXCIsXG4gICAgICAgICAgICBcInRzY29uZmlnLm5vZGUuanNvblwiLCBcInZpdGUuY29uZmlnLnRzXCIsIFwidGFpbHdpbmQuY29uZmlnLnRzXCIsIFwicG9zdGNzcy5jb25maWcuanNcIixcbiAgICAgICAgICAgIFwiaW5kZXguaHRtbFwiLCBcImVzbGludC5jb25maWcuanNcIiwgXCIuZW52XCIsIFwiLmVudi5leGFtcGxlXCIsIFwicmVwbGl0Lm1kXCIsXG4gICAgICAgICAgICBcImNvbXBvbmVudHMuanNvblwiXG4gICAgICAgICAgXTtcblxuICAgICAgICAgIGZvciAoY29uc3QgZGlyIG9mIGluY2x1ZGVEaXJzKSB7XG4gICAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgICAgY29uc3QgZGlyUGF0aCA9IHBhdGguam9pbihwcm9qZWN0Um9vdCwgZGlyKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGRpclBhdGgpKSB7XG4gICAgICAgICAgICAgIGFyY2hpdmUuZGlyZWN0b3J5KGRpclBhdGgsIGRpciwgKGVudHJ5KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVudHJ5Lm5hbWUuaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIikgfHwgZW50cnkubmFtZS5pbmNsdWRlcyhcIi5jYWNoZVwiKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIHJldHVybiBlbnRyeTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGluY2x1ZGVGaWxlcykge1xuICAgICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHByb2plY3RSb290LCBmaWxlKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZpbGVQYXRoKSkge1xuICAgICAgICAgICAgICBhcmNoaXZlLmZpbGUoZmlsZVBhdGgsIHsgbmFtZTogZmlsZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJEb3dubG9hZCBzb3VyY2UgZXJyb3I6XCIsIGVycik7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChcIkZhaWxlZCB0byBjcmVhdGUgc291cmNlIGFyY2hpdmVcIik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcbiAgICBwb3J0OiA1MDAwLFxuICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gICAgd2F0Y2g6IHtcbiAgICAgIGlnbm9yZWQ6IFtcIioqL3Byb2plY3RzLyoqXCIsIFwiKiovLmxvY2FsLyoqXCIsIFwiKiovbm9kZV9tb2R1bGVzLyoqXCIsIFwiKiovLmNhY2hlLyoqXCJdLFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIGZpbGVXcml0ZVBsdWdpbigpLFxuICAgIHByb2plY3RNYW5hZ2VtZW50UGx1Z2luKCksXG4gICAgc291cmNlRG93bmxvYWRQbHVnaW4oKSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbXCJmYXZpY29uLmljb1wiLCBcInB3YS1pY29uLTUxMi5wbmdcIl0sXG4gICAgICB3b3JrYm94OiB7XG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2tEZW55bGlzdDogWy9eXFwvfm9hdXRoL10sXG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9XCJdLFxuICAgICAgfSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6IFwiXHUwM0JCIFJlY3Vyc2l2ZSBcdTIwMTQgU2VsZi1SZWZlcmVudGlhbCBJREVcIixcbiAgICAgICAgc2hvcnRfbmFtZTogXCJcdTAzQkIgUmVjdXJzaXZlXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkEgc2VsZi1yZWN1cnNpdmUgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgd2l0aCBBSS1wb3dlcmVkIGNvZGUgZXZvbHV0aW9uXCIsXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiMwYTBhMGFcIixcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogXCIjMGEwYTBhXCIsXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxuICAgICAgICBzY29wZTogXCIvXCIsXG4gICAgICAgIHN0YXJ0X3VybDogXCIvXCIsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiBcInB3YS1pY29uLTUxMi5wbmdcIixcbiAgICAgICAgICAgIHNpemVzOiBcIjUxMng1MTJcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2UvcG5nXCIsXG4gICAgICAgICAgICBwdXJwb3NlOiBcImFueSBtYXNrYWJsZVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pLFxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvUCxTQUFTLG9CQUFpQztBQUM5UixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsZUFBZTtBQUh4QixJQUFNLG1DQUFtQztBQUt6QyxTQUFTLGtCQUEwQjtBQUNqQyxTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixnQkFBZ0IsUUFBUTtBQUN0QixhQUFPLFlBQVksSUFBSSxtQkFBbUIsT0FBTyxLQUFLLFFBQVE7QUFDNUQsWUFBSSxJQUFJLFdBQVcsUUFBUTtBQUFFLGNBQUksYUFBYTtBQUFLLGNBQUksSUFBSSxvQkFBb0I7QUFBRztBQUFBLFFBQVE7QUFDMUYsWUFBSTtBQUNGLGNBQUksT0FBTztBQUNYLDJCQUFpQixTQUFTLElBQUssU0FBUTtBQUN2QyxnQkFBTSxFQUFFLFVBQVUsUUFBUSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQzdDLGNBQUksQ0FBQyxZQUFZLE9BQU8sWUFBWSxVQUFVO0FBQUUsZ0JBQUksYUFBYTtBQUFLLGdCQUFJLElBQUksNkJBQTZCO0FBQUc7QUFBQSxVQUFRO0FBRXRILGdCQUFNLEtBQUssTUFBTSxPQUFPLElBQUk7QUFDNUIsZ0JBQU0sY0FBYyxRQUFRLElBQUk7QUFDaEMsZ0JBQU0sV0FBVyxLQUFLLFFBQVEsYUFBYSxRQUFRO0FBQ25ELGNBQUksQ0FBQyxTQUFTLFdBQVcsV0FBVyxHQUFH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cUI7QUFBQSxJQUNyQixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZUFBZSxrQkFBa0I7QUFBQSxNQUNqRCxTQUFTO0FBQUEsUUFDUCwwQkFBMEIsQ0FBQyxXQUFXO0FBQUEsUUFDdEMsY0FBYyxDQUFDLHNDQUFzQztBQUFBLE1BQ3ZEO0FBQUEsTUFDQSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxPQUFPO0FBQUEsUUFDUCxXQUFXO0FBQUEsUUFDWCxPQUFPO0FBQUEsVUFDTDtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0gsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFsiZXhlY1N5bmMiLCAiaXNQbnBtTW9ub3JlcG8iLCAiZnMiLCAicHJvamVjdERpciIsICJleGVjQXN5bmMiLCAib3MiLCAiaXNXaW4iXQp9Cg==
