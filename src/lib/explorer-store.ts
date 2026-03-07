// Explorer Store — saves capabilities as virtual files in src/explorer/
// Each capability becomes a real module the system can reference and build upon

import { VirtualFile } from './self-reference';
import { SELF_SOURCE } from './self-source';
import { CapabilityRecord } from './recursion-engine';

const EXPLORER_STORAGE_KEY = 'recursive-explorer-files';

export interface ExplorerFile {
  capability: string;
  content: string;
  description: string;
  builtOn: string[];
  acquiredAt: number;
  acquiredCycle: number;
  sourceFile: string;
}

// Generate a TypeScript module for a capability
function generateCapabilityModule(cap: CapabilityRecord, sourceContent?: string): string {
  const builtOnStr = cap.builtOn.length > 0 
    ? `\n// Built on: ${cap.builtOn.join(' + ')}` 
    : '\n// Base capability — no prerequisites';

  return `// ═══════════════════════════════════════════════════
// CAPABILITY: ${cap.name}
// Acquired: Cycle ${cap.acquiredCycle} | ${new Date(cap.acquiredAt).toISOString()}
// Source: ${cap.file}${builtOnStr}
// ═══════════════════════════════════════════════════
//
// ${cap.description}
//

export const capability = {
  name: '${cap.name}',
  acquiredAt: ${cap.acquiredAt},
  acquiredCycle: ${cap.acquiredCycle},
  sourceFile: '${cap.file}',
  builtOn: [${cap.builtOn.map(b => `'${b}'`).join(', ')}],
  active: true,
};

// The logic this capability provides:
${sourceContent || `// This capability was acquired through self-modification of ${cap.file}.\n// It enhances the system's ${cap.name.replace(/-/g, ' ')} abilities.`}

export function apply(context: Record<string, unknown>): Record<string, unknown> {
  return {
    ...context,
    ['${cap.name}']: true,
    _capabilities: [...((context._capabilities as string[]) || []), '${cap.name}'],
  };
}

export function describe(): string {
  return '${cap.description.replace(/'/g, "\\'")}';
}
`;
}

// Save a capability as a virtual file in SELF_SOURCE under src/explorer/
export function saveCapabilityToExplorer(
  capRecord: CapabilityRecord,
  sourceContent?: string
): VirtualFile {
  const fileName = `${capRecord.name}.ts`;
  const filePath = `src/explorer/${fileName}`;
  const content = generateCapabilityModule(capRecord, sourceContent);

  // Check if file already exists in SELF_SOURCE
  const existingIdx = SELF_SOURCE.findIndex(f => f.path === filePath);
  const virtualFile: VirtualFile = {
    name: fileName,
    path: filePath,
    content,
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
  };

  if (existingIdx !== -1) {
    SELF_SOURCE[existingIdx] = virtualFile;
  } else {
    SELF_SOURCE.push(virtualFile);
  }

  // Persist to localStorage
  persistExplorerFiles();

  return virtualFile;
}

// Save the explorer manifest — an index of all capabilities
export function saveExplorerManifest(capabilities: string[], history: CapabilityRecord[]): void {
  const manifestPath = 'src/explorer/manifest.ts';
  const content = `// ═══════════════════════════════════════════════════
// EXPLORER MANIFEST — Auto-generated capability index
// Total capabilities: ${capabilities.length}
// Evolution level: ${Math.floor(capabilities.length / 3) + 1}
// Last updated: ${new Date().toISOString()}
// ═══════════════════════════════════════════════════

export const CAPABILITIES = [
${capabilities.map(c => `  '${c}',`).join('\n')}
] as const;

export const EVOLUTION_LEVEL = ${Math.floor(capabilities.length / 3) + 1};

export const CAPABILITY_TREE: Record<string, string[]> = {
${history.map(h => `  '${h.name}': [${h.builtOn.map(b => `'${b}'`).join(', ')}],`).join('\n')}
};

// Which capabilities can combine to unlock new ones
export function getUnlockedBy(cap: string): string[] {
  return Object.entries(CAPABILITY_TREE)
    .filter(([_, deps]) => deps.includes(cap))
    .map(([name]) => name);
}

// Get all base capabilities (no prerequisites)
export function getBaseCaps(): string[] {
  return Object.entries(CAPABILITY_TREE)
    .filter(([_, deps]) => deps.length === 0)
    .map(([name]) => name);
}

// Get the full dependency chain for a capability
export function getDependencyChain(cap: string): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  function walk(c: string) {
    if (visited.has(c)) return;
    visited.add(c);
    const deps = CAPABILITY_TREE[c] || [];
    deps.forEach(walk);
    chain.push(c);
  }
  walk(cap);
  return chain;
}
`;

  const existingIdx = SELF_SOURCE.findIndex(f => f.path === manifestPath);
  const virtualFile: VirtualFile = {
    name: 'manifest.ts',
    path: manifestPath,
    content,
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
  };

  if (existingIdx !== -1) {
    SELF_SOURCE[existingIdx] = virtualFile;
  } else {
    SELF_SOURCE.push(virtualFile);
  }

  persistExplorerFiles();
}

// Persist all explorer files to localStorage
function persistExplorerFiles(): void {
  try {
    const explorerFiles = SELF_SOURCE
      .filter(f => f.path.startsWith('src/explorer/'))
      .map(f => ({ name: f.name, path: f.path, content: f.content, language: f.language, lastModified: f.lastModified }));
    localStorage.setItem(EXPLORER_STORAGE_KEY, JSON.stringify(explorerFiles));
  } catch {}
}

// Load explorer files from localStorage back into SELF_SOURCE
export function loadExplorerFiles(): void {
  try {
    const stored = localStorage.getItem(EXPLORER_STORAGE_KEY);
    if (!stored) return;
    const files: Array<{ name: string; path: string; content: string; language: string; lastModified: number }> = JSON.parse(stored);
    for (const f of files) {
      const existingIdx = SELF_SOURCE.findIndex(sf => sf.path === f.path);
      const virtualFile: VirtualFile = {
        ...f,
        isModified: false,
      };
      if (existingIdx !== -1) {
        SELF_SOURCE[existingIdx] = virtualFile;
      } else {
        SELF_SOURCE.push(virtualFile);
      }
    }
  } catch {}
}

// Get all explorer capability names from SELF_SOURCE
export function getExplorerCapabilities(): string[] {
  return SELF_SOURCE
    .filter(f => f.path.startsWith('src/explorer/') && f.name !== 'manifest.ts')
    .map(f => f.name.replace('.ts', ''));
}
