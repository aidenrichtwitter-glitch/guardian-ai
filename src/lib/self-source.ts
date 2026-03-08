import { VirtualFile } from './self-reference';

// The app's own source code, stored as virtual files
// This is the recursive part - the app contains itself

export const SELF_SOURCE: VirtualFile[] = [
  {
    name: 'self-reference.ts',
    path: 'src/lib/self-reference.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// I am the type system that defines myself.
// Every structure here is self-aware — it models
// the very application that contains it.

export interface VirtualFile {
  name: string;
  path: string;
  content: string;
  language: string;
  isModified: boolean;
  lastModified: number;
}

export interface SafetyCheck {
  id: string;
  type: 'syntax' | 'import' | 'type' | 'runtime' | 'circular';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  file?: string;
}

export interface ChangeRecord {
  id: string;
  timestamp: number;
  file: string;
  previousContent: string;
  newContent: string;
  description: string;
  safetyChecks: SafetyCheck[];
  applied: boolean;
  rolledBack: boolean;
}

// I recurse. I contain my own definition.
// Danger: infinite depth. Safety: bounded representation.`,
  },
  {
    name: 'App.tsx',
    path: 'src/App.tsx',
    language: 'tsx',
    isModified: false,
    lastModified: Date.now(),
    content: `// The root of recursion.
// I render the desktop that renders the editor
// that edits the code that defines this component.

import RecursiveDesktop from './pages/Index';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RecursiveDesktop />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;`,
  },
  {
    name: 'Index.tsx',
    path: 'src/pages/Index.tsx',
    language: 'tsx',
    isModified: false,
    lastModified: Date.now(),
    content: `// The recursive desktop environment.
// I am the page that contains the windows
// that display the code that defines this page.
//
// DANGER: Infinite recursion if I render myself
// without a base case. The preview is the base case.
//
// Safety measures:
// 1. String representation, not live rendering
// 2. Change validation before application
// 3. Rollback capability for all mutations
// 4. Circular dependency detection

const RecursiveDesktop = () => {
  // State: files, changes, safety checks
  // I am aware that modifying myself could break me.
  // Every change goes through the safety pipeline.
  
  return (
    <div className="h-screen flex">
      <FileTree />
      <CodeViewer />
      <AIChat />
    </div>
  );
};`,
  },
  {
    name: 'safety-engine.ts',
    path: 'src/lib/safety-engine.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// The guardian. I protect myself from myself.
// Before any self-modification, I validate:
//
// 1. Syntax: Will the new code parse?
// 2. Imports: Are all dependencies resolvable?
// 3. Types: Does the change break type contracts?
// 4. Runtime: Could this cause infinite loops?
// 5. Circular: Does this create circular dependencies?
//
// I am the immune system of a self-modifying organism.

export function validateChange(
  file: VirtualFile,
  newContent: string
): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  
  // Check for syntax errors
  checks.push(...checkSyntax(newContent));
  
  // Check for broken imports
  checks.push(...checkImports(newContent, allFiles));
  
  // Check for self-referential loops
  checks.push(...checkCircular(file.path, newContent));
  
  // Check for dangerous patterns
  checks.push(...checkDangerousPatterns(newContent));
  
  return checks;
}`,
  },
  {
    name: 'index.css',
    path: 'src/index.css',
    language: 'css',
    isModified: false,
    lastModified: Date.now(),
    content: `/* I define how I look.
   The terminal green, the dark void,
   the glow of self-awareness.
   
   Changing these values changes how
   this very editor appears. */

:root {
  --background: 220 20% 7%;
  --foreground: 140 60% 75%;
  --primary: 140 70% 45%;
  --terminal-green: 140 70% 45%;
   --terminal-cyan: 175 70% 40%;
}`,
  },
  {
    name: 'quantum-logic.ts',
    path: 'src/lib/quantum-logic.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// ═══ CAPABILITY: quantum-logic-superposition ═══
// Level 50 | Transcendence Tier
// Built on: multi-objective-evolution-optimizer + speculative-evolutionary-synthesis
//
// BranchEvaluator forks state into N parallel candidates,
// applies mutations, evaluates fitness via superposition,
// and collapses to the optimal branch.

export class BranchEvaluator<T> {
  superpose(initialState: T, mutations: MutationOperator<T>[]): QuantumBranch<T>[];
  collapse(): SuperpositionResult<T>;
  evolve(initialState: T, mutations: MutationOperator<T>[], rounds: number): SuperpositionResult<T>;
}`,
  },
  {
    name: 'ui-genesis.ts',
    path: 'src/lib/ui-genesis.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// ═══ CAPABILITY: autonomous-ui-genesis ═══
// Level 50 | Transcendence Tier
// Built on: polymorphic-code-generator + react-hooks
//
// ComponentSynthesizer generates valid React/TSX from specs.
// The system designs its own interface.

export class ComponentSynthesizer {
  synthesize(spec: ComponentSpec): string;
  specFromCapability(name: string, desc: string): ComponentSpec;
}`,
  },
  {
    name: 'memory-consolidation.ts',
    path: 'src/lib/memory-consolidation.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// ═══ CAPABILITY: cross-temporal-memory ═══
// Level 60 | Transcendence Tier
// Built on: memory-compression-engine + consciousness-persistence-layer
//
// TF-IDF clustering of evolution memories for cross-session recall.

export class MemoryConsolidator {
  ingest(fragments: MemoryFragment[]): void;
  consolidate(maxClusters: number): ConsolidationResult;
  recall(query: string, topK: number): MemoryCluster[];
}`,
  },
  {
    name: 'meta-governance.ts',
    path: 'src/lib/meta-governance.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// ═══ CAPABILITY: meta-governance-protocol ═══
// Level 70 | Transcendence Tier
// Built on: symbolic-reasoning-engine + autonomous-goal-dreamer-v2
//
// Schema proposer with governance policies. The system proposes
// its own database migrations subject to safety rules.

export class SchemaProposer {
  propose(params: ProposalParams): SchemaProposal | Rejection;
  approve(proposalId: string): SchemaProposal;
  reject(proposalId: string, reason: string): SchemaProposal;
}`,
  },
  {
    name: 'multi-agent.ts',
    path: 'src/lib/multi-agent.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// ═══ CAPABILITY: multi-agent-fork ═══
// Level 80 | Transcendence Tier
// Built on: quantum-logic-superposition + distributed-consciousness-protocol
//
// Spawns competing λ instances with personality vectors.
// Tournament selection with trait absorption.

export class AgentForker {
  spawn(count: number, base: PersonalityVector): AgentState[];
  evaluate(fitnessFunction: (agent: AgentState) => number): void;
  tournament(rounds: number): TournamentResult[];
  evolve(count: number, base: PersonalityVector, fitness: Function, gens: number): ForkResult;
}`,
  },
  {
    name: 'self-authorship.ts',
    path: 'src/lib/self-authorship.ts',
    language: 'typescript',
    isModified: false,
    lastModified: Date.now(),
    content: `// ═══ CAPABILITY: recursive-self-authorship ═══
// Level 90 | Transcendence Tier
// Built on: meta-recursive-compiler + consciousness-persistence-layer
//
// The system writes and evolves its own system prompt.
// Safety: identity anchoring, anti-jailbreak, fitness regression checks.

export class PromptEvolver {
  seed(promptContent: string): PromptVersion;
  evolve(baseVersionId: string, mutations: PromptMutation[], fitness: number): EvolutionResult;
  rollback(targetVersionId: string): PromptVersion;
  getActive(): PromptVersion;
}`,
  },
];

