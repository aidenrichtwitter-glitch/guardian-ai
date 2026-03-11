export interface ParsedBlock {
  filePath: string;
  code: string;
  language: string;
}

export interface ParsedDependencies {
  dependencies: string[];
  devDependencies: string[];
}

export interface ActionItem {
  type: 'command' | 'env' | 'install' | 'manual' | 'create-dir' | 'rename' | 'delete' | 'info';
  description: string;
  command?: string;
  url?: string;
}

const VALID_PKG_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(@[^\s]*)?$/;

const NOT_A_PACKAGE = new Set([
  'npm', 'npx', 'yarn', 'pnpm', 'bun', 'node', 'deno',
  'run', 'dev', 'start', 'build', 'test', 'serve', 'watch', 'lint', 'deploy', 'preview',
  'install', 'add', 'remove', 'uninstall', 'update', 'init', 'create',
  'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'echo', 'touch', 'git', 'curl', 'wget',
  'then', 'and', 'or', 'the', 'a', 'an', 'to', 'in', 'of', 'for', 'with', 'from',
  'your', 'this', 'that', 'it', 'is', 'are', 'was', 'be', 'has', 'have', 'do', 'does',
  'if', 'not', 'no', 'yes', 'on', 'off', 'up', 'so', 'but', 'by', 'at', 'as',
  'server', 'app', 'application', 'project', 'file', 'directory', 'folder',
  'next', 'first', 'following', 'above', 'below', 'after', 'before',
  'all', 'any', 'each', 'every', 'both', 'new', 'old',
]);

function sanitizePackageName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || !VALID_PKG_NAME.test(trimmed)) return null;
  if (/[;&|`$(){}]/.test(trimmed)) return null;
  const baseName = trimmed.replace(/@[^\s]*$/, '');
  if (NOT_A_PACKAGE.has(baseName.toLowerCase())) return null;
  if (baseName.length <= 1 && !trimmed.startsWith('@')) return null;
  return trimmed;
}

function extractInstallPackages(cmdLine: string, deps: string[], devDeps: string[]) {
  const args = cmdLine.split(/\s*[;&|]+/)[0];
  const isDev = /--save-dev|-D/.test(args);
  const tokens = args.replace(/--save-dev|-D|--save|--global|-g/g, '').trim().split(/\s+/);
  for (const t of tokens) {
    if (t.startsWith('-')) continue;
    const safe = sanitizePackageName(t);
    if (safe) {
      if (isDev) devDeps.push(safe);
      else deps.push(safe);
    }
  }
}

export function parseDependencies(text: string): ParsedDependencies {
  const deps: string[] = [];
  const devDeps: string[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const blockMatch = normalized.match(/===\s*DEPENDENCIES\s*===\s*\n([\s\S]*?)(?:===\s*END_DEPENDENCIES\s*===|(?=\n===\s)|\n\n\n)/);
  if (blockMatch) {
    const block = blockMatch[1];
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      const devMatch = trimmed.match(/^(?:dev:\s*|--save-dev\s+)(.+)/i);
      if (devMatch) {
        for (const p of devMatch[1].split(/\s+/)) {
          const safe = sanitizePackageName(p);
          if (safe) devDeps.push(safe);
        }
      } else {
        for (const p of trimmed.split(/\s+/)) {
          const safe = sanitizePackageName(p);
          if (safe) deps.push(safe);
        }
      }
    }
  }

  const installRegex = /```(?:bash|sh|shell|terminal|console|cmd|powershell)?\n([\s\S]*?)```/g;
  let m;
  while ((m = installRegex.exec(normalized)) !== null) {
    const cmdBlock = m[1];
    for (const line of cmdBlock.split('\n')) {
      const trimmed = line.replace(/^\$\s*/, '').trim();
      const npmMatch = trimmed.match(/^npm\s+(?:install|i|add)\s+(.*)/i);
      if (npmMatch) {
        extractInstallPackages(npmMatch[1], deps, devDeps);
        continue;
      }
      const yarnMatch = trimmed.match(/^yarn\s+add\s+(.*)/i);
      if (yarnMatch) {
        extractInstallPackages(yarnMatch[1], deps, devDeps);
        continue;
      }
      const pnpmMatch = trimmed.match(/^pnpm\s+(?:add|install|i)\s+(.*)/i);
      if (pnpmMatch) {
        extractInstallPackages(pnpmMatch[1], deps, devDeps);
        continue;
      }
      const bunMatch = trimmed.match(/^bun\s+(?:add|install|i)\s+(.*)/i);
      if (bunMatch) {
        extractInstallPackages(bunMatch[1], deps, devDeps);
        continue;
      }
    }
  }

  const proseInstallRe = /(?:npm\s+install|npm\s+i|yarn\s+add|pnpm\s+add|bun\s+add)\s+/gi;
  let proseM;
  while ((proseM = proseInstallRe.exec(normalized)) !== null) {
    const afterCmd = normalized.slice(proseM.index + proseM[0].length);
    const lineEnd = afterCmd.indexOf('\n');
    const rest = lineEnd >= 0 ? afterCmd.slice(0, lineEnd) : afterCmd;
    const cutAtSentence = rest.split(/[`'",.;:!?]|\s+(?:then|and|or|but|after|before|next|to|into|the|your|this|that|with|from|so)\s/i)[0];
    const isDev = /--save-dev|-D/.test(cutAtSentence);
    const tokens = cutAtSentence.replace(/--save-dev|-D|--save|--legacy-peer-deps|--force/g, '').trim().split(/\s+/);
    for (const t of tokens) {
      if (!t || t.startsWith('-')) continue;
      const cleaned = t.replace(/[.,;:!?]+$/, '');
      const safe = sanitizePackageName(cleaned);
      if (safe) {
        if (isDev) devDeps.push(safe);
        else deps.push(safe);
      }
    }
  }

  return {
    dependencies: [...new Set(deps)],
    devDependencies: [...new Set(devDeps)],
  };
}

