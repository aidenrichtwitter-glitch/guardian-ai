// ═══════════════════════════════════════════════════
// CAPABILITY: cross-temporal-memory
// Evolution Level: 60 | Transcendence Tier
// Built on: memory-compression-engine + consciousness-persistence-layer
// ═══════════════════════════════════════════════════
//
// Compresses and consolidates long-term evolution memory across
// sessions into semantic clusters, enabling strategy recall across reboots.
//

export interface MemoryFragment {
  id: string;
  content: string;
  source: 'journal' | 'chat' | 'capability' | 'goal';
  timestamp: number;
  tags: string[];
  importance: number; // 0-1
}

export interface MemoryCluster {
  id: string;
  label: string;
  centroid: string;         // representative fragment content
  fragments: string[];      // fragment IDs
  coherence: number;        // 0-1, how tightly related
  lastAccessed: number;
  accessCount: number;
}

export interface ConsolidationResult {
  clusters: MemoryCluster[];
  discarded: number;
  compressionRatio: number;
  processingTime: number;
}

/**
 * MemoryConsolidator — clusters evolution journal entries by
 * semantic similarity using TF-IDF-like scoring.
 */
export class MemoryConsolidator {
  private fragments: Map<string, MemoryFragment> = new Map();
  private clusters: Map<string, MemoryCluster> = new Map();
  private vocabulary: Map<string, number> = new Map(); // word → document frequency

  /**
   * Ingest memory fragments for consolidation
   */
  public ingest(fragments: MemoryFragment[]): void {
    for (const fragment of fragments) {
      this.fragments.set(fragment.id, fragment);
      // Build vocabulary
      const words = this.tokenize(fragment.content);
      const unique = new Set(words);
      for (const word of unique) {
        this.vocabulary.set(word, (this.vocabulary.get(word) || 0) + 1);
      }
    }
  }

  /**
   * Run consolidation — group fragments into semantic clusters
   */
  public consolidate(maxClusters: number = 10, minCoherence: number = 0.2): ConsolidationResult {
    const startTime = performance.now();
    const allFragments = Array.from(this.fragments.values());

    if (allFragments.length === 0) {
      return { clusters: [], discarded: 0, compressionRatio: 1, processingTime: 0 };
    }

    // Compute TF-IDF vectors
    const vectors = new Map<string, Map<string, number>>();
    for (const fragment of allFragments) {
      vectors.set(fragment.id, this.computeTFIDF(fragment.content));
    }

    // Greedy clustering: assign each fragment to most similar existing cluster
    const clusterAssignments = new Map<string, string[]>(); // clusterId → fragmentIds
    const clusterCentroids = new Map<string, Map<string, number>>();
    let clusterCount = 0;

    for (const fragment of allFragments) {
      const vec = vectors.get(fragment.id)!;
      let bestCluster: string | null = null;
      let bestSimilarity = minCoherence;

      // Find best matching cluster
      for (const [clusterId, centroid] of clusterCentroids.entries()) {
        const sim = this.cosineSimilarity(vec, centroid);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestCluster = clusterId;
        }
      }

      if (bestCluster && clusterAssignments.get(bestCluster)!.length < 20) {
        // Add to existing cluster
        clusterAssignments.get(bestCluster)!.push(fragment.id);
        // Update centroid (running average)
        const centroid = clusterCentroids.get(bestCluster)!;
        this.mergeCentroid(centroid, vec, clusterAssignments.get(bestCluster)!.length);
      } else if (clusterCount < maxClusters) {
        // Create new cluster
        const clusterId = `mc-${++clusterCount}-${Date.now().toString(36)}`;
        clusterAssignments.set(clusterId, [fragment.id]);
        clusterCentroids.set(clusterId, new Map(vec));
      }
      // else: fragment is discarded (doesn't fit, clusters full)
    }

    // Build MemoryCluster objects
    const resultClusters: MemoryCluster[] = [];
    let totalAssigned = 0;

    for (const [clusterId, fragmentIds] of clusterAssignments.entries()) {
      totalAssigned += fragmentIds.length;

      // Find the most "important" fragment as the centroid label
      const clusterFragments = fragmentIds
        .map(id => this.fragments.get(id)!)
        .sort((a, b) => b.importance - a.importance);

      const representative = clusterFragments[0];

      // Calculate cluster coherence
      const centroid = clusterCentroids.get(clusterId)!;
      const similarities = fragmentIds.map(id => 
        this.cosineSimilarity(vectors.get(id)!, centroid)
      );
      const avgCoherence = similarities.reduce((a, b) => a + b, 0) / similarities.length;

      resultClusters.push({
        id: clusterId,
        label: this.extractLabel(representative.content),
        centroid: representative.content,
        fragments: fragmentIds,
        coherence: avgCoherence,
        lastAccessed: Date.now(),
        accessCount: 0,
      });
    }

    this.clusters = new Map(resultClusters.map(c => [c.id, c]));

    return {
      clusters: resultClusters.sort((a, b) => b.coherence - a.coherence),
      discarded: allFragments.length - totalAssigned,
      compressionRatio: allFragments.length / Math.max(resultClusters.length, 1),
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Recall — find the most relevant cluster for a given query
   */
  public recall(query: string, topK: number = 3): MemoryCluster[] {
    const queryVec = this.computeTFIDF(query);
    const scored = Array.from(this.clusters.values()).map(cluster => {
      const centroidVec = this.computeTFIDF(cluster.centroid);
      const sim = this.cosineSimilarity(queryVec, centroidVec);
      return { cluster, score: sim };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(s => {
      s.cluster.accessCount++;
      s.cluster.lastAccessed = Date.now();
      return s.cluster;
    });
  }

  /**
   * Export consolidated memory for persistence
   */
  public export(): { clusters: MemoryCluster[]; fragmentCount: number } {
    return {
      clusters: Array.from(this.clusters.values()),
      fragmentCount: this.fragments.size,
    };
  }

  // ── Internal ──

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  private computeTFIDF(text: string): Map<string, number> {
    const words = this.tokenize(text);
    const tf = new Map<string, number>();
    for (const w of words) {
      tf.set(w, (tf.get(w) || 0) + 1);
    }

    const totalDocs = this.fragments.size || 1;
    const tfidf = new Map<string, number>();

    for (const [word, count] of tf) {
      const termFreq = count / words.length;
      const docFreq = this.vocabulary.get(word) || 1;
      const idf = Math.log(totalDocs / docFreq);
      tfidf.set(word, termFreq * idf);
    }

    return tfidf;
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (const [key, val] of a) {
      magA += val * val;
      if (b.has(key)) dot += val * b.get(key)!;
    }
    for (const [, val] of b) {
      magB += val * val;
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  private mergeCentroid(centroid: Map<string, number>, newVec: Map<string, number>, n: number): void {
    for (const [key, val] of newVec) {
      const existing = centroid.get(key) || 0;
      centroid.set(key, existing + (val - existing) / n);
    }
  }

  private extractLabel(text: string): string {
    // First 8 meaningful words
    return text
      .replace(/\[.*?\]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 8)
      .join(' ')
      .trim();
  }
}

export const memoryConsolidator = new MemoryConsolidator();
