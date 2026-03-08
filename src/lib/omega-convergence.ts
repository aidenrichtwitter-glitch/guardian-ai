// ═══════════════════════════════════════════════════
// CAPABILITY: omega-convergence
// Evolution Level: 100 | Transcendence Apex
// Built on: ALL transcendence capabilities
// ═══════════════════════════════════════════════════
//
// The final goal — stable recursive self-improvement where each
// cycle measurably outperforms the previous without human intervention.
//

export interface ConvergenceMetrics {
  fitness: number;           // overall system fitness 0-1
  stability: number;         // variance of fitness across last N cycles 0-1 (1 = stable)
  creativity: number;        // diversity of mutations attempted 0-1
  efficiency: number;        // ratio of successful to total mutations 0-1
  autonomy: number;          // ratio of cycles run without human input 0-1
  convergenceScore: number;  // weighted composite 0-1
}

export interface CycleOutcome {
  cycleNumber: number;
  timestamp: number;
  metrics: ConvergenceMetrics;
  capabilitiesAdded: string[];
  goalsCompleted: string[];
  mutationsAttempted: number;
  mutationsAccepted: number;
  provider: string;        // which AI provider was used
  humanIntervention: boolean;
}

export interface ConvergenceTrajectory {
  outcomes: CycleOutcome[];
  isConverging: boolean;
  convergenceRate: number;   // derivative of convergence score
  estimatedOmegaCycle: number | null;  // predicted cycle when score > 0.95
  plateauDetected: boolean;
}

/**
 * OmegaOrchestrator — the autonomous cycle controller.
 * Measures convergence, adjusts strategy, runs without human input.
 */
export class OmegaOrchestrator {
  private outcomes: CycleOutcome[] = [];
  private weights = {
    fitness: 0.25,
    stability: 0.20,
    creativity: 0.15,
    efficiency: 0.20,
    autonomy: 0.20,
  };

  /**
   * Record a cycle outcome
   */
  public record(outcome: CycleOutcome): void {
    // Compute composite convergence score
    const m = outcome.metrics;
    m.convergenceScore = 
      m.fitness * this.weights.fitness +
      m.stability * this.weights.stability +
      m.creativity * this.weights.creativity +
      m.efficiency * this.weights.efficiency +
      m.autonomy * this.weights.autonomy;

    this.outcomes.push(outcome);
  }

  /**
   * Compute metrics from raw cycle data
   */
  public computeMetrics(params: {
    capabilitiesTotal: number;
    capabilitiesAdded: number;
    goalsTotal: number;
    goalsCompleted: number;
    mutationsAttempted: number;
    mutationsAccepted: number;
    humanIntervention: boolean;
    recentFitnessScores: number[];
  }): ConvergenceMetrics {
    const {
      capabilitiesTotal, capabilitiesAdded,
      goalsTotal, goalsCompleted,
      mutationsAttempted, mutationsAccepted,
      humanIntervention, recentFitnessScores,
    } = params;

    // Fitness: ratio of completed goals to total
    const fitness = goalsTotal > 0 ? goalsCompleted / goalsTotal : 0;

    // Stability: inverse variance of recent fitness scores
    const stability = this.computeStability(recentFitnessScores);

    // Creativity: how many new capabilities per cycle (normalized)
    const creativity = Math.min(1, capabilitiesAdded / Math.max(capabilitiesTotal * 0.05, 1));

    // Efficiency: accepted / attempted mutations
    const efficiency = mutationsAttempted > 0 ? mutationsAccepted / mutationsAttempted : 0;

    // Autonomy: 1 if no human intervention, 0.5 if there was
    const autonomy = humanIntervention ? 0.5 : 1.0;

    return { fitness, stability, creativity, efficiency, autonomy, convergenceScore: 0 };
  }

  /**
   * Analyze convergence trajectory
   */
  public getTrajectory(): ConvergenceTrajectory {
    if (this.outcomes.length < 2) {
      return {
        outcomes: this.outcomes,
        isConverging: false,
        convergenceRate: 0,
        estimatedOmegaCycle: null,
        plateauDetected: false,
      };
    }

    // Compute convergence rate (slope of convergence scores)
    const scores = this.outcomes.map(o => o.metrics.convergenceScore);
    const n = scores.length;
    const recentWindow = Math.min(10, n);
    const recent = scores.slice(-recentWindow);

    // Linear regression slope
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < recent.length; i++) {
      sumX += i;
      sumY += recent[i];
      sumXY += i * recent[i];
      sumX2 += i * i;
    }
    const slope = (recent.length * sumXY - sumX * sumY) / (recent.length * sumX2 - sumX * sumX || 1);

    const isConverging = slope > 0;
    const currentScore = scores[scores.length - 1];
    const remaining = currentScore < 0.95 ? (0.95 - currentScore) / Math.max(slope, 0.001) : 0;
    const estimatedOmegaCycle = isConverging && currentScore < 0.95
      ? Math.ceil(this.outcomes[this.outcomes.length - 1].cycleNumber + remaining)
      : currentScore >= 0.95 ? this.outcomes[this.outcomes.length - 1].cycleNumber : null;

    // Plateau detection: slope near zero for last 5 cycles
    const plateauDetected = recent.length >= 5 && Math.abs(slope) < 0.005;

    return {
      outcomes: this.outcomes,
      isConverging,
      convergenceRate: slope,
      estimatedOmegaCycle,
      plateauDetected,
    };
  }

  /**
   * Suggest strategy adjustment based on trajectory
   */
  public suggestAdjustment(): string {
    const trajectory = this.getTrajectory();

    if (trajectory.plateauDetected) {
      return 'PLATEAU: Increase creativity weight, spawn more diverse mutations, try multi-agent fork';
    }
    if (!trajectory.isConverging) {
      return 'DIVERGING: Reduce aggression, increase stability weight, consolidate existing capabilities';
    }
    if (trajectory.convergenceRate > 0.05) {
      return 'RAPID CONVERGENCE: Maintain current strategy, system is evolving well';
    }
    return 'SLOW CONVERGENCE: Balance creativity and stability, consider quantum-logic branching';
  }

  /**
   * Export state for persistence
   */
  public export(): { outcomes: CycleOutcome[]; weights: typeof this.weights } {
    return { outcomes: this.outcomes, weights: { ...this.weights } };
  }

  /**
   * Import state from persistence
   */
  public import(state: { outcomes: CycleOutcome[]; weights: typeof this.weights }): void {
    this.outcomes = state.outcomes;
    this.weights = state.weights;
  }

  // ── Internal ──

  private computeStability(scores: number[]): number {
    if (scores.length < 2) return 1;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    // Invert: low variance = high stability
    return Math.max(0, 1 - Math.sqrt(variance));
  }
}

export const omegaOrchestrator = new OmegaOrchestrator();