const FILE_EXT_PATTERN = '\\S+\\.(?:tsx?|jsx?|css|scss|less|html|json|md|py|sh|sql|yaml|yml|toml|env|cfg|conf|xml|svg|vue|svelte|go|rs|rb|java|kt|swift|c|cpp|h|hpp|prisma|graphql|gql|glsl|vert|frag|proto|makefile|dockerfile|gitignore|lock|wasm|mjs|cjs)';

function isValidFilePath(candidate: string): boolean {
  if (/^[a-z]+:\/\//i.test(candidate)) return false;
  if (candidate.includes(' ')) return false;
  if (candidate.length > 200) return false;
  if (/^[A-Z]:\\/.test(candidate)) return false;
  return true;
}

function extractFilePathFromCode(code: string): { filePath: string; cleanedCode: string } {
  const lines = code.split('\n');
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    const inlineMatch = line.match(new RegExp(`^(?:\\/\\/|#|/\\*|<!--)\\s*(?:file:\\s?|filename:\\s?|path:\\s?)(${FILE_EXT_PATTERN})`, 'i'));
    if (inlineMatch && isValidFilePath(inlineMatch[1])) {
      const remaining = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').trim();
      return { filePath: inlineMatch[1], cleanedCode: remaining };
    }
  }
  return { filePath: '', cleanedCode: code };
}

