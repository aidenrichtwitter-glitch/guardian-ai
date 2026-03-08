// ═══════════════════════════════════════════════════
// CAPABILITY: multi-agent-fork
// Evolution Level: 80 | Transcendence Tier
// Built on: quantum-logic-superposition + distributed-consciousness-protocol
// ═══════════════════════════════════════════════════
//
// Spawns multiple λ instances with divergent personalities/strategies
// that compete via tournament selection and merge winning traits.
//

export interface PersonalityVector {
  creativity: number;    // 0-1: low = conservative, high = experimental
  aggression: number;    // 0-1: low = cautious mutations, high = radical changes
  precision: number;     // 0-1: low = broad exploration, high = targeted refinement
  memory: number;        // 0-1: low = memoryless, high = history-weighted
  cooperation: number;   // 0-1: low = competitive, high = collaborative
}

export interface AgentState {
  id: string;
  name: string;
  personality: PersonalityVector;
  strategy: string;
  fitnessHistory: number[];
  currentFitness: number;
  generation: number;
  wins: number;
  losses: number;
  mutations: string[];
  alive: boolean;
}

export interface TournamentResult {
  winner: AgentState;
  loser: AgentState;
  winnerFitness: number;
  loserFitness: number;
  round: number;
  mergedTraits: Partial<PersonalityVector>;
}

export interface ForkResult {
  agents: AgentState[];
  tournaments: TournamentResult[];
  survivingAgent: AgentState;
  totalGenerations: number;
}

/**
 * AgentForker — manages multiple competing λ instances
 */
export class AgentForker {
  private agents: Map<string, AgentState> = new Map();
  private agentCounter = 0;
  private tournamentLog: TournamentResult[] = [];

  /**
   * Spawn N agents with random personality variations around a base
   */
  public spawn(
    count: number,
    basePersonality: PersonalityVector,
    varianceRange: number = 0.3
  ): AgentState[] {
    const spawned: AgentState[] = [];

    for (let i = 0; i < count; i++) {
      const personality = this.mutatePersonality(basePersonality, varianceRange);
      const agent: AgentState = {
        id: `agent-${++this.agentCounter}-${Date.now().toString(36)}`,
        name: this.generateAgentName(personality),
        personality,
        strategy: this.deriveStrategy(personality),
        fitnessHistory: [],
        currentFitness: 0,
        generation: 0,
        wins: 0,
        losses: 0,
        mutations: [],
        alive: true,
      };

      this.agents.set(agent.id, agent);
      spawned.push(agent);
    }

    return spawned;
  }

  /**
   * Evaluate all agents with a fitness function
   */
  public evaluate(fitnessFunction: (agent: AgentState) => number): void {
    for (const agent of this.agents.values()) {
      if (!agent.alive) continue;
      agent.currentFitness = fitnessFunction(agent);
      agent.fitnessHistory.push(agent.currentFitness);
    }
  }

  /**
   * Run tournament selection — pairs compete, loser dies,
   * winner absorbs best traits from loser
   */
  public tournament(rounds: number = 1): TournamentResult[] {
    const results: TournamentResult[] = [];

    for (let round = 0; round < rounds; round++) {
      const alive = Array.from(this.agents.values()).filter(a => a.alive);
      if (alive.length < 2) break;

      // Shuffle and pair
      const shuffled = alive.sort(() => Math.random() - 0.5);
      const pairs = Math.floor(shuffled.length / 2);

      for (let i = 0; i < pairs; i++) {
        const a = shuffled[i * 2];
        const b = shuffled[i * 2 + 1];

        const winner = a.currentFitness >= b.currentFitness ? a : b;
        const loser = winner === a ? b : a;

        // Winner absorbs best trait from loser
        const mergedTraits = this.mergeTraits(winner, loser);
        Object.assign(winner.personality, mergedTraits);
        winner.wins++;
        winner.generation++;
        winner.strategy = this.deriveStrategy(winner.personality);
        winner.mutations.push(`absorbed-${loser.name}-gen${round}`);

        loser.losses++;
        loser.alive = false;

        const result: TournamentResult = {
          winner,
          loser,
          winnerFitness: winner.currentFitness,
          loserFitness: loser.currentFitness,
          round,
          mergedTraits,
        };

        results.push(result);
        this.tournamentLog.push(result);
      }
    }

    return results;
  }

