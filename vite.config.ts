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

      server.middlewares.use("/api/projects/files", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }

          function walkDir(dir: string, base: string): any[] {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const result: any[] = [];
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
      let nextPreviewPort = 5100;

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
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ port: existing.port, reused: true }));
            return;
          }

          const port = nextPreviewPort++;
          const { spawn } = await import("child_process");

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
              execSync(installCmd, { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true });
              console.log(`[Preview] Deps installed for ${name}`);
            } catch (installErr: any) {
              console.error(`[Preview] Install failed for ${name}:`, installErr.message?.slice(0, 300));
              try {
                const { execSync } = await import("child_process");
                console.log(`[Preview] Retrying with npm for ${name}`);
                execSync("npm install --legacy-peer-deps", { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true });
              } catch (retryErr: any) {
                console.error(`[Preview] Retry also failed for ${name}:`, retryErr.message?.slice(0, 300));
              }
            }
          }

          const detectDevCommand = (): { cmd: string; args: string[] } => {
            const scripts = pkg.scripts || {};
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

            if (scripts.dev) {
              const devScript = scripts.dev;
              if (devScript.includes("next")) {
                return { cmd: "npx", args: ["next", "dev", "--port", String(port)] };
              }
              if (devScript.includes("vite")) {
                return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
              }
              if (devScript.includes("react-scripts")) {
                return { cmd: "npx", args: ["react-scripts", "start"] };
              }
              if (devScript.includes("webpack")) {
                return { cmd: "npx", args: ["webpack", "serve", "--port", String(port)] };
              }
              if (devScript.includes("nuxt")) {
                return { cmd: "npx", args: ["nuxt", "dev", "--port", String(port)] };
              }
              if (devScript.includes("astro")) {
                return { cmd: "npx", args: ["astro", "dev", "--port", String(port)] };
              }
              if (devScript.includes("svelte") || devScript.includes("sveltekit")) {
                return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
              }
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }

            if (scripts.start) {
              const startScript = scripts.start;
              if (startScript.includes("react-scripts")) {
                return { cmd: "npx", args: ["react-scripts", "start"] };
              }
              if (startScript.includes("next")) {
                return { cmd: "npx", args: ["next", "dev", "--port", String(port)] };
              }
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "start"] : ["run", "start"] };
            }

            if (deps["next"]) return { cmd: "npx", args: ["next", "dev", "--port", String(port)] };
            if (deps["react-scripts"]) return { cmd: "npx", args: ["react-scripts", "start"] };
            if (deps["nuxt"]) return { cmd: "npx", args: ["nuxt", "dev", "--port", String(port)] };
            if (deps["astro"]) return { cmd: "npx", args: ["astro", "dev", "--port", String(port)] };

            if (fs.existsSync(path.join(projectDir, "vite.config.ts")) || fs.existsSync(path.join(projectDir, "vite.config.js")) || fs.existsSync(path.join(projectDir, "vite.config.mjs"))) {
              return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
            }

            return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
          };

          const devCmd = detectDevCommand();
          console.log(`[Preview] Starting ${name} with: ${devCmd.cmd} ${devCmd.args.join(" ")}`);

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

          for (const cfgName of ["vite.config.ts", "vite.config.js", "vite.config.mjs"]) {
            const viteConfigPath = path.join(projectDir, cfgName);
            if (fs.existsSync(viteConfigPath)) {
              const viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");
              if (!viteConfigContent.includes("usePolling")) {
                const patched = viteConfigContent.replace(
                  /defineConfig\(\{/,
                  `defineConfig({\n  server: {\n    watch: {\n      usePolling: true,\n      interval: 500,\n    },\n  },`
                );
                if (patched !== viteConfigContent) {
                  fs.writeFileSync(viteConfigPath, patched, "utf-8");
                  console.log(`[Preview] Patched ${name}/${cfgName} with usePolling`);
                }
              }
              break;
            }
          }

          const portEnv: Record<string, string> = {
            ...process.env as Record<string, string>,
            BROWSER: "none",
            PORT: String(port),
          };

          const isReactScripts = devCmd.args.includes("react-scripts");
          if (isReactScripts) {
            portEnv.PORT = String(port);
            portEnv.HOST = "0.0.0.0";
          }

          const isNextDev = devCmd.args.includes("next");
          if (isNextDev) {
            portEnv.HOSTNAME = "0.0.0.0";
          }

          const child = spawn(devCmd.cmd, devCmd.args, {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: false,
            env: portEnv,
          });

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

          res.setHeader("Content-Type", "application/json");
          if (exited && !serverReady) {
            previewProcesses.delete(name);
            res.end(JSON.stringify({
              port,
              started: false,
              error: `Dev server failed to start. ${startupErrors.join(" | ").slice(0, 800)}`,
              output: startupOutput.slice(-2000),
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
            }));
          } else {
            res.end(JSON.stringify({
              port,
              started: true,
              ready: serverReady,
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              packageManager: pm,
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
              try { execSync(`taskkill /pid ${entry.process.pid} /T /F`, { stdio: "pipe" }); } catch {}
            } else {
              try { process.kill(-entry.process.pid, "SIGTERM"); } catch { try { entry.process.kill("SIGTERM"); } catch {} }
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

          let devCmd = "npx";
          let devArgs = ["vite", "--host", "0.0.0.0", "--port", String(oldPort)];
          if (scripts.dev) {
            if (scripts.dev.includes("next")) { devCmd = "npx"; devArgs = ["next", "dev", "--port", String(oldPort)]; }
            else if (scripts.dev.includes("react-scripts")) { devCmd = "npx"; devArgs = ["react-scripts", "start"]; }
            else if (scripts.dev.includes("vite")) { devCmd = "npx"; devArgs = ["vite", "--host", "0.0.0.0", "--port", String(oldPort)]; }
            else if (scripts.dev.includes("nuxt")) { devCmd = "npx"; devArgs = ["nuxt", "dev", "--port", String(oldPort)]; }
            else if (scripts.dev.includes("astro")) { devCmd = "npx"; devArgs = ["astro", "dev", "--port", String(oldPort)]; }
            else { devCmd = pmR === "npm" ? "npm" : `npx ${pmR}`; devArgs = pmR === "npm" ? ["run", "dev"] : ["run", "dev"]; }
          } else if (scripts.start) {
            if (scripts.start.includes("react-scripts")) { devCmd = "npx"; devArgs = ["react-scripts", "start"]; }
            else if (scripts.start.includes("next")) { devCmd = "npx"; devArgs = ["next", "dev", "--port", String(oldPort)]; }
            else { devCmd = pmR === "npm" ? "npm" : `npx ${pmR}`; devArgs = pmR === "npm" ? ["run", "start"] : ["run", "start"]; }
          } else if (deps["next"]) { devCmd = "npx"; devArgs = ["next", "dev", "--port", String(oldPort)]; }
          else if (deps["react-scripts"]) { devCmd = "npx"; devArgs = ["react-scripts", "start"]; }
          else if (deps["nuxt"]) { devCmd = "npx"; devArgs = ["nuxt", "dev", "--port", String(oldPort)]; }
          else if (deps["astro"]) { devCmd = "npx"; devArgs = ["astro", "dev", "--port", String(oldPort)]; }

          const child = spawn(devCmd, devArgs, {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: false,
            env: { ...process.env, BROWSER: "none", PORT: String(oldPort), HOST: "0.0.0.0", HOSTNAME: "0.0.0.0" },
          });

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

          const errors: string[] = [];
          const runInstall = (cmd: string): Promise<void> => new Promise((resolve) => {
            execAsync(cmd, { cwd: projectDir, timeout: 60000, shell: true, maxBuffer: 1024 * 1024 }, (err, _stdout, _stderr) => {
              if (err) errors.push(`Failed: ${err.message?.slice(0, 300)}`);
              resolve();
            });
          });

          if (safeDeps.length > 0) {
            await runInstall(`npm install --legacy-peer-deps ${safeDeps.join(" ")}`);
            if (errors.length === 0) results.push(`Installed: ${safeDeps.join(", ")}`);
          }

          if (safeDevDeps.length > 0) {
            const prevErrors = errors.length;
            await runInstall(`npm install --legacy-peer-deps --save-dev ${safeDevDeps.join(" ")}`);
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
                    execAsync(altCmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
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
                    execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCmd}`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
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
                execAsync(`bash "${tmpScript}"`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, BUN_INSTALL: projectDir, CARGO_HOME: projectDir, RUSTUP_HOME: projectDir } }, (err, stdout, stderr) => {
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
            execAsync(actualCmd, { cwd: projectDir, timeout: 60000, shell: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
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
              execSync(mapping.check, { timeout: 10000, stdio: "pipe", shell: true });
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
              execSync(installCmd, { timeout: 120000, stdio: "pipe", shell: true });
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
          const { owner, repo } = JSON.parse(await readBody(req));
          if (!owner || !repo || /[\/\\]|\.\./.test(owner) || /[\/\\]|\.\./.test(repo)) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid owner or repo" })); return;
          }

          const fs = await import("fs");
          const { execSync } = await import("child_process");
          const os = await import("os");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

          const projectName = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          const projectDir = path.resolve(projectsDir, projectName);

          if (fs.existsSync(projectDir)) {
            res.statusCode = 409;
            res.end(JSON.stringify({ error: `Project '${projectName}' already exists. Delete it first or use a different name.` }));
            return;
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
            execSync(`tar xzf "${tarPath}" --strip-components=1 -C "${projectDir}"`, { timeout: 60000, stdio: "pipe" });
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
              execSync(installCmd, { cwd: projectDir, timeout: 180000, stdio: "pipe", shell: true });
              npmInstalled = true;
              console.log(`[Import] Deps installed for ${projectName}`);
            } catch (installErr: any) {
              installError = installErr.stderr?.toString().slice(-500) || installErr.message?.slice(0, 500) || "Unknown error";
              console.error(`[Import] Install failed for ${projectName} with ${detectedPM}:`, installError.slice(0, 300));
              if (detectedPM !== "npm") {
                try {
                  console.log(`[Import] Retrying with npm for ${projectName}`);
                  execSync("npm install --legacy-peer-deps --ignore-scripts", { cwd: projectDir, timeout: 180000, stdio: "pipe", shell: true });
                  npmInstalled = true;
                  installError = "";
                  console.log(`[Import] Deps installed for ${projectName} (npm fallback)`);
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

        let isValidPort = false;
        for (const [, entry] of previewProcesses) {
          if (entry.port === port) { isValidPort = true; break; }
        }
        if (!isValidPort) { res.statusCode = 404; res.end("No preview running on this port"); return; }

        activePreviewPort = port;
        await proxyToPreview(req, res, port, targetPath);
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
            try {
              if (process.platform === "win32") {
                const { execSync } = await import("child_process");
                execSync(`taskkill /pid ${entry.process.pid} /T /F`, { stdio: "pipe" });
              } else {
                entry.process.kill("SIGTERM");
              }
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