export function mergeCSSVariables(snippet: string, existingCSS: string): string | null {
  const varRegex = /--[\w-]+:\s*[^;]+;/g;
  const newVars = new Map<string, string>();
  let match;
  while ((match = varRegex.exec(snippet)) !== null) {
    const line = match[0];
    const name = line.match(/^(--[\w-]+):/)?.[1];
    if (name) newVars.set(name, line);
  }
  if (newVars.size === 0) return null;

  let merged = existingCSS;
  for (const [name, fullLine] of newVars) {
    const existingRegex = new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}):\\s*[^;]+;`, 'g');
    if (existingRegex.test(merged)) {
      merged = merged.replace(existingRegex, fullLine);
    }
  }

  const bodyMatch = snippet.match(/body\s*\{[\s\S]*?\}/);
  if (bodyMatch && !merged.includes(bodyMatch[0])) {
  }

  return merged !== existingCSS ? merged : null;
}

export function isLikelySnippet(code: string, existingContent: string): boolean {
  if (!existingContent || existingContent.length === 0) return false;
  const codeLines = code.split('\n').length;
  const existingLines = existingContent.split('\n').length;
  return existingLines > 20 && (codeLines / existingLines) < 0.5;
}

function extractFilePathFromPrecedingText(text: string, fenceIndex: number): string {
  const preceding = text.substring(Math.max(0, fenceIndex - 800), fenceIndex);
  const lines = preceding.split('\n').reverse();
  const fileExtRe = new RegExp(`(?:\`|\\*\\*|")((?:[\\w./-]+/)?${FILE_EXT_PATTERN})(?:\`|\\*\\*|")`, 'i');
  const headingFileRe = new RegExp(`^#{1,6}\\s+(?:\`|\\*\\*|")?\\s*((?:[\\w./-]+/)?${FILE_EXT_PATTERN})\\s*(?:\`|\\*\\*|")?\\s*$`, 'i');
  const createSaveRe = new RegExp(`(?:create|save|name|call|replace|update|modify|edit|add|put|write)\\s+(?:a\\s+)?(?:new\\s+)?(?:file\\s+)?(?:called|named|as|to)?\\s*\`?((?:[\\w./-]+/)?${FILE_EXT_PATTERN})\`?`, 'i');
  const contextualRe = new RegExp(`(?:open|in|check|see|look at|force|reset|edit|update|replace|modify|confirm|ensure|make sure)\\s+(?:the\\s+)?(?:file\\s+)?(?:your\\s+)?(?:the\\s+)?\`?((?:[\\w./-]+/)?${FILE_EXT_PATTERN})\`?`, 'i');
  const bareFileRe = new RegExp(`(?:^|\\s|\\*\\*|—|–|-|\\()((?:[\\w./-]+/)?${FILE_EXT_PATTERN})(?:\\s|\\*\\*|—|–|-|\\)|\\.|,|:|$)`, 'i');

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('```')) break;

    const headingMatch = line.match(headingFileRe);
    if (headingMatch && isValidFilePath(headingMatch[1])) return headingMatch[1];

    const inlineMatch = line.match(fileExtRe);
    if (inlineMatch && isValidFilePath(inlineMatch[1])) return inlineMatch[1];

    const createMatch = line.match(createSaveRe);
    if (createMatch && isValidFilePath(createMatch[1])) return createMatch[1];

    const contextMatch = line.match(contextualRe);
    if (contextMatch && isValidFilePath(contextMatch[1])) return contextMatch[1];
  }

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('```')) break;
    const bareMatch = line.match(bareFileRe);
    if (bareMatch && isValidFilePath(bareMatch[1])) return bareMatch[1];
  }
  return '';
}

function normalizeLang(lang: string): string {
  const l = lang.toLowerCase();
  const map: Record<string, string> = {
    javascript: 'js', js: 'js', jsx: 'jsx', mjs: 'js', cjs: 'js',
    typescript: 'ts', ts: 'ts', tsx: 'tsx', mts: 'ts',
    shell: 'bash', sh: 'bash', bash: 'bash', terminal: 'bash', console: 'bash',
    html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml', yml: 'yaml',
    python: 'py', py: 'py', ruby: 'rb', rb: 'rb', rust: 'rs', rs: 'rs', go: 'go',
    prisma: 'prisma', graphql: 'graphql', sql: 'sql', dockerfile: 'dockerfile',
  };
  return map[l] || l;
}

