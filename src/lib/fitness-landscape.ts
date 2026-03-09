// ═══════════════════════════════════════════════════
// CAPABILITY: fitness-landscape-mapping
// Builds and maintains a map of which mutations and
// capability paths are most productive. Tracks success/
// failure rates to guide evolution strategy.
// Built on: pattern-recognition + evolution-forecasting
// ═══════════════════════════════════════════════════

export interface MutationRecord {
  id: string;
  capability: string;
  cycle: number;
  succeeded: boolean;
  timeMs: number;
  parentCapabilities: string[];
  category: string;
}

export interface FitnessPoint {
  capability: string;
  fitness: number; // 0-1
  successRate: number;
  avgTimeMs: number;
  attemptCount: number;
  lastAttemptCycle: number;
  trend: 'improving' | 'stable' | 'degrading' | 'unknown';
}

export interface LandscapeSummary {
  totalMutations: number;
  overallSuccessRate: number;
  hotPaths: string[]; // most productive capability chains
  coldPaths: string[]; // least productive chains
  peakFitness: FitnessPoint | null;
  averageFitness: number;
  categoryBreakdown: Record<string, { count: number; successRate: number }>;
}

/**
 * The Fitness Landscape — a growing map of evolution productivity
 */
export class FitnessLandscape {
  private records: MutationRecord[] = [];
  private fitnessCache: Map<string, FitnessPoint> = new Map();

  constructor(historicalRecords?: MutationRecord[]) {
    if (historicalRecords) {
      this.records = [...historicalRecords];
      this.rebuildCache();
    }
  }

  /**
   * Record a mutation attempt (success or failure)
   */
  record(mutation: MutationRecord): void {
    this.records.push(mutation);
    this.updateFitness(mutation.capability);
  }

  /**
   * Get fitness score for a specific capability path
   */
  getFitness(capability: string): FitnessPoint | null {
    return this.fitnessCache.get(capability) ?? null;
  }

  /**
   * Predict success probability for a planned mutation
   */
  predictSuccess(
    capability: string,
    parentCapabilities: string[],
    category: string
  ): { probability: number; reasoning: string } {
    // Base rate from category
    const categoryRecords = this.records.filter(r => r.category === category);
    const categoryRate = categoryRecords.length > 0
      ? categoryRecords.filter(r => r.succeeded).length / categoryRecords.length
      : 0.5; // unknown = 50%

    // Parent fitness boost — strong parents = higher chance
    let parentBoost = 0;
    for (const parent of parentCapabilities) {
      const pf = this.fitnessCache.get(parent);
      if (pf && pf.fitness > 0.7) parentBoost += 0.1;
      else if (pf && pf.fitness < 0.3) parentBoost -= 0.1;
    }

    // Historical attempts for this exact capability
    const priorAttempts = this.records.filter(r => r.capability === capability);
    let priorBoost = 0;
    if (priorAttempts.length > 0) {
      const lastAttempt = priorAttempts[priorAttempts.length - 1];
      // Failed before? Slight penalty. Succeeded? Boost.
      priorBoost = lastAttempt.succeeded ? 0.1 : -0.15;
    }

    const probability = Math.max(0, Math.min(1, categoryRate + parentBoost + priorBoost));

    const reasons: string[] = [];
    reasons.push(`Category "${category}" base rate: ${(categoryRate * 100).toFixed(0)}%`);
    if (parentBoost !== 0) reasons.push(`Parent fitness adjustment: ${parentBoost > 0 ? '+' : ''}${(parentBoost * 100).toFixed(0)}%`);
    if (priorBoost !== 0) reasons.push(`Prior attempt adjustment: ${priorBoost > 0 ? '+' : ''}${(priorBoost * 100).toFixed(0)}%`);

    return { probability, reasoning: reasons.join('; ') };
  }

  /**
   * Get full landscape summary
   */
  summarize(): LandscapeSummary {
    const succeeded = this.records.filter(r => r.succeeded);

    // Category breakdown
    const categories: Record<string, { count: number; successCount: number }> = {};
    for (const r of this.records) {
      if (!categories[r.category]) categories[r.category] = { count: 0, successCount: 0 };
      categories[r.category].count++;
      if (r.succeeded) categories[r.category].successCount++;
    }
    const categoryBreakdown: Record<string, { count: number; successRate: number }> = {};
    for (const [cat, info] of Object.entries(categories)) {
      categoryBreakdown[cat] = {
        count: info.count,
        successRate: info.count > 0 ? info.count > 0 ? info.successCount / info.count : 0 : 0,
      };
    }

    // Hot and cold paths
    const fitnessEntries = [...this.fitnessCache.values()].sort((a, b) => b.fitness - a.fitness);
    const hotPaths = fitnessEntries.filter(f => f.fitness >= 0.7).map(f => f.capability);
    const coldPaths = fitnessEntries.filter(f => f.fitness < 0.3).map(f => f.capability);

    const avgFitness = fitnessEntries.length > 0
      ? fitnessEntries.reduce((s, f) => s + f.fitness, 0) / fitnessEntries.length
      : 0;

    return {
      totalMutations: this.records.length,
      overallSuccessRate: this.records.length > 0 ? succeeded.length / this.records.length : 0,
      hotPaths,
      coldPaths,
      peakFitness: fitnessEntries[0] ?? null,
      averageFitness: Math.round(avgFitness * 100) / 100,
      categoryBreakdown,
    };
  }

  /**
   * Get the most productive categories to focus evolution on
   */
  recommendCategories(): string[] {
    const summary = this.summarize();
    return Object.entries(summary.categoryBreakdown)
      .filter(([, info]) => info.successRate > 0.6 && info.count >= 2)
      .sort(([, a], [, b]) => b.successRate - a.successRate)
      .map(([cat]) => cat);
  }

  /**
   * Export records for persistence
   */
  exportRecords(): MutationRecord[] {
    return [...this.records];
  }

  // ─── Internal ──────────────────────────────────

  private updateFitness(capability: string): void {
    const capRecords = this.records.filter(r => r.capability === capability);
    if (capRecords.length === 0) return;

    const successes = capRecords.filter(r => r.succeeded).length;
    const successRate = successes / capRecords.length;
    const avgTime = capRecords.reduce((s, r) => s + r.timeMs, 0) / capRecords.length;

    // Fitness = weighted success rate (recent attempts weighted more)
    const recentRecords = capRecords.slice(-5);
    const recentRate = recentRecords.filter(r => r.succeeded).length / recentRecords.length;

    const fitness = successRate * 0.4 + recentRate * 0.6;

    // Trend detection
    let trend: FitnessPoint['trend'] = 'unknown';
    if (capRecords.length >= 3) {
      const earlyRate = capRecords.slice(0, Math.ceil(capRecords.length / 2)).filter(r => r.succeeded).length /
        Math.ceil(capRecords.length / 2);
      if (recentRate > earlyRate + 0.15) trend = 'improving';
      else if (recentRate < earlyRate - 0.15) trend = 'degrading';
      else trend = 'stable';
    }

    this.fitnessCache.set(capability, {
      capability,
      fitness: Math.round(fitness * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      avgTimeMs: Math.round(avgTime),
      attemptCount: capRecords.length,
      lastAttemptCycle: capRecords[capRecords.length - 1].cycle,
      trend,
    });
  }

  private rebuildCache(): void {
    const caps = new Set(this.records.map(r => r.capability));
    for (const cap of caps) this.updateFitness(cap);
  }
}
