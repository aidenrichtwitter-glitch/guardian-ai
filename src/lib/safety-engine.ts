import { SafetyCheck } from './self-reference';

// The safety engine - protects against self-destructive modifications
// This is the immune system of the recursive app

let idCounter = 0;
const nextId = () => `check-${++idCounter}`;

export function validateChange(newContent: string, filePath: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  // 1. Syntax validation - check for obvious syntax errors
  checks.push(...checkBalancedBrackets(newContent, filePath));
  
  // 2. Import validation
  checks.push(...checkImports(newContent, filePath));
  
  // 3. Dangerous pattern detection
  checks.push(...checkDangerousPatterns(newContent, filePath));
  
  // 4. Self-reference loop detection
  checks.push(...checkRecursionSafety(newContent, filePath));

  // If no issues found, add a pass
  if (checks.length === 0) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'info',
      message: 'All safety checks passed',
      file: filePath,
    });
  }

  return checks;
}

function checkBalancedBrackets(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']', '<': '>' };
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
    // Skip < > for TSX since they're used in JSX
    if (c === '<' || c === '>') continue;

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

  if (stack.length > 0) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'warning',
      message: `${stack.length} unclosed bracket(s) detected — possible syntax error`,
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
  let line = 0;

  while ((match = importRegex.exec(content)) !== null) {
    line = content.substring(0, match.index).split('\n').length;
    const importPath = match[1];

    // Check for circular self-import
    if (file.includes(importPath.replace('./', '').replace('@/', 'src/'))) {
      checks.push({
        id: nextId(),
        type: 'circular',
        severity: 'error',
        message: `⚠ CIRCULAR: File imports itself via '${importPath}'`,
        line,
        file,
      });
    }
  }

  return checks;
}

function checkDangerousPatterns(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  
  const patterns = [
    { regex: /eval\s*\(/g, msg: 'eval() detected — arbitrary code execution risk', severity: 'error' as const },
    { regex: /document\.write/g, msg: 'document.write() — can destroy DOM state', severity: 'error' as const },
    { regex: /innerHTML\s*=/g, msg: 'innerHTML assignment — XSS vulnerability', severity: 'warning' as const },
    { regex: /while\s*\(\s*true\s*\)/g, msg: 'Infinite loop detected — will freeze the app', severity: 'error' as const },
    { regex: /for\s*\(\s*;\s*;\s*\)/g, msg: 'Infinite loop detected — will freeze the app', severity: 'error' as const },
    { regex: /localStorage\.clear/g, msg: 'localStorage.clear() — will erase all saved state', severity: 'warning' as const },
    { regex: /window\.location\s*=|window\.location\.href\s*=/g, msg: 'Navigation redirect — will leave the app', severity: 'warning' as const },
  ];

  for (const { regex, msg, severity } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      checks.push({ id: nextId(), type: 'runtime', severity, message: msg, line, file });
    }
  }

  return checks;
}

function checkRecursionSafety(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  
  // Check if a component renders itself without a base case
  const componentMatch = content.match(/(?:function|const)\s+(\w+)/);
  if (componentMatch) {
    const name = componentMatch[1];
    const usesItself = new RegExp(`<${name}[\\s/>]`).test(content);
    const hasBaseCase = /if\s*\(|return\s+null|\.length\s*[<>=]|depth|level|maxDepth/.test(content);
    
    if (usesItself && !hasBaseCase) {
      checks.push({
        id: nextId(),
        type: 'circular',
        severity: 'error',
        message: `⚠ RECURSION: '${name}' renders itself without a visible base case`,
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
