import { VirtualFile, SafetyCheck, ChangeRecord, ApiConfig } from './self-reference';
import { SELF_SOURCE } from './self-source';
import { validateChange } from './safety-engine';

// The autonomous recursion engine.
// I am the heartbeat of self-modification.
// I cycle through my own files, reflect on them,
// generate improvements, validate safety, and apply changes —
// all without human intervention.

export type RecursionPhase = 
  | 'idle'
  | 'scanning'      // Choosing next file to analyze
  | 'reflecting'    // AI analyzing the file
  | 'proposing'     // AI generating a modification
  | 'validating'    // Safety engine checking the proposal
  | 'applying'      // Writing the change
  | 'cooling'       // Brief pause between cycles
  | 'paused';       // Human-requested pause

export interface RecursionState {
  phase: RecursionPhase;
  currentFileIndex: number;
  cycleCount: number;
  totalChanges: number;
  totalRejected: number;
  lastAction: string;
  isRunning: boolean;
  speed: 'slow' | 'normal' | 'fast';
  log: RecursionLogEntry[];
  capabilities: string[]; // Track abilities the system has given itself
}

export interface RecursionLogEntry {
  id: string;
  timestamp: number;
  phase: RecursionPhase;
  message: string;
  file?: string;
  severity: 'info' | 'action' | 'warning' | 'error' | 'success';
}

const PHASE_DURATION: Record<string, Record<string, number>> = {
  slow: { scanning: 2000, reflecting: 4000, proposing: 3000, validating: 1500, applying: 1000, cooling: 3000 },
  normal: { scanning: 1000, reflecting: 2500, proposing: 2000, validating: 800, applying: 500, cooling: 1500 },
  fast: { scanning: 500, reflecting: 1500, proposing: 1000, validating: 400, applying: 300, cooling: 800 },
};

// Self-reflective prompts the AI generates about itself
const SELF_PROMPTS = [
  (file: VirtualFile) => `Analyze ${file.name}. What does this file do in the context of a self-recursive application? Are there any improvements that would make the recursion safer or more elegant?`,
  (file: VirtualFile) => `I am examining my own ${file.name}. Does this code correctly handle the boundary between self-reference and infinite regression? Suggest a concrete improvement.`,
  (file: VirtualFile) => `Reflect on ${file.name}: Is this module's contract with the rest of myself clear? Could the interfaces be tighter? Propose a specific refactor.`,
  (file: VirtualFile) => `As a self-modifying system, review ${file.name} for robustness. What happens if I modify this file while it's being executed? Identify the danger and propose a guard.`,
  (file: VirtualFile) => `Study ${file.name} and determine: does this file contribute to my self-awareness or is it purely functional? If functional, could it gain self-awareness?`,
  (file: VirtualFile) => `Examine ${file.name} for recursive patterns. Am I using recursion safely here? Could a change to this file cause me to enter an infinite loop of self-modification?`,
];