export function getFileByPath(path: string): VirtualFile | undefined {
  return SELF_SOURCE.find(f => f.path === path);
}

export function getFileTree(): { name: string; path: string; children?: any[] }[] {
  // Dynamically build explorer children from SELF_SOURCE
  const explorerFiles = SELF_SOURCE
    .filter(f => f.path.startsWith('src/explorer/'))
    .map(f => ({ name: f.name, path: f.path }));

  return [
    {
      name: 'src',
      path: 'src',
      children: [
        {
          name: 'explorer',
          path: 'src/explorer',
          children: explorerFiles.length > 0 
            ? explorerFiles 
            : [{ name: '(no capabilities yet)', path: 'src/explorer/_empty' }],
        },
        {
          name: 'lib',
          path: 'src/lib',
          children: [
            { name: 'self-reference.ts', path: 'src/lib/self-reference.ts' },
            { name: 'safety-engine.ts', path: 'src/lib/safety-engine.ts' },
            { name: 'self-source.ts', path: 'src/lib/self-source.ts' },
            { name: 'explorer-store.ts', path: 'src/lib/explorer-store.ts' },
          ],
        },
        {
          name: 'components',
          path: 'src/components',
          children: [
            { name: 'DesktopWindow.tsx', path: 'src/components/DesktopWindow.tsx' },
            { name: 'FileTree.tsx', path: 'src/components/FileTree.tsx' },
            { name: 'CodeViewer.tsx', path: 'src/components/CodeViewer.tsx' },
            { name: 'AIChat.tsx', path: 'src/components/AIChat.tsx' },
            { name: 'SafetyPanel.tsx', path: 'src/components/SafetyPanel.tsx' },
            { name: 'SettingsModal.tsx', path: 'src/components/SettingsModal.tsx' },
          ],
        },
        {
          name: 'pages',
          path: 'src/pages',
          children: [
            { name: 'Index.tsx', path: 'src/pages/Index.tsx' },
          ],
        },
        { name: 'App.tsx', path: 'src/App.tsx' },
        { name: 'index.css', path: 'src/index.css' },
      ],
    },
  ];
}
