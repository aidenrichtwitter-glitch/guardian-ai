// ═══════════════════════════════════════════════════
// DETERMINISTIC RULE ENGINE
// The endgame: λ Recursive evolves WITHOUT AI calls
// when possible. Rules are compiled patterns learned
// from past evolution cycles. As the rule library grows,
// AI dependency shrinks toward zero for routine operations.
// ═══════════════════════════════════════════════════

import { validateChange } from './safety-engine';

export interface Rule {
  id: string;
  name: string;
  category: 'refactor' | 'optimize' | 'test' | 'synthesize' | 'maintain' | 'consolidate';
  description: string;
  priority: number; // 0-100, higher = runs first
  condition: (ctx: RuleContext) => boolean;
  action: (ctx: RuleContext) => RuleAction;
  compiledFromCycle?: number; // which evolution cycle taught this rule
  successCount: number;
  failCount: number;
  aiCallsSaved: number; // how many AI calls this rule has replaced
}

export interface RuleContext {
  capabilities: string[];
  evolutionLevel: number;
  cycleCount: number;
  lastTestVerdict: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | null;
  failedTests: string[];
  capabilityCount: number;
  timeSinceLastEvolution: number; // ms
  codeFiles: { path: string; size: number; hasExports: boolean }[];
}

export interface RuleAction {
  type: 'refactor' | 'add-test' | 'optimize' | 'consolidate' | 'alert' | 'skip';
  target?: string;
  description: string;
  code?: string;
  severity: 'info' | 'warning' | 'action';
}

export interface RuleEngineReport {
  rulesEvaluated: number;
  rulesTriggered: number;
  actions: RuleAction[];
  aiCallsSaved: number;
  autonomyScore: number; // 0-100, percentage of work done without AI
  timestamp: number;
  duration: number;
}

// ── BUILT-IN RULES (the immune system) ──

