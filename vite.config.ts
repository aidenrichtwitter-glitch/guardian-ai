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
          fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });

          const scaffoldFiles: Record<string, string> = {
            "package.json": JSON.stringify({
              name,
              version: "0.0.1",
              private: true,
              description,
              _framework: framework,
              scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
              dependencies: framework === "react" ? { react: "^18.3.1", "react-dom": "^18.3.1" } : {},
              devDependencies: framework === "react"
                ? { "@vitejs/plugin-react-swc": "^3.7.0", vite: "^5.4.0", "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0", typescript: "^5.5.0" }
                : { vite: "^5.4.0", typescript: "^5.5.0" },
            }, null, 2),
            "index.html": framework === "react"
              ? `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${name}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>`
              : `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${name}</title>\n</head>\n<body>\n  <div id="app"></div>\n  <script type="module" src="/src/main.ts"></script>\n</body>\n</html>`,
            "vite.config.ts": framework === "react"
              ? `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react-swc";\n\nexport default defineConfig({\n  plugins: [react()],\n});`
              : `import { defineConfig } from "vite";\n\nexport default defineConfig({});`,
            "tsconfig.json": JSON.stringify({
              compilerOptions: {
                target: "ES2020",
                useDefineForClassFields: true,
                lib: ["ES2020", "DOM", "DOM.Iterable"],
                module: "ESNext",
                skipLibCheck: true,
                moduleResolution: "bundler",
                allowImportingTsExtensions: true,
                isolatedModules: true,
                moduleDetection: "force",
                noEmit: true,
                jsx: framework === "react" ? "react-jsx" : undefined,
                strict: true,
              },
              include: ["src"],
            }, null, 2),
          };

          if (framework === "react") {
            scaffoldFiles["src/main.tsx"] = `import { createRoot } from "react-dom/client";\n\nfunction App() {\n  return <div><h1>${name}</h1><p>Welcome to your new project!</p></div>;\n}\n\ncreateRoot(document.getElementById("root")!).render(<App />);`;
          } else {
            scaffoldFiles["src/main.ts"] = `document.getElementById("app")!.innerHTML = "<h1>${name}</h1><p>Welcome to your new project!</p>";`;
          }

          for (const [filePath, content] of Object.entries(scaffoldFiles)) {
            const fullPath = path.join(projectDir, filePath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, content, "utf-8");
          }

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

          if (hasPkg && !hasNodeModules) {
            try {
              const { execSync } = await import("child_process");
              execSync("npm install", { cwd: projectDir, timeout: 30000, stdio: "pipe", shell: true });
            } catch {}
          }

          const child = spawn("npx", ["vite", "--host", "0.0.0.0", "--port", String(port)], {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: false,
            env: { ...process.env, BROWSER: "none" },
          });

          previewProcesses.set(name, { process: child, port });

          child.on("error", (err: any) => {
            console.error(`Preview process error for ${name}:`, err.message);
            previewProcesses.delete(name);
          });

          child.on("exit", (code: number | null) => {
            if (code !== 0 && code !== null) {
              console.error(`Preview process for ${name} exited with code ${code}`);
            }
            previewProcesses.delete(name);
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ port, started: true }));
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

          const child = spawn("npx", ["vite", "--host", "0.0.0.0", "--port", String(oldPort)], {
            cwd: projectDir,
            stdio: "pipe",
            shell: true,
            detached: false,
            env: { ...process.env, BROWSER: "none" },
          });

          previewProcesses.set(name, { process: child, port: oldPort });

          child.on("error", (err: any) => {
            console.error(`Preview process error for ${name}:`, err.message);
          });
          child.on("exit", (code: number | null) => {
            if (code !== null && code !== 0) {
              console.error(`Preview process for ${name} exited with code ${code}`);
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
          if (!fs.existsSync(pkgJsonPath)) {
            fs.writeFileSync(pkgJsonPath, JSON.stringify({ name, version: "0.0.1", private: true }, null, 2));
          }

          const results: string[] = [];
          const { execSync } = await import("child_process");
          const validPkg = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;
          const safeDeps = (dependencies || []).filter((d: string) => validPkg.test(d) && !/[;&|`$(){}]/.test(d));
          const safeDevDeps = (devDependencies || []).filter((d: string) => validPkg.test(d) && !/[;&|`$(){}]/.test(d));

          const errors: string[] = [];

          if (safeDeps.length > 0) {
            try {
              execSync(`npm install ${safeDeps.join(" ")}`, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true });
              results.push(`Installed: ${safeDeps.join(", ")}`);
            } catch (err: any) {
              errors.push(`Failed to install deps: ${err.message}`);
            }
          }

          if (safeDevDeps.length > 0) {
            try {
              execSync(`npm install --save-dev ${safeDevDeps.join(" ")}`, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true });
              results.push(`Installed dev: ${safeDevDeps.join(", ")}`);
            } catch (err: any) {
              errors.push(`Failed to install dev deps: ${err.message}`);
            }
          }

          res.setHeader("Content-Type", "application/json");
          const success = errors.length === 0;
          res.end(JSON.stringify({ success, results, errors }));
          if (!success) { res.statusCode = 200; }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
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
