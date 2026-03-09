// ═══════════════════════════════════════════════════
// CAPABILITY: multi-modal-reasoning
// Reasons about code, data, and natural language
// simultaneously. Provides a unified analysis pipeline
// that combines structural code analysis with semantic
// understanding and data pattern extraction.
// Built on: knowledge-search-engine + self-documentation
// ═══════════════════════════════════════════════════

import { documentFile, type DocEntry } from './self-documentation';

export interface ReasoningInput {
  mode: 'code' | 'data' | 'text' | 'mixed';
  code?: string;
  data?: Record<string, unknown> | unknown[];
  text?: string;
  question?: string;
}

export interface ReasoningOutput {
  insights: Insight[];
  structuralAnalysis: StructuralInfo | null;
  dataAnalysis: DataInfo | null;
  textAnalysis: TextInfo | null;
  synthesis: string;
  confidence: number;
}

export interface Insight {
  type: 'observation' | 'warning' | 'suggestion' | 'correlation';
  content: string;
  source: 'code' | 'data' | 'text' | 'cross-modal';
  confidence: number;
}

export interface StructuralInfo {
  exports: string[];
  complexity: 'low' | 'medium' | 'high';
  patterns: string[];
  lineCount: number;
  hasTests: boolean;
}

export interface DataInfo {
  type: 'object' | 'array' | 'primitive';
  fieldCount: number;
  nestedDepth: number;
  patterns: string[];
}

export interface TextInfo {
  wordCount: number;
  sentenceCount: number;
  keywords: string[];
  intent: 'question' | 'instruction' | 'description' | 'assertion';
  entities: string[];
}

/**
 * Multi-modal reasoning: analyze code, data, and text together
 * to produce cross-cutting insights. Fully deterministic.
 */
