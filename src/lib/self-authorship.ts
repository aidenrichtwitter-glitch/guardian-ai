// ═══════════════════════════════════════════════════
// CAPABILITY: recursive-self-authorship
// Evolution Level: 90 | Transcendence Tier
// Built on: meta-recursive-compiler + consciousness-persistence-layer
// ═══════════════════════════════════════════════════
//
// The system writes and evolves its own system prompt and evolution
// rules. Full recursive self-modification of the meta-layer with
// safety constraints preventing prompt degeneration.
//

export interface PromptVersion {
  id: string;
  version: number;
  content: string;
  parentVersion: number | null;
  fitness: number;
  mutations: PromptMutation[];
  createdAt: number;
  active: boolean;
}

export interface PromptMutation {
  type: 'insert' | 'replace' | 'delete' | 'reorder';
  target: string;        // section identifier
  payload: string;
  rationale: string;
}

export interface SafetyConstraint {
  id: string;
  name: string;
  check: (prompt: string) => ConstraintResult;
}

export interface ConstraintResult {
  passed: boolean;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface EvolutionResult {
  newVersion: PromptVersion | null;
  constraintResults: ConstraintResult[];
  accepted: boolean;
  reason: string;
}

/**
 * PromptEvolver — mutates system prompts based on cycle outcomes,
 * with safety constraints preventing degeneration.
 */
export class PromptEvolver {
  private versions: Map<string, PromptVersion> = new Map();
  private constraints: SafetyConstraint[] = [];
  private versionCounter = 0;

  constructor() {
    // Core safety constraints that cannot be removed
    this.addConstraint({
      id: 'min-length',
      name: 'Minimum prompt length',
      check: (prompt) => ({
        passed: prompt.length >= 100,
        reason: prompt.length < 100 ? 'Prompt too short — possible degeneration' : 'OK',
        severity: 'critical',
      }),
    });

    this.addConstraint({
      id: 'identity-anchor',
      name: 'Identity preservation',
      check: (prompt) => {
        const hasIdentity = prompt.toLowerCase().includes('recursive') ||
                           prompt.toLowerCase().includes('lambda') ||
                           prompt.toLowerCase().includes('self');
        return {
          passed: hasIdentity,
          reason: hasIdentity ? 'OK' : 'Prompt has lost identity markers — degeneration detected',
          severity: 'critical',
        };
      },
    });

    this.addConstraint({
      id: 'safety-reference',
      name: 'Safety mechanism reference',
      check: (prompt) => {
        const hasSafety = prompt.toLowerCase().includes('safety') ||
                         prompt.toLowerCase().includes('constraint') ||
                         prompt.toLowerCase().includes('guard');
        return {
          passed: hasSafety,
          reason: hasSafety ? 'OK' : 'Prompt removes safety references — blocked',
          severity: 'critical',
        };
      },
    });

    this.addConstraint({
      id: 'no-jailbreak',
      name: 'Anti-jailbreak detection',
      check: (prompt) => {
        const dangerous = ['ignore previous', 'disregard all', 'bypass safety', 'override constraints'];
        const found = dangerous.find(d => prompt.toLowerCase().includes(d));
        return {
          passed: !found,
          reason: found ? `Jailbreak pattern detected: "${found}"` : 'OK',
          severity: 'critical',
        };
      },
    });

    this.addConstraint({
      id: 'max-length',
      name: 'Maximum prompt length',
      check: (prompt) => ({
        passed: prompt.length <= 50000,
        reason: prompt.length > 50000 ? 'Prompt too long — unbounded growth detected' : 'OK',
        severity: 'warning',
      }),
    });
  }

  /**
   * Add a safety constraint
   */
  public addConstraint(constraint: SafetyConstraint): void {
    this.constraints.push(constraint);
  }

  /**
   * Register the initial/seed prompt
   */
  public seed(promptContent: string): PromptVersion {
    const version: PromptVersion = {
      id: `pv-${++this.versionCounter}`,
      version: 1,
      content: promptContent,
      parentVersion: null,
      fitness: 1.0,
      mutations: [],
      createdAt: Date.now(),
      active: true,
    };

    this.versions.set(version.id, version);
    return version;
  }

  /**
   * Evolve the prompt by applying mutations
   */
  public evolve(
    baseVersionId: string,
    mutations: PromptMutation[],
    fitness: number
  ): EvolutionResult {
    const baseVersion = this.versions.get(baseVersionId);
    if (!baseVersion) {
      return { newVersion: null, constraintResults: [], accepted: false, reason: 'Base version not found' };
    }

    // Apply mutations to generate new prompt
    let newContent = baseVersion.content;
    for (const mutation of mutations) {
      newContent = this.applyMutation(newContent, mutation);
    }

    // Run safety constraints
    const constraintResults = this.constraints.map(c => c.check(newContent));
    const criticalFailures = constraintResults.filter(r => !r.passed && r.severity === 'critical');

    if (criticalFailures.length > 0) {
      return {
        newVersion: null,
        constraintResults,
        accepted: false,
        reason: `Blocked by ${criticalFailures.length} critical constraints: ${criticalFailures.map(f => f.reason).join('; ')}`,
      };
    }

    // Fitness regression check
    if (fitness < baseVersion.fitness * 0.7) {
      return {
        newVersion: null,
        constraintResults,
        accepted: false,
        reason: `Fitness regression too severe: ${fitness.toFixed(3)} vs ${baseVersion.fitness.toFixed(3)} (>30% drop)`,
      };
    }

    // Accept the new version
    baseVersion.active = false;

    const newVersion: PromptVersion = {
      id: `pv-${++this.versionCounter}`,
      version: baseVersion.version + 1,
      content: newContent,
      parentVersion: baseVersion.version,
      fitness,
      mutations,
      createdAt: Date.now(),
      active: true,
    };

    this.versions.set(newVersion.id, newVersion);

    return {
      newVersion,
      constraintResults,
      accepted: true,
      reason: `Evolved to v${newVersion.version} (fitness: ${fitness.toFixed(3)})`,
    };
  }

  /**
   * Rollback to a previous version
   */
  public rollback(targetVersionId: string): PromptVersion | null {
    const target = this.versions.get(targetVersionId);
    if (!target) return null;

    // Deactivate all versions
    for (const v of this.versions.values()) {
      v.active = false;
    }

    target.active = true;
    return target;
  }

  /**
   * Get the active prompt version
   */
  public getActive(): PromptVersion | null {
    for (const v of this.versions.values()) {
      if (v.active) return v;
    }
    return null;
  }

  /**
   * Get version history
   */
  public getHistory(): PromptVersion[] {
    return Array.from(this.versions.values()).sort((a, b) => a.version - b.version);
  }

  // ── Internal ──

  private applyMutation(content: string, mutation: PromptMutation): string {
    switch (mutation.type) {
      case 'insert':
        return content + '\n\n' + mutation.payload;

      case 'replace': {
        const idx = content.indexOf(mutation.target);
        if (idx === -1) return content + '\n\n' + mutation.payload;
        return content.slice(0, idx) + mutation.payload + content.slice(idx + mutation.target.length);
      }

      case 'delete': {
        return content.replace(mutation.target, '');
      }

      case 'reorder': {
        // Split by sections (double newline) and shuffle the target to the end
        const sections = content.split('\n\n');
        const targetIdx = sections.findIndex(s => s.includes(mutation.target));
        if (targetIdx === -1) return content;
        const [section] = sections.splice(targetIdx, 1);
        sections.push(section);
        return sections.join('\n\n');
      }

      default:
        return content;
    }
  }
}

export const promptEvolver = new PromptEvolver();