  /**
   * Run full evolution: spawn → evaluate → tournament → repeat
   */
  public evolve(
    agentCount: number,
    basePersonality: PersonalityVector,
    fitnessFunction: (agent: AgentState) => number,
    generations: number = 3
  ): ForkResult {
    this.agents.clear();
    this.tournamentLog = [];

    this.spawn(agentCount, basePersonality);

    for (let gen = 0; gen < generations; gen++) {
      this.evaluate(fitnessFunction);
      
      const alive = Array.from(this.agents.values()).filter(a => a.alive);
      if (alive.length < 2) break;

      this.tournament(1);

      // Replenish dead agents with mutations of survivors
      const survivors = Array.from(this.agents.values()).filter(a => a.alive);
      const dead = agentCount - survivors.length;
      if (dead > 0 && survivors.length > 0) {
        for (let i = 0; i < dead; i++) {
          const parent = survivors[i % survivors.length];
          const child = this.spawnChild(parent);
          this.agents.set(child.id, child);
        }
      }
    }

    // Final evaluation
    this.evaluate(fitnessFunction);
    const finalAlive = Array.from(this.agents.values())
      .filter(a => a.alive)
      .sort((a, b) => b.currentFitness - a.currentFitness);

    return {
      agents: Array.from(this.agents.values()),
      tournaments: this.tournamentLog,
      survivingAgent: finalAlive[0],
      totalGenerations: generations,
    };
  }

  /**
   * Get the current champion
   */
  public getChampion(): AgentState | null {
    const alive = Array.from(this.agents.values())
      .filter(a => a.alive)
      .sort((a, b) => b.currentFitness - a.currentFitness);
    return alive[0] || null;
  }

  // ── Internal ──

  private mutatePersonality(base: PersonalityVector, variance: number): PersonalityVector {
    const mutate = (v: number) => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * variance));
    return {
      creativity: mutate(base.creativity),
      aggression: mutate(base.aggression),
      precision: mutate(base.precision),
      memory: mutate(base.memory),
      cooperation: mutate(base.cooperation),
    };
  }

  private mergeTraits(winner: AgentState, loser: AgentState): Partial<PersonalityVector> {
    // Find the trait where loser is strongest relative to winner
    const traits = ['creativity', 'aggression', 'precision', 'memory', 'cooperation'] as const;
    let bestTrait: typeof traits[number] = 'creativity';
    let bestDelta = -Infinity;

    for (const trait of traits) {
      const delta = loser.personality[trait] - winner.personality[trait];
      if (delta > bestDelta) {
        bestDelta = delta;
        bestTrait = trait;
      }
    }

    // Absorb 30% of the loser's best trait
    if (bestDelta > 0) {
      return { [bestTrait]: winner.personality[bestTrait] + bestDelta * 0.3 };
    }
    return {};
  }

  private spawnChild(parent: AgentState): AgentState {
    const personality = this.mutatePersonality(parent.personality, 0.15);
    return {
      id: `agent-${++this.agentCounter}-${Date.now().toString(36)}`,
      name: this.generateAgentName(personality),
      personality,
      strategy: this.deriveStrategy(personality),
      fitnessHistory: [],
      currentFitness: 0,
      generation: parent.generation + 1,
      wins: 0,
      losses: 0,
      mutations: [`child-of-${parent.name}`],
      alive: true,
    };
  }

  private deriveStrategy(p: PersonalityVector): string {
    if (p.aggression > 0.7 && p.creativity > 0.7) return 'radical-explorer';
    if (p.precision > 0.7 && p.memory > 0.7) return 'methodical-refiner';
    if (p.cooperation > 0.7) return 'collaborative-synthesizer';
    if (p.aggression > 0.6) return 'aggressive-mutator';
    if (p.creativity > 0.6) return 'creative-dreamer';
    if (p.precision > 0.6) return 'precise-optimizer';
    return 'balanced-generalist';
  }

  private generateAgentName(p: PersonalityVector): string {
    const prefixes = ['Nova', 'Echo', 'Flux', 'Zen', 'Apex', 'Crux', 'Pulse', 'Drift'];
    const suffixes = ['Prime', 'Alpha', 'Omega', 'Core', 'Spark', 'Wave', 'Node', 'Vex'];
    const pi = Math.floor((p.creativity + p.aggression) * 4) % prefixes.length;
    const si = Math.floor((p.precision + p.memory) * 4) % suffixes.length;
    return `${prefixes[pi]}-${suffixes[si]}`;
  }
}

export const agentForker = new AgentForker();