export function reason(input: ReasoningInput): ReasoningOutput {
  const insights: Insight[] = [];
  let structuralAnalysis: StructuralInfo | null = null;
  let dataAnalysis: DataInfo | null = null;
  let textAnalysis: TextInfo | null = null;

  // ── Code Analysis ──
  if (input.code) {
    structuralAnalysis = analyzeCode(input.code);
    insights.push(...codeInsights(structuralAnalysis));
  }

  // ── Data Analysis ──
  if (input.data !== undefined) {
    dataAnalysis = analyzeData(input.data);
    insights.push(...dataInsights(dataAnalysis));
  }

  // ── Text Analysis ──
  if (input.text) {
    textAnalysis = analyzeText(input.text);
    insights.push(...textInsights(textAnalysis));
  }

  // ── Cross-Modal Correlations ──
  if (structuralAnalysis && textAnalysis) {
    // Check if text mentions any exports
    const mentionedExports = structuralAnalysis.exports.filter(e =>
      input.text?.toLowerCase().includes(e.toLowerCase())
    );
    if (mentionedExports.length > 0) {
      insights.push({
        type: 'correlation',
        content: `Text references ${mentionedExports.length} code exports: ${mentionedExports.join(', ')}`,
        source: 'cross-modal',
        confidence: 0.9,
      });
    }
  }

  if (structuralAnalysis && dataAnalysis) {
    // Check if data structure matches code interfaces
    if (dataAnalysis.fieldCount > 0 && structuralAnalysis.exports.length > 0) {
      insights.push({
        type: 'observation',
        content: `Data has ${dataAnalysis.fieldCount} fields; code exports ${structuralAnalysis.exports.length} symbols — potential mapping exists`,
        source: 'cross-modal',
        confidence: 0.6,
      });
    }
  }

  // ── Synthesis ──
  const synthesis = synthesize(insights, input.question);
  const confidence = insights.length > 0
    ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
    : 0;

  return {
    insights,
    structuralAnalysis,
    dataAnalysis,
    textAnalysis,
    synthesis,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ─── Code Analyzer ─────────────────────────────────

function analyzeCode(code: string): StructuralInfo {
  const lines = code.split('\n');
  const doc = documentFile('inline', code);

  const patterns: string[] = [];
  if (code.includes('class ')) patterns.push('object-oriented');
  if (code.includes('=>')) patterns.push('functional');
  if (code.includes('async ')) patterns.push('async');
  if (code.includes('import ')) patterns.push('modular');
  if (/\bfor\b|\bwhile\b/.test(code)) patterns.push('iterative');
  if (/function\s+\w+.*\w+\(/.test(code) && code.includes('return')) patterns.push('recursive-candidate');

  return {
    exports: doc.exports.map(e => e.name),
    complexity: doc.complexity,
    patterns,
    lineCount: lines.length,
    hasTests: code.includes('describe(') || code.includes('it(') || code.includes('test('),
  };
}

function codeInsights(info: StructuralInfo): Insight[] {
  const insights: Insight[] = [];
  if (info.complexity === 'high') {
    insights.push({
      type: 'warning',
      content: `High complexity code (${info.lineCount} lines) — consider decomposition`,
      source: 'code',
      confidence: 0.8,
    });
  }
  if (!info.hasTests) {
    insights.push({
      type: 'suggestion',
      content: 'No test patterns detected — consider adding tests',
      source: 'code',
      confidence: 0.7,
    });
  }
  if (info.patterns.includes('recursive-candidate')) {
    insights.push({
      type: 'observation',
      content: 'Code contains recursive patterns — self-referential structure detected',
      source: 'code',
      confidence: 0.6,
    });
  }
  return insights;
}

// ─── Data Analyzer ─────────────────────────────────

function analyzeData(data: Record<string, unknown> | unknown[]): DataInfo {
  if (Array.isArray(data)) {
    return {
      type: 'array',
      fieldCount: data.length,
      nestedDepth: measureDepth(data),
      patterns: detectDataPatterns(data),
    };
  }
  if (typeof data === 'object' && data !== null) {
    return {
      type: 'object',
      fieldCount: Object.keys(data).length,
      nestedDepth: measureDepth(data),
      patterns: detectDataPatterns(data),
    };
  }
  return { type: 'primitive', fieldCount: 0, nestedDepth: 0, patterns: [] };
}

function measureDepth(obj: unknown, depth = 0): number {
  if (depth > 10) return depth;
  if (typeof obj !== 'object' || obj === null) return depth;
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  return Math.max(depth, ...values.map(v => measureDepth(v, depth + 1)));
}

function detectDataPatterns(data: unknown): string[] {
  const patterns: string[] = [];
  const str = JSON.stringify(data);
  if (str.includes('"id"')) patterns.push('has-identifiers');
  if (str.includes('"created_at"') || str.includes('"timestamp"')) patterns.push('time-series');
  if (str.includes('"status"')) patterns.push('stateful');
  if (str.length > 10000) patterns.push('large-dataset');
  return patterns;
}

function dataInsights(info: DataInfo): Insight[] {
  const insights: Insight[] = [];
  if (info.nestedDepth > 4) {
    insights.push({
      type: 'warning',
      content: `Deeply nested data (depth ${info.nestedDepth}) — consider flattening`,
      source: 'data',
      confidence: 0.7,
    });
  }
  if (info.patterns.includes('time-series')) {
    insights.push({
      type: 'observation',
      content: 'Time-series data detected — consider temporal analysis',
      source: 'data',
      confidence: 0.8,
    });
  }
  return insights;
}

// ─── Text Analyzer ─────────────────────────────────

function analyzeText(text: string): TextInfo {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Simple keyword extraction (nouns/verbs > 4 chars, not stopwords)
  const stopwords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'their', 'there', 'which', 'about', 'these', 'those', 'other', 'into', 'over', 'after', 'before']);
  const keywords = [...new Set(
    words
      .map(w => w.toLowerCase().replace(/[^a-z0-9-]/g, ''))
      .filter(w => w.length > 4 && !stopwords.has(w))
  )].slice(0, 10);

  // Detect intent
  let intent: TextInfo['intent'] = 'description';
  if (text.includes('?')) intent = 'question';
  else if (/^(create|build|add|implement|make|fix|update|delete|remove)/i.test(text.trim())) intent = 'instruction';
  else if (/^(the|this|it|we)\s/i.test(text.trim()) && !text.includes('?')) intent = 'assertion';

  // Extract entities (capitalized words, kebab-case identifiers)
  const entities = [...new Set([
    ...text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || [],
    ...text.match(/[a-z]+-[a-z]+(?:-[a-z]+)*/g) || [],
  ])].slice(0, 10);

  return { wordCount: words.length, sentenceCount: sentences.length, keywords, intent, entities };
}

function textInsights(info: TextInfo): Insight[] {
  const insights: Insight[] = [];
  if (info.intent === 'question') {
    insights.push({
      type: 'observation',
      content: `Question detected with ${info.keywords.length} key terms`,
      source: 'text',
      confidence: 0.9,
    });
  }
  if (info.entities.length > 0) {
    insights.push({
      type: 'observation',
      content: `Entities identified: ${info.entities.slice(0, 5).join(', ')}`,
      source: 'text',
      confidence: 0.7,
    });
  }
  return insights;
}

// ─── Synthesis ─────────────────────────────────────

function synthesize(insights: Insight[], question?: string): string {
  if (insights.length === 0) return 'No insights available — insufficient input data.';

  const warnings = insights.filter(i => i.type === 'warning');
  const suggestions = insights.filter(i => i.type === 'suggestion');
  const correlations = insights.filter(i => i.type === 'correlation');
  const observations = insights.filter(i => i.type === 'observation');

  const parts: string[] = [];
  if (correlations.length > 0) {
    parts.push(`Cross-modal analysis found ${correlations.length} correlation(s).`);
  }
  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning(s) require attention.`);
  }
  if (suggestions.length > 0) {
    parts.push(`${suggestions.length} improvement suggestion(s) available.`);
  }
  if (observations.length > 0) {
    parts.push(`${observations.length} observation(s) noted.`);
  }

  if (question) {
    parts.unshift(`Regarding "${question}":`);
  }

  return parts.join(' ');
}
