const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { exec, execSync, spawn } = require('child_process');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const USER_DATA_DIR = path.join(os.homedir(), '.guardian-ai');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const previewProcesses = new Map();
let activePreviewPort = null;

function projectPort(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return 5100 + (((hash % 100) + 100) % 100);
}

function getProjectsDir() {
  const dir = path.join(USER_DATA_DIR, 'projects');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function validateProjectPath(name) {
  const projectsDir = getProjectsDir();
  if (!name || /[\/\\]|\.\./.test(name) || name === '.' || name.startsWith('.')) {
    return { valid: false, resolved: '', error: 'Invalid project name' };
  }
  const projectDir = path.resolve(projectsDir, name);
  if (!projectDir.startsWith(projectsDir)) {
    return { valid: false, resolved: '', error: 'Path traversal blocked' };
  }
  return { valid: true, resolved: projectDir };
}

function walkDir(dir, base, maxDepth = 6) {
  if (maxDepth <= 0) return [];
  const SKIP = new Set(['node_modules', '.cache', 'dist', '.git', '.next', '__pycache__']);
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  const result = [];
  for (const name of names) {
    if (name === '.DS_Store') continue;
    const fullPath = path.join(dir, name);
    const relPath = base ? base + '/' + name : name;
    try {
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory()) {
        if (SKIP.has(name)) continue;
        const children = walkDir(fullPath, relPath, maxDepth - 1);
        result.push({ name, path: relPath, type: 'directory', children });
      } else if (stat.isFile()) {
        result.push({ name, path: relPath, type: 'file' });
      }
    } catch {}
  }
  return result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

function detectPackageManager(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'bun.lockb')) || fs.existsSync(path.join(projectDir, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function detectDevCommand(projectDir, pkg, port, pm) {
  const scripts = pkg.scripts || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const portStr = String(port);

  const matchScript = (scriptBody) => {
    if (scriptBody.includes('next')) return { cmd: 'npx', args: ['next', 'dev', '--port', portStr, '--hostname', '0.0.0.0'] };
    if (scriptBody.includes('react-scripts')) return { cmd: 'npx', args: ['react-scripts', 'start'] };
    if (scriptBody.includes('nuxt')) return { cmd: 'npx', args: ['nuxt', 'dev', '--port', portStr] };
    if (scriptBody.includes('astro')) return { cmd: 'npx', args: ['astro', 'dev', '--port', portStr, '--host', '0.0.0.0'] };
    if (scriptBody.includes('ng ') || scriptBody.includes('ng serve')) return { cmd: 'npx', args: ['ng', 'serve', '--host', '0.0.0.0', '--port', portStr, '--disable-host-check'] };
    if (scriptBody.includes('webpack')) return { cmd: 'npx', args: ['webpack', 'serve', '--host', '0.0.0.0', '--port', portStr] };
    if (scriptBody.includes('rspack')) return { cmd: 'npx', args: ['rspack', 'serve', '--host', '0.0.0.0', '--port', portStr] };
    if (scriptBody.includes('vue-cli-service')) return { cmd: 'npx', args: ['vue-cli-service', 'serve', '--host', '0.0.0.0', '--port', portStr] };
    if (scriptBody.includes('vite')) return { cmd: 'npx', args: ['vite', '--host', '0.0.0.0', '--port', portStr] };
    return null;
  };

  const isSvelteKit = deps['@sveltejs/kit'] || deps['sveltekit'];

  if (scripts.dev) {
    if (isSvelteKit) return { cmd: 'npx', args: ['vite', 'dev', '--host', '0.0.0.0', '--port', portStr] };
    const matched = matchScript(scripts.dev);
    if (matched) return matched;
    return { cmd: 'npm', args: ['run', 'dev'] };
  }
  if (scripts.start) {
    const matched = matchScript(scripts.start);
    if (matched) return matched;
    return { cmd: 'npm', args: ['run', 'start'] };
  }
  if (scripts.serve) {
    const matched = matchScript(scripts.serve);
    if (matched) return matched;
    return { cmd: 'npm', args: ['run', 'serve'] };
  }

  if (deps['next']) return { cmd: 'npx', args: ['next', 'dev', '--port', portStr, '--hostname', '0.0.0.0'] };
  if (deps['react-scripts']) return { cmd: 'npx', args: ['react-scripts', 'start'] };
  if (deps['nuxt']) return { cmd: 'npx', args: ['nuxt', 'dev', '--port', portStr] };
  if (deps['astro']) return { cmd: 'npx', args: ['astro', 'dev', '--port', portStr, '--host', '0.0.0.0'] };
  if (deps['@angular/cli']) return { cmd: 'npx', args: ['ng', 'serve', '--host', '0.0.0.0', '--port', portStr, '--disable-host-check'] };
  if (deps['webpack-dev-server']) return { cmd: 'npx', args: ['webpack', 'serve', '--host', '0.0.0.0', '--port', portStr] };
  if (isSvelteKit) return { cmd: 'npx', args: ['vite', 'dev', '--host', '0.0.0.0', '--port', portStr] };

  if (fs.existsSync(path.join(projectDir, 'vite.config.ts')) || fs.existsSync(path.join(projectDir, 'vite.config.js'))) {
    return { cmd: 'npx', args: ['vite', '--host', '0.0.0.0', '--port', portStr] };
  }

  return { cmd: 'npx', args: ['vite', '--host', '0.0.0.0', '--port', portStr] };
}

async function handleApi(req, res) {
  const url = req.url;
  const body = req.method === 'POST' ? await readBody(req) : '';
  let parsed = {};
  try { parsed = body ? JSON.parse(body) : {}; } catch {}

  if (url === '/api/projects/list') {
    const projectsDir = getProjectsDir();
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    const projects = entries.filter(e => e.isDirectory()).map(e => {
      const projPath = path.join(projectsDir, e.name);
      const pkgPath = path.join(projPath, 'package.json');
      let description = '', framework = 'react';
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          description = pkg.description || '';
          framework = pkg._framework || 'react';
        } catch {}
      }
      const stat = fs.statSync(projPath);
      return { name: e.name, path: `projects/${e.name}`, createdAt: stat.birthtime.toISOString(), framework, description };
    });
    return sendJson(res, { success: true, projects });
  }

  if (url === '/api/projects/create') {
    const { name, framework = 'react', description = '' } = parsed;
    if (!name) return sendJson(res, { success: false, error: 'Missing project name' }, 400);
    const projectDir = path.join(getProjectsDir(), name);
    if (fs.existsSync(projectDir)) return sendJson(res, { success: false, error: 'Project already exists' }, 409);
    fs.mkdirSync(projectDir, { recursive: true });
    const pkgJson = JSON.stringify({ name, version: '0.0.1', private: true, description, _framework: framework }, null, 2);
    fs.writeFileSync(path.join(projectDir, 'package.json'), pkgJson, 'utf-8');
    return sendJson(res, { success: true, name, framework, description, path: `projects/${name}` });
  }

  if (url === '/api/projects/delete') {
    const { name } = parsed;
    if (!name) return sendJson(res, { success: false, error: 'Missing project name' }, 400);
    const projectDir = path.join(getProjectsDir(), name);
    if (!fs.existsSync(projectDir)) return sendJson(res, { success: false, error: 'Project not found' }, 404);
    fs.rmSync(projectDir, { recursive: true, force: true });
    return sendJson(res, { success: true, name });
  }

  if (url === '/api/projects/files') {
    const { name } = parsed;
    if (!name) return sendJson(res, { success: false, error: 'Missing project name' }, 400);
    const projectDir = path.join(getProjectsDir(), name);
    if (!fs.existsSync(projectDir)) return sendJson(res, { success: false, error: 'Project not found' }, 404);
    const tree = walkDir(projectDir, '');
    return sendJson(res, { success: true, name, files: tree });
  }

  if (url === '/api/projects/files-main') {
    const tree = walkDir(USER_DATA_DIR, '', 6);
    return sendJson(res, { success: true, name: '__main__', files: tree });
  }

  if (url === '/api/projects/read-file') {
    const { name, filePath } = parsed;
    if (!name || !filePath) return sendJson(res, { success: false, error: 'Missing name or filePath' }, 400);
    const baseDir = name === '__main__' ? USER_DATA_DIR : path.join(getProjectsDir(), name);
    const resolved = path.resolve(baseDir, filePath);
    if (!resolved.startsWith(baseDir)) return sendJson(res, { success: false, error: 'Path traversal blocked' }, 403);
    const exists = fs.existsSync(resolved);
    const content = exists ? fs.readFileSync(resolved, 'utf-8') : '';
    return sendJson(res, { success: true, exists, content, filePath });
  }

  if (url === '/api/projects/write-file') {
    const { name, filePath, content } = parsed;
    if (!name || !filePath || typeof content !== 'string') return sendJson(res, { success: false, error: 'Missing fields' }, 400);
    const baseDir = name === '__main__' ? USER_DATA_DIR : path.join(getProjectsDir(), name);
    const resolved = path.resolve(baseDir, filePath);
    if (!resolved.startsWith(baseDir)) return sendJson(res, { success: false, error: 'Path traversal blocked' }, 403);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let previousContent = '';
    if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, 'utf-8');
    fs.writeFileSync(resolved, content, 'utf-8');
    return sendJson(res, { success: true, filePath, previousContent, bytesWritten: content.length });
  }

  if (url === '/api/write-file') {
    const { filePath, content } = parsed;
    if (!filePath || typeof content !== 'string') return sendJson(res, { success: false, error: 'Missing fields' }, 400);
    const resolved = path.resolve(USER_DATA_DIR, filePath);
    if (!resolved.startsWith(USER_DATA_DIR)) return sendJson(res, { success: false, error: 'Path traversal blocked' }, 403);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let previousContent = '';
    if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, 'utf-8');
    fs.writeFileSync(resolved, content, 'utf-8');
    return sendJson(res, { success: true, filePath, previousContent, bytesWritten: content.length });
  }

  if (url === '/api/read-file') {
    const { filePath } = parsed;
    if (!filePath) return sendJson(res, { success: false, error: 'Missing filePath' }, 400);
    const resolved = path.resolve(USER_DATA_DIR, filePath);
    if (!resolved.startsWith(USER_DATA_DIR)) return sendJson(res, { success: false, error: 'Path traversal blocked' }, 403);
    const exists = fs.existsSync(resolved);
    const content = exists ? fs.readFileSync(resolved, 'utf-8') : '';
    return sendJson(res, { success: true, exists, content });
  }

  if (url === '/api/projects/import-github') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
    try {
      const { owner, repo, targetProject } = parsed;
      if (!owner || !repo || /[\/\\]|\.\./.test(owner) || /[\/\\]|\.\./.test(repo)) {
        return sendJson(res, { error: 'Invalid owner or repo' }, 400);
      }
      if (targetProject && /[\/\\]|\.\./.test(targetProject)) {
        return sendJson(res, { error: 'Invalid target project name' }, 400);
      }

      const projectsDir = getProjectsDir();
      const projectName = targetProject || repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const projectDir = path.resolve(projectsDir, projectName);

      if (fs.existsSync(projectDir) && !targetProject) {
        return sendJson(res, { error: `Project '${projectName}' already exists. Delete it first or use a different name.` }, 409);
      }
      if (targetProject && fs.existsSync(projectDir)) {
        try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch (rmErr) {
          try {
            const existingFiles = fs.readdirSync(projectDir);
            for (const f of existingFiles) {
              try { fs.rmSync(path.join(projectDir, f), { recursive: true, force: true }); } catch {}
            }
          } catch {}
        }
      }

      const ghToken = process.env.GITHUB_TOKEN || '';
      const headers = { 'User-Agent': 'Guardian-AI' };
      if (ghToken) headers['Authorization'] = `token ${ghToken}`;

      let defaultBranch = 'main';
      let apiAvailable = false;
      try {
        const infoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { ...headers, 'Accept': 'application/vnd.github.v3+json' } });
        if (infoResp.ok) {
          const repoInfo = await infoResp.json();
          defaultBranch = repoInfo.default_branch || 'main';
          apiAvailable = true;
        }
      } catch {}

      const MAX_TARBALL_SIZE = 200 * 1024 * 1024;
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-import-'));
      let cloneMethod = 'tarball';

      try {
        let tarballSuccess = false;
        if (apiAvailable) try {
          console.log(`[Import] Downloading tarball for ${owner}/${repo} (branch: ${defaultBranch})...`);
          const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(defaultBranch)}`;
          const tarResp = await fetch(tarballUrl, { headers: { ...headers, 'Accept': 'application/vnd.github.v3+json' }, redirect: 'follow' });
          if (!tarResp.ok) throw new Error(`Tarball download failed: HTTP ${tarResp.status}`);

          const contentLength = parseInt(tarResp.headers.get('content-length') || '0', 10);
          if (contentLength > MAX_TARBALL_SIZE) throw new Error('Repository too large for tarball');

          const tarPath = path.join(tmpDir, 'repo.tar.gz');
          const arrayBuf = await tarResp.arrayBuffer();
          if (arrayBuf.byteLength > MAX_TARBALL_SIZE) throw new Error('Repository too large');

          fs.writeFileSync(tarPath, Buffer.from(arrayBuf));
          fs.mkdirSync(projectDir, { recursive: true });

          if (process.platform === 'win32') {
            execSync(`tar xzf "${tarPath.replace(/\\/g, '/')}" --strip-components=1 -C "${projectDir.replace(/\\/g, '/')}"`, { timeout: 60000, stdio: 'pipe', windowsHide: true });
          } else {
            execSync(`tar xzf "${tarPath}" --strip-components=1 -C "${projectDir}"`, { timeout: 60000, stdio: 'pipe', windowsHide: true });
          }
          tarballSuccess = true;
        } catch (tarErr) {
          console.log(`[Import] Tarball failed: ${(tarErr.message || '').slice(0, 200)}`);
          try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
        }

        if (!tarballSuccess) {
          cloneMethod = 'git-clone';
          console.log(`[Import] Falling back to git clone for ${owner}/${repo}...`);
          const cloneUrl = ghToken
            ? `https://x-access-token:${ghToken}@github.com/${owner}/${repo}.git`
            : `https://github.com/${owner}/${repo}.git`;
          const cloneTmp = path.join(tmpDir, 'clone');
          try {
            execSync(`git clone --depth 1 --single-branch --branch "${defaultBranch}" "${cloneUrl}" "${cloneTmp}"`, { timeout: 120000, stdio: 'pipe', windowsHide: true });
          } catch {
            try {
              execSync(`git clone --depth 1 "${cloneUrl}" "${cloneTmp}"`, { timeout: 120000, stdio: 'pipe', windowsHide: true });
            } catch (cloneErr) {
              throw new Error(`Failed to clone repository: ${(cloneErr.message || '').slice(0, 200)}`);
            }
          }
          fs.mkdirSync(projectDir, { recursive: true });
          const cloneEntries = fs.readdirSync(cloneTmp);
          for (const entry of cloneEntries) {
            try { fs.cpSync(path.join(cloneTmp, entry), path.join(projectDir, entry), { recursive: true, force: true }); } catch {}
          }
        }

        const CLEANUP_PATTERNS = ['node_modules', '.git', '.next', '.nuxt', 'dist', '.cache', '.turbo', '.vercel', '.output'];
        for (const pattern of CLEANUP_PATTERNS) {
          const cleanPath = path.join(projectDir, pattern);
          if (fs.existsSync(cleanPath)) {
            try { fs.rmSync(cleanPath, { recursive: true, force: true }); } catch {}
          }
        }

        let filesWritten = 0;
        const countFiles = (dir) => {
          try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
              else filesWritten++;
            }
          } catch {}
        };
        countFiles(projectDir);

        let framework = 'vanilla';
        const pkgPath = path.join(projectDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            if (deps['next']) framework = 'nextjs';
            else if (deps['nuxt'] || deps['nuxt3']) framework = 'nuxt';
            else if (deps['@angular/core']) framework = 'angular';
            else if (deps['svelte'] || deps['@sveltejs/kit']) framework = 'svelte';
            else if (deps['astro']) framework = 'astro';
            else if (deps['vue']) framework = 'vue';
            else if (deps['react']) framework = 'react';
          } catch {}
        }

        let npmInstalled = false;
        let installError = '';
        if (fs.existsSync(pkgPath)) {
          const detectedPM = detectPackageManager(projectDir);
          const installCmd = detectedPM === 'pnpm' ? 'npx pnpm install --no-frozen-lockfile --ignore-scripts'
            : detectedPM === 'yarn' ? 'npx yarn install --ignore-engines --ignore-scripts'
            : detectedPM === 'bun' ? 'npx bun install --ignore-scripts'
            : 'npm install --legacy-peer-deps --ignore-scripts';
          const importInstallEnv = { ...process.env, HUSKY: '0', DISABLE_OPENCOLLECTIVE: 'true', ADBLOCK: '1' };
          if (!fs.existsSync(path.join(projectDir, '.git'))) { try { fs.mkdirSync(path.join(projectDir, '.git'), { recursive: true }); } catch {} }
          try {
            execSync(installCmd, { cwd: projectDir, timeout: 180000, stdio: 'pipe', shell: true, windowsHide: true, env: importInstallEnv });
            npmInstalled = true;
            try { execSync('npm rebuild', { cwd: projectDir, timeout: 120000, stdio: 'pipe', shell: true, windowsHide: true }); } catch {}
          } catch (installErr) {
            installError = (installErr.stderr ? installErr.stderr.toString().slice(-500) : installErr.message || '').slice(0, 500);
            if (detectedPM !== 'npm') {
              try {
                execSync('npm install --legacy-peer-deps --ignore-scripts', { cwd: projectDir, timeout: 180000, stdio: 'pipe', shell: true, windowsHide: true, env: importInstallEnv });
                npmInstalled = true;
                installError = '';
              } catch {}
            }
          }
        }

        const metaPath = path.join(projectDir, '.guardian-meta.json');
        try {
          fs.writeFileSync(metaPath, JSON.stringify({ owner, repo, sourceUrl: `https://github.com/${owner}/${repo}`, clonedAt: new Date().toISOString(), projectName }, null, 2));
        } catch {}

        return sendJson(res, {
          success: true,
          projectName,
          framework,
          filesWritten,
          npmInstalled,
          cloneMethod,
          sourceRepo: `https://github.com/${owner}/${repo}`,
          defaultBranch,
          ...(installError ? { installError: installError.slice(0, 500) } : {}),
        });
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      }
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }

  if (url === '/api/projects/install-deps') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
    try {
      const { name, dependencies, devDependencies } = parsed;
      if (!name || /[\/\\]|\.\./.test(name)) return sendJson(res, { error: 'Invalid project name' }, 400);

      const projectDir = path.join(getProjectsDir(), name);
      if (!fs.existsSync(projectDir)) return sendJson(res, { error: 'Project not found' }, 404);

      const pkgJsonPath = path.join(projectDir, 'package.json');
      let pkgJsonValid = false;
      if (fs.existsSync(pkgJsonPath)) {
        try { JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')); pkgJsonValid = true; } catch {}
      }
      if (!pkgJsonValid) {
        fs.writeFileSync(pkgJsonPath, JSON.stringify({ name, version: '0.0.1', private: true }, null, 2));
      }

      const validPkg = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;
      const notAPkg = new Set(['npm','npx','yarn','pnpm','bun','node','deno','run','dev','start','build','test','serve','watch','lint','deploy','preview','install','add','remove','uninstall','update','init','create','cd','ls','mkdir','rm','cp','mv','cat','echo','touch','git','curl','wget','then','and','or','the','a','an','to','in','of','for','with','from','your','this','that','it','is','are','was','be','has','have','do','does','if','not','no','yes','on','off','up','so','but','by','at','as','server','app','application','project','file','directory','folder','next','first','following','above','below','after','before','all','any','each','every','both','new','old']);
      const filterPkgs = (arr) => (arr || []).filter(d => {
        if (!validPkg.test(d) || /[;&|`$(){}]/.test(d)) return false;
        const base = d.replace(/@[^\s]*$/, '').toLowerCase();
        return !notAPkg.has(base) && (base.length > 1 || d.startsWith('@'));
      });
      const safeDeps = filterPkgs(dependencies);
      const safeDevDeps = filterPkgs(devDependencies);

      const pm = detectPackageManager(projectDir);
      const buildInstallCmd = (pkgs, isDev) => {
        const pkgStr = pkgs.join(' ');
        switch (pm) {
          case 'bun': return `npx bun add${isDev ? ' -d' : ''} ${pkgStr}`;
          case 'pnpm': return `npx pnpm add${isDev ? ' -D' : ''} ${pkgStr}`;
          case 'yarn': return `npx yarn add${isDev ? ' -D' : ''} ${pkgStr}`;
          default: return `npm install --legacy-peer-deps${isDev ? ' --save-dev' : ''} ${pkgStr}`;
        }
      };

      const depsInstallEnv = { ...process.env, HUSKY: '0', DISABLE_OPENCOLLECTIVE: 'true', ADBLOCK: '1' };
      if (!fs.existsSync(path.join(projectDir, '.git'))) { try { fs.mkdirSync(path.join(projectDir, '.git'), { recursive: true }); } catch {} }
      const errors = [];
      const results = [];

      const runInstall = (pkgs, isDev) => new Promise((resolve) => {
        const cmd = buildInstallCmd(pkgs, isDev);
        console.log(`[Deps] Running: ${cmd} in ${name}`);
        exec(cmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err, _stdout, stderr) => {
          if (err) {
            const fallbackCmd = pm !== 'npm'
              ? `npm install --legacy-peer-deps${isDev ? ' --save-dev' : ''} ${pkgs.join(' ')}`
              : `${cmd} --ignore-scripts`;
            exec(fallbackCmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err2) => {
              if (err2) errors.push(`Failed: ${cmd}`);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });

      if (safeDeps.length > 0) {
        await runInstall(safeDeps, false);
        if (errors.length === 0) results.push(`Installed: ${safeDeps.join(', ')}`);
      }
      if (safeDevDeps.length > 0) {
        const prevErrors = errors.length;
        await runInstall(safeDevDeps, true);
        if (errors.length === prevErrors) results.push(`Installed dev: ${safeDevDeps.join(', ')}`);
      }

      return sendJson(res, { success: errors.length === 0, results, errors });
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }

  if (url === '/api/projects/run-command') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
    try {
      const { name, command } = parsed;
      if (!command || typeof command !== 'string') return sendJson(res, { error: 'No command specified' }, 400);

      const check = validateProjectPath(name || '');
      if (!check.valid) return sendJson(res, { success: false, error: check.error }, 403);

      const allowedPrefixes = [
        'npm ', 'npx ', 'yarn ', 'pnpm ', 'bun ',
        'node ', 'deno ', 'tsc', 'tsx ',
        'corepack ', 'nvm ', 'fnm ',
        'mkdir ', 'cp ', 'mv ', 'rm ', 'touch ', 'cat ', 'ls ', 'pwd',
        'chmod ', 'chown ', 'ln ',
        'git ', 'curl ', 'wget ',
        'python', 'pip', 'cargo ', 'go ', 'rustc', 'gcc', 'g++', 'make',
        'docker ', 'docker-compose ',
      ];
      const trimmed = command.trim().replace(/\s+#\s+.*$/, '').trim();
      if (/[\r\n\x00]/.test(trimmed)) return sendJson(res, { error: 'Control characters not allowed' }, 403);

      const devServerRe = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
      if (devServerRe.test(trimmed)) return sendJson(res, { error: 'Dev server commands should use the Preview button instead' }, 400);
      const isAllowed = allowedPrefixes.some(p => trimmed.startsWith(p)) || trimmed === 'npm install' || trimmed === 'corepack enable';
      if (!isAllowed) return sendJson(res, { error: `Command not allowed: ${trimmed.slice(0, 50)}` }, 403);
      if (/[;&|`$(){}]/.test(trimmed)) return sendJson(res, { error: 'Shell metacharacters not allowed' }, 403);
      if (/\.\.[\/\\]/.test(trimmed)) return sendJson(res, { error: 'Path traversal not allowed' }, 403);

      const projectDir = check.resolved;
      if (!fs.existsSync(projectDir)) return sendJson(res, { success: false, error: 'Project not found' }, 404);

      const isWin = process.platform === 'win32';
      let actualCmd = trimmed === 'npm install' ? 'npm install --legacy-peer-deps' : trimmed;

      const isInstallCmd = /^(npm\s+install|npm\s+i\b|yarn\s*(install)?$|pnpm\s+install|bun\s+install)/i.test(trimmed);
      if (isInstallCmd) {
        const gitDir = path.join(projectDir, '.git');
        if (!fs.existsSync(gitDir)) { try { fs.mkdirSync(gitDir, { recursive: true }); } catch {} }
      }

      if (/^rm\s+(-rf?\s+)?/i.test(actualCmd)) {
        const targets = actualCmd.replace(/^rm\s+(-rf?\s+)?/i, '').trim().split(/\s+/);
        const rmResults = [];
        for (const t of targets) {
          const targetPath = path.resolve(projectDir, t);
          if (!targetPath.startsWith(projectDir)) { rmResults.push(`Skipped (outside project): ${t}`); continue; }
          try { fs.rmSync(targetPath, { recursive: true, force: true }); rmResults.push(`Removed: ${t}`); }
          catch (e) { rmResults.push(`Failed to remove ${t}: ${e.message}`); }
        }
        return sendJson(res, { success: true, output: rmResults.join('\n') });
      }
      if (/^mkdir\s+(-p\s+)?/i.test(actualCmd)) {
        const dir = actualCmd.replace(/^mkdir\s+(-p\s+)?/i, '').trim();
        const dirPath = path.resolve(projectDir, dir);
        if (!dirPath.startsWith(projectDir)) return sendJson(res, { success: false, error: 'Path outside project' });
        try { fs.mkdirSync(dirPath, { recursive: true }); return sendJson(res, { success: true, output: `Created: ${dir}` }); }
        catch (e) { return sendJson(res, { success: false, error: e.message }); }
      }
      if (/^touch\s/i.test(actualCmd)) {
        const file = actualCmd.replace(/^touch\s+/i, '').trim();
        const filePath = path.resolve(projectDir, file);
        if (!filePath.startsWith(projectDir)) return sendJson(res, { success: false, error: 'Path outside project' });
        try {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, '', { flag: 'a' });
          return sendJson(res, { success: true, output: `Touched: ${file}` });
        } catch (e) { return sendJson(res, { success: false, error: e.message }); }
      }
      if (/^cat\s/i.test(actualCmd)) {
        const file = actualCmd.replace(/^cat\s+/i, '').trim();
        const filePath = path.resolve(projectDir, file);
        if (!filePath.startsWith(projectDir)) return sendJson(res, { success: false, error: 'Path outside project' });
        try { return sendJson(res, { success: true, output: fs.readFileSync(filePath, 'utf-8').slice(0, 4000) }); }
        catch (e) { return sendJson(res, { success: false, error: e.message }); }
      }

      if (isWin && /^corepack\s/i.test(actualCmd)) {
        actualCmd = `npx ${actualCmd}`;
      }

      const cmdEnv = isInstallCmd
        ? { ...process.env, HUSKY: '0', npm_config_ignore_scripts: '', DISABLE_OPENCOLLECTIVE: 'true', ADBLOCK: '1' }
        : undefined;
      const cmdTimeout = isInstallCmd ? 180000 : 60000;

      await new Promise((resolve) => {
        exec(actualCmd, { cwd: projectDir, timeout: cmdTimeout, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, ...(cmdEnv ? { env: cmdEnv } : {}) }, (err, stdout, stderr) => {
          if (err && isInstallCmd) {
            const retryCmd = actualCmd.includes('--ignore-scripts') ? actualCmd + ' --force' : actualCmd + ' --ignore-scripts';
            exec(retryCmd, { cwd: projectDir, timeout: cmdTimeout, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: cmdEnv }, (retryErr, retryStdout, retryStderr) => {
              if (retryErr) {
                sendJson(res, { success: false, error: (retryErr.message || '').slice(0, 500), output: (retryStdout || '').slice(0, 4000), stderr: (retryStderr || '').slice(0, 2000), retried: true });
              } else {
                sendJson(res, { success: true, output: (retryStdout || '').slice(0, 4000), retried: true });
              }
              resolve();
            });
            return;
          }
          if (err) {
            sendJson(res, { success: false, error: (err.message || '').slice(0, 500), output: (stdout || '').slice(0, 4000), stderr: (stderr || '').slice(0, 2000) });
          } else {
            sendJson(res, { success: true, output: (stdout || '').slice(0, 4000) });
          }
          resolve();
        });
      });
      return;
    } catch (err) {
      return sendJson(res, { success: false, error: err.message }, 500);
    }
  }

  if (url === '/api/projects/preview') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
    try {
      const { name } = parsed;
      if (!name || /[\/\\]|\.\./.test(name)) return sendJson(res, { error: 'Invalid project name' }, 400);

      const projectDir = path.join(getProjectsDir(), name);
      if (!fs.existsSync(projectDir)) return sendJson(res, { error: 'Project not found' }, 404);

      if (previewProcesses.has(name)) {
        const existing = previewProcesses.get(name);
        const processAlive = existing.process && !existing.process.killed && existing.process.exitCode === null;
        if (processAlive) {
          return sendJson(res, { port: existing.port, reused: true });
        }
        previewProcesses.delete(name);
      }

      let port = projectPort(name);
      const usedPorts = new Set([...previewProcesses.values()].map(e => e.port));
      while (usedPorts.has(port)) port++;

      const portInUse = await new Promise((resolve) => {
        const tester = net.createServer().once('error', (err) => {
          resolve(err.code === 'EADDRINUSE');
        }).once('listening', () => {
          tester.close(() => resolve(false));
        }).listen(port);
      });
      if (portInUse) {
        console.log(`[Preview] Port ${port} still in use — killing`);
        try {
          if (process.platform === 'win32') {
            try {
              const out = execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe', encoding: 'utf-8', windowsHide: true });
              const pids = new Set(out.split('\n').map(l => l.trim().split(/\s+/).pop()).filter(p => p && /^\d+$/.test(p) && p !== '0'));
              for (const pid of pids) { try { execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'pipe', windowsHide: true }); } catch {} }
            } catch {}
          } else {
            try { execSync(`fuser -k ${port}/tcp`, { stdio: 'pipe', timeout: 5000 }); } catch {}
          }
        } catch {}
        await new Promise(r => setTimeout(r, 800));
      }

      let hasPkg = fs.existsSync(path.join(projectDir, 'package.json'));
      let pkg = {};
      let effectiveProjectDir = projectDir;
      if (hasPkg) {
        try { pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8')); } catch {}
      } else {
        const SUB_CANDIDATES = ['frontend', 'client', 'web', 'app'];
        for (const sub of SUB_CANDIDATES) {
          const subPkgPath = path.join(projectDir, sub, 'package.json');
          if (fs.existsSync(subPkgPath)) {
            try {
              pkg = JSON.parse(fs.readFileSync(subPkgPath, 'utf-8'));
              effectiveProjectDir = path.join(projectDir, sub);
              hasPkg = true;
            } catch {}
            break;
          }
        }
      }

      const pm = detectPackageManager(effectiveProjectDir);

      if (hasPkg && !fs.existsSync(path.join(effectiveProjectDir, 'node_modules'))) {
        const gitDir = path.join(effectiveProjectDir, '.git');
        if (!fs.existsSync(gitDir)) { try { fs.mkdirSync(gitDir, { recursive: true }); } catch {} }
        const installCmd = pm === 'npm' ? 'npm install --legacy-peer-deps'
          : pm === 'pnpm' ? 'npx pnpm install --no-frozen-lockfile'
          : pm === 'yarn' ? 'npx yarn install --ignore-engines'
          : 'npx bun install';
        const safeInstallEnv = { ...process.env, HUSKY: '0', DISABLE_OPENCOLLECTIVE: 'true', ADBLOCK: '1' };
        try {
          execSync(installCmd, { cwd: effectiveProjectDir, timeout: 120000, stdio: 'pipe', shell: true, windowsHide: true, env: safeInstallEnv });
        } catch {
          try {
            execSync('npm install --legacy-peer-deps --ignore-scripts', { cwd: effectiveProjectDir, timeout: 120000, stdio: 'pipe', shell: true, windowsHide: true, env: safeInstallEnv });
          } catch {}
        }
      }

      if (!hasPkg) {
        let hasRootIndex = fs.existsSync(path.join(projectDir, 'index.html'));
        if (hasRootIndex) {
          const minPkg = { name, private: true, devDependencies: { vite: '^5' } };
          fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(minPkg, null, 2));
          try { execSync('npm install', { cwd: projectDir, timeout: 60000, stdio: 'pipe', shell: true, windowsHide: true }); } catch {}
          pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
          hasPkg = true;
        }
      }

      const devCmd = detectDevCommand(effectiveProjectDir, pkg, port, pm);
      const isWin = process.platform === 'win32';

      const portEnv = {
        ...process.env,
        BROWSER: 'none',
        PORT: String(port),
        HOST: '0.0.0.0',
        HOSTNAME: '0.0.0.0',
        NODE_PATH: path.join(projectDir, 'node_modules'),
        CHOKIDAR_USEPOLLING: 'true',
      };

      const isReactScripts = devCmd.args.includes('react-scripts');
      if (isReactScripts) {
        portEnv.SKIP_PREFLIGHT_CHECK = 'true';
        portEnv.PUBLIC_URL = '';
        portEnv.NODE_OPTIONS = (portEnv.NODE_OPTIONS || '') + ' --openssl-legacy-provider';
      }

      const child = spawn(devCmd.cmd, devCmd.args, {
        cwd: effectiveProjectDir,
        stdio: 'pipe',
        shell: true,
        detached: !isWin,
        windowsHide: true,
        env: portEnv,
      });
      if (!isWin) child.unref();

      let startupOutput = '';
      let serverReady = false;
      let exited = false;
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

      child.stdout.on('data', collectOutput);
      child.stderr.on('data', collectOutput);

      previewProcesses.set(name, { process: child, port });

      child.on('error', () => { exited = true; });
      child.on('exit', (code) => {
        exited = true;
        if (code !== 0 && code !== null) previewProcesses.delete(name);
      });

      const maxWait = 15000;
      const start = Date.now();
      while (Date.now() - start < maxWait && !serverReady && !exited) {
        await new Promise(r => setTimeout(r, 300));
      }

      if (exited && !serverReady) {
        previewProcesses.delete(name);
        return sendJson(res, {
          port,
          started: false,
          error: `Dev server failed to start. ${startupErrors.join(' | ').slice(0, 800)}`,
          output: startupOutput.slice(-2000),
          detectedCommand: `${devCmd.cmd} ${devCmd.args.join(' ')}`,
        });
      } else {
        return sendJson(res, {
          port,
          started: true,
          ready: serverReady,
          detectedCommand: `${devCmd.cmd} ${devCmd.args.join(' ')}`,
          packageManager: pm,
        });
      }
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }

  if (url === '/api/projects/restart-preview') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
    try {
      const { name } = parsed;
      if (!name || /[\/\\]|\.\./.test(name)) return sendJson(res, { error: 'Invalid project name' }, 400);

      const entry = previewProcesses.get(name);
      if (!entry) {
        return sendJson(res, { restarted: false, reason: 'No active preview' });
      }

      const oldPort = entry.port;
      try {
        if (process.platform === 'win32') {
          try { execSync(`taskkill /pid ${entry.process.pid} /T /F`, { stdio: 'pipe', windowsHide: true }); } catch {}
        } else {
          try { process.kill(-entry.process.pid, 'SIGKILL'); } catch { try { entry.process.kill('SIGKILL'); } catch {} }
        }
      } catch {}
      previewProcesses.delete(name);

      const waitForPortFree = async (p, maxWait) => {
        const startW = Date.now();
        while (Date.now() - startW < maxWait) {
          const inUse = await new Promise(resolve => {
            const s = net.createServer();
            s.once('error', () => resolve(true));
            s.once('listening', () => { s.close(); resolve(false); });
            s.listen(p, '0.0.0.0');
          });
          if (!inUse) return true;
          await new Promise(r => setTimeout(r, 200));
        }
        return false;
      };
      const portFree = await waitForPortFree(oldPort, 3000);
      if (!portFree) {
        return sendJson(res, { restarted: false, reason: 'Port still in use after 3s' });
      }

      const projectDir = path.join(getProjectsDir(), name);
      let pkg = {};
      let restartDir = projectDir;
      const pkgPath = path.join(projectDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch {}
      } else {
        for (const sub of ['frontend', 'client', 'web', 'app']) {
          const subPkg = path.join(projectDir, sub, 'package.json');
          if (fs.existsSync(subPkg)) {
            try { pkg = JSON.parse(fs.readFileSync(subPkg, 'utf-8')); restartDir = path.join(projectDir, sub); } catch {}
            break;
          }
        }
      }

      const pmR = detectPackageManager(restartDir);
      const restartCmd = detectDevCommand(restartDir, pkg, oldPort, pmR);
      const isWinR = process.platform === 'win32';

      const child = spawn(restartCmd.cmd, restartCmd.args, {
        cwd: restartDir,
        stdio: 'pipe',
        shell: true,
        detached: !isWinR,
        windowsHide: true,
        env: {
          ...process.env,
          BROWSER: 'none',
          PORT: String(oldPort),
          HOST: '0.0.0.0',
          HOSTNAME: '0.0.0.0',
          CHOKIDAR_USEPOLLING: 'true',
        },
      });
      if (!isWinR) child.unref();

      previewProcesses.set(name, { process: child, port: oldPort });
      child.stdout.on('data', (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
      child.stderr.on('data', (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
      child.on('exit', () => { previewProcesses.delete(name); });

      return sendJson(res, { restarted: true, port: oldPort });
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }

  if (url === '/api/projects/stop-preview') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
    try {
      const { name } = parsed;
      const entry = previewProcesses.get(name);
      if (entry) {
        const pid = entry.process.pid;
        if (process.platform === 'win32') {
          try { execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'pipe', windowsHide: true }); } catch {}
        } else {
          try { process.kill(-pid, 9); } catch {}
        }
        try { entry.process.kill('SIGKILL'); } catch {}
        if (activePreviewPort === entry.port) activePreviewPort = null;
        previewProcesses.delete(name);
      }
      return sendJson(res, { stopped: true });
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }

  if (url === '/api/projects/preview-info') {
    const { name } = parsed;
    const entry = previewProcesses.get(name);
    if (!entry) return sendJson(res, { active: false });
    return sendJson(res, { active: true, port: entry.port, proxyUrl: `http://127.0.0.1:${entry.port}/` });
  }

  if (url === '/api/programs/install') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
    try {
      const { programs } = parsed;
      if (!Array.isArray(programs) || programs.length === 0) return sendJson(res, { error: 'No programs specified' }, 400);
      if (programs.length > 10) return sendJson(res, { error: 'Too many programs (max 10)' }, 400);

      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';

      const programInstallMap = {
        'g++': { check: 'g++ --version', winCmds: ['choco install mingw -y'], macCmds: ['xcode-select --install'], linuxCmds: ['sudo apt-get install -y g++'], label: 'G++ (C++ Compiler)' },
        'gcc': { check: 'gcc --version', winCmds: ['choco install mingw -y'], macCmds: ['xcode-select --install'], linuxCmds: ['sudo apt-get install -y gcc'], label: 'GCC (C Compiler)' },
        'python': { check: 'python3 --version', winCmds: ['choco install python -y'], macCmds: ['brew install python3'], linuxCmds: ['sudo apt-get install -y python3'], label: 'Python 3', altChecks: ['python --version'] },
        'python3': { check: 'python3 --version', winCmds: ['choco install python -y'], macCmds: ['brew install python3'], linuxCmds: ['sudo apt-get install -y python3'], label: 'Python 3', altChecks: ['python --version'] },
        'node': { check: 'node --version', winCmds: ['choco install nodejs -y'], macCmds: ['brew install node'], linuxCmds: ['sudo apt-get install -y nodejs'], label: 'Node.js' },
        'rust': { check: 'rustc --version', winCmds: ['choco install rust -y'], macCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], linuxCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], label: 'Rust' },
        'go': { check: 'go version', winCmds: ['choco install golang -y'], macCmds: ['brew install go'], linuxCmds: ['sudo apt-get install -y golang'], label: 'Go' },
        'docker': { check: 'docker --version', winCmds: ['choco install docker-desktop -y'], macCmds: ['brew install --cask docker'], linuxCmds: ['sudo apt-get install -y docker.io'], label: 'Docker' },
        'git': { check: 'git --version', winCmds: ['choco install git -y'], macCmds: ['brew install git'], linuxCmds: ['sudo apt-get install -y git'], label: 'Git' },
      };

      function tryExec(cmd, timeout = 10000) {
        try { execSync(cmd, { timeout, stdio: 'pipe', shell: true, windowsHide: true }); return true; } catch { return false; }
      }

      const results = [];
      for (const prog of programs) {
        const key = prog.toLowerCase().replace(/[^a-z0-9.+]/g, '');
        const mapping = programInstallMap[key];
        if (!mapping) {
          results.push({ program: prog, label: prog, alreadyInstalled: false, installed: false, error: `Unknown program: ${prog}` });
          continue;
        }
        let alreadyInstalled = tryExec(mapping.check);
        if (!alreadyInstalled && mapping.altChecks) {
          alreadyInstalled = mapping.altChecks.some(c => tryExec(c));
        }
        if (alreadyInstalled) {
          results.push({ program: prog, label: mapping.label, alreadyInstalled: true, installed: true });
          continue;
        }
        const installCmds = isWin ? mapping.winCmds : isMac ? mapping.macCmds : mapping.linuxCmds;
        let installed = false;
        let lastErr = '';
        let usedCmd = '';
        for (const cmd of installCmds) {
          try {
            execSync(cmd, { timeout: 180000, stdio: 'pipe', shell: true, windowsHide: true });
            installed = true; usedCmd = cmd; break;
          } catch (err) {
            lastErr = (err.message || '').slice(0, 150);
          }
        }
        results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed, ...(installed ? { command: usedCmd } : { error: `Install failed: ${lastErr}` }) });
      }

      return sendJson(res, { success: results.every(r => r.installed || r.alreadyInstalled), results });
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }

  if (url === '/api/download-source') {
    return sendJson(res, { success: false, error: 'Not available in desktop app' });
  }

  return sendJson(res, { success: false, error: 'Unknown API endpoint' }, 404);
}

