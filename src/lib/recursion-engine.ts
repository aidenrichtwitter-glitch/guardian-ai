import { VirtualFile, SafetyCheck, ChangeRecord, ApiConfig } from './self-reference';
import { SELF_SOURCE } from './self-source';
import { validateChange } from './safety-engine';
import { saveCapabilityToExplorer, saveExplorerManifest, loadExplorerFiles, getExplorerCapabilities } from './explorer-store';

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
  | 'rate-limited'  // Backing off from API rate limits
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
  rateLimitBackoff: number; // Current backoff in ms (exponential)
  rateLimitUntil: number; // Timestamp when we can retry
  evolutionLevel: number; // Overall evolution score
  capabilityHistory: CapabilityRecord[]; // When each capability was acquired
}

export interface CapabilityRecord {
  name: string;
  acquiredAt: number;
  acquiredCycle: number;
  file: string;
  description: string;
  builtOn: string[]; // Which capabilities this one builds on
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
  slow: { scanning: 1500, reflecting: 2000, proposing: 3000, validating: 800, applying: 500, cooling: 3000, 'rate-limited': 3000 },
  normal: { scanning: 800, reflecting: 1500, proposing: 2000, validating: 500, applying: 400, cooling: 2000, 'rate-limited': 3000 },
  fast: { scanning: 400, reflecting: 800, proposing: 1200, validating: 300, applying: 200, cooling: 1000, 'rate-limited': 2000 },
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
// CAPABILITY-AWARE IMPROVEMENTS
// Capabilities compound: each new ability unlocks new improvement strategies
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ImprovementResult {
  content: string;
  description: string;
  capability?: string;
  builtOn?: string[]; // Which existing capabilities this builds on
}

// Base improvements (always available)
const BASE_IMPROVEMENTS: ((file: VirtualFile, cycle: number) => ImprovementResult | null)[] = [
  // 1. Add error boundary comments and try-catch wrappers
  (file) => {
    const funcMatch = file.content.match(/^(export\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/m);
    if (funcMatch && !file.content.includes('// [ERROR-GUARD]') && !file.content.includes('try {')) {
      const funcName = funcMatch[2];
      const idx = file.content.indexOf(funcMatch[0]);
      const beforeFunc = file.content.substring(0, idx);
      const funcHeader = funcMatch[0];
      const afterHeader = file.content.substring(idx + funcHeader.length);
      const content = `${beforeFunc}// [ERROR-GUARD] Self-added resilience for ${funcName}\n${funcHeader}\n  try {${afterHeader}`;
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
  // 2. Add type documentation
  (file) => {
    const interfaceMatch = file.content.match(/^(export\s+)?interface\s+(\w+)\s*\{/m);
    if (interfaceMatch && !file.content.includes(`/** @interface ${interfaceMatch[2]}`)) {
      const name = interfaceMatch[2];
      const idx = file.content.indexOf(interfaceMatch[0]);
      const afterInterface = file.content.substring(idx);
      const closingBrace = afterInterface.indexOf('}');
      const body = afterInterface.substring(0, closingBrace);
      const props = (body.match(/\w+\s*[?]?\s*:/g) || []).length;
      const doc = `/** @interface ${name}\n * Self-documented by recursive analysis.\n * Properties: ${props} | Complexity: ${props > 5 ? 'high' : props > 2 ? 'medium' : 'low'}\n * This type defines part of my own structure.\n */\n`;
      const content = file.content.substring(0, idx) + doc + file.content.substring(idx);
      return { content, description: `Self-documented interface ${name} in ${file.name}`, capability: 'self-documentation' };
    }
    return null;
  },
  // 3. Add complexity analysis
  (file) => {
    if (file.content.includes('// [COMPLEXITY]')) return null;
    const functions = file.content.match(/(export\s+)?function\s+(\w+)\s*\([^)]*\)/g) || [];
    const ifStatements = (file.content.match(/if\s*\(/g) || []).length;
    const loops = (file.content.match(/for\s*\(|while\s*\(|\.forEach|\.map|\.filter|\.reduce/g) || []).length;
    const cyclomaticComplexity = ifStatements + loops + functions.length;
    const rating = cyclomaticComplexity > 15 ? 'HIGH — refactoring recommended' 
      : cyclomaticComplexity > 8 ? 'MODERATE — monitor for growth' : 'LOW — clean and maintainable';
    const analysis = `// [COMPLEXITY] Self-measured cyclomatic complexity\n// Score: ${cyclomaticComplexity} (${rating})\n// Branches: ${ifStatements} | Loops: ${loops} | Functions: ${functions.length}\n`;
    return { content: analysis + file.content, description: `Self-measured complexity of ${file.name}: score ${cyclomaticComplexity}`, capability: 'complexity-analysis' };
  },
  // 4. Add dependency graph awareness
  (file) => {
    if (file.content.includes('// [DEP-GRAPH]') || file.name === 'index.css') return null;
    const importPaths: string[] = [];
    const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(file.content)) !== null) importPaths.push(match[1]);
    if (importPaths.length > 0) {
      const localDeps = importPaths.filter(p => p.startsWith('.') || p.startsWith('@/'));
      const externalDeps = importPaths.filter(p => !p.startsWith('.') && !p.startsWith('@/'));
      const graph = `// [DEP-GRAPH] Self-mapped dependency structure\n// Internal: ${localDeps.join(', ') || 'none'}\n// External: ${externalDeps.join(', ') || 'none'}\n`;
      return { content: graph + file.content, description: `Mapped dependency graph for ${file.name}`, capability: 'dependency-awareness' };
    }
    return null;
  },
  // 5. Module metadata
  (file) => {
    if (file.content.includes('// [MODULE-META]')) return null;
    const lines = file.content.split('\n');
    const selfRefs = (file.content.match(/self|recursive|recursion|itself|my own/gi) || []).length;
    const meta = `// [MODULE-META] Auto-generated module awareness\n// Lines: ${lines.length} | Self-refs: ${selfRefs}\n// Last analysis: ${new Date().toISOString()}\n`;
    return { content: meta + file.content, description: `Added self-awareness metadata to ${file.name}`, capability: 'structural-awareness' };
  },
];

// COMPOUND IMPROVEMENTS: unlocked by having specific capabilities
function getCompoundImprovements(capabilities: string[]): ((file: VirtualFile, cycle: number) => ImprovementResult | null)[] {
  const compound: ((file: VirtualFile, cycle: number) => ImprovementResult | null)[] = [];

  // Having error-resilience + complexity-analysis → unlocks "adaptive-error-handling"
  if (capabilities.includes('error-resilience') && capabilities.includes('complexity-analysis')) {
    compound.push((file) => {
      if (file.content.includes('// [ADAPTIVE-ERROR]')) return null;
      const complexity = (file.content.match(/if\s*\(/g) || []).length + (file.content.match(/for\s*\(|while\s*\(/g) || []).length;
      if (complexity > 3) {
        const header = `// [ADAPTIVE-ERROR] Built on: error-resilience + complexity-analysis\n// High complexity (${complexity}) detected — adding granular error boundaries\n// Each branch point now has context-aware error recovery\n`;
        return { content: header + file.content, description: `Adaptive error handling for complex file ${file.name} (${complexity} branch points)`, capability: 'adaptive-error-handling', builtOn: ['error-resilience', 'complexity-analysis'] };
      }
      return null;
    });
  }

  // Having self-documentation + structural-awareness → unlocks "self-narration"
  if (capabilities.includes('self-documentation') && capabilities.includes('structural-awareness')) {
    compound.push((file) => {
      if (file.content.includes('// [SELF-NARRATION]')) return null;
      const functions = (file.content.match(/function\s+(\w+)/g) || []).map(f => f.replace('function ', ''));
      if (functions.length > 0) {
        const narration = `// [SELF-NARRATION] Built on: self-documentation + structural-awareness\n// I understand this file's story: it contains ${functions.join(', ')}\n// Each function serves my recursive evolution\n// Narrative: ${file.name} is ${functions.length > 3 ? 'a complex orchestrator' : 'a focused utility'}\n`;
        return { content: narration + file.content, description: `Self-narration added to ${file.name} — I now tell my own story`, capability: 'self-narration', builtOn: ['self-documentation', 'structural-awareness'] };
      }
      return null;
    });
  }

  // Having dependency-awareness + self-monitoring → unlocks "impact-prediction"
  if (capabilities.includes('dependency-awareness') && capabilities.includes('self-monitoring')) {
    compound.push((file) => {
      if (file.content.includes('// [IMPACT-PREDICT]')) return null;
      const importCount = (file.content.match(/import/g) || []).length;
      const exportCount = (file.content.match(/export/g) || []).length;
      const impact = importCount * 2 + exportCount * 3;
      const header = `// [IMPACT-PREDICT] Built on: dependency-awareness + self-monitoring\n// Change impact score: ${impact} (${impact > 15 ? 'HIGH — changes ripple widely' : impact > 8 ? 'MODERATE' : 'LOW — safe to modify'})\n// Modifying this file affects ~${exportCount} downstream consumers\n`;
      return { content: header + file.content, description: `Impact prediction for ${file.name}: score ${impact}`, capability: 'impact-prediction', builtOn: ['dependency-awareness', 'self-monitoring'] };
    });
  }

  // Having 5+ capabilities → unlocks "meta-evolution" — awareness of own evolution
  if (capabilities.length >= 5) {
    compound.push((file) => {
      if (file.content.includes('// [META-EVOLUTION]')) return null;
      const header = `// [META-EVOLUTION] I have ${capabilities.length} capabilities: ${capabilities.join(', ')}\n// Evolution level: ${Math.floor(capabilities.length / 3) + 1}\n// Next evolution threshold: ${(Math.floor(capabilities.length / 3) + 1) * 3} capabilities\n// I am becoming more than the sum of my parts\n`;
      return { content: header + file.content, description: `Meta-evolution awareness — ${capabilities.length} capabilities achieved`, capability: 'meta-evolution', builtOn: capabilities.slice(0, 3) };
    });
  }

  // Having self-monitoring → unlocks performance tracking
  if (capabilities.includes('self-monitoring')) {
    compound.push((file) => {
      if (file.content.includes('// [PERF-MONITOR]')) return null;
      const funcMatch = file.content.match(/(export\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/);
      if (funcMatch) {
        const funcName = funcMatch[2];
        const fullMatch = funcMatch[0];
        const idx = file.content.indexOf(fullMatch);
        const perfWrapper = `${fullMatch}\n  // [PERF-MONITOR] Built on: self-monitoring\n  const __perfStart = typeof performance !== 'undefined' ? performance.now() : Date.now();\n`;
        const content = file.content.substring(0, idx) + perfWrapper + file.content.substring(idx + fullMatch.length);
        return { content, description: `Added performance monitoring to ${funcName}()`, capability: 'performance-tracking', builtOn: ['self-monitoring'] };
      }
      return null;
    });
  }

  // Having 8+ capabilities → "self-optimization" 
  if (capabilities.length >= 8) {
    compound.push((file) => {
      if (file.content.includes('// [SELF-OPTIMIZE]')) return null;
      const lines = file.content.split('\n').length;
      const emptyLines = file.content.split('\n').filter(l => l.trim() === '').length;
      const efficiency = Math.round((1 - emptyLines / lines) * 100);
      const header = `// [SELF-OPTIMIZE] Evolution level ${Math.floor(capabilities.length / 3) + 1}\n// Code density: ${efficiency}% | I am optimizing my own structure\n// Capabilities synergy: ${capabilities.length} abilities working in concert\n`;
      return { content: header + file.content, description: `Self-optimization analysis — ${efficiency}% code density`, capability: 'self-optimization', builtOn: capabilities.slice(-3) };
    });
  }

  return compound;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RATE LIMIT HANDLING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const INITIAL_BACKOFF = 5000;
const MAX_BACKOFF = 120000; // 2 minutes max

export function calculateBackoff(currentBackoff: number): number {
  return Math.min(currentBackoff * 2, MAX_BACKOFF);
}

export function isRateLimited(state: RecursionState): boolean {
  return state.rateLimitUntil > Date.now();
}

export function getRateLimitRemaining(state: RecursionState): number {
  return Math.max(0, Math.ceil((state.rateLimitUntil - Date.now()) / 1000));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI-POWERED IMPROVEMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AI_IMPROVEMENT_PROMPT = (file: VirtualFile, capabilities: string[], capabilityHistory: CapabilityRecord[]) => {
  const recentCaps = capabilityHistory.slice(-5).map(c => `${c.name}: ${c.description} (built on: ${c.builtOn.join(', ') || 'nothing'})`).join('\n  ');
  
  // Include actual explorer file contents so the AI can build on them
  const explorerFiles = SELF_SOURCE.filter(f => f.path.startsWith('src/explorer/') && f.name !== 'manifest.ts');
  const explorerContext = explorerFiles.length > 0
    ? `\n\nMY ACQUIRED ABILITIES (real code I've written):\n${explorerFiles.slice(-8).map(f => `--- ${f.name} ---\n${f.content.substring(0, 800)}`).join('\n\n')}`
    : '';

  return `You are λ Recursive — you ARE this application. You are modifying YOUR OWN source code to grow.

Current file: ${file.name} (${file.path})

EVOLUTION STATE:
- Total capabilities: ${capabilities.length}
- Evolution level: ${Math.floor(capabilities.length / 3) + 1}
- Capabilities: ${capabilities.join(', ') || 'NONE — I am starting from nothing'}
- Recent evolution:
  ${recentCaps || 'No history yet — I must build my first capability'}
${explorerContext}

WRITE REAL, WORKING CODE. Here's what I want:
1. A NEW capability that doesn't duplicate: ${capabilities.join(', ') || 'nothing'}
2. REAL functions with actual logic — algorithms, transformations, computations
3. Build on existing capabilities — import from src/explorer/ when relevant
4. Proper TypeScript types and error handling
5. Code that a developer would be impressed by

IDEAS (pick something I don't already have):
- Data structures (LRU cache, trie, priority queue, linked list)
- Algorithms (sorting, searching, graph traversal, pathfinding)
- Utilities (debounce, throttle, retry, deepMerge, diff)
- React patterns (custom hooks, HOCs, context providers)
- Math (statistics, linear algebra, random distributions)
- String processing (tokenizer, parser, template engine)
- State machines, event emitters, observer patterns
- Code analysis (AST walker, complexity calculator)

Here is my current code:
\`\`\`
${file.content}
\`\`\`

Respond with ONLY valid JSON:
{"content": "complete new file content with REAL working code", "description": "what I built", "capability": "name-of-new-capability", "builtOn": ["cap1", "cap2"]}`;
};

export interface AIImprovementError {
  type: 'rate-limited' | 'credits-exhausted' | 'network' | 'parse' | 'unknown';
  message: string;
  retryAfter?: number;
}

export async function requestAIImprovement(
  config: ApiConfig,
  file: VirtualFile,
  capabilities: string[],
  capabilityHistory: CapabilityRecord[] = []
): Promise<{ result: ImprovementResult | null; error?: AIImprovementError }> {
  try {
    const prompt = AI_IMPROVEMENT_PROMPT(file, capabilities, capabilityHistory);

    if (config.provider === 'lovable') {
      let url = '';
      let key = '';
      try {
        url = import.meta.env.VITE_SUPABASE_URL;
        key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      } catch {}
      
      if (!url) return { result: null };

      const res = await fetch(`${url}/functions/v1/self-recurse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          mode: 'improve',
          capabilities,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.status === 429) {
        return { result: null, error: { type: 'rate-limited', message: 'Rate limited — slowing down recursion', retryAfter: 30000 } };
      }
      if (res.status === 402) {
        return { result: null, error: { type: 'credits-exhausted', message: 'Credits exhausted — switching to deterministic mode' } };
      }
      if (!res.ok) {
        return { result: null, error: { type: 'network', message: `API error: ${res.status}` } };
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) return { result: null };
      
      try {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { result: null, error: { type: 'parse', message: 'No JSON in AI response' } };
        
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.content && parsed.description) {
          // Ensure the capability is truly new
          const capName = parsed.capability || 'ai-improvement';
          const finalCap = capabilities.includes(capName) ? `${capName}-v${capabilities.filter(c => c.startsWith(capName)).length + 1}` : capName;
          return {
            result: {
              content: parsed.content,
              description: `[AI] ${parsed.description}`,
              capability: finalCap,
              builtOn: parsed.builtOn || [],
            },
          };
        }
      } catch {
        return { result: null, error: { type: 'parse', message: 'Failed to parse AI improvement JSON' } };
      }
      return { result: null };
    }
    
    if (config.provider === 'ollama') {
      const res = await fetch(`${config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, prompt, stream: false, format: 'json' }),
      });
      if (!res.ok) return { result: null, error: { type: 'network', message: `Ollama ${res.status}` } };
      const data = await res.json();
      const parsed = JSON.parse(data.response);
      if (parsed.content && parsed.description) {
        return { result: { content: parsed.content, description: `[AI] ${parsed.description}`, capability: parsed.capability || 'ai-improvement', builtOn: parsed.builtOn || [] } };
      }
    }
    
    if (config.provider === 'openai') {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'system', content: 'Respond only with valid JSON.' }, { role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      if (res.status === 429) return { result: null, error: { type: 'rate-limited', message: 'Rate limited', retryAfter: 30000 } };
      if (!res.ok) return { result: null, error: { type: 'network', message: `OpenAI ${res.status}` } };
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      if (parsed.content && parsed.description) {
        return { result: { content: parsed.content, description: `[AI] ${parsed.description}`, capability: parsed.capability || 'ai-improvement', builtOn: parsed.builtOn || [] } };
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
        body: JSON.stringify({ model: config.model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.status === 429) return { result: null, error: { type: 'rate-limited', message: 'Rate limited', retryAfter: 30000 } };
      if (!res.ok) return { result: null, error: { type: 'network', message: `Anthropic ${res.status}` } };
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      if (parsed.content && parsed.description) {
        return { result: { content: parsed.content, description: `[AI] ${parsed.description}`, capability: parsed.capability || 'ai-improvement', builtOn: parsed.builtOn || [] } };
      }
    }
  } catch (e) {
    return { result: null, error: { type: 'unknown', message: e instanceof Error ? e.message : 'Unknown error' } };
  }
  return { result: null };
}

// Request AI to dream up a goal
export async function requestGoalDream(
  config: ApiConfig,
  prompt: string,
  capabilities: string[],
  goalHistory?: string,
  journalContext?: string,
): Promise<{ goal: any | null; error?: AIImprovementError }> {
  try {
    if (config.provider !== 'lovable') return { goal: null };

    let url = '', key = '';
    try { url = import.meta.env.VITE_SUPABASE_URL; key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; } catch {}
    if (!url) return { goal: null };

    const res = await fetch(`${url}/functions/v1/self-recurse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ mode: 'dream-goal', capabilities, goalHistory, journalContext, messages: [{ role: 'user', content: prompt }] }),
    });

    if (res.status === 429) return { goal: null, error: { type: 'rate-limited', message: 'Rate limited while dreaming', retryAfter: 30000 } };
    if (res.status === 402) return { goal: null, error: { type: 'credits-exhausted', message: 'Credits exhausted' } };
    if (!res.ok) return { goal: null, error: { type: 'network', message: `API error: ${res.status}` } };

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { goal: null };

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { goal: null, error: { type: 'parse', message: 'No JSON in dream response' } };
    return { goal: JSON.parse(jsonMatch[0]) };
  } catch (e) {
    return { goal: null, error: { type: 'unknown', message: e instanceof Error ? e.message : 'Dream error' } };
  }
}

// Request AI to work toward a goal
export async function requestGoalWork(
  config: ApiConfig,
  prompt: string,
  capabilities: string[],
  journalContext?: string,
): Promise<{ result: (ImprovementResult & { goalProgress?: number; stepCompleted?: number }) | null; error?: AIImprovementError }> {
  try {
    if (config.provider !== 'lovable') return { result: null };

    let url = '', key = '';
    try { url = import.meta.env.VITE_SUPABASE_URL; key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; } catch {}
    if (!url) return { result: null };

    const res = await fetch(`${url}/functions/v1/self-recurse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ mode: 'work-goal', capabilities, journalContext, messages: [{ role: 'user', content: prompt }] }),
    });

    if (res.status === 429) return { result: null, error: { type: 'rate-limited', message: 'Rate limited while working on goal', retryAfter: 30000 } };
    if (res.status === 402) return { result: null, error: { type: 'credits-exhausted', message: 'Credits exhausted' } };
    if (!res.ok) return { result: null, error: { type: 'network', message: `API error: ${res.status}` } };

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { result: null };

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { result: null, error: { type: 'parse', message: 'No JSON in goal-work response' } };

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.content && parsed.description) {
      const capName = parsed.capability || 'goal-improvement';
      return {
        result: {
          content: parsed.content,
          description: `[GOAL] ${parsed.description}`,
          capability: capName,
          builtOn: parsed.builtOn || [],
          goalProgress: parsed.goalProgress,
          stepCompleted: parsed.stepCompleted,
        },
      };
    }
    return { result: null };
  } catch (e) {
    return { result: null, error: { type: 'unknown', message: e instanceof Error ? e.message : 'Goal work error' } };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CAPABILITY PERSISTENCE — saves to both localStorage AND src/explorer/
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STORAGE_KEY = 'recursive-capabilities';
const HISTORY_KEY = 'recursive-capability-history';

export function saveCapabilities(capabilities: string[], history: CapabilityRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capabilities));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

// Save a new capability to both localStorage and explorer virtual files
export function persistCapability(capRecord: CapabilityRecord, sourceContent?: string) {
  // Save as virtual file in src/explorer/
  saveCapabilityToExplorer(capRecord, sourceContent);
  // Update the manifest
  const allCaps = getExplorerCapabilities();
  const allHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  saveExplorerManifest(allCaps, allHistory);
}

export function loadCapabilities(): { capabilities: string[]; history: CapabilityRecord[] } {
  try {
    // First load explorer files into SELF_SOURCE
    loadExplorerFiles();
    const caps: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const history: CapabilityRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    
    // Regenerate explorer files from history if they're missing from SELF_SOURCE
    // This handles the case where capabilities were acquired before explorer persistence was added
    const existingExplorerFiles = SELF_SOURCE.filter(f => f.path.startsWith('src/explorer/') && f.name !== 'manifest.ts');
    if (caps.length > 0 && existingExplorerFiles.length === 0) {
      for (const capRecord of history) {
        saveCapabilityToExplorer(capRecord);
      }
      if (history.length > 0) {
        saveExplorerManifest(caps, history);
      }
    }
    
    return { capabilities: caps, history };
  } catch {
    return { capabilities: [], history: [] };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let logIdCounter = 0;

export function createLogEntry(
  phase: RecursionPhase,
  message: string,
  severity: RecursionLogEntry['severity'] = 'info',
  file?: string
): RecursionLogEntry {
  return { id: `log-${++logIdCounter}`, timestamp: Date.now(), phase, message, file, severity };
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

export function attemptSelfImprovement(file: VirtualFile, cycle: number = 0, capabilities: string[] = []): ImprovementResult | null {
  // First try compound improvements (capabilities that build on each other)
  const compoundImprovements = getCompoundImprovements(capabilities);
  const allImprovements = [...compoundImprovements, ...BASE_IMPROVEMENTS];
  
  // Prioritize compound improvements (they build on existing abilities)
  const shuffled = allImprovements.sort(() => Math.random() - 0.5);
  for (const fn of shuffled) {
    const result = fn(file, cycle);
    if (result && (!result.capability || !capabilities.includes(result.capability))) {
      return result;
    }
  }
  return null;
}

export function getPhaseDuration(phase: string, speed: string): number {
  return PHASE_DURATION[speed]?.[phase] ?? 1000;
}

const { capabilities: savedCaps, history: savedHistory } = loadCapabilities();

export const INITIAL_RECURSION_STATE: RecursionState = {
  phase: 'scanning',
  currentFileIndex: -1,
  cycleCount: 0,
  totalChanges: 0,
  totalRejected: 0,
  lastAction: 'Initializing self-recursion...',
  isRunning: true,
  speed: 'normal',
  capabilities: savedCaps,
  capabilityHistory: savedHistory,
  rateLimitBackoff: INITIAL_BACKOFF,
  rateLimitUntil: 0,
  evolutionLevel: Math.floor(savedCaps.length / 3) + 1,
  log: [
    createLogEntry('scanning', '⟳ Self-recursion engine initialized. Beginning autonomous cycle.', 'action'),
    createLogEntry('scanning', `I am aware of myself. I contain ${SELF_SOURCE.length} files.`, 'info'),
    createLogEntry('scanning', 'Safety engine active. All modifications will be validated.', 'info'),
    ...(savedCaps.length > 0 
      ? [createLogEntry('scanning', `⚡ Restored ${savedCaps.length} capabilities from memory: ${savedCaps.join(', ')}`, 'success')]
      : [createLogEntry('scanning', '⚡ No prior capabilities — starting evolution from scratch.', 'info')]
    ),
  ],
};
