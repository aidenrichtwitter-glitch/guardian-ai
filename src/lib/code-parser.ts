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
  type: 'command' | 'env' | 'install' | 'manual' | 'create-dir' | 'rename' | 'delete';
  description: string;
  command?: string;
}

const VALID_PKG_NAME = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;

function sanitizePackageName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || !VALID_PKG_NAME.test(trimmed)) return null;
  if (/[;&|`$(){}]/.test(trimmed)) return null;
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

  const proseInstall = normalized.match(/(?:^|\n)[^\n]*(?:npm\s+install|npm\s+i|yarn\s+add|pnpm\s+add|bun\s+add)\s+([\w@/._ -]+)/gi);
  if (proseInstall) {
    for (const match of proseInstall) {
      const pkgPart = match.replace(/.*(?:npm\s+install|yarn\s+add|pnpm\s+add|bun\s+add)\s+/i, '');
      const isDev = /--save-dev|-D/.test(pkgPart);
      const tokens = pkgPart.replace(/--save-dev|-D|--save/g, '').trim().split(/\s+/);
      for (const t of tokens) {
        if (t.startsWith('-')) continue;
        const safe = sanitizePackageName(t);
        if (safe) {
          if (isDev) devDeps.push(safe);
          else deps.push(safe);
        }
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
  const preceding = text.substring(Math.max(0, fenceIndex - 600), fenceIndex);
  const lines = preceding.split('\n').reverse();
  const fileExtRe = new RegExp(`(?:\`|\\*\\*|")((?:[\\w./-]+/)?${FILE_EXT_PATTERN})(?:\`|\\*\\*|")`, 'i');
  const headingFileRe = new RegExp(`^#{1,6}\\s+(?:\`|\\*\\*|")?\\s*((?:[\\w./-]+/)?${FILE_EXT_PATTERN})\\s*(?:\`|\\*\\*|")?\\s*$`, 'i');
  const createSaveRe = new RegExp(`(?:create|save|name|call|replace|update|modify|edit|add|put|write)\\s+(?:a\\s+)?(?:new\\s+)?(?:file\\s+)?(?:called|named|as|to)?\\s*\`?((?:[\\w./-]+/)?${FILE_EXT_PATTERN})\`?`, 'i');

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('```')) break;

    const headingMatch = line.match(headingFileRe);
    if (headingMatch && isValidFilePath(headingMatch[1])) return headingMatch[1];

    const inlineMatch = line.match(fileExtRe);
    if (inlineMatch && isValidFilePath(inlineMatch[1])) return inlineMatch[1];

    const createMatch = line.match(createSaveRe);
    if (createMatch && isValidFilePath(createMatch[1])) return createMatch[1];
  }
  return '';
}

