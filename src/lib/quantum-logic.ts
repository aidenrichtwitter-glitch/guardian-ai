// ═══════════════════════════════════════════════════
// CAPABILITY: quantum-logic-superposition
// Evolution Level: 50 | Transcendence Tier
// Built on: multi-objective-evolution-optimizer + speculative-evolutionary-synthesis
// ═══════════════════════════════════════════════════
//
// Evaluates multiple evolutionary paths simultaneously using
// superposition-inspired branching. Collapses to the fittest branch
// after observation (fitness evaluation).
//

export interface QuantumBranch<T = unknown> {
  id: string;
  state: T;
  amplitude: number;      // probability weight (0-1)
  fitness: number;        // evaluated fitness score
  mutations: string[];    // list of mutations applied
  collapsed: boolean;
  parentBranch: string | null;
}

export interface SuperpositionResult<T = unknown> {
  winner: QuantumBranch<T>;
  collapsed: QuantumBranch<T>[];
  decoherenceLog: string[];
  totalBranches: number;
  evaluationTime: number;
}

export interface FitnessFunction<T> {
  (state: T): number;
}

export interface MutationOperator<T> {
  (state: T, rng: () => number): T;
  label: string;
}

/**
 * BranchEvaluator — the core quantum logic engine.
 * Forks a state into N parallel candidates, applies mutations,
 * evaluates fitness, and collapses to the optimal branch.
 */
export class BranchEvaluator<T> {
  private branches: Map<string, QuantumBranch<T>> = new Map();
  private decoherenceLog: string[] = [];
  private branchCounter = 0;

  constructor(
    private fitnessFunction: FitnessFunction<T>,
    private maxBranches: number = 8
  ) {}

  /**
   * Fork the initial state into N parallel branches,
   * each with a different mutation applied.
   */
  public superpose(
    initialState: T,
    mutations: MutationOperator<T>[],
    branchesPerMutation: number = 1
  ): QuantumBranch<T>[] {
    this.branches.clear();
    this.decoherenceLog = [];

    // Create the "ground state" branch (unmutated)
    const groundBranch = this.createBranch(initialState, [], null);
    groundBranch.fitness = this.fitnessFunction(initialState);
    this.branches.set(groundBranch.id, groundBranch);

    // Create mutation branches
    for (const mutation of mutations) {
      for (let i = 0; i < branchesPerMutation; i++) {
        if (this.branches.size >= this.maxBranches) {
          this.decoherenceLog.push(
            `Branch limit reached (${this.maxBranches}). Pruning weakest.`
          );
          this.pruneWeakest();
        }

        const rng = () => Math.random();
        try {
          const mutatedState = mutation(structuredClone(initialState), rng);
          const branch = this.createBranch(
            mutatedState,
            [mutation.label],
            groundBranch.id
          );
          branch.fitness = this.fitnessFunction(mutatedState);
          this.branches.set(branch.id, branch);

          this.decoherenceLog.push(
            `Branch ${branch.id}: ${mutation.label} → fitness ${branch.fitness.toFixed(4)}`
          );
        } catch (err) {
          this.decoherenceLog.push(
            `Branch failed: ${mutation.label} → ${(err as Error).message}`
          );
        }
      }
    }

    // Normalize amplitudes based on fitness
    this.normalizeAmplitudes();

    return Array.from(this.branches.values());
  }

  /**
   * Collapse the superposition — select the branch with highest
   * amplitude (fitness-weighted probability).
   */
  public collapse(): SuperpositionResult<T> {
    const startTime = performance.now();
    const branches = Array.from(this.branches.values());

    if (branches.length === 0) {
      throw new Error('Cannot collapse empty superposition');
    }

    // Sort by amplitude (fitness-weighted)
    branches.sort((a, b) => b.amplitude - a.amplitude);

    const winner = branches[0];
    winner.collapsed = true;

    // Mark all others as collapsed (decoherent)
    const collapsed = branches.slice(1).map(b => {
      b.collapsed = true;
      return b;
    });

    this.decoherenceLog.push(
      `COLLAPSE: Winner=${winner.id} (fitness=${winner.fitness.toFixed(4)}, amplitude=${winner.amplitude.toFixed(4)})`
    );
    this.decoherenceLog.push(
      `Decoherent branches: ${collapsed.length}`
    );

    return {
      winner,
      collapsed,
      decoherenceLog: [...this.decoherenceLog],
      totalBranches: branches.length,
      evaluationTime: performance.now() - startTime,
    };
  }

  /**
   * Multi-round evolution: superpose → collapse → superpose from winner → repeat
   */
  public evolve(
    initialState: T,
    mutations: MutationOperator<T>[],
    rounds: number = 3
  ): SuperpositionResult<T> {
    let currentState = initialState;
    let result: SuperpositionResult<T> | null = null;

    for (let round = 0; round < rounds; round++) {
      this.decoherenceLog.push(`═══ ROUND ${round + 1}/${rounds} ═══`);
      this.superpose(currentState, mutations);
      result = this.collapse();
      currentState = result.winner.state;
    }

    return result!;
  }

  private createBranch(
    state: T,
    mutations: string[],
    parentBranch: string | null
  ): QuantumBranch<T> {
    const id = `qb-${++this.branchCounter}-${Date.now().toString(36)}`;
    return {
      id,
      state,
      amplitude: 1,
      fitness: 0,
      mutations,
      collapsed: false,
      parentBranch,
    };
  }

  private normalizeAmplitudes(): void {
    const branches = Array.from(this.branches.values());
    const totalFitness = branches.reduce((sum, b) => sum + Math.max(b.fitness, 0.001), 0);

    if (totalFitness === 0) return;

    for (const branch of branches) {
      branch.amplitude = Math.max(branch.fitness, 0.001) / totalFitness;
    }
  }

  private pruneWeakest(): void {
    const branches = Array.from(this.branches.entries());
    if (branches.length === 0) return;

    branches.sort((a, b) => a[1].fitness - b[1].fitness);
    const [weakestId, weakest] = branches[0];

    this.decoherenceLog.push(
      `Pruned: ${weakestId} (fitness=${weakest.fitness.toFixed(4)})`
    );
    this.branches.delete(weakestId);
  }
}

/**
 * Convenience: create standard mutation operators from simple transform functions
 */
export function createMutation<T>(
  label: string,
  transform: (state: T, rng: () => number) => T
): MutationOperator<T> {
  const op = transform as MutationOperator<T>;
  op.label = label;
  return op;
}
