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
              if (scriptBody.includes("webpack")) {
                const wpArgs = ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr];
                const cfgM = scriptBody.match(/(?:--config[=\s]|-c\s)(\S+)/);
                if (cfgM) wpArgs.splice(2, 0, "--config", cfgM[1]);
                return { cmd: "npx", args: wpArgs };
              }
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
            NODE_PATH: path.join(projectDir, "node_modules"),
            CHOKIDAR_USEPOLLING: "true"
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
          const isWebpackDirect = devCmd.args.includes("webpack") || devCmd.args.includes("webpack-dev-server") || devCmd.args.includes("vue-cli-service");
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
              if (scriptBody.includes("webpack")) {
                const wpArgs = ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr];
                const cfgM = scriptBody.match(/(?:--config[=\s]|-c\s)(\S+)/);
                if (cfgM) wpArgs.splice(2, 0, "--config", cfgM[1]);
                return { cmd: "npx", args: wpArgs };
              }
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
                try {
                  const rebuildCmd = detectedPM === "pnpm" ? "npx pnpm rebuild" : detectedPM === "yarn" ? "npx yarn rebuild" : "npm rebuild";
                  execSync(rebuildCmd, { cwd: projectDir, timeout: 12e4, stdio: "pipe", shell: true });
                  console.log(`[Import] Native modules rebuilt for ${projectName}`);
                } catch (rebuildErr) {
                  console.log(`[Import] Rebuild skipped/failed for ${projectName} (non-critical)`);
                }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIHR5cGUgUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcblxuZnVuY3Rpb24gZmlsZVdyaXRlUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJmaWxlLXdyaXRlXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvd3JpdGUtZmlsZVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBsZXQgYm9keSA9IFwiXCI7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGJvZHkgKz0gY2h1bms7XG4gICAgICAgICAgY29uc3QgeyBmaWxlUGF0aCwgY29udGVudCB9ID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICBpZiAoIWZpbGVQYXRoIHx8IHR5cGVvZiBjb250ZW50ICE9PSBcInN0cmluZ1wiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKFwiTWlzc2luZyBmaWxlUGF0aCBvciBjb250ZW50XCIpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdFJvb3QgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBmaWxlUGF0aCk7XG4gICAgICAgICAgaWYgKCFyZXNvbHZlZC5zdGFydHNXaXRoKHByb2plY3RSb290KSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShyZXNvbHZlZCk7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIGZzLm1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgbGV0IHByZXZpb3VzQ29udGVudCA9IFwiXCI7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocmVzb2x2ZWQpKSBwcmV2aW91c0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWQsIFwidXRmLThcIik7XG5cbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHJlc29sdmVkLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBmaWxlUGF0aCwgcHJldmlvdXNDb250ZW50LCBieXRlc1dyaXR0ZW46IGNvbnRlbnQubGVuZ3RoIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9yZWFkLWZpbGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5ICs9IGNodW5rO1xuICAgICAgICAgIGNvbnN0IHsgZmlsZVBhdGggfSA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgICAgaWYgKCFmaWxlUGF0aCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChcIk1pc3NpbmcgZmlsZVBhdGhcIik7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHByb2Nlc3MuY3dkKCk7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBwYXRoLnJlc29sdmUocHJvamVjdFJvb3QsIGZpbGVQYXRoKTtcbiAgICAgICAgICBpZiAoIXJlc29sdmVkLnN0YXJ0c1dpdGgocHJvamVjdFJvb3QpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKFwiUGF0aCBvdXRzaWRlIHByb2plY3RcIik7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZXhpc3RzID0gZnMuZXhpc3RzU3luYyhyZXNvbHZlZCk7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IGV4aXN0cyA/IGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZCwgXCJ1dGYtOFwiKSA6IFwiXCI7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGV4aXN0cywgY29udGVudCB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBwcm9qZWN0TWFuYWdlbWVudFBsdWdpbigpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwicHJvamVjdC1tYW5hZ2VtZW50XCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgYXN5bmMgZnVuY3Rpb24gcmVhZEJvZHkocmVxOiBhbnkpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICBsZXQgYm9keSA9IFwiXCI7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5ICs9IGNodW5rO1xuICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdmFsaWRhdGVQcm9qZWN0UGF0aChwcm9qZWN0TmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZyk6IHsgdmFsaWQ6IGJvb2xlYW47IHJlc29sdmVkOiBzdHJpbmc7IGVycm9yPzogc3RyaW5nIH0ge1xuICAgICAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHByb2Nlc3MuY3dkKCk7XG4gICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBcInByb2plY3RzXCIpO1xuICAgICAgICBpZiAoIXByb2plY3ROYW1lIHx8IC9bXFwvXFxcXF18XFwuXFwuLy50ZXN0KHByb2plY3ROYW1lKSB8fCBwcm9qZWN0TmFtZSA9PT0gJy4nIHx8IHByb2plY3ROYW1lLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgcmVzb2x2ZWQ6IFwiXCIsIGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RzRGlyLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgIGlmICghcHJvamVjdERpci5zdGFydHNXaXRoKHByb2plY3RzRGlyICsgcGF0aC5zZXApICYmIHByb2plY3REaXIgIT09IHByb2plY3RzRGlyKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCByZXNvbHZlZDogXCJcIiwgZXJyb3I6IFwiUGF0aCB0cmF2ZXJzYWwgYmxvY2tlZFwiIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpbGVQYXRoKSB7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghcmVzb2x2ZWQuc3RhcnRzV2l0aChwcm9qZWN0RGlyICsgcGF0aC5zZXApICYmIHJlc29sdmVkICE9PSBwcm9qZWN0RGlyKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIHJlc29sdmVkOiBcIlwiLCBlcnJvcjogXCJGaWxlIHBhdGggdHJhdmVyc2FsIGJsb2NrZWRcIiB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgcmVzb2x2ZWQgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgcmVzb2x2ZWQ6IHByb2plY3REaXIgfTtcbiAgICAgIH1cblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvbGlzdFwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIik7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3RzRGlyKSkge1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3RzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZW50cmllcyA9IGZzLnJlYWRkaXJTeW5jKHByb2plY3RzRGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICAgICAgY29uc3QgcHJvamVjdHMgPSBlbnRyaWVzXG4gICAgICAgICAgICAuZmlsdGVyKChlOiBhbnkpID0+IGUuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgIC5tYXAoKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBwcm9qUGF0aCA9IHBhdGguam9pbihwcm9qZWN0c0RpciwgZS5uYW1lKTtcbiAgICAgICAgICAgICAgY29uc3QgcGtnUGF0aCA9IHBhdGguam9pbihwcm9qUGF0aCwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgIGxldCBkZXNjcmlwdGlvbiA9IFwiXCI7XG4gICAgICAgICAgICAgIGxldCBmcmFtZXdvcmsgPSBcInJlYWN0XCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBrZ1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb24gPSBwa2cuZGVzY3JpcHRpb24gfHwgXCJcIjtcbiAgICAgICAgICAgICAgICAgIGZyYW1ld29yayA9IHBrZy5fZnJhbWV3b3JrIHx8IFwicmVhY3RcIjtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKHByb2pQYXRoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBlLm5hbWUsXG4gICAgICAgICAgICAgICAgcGF0aDogYHByb2plY3RzLyR7ZS5uYW1lfWAsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBzdGF0LmJpcnRodGltZS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGZyYW1ld29yayxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBwcm9qZWN0cyB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvY3JlYXRlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZnJhbWV3b3JrID0gXCJyZWFjdFwiLCBkZXNjcmlwdGlvbiA9IFwiXCIgfSA9IGJvZHk7XG4gICAgICAgICAgaWYgKCFuYW1lIHx8IHR5cGVvZiBuYW1lICE9PSBcInN0cmluZ1wiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIk1pc3NpbmcgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSk7XG4gICAgICAgICAgaWYgKCFjaGVjay52YWxpZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogY2hlY2suZXJyb3IgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IGNoZWNrLnJlc29sdmVkO1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA5OyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlByb2plY3QgYWxyZWFkeSBleGlzdHNcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgY29uc3QgcGtnSnNvbiA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICB2ZXJzaW9uOiBcIjAuMC4xXCIsXG4gICAgICAgICAgICBwcml2YXRlOiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICBfZnJhbWV3b3JrOiBmcmFtZXdvcmssXG4gICAgICAgICAgfSwgbnVsbCwgMik7XG4gICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIHBrZ0pzb24sIFwidXRmLThcIik7XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgbmFtZSwgZnJhbWV3b3JrLCBkZXNjcmlwdGlvbiwgcGF0aDogYHByb2plY3RzLyR7bmFtZX1gIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9kZWxldGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJNaXNzaW5nIHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgY29uc3QgY2hlY2sgPSB2YWxpZGF0ZVByb2plY3RQYXRoKG5hbWUpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjaGVjay5yZXNvbHZlZCkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUHJvamVjdCBub3QgZm91bmRcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgZnMucm1TeW5jKGNoZWNrLnJlc29sdmVkLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIG5hbWUgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL2ZpbGVzXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiTWlzc2luZyBwcm9qZWN0IG5hbWVcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGNvbnN0IGNoZWNrID0gdmFsaWRhdGVQcm9qZWN0UGF0aChuYW1lKTtcbiAgICAgICAgICBpZiAoIWNoZWNrLnZhbGlkKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBjaGVjay5lcnJvciB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY2hlY2sucmVzb2x2ZWQpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA0OyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlByb2plY3Qgbm90IGZvdW5kXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGZ1bmN0aW9uIHdhbGtEaXIoZGlyOiBzdHJpbmcsIGJhc2U6IHN0cmluZyk6IGFueVtdIHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICAgICAgICBpZiAoZW50cnkubmFtZSA9PT0gXCJub2RlX21vZHVsZXNcIiB8fCBlbnRyeS5uYW1lID09PSBcIi5jYWNoZVwiIHx8IGVudHJ5Lm5hbWUgPT09IFwiZGlzdFwiKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgY29uc3QgcmVsUGF0aCA9IHBhdGguam9pbihiYXNlLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7IG5hbWU6IGVudHJ5Lm5hbWUsIHBhdGg6IHJlbFBhdGgsIHR5cGU6IFwiZGlyZWN0b3J5XCIsIGNoaWxkcmVuOiB3YWxrRGlyKHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpLCByZWxQYXRoKSB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7IG5hbWU6IGVudHJ5Lm5hbWUsIHBhdGg6IHJlbFBhdGgsIHR5cGU6IFwiZmlsZVwiIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGEudHlwZSA9PT0gYi50eXBlKSByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGEudHlwZSA9PT0gXCJkaXJlY3RvcnlcIiA/IC0xIDogMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHRyZWUgPSB3YWxrRGlyKGNoZWNrLnJlc29sdmVkLCBcIlwiKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgbmFtZSwgZmlsZXM6IHRyZWUgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3JlYWQtZmlsZVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG5hbWUsIGZpbGVQYXRoIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSB8fCAhZmlsZVBhdGgpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiTWlzc2luZyBuYW1lIG9yIGZpbGVQYXRoXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGZzLmV4aXN0c1N5bmMoY2hlY2sucmVzb2x2ZWQpO1xuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBleGlzdHMgPyBmcy5yZWFkRmlsZVN5bmMoY2hlY2sucmVzb2x2ZWQsIFwidXRmLThcIikgOiBcIlwiO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBleGlzdHMsIGNvbnRlbnQsIGZpbGVQYXRoIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy93cml0ZS1maWxlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZmlsZVBhdGgsIGNvbnRlbnQgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFuYW1lIHx8ICFmaWxlUGF0aCB8fCB0eXBlb2YgY29udGVudCAhPT0gXCJzdHJpbmdcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJNaXNzaW5nIG5hbWUsIGZpbGVQYXRoLCBvciBjb250ZW50XCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShjaGVjay5yZXNvbHZlZCk7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIGZzLm1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgbGV0IHByZXZpb3VzQ29udGVudCA9IFwiXCI7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoY2hlY2sucmVzb2x2ZWQpKSBwcmV2aW91c0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoY2hlY2sucmVzb2x2ZWQsIFwidXRmLThcIik7XG5cbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGNoZWNrLnJlc29sdmVkLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBmaWxlUGF0aCwgcHJldmlvdXNDb250ZW50LCBieXRlc1dyaXR0ZW46IGNvbnRlbnQubGVuZ3RoIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBwcmV2aWV3UHJvY2Vzc2VzID0gbmV3IE1hcDxzdHJpbmcsIHsgcHJvY2VzczogYW55OyBwb3J0OiBudW1iZXIgfT4oKTtcbiAgICAgIGNvbnN0IHByb2plY3RQb3J0ID0gKG5hbWU6IHN0cmluZyk6IG51bWJlciA9PiB7XG4gICAgICAgIGxldCBoYXNoID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lLmxlbmd0aDsgaSsrKSBoYXNoID0gKChoYXNoIDw8IDUpIC0gaGFzaCArIG5hbWUuY2hhckNvZGVBdChpKSkgfCAwO1xuICAgICAgICByZXR1cm4gNTEwMCArICgoKGhhc2ggJSAxMDApICsgMTAwKSAlIDEwMCk7XG4gICAgICB9O1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9wcmV2aWV3XCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUgfHwgL1tcXC9cXFxcXXxcXC5cXC4vLnRlc3QobmFtZSkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJJbnZhbGlkIHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBuYW1lKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJQcm9qZWN0IG5vdCBmb3VuZFwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBpZiAocHJldmlld1Byb2Nlc3Nlcy5oYXMobmFtZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSkhO1xuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc0FsaXZlID0gZXhpc3RpbmcucHJvY2VzcyAmJiAhZXhpc3RpbmcucHJvY2Vzcy5raWxsZWQgJiYgZXhpc3RpbmcucHJvY2Vzcy5leGl0Q29kZSA9PT0gbnVsbDtcbiAgICAgICAgICAgIGlmIChwcm9jZXNzQWxpdmUpIHtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBwb3J0OiBleGlzdGluZy5wb3J0LCByZXVzZWQ6IHRydWUgfSkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQ2xlYW5lZCB1cCBkZWFkIHByb2Nlc3MgZW50cnkgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgcG9ydCA9IHByb2plY3RQb3J0KG5hbWUpO1xuICAgICAgICAgIGNvbnN0IHVzZWRQb3J0cyA9IG5ldyBTZXQoWy4uLnByZXZpZXdQcm9jZXNzZXMudmFsdWVzKCldLm1hcChlID0+IGUucG9ydCkpO1xuICAgICAgICAgIHdoaWxlICh1c2VkUG9ydHMuaGFzKHBvcnQpKSBwb3J0Kys7XG4gICAgICAgICAgY29uc3QgeyBzcGF3biwgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG5cbiAgICAgICAgICBjb25zdCBuZXQgPSBhd2FpdCBpbXBvcnQoXCJuZXRcIik7XG4gICAgICAgICAgY29uc3QgcG9ydEluVXNlID0gYXdhaXQgbmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRlc3RlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKS5vbmNlKFwiZXJyb3JcIiwgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIHJlc29sdmUoZXJyLmNvZGUgPT09IFwiRUFERFJJTlVTRVwiKTtcbiAgICAgICAgICAgIH0pLm9uY2UoXCJsaXN0ZW5pbmdcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICB0ZXN0ZXIuY2xvc2UoKCkgPT4gcmVzb2x2ZShmYWxzZSkpO1xuICAgICAgICAgICAgfSkubGlzdGVuKHBvcnQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChwb3J0SW5Vc2UpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUG9ydCAke3BvcnR9IHN0aWxsIGluIHVzZSBcdTIwMTQga2lsbGluZ2ApO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgbmV0VGNwID0gZnMucmVhZEZpbGVTeW5jKFwiL3Byb2MvbmV0L3RjcFwiLCBcInV0Zi04XCIpICsgZnMucmVhZEZpbGVTeW5jKFwiL3Byb2MvbmV0L3RjcDZcIiwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgY29uc3QgcG9ydEhleCA9IHBvcnQudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkucGFkU3RhcnQoNCwgXCIwXCIpO1xuICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IG5ldFRjcC5zcGxpdChcIlxcblwiKS5maWx0ZXIobCA9PiBsLmluY2x1ZGVzKGA6JHtwb3J0SGV4fSBgKSAmJiBsLmluY2x1ZGVzKFwiMEFcIikpO1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xzID0gbGluZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbm9kZSA9IGNvbHNbOV07XG4gICAgICAgICAgICAgICAgaWYgKCFpbm9kZSB8fCBpbm9kZSA9PT0gXCIwXCIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb2NEaXJzID0gZnMucmVhZGRpclN5bmMoXCIvcHJvY1wiKS5maWx0ZXIoKGQ6IHN0cmluZykgPT4gL15cXGQrJC8udGVzdChkKSk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwaWQgb2YgcHJvY0RpcnMpIHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZkcyA9IGZzLnJlYWRkaXJTeW5jKGAvcHJvYy8ke3BpZH0vZmRgKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmZCBvZiBmZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluayA9IGZzLnJlYWRsaW5rU3luYyhgL3Byb2MvJHtwaWR9L2ZkLyR7ZmR9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGluayA9PT0gYHNvY2tldDpbJHtpbm9kZX1dYCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEtpbGxpbmcgUElEICR7cGlkfSBvbiBwb3J0ICR7cG9ydH1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgcHJvY2Vzcy5raWxsKC1wYXJzZUludChwaWQpLCA5KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBwcm9jZXNzLmtpbGwocGFyc2VJbnQocGlkKSwgOSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkgeyBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFBvcnQgY2xlYW51cCBlcnJvcjogJHtlLm1lc3NhZ2V9YCk7IH1cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCA4MDApKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBoYXNQa2cgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBhY2thZ2UuanNvblwiKSk7XG4gICAgICAgICAgY29uc3QgaGFzTm9kZU1vZHVsZXMgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiKSk7XG5cbiAgICAgICAgICBsZXQgcGtnOiBhbnkgPSB7fTtcbiAgICAgICAgICBpZiAoaGFzUGtnKSB7XG4gICAgICAgICAgICB0cnkgeyBwa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIFwidXRmLThcIikpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGV0ZWN0UGFja2FnZU1hbmFnZXIgPSAoKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImJ1bi5sb2NrYlwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJidW4ubG9ja1wiKSkpIHJldHVybiBcImJ1blwiO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS1sb2NrLnlhbWxcIikpKSByZXR1cm4gXCJwbnBtXCI7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ5YXJuLmxvY2tcIikpKSByZXR1cm4gXCJ5YXJuXCI7XG4gICAgICAgICAgICByZXR1cm4gXCJucG1cIjtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgcG0gPSBkZXRlY3RQYWNrYWdlTWFuYWdlcigpO1xuXG4gICAgICAgICAgaWYgKGhhc1BrZyAmJiAhaGFzTm9kZU1vZHVsZXMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQgPSBwbSA9PT0gXCJucG1cIiA/IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCJcbiAgICAgICAgICAgICAgICA6IHBtID09PSBcInBucG1cIiA/IFwibnB4IHBucG0gaW5zdGFsbCAtLW5vLWZyb3plbi1sb2NrZmlsZVwiXG4gICAgICAgICAgICAgICAgOiBwbSA9PT0gXCJ5YXJuXCIgPyBcIm5weCB5YXJuIGluc3RhbGwgLS1pZ25vcmUtZW5naW5lc1wiXG4gICAgICAgICAgICAgICAgOiBcIm5weCBidW4gaW5zdGFsbFwiO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEluc3RhbGxpbmcgZGVwcyBmb3IgJHtuYW1lfSB3aXRoOiAke2luc3RhbGxDbWR9YCk7XG4gICAgICAgICAgICAgIGV4ZWNTeW5jKGluc3RhbGxDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gRGVwcyBpbnN0YWxsZWQgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGluc3RhbGxFcnI6IGFueSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gSW5zdGFsbCBmYWlsZWQgZm9yICR7bmFtZX06YCwgaW5zdGFsbEVyci5tZXNzYWdlPy5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUmV0cnlpbmcgd2l0aCBucG0gZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgICAgICBleGVjU3luYyhcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwc1wiLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICB9IGNhdGNoIChyZXRyeUVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW1ByZXZpZXddIFJldHJ5IGFsc28gZmFpbGVkIGZvciAke25hbWV9OmAsIHJldHJ5RXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDMwMCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGV0ZWN0RGV2Q29tbWFuZCA9ICgpOiB7IGNtZDogc3RyaW5nOyBhcmdzOiBzdHJpbmdbXSB9ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBwa2cuc2NyaXB0cyB8fCB7fTtcbiAgICAgICAgICAgIGNvbnN0IGRlcHMgPSB7IC4uLihwa2cuZGVwZW5kZW5jaWVzIHx8IHt9KSwgLi4uKHBrZy5kZXZEZXBlbmRlbmNpZXMgfHwge30pIH07XG4gICAgICAgICAgICBjb25zdCBwb3J0U3RyID0gU3RyaW5nKHBvcnQpO1xuXG4gICAgICAgICAgICBjb25zdCBtYXRjaFNjcmlwdCA9IChzY3JpcHRCb2R5OiBzdHJpbmcpOiB7IGNtZDogc3RyaW5nOyBhcmdzOiBzdHJpbmdbXSB9IHwgbnVsbCA9PiB7XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwibmV4dFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJuZXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwicmVhY3Qtc2NyaXB0c1wiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyZWFjdC1zY3JpcHRzXCIsIFwic3RhcnRcIl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJudXh0XCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm51eHRcIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJhc3Ryb1wiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJhc3Ryb1wiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcIm5nIFwiKSB8fCBzY3JpcHRCb2R5LmluY2x1ZGVzKFwibmcgc2VydmVcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmdcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0ciwgXCItLWRpc2FibGUtaG9zdC1jaGVja1wiXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJlbWl4XCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJlbWl4XCIsIFwidml0ZTpkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiZ2F0c2J5XCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcImdhdHNieVwiLCBcImRldmVsb3BcIiwgXCItSFwiLCBcIjAuMC4wLjBcIiwgXCItcFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcIndlYnBhY2tcIikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB3cEFyZ3MgPSBbXCJ3ZWJwYWNrXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNmZ00gPSBzY3JpcHRCb2R5Lm1hdGNoKC8oPzotLWNvbmZpZ1s9XFxzXXwtY1xccykoXFxTKykvKTtcbiAgICAgICAgICAgICAgICBpZiAoY2ZnTSkgd3BBcmdzLnNwbGljZSgyLCAwLCBcIi0tY29uZmlnXCIsIGNmZ01bMV0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogd3BBcmdzIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJyc3BhY2tcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicnNwYWNrXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwic3ZlbHRlXCIpIHx8IHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJzdmVsdGVraXRcIikpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInBhcmNlbFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJwYXJjZWxcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiZW1iZXJcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiZW1iZXJcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJ2aXRlXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgaXNTdmVsdGVLaXQgPSBkZXBzW1wiQHN2ZWx0ZWpzL2tpdFwiXSB8fCBkZXBzW1wic3ZlbHRla2l0XCJdO1xuICAgICAgICAgICAgY29uc3QgaXNQbnBtTW9ub3JlcG8gPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIikpO1xuXG4gICAgICAgICAgICBpZiAoaXNQbnBtTW9ub3JlcG8pIHtcbiAgICAgICAgICAgICAgY29uc3Qgd3NZYW1sID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIiksIFwidXRmLThcIik7XG4gICAgICAgICAgICAgIGNvbnN0IGhhc1BhY2thZ2VzID0gd3NZYW1sLmluY2x1ZGVzKFwicGFja2FnZXM6XCIpO1xuICAgICAgICAgICAgICBpZiAoaGFzUGFja2FnZXMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhzY3JpcHRzKSkge1xuICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdHNba2V5XS5pbmNsdWRlcyhcIi0tZmlsdGVyXCIpICYmIChrZXkuaW5jbHVkZXMoXCJkZXZcIikgfHwga2V5ID09PSBcImxwOmRldlwiKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIERldGVjdGVkIHBucG0gbW9ub3JlcG8sIHVzaW5nIHNjcmlwdCBcIiR7a2V5fVwiOiAke3NjcmlwdHNba2V5XX1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBwbSA9PT0gXCJwbnBtXCIgPyBcInBucG1cIiA6IFwibnB4IHBucG1cIiwgYXJnczogW1wicnVuXCIsIGtleV0gfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNjcmlwdHMuZGV2KSB7XG4gICAgICAgICAgICAgIGlmIChpc1N2ZWx0ZUtpdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcImRldlwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gbWF0Y2hTY3JpcHQoc2NyaXB0cy5kZXYpO1xuICAgICAgICAgICAgICBpZiAobWF0Y2hlZCkgcmV0dXJuIG1hdGNoZWQ7XG4gICAgICAgICAgICAgIHJldHVybiB7IGNtZDogcG0gPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtfWAsIGFyZ3M6IHBtID09PSBcIm5wbVwiID8gW1wicnVuXCIsIFwiZGV2XCJdIDogW1wicnVuXCIsIFwiZGV2XCJdIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzY3JpcHRzLnN0YXJ0KSB7XG4gICAgICAgICAgICAgIGNvbnN0IG1hdGNoZWQgPSBtYXRjaFNjcmlwdChzY3JpcHRzLnN0YXJ0KTtcbiAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiBtYXRjaGVkO1xuICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IHBtID09PSBcIm5wbVwiID8gXCJucG1cIiA6IGBucHggJHtwbX1gLCBhcmdzOiBwbSA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBcInN0YXJ0XCJdIDogW1wicnVuXCIsIFwic3RhcnRcIl0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNjcmlwdHMuc2VydmUgfHwgc2NyaXB0c1tcInNlcnZlOnJzcGFja1wiXSkge1xuICAgICAgICAgICAgICBjb25zdCBzZXJ2ZVNjcmlwdCA9IHNjcmlwdHMuc2VydmUgfHwgc2NyaXB0c1tcInNlcnZlOnJzcGFja1wiXTtcbiAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlZCA9IG1hdGNoU2NyaXB0KHNlcnZlU2NyaXB0KTtcbiAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiBtYXRjaGVkO1xuICAgICAgICAgICAgICBjb25zdCBzZXJ2ZUtleSA9IHNjcmlwdHMuc2VydmUgPyBcInNlcnZlXCIgOiBcInNlcnZlOnJzcGFja1wiO1xuICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IHBtID09PSBcIm5wbVwiID8gXCJucG1cIiA6IGBucHggJHtwbX1gLCBhcmdzOiBwbSA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBzZXJ2ZUtleV0gOiBbXCJydW5cIiwgc2VydmVLZXldIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXBzW1wibmV4dFwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJuZXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcInJlYWN0LXNjcmlwdHNcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVhY3Qtc2NyaXB0c1wiLCBcInN0YXJ0XCJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIm51eHRcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibnV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJhc3Ryb1wiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJhc3Ryb1wiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJAYW5ndWxhci9jbGlcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmdcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0ciwgXCItLWRpc2FibGUtaG9zdC1jaGVja1wiXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJAcmVtaXgtcnVuL2RldlwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyZW1peFwiLCBcInZpdGU6ZGV2XCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJnYXRzYnlcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiZ2F0c2J5XCIsIFwiZGV2ZWxvcFwiLCBcIi1IXCIsIFwiMC4wLjAuMFwiLCBcIi1wXCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIndlYnBhY2stZGV2LXNlcnZlclwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ3ZWJwYWNrXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIkByc3BhY2svY2xpXCJdIHx8IGRlcHNbXCJAcnNwYWNrL2NvcmVcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicnNwYWNrXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcInBhcmNlbFwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJwYXJjZWxcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoaXNTdmVsdGVLaXQpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcImRldlwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcblxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwidml0ZS5jb25maWcudHNcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwidml0ZS5jb25maWcuanNcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwidml0ZS5jb25maWcubWpzXCIpKSkge1xuICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgZGV2Q21kID0gZGV0ZWN0RGV2Q29tbWFuZCgpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gU3RhcnRpbmcgJHtuYW1lfSB3aXRoOiAke2RldkNtZC5jbWR9ICR7ZGV2Q21kLmFyZ3Muam9pbihcIiBcIil9YCk7XG5cbiAgICAgICAgICBjb25zdCBpc1BucG1Nb25vcmVwbyA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS13b3Jrc3BhY2UueWFtbFwiKSk7XG4gICAgICAgICAgaWYgKGlzUG5wbU1vbm9yZXBvKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRzID0gcGtnLnNjcmlwdHMgfHwge307XG4gICAgICAgICAgICBjb25zdCBidWlsZFNjcmlwdCA9IHNjcmlwdHNbXCJwYWNrYWdlczpidWlsZFwiXSB8fCBzY3JpcHRzLmJ1aWxkO1xuICAgICAgICAgICAgaWYgKGJ1aWxkU2NyaXB0ICYmIChidWlsZFNjcmlwdC5pbmNsdWRlcyhcIi0tZmlsdGVyXCIpIHx8IGJ1aWxkU2NyaXB0LmluY2x1ZGVzKFwicGFja2FnZXNcIikpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJ1aWxkS2V5ID0gc2NyaXB0c1tcInBhY2thZ2VzOmJ1aWxkXCJdID8gXCJwYWNrYWdlczpidWlsZFwiIDogXCJidWlsZFwiO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFByZS1idWlsZGluZyBwbnBtIG1vbm9yZXBvIHBhY2thZ2VzIHdpdGg6IHBucG0gcnVuICR7YnVpbGRLZXl9YCk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYzogZXhlY1N5bmNCdWlsZCB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgICBleGVjU3luY0J1aWxkKGBwbnBtIHJ1biAke2J1aWxkS2V5fWAsIHsgY3dkOiBwcm9qZWN0RGlyLCBzdGRpbzogXCJwaXBlXCIsIHRpbWVvdXQ6IDkwMDAwIH0pO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gTW9ub3JlcG8gcGFja2FnZXMgYnVpbHQgc3VjY2Vzc2Z1bGx5YCk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gTW9ub3JlcG8gcGFja2FnZSBidWlsZCB3YXJuaW5nOiAke2UubWVzc2FnZT8uc2xpY2UoMCwgMjAwKX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvbnNvbGVCcmlkZ2VTY3JpcHQgPSBgPHNjcmlwdCBkYXRhLWd1YXJkaWFuLWNvbnNvbGUtYnJpZGdlPlxuKGZ1bmN0aW9uKCkge1xuICBpZiAod2luZG93Ll9fZ3VhcmRpYW5Db25zb2xlQnJpZGdlKSByZXR1cm47XG4gIHdpbmRvdy5fX2d1YXJkaWFuQ29uc29sZUJyaWRnZSA9IHRydWU7XG4gIHZhciBvcmlnTG9nID0gY29uc29sZS5sb2csIG9yaWdXYXJuID0gY29uc29sZS53YXJuLCBvcmlnRXJyb3IgPSBjb25zb2xlLmVycm9yLCBvcmlnSW5mbyA9IGNvbnNvbGUuaW5mbztcbiAgZnVuY3Rpb24gc2VuZChsZXZlbCwgYXJncywgc3RhY2spIHtcbiAgICB0cnkge1xuICAgICAgdmFyIHNlcmlhbGl6ZWQgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0cnkgeyBzZXJpYWxpemVkLnB1c2godHlwZW9mIGFyZ3NbaV0gPT09ICdvYmplY3QnID8gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShhcmdzW2ldKSkgOiBhcmdzW2ldKTsgfVxuICAgICAgICBjYXRjaChlKSB7IHNlcmlhbGl6ZWQucHVzaChTdHJpbmcoYXJnc1tpXSkpOyB9XG4gICAgICB9XG4gICAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgdHlwZTogJ2d1YXJkaWFuLWNvbnNvbGUtYnJpZGdlJywgbGV2ZWw6IGxldmVsLCBhcmdzOiBzZXJpYWxpemVkLCBzdGFjazogc3RhY2sgfHwgbnVsbCB9LCAnKicpO1xuICAgIH0gY2F0Y2goZSkge31cbiAgfVxuICBjb25zb2xlLmxvZyA9IGZ1bmN0aW9uKCkgeyBzZW5kKCdsb2cnLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTsgb3JpZ0xvZy5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpOyB9O1xuICBjb25zb2xlLndhcm4gPSBmdW5jdGlvbigpIHsgc2VuZCgnd2FybicsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpOyBvcmlnV2Fybi5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpOyB9O1xuICBjb25zb2xlLmVycm9yID0gZnVuY3Rpb24oKSB7IHNlbmQoJ2Vycm9yJywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7IG9yaWdFcnJvci5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpOyB9O1xuICBjb25zb2xlLmluZm8gPSBmdW5jdGlvbigpIHsgc2VuZCgnaW5mbycsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpOyBvcmlnSW5mby5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpOyB9O1xuICB3aW5kb3cub25lcnJvciA9IGZ1bmN0aW9uKG1zZywgc291cmNlLCBsaW5lLCBjb2x1bW4sIGVycm9yKSB7XG4gICAgc2VuZCgnZXJyb3InLCBbU3RyaW5nKG1zZyldLCBlcnJvciAmJiBlcnJvci5zdGFjayA/IGVycm9yLnN0YWNrIDogbnVsbCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigndW5oYW5kbGVkcmVqZWN0aW9uJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgcmVhc29uID0gZXZlbnQucmVhc29uO1xuICAgIHZhciBtc2cgPSByZWFzb24gaW5zdGFuY2VvZiBFcnJvciA/IHJlYXNvbi5tZXNzYWdlIDogU3RyaW5nKHJlYXNvbik7XG4gICAgdmFyIHN0YWNrID0gcmVhc29uIGluc3RhbmNlb2YgRXJyb3IgPyByZWFzb24uc3RhY2sgOiBudWxsO1xuICAgIHNlbmQoJ2Vycm9yJywgWydVbmhhbmRsZWQgUHJvbWlzZSBSZWplY3Rpb246ICcgKyBtc2ddLCBzdGFjayk7XG4gIH0pO1xufSkoKTtcbjwvc2NyaXB0PmA7XG5cbiAgICAgICAgICBjb25zdCBpbmRleEh0bWxQYXRocyA9IFtcbiAgICAgICAgICAgIHBhdGguam9pbihwcm9qZWN0RGlyLCBcImluZGV4Lmh0bWxcIiksXG4gICAgICAgICAgICBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwdWJsaWNcIiwgXCJpbmRleC5odG1sXCIpLFxuICAgICAgICAgICAgcGF0aC5qb2luKHByb2plY3REaXIsIFwic3JjXCIsIFwiaW5kZXguaHRtbFwiKSxcbiAgICAgICAgICBdO1xuICAgICAgICAgIGZvciAoY29uc3QgaW5kZXhIdG1sUGF0aCBvZiBpbmRleEh0bWxQYXRocykge1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoaW5kZXhIdG1sUGF0aCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgaW5kZXhIdG1sID0gZnMucmVhZEZpbGVTeW5jKGluZGV4SHRtbFBhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgIGlmICghaW5kZXhIdG1sLmluY2x1ZGVzKFwiZ3VhcmRpYW4tY29uc29sZS1icmlkZ2VcIikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRjaGVkID0gaW5kZXhIdG1sLnJlcGxhY2UoLzxoZWFkKFtePl0qKT4vLCBgPGhlYWQkMT5cXG4ke2NvbnNvbGVCcmlkZ2VTY3JpcHR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGNoZWQgIT09IGluZGV4SHRtbCkge1xuICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbmRleEh0bWxQYXRoLCBwYXRjaGVkLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBJbmplY3RlZCBjb25zb2xlIGJyaWRnZSBpbnRvICR7bmFtZX0vJHtwYXRoLnJlbGF0aXZlKHByb2plY3REaXIsIGluZGV4SHRtbFBhdGgpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZvciAoY29uc3QgY2ZnTmFtZSBvZiBbXCJ2aXRlLmNvbmZpZy50c1wiLCBcInZpdGUuY29uZmlnLmpzXCIsIFwidml0ZS5jb25maWcubWpzXCJdKSB7XG4gICAgICAgICAgICBjb25zdCB2aXRlQ29uZmlnUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBjZmdOYW1lKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHZpdGVDb25maWdQYXRoKSkge1xuICAgICAgICAgICAgICBjb25zdCB2aXRlQ29uZmlnQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh2aXRlQ29uZmlnUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSB2aXRlQ29uZmlnQ29udGVudDtcbiAgICAgICAgICAgICAgaWYgKCFjb250ZW50LmluY2x1ZGVzKFwidXNlUG9sbGluZ1wiKSkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAvZGVmaW5lQ29uZmlnXFwoXFx7LyxcbiAgICAgICAgICAgICAgICAgIGBkZWZpbmVDb25maWcoe1xcbiAgc2VydmVyOiB7XFxuICAgIHdhdGNoOiB7XFxuICAgICAgdXNlUG9sbGluZzogdHJ1ZSxcXG4gICAgICBpbnRlcnZhbDogNTAwLFxcbiAgICB9LFxcbiAgfSxgXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudCAhPT0gdml0ZUNvbmZpZ0NvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUGF0Y2hlZCAke25hbWV9LyR7Y2ZnTmFtZX0gd2l0aCB1c2VQb2xsaW5nYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICgvYmFzZTpcXHMqW1wiJ11cXC8oX19wcmV2aWV3fF9fZGV2KVteXCInXSpbXCInXS8udGVzdChjb250ZW50KSkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL1xccypiYXNlOlxccypbXCInXVxcLyhfX3ByZXZpZXd8X19kZXYpW15cIiddKltcIiddLD9cXG4/L2csIFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUmVtb3ZlZCBzdGFsZSBiYXNlIHBhdGggZnJvbSAke25hbWV9LyR7Y2ZnTmFtZX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoY29udGVudCAhPT0gdml0ZUNvbmZpZ0NvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHZpdGVDb25maWdQYXRoLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZvciAoY29uc3QgcnNwYWNrQ2ZnIG9mIFtcInJzcGFjay5jb25maWcuanNcIiwgXCJyc3BhY2suY29uZmlnLnRzXCJdKSB7XG4gICAgICAgICAgICBjb25zdCByc3BhY2tQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIHJzcGFja0NmZyk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhyc3BhY2tQYXRoKSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxldCByc0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocnNwYWNrUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRNYXRjaCA9IHJzQ29udGVudC5tYXRjaCgvcG9ydDpcXHMqKFxcZCspLyk7XG4gICAgICAgICAgICAgICAgaWYgKHBvcnRNYXRjaCAmJiBwb3J0TWF0Y2hbMV0gIT09IFN0cmluZyhwb3J0KSkge1xuICAgICAgICAgICAgICAgICAgcnNDb250ZW50ID0gcnNDb250ZW50LnJlcGxhY2UoL3BvcnQ6XFxzKlxcZCsvLCBgcG9ydDogJHtwb3J0fWApO1xuICAgICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyc0NvbnRlbnQuaW5jbHVkZXMoXCJkZXZTZXJ2ZXJcIikgJiYgIXJzQ29udGVudC5pbmNsdWRlcyhcImhvc3Q6XCIpKSB7XG4gICAgICAgICAgICAgICAgICByc0NvbnRlbnQgPSByc0NvbnRlbnQucmVwbGFjZSgvKGRldlNlcnZlcjpcXHMqXFx7KS8sIGAkMVxcbiAgICBob3N0OiAnMC4wLjAuMCcsYCk7XG4gICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJzQ29udGVudC5pbmNsdWRlcyhcImhvc3Q6XCIpICYmICFyc0NvbnRlbnQuaW5jbHVkZXMoXCIwLjAuMC4wXCIpKSB7XG4gICAgICAgICAgICAgICAgICByc0NvbnRlbnQgPSByc0NvbnRlbnQucmVwbGFjZSgvaG9zdDpcXHMqWydcIl1bXidcIl0qWydcIl0vLCBgaG9zdDogJzAuMC4wLjAnYCk7XG4gICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocnNwYWNrUGF0aCwgcnNDb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQYXRjaGVkICR7bmFtZX0vJHtyc3BhY2tDZmd9IHdpdGggcG9ydCAke3BvcnR9IGFuZCBob3N0IDAuMC4wLjBgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcG9ydEVudjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgIC4uLnByb2Nlc3MuZW52IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gICAgICAgICAgICBCUk9XU0VSOiBcIm5vbmVcIixcbiAgICAgICAgICAgIFBPUlQ6IFN0cmluZyhwb3J0KSxcbiAgICAgICAgICAgIEhPU1Q6IFwiMC4wLjAuMFwiLFxuICAgICAgICAgICAgSE9TVE5BTUU6IFwiMC4wLjAuMFwiLFxuICAgICAgICAgICAgTk9ERV9QQVRIOiBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJub2RlX21vZHVsZXNcIiksXG4gICAgICAgICAgICBDSE9LSURBUl9VU0VQT0xMSU5HOiBcInRydWVcIixcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgaXNSZWFjdFNjcmlwdHMgPSBkZXZDbWQuYXJncy5pbmNsdWRlcyhcInJlYWN0LXNjcmlwdHNcIik7XG4gICAgICAgICAgaWYgKGlzUmVhY3RTY3JpcHRzKSB7XG4gICAgICAgICAgICBwb3J0RW52LlBPUlQgPSBTdHJpbmcocG9ydCk7XG4gICAgICAgICAgICBwb3J0RW52LkhPU1QgPSBcIjAuMC4wLjBcIjtcbiAgICAgICAgICAgIHBvcnRFbnYuU0tJUF9QUkVGTElHSFRfQ0hFQ0sgPSBcInRydWVcIjtcbiAgICAgICAgICAgIHBvcnRFbnYuUFVCTElDX1VSTCA9IFwiXCI7XG4gICAgICAgICAgICBwb3J0RW52Lk5PREVfT1BUSU9OUyA9IChwb3J0RW52Lk5PREVfT1BUSU9OUyB8fCBcIlwiKSArIFwiIC0tb3BlbnNzbC1sZWdhY3ktcHJvdmlkZXJcIjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZ1JhdyA9IGZzLnJlYWRGaWxlU3luYyhwa2dQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICBjb25zdCBwa2dPYmogPSBKU09OLnBhcnNlKHBrZ1Jhdyk7XG4gICAgICAgICAgICAgIGlmIChwa2dPYmouaG9tZXBhZ2UpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgcGtnT2JqLmhvbWVwYWdlO1xuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGtnUGF0aCwgSlNPTi5zdHJpbmdpZnkocGtnT2JqLCBudWxsLCAyKSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZW1vdmVkIGhvbWVwYWdlIGZyb20gJHtuYW1lfS9wYWNrYWdlLmpzb24gZm9yIGNvcnJlY3QgZGV2IHNlcnZpbmdgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGlzV2VicGFja0RpcmVjdCA9IGRldkNtZC5hcmdzLmluY2x1ZGVzKFwid2VicGFja1wiKSB8fCBkZXZDbWQuYXJncy5pbmNsdWRlcyhcIndlYnBhY2stZGV2LXNlcnZlclwiKSB8fCBkZXZDbWQuYXJncy5pbmNsdWRlcyhcInZ1ZS1jbGktc2VydmljZVwiKTtcbiAgICAgICAgICBpZiAoaXNXZWJwYWNrRGlyZWN0ICYmICFpc1JlYWN0U2NyaXB0cykge1xuICAgICAgICAgICAgcG9ydEVudi5OT0RFX09QVElPTlMgPSAocG9ydEVudi5OT0RFX09QVElPTlMgfHwgXCJcIikgKyBcIiAtLW9wZW5zc2wtbGVnYWN5LXByb3ZpZGVyXCI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaXNOZXh0RGV2ID0gZGV2Q21kLmFyZ3MuaW5jbHVkZXMoXCJuZXh0XCIpO1xuICAgICAgICAgIGlmIChpc05leHREZXYpIHtcbiAgICAgICAgICAgIHBvcnRFbnYuSE9TVE5BTUUgPSBcIjAuMC4wLjBcIjtcbiAgICAgICAgICAgIGNvbnN0IG5leHRMb2NrUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIi5uZXh0XCIsIFwiZGV2XCIsIFwibG9ja1wiKTtcbiAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKG5leHRMb2NrUGF0aCkpIHsgZnMudW5saW5rU3luYyhuZXh0TG9ja1BhdGgpOyBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFJlbW92ZWQgc3RhbGUgLm5leHQvZGV2L2xvY2sgZm9yICR7bmFtZX1gKTsgfSB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY2hpbGQgPSBzcGF3bihkZXZDbWQuY21kLCBkZXZDbWQuYXJncywge1xuICAgICAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICAgICAgc3RkaW86IFwicGlwZVwiLFxuICAgICAgICAgICAgc2hlbGw6IHRydWUsXG4gICAgICAgICAgICBkZXRhY2hlZDogdHJ1ZSxcbiAgICAgICAgICAgIGVudjogcG9ydEVudixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjaGlsZC51bnJlZigpO1xuXG4gICAgICAgICAgbGV0IHN0YXJ0dXBPdXRwdXQgPSBcIlwiO1xuICAgICAgICAgIGxldCBzZXJ2ZXJSZWFkeSA9IGZhbHNlO1xuICAgICAgICAgIGNvbnN0IHN0YXJ0dXBFcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgICBjb25zdCBjb2xsZWN0T3V0cHV0ID0gKGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGV4dCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHN0YXJ0dXBPdXRwdXQgKz0gdGV4dDtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlldzoke25hbWV9XSAke3RleHQudHJpbSgpfWApO1xuICAgICAgICAgICAgaWYgKC9yZWFkeXxWSVRFLipyZWFkeXxjb21waWxlZHxzdGFydGVkIHNlcnZlcnxsaXN0ZW5pbmd8TG9jYWw6L2kudGVzdCh0ZXh0KSkge1xuICAgICAgICAgICAgICBzZXJ2ZXJSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoL2Vycm9yfEVSUiF8Q2Fubm90IGZpbmR8TU9EVUxFX05PVF9GT1VORHxTeW50YXhFcnJvcnxFTk9FTlQvaS50ZXN0KHRleHQpKSB7XG4gICAgICAgICAgICAgIHN0YXJ0dXBFcnJvcnMucHVzaCh0ZXh0LnRyaW0oKS5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgY29sbGVjdE91dHB1dCk7XG4gICAgICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgY29sbGVjdE91dHB1dCk7XG5cbiAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLnNldChuYW1lLCB7IHByb2Nlc3M6IGNoaWxkLCBwb3J0IH0pO1xuXG4gICAgICAgICAgbGV0IGV4aXRlZCA9IGZhbHNlO1xuICAgICAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBlcnJvciBmb3IgJHtuYW1lfTpgLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY2hpbGQub24oXCJleGl0XCIsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDAgJiYgY29kZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBmb3IgJHtuYW1lfSBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc3QgbWF4V2FpdCA9IDE1MDAwO1xuICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgbWF4V2FpdCAmJiAhc2VydmVyUmVhZHkgJiYgIWV4aXRlZCkge1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDMwMCkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIGlmIChleGl0ZWQgJiYgIXNlcnZlclJlYWR5KSB7XG4gICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgICBzdGFydGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgZXJyb3I6IGBEZXYgc2VydmVyIGZhaWxlZCB0byBzdGFydC4gJHtzdGFydHVwRXJyb3JzLmpvaW4oXCIgfCBcIikuc2xpY2UoMCwgODAwKX1gLFxuICAgICAgICAgICAgICBvdXRwdXQ6IHN0YXJ0dXBPdXRwdXQuc2xpY2UoLTIwMDApLFxuICAgICAgICAgICAgICBkZXRlY3RlZENvbW1hbmQ6IGAke2RldkNtZC5jbWR9ICR7ZGV2Q21kLmFyZ3Muam9pbihcIiBcIil9YCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICAgIHN0YXJ0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHJlYWR5OiBzZXJ2ZXJSZWFkeSxcbiAgICAgICAgICAgICAgZGV0ZWN0ZWRDb21tYW5kOiBgJHtkZXZDbWQuY21kfSAke2RldkNtZC5hcmdzLmpvaW4oXCIgXCIpfWAsXG4gICAgICAgICAgICAgIHBhY2thZ2VNYW5hZ2VyOiBwbSxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9yZXN0YXJ0LXByZXZpZXdcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSB8fCAvW1xcL1xcXFxdfFxcLlxcLi8udGVzdChuYW1lKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgcmVzdGFydGVkOiBmYWxzZSwgcmVhc29uOiBcIk5vIGFjdGl2ZSBwcmV2aWV3XCIgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG9sZFBvcnQgPSBlbnRyeS5wb3J0O1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgIHRyeSB7IGV4ZWNTeW5jKGB0YXNra2lsbCAvcGlkICR7ZW50cnkucHJvY2Vzcy5waWR9IC9UIC9GYCwgeyBzdGRpbzogXCJwaXBlXCIgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7IHByb2Nlc3Mua2lsbCgtZW50cnkucHJvY2Vzcy5waWQsIFwiU0lHS0lMTFwiKTsgfSBjYXRjaCB7IHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR0tJTExcIik7IH0gY2F0Y2gge30gfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcblxuICAgICAgICAgIGNvbnN0IHdhaXRGb3JQb3J0RnJlZSA9IGFzeW5jIChwb3J0OiBudW1iZXIsIG1heFdhaXQ6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmV0ID0gYXdhaXQgaW1wb3J0KFwibmV0XCIpO1xuICAgICAgICAgICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydCA8IG1heFdhaXQpIHtcbiAgICAgICAgICAgICAgY29uc3QgaW5Vc2UgPSBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPihyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuICAgICAgICAgICAgICAgIHMub25jZShcImVycm9yXCIsICgpID0+IHJlc29sdmUodHJ1ZSkpO1xuICAgICAgICAgICAgICAgIHMub25jZShcImxpc3RlbmluZ1wiLCAoKSA9PiB7IHMuY2xvc2UoKTsgcmVzb2x2ZShmYWxzZSk7IH0pO1xuICAgICAgICAgICAgICAgIHMubGlzdGVuKHBvcnQsIFwiMC4wLjAuMFwiKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGlmICghaW5Vc2UpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMjAwKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCBwb3J0RnJlZSA9IGF3YWl0IHdhaXRGb3JQb3J0RnJlZShvbGRQb3J0LCAzMDAwKTtcbiAgICAgICAgICBpZiAoIXBvcnRGcmVlKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyByZXN0YXJ0ZWQ6IGZhbHNlLCByZWFzb246IFwiUG9ydCBzdGlsbCBpbiB1c2UgYWZ0ZXIgM3NcIiB9KSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIiwgbmFtZSk7XG4gICAgICAgICAgY29uc3QgeyBzcGF3biB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcblxuICAgICAgICAgIGxldCBwa2c6IGFueSA9IHt9O1xuICAgICAgICAgIGNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGtnUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBwa2cuc2NyaXB0cyB8fCB7fTtcbiAgICAgICAgICBjb25zdCBkZXBzID0geyAuLi4ocGtnLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihwa2cuZGV2RGVwZW5kZW5jaWVzIHx8IHt9KSB9O1xuXG4gICAgICAgICAgY29uc3QgZGV0ZWN0UE1SZXN0YXJ0ID0gKCk6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJidW4ubG9ja2JcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiYnVuLmxvY2tcIikpKSByZXR1cm4gXCJidW5cIjtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0tbG9jay55YW1sXCIpKSkgcmV0dXJuIFwicG5wbVwiO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwieWFybi5sb2NrXCIpKSkgcmV0dXJuIFwieWFyblwiO1xuICAgICAgICAgICAgcmV0dXJuIFwibnBtXCI7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCBwbVIgPSBkZXRlY3RQTVJlc3RhcnQoKTtcblxuICAgICAgICAgIGNvbnN0IHJlc3RhcnREZXRlY3QgPSAoKTogeyBjbWQ6IHN0cmluZzsgYXJnczogc3RyaW5nW10gfSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwb3J0U3RyID0gU3RyaW5nKG9sZFBvcnQpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hTY3JpcHQgPSAoc2NyaXB0Qm9keTogc3RyaW5nKTogeyBjbWQ6IHN0cmluZzsgYXJnczogc3RyaW5nW10gfSB8IG51bGwgPT4ge1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcIm5leHRcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJlYWN0LXNjcmlwdHNcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVhY3Qtc2NyaXB0c1wiLCBcInN0YXJ0XCJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwibnV4dFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiYXN0cm9cIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiYXN0cm9cIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJ3ZWJwYWNrXCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgd3BBcmdzID0gW1wid2VicGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBjZmdNID0gc2NyaXB0Qm9keS5tYXRjaCgvKD86LS1jb25maWdbPVxcc118LWNcXHMpKFxcUyspLyk7XG4gICAgICAgICAgICAgICAgaWYgKGNmZ00pIHdwQXJncy5zcGxpY2UoMiwgMCwgXCItLWNvbmZpZ1wiLCBjZmdNWzFdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IHdwQXJncyB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwicnNwYWNrXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJzcGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInN2ZWx0ZVwiKSB8fCBzY3JpcHRCb2R5LmluY2x1ZGVzKFwic3ZlbHRla2l0XCIpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJ2aXRlXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IGlzU3ZlbHRlS2l0ID0gZGVwc1tcIkBzdmVsdGVqcy9raXRcIl0gfHwgZGVwc1tcInN2ZWx0ZWtpdFwiXTtcbiAgICAgICAgICAgIGNvbnN0IGlzUG5wbU1vbm8gPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIikpO1xuICAgICAgICAgICAgaWYgKGlzUG5wbU1vbm8pIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoc2NyaXB0cykpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0c1trZXldLmluY2x1ZGVzKFwiLS1maWx0ZXJcIikgJiYgKGtleS5pbmNsdWRlcyhcImRldlwiKSB8fCBrZXkgPT09IFwibHA6ZGV2XCIpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwicG5wbVwiLCBhcmdzOiBbXCJydW5cIiwga2V5XSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNjcmlwdHMuZGV2KSB7XG4gICAgICAgICAgICAgIGlmIChpc1N2ZWx0ZUtpdCkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ2aXRlXCIsIFwiZGV2XCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBjb25zdCBtID0gbWF0Y2hTY3JpcHQoc2NyaXB0cy5kZXYpOyBpZiAobSkgcmV0dXJuIG07XG4gICAgICAgICAgICAgIHJldHVybiB7IGNtZDogcG1SID09PSBcIm5wbVwiID8gXCJucG1cIiA6IGBucHggJHtwbVJ9YCwgYXJnczogcG1SID09PSBcIm5wbVwiID8gW1wicnVuXCIsIFwiZGV2XCJdIDogW1wicnVuXCIsIFwiZGV2XCJdIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2NyaXB0cy5zdGFydCkgeyBjb25zdCBtID0gbWF0Y2hTY3JpcHQoc2NyaXB0cy5zdGFydCk7IGlmIChtKSByZXR1cm4gbTsgcmV0dXJuIHsgY21kOiBwbVIgPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtUn1gLCBhcmdzOiBwbVIgPT09IFwibnBtXCIgPyBbXCJydW5cIiwgXCJzdGFydFwiXSA6IFtcInJ1blwiLCBcInN0YXJ0XCJdIH07IH1cbiAgICAgICAgICAgIGlmIChzY3JpcHRzLnNlcnZlIHx8IHNjcmlwdHNbXCJzZXJ2ZTpyc3BhY2tcIl0pIHsgY29uc3QgcyA9IHNjcmlwdHMuc2VydmUgfHwgc2NyaXB0c1tcInNlcnZlOnJzcGFja1wiXTsgY29uc3QgbSA9IG1hdGNoU2NyaXB0KHMpOyBpZiAobSkgcmV0dXJuIG07IGNvbnN0IGsgPSBzY3JpcHRzLnNlcnZlID8gXCJzZXJ2ZVwiIDogXCJzZXJ2ZTpyc3BhY2tcIjsgcmV0dXJuIHsgY21kOiBwbVIgPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtUn1gLCBhcmdzOiBwbVIgPT09IFwibnBtXCIgPyBbXCJydW5cIiwga10gOiBbXCJydW5cIiwga10gfTsgfVxuICAgICAgICAgICAgaWYgKGRlcHNbXCJuZXh0XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm5leHRcIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wicmVhY3Qtc2NyaXB0c1wiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyZWFjdC1zY3JpcHRzXCIsIFwic3RhcnRcIl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wibnV4dFwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcImFzdHJvXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcImFzdHJvXCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIkBhbmd1bGFyL2NsaVwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJuZ1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyLCBcIi0tZGlzYWJsZS1ob3N0LWNoZWNrXCJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIkByZW1peC1ydW4vZGV2XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJlbWl4XCIsIFwidml0ZTpkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcImdhdHNieVwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJnYXRzYnlcIiwgXCJkZXZlbG9wXCIsIFwiLUhcIiwgXCIwLjAuMC4wXCIsIFwiLXBcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wid2VicGFjay1kZXYtc2VydmVyXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIndlYnBhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiQHJzcGFjay9jbGlcIl0gfHwgZGVwc1tcIkByc3BhY2svY29yZVwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyc3BhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wicGFyY2VsXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInBhcmNlbFwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChpc1N2ZWx0ZUtpdCkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ2aXRlXCIsIFwiZGV2XCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ2aXRlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgIH07XG4gICAgICAgICAgY29uc3QgcmVzdGFydENtZCA9IHJlc3RhcnREZXRlY3QoKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFJlc3RhcnRpbmcgJHtuYW1lfSB3aXRoOiAke3Jlc3RhcnRDbWQuY21kfSAke3Jlc3RhcnRDbWQuYXJncy5qb2luKFwiIFwiKX1gKTtcblxuICAgICAgICAgIGNvbnN0IGNoaWxkID0gc3Bhd24ocmVzdGFydENtZC5jbWQsIHJlc3RhcnRDbWQuYXJncywge1xuICAgICAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICAgICAgc3RkaW86IFwicGlwZVwiLFxuICAgICAgICAgICAgc2hlbGw6IHRydWUsXG4gICAgICAgICAgICBkZXRhY2hlZDogdHJ1ZSxcbiAgICAgICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgQlJPV1NFUjogXCJub25lXCIsIFBPUlQ6IFN0cmluZyhvbGRQb3J0KSwgSE9TVDogXCIwLjAuMC4wXCIsIEhPU1ROQU1FOiBcIjAuMC4wLjBcIiB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG5cbiAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLnNldChuYW1lLCB7IHByb2Nlc3M6IGNoaWxkLCBwb3J0OiBvbGRQb3J0IH0pO1xuXG4gICAgICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgKGQ6IEJ1ZmZlcikgPT4gY29uc29sZS5sb2coYFtQcmV2aWV3OiR7bmFtZX1dICR7ZC50b1N0cmluZygpLnRyaW0oKX1gKSk7XG4gICAgICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgKGQ6IEJ1ZmZlcikgPT4gY29uc29sZS5sb2coYFtQcmV2aWV3OiR7bmFtZX1dICR7ZC50b1N0cmluZygpLnRyaW0oKX1gKSk7XG5cbiAgICAgICAgICBjaGlsZC5vbihcImVycm9yXCIsIChlcnI6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW1ByZXZpZXddIFByb2Nlc3MgZXJyb3IgZm9yICR7bmFtZX06YCwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNoaWxkLm9uKFwiZXhpdFwiLCAoY29kZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IG51bGwgJiYgY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBmb3IgJHtuYW1lfSBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHJlc3RhcnRlZDogdHJ1ZSwgcG9ydDogb2xkUG9ydCB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9pbnN0YWxsLWRlcHNcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lLCBkZXBlbmRlbmNpZXMsIGRldkRlcGVuZGVuY2llcyB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUgfHwgL1tcXC9cXFxcXXxcXC5cXC4vLnRlc3QobmFtZSkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJJbnZhbGlkIHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBuYW1lKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJQcm9qZWN0IG5vdCBmb3VuZFwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBwa2dKc29uUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBhY2thZ2UuanNvblwiKTtcbiAgICAgICAgICBsZXQgcGtnSnNvblZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGtnSnNvblBhdGgpKSB7XG4gICAgICAgICAgICB0cnkgeyBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwa2dKc29uUGF0aCwgXCJ1dGYtOFwiKSk7IHBrZ0pzb25WYWxpZCA9IHRydWU7IH0gY2F0Y2gge31cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFwa2dKc29uVmFsaWQpIHtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGtnSnNvblBhdGgsIEpTT04uc3RyaW5naWZ5KHsgbmFtZSwgdmVyc2lvbjogXCIwLjAuMVwiLCBwcml2YXRlOiB0cnVlIH0sIG51bGwsIDIpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGNvbnN0IHsgZXhlYzogZXhlY0FzeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgIGNvbnN0IHZhbGlkUGtnID0gL14oQFthLXowLTkuXy1dK1xcLyk/W2EtejAtOS5fLV0rKEBbXlxcc10qKT8kLztcbiAgICAgICAgICBjb25zdCBub3RBUGtnID0gbmV3IFNldChbXCJucG1cIixcIm5weFwiLFwieWFyblwiLFwicG5wbVwiLFwiYnVuXCIsXCJub2RlXCIsXCJkZW5vXCIsXCJydW5cIixcImRldlwiLFwic3RhcnRcIixcImJ1aWxkXCIsXCJ0ZXN0XCIsXCJzZXJ2ZVwiLFwid2F0Y2hcIixcImxpbnRcIixcImRlcGxveVwiLFwicHJldmlld1wiLFwiaW5zdGFsbFwiLFwiYWRkXCIsXCJyZW1vdmVcIixcInVuaW5zdGFsbFwiLFwidXBkYXRlXCIsXCJpbml0XCIsXCJjcmVhdGVcIixcImNkXCIsXCJsc1wiLFwibWtkaXJcIixcInJtXCIsXCJjcFwiLFwibXZcIixcImNhdFwiLFwiZWNob1wiLFwidG91Y2hcIixcImdpdFwiLFwiY3VybFwiLFwid2dldFwiLFwidGhlblwiLFwiYW5kXCIsXCJvclwiLFwidGhlXCIsXCJhXCIsXCJhblwiLFwidG9cIixcImluXCIsXCJvZlwiLFwiZm9yXCIsXCJ3aXRoXCIsXCJmcm9tXCIsXCJ5b3VyXCIsXCJ0aGlzXCIsXCJ0aGF0XCIsXCJpdFwiLFwiaXNcIixcImFyZVwiLFwid2FzXCIsXCJiZVwiLFwiaGFzXCIsXCJoYXZlXCIsXCJkb1wiLFwiZG9lc1wiLFwiaWZcIixcIm5vdFwiLFwibm9cIixcInllc1wiLFwib25cIixcIm9mZlwiLFwidXBcIixcInNvXCIsXCJidXRcIixcImJ5XCIsXCJhdFwiLFwiYXNcIixcInNlcnZlclwiLFwiYXBwXCIsXCJhcHBsaWNhdGlvblwiLFwicHJvamVjdFwiLFwiZmlsZVwiLFwiZGlyZWN0b3J5XCIsXCJmb2xkZXJcIixcIm5leHRcIixcImZpcnN0XCIsXCJmb2xsb3dpbmdcIixcImFib3ZlXCIsXCJiZWxvd1wiLFwiYWZ0ZXJcIixcImJlZm9yZVwiLFwiYWxsXCIsXCJhbnlcIixcImVhY2hcIixcImV2ZXJ5XCIsXCJib3RoXCIsXCJuZXdcIixcIm9sZFwiXSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyUGtncyA9IChhcnI6IHN0cmluZ1tdKSA9PiAoYXJyIHx8IFtdKS5maWx0ZXIoKGQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKCF2YWxpZFBrZy50ZXN0KGQpIHx8IC9bOyZ8YCQoKXt9XS8udGVzdChkKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgYmFzZSA9IGQucmVwbGFjZSgvQFteXFxzXSokLywgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICByZXR1cm4gIW5vdEFQa2cuaGFzKGJhc2UpICYmIChiYXNlLmxlbmd0aCA+IDEgfHwgZC5zdGFydHNXaXRoKCdAJykpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnN0IHNhZmVEZXBzID0gZmlsdGVyUGtncyhkZXBlbmRlbmNpZXMgfHwgW10pO1xuICAgICAgICAgIGNvbnN0IHNhZmVEZXZEZXBzID0gZmlsdGVyUGtncyhkZXZEZXBlbmRlbmNpZXMgfHwgW10pO1xuXG4gICAgICAgICAgbGV0IHBtID0gXCJucG1cIjtcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJidW4ubG9ja2JcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiYnVuLmxvY2tcIikpKSBwbSA9IFwiYnVuXCI7XG4gICAgICAgICAgZWxzZSBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwbnBtLWxvY2sueWFtbFwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwbnBtLXdvcmtzcGFjZS55YW1sXCIpKSkgcG0gPSBcInBucG1cIjtcbiAgICAgICAgICBlbHNlIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInlhcm4ubG9ja1wiKSkpIHBtID0gXCJ5YXJuXCI7XG5cbiAgICAgICAgICBjb25zdCBidWlsZEluc3RhbGxDbWQgPSAocGtnczogc3RyaW5nW10sIGlzRGV2OiBib29sZWFuKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBrZ1N0ciA9IHBrZ3Muam9pbihcIiBcIik7XG4gICAgICAgICAgICBzd2l0Y2ggKHBtKSB7XG4gICAgICAgICAgICAgIGNhc2UgXCJidW5cIjogcmV0dXJuIGBucHggYnVuIGFkZCR7aXNEZXYgPyBcIiAtZFwiIDogXCJcIn0gJHtwa2dTdHJ9YDtcbiAgICAgICAgICAgICAgY2FzZSBcInBucG1cIjogcmV0dXJuIGBucHggcG5wbSBhZGQke2lzRGV2ID8gXCIgLURcIiA6IFwiXCJ9ICR7cGtnU3RyfWA7XG4gICAgICAgICAgICAgIGNhc2UgXCJ5YXJuXCI6IHJldHVybiBgbnB4IHlhcm4gYWRkJHtpc0RldiA/IFwiIC1EXCIgOiBcIlwifSAke3BrZ1N0cn1gO1xuICAgICAgICAgICAgICBkZWZhdWx0OiByZXR1cm4gYG5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyR7aXNEZXYgPyBcIiAtLXNhdmUtZGV2XCIgOiBcIlwifSAke3BrZ1N0cn1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgY29uc3QgcnVuSW5zdGFsbCA9IChwa2dzOiBzdHJpbmdbXSwgaXNEZXY6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+ID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjbWQgPSBidWlsZEluc3RhbGxDbWQocGtncywgaXNEZXYpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtEZXBzXSBSdW5uaW5nOiAke2NtZH0gaW4gJHtuYW1lfWApO1xuICAgICAgICAgICAgZXhlY0FzeW5jKGNtZCwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc2hlbGw6IHRydWUsIG1heEJ1ZmZlcjogMiAqIDEwMjQgKiAxMDI0IH0sIChlcnIsIF9zdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW0RlcHNdIEZhaWxlZDogJHtjbWR9YCwgc3RkZXJyPy5zbGljZSgwLCAzMDApIHx8IGVyci5tZXNzYWdlPy5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgICAgICBpZiAocG0gIT09IFwibnBtXCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG5wbUZhbGxiYWNrID0gYG5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyR7aXNEZXYgPyBcIiAtLXNhdmUtZGV2XCIgOiBcIlwifSAke3BrZ3Muam9pbihcIiBcIil9YDtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbRGVwc10gUmV0cnlpbmcgd2l0aCBucG06ICR7bnBtRmFsbGJhY2t9YCk7XG4gICAgICAgICAgICAgICAgICBleGVjQXN5bmMobnBtRmFsbGJhY2ssIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDIgKiAxMDI0ICogMTAyNCB9LCAoZXJyMikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyMikgZXJyb3JzLnB1c2goYEZhaWxlZDogQ29tbWFuZCBmYWlsZWQ6ICR7Y21kfWApO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goYEZhaWxlZDogQ29tbWFuZCBmYWlsZWQ6ICR7Y21kfWApO1xuICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgaWYgKHNhZmVEZXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkluc3RhbGwoc2FmZURlcHMsIGZhbHNlKTtcbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoID09PSAwKSByZXN1bHRzLnB1c2goYEluc3RhbGxlZDogJHtzYWZlRGVwcy5qb2luKFwiLCBcIil9YCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNhZmVEZXZEZXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXZFcnJvcnMgPSBlcnJvcnMubGVuZ3RoO1xuICAgICAgICAgICAgYXdhaXQgcnVuSW5zdGFsbChzYWZlRGV2RGVwcywgdHJ1ZSk7XG4gICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA9PT0gcHJldkVycm9ycykgcmVzdWx0cy5wdXNoKGBJbnN0YWxsZWQgZGV2OiAke3NhZmVEZXZEZXBzLmpvaW4oXCIsIFwiKX1gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICBjb25zdCBzdWNjZXNzID0gZXJyb3JzLmxlbmd0aCA9PT0gMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzcywgcmVzdWx0cywgZXJyb3JzIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3J1bi1jb21tYW5kXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgY29tbWFuZCB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIWNvbW1hbmQgfHwgdHlwZW9mIGNvbW1hbmQgIT09IFwic3RyaW5nXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJObyBjb21tYW5kIHNwZWNpZmllZFwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSB8fCBcIlwiKTtcbiAgICAgICAgICBpZiAoIWNoZWNrLnZhbGlkKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBjaGVjay5lcnJvciB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgYWxsb3dlZFByZWZpeGVzID0gW1xuICAgICAgICAgICAgXCJucG0gXCIsIFwibnB4IFwiLCBcInlhcm4gXCIsIFwicG5wbSBcIiwgXCJidW4gXCIsXG4gICAgICAgICAgICBcIm5vZGUgXCIsIFwiZGVubyBcIiwgXCJ0c2NcIiwgXCJ0c3ggXCIsXG4gICAgICAgICAgICBcImNvcmVwYWNrIFwiLCBcIm52bSBcIiwgXCJmbm0gXCIsXG4gICAgICAgICAgICBcIm1rZGlyIFwiLCBcImNwIFwiLCBcIm12IFwiLCBcInJtIFwiLCBcInRvdWNoIFwiLCBcImNhdCBcIiwgXCJscyBcIiwgXCJwd2RcIixcbiAgICAgICAgICAgIFwiY2htb2QgXCIsIFwiY2hvd24gXCIsIFwibG4gXCIsXG4gICAgICAgICAgICBcImdpdCBcIiwgXCJjdXJsIFwiLCBcIndnZXQgXCIsXG4gICAgICAgICAgICBcInB5dGhvblwiLCBcInBpcFwiLCBcImNhcmdvIFwiLCBcImdvIFwiLCBcInJ1c3RjXCIsIFwiZ2NjXCIsIFwiZysrXCIsIFwibWFrZVwiLFxuICAgICAgICAgICAgXCJkb2NrZXIgXCIsIFwiZG9ja2VyLWNvbXBvc2UgXCIsXG4gICAgICAgICAgXTtcbiAgICAgICAgICBjb25zdCB0cmltbWVkID0gY29tbWFuZC50cmltKCkucmVwbGFjZSgvXFxzKyNcXHMrLiokLywgJycpLnRyaW0oKTtcbiAgICAgICAgICBpZiAoL1tcXHJcXG5cXHgwMF0vLnRlc3QodHJpbW1lZCkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJDb250cm9sIGNoYXJhY3RlcnMgbm90IGFsbG93ZWQgaW4gY29tbWFuZHNcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgaWYgKC9eY3VybC1pbnN0YWxsOmh0dHBzPzpcXC9cXC8vaS50ZXN0KHRyaW1tZWQpKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRVcmwgPSB0cmltbWVkLnJlcGxhY2UoL15jdXJsLWluc3RhbGw6L2ksIFwiXCIpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IGNoZWNrLnJlc29sdmVkO1xuICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUHJvamVjdCBub3QgZm91bmRcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgICAgICBjb25zdCB7IGV4ZWM6IGV4ZWNBc3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3MgPSBhd2FpdCBpbXBvcnQoXCJvc1wiKTtcbiAgICAgICAgICAgICAgY29uc3QgaXNXaW4gPSBvcy5wbGF0Zm9ybSgpID09PSBcIndpbjMyXCI7XG5cbiAgICAgICAgICAgICAgY29uc3QgV0lOX05QTV9BTFRFUk5BVElWRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgICAgICAgXCJidW4uc2gvaW5zdGFsbFwiOiBcIm5wbSBpbnN0YWxsIC1nIGJ1blwiLFxuICAgICAgICAgICAgICAgIFwiZ2V0LnBucG0uaW8vaW5zdGFsbC5zaFwiOiBcIm5wbSBpbnN0YWxsIC1nIHBucG1cIixcbiAgICAgICAgICAgICAgICBcImluc3RhbGwucHl0aG9uLXBvZXRyeS5vcmdcIjogXCJwaXAgaW5zdGFsbCBwb2V0cnlcIixcbiAgICAgICAgICAgICAgICBcInJ1c3R1cC5yc1wiOiBcIndpbmdldCBpbnN0YWxsIFJ1c3RsYW5nLlJ1c3R1cFwiLFxuICAgICAgICAgICAgICAgIFwiZGVuby5sYW5kL2luc3RhbGwuc2hcIjogXCJucG0gaW5zdGFsbCAtZyBkZW5vXCIsXG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgaWYgKGlzV2luKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgd2luQWx0ID0gT2JqZWN0LmVudHJpZXMoV0lOX05QTV9BTFRFUk5BVElWRVMpLmZpbmQoKFtrXSkgPT4gc2NyaXB0VXJsLmluY2x1ZGVzKGspKTtcbiAgICAgICAgICAgICAgICBpZiAod2luQWx0KSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBhbHRDbWQgPSB3aW5BbHRbMV07XG4gICAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoYWx0Q21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzaGVsbDogdHJ1ZSwgbWF4QnVmZmVyOiAyICogMTAyNCAqIDEwMjQgfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgJHtlcnIubWVzc2FnZT8uc2xpY2UoMCwgNDAwKX0gKHJhbjogJHthbHRDbWR9KWAsIG91dHB1dDogKHN0ZG91dCB8fCBcIlwiKS5zbGljZSgwLCA0MDAwKSwgc3RkZXJyOiAoc3RkZXJyIHx8IFwiXCIpLnNsaWNlKDAsIDIwMDApIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIG91dHB1dDogYFdpbmRvd3MgYWx0ZXJuYXRpdmU6ICR7YWx0Q21kfVxcbiR7KHN0ZG91dCB8fCBcIlwiKS5zbGljZSgwLCA0MDAwKX1gIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHBzMVVybCA9IHNjcmlwdFVybC5yZXBsYWNlKC9cXC5zaCQvLCBcIi5wczFcIik7XG4gICAgICAgICAgICAgICAgbGV0IHVzZVBzU2NyaXB0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdHJ5IHsgY29uc3QgaGVhZCA9IGF3YWl0IGZldGNoKHBzMVVybCwgeyBtZXRob2Q6IFwiSEVBRFwiIH0pOyB1c2VQc1NjcmlwdCA9IGhlYWQub2s7IH0gY2F0Y2gge31cblxuICAgICAgICAgICAgICAgIGlmICh1c2VQc1NjcmlwdCkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcHNDbWQgPSBgaXJtICR7cHMxVXJsfSB8IGlleGA7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbmNvZGVkQ21kID0gQnVmZmVyLmZyb20ocHNDbWQsIFwidXRmMTZsZVwiKS50b1N0cmluZyhcImJhc2U2NFwiKTtcbiAgICAgICAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhgcG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1FeGVjdXRpb25Qb2xpY3kgQnlwYXNzIC1FbmNvZGVkQ29tbWFuZCAke2VuY29kZWRDbWR9YCwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc2hlbGw6IHRydWUsIG1heEJ1ZmZlcjogMiAqIDEwMjQgKiAxMDI0IH0sIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDUwMCksIG91dHB1dDogKHN0ZG91dCB8fCBcIlwiKS5zbGljZSgwLCA0MDAwKSwgc3RkZXJyOiAoc3RkZXJyIHx8IFwiXCIpLnNsaWNlKDAsIDIwMDApIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIG91dHB1dDogKHN0ZG91dCB8fCBcIlwiKS5zbGljZSgwLCA0MDAwKSB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goc2NyaXB0VXJsKTtcbiAgICAgICAgICAgICAgaWYgKCFyZXNwLm9rKSB7IHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGRvd25sb2FkIHNjcmlwdDogJHtyZXNwLnN0YXR1c30gJHtyZXNwLnN0YXR1c1RleHR9YCB9KSk7IHJldHVybjsgfVxuICAgICAgICAgICAgICBjb25zdCBzY3JpcHQgPSBhd2FpdCByZXNwLnRleHQoKTtcbiAgICAgICAgICAgICAgY29uc3QgdG1wU2NyaXB0ID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBgaW5zdGFsbC0ke0RhdGUubm93KCl9LnNoYCk7XG4gICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModG1wU2NyaXB0LCBzY3JpcHQsIHsgbW9kZTogMG83NTUgfSk7XG4gICAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgZXhlY0FzeW5jKGBiYXNoIFwiJHt0bXBTY3JpcHR9XCJgLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzaGVsbDogdHJ1ZSwgbWF4QnVmZmVyOiAyICogMTAyNCAqIDEwMjQsIGVudjogeyAuLi5wcm9jZXNzLmVudiwgQlVOX0lOU1RBTEw6IHByb2plY3REaXIsIENBUkdPX0hPTUU6IHByb2plY3REaXIsIFJVU1RVUF9IT01FOiBwcm9qZWN0RGlyIH0gfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7IGZzLnVubGlua1N5bmModG1wU2NyaXB0KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlPy5zbGljZSgwLCA1MDApLCBvdXRwdXQ6IChzdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCksIHN0ZGVycjogKHN0ZGVyciB8fCBcIlwiKS5zbGljZSgwLCAyMDAwKSB9KSk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApIH0pKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRldlNlcnZlclJlID0gL14oPzpucG1cXHMrKD86cnVuXFxzKyk/KD86ZGV2fHN0YXJ0KXx5YXJuXFxzKyg/OmRldnxzdGFydCl8cG5wbVxccysoPzpkZXZ8c3RhcnQpfGJ1blxccysoPzpkZXZ8c3RhcnQpfG5weFxccyt2aXRlKD86XFxzfCQpKS9pO1xuICAgICAgICAgIGlmIChkZXZTZXJ2ZXJSZS50ZXN0KHRyaW1tZWQpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiRGV2IHNlcnZlciBjb21tYW5kcyBzaG91bGQgdXNlIHRoZSBQcmV2aWV3IGJ1dHRvbiBpbnN0ZWFkXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBpc0FsbG93ZWQgPSBhbGxvd2VkUHJlZml4ZXMuc29tZShwID0+IHRyaW1tZWQuc3RhcnRzV2l0aChwKSkgfHwgdHJpbW1lZCA9PT0gXCJucG0gaW5zdGFsbFwiIHx8IHRyaW1tZWQgPT09IFwiY29yZXBhY2sgZW5hYmxlXCI7XG4gICAgICAgICAgaWYgKCFpc0FsbG93ZWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogYENvbW1hbmQgbm90IGFsbG93ZWQ6ICR7dHJpbW1lZC5zbGljZSgwLCA1MCl9YCB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGlmICgvWzsmfGAkKCl7fV0vLnRlc3QodHJpbW1lZCkpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiU2hlbGwgbWV0YWNoYXJhY3RlcnMgbm90IGFsbG93ZWRcIiB9KSk7IHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKC9cXC5cXC5bXFwvXFxcXF0vLnRlc3QodHJpbW1lZCkpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiUGF0aCB0cmF2ZXJzYWwgbm90IGFsbG93ZWRcIiB9KSk7IHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBjaGVjay5yZXNvbHZlZDtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9qZWN0IGRpcmVjdG9yeSBub3QgZm91bmQ6ICR7cHJvamVjdERpcn1gIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCB7IGV4ZWM6IGV4ZWNBc3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICBjb25zdCBvcyA9IGF3YWl0IGltcG9ydChcIm9zXCIpO1xuICAgICAgICAgIGNvbnN0IGlzV2luID0gb3MucGxhdGZvcm0oKSA9PT0gXCJ3aW4zMlwiO1xuICAgICAgICAgIGxldCBhY3R1YWxDbWQgPSB0cmltbWVkID09PSBcIm5wbSBpbnN0YWxsXCIgPyBcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwc1wiIDogdHJpbW1lZDtcblxuICAgICAgICAgIGNvbnN0IG5vZGVIYW5kbGVkID0gYXdhaXQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICgvXnJtXFxzKygtcmY/XFxzKyk/L2kudGVzdChhY3R1YWxDbWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBhY3R1YWxDbWQucmVwbGFjZSgvXnJtXFxzKygtcmY/XFxzKyk/L2ksIFwiXCIpLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgdCk7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRQYXRoLnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHsgcmVzdWx0cy5wdXNoKGBTa2lwcGVkIChvdXRzaWRlIHByb2plY3QpOiAke3R9YCk7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0YXJnZXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goYFJlbW92ZWQ6ICR7dH1gKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHsgcmVzdWx0cy5wdXNoKGBGYWlsZWQgdG8gcmVtb3ZlICR7dH06ICR7ZS5tZXNzYWdlfWApOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiByZXN1bHRzLmpvaW4oXCJcXG5cIikgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgvXm1rZGlyXFxzKygtcFxccyspPy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgICBjb25zdCBkaXIgPSBhY3R1YWxDbWQucmVwbGFjZSgvXm1rZGlyXFxzKygtcFxccyspPy9pLCBcIlwiKS50cmltKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGRpclBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZGlyKTtcbiAgICAgICAgICAgICAgaWYgKCFkaXJQYXRoLnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiIH07XG4gICAgICAgICAgICAgIHRyeSB7IGZzLm1rZGlyU3luYyhkaXJQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiBgQ3JlYXRlZDogJHtkaXJ9YCB9OyB9XG4gICAgICAgICAgICAgIGNhdGNoIChlOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlLm1lc3NhZ2UgfTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKC9edG91Y2hcXHMvaS50ZXN0KGFjdHVhbENtZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IGFjdHVhbENtZC5yZXBsYWNlKC9edG91Y2hcXHMrL2ksIFwiXCIpLnRyaW0oKTtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZmlsZSk7XG4gICAgICAgICAgICAgIGlmICghZmlsZVBhdGguc3RhcnRzV2l0aChwcm9qZWN0RGlyKSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIgfTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXIgPSBwYXRoLmRpcm5hbWUoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSBmcy5ta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGZpbGVQYXRoLCBcIlwiLCB7IGZsYWc6IFwiYVwiIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG91dHB1dDogYFRvdWNoZWQ6ICR7ZmlsZX1gIH07XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoL15jYXRcXHMvaS50ZXN0KGFjdHVhbENtZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IGFjdHVhbENtZC5yZXBsYWNlKC9eY2F0XFxzKy9pLCBcIlwiKS50cmltKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5yZXNvbHZlKHByb2plY3REaXIsIGZpbGUpO1xuICAgICAgICAgICAgICBpZiAoIWZpbGVQYXRoLnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiIH07XG4gICAgICAgICAgICAgIHRyeSB7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG91dHB1dDogZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCBcInV0Zi04XCIpLnNsaWNlKDAsIDQwMDApIH07IH1cbiAgICAgICAgICAgICAgY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoL15jcFxccy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgICBjb25zdCBhcmdzID0gYWN0dWFsQ21kLnJlcGxhY2UoL15jcFxccysoLXJcXHMrKT8vaSwgXCJcIikudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3JjID0gcGF0aC5yZXNvbHZlKHByb2plY3REaXIsIGFyZ3NbMF0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc3QgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgYXJnc1sxXSk7XG4gICAgICAgICAgICAgICAgaWYgKCFzcmMuc3RhcnRzV2l0aChwcm9qZWN0RGlyKSB8fCAhZGVzdC5zdGFydHNXaXRoKHByb2plY3REaXIpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUGF0aCBvdXRzaWRlIHByb2plY3RcIiB9O1xuICAgICAgICAgICAgICAgIHRyeSB7IGZzLmNwU3luYyhzcmMsIGRlc3QsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiBgQ29waWVkOiAke2FyZ3NbMF19IFx1MjE5MiAke2FyZ3NbMV19YCB9OyB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgvXm12XFxzL2kudGVzdChhY3R1YWxDbWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBhY3R1YWxDbWQucmVwbGFjZSgvXm12XFxzKy9pLCBcIlwiKS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzcmMgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgYXJnc1swXSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzdCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0RGlyLCBhcmdzWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAoIXNyYy5zdGFydHNXaXRoKHByb2plY3REaXIpIHx8ICFkZXN0LnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiIH07XG4gICAgICAgICAgICAgICAgdHJ5IHsgZnMucmVuYW1lU3luYyhzcmMsIGRlc3QpOyByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IGBNb3ZlZDogJHthcmdzWzBdfSBcdTIxOTIgJHthcmdzWzFdfWAgfTsgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlLm1lc3NhZ2UgfTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgaWYgKG5vZGVIYW5kbGVkKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkobm9kZUhhbmRsZWQpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaXNXaW4gJiYgL15jb3JlcGFja1xccy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgYWN0dWFsQ21kID0gYG5weCAke2FjdHVhbENtZH1gO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBleGVjQXN5bmMoYWN0dWFsQ21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogNjAwMDAsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0IH0sIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDUwMCksIG91dHB1dDogKHN0ZG91dCB8fCBcIlwiKS5zbGljZSgwLCA0MDAwKSwgc3RkZXJyOiAoc3RkZXJyIHx8IFwiXCIpLnNsaWNlKDAsIDIwMDApIH0pKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApIH0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICBjb25zdCBzdGRlcnIgPSBlcnIuc3RkZXJyID8gU3RyaW5nKGVyci5zdGRlcnIpLnNsaWNlKDAsIDIwMDApIDogXCJcIjtcbiAgICAgICAgICBjb25zdCBzdGRvdXQgPSBlcnIuc3Rkb3V0ID8gU3RyaW5nKGVyci5zdGRvdXQpLnNsaWNlKDAsIDIwMDApIDogXCJcIjtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZT8uc2xpY2UoMCwgNTAwKSwgb3V0cHV0OiBzdGRvdXQsIHN0ZGVyciB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9ncmFtcy9pbnN0YWxsXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgcHJvZ3JhbXMgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb2dyYW1zKSB8fCBwcm9ncmFtcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIk5vIHByb2dyYW1zIHNwZWNpZmllZFwiIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHByb2dyYW1zLmxlbmd0aCA+IDEwKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMDtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJUb28gbWFueSBwcm9ncmFtcyAobWF4IDEwKVwiIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgIGNvbnN0IGlzV2luID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiO1xuICAgICAgICAgIGNvbnN0IGlzTWFjID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIjtcblxuICAgICAgICAgIGNvbnN0IHByb2dyYW1JbnN0YWxsTWFwOiBSZWNvcmQ8c3RyaW5nLCB7IGNoZWNrOiBzdHJpbmc7IHdpbj86IHN0cmluZzsgbWFjPzogc3RyaW5nOyBsaW51eD86IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9PiA9IHtcbiAgICAgICAgICAgIFwiZysrXCI6IHsgY2hlY2s6IFwiZysrIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBtaW5ndyAteVwiLCBtYWM6IFwieGNvZGUtc2VsZWN0IC0taW5zdGFsbFwiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBnKytcIiwgbGFiZWw6IFwiRysrIChDKysgQ29tcGlsZXIpXCIgfSxcbiAgICAgICAgICAgIFwiZ2NjXCI6IHsgY2hlY2s6IFwiZ2NjIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBtaW5ndyAteVwiLCBtYWM6IFwieGNvZGUtc2VsZWN0IC0taW5zdGFsbFwiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBnY2NcIiwgbGFiZWw6IFwiR0NDIChDIENvbXBpbGVyKVwiIH0sXG4gICAgICAgICAgICBcImNsYW5nXCI6IHsgY2hlY2s6IFwiY2xhbmcgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIGxsdm0gLXlcIiwgbWFjOiBcInhjb2RlLXNlbGVjdCAtLWluc3RhbGxcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgY2xhbmdcIiwgbGFiZWw6IFwiQ2xhbmdcIiB9LFxuICAgICAgICAgICAgXCJjbWFrZVwiOiB7IGNoZWNrOiBcImNtYWtlIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBjbWFrZSAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIGNtYWtlXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGNtYWtlXCIsIGxhYmVsOiBcIkNNYWtlXCIgfSxcbiAgICAgICAgICAgIFwibWFrZVwiOiB7IGNoZWNrOiBcIm1ha2UgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIG1ha2UgLXlcIiwgbWFjOiBcInhjb2RlLXNlbGVjdCAtLWluc3RhbGxcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgbWFrZVwiLCBsYWJlbDogXCJNYWtlXCIgfSxcbiAgICAgICAgICAgIFwicHl0aG9uXCI6IHsgY2hlY2s6IFwicHl0aG9uMyAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgcHl0aG9uIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgcHl0aG9uM1wiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBweXRob24zXCIsIGxhYmVsOiBcIlB5dGhvbiAzXCIgfSxcbiAgICAgICAgICAgIFwicHl0aG9uM1wiOiB7IGNoZWNrOiBcInB5dGhvbjMgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIHB5dGhvbiAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIHB5dGhvbjNcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcHl0aG9uM1wiLCBsYWJlbDogXCJQeXRob24gM1wiIH0sXG4gICAgICAgICAgICBcInBpcFwiOiB7IGNoZWNrOiBcInBpcDMgLS12ZXJzaW9uXCIsIHdpbjogXCJweXRob24gLW0gZW5zdXJlcGlwXCIsIG1hYzogXCJweXRob24zIC1tIGVuc3VyZXBpcFwiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBweXRob24zLXBpcFwiLCBsYWJlbDogXCJQaXBcIiB9LFxuICAgICAgICAgICAgXCJwaXAzXCI6IHsgY2hlY2s6IFwicGlwMyAtLXZlcnNpb25cIiwgd2luOiBcInB5dGhvbiAtbSBlbnN1cmVwaXBcIiwgbWFjOiBcInB5dGhvbjMgLW0gZW5zdXJlcGlwXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHB5dGhvbjMtcGlwXCIsIGxhYmVsOiBcIlBpcCAzXCIgfSxcbiAgICAgICAgICAgIFwibm9kZVwiOiB7IGNoZWNrOiBcIm5vZGUgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIG5vZGVqcyAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIG5vZGVcIiwgbGludXg6IFwiY3VybCAtZnNTTCBodHRwczovL2RlYi5ub2Rlc291cmNlLmNvbS9zZXR1cF9sdHMueCB8IHN1ZG8gLUUgYmFzaCAtICYmIHN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IG5vZGVqc1wiLCBsYWJlbDogXCJOb2RlLmpzXCIgfSxcbiAgICAgICAgICAgIFwibm9kZWpzXCI6IHsgY2hlY2s6IFwibm9kZSAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgbm9kZWpzIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgbm9kZVwiLCBsaW51eDogXCJjdXJsIC1mc1NMIGh0dHBzOi8vZGViLm5vZGVzb3VyY2UuY29tL3NldHVwX2x0cy54IHwgc3VkbyAtRSBiYXNoIC0gJiYgc3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgbm9kZWpzXCIsIGxhYmVsOiBcIk5vZGUuanNcIiB9LFxuICAgICAgICAgICAgXCJub2RlLmpzXCI6IHsgY2hlY2s6IFwibm9kZSAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgbm9kZWpzIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgbm9kZVwiLCBsaW51eDogXCJjdXJsIC1mc1NMIGh0dHBzOi8vZGViLm5vZGVzb3VyY2UuY29tL3NldHVwX2x0cy54IHwgc3VkbyAtRSBiYXNoIC0gJiYgc3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgbm9kZWpzXCIsIGxhYmVsOiBcIk5vZGUuanNcIiB9LFxuICAgICAgICAgICAgXCJydXN0XCI6IHsgY2hlY2s6IFwicnVzdGMgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIHJ1c3QgLXlcIiwgbWFjOiBcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCIsIGxpbnV4OiBcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCIsIGxhYmVsOiBcIlJ1c3RcIiB9LFxuICAgICAgICAgICAgXCJydXN0Y1wiOiB7IGNoZWNrOiBcInJ1c3RjIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBydXN0IC15XCIsIG1hYzogXCJjdXJsIC0tcHJvdG8gJz1odHRwcycgLS10bHN2MS4yIC1zU2YgaHR0cHM6Ly9zaC5ydXN0dXAucnMgfCBzaCAtcyAtLSAteVwiLCBsaW51eDogXCJjdXJsIC0tcHJvdG8gJz1odHRwcycgLS10bHN2MS4yIC1zU2YgaHR0cHM6Ly9zaC5ydXN0dXAucnMgfCBzaCAtcyAtLSAteVwiLCBsYWJlbDogXCJSdXN0XCIgfSxcbiAgICAgICAgICAgIFwiY2FyZ29cIjogeyBjaGVjazogXCJjYXJnbyAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgcnVzdCAteVwiLCBtYWM6IFwiY3VybCAtLXByb3RvICc9aHR0cHMnIC0tdGxzdjEuMiAtc1NmIGh0dHBzOi8vc2gucnVzdHVwLnJzIHwgc2ggLXMgLS0gLXlcIiwgbGludXg6IFwiY3VybCAtLXByb3RvICc9aHR0cHMnIC0tdGxzdjEuMiAtc1NmIGh0dHBzOi8vc2gucnVzdHVwLnJzIHwgc2ggLXMgLS0gLXlcIiwgbGFiZWw6IFwiQ2FyZ28gKFJ1c3QpXCIgfSxcbiAgICAgICAgICAgIFwiZ29cIjogeyBjaGVjazogXCJnbyB2ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIGdvbGFuZyAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIGdvXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGdvbGFuZ1wiLCBsYWJlbDogXCJHb1wiIH0sXG4gICAgICAgICAgICBcImdvbGFuZ1wiOiB7IGNoZWNrOiBcImdvIHZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgZ29sYW5nIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgZ29cIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZ29sYW5nXCIsIGxhYmVsOiBcIkdvXCIgfSxcbiAgICAgICAgICAgIFwiamF2YVwiOiB7IGNoZWNrOiBcImphdmEgLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgb3BlbmpkayAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIG9wZW5qZGtcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZGVmYXVsdC1qZGtcIiwgbGFiZWw6IFwiSmF2YSAoSkRLKVwiIH0sXG4gICAgICAgICAgICBcImpka1wiOiB7IGNoZWNrOiBcImphdmEgLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgb3BlbmpkayAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIG9wZW5qZGtcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZGVmYXVsdC1qZGtcIiwgbGFiZWw6IFwiSmF2YSAoSkRLKVwiIH0sXG4gICAgICAgICAgICBcImRvY2tlclwiOiB7IGNoZWNrOiBcImRvY2tlciAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgZG9ja2VyLWRlc2t0b3AgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCAtLWNhc2sgZG9ja2VyXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGRvY2tlci5pb1wiLCBsYWJlbDogXCJEb2NrZXJcIiB9LFxuICAgICAgICAgICAgXCJnaXRcIjogeyBjaGVjazogXCJnaXQgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIGdpdCAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIGdpdFwiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBnaXRcIiwgbGFiZWw6IFwiR2l0XCIgfSxcbiAgICAgICAgICAgIFwiY3VybFwiOiB7IGNoZWNrOiBcImN1cmwgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIGN1cmwgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBjdXJsXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGN1cmxcIiwgbGFiZWw6IFwiY1VSTFwiIH0sXG4gICAgICAgICAgICBcIndnZXRcIjogeyBjaGVjazogXCJ3Z2V0IC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCB3Z2V0IC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgd2dldFwiLCBsaW51eDogXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSB3Z2V0XCIsIGxhYmVsOiBcIldnZXRcIiB9LFxuICAgICAgICAgICAgXCJmZm1wZWdcIjogeyBjaGVjazogXCJmZm1wZWcgLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgZmZtcGVnIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgZmZtcGVnXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGZmbXBlZ1wiLCBsYWJlbDogXCJGRm1wZWdcIiB9LFxuICAgICAgICAgICAgXCJpbWFnZW1hZ2lja1wiOiB7IGNoZWNrOiBcImNvbnZlcnQgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIGltYWdlbWFnaWNrIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgaW1hZ2VtYWdpY2tcIiwgbGludXg6IFwic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgaW1hZ2VtYWdpY2tcIiwgbGFiZWw6IFwiSW1hZ2VNYWdpY2tcIiB9LFxuICAgICAgICAgICAgXCJzcWxpdGUzXCI6IHsgY2hlY2s6IFwic3FsaXRlMyAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgc3FsaXRlIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgc3FsaXRlXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHNxbGl0ZTNcIiwgbGFiZWw6IFwiU1FMaXRlXCIgfSxcbiAgICAgICAgICAgIFwicG9zdGdyZXNxbFwiOiB7IGNoZWNrOiBcInBzcWwgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIHBvc3RncmVzcWwgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBwb3N0Z3Jlc3FsXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHBvc3RncmVzcWxcIiwgbGFiZWw6IFwiUG9zdGdyZVNRTFwiIH0sXG4gICAgICAgICAgICBcInJlZGlzXCI6IHsgY2hlY2s6IFwicmVkaXMtc2VydmVyIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCByZWRpcyAteVwiLCBtYWM6IFwiYnJldyBpbnN0YWxsIHJlZGlzXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHJlZGlzLXNlcnZlclwiLCBsYWJlbDogXCJSZWRpc1wiIH0sXG4gICAgICAgICAgICBcImRlbm9cIjogeyBjaGVjazogXCJkZW5vIC0tdmVyc2lvblwiLCB3aW46IFwiY2hvY28gaW5zdGFsbCBkZW5vIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgZGVub1wiLCBsaW51eDogXCJjdXJsIC1mc1NMIGh0dHBzOi8vZGVuby5sYW5kL2luc3RhbGwuc2ggfCBzaFwiLCBsYWJlbDogXCJEZW5vXCIgfSxcbiAgICAgICAgICAgIFwiYnVuXCI6IHsgY2hlY2s6IFwiYnVuIC0tdmVyc2lvblwiLCB3aW46IFwicG93ZXJzaGVsbCAtYyBcXFwiaXJtIGJ1bi5zaC9pbnN0YWxsLnBzMXxpZXhcXFwiXCIsIG1hYzogXCJjdXJsIC1mc1NMIGh0dHBzOi8vYnVuLnNoL2luc3RhbGwgfCBiYXNoXCIsIGxpbnV4OiBcImN1cmwgLWZzU0wgaHR0cHM6Ly9idW4uc2gvaW5zdGFsbCB8IGJhc2hcIiwgbGFiZWw6IFwiQnVuXCIgfSxcbiAgICAgICAgICAgIFwicnVieVwiOiB7IGNoZWNrOiBcInJ1YnkgLS12ZXJzaW9uXCIsIHdpbjogXCJjaG9jbyBpbnN0YWxsIHJ1YnkgLXlcIiwgbWFjOiBcImJyZXcgaW5zdGFsbCBydWJ5XCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHJ1YnlcIiwgbGFiZWw6IFwiUnVieVwiIH0sXG4gICAgICAgICAgICBcInBocFwiOiB7IGNoZWNrOiBcInBocCAtLXZlcnNpb25cIiwgd2luOiBcImNob2NvIGluc3RhbGwgcGhwIC15XCIsIG1hYzogXCJicmV3IGluc3RhbGwgcGhwXCIsIGxpbnV4OiBcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHBocFwiLCBsYWJlbDogXCJQSFBcIiB9LFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCByZXN1bHRzOiB7IHByb2dyYW06IHN0cmluZzsgbGFiZWw6IHN0cmluZzsgYWxyZWFkeUluc3RhbGxlZDogYm9vbGVhbjsgaW5zdGFsbGVkOiBib29sZWFuOyBlcnJvcj86IHN0cmluZzsgY29tbWFuZD86IHN0cmluZyB9W10gPSBbXTtcblxuICAgICAgICAgIGZvciAoY29uc3QgcHJvZyBvZiBwcm9ncmFtcykge1xuICAgICAgICAgICAgY29uc3Qga2V5ID0gcHJvZy50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05LitdL2csIFwiXCIpO1xuICAgICAgICAgICAgY29uc3QgbWFwcGluZyA9IHByb2dyYW1JbnN0YWxsTWFwW2tleV07XG4gICAgICAgICAgICBpZiAoIW1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvZ3JhbTogcHJvZywgbGFiZWw6IHByb2csIGFscmVhZHlJbnN0YWxsZWQ6IGZhbHNlLCBpbnN0YWxsZWQ6IGZhbHNlLCBlcnJvcjogYFVua25vd24gcHJvZ3JhbTogJHtwcm9nfWAgfSk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgYWxyZWFkeUluc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZXhlY1N5bmMobWFwcGluZy5jaGVjaywgeyB0aW1lb3V0OiAxMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgYWxyZWFkeUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIGlmIChhbHJlYWR5SW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IHByb2dyYW06IHByb2csIGxhYmVsOiBtYXBwaW5nLmxhYmVsLCBhbHJlYWR5SW5zdGFsbGVkOiB0cnVlLCBpbnN0YWxsZWQ6IHRydWUgfSk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kID0gaXNXaW4gPyBtYXBwaW5nLndpbiA6IGlzTWFjID8gbWFwcGluZy5tYWMgOiBtYXBwaW5nLmxpbnV4O1xuICAgICAgICAgICAgaWYgKCFpbnN0YWxsQ21kKSB7XG4gICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IHByb2dyYW06IHByb2csIGxhYmVsOiBtYXBwaW5nLmxhYmVsLCBhbHJlYWR5SW5zdGFsbGVkOiBmYWxzZSwgaW5zdGFsbGVkOiBmYWxzZSwgZXJyb3I6IGBObyBpbnN0YWxsIGNvbW1hbmQgZm9yIHRoaXMgcGxhdGZvcm1gIH0pO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZXhlY1N5bmMoaW5zdGFsbENtZCwgeyB0aW1lb3V0OiAxMjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7XG4gICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IHByb2dyYW06IHByb2csIGxhYmVsOiBtYXBwaW5nLmxhYmVsLCBhbHJlYWR5SW5zdGFsbGVkOiBmYWxzZSwgaW5zdGFsbGVkOiB0cnVlLCBjb21tYW5kOiBpbnN0YWxsQ21kIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvZ3JhbTogcHJvZywgbGFiZWw6IG1hcHBpbmcubGFiZWwsIGFscmVhZHlJbnN0YWxsZWQ6IGZhbHNlLCBpbnN0YWxsZWQ6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDIwMCksIGNvbW1hbmQ6IGluc3RhbGxDbWQgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgY29uc3QgYWxsT2sgPSByZXN1bHRzLmV2ZXJ5KHIgPT4gci5pbnN0YWxsZWQgfHwgci5hbHJlYWR5SW5zdGFsbGVkKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogYWxsT2ssIHJlc3VsdHMgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvaW1wb3J0LWdpdGh1YlwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG93bmVyLCByZXBvIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghb3duZXIgfHwgIXJlcG8gfHwgL1tcXC9cXFxcXXxcXC5cXC4vLnRlc3Qob3duZXIpIHx8IC9bXFwvXFxcXF18XFwuXFwuLy50ZXN0KHJlcG8pKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkludmFsaWQgb3duZXIgb3IgcmVwb1wiIH0pKTsgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgeyBleGVjU3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICBjb25zdCBvcyA9IGF3YWl0IGltcG9ydChcIm9zXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIik7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3RzRGlyKSkgZnMubWtkaXJTeW5jKHByb2plY3RzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgICAgIGNvbnN0IHByb2plY3ROYW1lID0gcmVwby50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05LV0vZywgJy0nKTtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RzRGlyLCBwcm9qZWN0TmFtZSk7XG5cbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDk7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBQcm9qZWN0ICcke3Byb2plY3ROYW1lfScgYWxyZWFkeSBleGlzdHMuIERlbGV0ZSBpdCBmaXJzdCBvciB1c2UgYSBkaWZmZXJlbnQgbmFtZS5gIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBnaFRva2VuID0gcHJvY2Vzcy5lbnYuR0lUSFVCX1RPS0VOIHx8IFwiXCI7XG4gICAgICAgICAgY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgXCJVc2VyLUFnZW50XCI6IFwiR3VhcmRpYW4tQUlcIiB9O1xuICAgICAgICAgIGlmIChnaFRva2VuKSBoZWFkZXJzW1wiQXV0aG9yaXphdGlvblwiXSA9IGB0b2tlbiAke2doVG9rZW59YDtcblxuICAgICAgICAgIGNvbnN0IGluZm9SZXNwID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvJHtvd25lcn0vJHtyZXBvfWAsIHsgaGVhZGVyczogeyAuLi5oZWFkZXJzLCBcIkFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMranNvblwiIH0gfSk7XG4gICAgICAgICAgaWYgKCFpbmZvUmVzcC5vaykge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHVzID0gaW5mb1Jlc3Auc3RhdHVzO1xuICAgICAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDA0KSB7IHJlcy5zdGF0dXNDb2RlID0gNDA0OyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBSZXBvc2l0b3J5ICR7b3duZXJ9LyR7cmVwb30gbm90IGZvdW5kIG9yIGlzIHByaXZhdGVgIH0pKTsgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc3RhdHVzID09PSA0MDMpIHsgcmVzLnN0YXR1c0NvZGUgPSA0Mjk7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJHaXRIdWIgQVBJIHJhdGUgbGltaXQgZXhjZWVkZWQuIFRyeSBhZ2FpbiBsYXRlci5cIiB9KSk7IH1cbiAgICAgICAgICAgIGVsc2UgeyByZXMuc3RhdHVzQ29kZSA9IDUwMjsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBgR2l0SHViIEFQSSBlcnJvcjogJHtzdGF0dXN9YCB9KSk7IH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcmVwb0luZm86IGFueSA9IGF3YWl0IGluZm9SZXNwLmpzb24oKTtcbiAgICAgICAgICBjb25zdCBkZWZhdWx0QnJhbmNoID0gcmVwb0luZm8uZGVmYXVsdF9icmFuY2ggfHwgXCJtYWluXCI7XG5cbiAgICAgICAgICBjb25zdCBNQVhfVEFSQkFMTF9TSVpFID0gMjAwICogMTAyNCAqIDEwMjQ7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIERvd25sb2FkaW5nIHRhcmJhbGwgZm9yICR7b3duZXJ9LyR7cmVwb30gKGJyYW5jaDogJHtkZWZhdWx0QnJhbmNofSkuLi5gKTtcbiAgICAgICAgICBjb25zdCB0YXJiYWxsVXJsID0gYGh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvJHtvd25lcn0vJHtyZXBvfS90YXJiYWxsLyR7ZW5jb2RlVVJJQ29tcG9uZW50KGRlZmF1bHRCcmFuY2gpfWA7XG4gICAgICAgICAgY29uc3QgdGFyUmVzcCA9IGF3YWl0IGZldGNoKHRhcmJhbGxVcmwsIHsgaGVhZGVyczogeyAuLi5oZWFkZXJzLCBcIkFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMranNvblwiIH0sIHJlZGlyZWN0OiBcImZvbGxvd1wiIH0pO1xuICAgICAgICAgIGlmICghdGFyUmVzcC5vaykge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDI7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBGYWlsZWQgdG8gZG93bmxvYWQgdGFyYmFsbDogJHt0YXJSZXNwLnN0YXR1c31gIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gcGFyc2VJbnQodGFyUmVzcC5oZWFkZXJzLmdldChcImNvbnRlbnQtbGVuZ3RoXCIpIHx8IFwiMFwiLCAxMCk7XG4gICAgICAgICAgaWYgKGNvbnRlbnRMZW5ndGggPiBNQVhfVEFSQkFMTF9TSVpFKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQxMztcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogYFJlcG9zaXRvcnkgdG9vIGxhcmdlICgkeyhjb250ZW50TGVuZ3RoIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMCl9TUIpLiBNYXggaXMgJHtNQVhfVEFSQkFMTF9TSVpFIC8gMTAyNCAvIDEwMjR9TUIuYCB9KSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdG1wRGlyID0gZnMubWtkdGVtcFN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBcImd1YXJkaWFuLWltcG9ydC1cIikpO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgdGFyUGF0aCA9IHBhdGguam9pbih0bXBEaXIsIFwicmVwby50YXIuZ3pcIik7XG5cbiAgICAgICAgICBjb25zdCBhcnJheUJ1ZiA9IGF3YWl0IHRhclJlc3AuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgICBpZiAoYXJyYXlCdWYuYnl0ZUxlbmd0aCA+IE1BWF9UQVJCQUxMX1NJWkUpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDEzO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBgUmVwb3NpdG9yeSB0b28gbGFyZ2UgKCR7KGFycmF5QnVmLmJ5dGVMZW5ndGggLyAxMDI0IC8gMTAyNCkudG9GaXhlZCgwKX1NQikuIE1heCBpcyAke01BWF9UQVJCQUxMX1NJWkUgLyAxMDI0IC8gMTAyNH1NQi5gIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh0YXJQYXRoLCBCdWZmZXIuZnJvbShhcnJheUJ1ZikpO1xuICAgICAgICAgIGNvbnN0IHRhclNpemUgPSBmcy5zdGF0U3luYyh0YXJQYXRoKS5zaXplO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBUYXJiYWxsIGRvd25sb2FkZWQ6ICR7KHRhclNpemUgLyAxMDI0IC8gMTAyNCkudG9GaXhlZCgxKX1NQmApO1xuXG4gICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBleGVjU3luYyhgdGFyIHh6ZiBcIiR7dGFyUGF0aH1cIiAtLXN0cmlwLWNvbXBvbmVudHM9MSAtQyBcIiR7cHJvamVjdERpcn1cImAsIHsgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiB9KTtcbiAgICAgICAgICB9IGNhdGNoICh0YXJFcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZXh0cmFjdCB0YXJiYWxsOiAke3RhckVyci5tZXNzYWdlPy5zbGljZSgwLCAyMDApfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRXh0cmFjdGVkIHRhcmJhbGwgdG8gJHtwcm9qZWN0RGlyfWApO1xuXG4gICAgICAgICAgY29uc3QgQ0xFQU5VUF9QQVRURVJOUyA9IFtcIm5vZGVfbW9kdWxlc1wiLCBcIi5naXRcIiwgXCIubmV4dFwiLCBcIi5udXh0XCIsIFwiZGlzdFwiLCBcIi5jYWNoZVwiLCBcIi50dXJib1wiLCBcIi52ZXJjZWxcIiwgXCIub3V0cHV0XCJdO1xuICAgICAgICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBDTEVBTlVQX1BBVFRFUk5TKSB7XG4gICAgICAgICAgICBjb25zdCBjbGVhblBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgcGF0dGVybik7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhjbGVhblBhdGgpKSB7XG4gICAgICAgICAgICAgIHRyeSB7IGZzLnJtU3luYyhjbGVhblBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB3YWxrQW5kQ2xlYW4gPSAoZGlyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmdWxsID0gcGF0aC5qb2luKGRpciwgZW50cnkubmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChlbnRyeS5uYW1lID09PSBcIm5vZGVfbW9kdWxlc1wiIHx8IGVudHJ5Lm5hbWUgPT09IFwiLmdpdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGZzLnJtU3luYyhmdWxsLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHdhbGtBbmRDbGVhbihmdWxsKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5Lm5hbWUgPT09IFwiLkRTX1N0b3JlXCIpIHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7IGZzLnVubGlua1N5bmMoZnVsbCk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICB9O1xuICAgICAgICAgIHdhbGtBbmRDbGVhbihwcm9qZWN0RGlyKTtcblxuICAgICAgICAgIGxldCBmaWxlc1dyaXR0ZW4gPSAwO1xuICAgICAgICAgIGNvbnN0IGNvdW50RmlsZXMgPSAoZGlyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkgY291bnRGaWxlcyhwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKSk7XG4gICAgICAgICAgICAgICAgZWxzZSBmaWxlc1dyaXR0ZW4rKztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH07XG4gICAgICAgICAgY291bnRGaWxlcyhwcm9qZWN0RGlyKTtcblxuICAgICAgICAgIGxldCBmcmFtZXdvcmsgPSBcInZhbmlsbGFcIjtcbiAgICAgICAgICBjb25zdCBwa2dQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBrZ1BhdGgpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBwa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwa2dQYXRoLCBcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgY29uc3QgZGVwcyA9IHsgLi4uKHBrZy5kZXBlbmRlbmNpZXMgfHwge30pLCAuLi4ocGtnLmRldkRlcGVuZGVuY2llcyB8fCB7fSkgfTtcbiAgICAgICAgICAgICAgaWYgKGRlcHNbXCJuZXh0XCJdKSBmcmFtZXdvcmsgPSBcIm5leHRqc1wiO1xuICAgICAgICAgICAgICBlbHNlIGlmIChkZXBzW1wibnV4dFwiXSB8fCBkZXBzW1wibnV4dDNcIl0pIGZyYW1ld29yayA9IFwibnV4dFwiO1xuICAgICAgICAgICAgICBlbHNlIGlmIChkZXBzW1wiQGFuZ3VsYXIvY29yZVwiXSkgZnJhbWV3b3JrID0gXCJhbmd1bGFyXCI7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGRlcHNbXCJzdmVsdGVcIl0gfHwgZGVwc1tcIkBzdmVsdGVqcy9raXRcIl0pIGZyYW1ld29yayA9IFwic3ZlbHRlXCI7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGRlcHNbXCJhc3Ryb1wiXSkgZnJhbWV3b3JrID0gXCJhc3Ryb1wiO1xuICAgICAgICAgICAgICBlbHNlIGlmIChkZXBzW1widnVlXCJdKSBmcmFtZXdvcmsgPSBcInZ1ZVwiO1xuICAgICAgICAgICAgICBlbHNlIGlmIChkZXBzW1wicmVhY3RcIl0pIGZyYW1ld29yayA9IFwicmVhY3RcIjtcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgbnBtSW5zdGFsbGVkID0gZmFsc2U7XG4gICAgICAgICAgbGV0IGluc3RhbGxFcnJvciA9IFwiXCI7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGtnUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGRldGVjdFBNID0gKCk6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImJ1bi5sb2NrYlwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJidW4ubG9ja1wiKSkpIHJldHVybiBcImJ1blwiO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwbnBtLWxvY2sueWFtbFwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwbnBtLXdvcmtzcGFjZS55YW1sXCIpKSkgcmV0dXJuIFwicG5wbVwiO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ5YXJuLmxvY2tcIikpKSByZXR1cm4gXCJ5YXJuXCI7XG4gICAgICAgICAgICAgIHJldHVybiBcIm5wbVwiO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IGRldGVjdGVkUE0gPSBkZXRlY3RQTSgpO1xuXG4gICAgICAgICAgICBsZXQgaXNNb25vcmVwbyA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgcGtnID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGtnUGF0aCwgXCJ1dGYtOFwiKSk7XG4gICAgICAgICAgICAgIGlmIChwa2cud29ya3NwYWNlcyB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwibGVybmEuanNvblwiKSkpIHtcbiAgICAgICAgICAgICAgICBpc01vbm9yZXBvID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kID0gZGV0ZWN0ZWRQTSA9PT0gXCJwbnBtXCIgPyBcIm5weCBwbnBtIGluc3RhbGwgLS1uby1mcm96ZW4tbG9ja2ZpbGUgLS1pZ25vcmUtc2NyaXB0c1wiXG4gICAgICAgICAgICAgIDogZGV0ZWN0ZWRQTSA9PT0gXCJ5YXJuXCIgPyBcIm5weCB5YXJuIGluc3RhbGwgLS1pZ25vcmUtZW5naW5lcyAtLWlnbm9yZS1zY3JpcHRzXCJcbiAgICAgICAgICAgICAgOiBkZXRlY3RlZFBNID09PSBcImJ1blwiID8gXCJucHggYnVuIGluc3RhbGwgLS1pZ25vcmUtc2NyaXB0c1wiXG4gICAgICAgICAgICAgIDogXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHMgLS1pZ25vcmUtc2NyaXB0c1wiO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gSW5zdGFsbGluZyBkZXBzIGZvciAke3Byb2plY3ROYW1lfSB3aXRoOiAke2luc3RhbGxDbWR9IChwbTogJHtkZXRlY3RlZFBNfSwgbW9ub3JlcG86ICR7aXNNb25vcmVwb30pYCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBleGVjU3luYyhpbnN0YWxsQ21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTgwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICBucG1JbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRGVwcyBpbnN0YWxsZWQgZm9yICR7cHJvamVjdE5hbWV9YCk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVidWlsZENtZCA9IGRldGVjdGVkUE0gPT09IFwicG5wbVwiID8gXCJucHggcG5wbSByZWJ1aWxkXCIgOiBkZXRlY3RlZFBNID09PSBcInlhcm5cIiA/IFwibnB4IHlhcm4gcmVidWlsZFwiIDogXCJucG0gcmVidWlsZFwiO1xuICAgICAgICAgICAgICAgIGV4ZWNTeW5jKHJlYnVpbGRDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIE5hdGl2ZSBtb2R1bGVzIHJlYnVpbHQgZm9yICR7cHJvamVjdE5hbWV9YCk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKHJlYnVpbGRFcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBSZWJ1aWxkIHNraXBwZWQvZmFpbGVkIGZvciAke3Byb2plY3ROYW1lfSAobm9uLWNyaXRpY2FsKWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChpbnN0YWxsRXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgaW5zdGFsbEVycm9yID0gaW5zdGFsbEVyci5zdGRlcnI/LnRvU3RyaW5nKCkuc2xpY2UoLTUwMCkgfHwgaW5zdGFsbEVyci5tZXNzYWdlPy5zbGljZSgwLCA1MDApIHx8IFwiVW5rbm93biBlcnJvclwiO1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbSW1wb3J0XSBJbnN0YWxsIGZhaWxlZCBmb3IgJHtwcm9qZWN0TmFtZX0gd2l0aCAke2RldGVjdGVkUE19OmAsIGluc3RhbGxFcnJvci5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgICAgaWYgKGRldGVjdGVkUE0gIT09IFwibnBtXCIpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIFJldHJ5aW5nIHdpdGggbnBtIGZvciAke3Byb2plY3ROYW1lfWApO1xuICAgICAgICAgICAgICAgICAgZXhlY1N5bmMoXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHMgLS1pZ25vcmUtc2NyaXB0c1wiLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTgwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgbnBtSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGluc3RhbGxFcnJvciA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRGVwcyBpbnN0YWxsZWQgZm9yICR7cHJvamVjdE5hbWV9IChucG0gZmFsbGJhY2spYCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAocmV0cnlFcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgaW5zdGFsbEVycm9yID0gcmV0cnlFcnIuc3RkZXJyPy50b1N0cmluZygpLnNsaWNlKC0zMDApIHx8IHJldHJ5RXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDMwMCkgfHwgXCJSZXRyeSBmYWlsZWRcIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBwcm9qZWN0TmFtZSxcbiAgICAgICAgICAgIGZyYW1ld29yayxcbiAgICAgICAgICAgIGZpbGVzV3JpdHRlbixcbiAgICAgICAgICAgIG5wbUluc3RhbGxlZCxcbiAgICAgICAgICAgIHNvdXJjZVJlcG86IGBodHRwczovL2dpdGh1Yi5jb20vJHtvd25lcn0vJHtyZXBvfWAsXG4gICAgICAgICAgICBkZWZhdWx0QnJhbmNoLFxuICAgICAgICAgICAgLi4uKGluc3RhbGxFcnJvciA/IHsgaW5zdGFsbEVycm9yOiBpbnN0YWxsRXJyb3Iuc2xpY2UoMCwgNTAwKSB9IDoge30pLFxuICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKHRtcERpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgbGV0IGFjdGl2ZVByZXZpZXdQb3J0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAgICAgY29uc3QgcHJveHlUb1ByZXZpZXcgPSBhc3luYyAocmVxOiBhbnksIHJlczogYW55LCBwb3J0OiBudW1iZXIsIHRhcmdldFBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCBodHRwID0gYXdhaXQgaW1wb3J0KFwiaHR0cFwiKTtcbiAgICAgICAgY29uc3QgcHJveHlSZXEgPSBodHRwLnJlcXVlc3QoXG4gICAgICAgICAge1xuICAgICAgICAgICAgaG9zdG5hbWU6IFwiMTI3LjAuMC4xXCIsXG4gICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgcGF0aDogdGFyZ2V0UGF0aCxcbiAgICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ucmVxLmhlYWRlcnMsIGhvc3Q6IGBsb2NhbGhvc3Q6JHtwb3J0fWAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIChwcm94eVJlcykgPT4ge1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZChwcm94eVJlcy5zdGF0dXNDb2RlIHx8IDIwMCwgcHJveHlSZXMuaGVhZGVycyk7XG4gICAgICAgICAgICBwcm94eVJlcy5waXBlKHJlcywgeyBlbmQ6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICBwcm94eVJlcS5vbihcImVycm9yXCIsICgpID0+IHtcbiAgICAgICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkgeyByZXMuc3RhdHVzQ29kZSA9IDUwMjsgcmVzLmVuZChcIlByZXZpZXcgc2VydmVyIG5vdCByZXNwb25kaW5nXCIpOyB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXEucGlwZShwcm94eVJlcSwgeyBlbmQ6IHRydWUgfSk7XG4gICAgICB9O1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL19fcHJldmlld1wiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSByZXEudXJsPy5tYXRjaCgvXlxcLyhcXGQrKShcXC8uKik/JC8pIHx8IHJlcS51cmw/Lm1hdGNoKC9eXFwvX19wcmV2aWV3XFwvKFxcZCspKFxcLy4qKT8kLyk7XG4gICAgICAgIGlmICghbWF0Y2gpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoXCJJbnZhbGlkIHByZXZpZXcgVVJMXCIpOyByZXR1cm47IH1cbiAgICAgICAgY29uc3QgcG9ydCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBtYXRjaFsyXSB8fCBcIi9cIjtcblxuICAgICAgICBpZiAocG9ydCA8IDUxMDAgfHwgcG9ydCA+IDUyMDApIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoXCJQb3J0IG91dCBvZiBwcmV2aWV3IHJhbmdlXCIpOyByZXR1cm47IH1cblxuICAgICAgICBhY3RpdmVQcmV2aWV3UG9ydCA9IHBvcnQ7XG4gICAgICAgIGF3YWl0IHByb3h5VG9QcmV2aWV3KHJlcSwgcmVzLCBwb3J0LCB0YXJnZXRQYXRoKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBQUkVWSUVXX0FTU0VUX1BSRUZJWEVTID0gW1wiL19uZXh0L1wiLCBcIi9fX25leHRqc1wiLCBcIi9fX3ZpdGVcIiwgXCIvQHZpdGUvXCIsIFwiL0BpZC9cIiwgXCIvQGZzL1wiLCBcIi9ub2RlX21vZHVsZXMvXCIsIFwiL3NyYy9cIiwgXCIvZmF2aWNvbi5pY29cIiwgXCIvb3BlbmdyYXBoLWltYWdlXCIsIFwiL2FwcGxlLXRvdWNoLWljb25cIiwgXCIvbWFuaWZlc3QuanNvblwiLCBcIi9zdy5qc1wiLCBcIi93b3JrYm94LVwiLCBcIi9zdGF0aWMvXCIsIFwiL3NvY2tqcy1ub2RlL1wiLCBcIi9idWlsZC9cIiwgXCIvX2Fzc2V0cy9cIiwgXCIvYXNzZXRzL1wiLCBcIi9wdWJsaWMvXCIsIFwiL3BvbHlmaWxsc1wiLCBcIi8udml0ZS9cIiwgXCIvaG1yXCIsIFwiL19fd2VicGFja19obXJcIl07XG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICBpZiAoIWFjdGl2ZVByZXZpZXdQb3J0IHx8ICFyZXEudXJsKSB7IG5leHQoKTsgcmV0dXJuOyB9XG4gICAgICAgIGNvbnN0IHNob3VsZFByb3h5ID0gUFJFVklFV19BU1NFVF9QUkVGSVhFUy5zb21lKHAgPT4gcmVxLnVybCEuc3RhcnRzV2l0aChwKSk7XG4gICAgICAgIGlmICghc2hvdWxkUHJveHkpIHsgbmV4dCgpOyByZXR1cm47IH1cbiAgICAgICAgYXdhaXQgcHJveHlUb1ByZXZpZXcocmVxLCByZXMsIGFjdGl2ZVByZXZpZXdQb3J0LCByZXEudXJsKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9wcmV2aWV3LWluZm9cIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgY29uc3QgcmVwbGl0RG9tYWluID0gcHJvY2Vzcy5lbnYuUkVQTElUX0RFVl9ET01BSU4gfHwgXCJcIjtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3h5VXJsID0gYC9fX3ByZXZpZXcvJHtlbnRyeS5wb3J0fS9gO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHJ1bm5pbmc6IHRydWUsIHBvcnQ6IGVudHJ5LnBvcnQsIHByb3h5VXJsLCByZXBsaXREb21haW4gfSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgcnVubmluZzogZmFsc2UgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3N0b3AtcHJldmlld1wiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG5hbWUgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgY29uc3QgZW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHBpZCA9IGVudHJ5LnByb2Nlc3MucGlkO1xuICAgICAgICAgICAgdHJ5IHsgcHJvY2Vzcy5raWxsKC1waWQsIDkpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICB0cnkgeyBlbnRyeS5wcm9jZXNzLmtpbGwoXCJTSUdLSUxMXCIpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgICAgICBjb25zdCBraWxsUG9ydCA9IGFzeW5jIChwb3J0OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXRUY3AgPSBmcy5yZWFkRmlsZVN5bmMoXCIvcHJvYy9uZXQvdGNwXCIsIFwidXRmLThcIikgKyBmcy5yZWFkRmlsZVN5bmMoXCIvcHJvYy9uZXQvdGNwNlwiLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRIZXggPSBwb3J0LnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpLnBhZFN0YXJ0KDQsIFwiMFwiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IG5ldFRjcC5zcGxpdChcIlxcblwiKS5maWx0ZXIoKGw6IHN0cmluZykgPT4gbC5pbmNsdWRlcyhgOiR7cG9ydEhleH0gYCkpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgICAgY29uc3QgY29scyA9IGxpbmUudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBpbm9kZSA9IGNvbHNbOV07XG4gICAgICAgICAgICAgICAgICBpZiAoIWlub2RlIHx8IGlub2RlID09PSBcIjBcIikgY29udGludWU7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwcm9jRGlycyA9IGZzLnJlYWRkaXJTeW5jKFwiL3Byb2NcIikuZmlsdGVyKChkOiBzdHJpbmcpID0+IC9eXFxkKyQvLnRlc3QoZCkpO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwIG9mIHByb2NEaXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmRzID0gZnMucmVhZGRpclN5bmMoYC9wcm9jLyR7cH0vZmRgKTtcbiAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZkIG9mIGZkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLnJlYWRsaW5rU3luYyhgL3Byb2MvJHtwfS9mZC8ke2ZkfWApID09PSBgc29ja2V0Olske2lub2RlfV1gKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgcHJvY2Vzcy5raWxsKC1wYXJzZUludChwKSwgOSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBwcm9jZXNzLmtpbGwocGFyc2VJbnQocCksIDkpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIGF3YWl0IGtpbGxQb3J0KGVudHJ5LnBvcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgaWYgKGFjdGl2ZVByZXZpZXdQb3J0ID09PSBlbnRyeS5wb3J0KSBhY3RpdmVQcmV2aWV3UG9ydCA9IG51bGw7XG4gICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN0b3BwZWQ6IHRydWUgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBzb3VyY2VEb3dubG9hZFBsdWdpbigpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwic291cmNlLWRvd25sb2FkXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvZG93bmxvYWQtc291cmNlXCIsIGFzeW5jIChfcmVxLCByZXMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBhcmNoaXZlciA9IChhd2FpdCBpbXBvcnQoXCJhcmNoaXZlclwiKSkuZGVmYXVsdDtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHByb2Nlc3MuY3dkKCk7XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vemlwXCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LURpc3Bvc2l0aW9uXCIsIFwiYXR0YWNobWVudDsgZmlsZW5hbWU9bGFtYmRhLXJlY3Vyc2l2ZS1zb3VyY2UuemlwXCIpO1xuXG4gICAgICAgICAgY29uc3QgYXJjaGl2ZSA9IGFyY2hpdmVyKFwiemlwXCIsIHsgemxpYjogeyBsZXZlbDogOSB9IH0pO1xuICAgICAgICAgIGFyY2hpdmUucGlwZShyZXMpO1xuXG4gICAgICAgICAgY29uc3QgaW5jbHVkZURpcnMgPSBbXCJzcmNcIiwgXCJwdWJsaWNcIiwgXCJzdXBhYmFzZVwiLCBcImVsZWN0cm9uLWJyb3dzZXJcIl07XG4gICAgICAgICAgY29uc3QgaW5jbHVkZUZpbGVzID0gW1xuICAgICAgICAgICAgXCJwYWNrYWdlLmpzb25cIiwgXCJwYWNrYWdlLWxvY2suanNvblwiLCBcInRzY29uZmlnLmpzb25cIiwgXCJ0c2NvbmZpZy5hcHAuanNvblwiLFxuICAgICAgICAgICAgXCJ0c2NvbmZpZy5ub2RlLmpzb25cIiwgXCJ2aXRlLmNvbmZpZy50c1wiLCBcInRhaWx3aW5kLmNvbmZpZy50c1wiLCBcInBvc3Rjc3MuY29uZmlnLmpzXCIsXG4gICAgICAgICAgICBcImluZGV4Lmh0bWxcIiwgXCJlc2xpbnQuY29uZmlnLmpzXCIsIFwiLmVudlwiLCBcIi5lbnYuZXhhbXBsZVwiLCBcInJlcGxpdC5tZFwiLFxuICAgICAgICAgICAgXCJjb21wb25lbnRzLmpzb25cIlxuICAgICAgICAgIF07XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiBpbmNsdWRlRGlycykge1xuICAgICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGRpclBhdGggPSBwYXRoLmpvaW4ocHJvamVjdFJvb3QsIGRpcik7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhkaXJQYXRoKSkge1xuICAgICAgICAgICAgICBhcmNoaXZlLmRpcmVjdG9yeShkaXJQYXRoLCBkaXIsIChlbnRyeSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlbnRyeS5uYW1lLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzXCIpIHx8IGVudHJ5Lm5hbWUuaW5jbHVkZXMoXCIuY2FjaGVcIikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW50cnk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBpbmNsdWRlRmlsZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihwcm9qZWN0Um9vdCwgZmlsZSk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhmaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgYXJjaGl2ZS5maWxlKGZpbGVQYXRoLCB7IG5hbWU6IGZpbGUgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXdhaXQgYXJjaGl2ZS5maW5hbGl6ZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRG93bmxvYWQgc291cmNlIGVycm9yOlwiLCBlcnIpO1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoXCJGYWlsZWQgdG8gY3JlYXRlIHNvdXJjZSBhcmNoaXZlXCIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCIwLjAuMC4wXCIsXG4gICAgcG9ydDogNTAwMCxcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiBmYWxzZSxcbiAgICB9LFxuICAgIHdhdGNoOiB7XG4gICAgICBpZ25vcmVkOiBbXCIqKi9wcm9qZWN0cy8qKlwiLCBcIioqLy5sb2NhbC8qKlwiLCBcIioqL25vZGVfbW9kdWxlcy8qKlwiLCBcIioqLy5jYWNoZS8qKlwiXSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBmaWxlV3JpdGVQbHVnaW4oKSxcbiAgICBwcm9qZWN0TWFuYWdlbWVudFBsdWdpbigpLFxuICAgIHNvdXJjZURvd25sb2FkUGx1Z2luKCksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgaW5jbHVkZUFzc2V0czogW1wiZmF2aWNvbi5pY29cIiwgXCJwd2EtaWNvbi01MTIucG5nXCJdLFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFsvXlxcL35vYXV0aC9dLFxuICAgICAgICBnbG9iUGF0dGVybnM6IFtcIioqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfVwiXSxcbiAgICAgIH0sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiBcIlx1MDNCQiBSZWN1cnNpdmUgXHUyMDE0IFNlbGYtUmVmZXJlbnRpYWwgSURFXCIsXG4gICAgICAgIHNob3J0X25hbWU6IFwiXHUwM0JCIFJlY3Vyc2l2ZVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJBIHNlbGYtcmVjdXJzaXZlIGRldmVsb3BtZW50IGVudmlyb25tZW50IHdpdGggQUktcG93ZXJlZCBjb2RlIGV2b2x1dGlvblwiLFxuICAgICAgICB0aGVtZV9jb2xvcjogXCIjMGEwYTBhXCIsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzBhMGEwYVwiLFxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcbiAgICAgICAgc2NvcGU6IFwiL1wiLFxuICAgICAgICBzdGFydF91cmw6IFwiL1wiLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogXCJwd2EtaWNvbi01MTIucG5nXCIsXG4gICAgICAgICAgICBzaXplczogXCI1MTJ4NTEyXCIsXG4gICAgICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxuICAgICAgICAgICAgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXS5maWx0ZXIoQm9vbGVhbiksXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgfSxcbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1AsU0FBUyxvQkFBaUM7QUFDOVIsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLGVBQWU7QUFIeEIsSUFBTSxtQ0FBbUM7QUFLekMsU0FBUyxrQkFBMEI7QUFDakMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUksbUJBQW1CLE9BQU8sS0FBSyxRQUFRO0FBQzVELFlBQUksSUFBSSxXQUFXLFFBQVE7QUFBRSxjQUFJLGFBQWE7QUFBSyxjQUFJLElBQUksb0JBQW9CO0FBQUc7QUFBQSxRQUFRO0FBQzFGLFlBQUk7QUFDRixjQUFJLE9BQU87QUFDWCwyQkFBaUIsU0FBUyxJQUFLLFNBQVE7QUFDdkMsZ0JBQU0sRUFBRSxVQUFVLFFBQVEsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUM3QyxjQUFJLENBQUMsWUFBWSxPQUFPLFlBQVksVUFBVTtBQUFFLGdCQUFJLGFBQWE7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O0FBQ2pGLHVCQUFPO0FBQUEsY0FDVCxDQUFDO0FBQUEsWUFDSDtBQUFBLFVBQ0Y7QUFFQSxxQkFBVyxRQUFRLGNBQWM7QUFDL0Isa0JBQU0sS0FBSyxNQUFNLE9BQU8sSUFBSTtBQUM1QixrQkFBTSxXQUFXLEtBQUssS0FBSyxhQUFhLElBQUk7QUFDNUMsZ0JBQUksR0FBRyxXQUFXLFFBQVEsR0FBRztBQUMzQixzQkFBUSxLQUFLLFVBQVUsRUFBRSxNQUFNLEtBQUssQ0FBQztBQUFBLFlBQ3ZDO0FBQUEsVUFDRjtBQUVBLGdCQUFNLFFBQVEsU0FBUztBQUFBLFFBQ3pCLFNBQVMsS0FBSztBQUNaLGtCQUFRLE1BQU0sMEJBQTBCLEdBQUc7QUFDM0MsY0FBSSxhQUFhO0FBQ2pCLGNBQUksSUFBSSxpQ0FBaUM7QUFBQSxRQUMzQztBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQSxJQUNkLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsa0JBQWtCLGdCQUFnQixzQkFBc0IsY0FBYztBQUFBLElBQ2xGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sZ0JBQWdCO0FBQUEsSUFDaEIsd0JBQXdCO0FBQUEsSUFDeEIscUJBQXFCO0FBQUEsSUFDckIsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGVBQWUsa0JBQWtCO0FBQUEsTUFDakQsU0FBUztBQUFBLFFBQ1AsMEJBQTBCLENBQUMsV0FBVztBQUFBLFFBQ3RDLGNBQWMsQ0FBQyxzQ0FBc0M7QUFBQSxNQUN2RDtBQUFBLE1BQ0EsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QsT0FBTztBQUFBLFFBQ1AsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLFNBQVM7QUFBQSxVQUNYO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNILEVBQUUsT0FBTyxPQUFPO0FBQUEsRUFDaEIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbImV4ZWNTeW5jIiwgImlzUG5wbU1vbm9yZXBvIiwgImZzIiwgInByb2plY3REaXIiLCAiZXhlY0FzeW5jIiwgIm9zIiwgImlzV2luIl0KfQo=
