const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const USER_DATA_DIR = path.join(require('os').homedir(), '.guardian-ai');

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