function startLocalServer(port = 4999) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (req.url.startsWith('/__preview/')) {
        const match = req.url.match(/^\/__preview\/(\d+)(\/.*)?$/);
        if (!match) { res.writeHead(400); res.end('Invalid preview URL'); return; }
        const previewPort = parseInt(match[1], 10);
        if (previewPort < 5100 || previewPort > 5200) { res.writeHead(400); res.end('Port out of range'); return; }
        const targetPath = match[2] || '/';
        const proxyReq = http.request(
          { hostname: '127.0.0.1', port: previewPort, path: targetPath, method: req.method, headers: { ...req.headers, host: `localhost:${previewPort}` } },
          (proxyRes) => { res.writeHead(proxyRes.statusCode || 200, proxyRes.headers); proxyRes.pipe(res, { end: true }); }
        );
        proxyReq.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end('Preview server not responding'); } });
        req.pipe(proxyReq, { end: true });
        return;
      }

      if (req.url.startsWith('/api/')) {
        try {
          await handleApi(req, res);
        } catch (err) {
          sendJson(res, { success: false, error: err.message }, 500);
        }
        return;
      }

      let filePath = req.url.split('?')[0];
      if (filePath === '/' || filePath === '') filePath = '/index.html';

      const fullPath = path.join(DIST_DIR, filePath);
      if (!fullPath.startsWith(DIST_DIR)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }

      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        const indexPath = path.join(DIST_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(fs.readFileSync(indexPath));
          return;
        }
        res.writeHead(404); res.end('Not found'); return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(fullPath));
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Local server running at http://127.0.0.1:${port}`);
      resolve({ server, port });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, trying ${port + 1}`);
        resolve(startLocalServer(port + 1));
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { startLocalServer };
