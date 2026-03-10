import { SafetyCheck } from './self-reference';

let idCounter = 0;
const nextId = () => `check-${++idCounter}`;

export interface ValidationContext {
  projectFiles?: string[];
  packageJson?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
}

export function validateChange(newContent: string, filePath: string, oldContent?: string, context?: ValidationContext): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  checks.push(...checkBalancedBrackets(newContent, filePath));
  checks.push(...checkImports(newContent, filePath));
  checks.push(...checkCatastrophicPatterns(newContent, filePath));

  if (oldContent !== undefined && oldContent.length > 0) {
    checks.push(...checkSizeReduction(newContent, oldContent, filePath));
  }

  if (context?.projectFiles) {
    checks.push(...checkImportResolution(newContent, filePath, context.projectFiles));
  }

  checks.push(...checkDuplicateExports(newContent, filePath));

  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'tsx' || ext === 'jsx') {
    checks.push(...checkJsxBalance(newContent, filePath));
  }

  if (context?.packageJson) {
    checks.push(...checkPackageReferences(newContent, filePath, context.packageJson));
  }

  if (checks.length === 0) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'info',
      message: 'All safety checks passed — build freely',
      file: filePath,
    });
  }

  return checks;
}

function checkSizeReduction(newContent: string, oldContent: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const oldLines = oldContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  const ratio = newLines / oldLines;

  if (oldLines > 20 && ratio < 0.3) {
    checks.push({
      id: nextId(),
      type: 'runtime',
      severity: 'error',
      message: `This looks like a snippet, not a full file replacement. The existing file has ${oldLines} lines but the new content only has ${newLines} lines (${Math.round(ratio * 100)}%). This will delete most of the file. Ask Grok to return the COMPLETE file instead.`,
      file,
    });
  } else if (oldLines > 20 && ratio < 0.6) {
    checks.push({
      id: nextId(),
      type: 'runtime',
      severity: 'warning',
      message: `New content is significantly smaller: ${oldLines} → ${newLines} lines (${Math.round(ratio * 100)}%). Make sure Grok returned the complete file, not just a snippet.`,
      file,
    });
  }

  return checks;
}

function checkBalancedBrackets(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
  const closers = new Set(Object.values(pairs));
  let inString = false;
  let stringChar = '';
  let line = 1;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '\n') line++;
    
    if (inString) {
      if (c === stringChar && content[i - 1] !== '\\') inString = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = true;
      stringChar = c;
      continue;
    }

    if (pairs[c]) {
      stack.push({ char: c, line });
    } else if (closers.has(c)) {
      const last = stack.pop();
      if (last && pairs[last.char] !== c) {
        checks.push({
          id: nextId(),
          type: 'syntax',
          severity: 'error',
          message: `Mismatched bracket: expected '${pairs[last.char]}' but found '${c}'`,
          line,
          file,
        });
      }
    }
  }

  // Only error on severely unbalanced (3+ unclosed)
  if (stack.length >= 3) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'error',
      message: `${stack.length} unclosed bracket(s) — likely broken syntax`,
      line: stack[0].line,
      file,
    });
  } else if (stack.length > 0) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'warning',
      message: `${stack.length} unclosed bracket(s) — minor syntax issue`,
      line: stack[0].line,
      file,
    });
  }

  return checks;
}

function checkImports(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (file.includes(importPath.replace('./', '').replace('@/', 'src/'))) {
      checks.push({
        id: nextId(),
        type: 'circular',
        severity: 'error',
        message: `Circular self-import via '${importPath}'`,
        file,
      });
    }
  }

  return checks;
}

// Only block patterns that would crash or freeze the browser
function checkCatastrophicPatterns(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  
  const patterns = [
    { regex: /while\s*\(\s*true\s*\)\s*\{[^}]*\}/g, msg: 'Synchronous infinite loop — will freeze the browser', severity: 'error' as const },
    { regex: /for\s*\(\s*;\s*;\s*\)\s*\{[^}]*\}/g, msg: 'Synchronous infinite loop — will freeze', severity: 'error' as const },
  ];

  for (const { regex, msg, severity } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Allow if there's a break/return inside
      const loopBody = match[0];
      if (loopBody.includes('break') || loopBody.includes('return') || loopBody.includes('await')) continue;
      const line = content.substring(0, match.index).split('\n').length;
      checks.push({ id: nextId(), type: 'runtime', severity, message: msg, line, file });
    }
  }

  return checks;
}

