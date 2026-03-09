// ═══════════════════════════════════════════════════
// CAPABILITY: code-template-compiler
// Compiles learned patterns into reusable code templates
// WITHOUT AI. Converts evolution patterns into deterministic
// TypeScript module generators.
// Built on: self-documentation + rule-engine
// ═══════════════════════════════════════════════════

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'capability' | 'utility' | 'engine' | 'integration' | 'test';
  placeholders: TemplatePlaceholder[];
  body: string;
  compiledFromPattern?: string;
  usageCount: number;
  createdAt: number;
}

export interface TemplatePlaceholder {
  key: string;
  description: string;
  defaultValue?: string;
  type: 'string' | 'string[]' | 'number' | 'boolean';
}

export interface CompiledModule {
  fileName: string;
  content: string;
  exports: string[];
  dependencies: string[];
}

// ─── Template Library ──────────────────────────────

const TEMPLATES: CodeTemplate[] = [
  {
    id: 'capability-module',
    name: 'Capability Module',
    description: 'Standard capability module with exports, interfaces, and main function',
    category: 'capability',
    placeholders: [
      { key: 'CAPABILITY_NAME', description: 'kebab-case capability name', type: 'string' },
      { key: 'DESCRIPTION', description: 'What the capability does', type: 'string' },
      { key: 'BUILT_ON', description: 'Parent capabilities', type: 'string[]', defaultValue: '[]' },
      { key: 'MAIN_FUNCTION', description: 'Name of the primary export function', type: 'string' },
      { key: 'INPUT_TYPE', description: 'Input interface name', type: 'string', defaultValue: 'Input' },
      { key: 'OUTPUT_TYPE', description: 'Output interface name', type: 'string', defaultValue: 'Result' },
    ],
    body: `// ═══════════════════════════════════════════════════
// CAPABILITY: {{CAPABILITY_NAME}}
// {{DESCRIPTION}}
// Built on: {{BUILT_ON}}
// ═══════════════════════════════════════════════════

export interface {{INPUT_TYPE}} {
  data: unknown;
  context?: Record<string, unknown>;
}

export interface {{OUTPUT_TYPE}} {
  success: boolean;
  output: unknown;
  metadata: {
    processedAt: number;
    capability: string;
  };
}

/**
 * {{DESCRIPTION}}
 */
export function {{MAIN_FUNCTION}}(input: {{INPUT_TYPE}}): {{OUTPUT_TYPE}} {
  return {
    success: true,
    output: input.data,
    metadata: {
      processedAt: Date.now(),
      capability: '{{CAPABILITY_NAME}}',
    },
  };
}`,
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: 'engine-module',
    name: 'Engine Module',
    description: 'Processing engine with state management and lifecycle hooks',
    category: 'engine',
    placeholders: [
      { key: 'ENGINE_NAME', description: 'PascalCase engine name', type: 'string' },
      { key: 'DESCRIPTION', description: 'What the engine does', type: 'string' },
      { key: 'STATE_FIELDS', description: 'Comma-separated state field names', type: 'string', defaultValue: 'status,lastRun' },
    ],
    body: `// ═══════════════════════════════════════════════════
// ENGINE: {{ENGINE_NAME}}
// {{DESCRIPTION}}
// ═══════════════════════════════════════════════════

export interface {{ENGINE_NAME}}State {
  initialized: boolean;
  runCount: number;
  lastRunAt: number | null;
  errors: string[];
}

export class {{ENGINE_NAME}} {
  private state: {{ENGINE_NAME}}State = {
    initialized: false,
    runCount: 0,
    lastRunAt: null,
    errors: [],
  };

  initialize(): void {
    this.state.initialized = true;
  }

  async run(): Promise<{{ENGINE_NAME}}State> {
    if (!this.state.initialized) this.initialize();
    this.state.runCount++;
    this.state.lastRunAt = Date.now();
    return { ...this.state };
  }

  getState(): {{ENGINE_NAME}}State {
    return { ...this.state };
  }
}`,
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: 'utility-module',
    name: 'Utility Module',
    description: 'Pure utility functions with no side effects',
    category: 'utility',
    placeholders: [
      { key: 'MODULE_NAME', description: 'Module name', type: 'string' },
      { key: 'FUNCTIONS', description: 'Comma-separated function names', type: 'string' },
    ],
    body: `// ═══════════════════════════════════════════════════
// UTILITY: {{MODULE_NAME}}
// Pure functions — no side effects, no state
// ═══════════════════════════════════════════════════

// TODO: Implement {{FUNCTIONS}}
export const MODULE_ID = '{{MODULE_NAME}}';`,
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: 'test-module',
    name: 'Test Module',
    description: 'Test suite for a capability',
    category: 'test',
    placeholders: [
      { key: 'TARGET_MODULE', description: 'Module being tested', type: 'string' },
      { key: 'IMPORT_PATH', description: 'Import path', type: 'string' },
    ],
    body: `import { describe, it, expect } from 'vitest';
import { } from '{{IMPORT_PATH}}';

describe('{{TARGET_MODULE}}', () => {
  it('should exist and be importable', () => {
    expect(true).toBe(true);
  });
});`,
    usageCount: 0,
    createdAt: Date.now(),
  },
];