const BUILT_IN_RULES: Rule[] = [
  {
    id: 'rule-dead-code-detect',
    name: 'Dead Code Detection',
    category: 'refactor',
    description: 'Flags files with no exports as potential dead code',
    priority: 80,
    condition: (ctx) => ctx.codeFiles.some(f => !f.hasExports && f.size > 100),
    action: (ctx) => ({
      type: 'refactor',
      target: ctx.codeFiles.find(f => !f.hasExports && f.size > 100)?.path,
      description: `Dead code detected: ${ctx.codeFiles.filter(f => !f.hasExports).length} file(s) with no exports`,
      severity: 'warning',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 0,
  },
  {
    id: 'rule-test-failure-response',
    name: 'Auto-respond to Test Failures',
    category: 'maintain',
    description: 'When tests fail, identify the failing module and flag for repair',
    priority: 95,
    condition: (ctx) => ctx.lastTestVerdict === 'CRITICAL' || ctx.lastTestVerdict === 'DEGRADED',
    action: (ctx) => ({
      type: 'alert',
      description: `⚠️ Test degradation detected: ${ctx.failedTests.length} failures. Modules: ${ctx.failedTests.join(', ')}`,
      severity: 'warning',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 0,
  },
  {
    id: 'rule-capability-consolidation',
    name: 'Capability Consolidation',
    category: 'consolidate',
    description: 'When capability count exceeds 10× evolution level, trigger consolidation',
    priority: 60,
    condition: (ctx) => ctx.capabilityCount > ctx.evolutionLevel * 10 && ctx.evolutionLevel > 0,
    action: (ctx) => ({
      type: 'consolidate',
      description: `${ctx.capabilityCount} capabilities at L${ctx.evolutionLevel}. Consider merging related capabilities.`,
      severity: 'info',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 0,
  },
  {
    id: 'rule-stagnation-detect',
    name: 'Evolution Stagnation Alert',
    category: 'maintain',
    description: 'Alert when no evolution activity for extended period',
    priority: 70,
    condition: (ctx) => ctx.timeSinceLastEvolution > 300_000 && ctx.cycleCount > 5, // 5 minutes, not 2
    action: (ctx) => ({
      type: 'alert',
      description: `Evolution quiet for ${Math.round(ctx.timeSinceLastEvolution / 60000)}min. Run autonomy cycle to advance.`,
      severity: 'info',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 0,
  },
  {
    id: 'rule-safety-scan',
    name: 'Periodic Safety Scan',
    category: 'maintain',
    description: 'Every 5 cycles, validate all code files pass safety checks',
    priority: 90,
    condition: (ctx) => ctx.cycleCount % 5 === 0,
    action: () => ({
      type: 'refactor',
      description: 'Periodic safety scan triggered. Validating all modules.',
      severity: 'info',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 0,
  },
  {
    id: 'rule-large-file-split',
    name: 'Large File Detection',
    category: 'refactor',
    description: 'Flag files over 300 lines for splitting',
    priority: 50,
    condition: (ctx) => ctx.codeFiles.some(f => f.size > 300),
    action: (ctx) => ({
      type: 'refactor',
      target: ctx.codeFiles.find(f => f.size > 300)?.path,
      description: `Large file detected (${ctx.codeFiles.filter(f => f.size > 300).length} files > 300 lines). Consider splitting.`,
      severity: 'info',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 0,
  },
  {
    id: 'rule-healthy-skip',
    name: 'Skip When Healthy',
    category: 'optimize',
    description: 'If all tests pass and system is healthy, skip unnecessary AI analysis',
    priority: 100,
    condition: (ctx) => ctx.lastTestVerdict === 'HEALTHY' && ctx.cycleCount % 3 !== 0,
    action: () => ({
      type: 'skip',
      description: 'System healthy. Skipping AI analysis this cycle (deterministic optimization).',
      severity: 'info',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 1,
  },
  {
    id: 'rule-ghost-purge',
    name: 'Auto-purge Ghost Capabilities',
    category: 'maintain',
    description: 'Detect and flag capabilities without backing code for removal',
    priority: 85,
    condition: (ctx) => ctx.capabilities.length > 0 && ctx.capabilityCount > ctx.capabilities.length * 1.2,
    action: (ctx) => ({
      type: 'alert',
      description: `Capability inflation detected: ${ctx.capabilityCount} total but only ${ctx.capabilities.length} appear legitimate. Run verification.`,
      severity: 'warning',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 1,
  },
  {
    id: 'rule-autonomy-cycle-recommend',
    name: 'Recommend Autonomy Cycle',
    category: 'optimize',
    description: 'Recommend running autonomy cycle when idle for too long',
    priority: 40,
    condition: (ctx) => ctx.timeSinceLastEvolution > 180_000, // 3 minutes idle
    action: () => ({
      type: 'alert',
      description: 'System idle. Run autonomy cycle to verify, repair, and advance deterministically.',
      severity: 'info',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 0,
  },
  {
    id: 'rule-goal-completion-check',
    name: 'Goal Completion Scanner',
    category: 'maintain',
    description: 'Check if any goals can be auto-completed based on existing capabilities',
    priority: 55,
    condition: (ctx) => ctx.cycleCount % 2 === 0 && ctx.capabilityCount > 5,
    action: (ctx) => ({
      type: 'skip',
      description: `Scanning ${ctx.capabilityCount} capabilities against active goals for auto-completion.`,
      severity: 'info',
    }),
    successCount: 0,
    failCount: 0,
    aiCallsSaved: 1,
  },
];

// ── RULE ENGINE ──

export class RuleEngine {
  private rules: Map<string, Rule> = new Map();
  private totalAISaved = 0;
  private totalRulesRun = 0;
  private totalAICalls = 0;

  constructor() {
    for (const rule of BUILT_IN_RULES) {
      this.rules.set(rule.id, { ...rule });
    }
  }

  /** Register a new learned rule (compiled from AI experience) */
  addRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  /** Remove a rule */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /** Record that an AI call was made (for autonomy tracking) */
  recordAICall(): void {
    this.totalAICalls++;
  }

  /** Evaluate all rules against current context */
  evaluate(ctx: RuleContext): RuleEngineReport {
    const start = performance.now();
    const sortedRules = Array.from(this.rules.values())
      .sort((a, b) => b.priority - a.priority);

    const actions: RuleAction[] = [];
    let triggered = 0;
    let aiSaved = 0;

    for (const rule of sortedRules) {
      try {
        if (rule.condition(ctx)) {
          const action = rule.action(ctx);
          actions.push(action);
          triggered++;
          rule.successCount++;

          if (action.type === 'skip') {
            aiSaved += 1;
            rule.aiCallsSaved++;
            this.totalAISaved++;
          }
        }
      } catch {
        rule.failCount++;
      }
    }

    this.totalRulesRun += sortedRules.length;

    const totalDecisions = this.totalAISaved + this.totalAICalls;
    const autonomyScore = totalDecisions > 0
      ? Math.round((this.totalAISaved / totalDecisions) * 100)
      : 0;

    return {
      rulesEvaluated: sortedRules.length,
      rulesTriggered: triggered,
      actions,
      aiCallsSaved: aiSaved,
      autonomyScore,
      timestamp: Date.now(),
      duration: performance.now() - start,
    };
  }

  /** Get autonomy metrics */
  getMetrics(): { totalAISaved: number; totalAICalls: number; totalRulesRun: number; autonomyScore: number; ruleCount: number } {
    const totalDecisions = this.totalAISaved + this.totalAICalls;
    return {
      totalAISaved: this.totalAISaved,
      totalAICalls: this.totalAICalls,
      totalRulesRun: this.totalRulesRun,
      autonomyScore: totalDecisions > 0 ? Math.round((this.totalAISaved / totalDecisions) * 100) : 0,
      ruleCount: this.rules.size,
    };
  }

  /** Get all rules for display */
  getRules(): Rule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }
}

// Singleton instance
export const ruleEngine = new RuleEngine();