function checkImportResolution(content: string, file: string, projectFiles: string[]): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const importRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
  let match;

  const fileDir = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : '';

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    let resolvedPath: string;
    if (importPath.startsWith('./')) {
      resolvedPath = fileDir ? `${fileDir}/${importPath.slice(2)}` : importPath.slice(2);
    } else if (importPath.startsWith('../')) {
      const dirParts = fileDir.split('/');
      let relPath = importPath;
      while (relPath.startsWith('../')) {
        dirParts.pop();
        relPath = relPath.slice(3);
      }
      resolvedPath = dirParts.length > 0 ? `${dirParts.join('/')}/${relPath}` : relPath;
    } else {
      continue;
    }

    const basePath = resolvedPath.replace(/\.[^/.]+$/, '');
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    const found = extensions.some(ext => projectFiles.includes(basePath + ext) || projectFiles.includes(resolvedPath + ext) || projectFiles.includes(resolvedPath));

    if (!found) {
      checks.push({
        id: nextId(),
        type: 'import',
        severity: 'warning',
        message: `Import '${importPath}' not found in project`,
        file,
      });
    }
  }

  return checks;
}

function checkDuplicateExports(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  const defaultExportMatches = content.match(/export\s+default\s/g);
  if (defaultExportMatches && defaultExportMatches.length > 1) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'warning',
      message: `Multiple 'export default' declarations found (${defaultExportMatches.length})`,
      file,
    });
  }

  const namedExportRegex = /export\s+(?:const|let|var|function|class|enum|type|interface)\s+(\w+)/g;
  const exportNames = new Map<string, number>();
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    const name = match[1];
    exportNames.set(name, (exportNames.get(name) || 0) + 1);
  }
  for (const [name, count] of exportNames) {
    if (count > 1) {
      checks.push({
        id: nextId(),
        type: 'syntax',
        severity: 'warning',
        message: `Duplicate named export '${name}' (${count} times)`,
        file,
      });
    }
  }

  return checks;
}

function checkJsxBalance(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  const withoutStringsAndComments = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '""');

  const openTagRegex = /<([A-Z][A-Za-z0-9.]*)\b[^/>]*(?<!\/)>/g;
  const closeTagRegex = /<\/([A-Z][A-Za-z0-9.]*)\s*>/g;

  const openTags: string[] = [];
  const closeTags: string[] = [];
  let m;

  while ((m = openTagRegex.exec(withoutStringsAndComments)) !== null) {
    openTags.push(m[1]);
  }
  while ((m = closeTagRegex.exec(withoutStringsAndComments)) !== null) {
    closeTags.push(m[1]);
  }

  const diff = Math.abs(openTags.length - closeTags.length);
  if (diff >= 3) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'warning',
      message: `JSX tag imbalance: ${openTags.length} opening vs ${closeTags.length} closing component tags (difference of ${diff})`,
      file,
    });
  }

  return checks;
}

function checkPackageReferences(content: string, file: string, packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const allDeps = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
  ]);

  const builtins = new Set([
    'react', 'react-dom', 'react/jsx-runtime',
    'path', 'fs', 'os', 'url', 'util', 'stream', 'http', 'https', 'crypto', 'events',
    'child_process', 'buffer', 'querystring', 'assert', 'net', 'tls', 'zlib',
    'node:path', 'node:fs', 'node:os', 'node:url', 'node:util', 'node:stream',
    'node:http', 'node:https', 'node:crypto', 'node:events', 'node:child_process',
    'node:buffer', 'node:querystring', 'node:assert', 'node:net', 'node:tls', 'node:zlib',
  ]);

  const importRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"./][^'"]*)['"]/g;
  const seen = new Set<string>();
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('@/') || importPath.startsWith('@assets/')) continue;
    if (builtins.has(importPath)) continue;

    const pkgName = importPath.startsWith('@')
      ? importPath.split('/').slice(0, 2).join('/')
      : importPath.split('/')[0];

    if (seen.has(pkgName)) continue;
    seen.add(pkgName);

    if (!allDeps.has(pkgName)) {
      checks.push({
        id: nextId(),
        type: 'import',
        severity: 'info',
        message: `Package '${pkgName}' not in package.json — may need to install`,
        file,
      });
    }
  }

  return checks;
}

export function getSeverityColor(severity: SafetyCheck['severity']): string {
  switch (severity) {
    case 'error': return 'text-terminal-red';
    case 'warning': return 'text-terminal-amber';
    case 'info': return 'text-terminal-green';
  }
}