function inferFilePathFromContent(code: string, language: string): string {
  const c = code.trim();
  const lang = normalizeLang(language);
  const isTS = lang === 'ts' || lang === 'tsx';
  const isJSX = lang === 'jsx' || lang === 'tsx';
  const hasTSImports = /from\s+['"][^'"]+\.tsx?['"]/.test(c) || /import\s+type\b/.test(c);
  const useTS = isTS || hasTSImports;

  if (/\bdefineConfig\b/.test(c) && /from\s+['"]vite['"]/i.test(c))
    return useTS ? 'vite.config.ts' : 'vite.config.js';
  if (/\bdefineConfig\b/.test(c) && /from\s+['"]vitest/i.test(c))
    return useTS ? 'vitest.config.ts' : 'vitest.config.js';
  if (/module\.exports\s*=/.test(c) && /tailwind/i.test(c))
    return 'tailwind.config.js';
  if (/(?:export\s+default|module\.exports)\s*/.test(c) && /content\s*:/.test(c) && /theme\s*:/.test(c))
    return 'tailwind.config.js';
  if (/\bdefineConfig\b/.test(c) && /from\s+['"]nuxt/i.test(c))
    return 'nuxt.config.ts';
  if (/\bnextConfig\b|module\.exports/.test(c) && /\b(?:reactStrictMode|images|webpack)\b/.test(c))
    return 'next.config.js';
  if (/\bnextConfig\b/.test(c) && /from\s+['"]next['"]/i.test(c))
    return 'next.config.mjs';

  if (/ReactDOM\.createRoot|ReactDOM\.render|createRoot\(/.test(c)) {
    if (/\.tsx['"]/.test(c) || isJSX && useTS) return 'src/main.tsx';
    if (/\.jsx['"]/.test(c) || isJSX) return 'src/main.jsx';
    return useTS ? 'src/main.tsx' : 'src/main.jsx';
  }
  if (/createApp\(/.test(c) && /from\s+['"]vue['"]/i.test(c))
    return useTS ? 'src/main.ts' : 'src/main.js';

  if (/postcss/i.test(c) && /(?:module\.exports|plugins)/.test(c))
    return 'postcss.config.js';

  if (/<div\s+id=["']root["']/.test(c) && /<script\b/.test(c))
    return 'index.html';
  if (/<div\s+id=["'](?:root|app)["']/.test(c) && /<script\s+type=["']module["']/.test(c))
    return 'index.html';

  if (/^@tailwind\s/m.test(c) || /^@import\s+['"]tailwindcss/m.test(c))
    return 'src/index.css';

  if (/from\s+['"]express['"]/i.test(c) && /app\.listen|app\.use/.test(c))
    return useTS ? 'server/index.ts' : 'server/index.js';

  if (/\bprisma\b/i.test(c) && /datasource|generator|model\s+\w+\s*\{/.test(c))
    return 'prisma/schema.prisma';

  if (/^\s*\{/.test(c) && /"(?:name|version|scripts|dependencies)"/.test(c))
    return 'package.json';

  if (/^FROM\s+\w/m.test(c) && /\b(?:RUN|CMD|EXPOSE|COPY|WORKDIR)\b/.test(c))
    return 'Dockerfile';

  if (/"compilerOptions"/.test(c) && /"(?:jsx|module|target|strict|paths|baseUrl|outDir)"/.test(c))
    return 'tsconfig.json';

  return '';
}

export function parseActionItems(text: string): ActionItem[] {
  type PositionedItem = ActionItem & { pos: number };
  const positioned: PositionedItem[] = [];
  const seen = new Set<string>();
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const fenceRanges: [number, number][] = [];
  const fenceRe = /```[\s\S]*?```/g;
  let fm;
  while ((fm = fenceRe.exec(normalized)) !== null) {
    fenceRanges.push([fm.index, fm.index + fm[0].length]);
  }

  function isInsideFence(pos: number): boolean {
    for (const [start, end] of fenceRanges) {
      if (pos >= start && pos < end) return true;
    }
    return false;
  }

  function addItem(item: ActionItem, pos: number) {
    const key = `${item.type}:${item.command || item.description}`;
    if (seen.has(key)) return;
    seen.add(key);
    positioned.push({ ...item, pos });
  }

  const commandsBlockMatch = normalized.match(/===\s*COMMANDS\s*===\s*\n([\s\S]*?)(?:===\s*END_COMMANDS\s*===|(?=\n===\s)|\n\n\n)/);
  if (commandsBlockMatch) {
    const block = commandsBlockMatch[1];
    const blockPos = normalized.indexOf(commandsBlockMatch[0]);
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      const DEV_SERVER_RE = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
      if (DEV_SERVER_RE.test(trimmed)) continue;
      if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s+[^-]/i.test(trimmed) && !/(?:-g|--global)/.test(trimmed)) continue;
      addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed }, blockPos);
    }
  }

  const shellCmdRe = /```(?:bash|sh|shell|terminal|console|cmd|powershell)\n([\s\S]*?)```/g;
  let sm;
  while ((sm = shellCmdRe.exec(normalized)) !== null) {
    const cmdBlock = sm[1];
    let lineOffset = sm.index + sm[0].indexOf(sm[1]);
    for (const line of cmdBlock.split('\n')) {
      const rawTrimmed = line.replace(/^\$\s*/, '').trim();
      if (rawTrimmed && !rawTrimmed.startsWith('#')) {
        const trimmed = rawTrimmed.replace(/\s+#\s+.*$/, '').trim();
        const DEV_SERVER_RE = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
        const SCAFFOLD_RE = /^(?:npm\s+(?:create|init)|npx\s+create-|yarn\s+create|pnpm\s+create|bun\s+create)\s/i;
        if (SCAFFOLD_RE.test(trimmed)) {
        } else if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s+[^-]/i.test(trimmed) && !/\s-g\b/.test(trimmed) && !/\s--global\b/.test(trimmed)) {
        } else if (DEV_SERVER_RE.test(trimmed)) {
        } else if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i)\s*$/i.test(trimmed)) {
          addItem({ type: 'command', description: `Install dependencies: ${trimmed}`, command: trimmed }, lineOffset);
        } else if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s+.*(?:-g|--global)/i.test(trimmed)) {
          addItem({ type: 'command', description: `Install global: ${trimmed}`, command: trimmed }, lineOffset);
        } else if (/^(?:npm|yarn|pnpm|bun)\s+(?:run|test|build|why)\b/i.test(trimmed)) {
          addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed }, lineOffset);
        } else if (/^(?:curl|wget)\s+.*\|\s*(?:bash|sh|zsh)\s*$/i.test(trimmed)) {
          const url = trimmed.match(/https?:\/\/[^\s|]+/)?.[0] || '';
          if (url) addItem({ type: 'command', description: `Install script: ${url}`, command: `curl-install:${url}` }, lineOffset);
        } else if (/^npx\s+/i.test(trimmed)) {
          addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed }, lineOffset);
        } else if (/^mkdir\s/i.test(trimmed)) {
          addItem({ type: 'create-dir', description: `Create directory: ${trimmed.replace(/^mkdir\s+(-p\s+)?/i, '')}`, command: trimmed }, lineOffset);
        } else if (/^rm\s/i.test(trimmed)) {
          addItem({ type: 'delete', description: `Delete: ${trimmed.replace(/^rm\s+(-rf?\s+)?/i, '')}`, command: trimmed }, lineOffset);
        } else if (/^mv\s/i.test(trimmed)) {
          addItem({ type: 'rename', description: `Move/rename: ${trimmed.replace(/^mv\s+/i, '')}`, command: trimmed }, lineOffset);
        } else if (/^(?:touch|cp|cat|echo)\s+/i.test(trimmed)) {
          addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed }, lineOffset);
        } else if (/^(?:export|set)\s+\w+=/.test(trimmed)) {
          const varName = trimmed.match(/^(?:export|set)\s+(\w+)=/)?.[1] || '';
          addItem({ type: 'env', description: `Set environment variable: ${varName}`, command: trimmed }, lineOffset);
        } else if (/^cd\s+/.test(trimmed)) {
        } else if (/^(?:node|python|pip)\s+/.test(trimmed)) {
          addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed }, lineOffset);
        } else if (/^corepack\s+/i.test(trimmed)) {
          addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed }, lineOffset);
        } else if (trimmed.length > 2 && trimmed.length < 200 && /^[a-z_./~]/.test(trimmed) && !/^[→➜▸▹⮕●•\-\s>]/.test(trimmed) && !/^[A-Z]{2,}\s/.test(trimmed) && !/^(Local|Network|ready|press|open|http|https|localhost)/i.test(trimmed)) {
          addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed }, lineOffset);
        }
      }
      lineOffset += line.length + 1;
    }
  }

  const envPatterns = [
    /(?:add|set|create|put|configure)\s+(?:an?\s+)?(?:environment\s+)?(?:variable|env\s+var|secret)\s+(?:called\s+)?`?(\w+)`?\s*(?:=|to|with\s+value)\s*`?([^`\n]*)`?/gi,
    /(?:in\s+your\s+)?[`"]?\.env[`"]?\s+(?:file\s+)?(?:add|set|create):\s*\n?\s*`?(\w+)\s*=\s*([^`\n]*)`?/gi,
    /`(\w+)=([^`\n]*)`\s+(?:in|to)\s+(?:your\s+)?[`"]?\.env/gi,
  ];
  for (const pattern of envPatterns) {
    let em;
    while ((em = pattern.exec(normalized)) !== null) {
      if (isInsideFence(em.index)) continue;
      addItem({ type: 'env', description: `Set ${em[1]}=${em[2] || '...'}`, command: `${em[1]}=${em[2]}` }, em.index);
    }
  }

  let runningOffset = 0;
  const proseLines = normalized.split('\n');
  for (let i = 0; i < proseLines.length; i++) {
    const line = proseLines[i].trim();
    const lineStart = runningOffset;
    runningOffset += proseLines[i].length + 1;
    if (isInsideFence(lineStart)) continue;
    if (!line) continue;

    const PROSE_CMD_RE = /`([^`]{3,80})`/g;
    let proseCmd;
    while ((proseCmd = PROSE_CMD_RE.exec(line)) !== null) {
      const cmd = proseCmd[1].trim();
      const DEV_CMD = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
      const SHELL_CMD_RE = /^(?:npm|yarn|pnpm|bun|npx|node|python|pip|cargo|go|corepack|docker|git|curl|wget|mkdir|rm|mv|cp|cat|touch|echo|chmod|chown|ln|source)\s/i;
      if (SHELL_CMD_RE.test(cmd)) {
        if (DEV_CMD.test(cmd)) continue;
        if (/^(?:curl|wget)\s+.*\|\s*(?:bash|sh|zsh)/i.test(cmd)) {
          const url = cmd.match(/https?:\/\/[^\s|]+/)?.[0] || '';
          if (url) addItem({ type: 'command', description: `Install script: ${url}`, command: `curl-install:${url}` }, lineStart);
          continue;
        }
        if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s+[^-]/i.test(cmd) && !/(?:-g|--global)/.test(cmd)) continue;
        if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i)\s*$/i.test(cmd)) {
          addItem({ type: 'command', description: `Install dependencies: ${cmd}`, command: cmd }, lineStart);
        } else if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s+.*(?:-g|--global)/i.test(cmd)) {
          addItem({ type: 'command', description: `Install global: ${cmd}`, command: cmd }, lineStart);
        } else if (/^rm\s/i.test(cmd)) {
          addItem({ type: 'delete', description: `Delete: ${cmd.replace(/^rm\s+(-rf?\s+)?/i, '')}`, command: cmd }, lineStart);
        } else if (/^mkdir\s/i.test(cmd)) {
          addItem({ type: 'create-dir', description: `Create directory: ${cmd.replace(/^mkdir\s+(-p\s+)?/i, '')}`, command: cmd }, lineStart);
        } else if (/^mv\s/i.test(cmd)) {
          addItem({ type: 'rename', description: `Move/rename: ${cmd.replace(/^mv\s+/i, '')}`, command: cmd }, lineStart);
        } else {
          addItem({ type: 'command', description: `Run: ${cmd}`, command: cmd }, lineStart);
        }
      }
    }

    if (/(?:restart|reload|refresh)\s+(?:your\s+)?(?:dev\s+)?(?:server|app|application|browser|page)/i.test(line)) {
      addItem({ type: 'manual', description: 'Restart your dev server' }, lineStart);
    }

    const createDirMatch = line.match(/(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:directory|folder)\s+(?:called\s+)?`([^\s`]+)`/i);
    if (createDirMatch && /[\/\\]|^\w+$/.test(createDirMatch[1]) && !/^(?:for|the|your|a|an|and|or|to|in|it|is|this|that)$/i.test(createDirMatch[1])) {
      addItem({ type: 'create-dir', description: `Create directory: ${createDirMatch[1]}`, command: `mkdir -p ${createDirMatch[1]}` }, lineStart);
    }

    const renameMatch = line.match(/(?:rename|move)\s+`?([^\s`]+)`?\s+(?:to|→|->)\s+`?([^\s`]+)`?/i);
    if (renameMatch) {
      addItem({ type: 'rename', description: `Rename ${renameMatch[1]} → ${renameMatch[2]}`, command: `mv ${renameMatch[1]} ${renameMatch[2]}` }, lineStart);
    }

    const deleteMatch = line.match(/(?:delete|remove)\s+(?:the\s+)?(?:file\s+)?`?([^\s`]+\.\w+)`?/i);
    if (deleteMatch) {
      addItem({ type: 'delete', description: `Delete: ${deleteMatch[1]}`, command: `rm -rf ${deleteMatch[1]}` }, lineStart);
    }

    const downloadMatch = line.match(/(?:download|fetch|get|grab)\s+(?:the\s+)?(?:\w+\s+)?(?:from\s+)?`?(https?:\/\/[^\s`]+)`?/i);
    if (downloadMatch) {
      addItem({ type: 'manual', description: `Download from: ${downloadMatch[1]}`, command: downloadMatch[1] }, lineStart);
    }

    const apiKeyMatch = line.match(/(?:get|obtain|create|generate|sign\s+up\s+for)\s+(?:an?\s+)?(?:API\s+key|token|secret|credentials)\s+(?:from|at|on)\s+(?:`?([^\s`]+)`?|(\w+))/i);
    if (apiKeyMatch) {
      addItem({ type: 'manual', description: `Get API key/credentials from ${apiKeyMatch[1] || apiKeyMatch[2]}` }, lineStart);
    }

    const programInstallPatterns = [
      /(?:install|download|set\s*up|get)\s+(?:the\s+)?`?(g\+\+|gcc|clang|cmake|make|python3?|pip3?|node(?:\.?js)?|ruby|rustc?|cargo|go(?:lang)?|java|jdk|dotnet|\.net|php|perl|lua|zig|elixir|erlang|ocaml|haskell|ghc|stack|docker|git|curl|wget|ffmpeg|imagemagick|graphviz|sqlite3?|postgresql|mysql|redis|mongodb|nginx|apache|openssl|pkg-config|autoconf|automake|libtool|flex|bison|nasm|meson|ninja|bazel|gradle|maven|sbt|leiningen|deno|bun)`?/i,
      /(?:you(?:'ll)?\s+)?need\s+(?:to\s+(?:have\s+)?(?:install(?:ed)?|download(?:ed)?)?\s+)?`?(g\+\+|gcc|clang|cmake|make|python3?|pip3?|node(?:\.?js)?|ruby|rustc?|cargo|go(?:lang)?|java|jdk|dotnet|\.net|php|perl|lua|docker|git|curl|wget|ffmpeg|imagemagick|sqlite3?|postgresql|mysql|redis|mongodb|deno|bun)`?(?:\s+installed)?/i,
      /(?:requires?|depends?\s+on)\s+`?(g\+\+|gcc|clang|cmake|python3?|node(?:\.?js)?|rustc?|cargo|go(?:lang)?|java|jdk|docker|git|ffmpeg|sqlite3?)`?/i,
    ];
    for (const pat of programInstallPatterns) {
      const pMatch = line.match(pat);
      if (pMatch) {
        const program = (pMatch[1] || '').replace(/`/g, '').trim();
        if (program) {
          addItem({ type: 'install', description: `Install program: ${program}`, command: program }, lineStart);
        }
      }
    }
  }

  positioned.sort((a, b) => a.pos - b.pos);
  return positioned.map(({ pos, ...item }) => item);
}

const KNOWN_LANG_TAGS = ['typescript', 'tsx', 'jsx', 'javascript', 'html', 'css', 'scss', 'less', 'json', 'python', 'bash', 'sh', 'shell', 'sql', 'yaml', 'yml', 'toml', 'xml', 'svg', 'vue', 'svelte', 'go', 'rust', 'ruby', 'java', 'kotlin', 'swift', 'cpp', 'glsl', 'graphql', 'proto', 'markdown', 'md', 'prisma', 'dockerfile', 'makefile'];

function parseUnfencedFileBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const headerRe = /^(?:\/\/|#|<!--)\s*(?:file:\s?|filename:\s?|path:\s?)(.+?)(?:-->)?\s*$/gm;
  const headers: { index: number; rawPath: string }[] = [];
  let hm;
  while ((hm = headerRe.exec(normalized)) !== null) {
    headers.push({ index: hm.index, rawPath: hm[1].trim() });
  }
  if (headers.length === 0) return [];

  for (let i = 0; i < headers.length; i++) {
    const lineEnd = normalized.indexOf('\n', headers[i].index);
    const codeStart = lineEnd >= 0 ? lineEnd + 1 : headers[i].index + headers[i].rawPath.length;
    const codeEnd = i + 1 < headers.length ? headers[i + 1].index : normalized.length;
    const code = normalized.substring(codeStart, codeEnd).trim();
    if (code.length === 0) continue;

    let rawPath = headers[i].rawPath;
    let language = 'typescript';
    for (const tag of KNOWN_LANG_TAGS) {
      if (rawPath.toLowerCase().endsWith(tag) && rawPath.length > tag.length) {
        const pathPart = rawPath.slice(0, rawPath.length - tag.length);
        if (/\.\w+$/.test(pathPart)) {
          rawPath = pathPart;
          language = tag;
          break;
        }
      }
    }

    if (!isValidFilePath(rawPath)) continue;

    const ext = rawPath.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';
    if (!language || language === 'typescript') {
      const extMap: Record<string, string> = {
        ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        html: 'html', css: 'css', json: 'json', py: 'python',
        sql: 'sql', yaml: 'yaml', yml: 'yaml', md: 'markdown',
        glsl: 'glsl', vue: 'vue', svelte: 'svelte', go: 'go',
        rs: 'rust', rb: 'ruby', java: 'java', swift: 'swift',
        sh: 'bash', scss: 'scss', less: 'less',
      };
      if (ext && extMap[ext]) language = extMap[ext];
    }

    blocks.push({ filePath: rawPath, code, language });
  }
  return blocks;
}

export function parseCodeBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const hasFences = /```\w*\n/.test(normalized);

  if (hasFences) {
    const regex = new RegExp(
      `(?:(?:\\/\\/|#|<!--)\\s*(?:file:\\s?)?(${FILE_EXT_PATTERN})\\s*(?:-->)?\\s*\\n)?\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\``,
      'g'
    );
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      let filePath = match[1] || '';
      const language = match[2] || 'typescript';
      let code = match[3].trim();

      if (/^(bash|sh|shell|terminal|console|cmd|powershell)$/i.test(language) && !filePath) {
        const isOperationalOnly = code.split('\n').every(l => {
          const t = l.replace(/^\$\s*/, '').trim();
          return !t || t.startsWith('#') ||
            /^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s/i.test(t) ||
            /^(?:npm|yarn|pnpm|bun)\s+(?:run|start|test|build|dev)\b/i.test(t) ||
            /^npx\s/i.test(t) ||
            /^(?:mkdir)\s/i.test(t) ||
            /^cd\s/i.test(t);
        });
        if (isOperationalOnly) continue;
      }

      if (!filePath) {
        const extracted = extractFilePathFromCode(code);
        if (extracted.filePath) {
          filePath = extracted.filePath;
          code = extracted.cleanedCode;
        }
      }

      if (!filePath) {
        filePath = extractFilePathFromPrecedingText(normalized, match.index);
      }

      if (!filePath) {
        filePath = inferFilePathFromContent(code, language);
      }

      if (code.length > 0) blocks.push({ filePath, code, language });
    }
  }

  if (blocks.length === 0) {
    const unfenced = parseUnfencedFileBlocks(normalized);
    if (unfenced.length > 0) return unfenced;
  }

  return blocks;
}
