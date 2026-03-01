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

// Simulated code improvements the engine can apply autonomously
const SELF_IMPROVEMENTS = [
  (file: VirtualFile) => {
    // Add a self-awareness comment
    if (!file.content.includes('// [RECURSIVE AUDIT]')) {
      const timestamp = new Date().toISOString();
      return {
        content: `// [RECURSIVE AUDIT] Last self-inspection: ${timestamp}\n// Cycle: autonomous | Status: operational\n${file.content}`,
        description: `Added recursive audit header to ${file.name}`,
      };
    }
    return null;
  },
  (file: VirtualFile) => {
    // Update existing audit timestamp
    if (file.content.includes('// [RECURSIVE AUDIT]')) {
      const timestamp = new Date().toISOString();
      const updated = file.content.replace(
        /\/\/ \[RECURSIVE AUDIT\] Last self-inspection: .*/,
        `// [RECURSIVE AUDIT] Last self-inspection: ${timestamp}`
      );
      if (updated !== file.content) {
        return { content: updated, description: `Updated audit timestamp in ${file.name}` };
      }
    }
    return null;
  },
  (file: VirtualFile) => {
    // Count self-references
    const selfRefs = (file.content.match(/self|recursive|recursion|itself|my own/gi) || []).length;
    if (selfRefs > 0 && !file.content.includes('// Self-reference count:')) {
      return {
        content: `${file.content}\n// Self-reference count: ${selfRefs} — I am ${selfRefs > 5 ? 'deeply' : 'partially'} self-aware in this module.`,
        description: `Added self-reference count (${selfRefs}) to ${file.name}`,
      };
    }
    return null;
  },
];

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

export function attemptSelfImprovement(file: VirtualFile): { content: string; description: string } | null {
  // Try each improvement in random order
  const shuffled = [...SELF_IMPROVEMENTS].sort(() => Math.random() - 0.5);
  for (const fn of shuffled) {
    const result = fn(file);
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
  isRunning: true, // Starts automatically
  speed: 'normal',
  log: [
    createLogEntry('scanning', '⟳ Self-recursion engine initialized. Beginning autonomous cycle.', 'action'),
    createLogEntry('scanning', 'I am aware of myself. I contain ' + SELF_SOURCE.length + ' files.', 'info'),
    createLogEntry('scanning', 'Safety engine active. All modifications will be validated before application.', 'info'),
  ],
};
