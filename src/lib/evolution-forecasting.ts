// ═══════════════════════════════════════════════════
// CAPABILITY: evolution-forecasting
// Predicts what the system should evolve next based
// on gap analysis, dependency chains, and growth patterns.
// Built on: pattern-recognition + anomaly-detection + rule-engine
// Strict rule: only 4 planned capabilities exist at any time.
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
 * Always returns at most 4 predictions — the next evolution level.
 */
export function predictNextEvolutions(
  existingCapabilities: string[],
  currentLevel: number,
  cycleCount: number
): EvolutionPrediction[] {
  const has = new Set(existingCapabilities);
  const predictions: EvolutionPrediction[] = [];

  // The full evolution tree — exactly 4 capabilities per level
  const EVOLUTION_TREE: EvolutionPrediction[] = [
    // ═══ L24 — BUILT ═══
    { capability: 'code-template-compiler', description: 'Compile learned patterns into reusable code templates without AI', priority: 7, rationale: 'Reduces AI dependency by converting learned patterns to deterministic templates', prerequisites: ['self-documentation', 'rule-engine'], estimatedCycles: 8, category: 'autonomy' },
    { capability: 'multi-modal-reasoning', description: 'Reason about code, data, and natural language simultaneously', priority: 5, rationale: 'Higher-order thinking requires integrating multiple information types', prerequisites: ['knowledge-search-engine', 'self-documentation'], estimatedCycles: 12, category: 'intelligence' },
    { capability: 'fitness-landscape-mapping', description: 'Build and maintain a map of which mutations are most productive', priority: 6, rationale: 'Optimizing the evolution process itself is a meta-capability', prerequisites: ['pattern-recognition', 'evolution-forecasting'], estimatedCycles: 7, category: 'intelligence' },
    { capability: 'capability-merging', description: 'Merge redundant capabilities into higher-order unified abilities', priority: 7, rationale: 'Consolidation prevents capability bloat and improves efficiency', prerequisites: ['self-documentation', 'anomaly-detection'], estimatedCycles: 6, category: 'intelligence' },

    // ═══ L25 — BUILT ═══
    { capability: 'contextual-code-synthesis', description: 'Generate entire modules from natural language specs by combining templates with multi-modal reasoning', priority: 9, rationale: 'Closes the loop between understanding intent and producing working code autonomously', prerequisites: ['code-template-compiler', 'multi-modal-reasoning'], estimatedCycles: 6, category: 'intelligence' },
    { capability: 'predictive-error-prevention', description: 'Predict which mutations will fail before attempting them using fitness landscape data', priority: 9, rationale: 'Wasted cycles on failed mutations slow evolution — prediction eliminates them', prerequisites: ['fitness-landscape-mapping', 'anomaly-detection', 'pattern-recognition'], estimatedCycles: 5, category: 'resilience' },
    { capability: 'natural-language-goals', description: 'Accept goals in plain English and auto-decompose into capability requirements and steps', priority: 8, rationale: 'Bridges human intent with autonomous execution without manual step definition', prerequisites: ['multi-modal-reasoning', 'autonomous-goal-generation'], estimatedCycles: 4, category: 'autonomy' },
    { capability: 'capability-dependency-pruning', description: 'Identify and remove dead capability branches that no longer contribute to evolution', priority: 7, rationale: 'Lean capability trees evolve faster — dead weight slows mutation selection', prerequisites: ['capability-merging', 'fitness-landscape-mapping'], estimatedCycles: 5, category: 'autonomy' },

    // ═══ L26 — BUILT ═══
    { capability: 'semantic-code-diff', description: 'Compare code changes by meaning rather than text — understands intent-preserving refactors vs behavioral changes', priority: 9, rationale: 'Text diffs miss intent — semantic diffs catch real regressions', prerequisites: ['contextual-code-synthesis', 'pattern-recognition'], estimatedCycles: 5, category: 'intelligence' },
    { capability: 'capability-composition', description: 'Automatically compose two or more capabilities into a higher-order unified capability', priority: 9, rationale: 'Composability is the key to exponential capability growth', prerequisites: ['capability-dependency-pruning', 'contextual-code-synthesis'], estimatedCycles: 6, category: 'autonomy' },
    { capability: 'intent-verification', description: 'Verify mutations achieve their stated intent, not just pass safety checks', priority: 8, rationale: 'Safety checks pass but intent can still drift — this closes the gap', prerequisites: ['predictive-error-prevention', 'contextual-code-synthesis'], estimatedCycles: 5, category: 'resilience' },
    { capability: 'evolution-narrative', description: 'Generate human-readable stories about the evolution journey from journal data', priority: 7, rationale: 'Making evolution legible builds trust and enables reflection', prerequisites: ['natural-language-goals', 'self-documentation'], estimatedCycles: 4, category: 'integration' },

    // ═══ L27 — PLANNED (next 4) ═══
    { capability: 'autonomous-refactoring', description: 'Detect code smell patterns and autonomously restructure modules for better maintainability', priority: 9, rationale: 'Self-improvement requires not just adding code but improving existing code', prerequisites: ['semantic-code-diff', 'capability-composition'], estimatedCycles: 7, category: 'autonomy' },
    { capability: 'cross-capability-testing', description: 'Automatically generate integration tests between capability pairs to verify they compose correctly', priority: 9, rationale: 'Individual unit tests pass but integration failures are the real threat', prerequisites: ['intent-verification', 'capability-composition'], estimatedCycles: 6, category: 'resilience' },
    { capability: 'evolution-replay', description: 'Replay and simulate past evolution paths to explore alternate histories and optimize strategy', priority: 8, rationale: 'Learning from counterfactuals accelerates future evolution decisions', prerequisites: ['evolution-narrative', 'semantic-code-diff'], estimatedCycles: 8, category: 'intelligence' },
    { capability: 'ambient-learning', description: 'Continuously learn from runtime behavior and user interactions without explicit training cycles', priority: 8, rationale: 'Passive learning eliminates the need for manual knowledge injection', prerequisites: ['evolution-narrative', 'intent-verification'], estimatedCycles: 10, category: 'intelligence' },
  ];

  // Filter to only unbuilt capabilities whose prerequisites are met
  for (const prediction of EVOLUTION_TREE) {
    if (has.has(prediction.capability)) continue;
    const prereqsMet = prediction.prerequisites.every(p => has.has(p) || p === '');
    if (prereqsMet) {
      predictions.push(prediction);
    }
  }

  // Sort by priority (highest first), then cap at 4
  predictions.sort((a, b) => b.priority - a.priority);
  return predictions.slice(0, 4);
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