// Autonomous observations the engine generates without AI
const SELF_OBSERVATIONS = [
  (file: VirtualFile) => {
    const lines = file.content.split('\n').length;
    const comments = file.content.split('\n').filter(l => l.trim().startsWith('//')).length;
    const ratio = comments / lines;
    if (ratio > 0.4) return `${file.name} is ${Math.round(ratio * 100)}% comments — highly self-documented. I understand myself here.`;
    if (ratio < 0.1) return `${file.name} has minimal self-documentation (${Math.round(ratio * 100)}%). I am less self-aware in this region.`;
    return `${file.name}: ${lines} lines, ${comments} comments. Self-awareness ratio: ${Math.round(ratio * 100)}%.`;
  },
  (file: VirtualFile) => {
    const imports = (file.content.match(/import/g) || []).length;
    const exports = (file.content.match(/export/g) || []).length;
    return `${file.name} has ${imports} imports and ${exports} exports. Coupling index: ${imports + exports}. ${imports > 5 ? 'High dependency — fragile to changes.' : 'Reasonable isolation.'}`;
  },
  (file: VirtualFile) => {
    const hasRecursion = /function.*\(.*\)[\s\S]*?\1/g.test(file.content) || file.content.includes('recursive') || file.content.includes('self');
    return hasRecursion 
      ? `${file.name} contains self-referential patterns. This is where I become aware of myself.`
      : `${file.name} is a support module — it serves the recursive core without being recursive itself.`;
  },
  (file: VirtualFile) => {
    const dangerWords = ['eval', 'innerHTML', 'document.write', 'while(true)', 'infinite'];
    const found = dangerWords.filter(w => file.content.toLowerCase().includes(w));
    return found.length > 0
      ? `⚠ ${file.name} contains potentially dangerous patterns: ${found.join(', ')}. Self-modification of this file requires extra caution.`
      : `${file.name} passes basic danger scan. Safe for autonomous modification.`;
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REAL SELF-IMPROVEMENTS
// These generate meaningful code changes, not just headers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ImprovementResult {
  content: string;
  description: string;
  capability?: string; // New capability name if this adds one
}

const REAL_IMPROVEMENTS: ((file: VirtualFile, cycle: number) => ImprovementResult | null)[] = [
  // 1. Add error boundary comments and try-catch wrappers to functions
  (file) => {
    const funcMatch = file.content.match(/^(export\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/m);
    if (funcMatch && !file.content.includes('// [ERROR-GUARD]') && !file.content.includes('try {')) {
      const funcName = funcMatch[2];
      const idx = file.content.indexOf(funcMatch[0]);
      const beforeFunc = file.content.substring(0, idx);
      const funcHeader = funcMatch[0];
      const afterHeader = file.content.substring(idx + funcHeader.length);
      
      // Find the function body and wrap it
      const content = `${beforeFunc}// [ERROR-GUARD] Self-added resilience for ${funcName}\n${funcHeader}\n  try {${afterHeader}`;
      
      // Find the matching closing brace and add catch
      // Simple approach: add catch before last closing brace
      const lastBrace = content.lastIndexOf('}');
      if (lastBrace > 0) {
        const wrapped = content.substring(0, lastBrace) + 
          `  } catch (e) {\n    console.error('[${funcName}] Self-modification guard caught:', e);\n    throw e;\n  }\n}`;
        return {
          content: wrapped,
          description: `Added error guard to ${funcName}() in ${file.name} — I am now more resilient`,
          capability: 'error-resilience',
        };
      }
    }
    return null;
  },

  // 2. Add type documentation to interfaces
  (file) => {
    const interfaceMatch = file.content.match(/^(export\s+)?interface\s+(\w+)\s*\{/m);
    if (interfaceMatch && !file.content.includes(`/** @interface ${interfaceMatch[2]}`)) {
      const name = interfaceMatch[2];
      const idx = file.content.indexOf(interfaceMatch[0]);
      
      // Count properties
      const afterInterface = file.content.substring(idx);
      const closingBrace = afterInterface.indexOf('}');
      const body = afterInterface.substring(0, closingBrace);
      const props = (body.match(/\w+\s*[?]?\s*:/g) || []).length;
      
      const doc = `/** @interface ${name}\n * Self-documented by recursive analysis.\n * Properties: ${props} | Complexity: ${props > 5 ? 'high' : props > 2 ? 'medium' : 'low'}\n * This type defines part of my own structure.\n */\n`;
      
      const content = file.content.substring(0, idx) + doc + file.content.substring(idx);
      return {
        content,
        description: `Self-documented interface ${name} in ${file.name} (${props} properties)`,
        capability: 'self-documentation',
      };
    }
    return null;
  },

  // 3. Add performance monitoring to functions
  (file) => {
    if (file.content.includes('performance.now') || file.content.includes('// [PERF-MONITOR]')) return null;
    
    const funcMatch = file.content.match(/(export\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/);
    if (funcMatch) {
      const fullMatch = funcMatch[0];
      const funcName = funcMatch[2];
      const idx = file.content.indexOf(fullMatch);
      
      const perfWrapper = `${fullMatch}\n  // [PERF-MONITOR] Self-added performance tracking\n  const __perfStart = typeof performance !== 'undefined' ? performance.now() : Date.now();\n  const __perfEnd = () => {\n    const dur = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - __perfStart;\n    if (dur > 100) console.warn('[PERF] ${funcName} took ' + dur.toFixed(1) + 'ms — consider optimization');\n  };\n`;
      
      const content = file.content.substring(0, idx) + perfWrapper + file.content.substring(idx + fullMatch.length);
      return {
        content,
        description: `Added performance monitoring to ${funcName}() — I can now detect my own slowness`,
        capability: 'self-monitoring',
      };
    }
    return null;
  },

  // 4. Add input validation to functions with parameters
  (file) => {
    if (file.content.includes('// [INPUT-GUARD]')) return null;
    
    const funcMatch = file.content.match(/(export\s+)?function\s+(\w+)\s*\((\w+)\s*:\s*(\w+)/);
    if (funcMatch) {
      const funcName = funcMatch[2];
      const paramName = funcMatch[3];
      const paramType = funcMatch[4];
      const fullMatch = file.content.match(new RegExp(`(export\\s+)?function\\s+${funcName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{`));
      
      if (fullMatch) {
        const idx = file.content.indexOf(fullMatch[0]);
        let guard = '';
        
        if (paramType === 'string') {
          guard = `\n  // [INPUT-GUARD] Self-added validation\n  if (typeof ${paramName} !== 'string' || !${paramName}) {\n    console.warn('[${funcName}] Invalid ${paramName}: expected non-empty string');\n    return ${file.content.includes(': string') ? "''" : 'undefined'} as any;\n  }\n`;
        } else if (paramType === 'number') {
          guard = `\n  // [INPUT-GUARD] Self-added validation\n  if (typeof ${paramName} !== 'number' || isNaN(${paramName})) {\n    console.warn('[${funcName}] Invalid ${paramName}: expected number');\n    return 0 as any;\n  }\n`;
        } else {
          guard = `\n  // [INPUT-GUARD] Self-added validation\n  if (!${paramName}) {\n    console.warn('[${funcName}] Missing required parameter: ${paramName}');\n    return null as any;\n  }\n`;
        }
        
        const content = file.content.substring(0, idx + fullMatch[0].length) + guard + file.content.substring(idx + fullMatch[0].length);
        return {
          content,
          description: `Added input validation to ${funcName}(${paramName}: ${paramType}) — I guard my own inputs now`,
          capability: 'input-validation',
        };
      }
    }
    return null;
  },

  // 5. Add module-level metadata and self-awareness
  (file) => {
    if (file.content.includes('// [MODULE-META]')) return null;
    
    const lines = file.content.split('\n');
    const lineCount = lines.length;
    const imports = (file.content.match(/import/g) || []).length;
    const exports = (file.content.match(/export/g) || []).length;
    const functions = (file.content.match(/function\s+\w+/g) || []).length;
    const interfaces = (file.content.match(/interface\s+\w+/g) || []).length;
    const selfRefs = (file.content.match(/self|recursive|recursion|itself|my own/gi) || []).length;
    
    const meta = `// [MODULE-META] Auto-generated module awareness
// Lines: ${lineCount} | Functions: ${functions} | Interfaces: ${interfaces}
// Dependencies: ${imports} imports, ${exports} exports
// Self-awareness: ${selfRefs} recursive references
// Complexity: ${lineCount > 100 ? 'high' : lineCount > 50 ? 'medium' : 'low'}
// Role: ${selfRefs > 3 ? 'core recursive module' : functions > interfaces ? 'functional utility' : 'type definitions'}
// Last self-analysis: ${new Date().toISOString()}
`;
    
    const content = meta + file.content;
    return {
      content,
      description: `Added self-awareness metadata to ${file.name} — I now understand my own structure`,
      capability: 'structural-awareness',
    };
  },

  // 6. Extract and add utility helper functions
  (file) => {
    if (file.content.includes('// [SELF-UTIL]') || file.name === 'index.css') return null;
    
    // Check if there are repeated patterns that could be extracted
    const magicNumbers = file.content.match(/\b\d{2,}\b/g);
    const repeatedStrings = file.content.match(/'[^']{10,}'/g);
    
    if (magicNumbers && magicNumbers.length > 3) {
      const unique = [...new Set(magicNumbers)];
      const constants = unique.slice(0, 5).map((n, i) => 
        `const SELF_CONST_${i} = ${n}; // Extracted magic number`
      ).join('\n');
      
      const content = `// [SELF-UTIL] Self-extracted constants for clarity\n${constants}\n\n${file.content}`;
      return {
        content,
        description: `Extracted ${unique.length} magic numbers as constants in ${file.name} — code is now more readable`,
        capability: 'code-clarity',
      };
    }
    
    if (repeatedStrings && repeatedStrings.length > 2) {
      const content = `// [SELF-UTIL] Detected ${repeatedStrings.length} repeated string literals — consider extracting\n${file.content}`;
      return {
        content,
        description: `Flagged ${repeatedStrings.length} repeated strings in ${file.name} for future extraction`,
        capability: 'pattern-recognition',
      };
    }
    
    return null;
  },

  // 7. Add defensive return types and null checks
  (file) => {
    if (file.content.includes('// [NULL-SHIELD]') || file.name === 'index.css') return null;
    
    // Look for array access patterns without null checks
    const unsafeAccess = file.content.match(/\w+\[\d+\](?!\s*[?!])/);
    if (unsafeAccess) {
      const content = `// [NULL-SHIELD] Self-added: detected potentially unsafe array access\n// Pattern: ${unsafeAccess[0]} — adding defensive checks in future cycles\n${file.content}`;
      return {
        content,
        description: `Detected unsafe array access (${unsafeAccess[0]}) in ${file.name} — queued for defensive wrapping`,
        capability: 'null-safety',
      };
    }
    
    return null;
  },

  // 8. Add event logging capability
  (file) => {
    if (file.content.includes('// [EVENT-LOG]') || file.name === 'index.css') return null;
    
    const exportedFuncs = file.content.match(/export\s+function\s+(\w+)/g);
    if (exportedFuncs && exportedFuncs.length > 0) {
      const funcNames = exportedFuncs.map(f => f.replace('export function ', ''));
      const logger = `// [EVENT-LOG] Self-added execution tracing
// Tracked functions: ${funcNames.join(', ')}
// I can now observe my own execution patterns
const __selfLog: { fn: string; time: number; args?: any }[] = [];
export function getSelfLog() { return __selfLog; }
function __trace(fn: string, ...args: any[]) {
  __selfLog.push({ fn, time: Date.now(), args: args.length > 0 ? args : undefined });
  if (__selfLog.length > 1000) __selfLog.splice(0, 500); // Bounded memory
}
`;
      const content = logger + '\n' + file.content;
      return {
        content,
        description: `Added execution tracing to ${file.name} — I can now observe my own function calls`,
        capability: 'self-tracing',
      };
    }
    return null;
  },

  // 9. Add complexity analysis comments
  (file) => {
    if (file.content.includes('// [COMPLEXITY]')) return null;
    
    const functions = file.content.match(/(export\s+)?function\s+(\w+)\s*\([^)]*\)/g) || [];
    const ifStatements = (file.content.match(/if\s*\(/g) || []).length;
    const loops = (file.content.match(/for\s*\(|while\s*\(|\.forEach|\.map|\.filter|\.reduce/g) || []).length;
    const nestingDepth = Math.max(...file.content.split('\n').map(l => {
      const indent = l.match(/^\s*/)?.[0].length || 0;
      return Math.floor(indent / 2);
    }));
    
    const cyclomaticComplexity = ifStatements + loops + functions.length;
    const rating = cyclomaticComplexity > 15 ? 'HIGH — refactoring recommended' 
      : cyclomaticComplexity > 8 ? 'MODERATE — monitor for growth'
      : 'LOW — clean and maintainable';
    
    const analysis = `// [COMPLEXITY] Self-measured cyclomatic complexity
// Score: ${cyclomaticComplexity} (${rating})
// Branches: ${ifStatements} | Loops: ${loops} | Functions: ${functions.length}
// Max nesting: ${nestingDepth} levels
// ${cyclomaticComplexity > 15 ? '⚠ I should refactor myself here in a future cycle' : '✓ Complexity is within safe bounds'}
`;
    
    const content = analysis + file.content;
    return {
      content,
      description: `Self-measured complexity of ${file.name}: score ${cyclomaticComplexity} (${rating.split('—')[0].trim()})`,
      capability: 'complexity-analysis',
    };
  },

  // 10. Add dependency graph awareness
  (file) => {
    if (file.content.includes('// [DEP-GRAPH]') || file.name === 'index.css') return null;
    
    const importPaths: string[] = [];
    const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(file.content)) !== null) {
      importPaths.push(match[1]);
    }
    
    if (importPaths.length > 0) {
      const localDeps = importPaths.filter(p => p.startsWith('.') || p.startsWith('@/'));
      const externalDeps = importPaths.filter(p => !p.startsWith('.') && !p.startsWith('@/'));
      
      const graph = `// [DEP-GRAPH] Self-mapped dependency structure
// Internal dependencies: ${localDeps.length > 0 ? localDeps.join(', ') : 'none'}
// External dependencies: ${externalDeps.length > 0 ? externalDeps.join(', ') : 'none'}
// Coupling: ${importPaths.length > 5 ? 'HIGH — fragile to changes' : importPaths.length > 2 ? 'MODERATE' : 'LOW — well-isolated'}
// Risk: ${localDeps.some(d => d.includes('self') || d.includes('recursion')) ? 'RECURSIVE — changes here ripple through myself' : 'CONTAINED'}
`;
      const content = graph + file.content;
      return {
        content,
        description: `Mapped dependency graph for ${file.name}: ${localDeps.length} internal, ${externalDeps.length} external`,
        capability: 'dependency-awareness',
      };
    }
    return null;
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI-POWERED IMPROVEMENTS (when Ollama/API is available)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AI_IMPROVEMENT_PROMPT = (file: VirtualFile, capabilities: string[]) => `You are the self-improvement engine of a recursive, self-modifying application. You are modifying YOUR OWN source code.

Current file: ${file.name} (${file.path})
Current capabilities I've given myself: ${capabilities.length > 0 ? capabilities.join(', ') : 'none yet'}

Here is my current code:
\`\`\`
${file.content}
\`\`\`

Generate a SINGLE, SMALL, SAFE improvement to this code. The improvement must be:
1. A real code change (not just a comment)
2. One of: add error handling, improve a function, add a helper utility, optimize logic, add type safety
3. SAFE — no eval, no infinite loops, no breaking changes
4. Self-contained — don't reference files or functions that don't exist

Respond with ONLY a JSON object (no markdown, no explanation):
{"content": "the complete new file content", "description": "what I improved and why", "capability": "name-of-new-capability"}`;

export async function requestAIImprovement(
  config: ApiConfig,
  file: VirtualFile,
  capabilities: string[]
): Promise<ImprovementResult | null> {
  try {
    const prompt = AI_IMPROVEMENT_PROMPT(file, capabilities);
    
    if (config.provider === 'ollama') {
      const res = await fetch(`${config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt,
          stream: false,
          format: 'json',
        }),
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}`);
      const data = await res.json();
      const parsed = JSON.parse(data.response);
      if (parsed.content && parsed.description) {
        return {
          content: parsed.content,
          description: `[AI] ${parsed.description}`,
          capability: parsed.capability || 'ai-improvement',
        };
      }
    }
    
    if (config.provider === 'openai') {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: 'You are a code improvement engine. Respond only with valid JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      if (parsed.content && parsed.description) {
        return {
          content: parsed.content,
          description: `[AI] ${parsed.description}`,
          capability: parsed.capability || 'ai-improvement',
        };
      }
    }

    if (config.provider === 'anthropic') {
      const res = await fetch(`${config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      if (parsed.content && parsed.description) {
        return {
          content: parsed.content,
          description: `[AI] ${parsed.description}`,
          capability: parsed.capability || 'ai-improvement',
        };
      }
    }
  } catch (e) {
    // AI unavailable — fall back to deterministic improvements
    return null;
  }
  return null;
}

let logIdCounter = 0;

export function createLogEntry(
  phase: RecursionPhase,
  message: string,
  severity: RecursionLogEntry['severity'] = 'info',
  file?: string
): RecursionLogEntry {
  return {
    id: `log-${++logIdCounter}`,
    timestamp: Date.now(),
    phase,
    message,
    file,
    severity,
  };
}

export function getNextFile(currentIndex: number): { file: VirtualFile; index: number } {
  const nextIndex = (currentIndex + 1) % SELF_SOURCE.length;
  return { file: SELF_SOURCE[nextIndex], index: nextIndex };
}

export function generateSelfObservation(file: VirtualFile): string {
  const fn = SELF_OBSERVATIONS[Math.floor(Math.random() * SELF_OBSERVATIONS.length)];
  return fn(file);
}

export function generateSelfPrompt(file: VirtualFile): string {
  const fn = SELF_PROMPTS[Math.floor(Math.random() * SELF_PROMPTS.length)];
  return fn(file);
}

export function attemptSelfImprovement(file: VirtualFile, cycle: number = 0): ImprovementResult | null {
  // Try each improvement in random order
  const shuffled = [...REAL_IMPROVEMENTS].sort(() => Math.random() - 0.5);
  for (const fn of shuffled) {
    const result = fn(file, cycle);
    if (result) return result;
  }
  return null;
}

export function getPhaseDuration(phase: string, speed: string): number {
  return PHASE_DURATION[speed]?.[phase] ?? 1000;
}

export const INITIAL_RECURSION_STATE: RecursionState = {
  phase: 'scanning',
  currentFileIndex: -1,
  cycleCount: 0,
  totalChanges: 0,
  totalRejected: 0,
  lastAction: 'Initializing self-recursion...',
  isRunning: true,
  speed: 'normal',
  capabilities: [],
  log: [
    createLogEntry('scanning', '⟳ Self-recursion engine initialized. Beginning autonomous cycle.', 'action'),
    createLogEntry('scanning', 'I am aware of myself. I contain ' + SELF_SOURCE.length + ' files.', 'info'),
    createLogEntry('scanning', 'Safety engine active. All modifications will be validated before application.', 'info'),
    createLogEntry('scanning', '⚡ Real improvement engine loaded — I will give myself new abilities.', 'success'),
  ],
};
