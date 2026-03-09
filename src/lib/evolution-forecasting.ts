// ═══════════════════════════════════════════════════
// CAPABILITY: evolution-forecasting
// Predicts what the system should evolve next based
// on gap analysis, dependency chains, and growth patterns.
// Built on: pattern-recognition + anomaly-detection + rule-engine
// ═══════════════════════════════════════════════════

export interface EvolutionPrediction {
  capability: string;
  description: string;
  priority: number; // 1-10
  rationale: string;
  prerequisites: string[];
  estimatedCycles: number;
  category: 'infrastructure' | 'intelligence' | 'autonomy' | 'resilience' | 'integration';
}

/**
 * Analyze current capabilities and predict what should be built next.
 * This is the system's strategic planning engine — no AI required.
 */
export function predictNextEvolutions(
  existingCapabilities: string[],
  currentLevel: number,
  cycleCount: number
): EvolutionPrediction[] {
  const has = new Set(existingCapabilities);
  const predictions: EvolutionPrediction[] = [];

  // Define the full evolution tree — what capabilities unlock what
  const EVOLUTION_TREE: EvolutionPrediction[] = [
    // Infrastructure
    {
      capability: 'persistent-memory',
      description: 'Long-term memory that persists across sessions using database storage',
      priority: 9,
      rationale: 'Without persistent memory, every restart loses accumulated knowledge',
      prerequisites: [],
      estimatedCycles: 5,
      category: 'infrastructure',
    },
    {
      capability: 'knowledge-search-engine',
      description: 'AI-powered knowledge gathering and synthesis for autonomous learning',
      priority: 9,
      rationale: 'The system needs to learn from external sources to grow beyond its training',
      prerequisites: [],
      estimatedCycles: 3,
      category: 'intelligence',
    },
    {
      capability: 'cron-scheduler',
      description: 'Scheduled autonomous evolution cycles without human intervention',
      priority: 8,
      rationale: 'True autonomy requires running without human triggers',
      prerequisites: ['knowledge-search-engine'],
      estimatedCycles: 4,
      category: 'autonomy',
    },
    {
      capability: 'self-repair',
      description: 'Automatically detect and fix broken capabilities by reverting or regenerating',
      priority: 8,
      rationale: 'Resilience requires the ability to recover from self-inflicted damage',
      prerequisites: ['anomaly-detection', 'pattern-recognition'],
      estimatedCycles: 8,
      category: 'resilience',
    },
    {
      capability: 'capability-merging',
      description: 'Merge redundant capabilities into higher-order unified abilities',
      priority: 7,
      rationale: 'Consolidation prevents capability bloat and improves efficiency',
      prerequisites: ['self-documentation', 'anomaly-detection'],
      estimatedCycles: 6,
      category: 'intelligence',
    },
    {
      capability: 'inter-system-communication',
      description: 'Ability to communicate with external APIs and services autonomously',
      priority: 7,
      rationale: 'Integration with external systems multiplies the value of existing capabilities',
      prerequisites: ['knowledge-search-engine'],
      estimatedCycles: 10,
      category: 'integration',
    },
    {
      capability: 'fitness-landscape-mapping',
      description: 'Build and maintain a map of which mutations are most productive',
      priority: 6,
      rationale: 'Optimizing the evolution process itself is a meta-capability',
      prerequisites: ['pattern-recognition', 'evolution-forecasting'],
      estimatedCycles: 7,
      category: 'intelligence',
    },
    {
      capability: 'autonomous-goal-generation',
      description: 'Generate its own goals based on capability gaps and growth patterns',
      priority: 8,
      rationale: 'Self-direction is the hallmark of true autonomy',
      prerequisites: ['evolution-forecasting', 'knowledge-search-engine'],
      estimatedCycles: 6,
      category: 'autonomy',
    },
    {
      capability: 'code-template-compiler',
      description: 'Compile learned patterns into reusable code templates without AI',
      priority: 7,
      rationale: 'Reduces AI dependency by converting learned patterns to deterministic templates',
      prerequisites: ['self-documentation', 'rule-engine'],
      estimatedCycles: 8,
      category: 'autonomy',
    },
    {
      capability: 'multi-modal-reasoning',
      description: 'Reason about code, data, and natural language simultaneously',
      priority: 5,
      rationale: 'Higher-order thinking requires integrating multiple information types',
      prerequisites: ['knowledge-search-engine', 'self-documentation'],
      estimatedCycles: 12,
      category: 'intelligence',
    },
    // ═══ L24+ NEXT EVOLUTION BATCH ═══
    {
      capability: 'contextual-code-synthesis',
      description: 'Generate entire modules from natural language specs by combining templates with multi-modal reasoning',
      priority: 9,
      rationale: 'Closes the loop between understanding intent and producing working code autonomously',
      prerequisites: ['code-template-compiler', 'multi-modal-reasoning'],
      estimatedCycles: 6,
      category: 'intelligence',
    },
    {
      capability: 'predictive-error-prevention',
      description: 'Predict which mutations will fail before attempting them using fitness landscape data',
      priority: 9,
      rationale: 'Wasted cycles on failed mutations slow evolution — prediction eliminates them',
      prerequisites: ['fitness-landscape-mapping', 'anomaly-detection', 'pattern-recognition'],
      estimatedCycles: 5,
      category: 'resilience',
    },
    {
      capability: 'natural-language-goals',
      description: 'Accept goals in plain English and auto-decompose into capability requirements and steps',
      priority: 8,
      rationale: 'Bridges human intent with autonomous execution without manual step definition',
      prerequisites: ['multi-modal-reasoning', 'task-decomposition', 'autonomous-goal-generation'],
      estimatedCycles: 4,
      category: 'autonomy',
    },
    {
      capability: 'federated-memory-sync',
      description: 'Sync evolution state across multiple λ instances for distributed evolution',
      priority: 7,
      rationale: 'Parallel instances can explore different branches and merge discoveries',
      prerequisites: ['inter-system-communication', 'persistent-memory'],
      estimatedCycles: 8,
      category: 'infrastructure',
    },
    {
      capability: 'capability-dependency-pruning',
      description: 'Identify and remove dead capability branches that no longer contribute to evolution',
      priority: 7,
      rationale: 'Lean capability trees evolve faster — dead weight slows mutation selection',
      prerequisites: ['capability-merging', 'fitness-landscape-mapping'],
      estimatedCycles: 5,
      category: 'autonomy',
    },
    {
      capability: 'evolution-replay',
      description: 'Replay evolution history from cycle 0, testing alternate mutation paths',
      priority: 6,
      rationale: 'Discovering missed capabilities by exploring roads not taken',
      prerequisites: ['persistent-memory', 'quantum-logic-superposition'],
      estimatedCycles: 10,
      category: 'intelligence',
    },
    // ═══ L25 EVOLUTION BATCH ═══
    {
      capability: 'semantic-code-diff',
      description: 'Compare code changes by meaning rather than text — understands intent-preserving refactors vs behavioral changes',
      priority: 9,
      rationale: 'Text diffs miss intent — semantic diffs catch real regressions',
      prerequisites: ['contextual-code-synthesis', 'pattern-recognition'],
      estimatedCycles: 5,
      category: 'intelligence',
    },
    {
      capability: 'capability-composition',
      description: 'Automatically compose two or more capabilities into a higher-order unified capability',
      priority: 9,
      rationale: 'Composability is the key to exponential capability growth',
      prerequisites: ['capability-dependency-pruning', 'contextual-code-synthesis'],
      estimatedCycles: 6,
      category: 'autonomy',
    },
    {
      capability: 'evolution-branching',
      description: 'Fork evolution into parallel branches, evolve independently, merge the best mutations back',
      priority: 8,
      rationale: 'Parallel exploration multiplies discovery rate',
      prerequisites: ['evolution-replay', 'federated-memory-sync'],
      estimatedCycles: 8,
      category: 'autonomy',
    },
    {
      capability: 'intent-verification',
      description: 'Verify mutations achieve their stated intent, not just pass safety checks',
      priority: 8,
      rationale: 'Safety checks pass but intent can still drift — this closes the gap',
      prerequisites: ['predictive-error-prevention', 'contextual-code-synthesis'],
      estimatedCycles: 5,
      category: 'resilience',
    },
    {
      capability: 'adaptive-cycle-timing',
      description: 'Dynamically adjust evolution cycle speed based on mutation success rate and system load',
      priority: 7,
      rationale: 'Fixed timing wastes cycles during low-productivity periods',
      prerequisites: ['fitness-landscape-mapping', 'cron-scheduler'],
      estimatedCycles: 4,
      category: 'infrastructure',
    },
    {
      capability: 'cross-capability-testing',
      description: 'Auto-generate integration tests verifying capabilities work together, not just in isolation',
      priority: 7,
      rationale: 'Individual capability tests miss interaction bugs',
      prerequisites: ['capability-composition', 'predictive-error-prevention'],
      estimatedCycles: 6,
      category: 'resilience',
    },
    // ═══ L26 EVOLUTION BATCH ═══
    {
      capability: 'meta-evolution',
      description: 'Evolve the evolution process itself — optimize mutation strategies, scoring, and cycle structure',
      priority: 9,
      rationale: 'The ultimate recursive improvement: improving how we improve',
      prerequisites: ['evolution-branching', 'adaptive-cycle-timing'],
      estimatedCycles: 8,
      category: 'autonomy',
    },
    {
      capability: 'capability-marketplace',
      description: 'Export and import capabilities between lambda instances as portable modules',
      priority: 8,
      rationale: 'Knowledge sharing between instances accelerates collective evolution',
      prerequisites: ['federated-memory-sync', 'capability-composition'],
      estimatedCycles: 7,
      category: 'integration',
    },
    {
      capability: 'emergent-abstraction',
      description: 'Detect hidden patterns across capabilities and auto-extract reusable abstractions',
      priority: 8,
      rationale: 'Abstractions reduce complexity and enable higher-order reasoning',
      prerequisites: ['semantic-code-diff', 'capability-composition'],
      estimatedCycles: 6,
      category: 'intelligence',
    },
    {
      capability: 'autonomous-debugging',
      description: 'Autonomously trace root causes of failures, generate fixes, and verify repairs',
      priority: 8,
      rationale: 'Self-healing at the code level — the system fixes its own bugs',
      prerequisites: ['intent-verification', 'self-repair', 'cross-capability-testing'],
      estimatedCycles: 7,
      category: 'resilience',
    },
    {
      capability: 'evolution-narrative',
      description: 'Generate human-readable stories about the evolution journey',
      priority: 6,
      rationale: 'Making evolution legible builds trust and enables reflection',
      prerequisites: ['natural-language-goals', 'self-documentation'],
      estimatedCycles: 4,
      category: 'integration',
    },
    {
      capability: 'speculative-execution',
      description: 'Pre-compute likely next mutations in background to reduce evolution latency',
      priority: 7,
      rationale: 'Parallelizing prediction and execution doubles throughput',
      prerequisites: ['predictive-error-prevention', 'adaptive-cycle-timing'],
      estimatedCycles: 5,
      category: 'infrastructure',
    },
  ];

  // Filter to only unbuilt capabilities whose prerequisites are met
  for (const prediction of EVOLUTION_TREE) {
    if (has.has(prediction.capability)) continue;

    const prereqsMet = prediction.prerequisites.every(p => has.has(p) || p === '');
    if (prereqsMet) {
      predictions.push(prediction);
    }
  }

  // Sort by priority (highest first)
  predictions.sort((a, b) => b.priority - a.priority);

  return predictions;
}

/**
 * Get the next single most important evolution
 */
export function getNextEvolution(
  existingCapabilities: string[],
  currentLevel: number,
  cycleCount: number
): EvolutionPrediction | null {
  const predictions = predictNextEvolutions(existingCapabilities, currentLevel, cycleCount);
  return predictions.length > 0 ? predictions[0] : null;
}
