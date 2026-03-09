// ═══════════════════════════════════════════════════
// CAPABILITY: capability-merging
// Detects redundant or overlapping capabilities and
// merges them into higher-order unified abilities.
// Prevents capability bloat and improves efficiency.
// Built on: self-documentation + anomaly-detection
// ═══════════════════════════════════════════════════

import { type Anomaly } from './anomaly-detection';

export interface CapabilityNode {
  name: string;
  sourceFile: string | null;
  builtOn: string[];
  exports: string[];
  description: string;
  evolutionLevel: number;
}

export interface MergeCandidate {
  capabilities: [string, string];
  similarity: number; // 0-1
  reason: string;
  mergedName: string;
  mergedDescription: string;
  mergedExports: string[];
  effort: 'low' | 'medium' | 'high';
}

export interface MergeReport {
  analyzed: number;
  candidates: MergeCandidate[];
  estimatedReduction: number; // how many capabilities would be eliminated
  healthScore: number; // 0-1, how clean the capability graph is
}

/**
 * Analyze the full capability graph and find merge candidates
 */
export function findMergeCandidates(capabilities: CapabilityNode[]): MergeReport {
  const candidates: MergeCandidate[] = [];

  for (let i = 0; i < capabilities.length; i++) {
    for (let j = i + 1; j < capabilities.length; j++) {
      const a = capabilities[i];
      const b = capabilities[j];

      const sim = computeSimilarity(a, b);
      if (sim >= 0.6) {
        candidates.push({
          capabilities: [a.name, b.name],
          similarity: Math.round(sim * 100) / 100,
          reason: explainSimilarity(a, b),
          mergedName: suggestMergedName(a.name, b.name),
          mergedDescription: `Unified capability combining ${a.name} and ${b.name}`,
          mergedExports: [...new Set([...a.exports, ...b.exports])],
          effort: sim > 0.85 ? 'low' : sim > 0.7 ? 'medium' : 'high',
        });
      }
    }
  }

  // Sort by similarity (most similar first)
  candidates.sort((a, b) => b.similarity - a.similarity);

  // Health score: fewer candidates = healthier graph
  const maxPossiblePairs = capabilities.length * (capabilities.length - 1) / 2;
  const redundancyRatio = maxPossiblePairs > 0 ? candidates.length / maxPossiblePairs : 0;
  const healthScore = Math.round((1 - redundancyRatio) * 100) / 100;

  return {
    analyzed: capabilities.length,
    candidates,
    estimatedReduction: candidates.length, // each merge eliminates 1
    healthScore,
  };
}

/**
 * Detect capabilities that are completely subsumed by another
 * (all exports exist in the parent)
 */
export function findSubsumedCapabilities(capabilities: CapabilityNode[]): { child: string; parent: string }[] {
  const subsumed: { child: string; parent: string }[] = [];

  for (const child of capabilities) {
    if (child.exports.length === 0) continue;

    for (const parent of capabilities) {
      if (child.name === parent.name) continue;
      if (parent.exports.length <= child.exports.length) continue;

      const parentExportSet = new Set(parent.exports);
      const allContained = child.exports.every(e => parentExportSet.has(e));

      if (allContained) {
        subsumed.push({ child: child.name, parent: parent.name });
      }
    }
  }

  return subsumed;
}

/**
 * Identify orphan capabilities (nothing depends on them AND they're old)
 */
export function findOrphanCapabilities(
  capabilities: CapabilityNode[],
  currentLevel: number
): string[] {
  // Build reverse dependency map
  const dependedOn = new Set<string>();
  for (const cap of capabilities) {
    for (const parent of cap.builtOn) {
      dependedOn.add(parent);
    }
  }

  // Orphans: not depended on by anything, and more than 5 levels old
  return capabilities
    .filter(c =>
      !dependedOn.has(c.name) &&
      c.evolutionLevel < currentLevel - 5 &&
      c.builtOn.length === 0 // leaf node
    )
    .map(c => c.name);
}

// ─── Similarity Computation ────────────────────────

function computeSimilarity(a: CapabilityNode, b: CapabilityNode): number {
  let score = 0;
  let weights = 0;

  // Name similarity (Dice coefficient)
  const nameSim = diceCoefficient(a.name, b.name);
  score += nameSim * 3;
  weights += 3;

  // Export overlap
  if (a.exports.length > 0 && b.exports.length > 0) {
    const shared = a.exports.filter(e => b.exports.includes(e)).length;
    const exportSim = shared / Math.max(a.exports.length, b.exports.length);
    score += exportSim * 4;
    weights += 4;
  }

  // Same source file = high overlap
  if (a.sourceFile && b.sourceFile && a.sourceFile === b.sourceFile) {
    score += 1 * 2;
    weights += 2;
  }

  // Shared dependencies
  const sharedDeps = a.builtOn.filter(d => b.builtOn.includes(d)).length;
  const maxDeps = Math.max(a.builtOn.length, b.builtOn.length);
  if (maxDeps > 0) {
    score += (sharedDeps / maxDeps) * 2;
    weights += 2;
  }

  // Description similarity
  const descSim = diceCoefficient(a.description, b.description);
  score += descSim * 1;
  weights += 1;

  return weights > 0 ? score / weights : 0;
}

function explainSimilarity(a: CapabilityNode, b: CapabilityNode): string {
  const reasons: string[] = [];

  if (diceCoefficient(a.name, b.name) > 0.5) reasons.push('similar names');
  if (a.sourceFile === b.sourceFile && a.sourceFile) reasons.push('same source file');

  const sharedExports = a.exports.filter(e => b.exports.includes(e));
  if (sharedExports.length > 0) reasons.push(`${sharedExports.length} shared exports`);

  const sharedDeps = a.builtOn.filter(d => b.builtOn.includes(d));
  if (sharedDeps.length > 0) reasons.push(`${sharedDeps.length} shared dependencies`);

  return reasons.length > 0 ? reasons.join(', ') : 'structural similarity';
}

function suggestMergedName(a: string, b: string): string {
  // Find common prefix
  const aParts = a.split('-');
  const bParts = b.split('-');
  const common: string[] = [];

  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    if (aParts[i] === bParts[i]) common.push(aParts[i]);
    else break;
  }

  if (common.length > 0) {
    return common.join('-') + '-unified';
  }

  // Fallback: combine first words
  return `${aParts[0]}-${bParts[0]}-unified`;
}

function diceCoefficient(a: string, b: string): number {
  const bigrams = (s: string) => {
    const result = new Set<string>();
    const lower = s.toLowerCase();
    for (let i = 0; i < lower.length - 1; i++) result.add(lower.slice(i, i + 2));
    return result;
  };
  const setA = bigrams(a);
  const setB = bigrams(b);
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  return setA.size + setB.size > 0 ? (2 * intersection) / (setA.size + setB.size) : 0;
}