export function parseActionItems(text: string): ActionItem[] {
  const items: ActionItem[] = [];
  const seen = new Set<string>();
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const fencedBlocks = new Set<string>();
  const fenceRe = /```[\s\S]*?```/g;
  let fm;
  while ((fm = fenceRe.exec(normalized)) !== null) {
    fencedBlocks.add(`${fm.index}-${fm.index + fm[0].length}`);
  }

  function isInsideFence(pos: number): boolean {
    for (const range of fencedBlocks) {
      const [start, end] = range.split('-').map(Number);
      if (pos >= start && pos < end) return true;
    }
    return false;
  }

  function addItem(item: ActionItem) {
    const key = `${item.type}:${item.command || item.description}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  }

  const shellCmdRe = /```(?:bash|sh|shell|terminal|console|cmd|powershell)\n([\s\S]*?)```/g;
  let sm;
  while ((sm = shellCmdRe.exec(normalized)) !== null) {
    const cmdBlock = sm[1];
    for (const line of cmdBlock.split('\n')) {
      const trimmed = line.replace(/^\$\s*/, '').trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s/i.test(trimmed)) continue;

      if (/^(?:npm|yarn|pnpm|bun)\s+(?:run|start|test|build|dev)\b/i.test(trimmed)) {
        addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed });
      } else if (/^npx\s+/i.test(trimmed)) {
        addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed });
      } else if (/^(?:mkdir|touch|rm|mv|cp|cat|echo)\s+/i.test(trimmed)) {
        if (/^mkdir\s/i.test(trimmed)) {
          addItem({ type: 'create-dir', description: `Create directory: ${trimmed.replace(/^mkdir\s+(-p\s+)?/i, '')}`, command: trimmed });
        } else if (/^rm\s/i.test(trimmed)) {
          addItem({ type: 'delete', description: `Delete: ${trimmed.replace(/^rm\s+(-rf?\s+)?/i, '')}`, command: trimmed });
        } else if (/^mv\s/i.test(trimmed)) {
          addItem({ type: 'rename', description: `Move/rename: ${trimmed.replace(/^mv\s+/i, '')}`, command: trimmed });
        } else {
          addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed });
        }
      } else if (/^(?:export|set)\s+\w+=/.test(trimmed)) {
        const varName = trimmed.match(/^(?:export|set)\s+(\w+)=/)?.[1] || '';
        addItem({ type: 'env', description: `Set environment variable: ${varName}`, command: trimmed });
      } else if (/^cd\s+/.test(trimmed) || /^node\s+/.test(trimmed) || /^python\s+/.test(trimmed) || /^pip\s+/.test(trimmed)) {
        addItem({ type: 'command', description: `Run: ${trimmed}`, command: trimmed });
      }
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
      addItem({ type: 'env', description: `Set ${em[1]}=${em[2] || '...'}`, command: `${em[1]}=${em[2]}` });
    }
  }

  const proseLines = normalized.split('\n');
  for (let i = 0; i < proseLines.length; i++) {
    const line = proseLines[i].trim();
    const lineStart = normalized.indexOf(line, i > 0 ? normalized.indexOf(proseLines[i - 1]) : 0);
    if (isInsideFence(lineStart)) continue;

    const runMatch = line.match(/(?:^[-*•]\s*)?(?:run|execute|type|enter)\s+`([^`]+)`/i);
    if (runMatch) {
      const cmd = runMatch[1];
      if (/^(?:npm|yarn|pnpm|bun|npx|node|python|pip|cargo|go)\s/i.test(cmd)) {
        if (/^(?:npm|yarn|pnpm|bun)\s+(?:install|i|add)\s/i.test(cmd)) {
          continue;
        }
        addItem({ type: 'command', description: `Run: ${cmd}`, command: cmd });
      }
    }

    const restartMatch = line.match(/(?:restart|reload|refresh)\s+(?:your\s+)?(?:dev\s+)?(?:server|app|application|browser|page)/i);
    if (restartMatch && !isInsideFence(lineStart)) {
      addItem({ type: 'manual', description: 'Restart your dev server' });
    }

    const createDirMatch = line.match(/(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:directory|folder)\s+(?:called\s+)?`([^\s`]+)`/i);
    if (createDirMatch && !isInsideFence(lineStart) && /[\/\\]|^\w+$/.test(createDirMatch[1]) && !/^(?:for|the|your|a|an|and|or|to|in|it|is|this|that)$/i.test(createDirMatch[1])) {
      addItem({ type: 'create-dir', description: `Create directory: ${createDirMatch[1]}`, command: `mkdir -p ${createDirMatch[1]}` });
    }

    const renameMatch = line.match(/(?:rename|move)\s+`?([^\s`]+)`?\s+(?:to|→|->)\s+`?([^\s`]+)`?/i);
    if (renameMatch && !isInsideFence(lineStart)) {
      addItem({ type: 'rename', description: `Rename ${renameMatch[1]} → ${renameMatch[2]}`, command: `mv ${renameMatch[1]} ${renameMatch[2]}` });
    }

    const deleteMatch = line.match(/(?:delete|remove)\s+(?:the\s+)?(?:file\s+)?`?([^\s`]+\.\w+)`?/i);
    if (deleteMatch && !isInsideFence(lineStart)) {
      addItem({ type: 'delete', description: `Delete: ${deleteMatch[1]}` });
    }

    const downloadMatch = line.match(/(?:download|fetch|get|grab)\s+(?:the\s+)?(?:\w+\s+)?(?:from\s+)?`?(https?:\/\/[^\s`]+)`?/i);
    if (downloadMatch) {
      addItem({ type: 'manual', description: `Download from: ${downloadMatch[1]}`, command: downloadMatch[1] });
    }

    const apiKeyMatch = line.match(/(?:get|obtain|create|generate|sign\s+up\s+for)\s+(?:an?\s+)?(?:API\s+key|token|secret|credentials)\s+(?:from|at|on)\s+(?:`?([^\s`]+)`?|(\w+))/i);
    if (apiKeyMatch && !isInsideFence(lineStart)) {
      addItem({ type: 'manual', description: `Get API key/credentials from ${apiKeyMatch[1] || apiKeyMatch[2]}` });
    }
  }

  return items;
}

export function parseCodeBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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

    if (code.length > 0) blocks.push({ filePath, code, language });
  }
  return blocks;
}