/**
 * Get all available templates
 */
export function getTemplates(): CodeTemplate[] {
  return [...TEMPLATES];
}

/**
 * Compile a template with given values into a ready-to-use module
 */
export function compileTemplate(
  templateId: string,
  values: Record<string, string | string[]>
): CompiledModule | null {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  let content = template.body;

  // Replace all placeholders
  for (const ph of template.placeholders) {
    const value = values[ph.key] ?? ph.defaultValue ?? '';
    const rendered = Array.isArray(value) ? value.join(', ') : String(value);
    content = content.split(`{{${ph.key}}}`).join(rendered);
  }

  // Extract exports from compiled content
  const exports = extractExports(content);

  // Extract dependencies (import statements)
  const dependencies = extractDependencies(content);

  // Generate filename from first placeholder or template name
  const name = String(values[template.placeholders[0]?.key] ?? template.name);
  const fileName = `src/lib/${toKebabCase(name)}.ts`;

  template.usageCount++;

  return { fileName, content, exports, dependencies };
}

/**
 * Auto-detect which template best fits a natural-language description
 */
export function inferTemplate(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('engine') || lower.includes('process') || lower.includes('lifecycle'))
    return 'engine-module';
  if (lower.includes('test') || lower.includes('spec') || lower.includes('verify'))
    return 'test-module';
  if (lower.includes('util') || lower.includes('helper') || lower.includes('pure'))
    return 'utility-module';
  return 'capability-module';
}

/**
 * Create a new template from an existing module's structure
 * (Learning from code → compiling patterns)
 */
export function learnTemplate(
  name: string,
  sourceCode: string,
  description: string
): CodeTemplate {
  // Identify variable parts (names, types) and turn them into placeholders
  const placeholders: TemplatePlaceholder[] = [];
  let body = sourceCode;

  // Find exported function names and make them placeholders
  const funcMatches = sourceCode.matchAll(/export\s+function\s+(\w+)/g);
  for (const match of funcMatches) {
    const funcName = match[1];
    const phKey = `FUNC_${placeholders.length}`;
    placeholders.push({
      key: phKey,
      description: `Function name (originally: ${funcName})`,
      type: 'string',
      defaultValue: funcName,
    });
    body = body.split(funcName).join(`{{${phKey}}}`);
  }

  // Find exported interface names
  const ifaceMatches = sourceCode.matchAll(/export\s+interface\s+(\w+)/g);
  for (const match of ifaceMatches) {
    const ifaceName = match[1];
    const phKey = `IFACE_${placeholders.length}`;
    placeholders.push({
      key: phKey,
      description: `Interface name (originally: ${ifaceName})`,
      type: 'string',
      defaultValue: ifaceName,
    });
    body = body.split(ifaceName).join(`{{${phKey}}}`);
  }

  const template: CodeTemplate = {
    id: `learned-${toKebabCase(name)}-${Date.now()}`,
    name,
    description,
    category: 'capability',
    placeholders,
    body,
    compiledFromPattern: name,
    usageCount: 0,
    createdAt: Date.now(),
  };

  TEMPLATES.push(template);
  return template;
}

// ─── Helpers ───────────────────────────────────────

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const matches = content.matchAll(/export\s+(?:function|class|interface|type|const|let)\s+(\w+)/g);
  for (const m of matches) exports.push(m[1]);
  return exports;
}

function extractDependencies(content: string): string[] {
  const deps: string[] = [];
  const matches = content.matchAll(/import\s+.*from\s+['"](.+?)['"]/g);
  for (const m of matches) deps.push(m[1]);
  return deps;
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
