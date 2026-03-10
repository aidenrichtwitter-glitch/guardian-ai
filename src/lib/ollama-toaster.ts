import { checkOllamaAvailability } from './ollama-safety-guard';

export interface OllamaToasterConfig {
  endpoint: string;
  model: string;
}

const TOASTER_CONFIG_KEY = 'ollama-toaster-config';

const DEFAULT_TOASTER_CONFIG: OllamaToasterConfig = {
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5-coder:7b',
};

export function loadToasterConfig(): OllamaToasterConfig {
  try {
    const raw = localStorage.getItem(TOASTER_CONFIG_KEY);
    if (raw) return { ...DEFAULT_TOASTER_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_TOASTER_CONFIG };
}

export function saveToasterConfig(config: OllamaToasterConfig): void {
  localStorage.setItem(TOASTER_CONFIG_KEY, JSON.stringify(config));
}

export interface ToasterAnalysis {
  error_summary: string;
  affected_files: string[];
  missing_files: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  suggested_context_to_include: string[];
}

export interface ToasterAvailability {
  available: boolean;
  models: string[];
  version?: string;
  error?: string;
}

let cachedAvailability: ToasterAvailability | null = null;
let lastAvailabilityCheck = 0;
const AVAILABILITY_CACHE_MS = 30_000;

export async function checkToasterAvailability(config?: OllamaToasterConfig): Promise<ToasterAvailability> {
  const now = Date.now();
  if (cachedAvailability && now - lastAvailabilityCheck < AVAILABILITY_CACHE_MS) {
    return cachedAvailability;
  }
  const cfg = config || loadToasterConfig();
  const result = await checkOllamaAvailability(cfg.endpoint);
  cachedAvailability = result;
  lastAvailabilityCheck = now;
  return result;
}

export function clearAvailabilityCache(): void {
  cachedAvailability = null;
  lastAvailabilityCheck = 0;
}

async function ollamaGenerate(prompt: string, config?: OllamaToasterConfig): Promise<string> {
  const cfg = config || loadToasterConfig();
  const resp = await fetch(`${cfg.endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.0,
        num_predict: 2048,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Ollama API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data.response || '';
}

function extractJSON<T>(text: string): T | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

export async function analyzeLogsForContext(
  logs: string,
  fileTree: string[],
  fileContents?: Record<string, string>,
  config?: OllamaToasterConfig
): Promise<ToasterAnalysis | null> {
  const availability = await checkToasterAvailability(config);
  if (!availability.available) return null;

  const filesSection = fileTree.slice(0, 100).join('\n');
  const contentsSection = fileContents
    ? Object.entries(fileContents)
        .slice(0, 10)
        .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 2000)}`)
        .join('\n\n')
    : '';

  const prompt = `You are a log analyzer and file selector. Do NOT invent code, fixes, explanations, or suggestions. Only analyze and output JSON.

Given the following console/build logs and project file tree, identify which files are affected by the errors and what the errors are about.

=== LOGS ===
${logs.slice(0, 4000)}

=== FILE TREE ===
${filesSection}

${contentsSection ? `=== FILE CONTENTS ===\n${contentsSection}` : ''}

Output ONLY valid JSON in this exact format, nothing else:
{
  "error_summary": "brief one-line summary of what went wrong",
  "affected_files": ["path/to/file1.ts", "path/to/file2.tsx"],
  "missing_files": ["path/to/missing-import.ts"],
  "priority": "critical|high|medium|low",
  "suggested_context_to_include": ["path/to/related-file.ts"]
}`;

  try {
    const response = await ollamaGenerate(prompt, config);
    const parsed = extractJSON<ToasterAnalysis>(response);
    if (parsed && parsed.error_summary && Array.isArray(parsed.affected_files)) {
      return {
        error_summary: String(parsed.error_summary),
        affected_files: (parsed.affected_files || []).filter((f: unknown) => typeof f === 'string'),
        missing_files: (parsed.missing_files || []).filter((f: unknown) => typeof f === 'string'),
        priority: ['critical', 'high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
        suggested_context_to_include: (parsed.suggested_context_to_include || []).filter((f: unknown) => typeof f === 'string'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface SmartContextBundle {
  usedOllama: boolean;
  analysis: ToasterAnalysis | null;
  filesToInclude: string[];
  errorSummary: string;
  priority: string;
}

export async function buildSmartContext(
  logs: string,
  fileTree: string[],
  fileContents?: Record<string, string>,
  config?: OllamaToasterConfig
): Promise<SmartContextBundle> {
  const analysis = await analyzeLogsForContext(logs, fileTree, fileContents, config);

  if (!analysis) {
    return {
      usedOllama: false,
      analysis: null,
      filesToInclude: fileTree.filter(f =>
        f === 'package.json' || f === 'tsconfig.json' || f === 'vite.config.ts' ||
        f === 'index.html' || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')
      ).slice(0, 30),
      errorSummary: '',
      priority: 'medium',
    };
  }

  const allFiles = new Set<string>([
    ...analysis.affected_files,
    ...analysis.missing_files,
    ...analysis.suggested_context_to_include,
  ]);

  const validFiles = [...allFiles].filter(f => fileTree.includes(f));

  const alwaysInclude = ['package.json', 'tsconfig.json', 'vite.config.ts'];
  for (const f of alwaysInclude) {
    if (fileTree.includes(f) && !validFiles.includes(f)) {
      validFiles.push(f);
    }
  }

  return {
    usedOllama: true,
    analysis,
    filesToInclude: validFiles.slice(0, 30),
    errorSummary: analysis.error_summary,
    priority: analysis.priority,
  };
}

export interface CleanedFile {
  path: string;
  action: 'create' | 'update' | 'delete' | 'replace';
  content: string;
  diff: string;
  original_block: string;
}

export interface CleanedResponse {
  reasoning: string;
  files: CleanedFile[];
  unparsed_text: string;
}

export async function cleanGrokResponse(
  rawResponse: string,
  config?: OllamaToasterConfig
): Promise<CleanedResponse | null> {
  const availability = await checkToasterAvailability(config);
  if (!availability.available) return null;

  const truncated = rawResponse.slice(0, 12000);

  const prompt = `You are a response parser. Do NOT interpret, fix, or add anything. Only extract and reformat exactly what is present in the following AI assistant response.

Extract all code blocks with their file paths and the reasoning/explanation text.

=== RAW RESPONSE ===
${truncated}
=== END RAW RESPONSE ===

Output ONLY valid JSON in this exact format, nothing else:
{
  "reasoning": "the explanation text from the response (non-code parts summarized)",
  "files": [
    {
      "path": "src/example.ts",
      "action": "create|update|delete|replace",
      "content": "the full file content from the code block",
      "diff": "",
      "original_block": "the raw code block as it appeared"
    }
  ],
  "unparsed_text": "any text that could not be categorized"
}

Rules:
- Extract EVERY code block that has a file path
- The "path" must be the file path referenced in or above the code block (e.g. from "// file: path" comments or markdown headings)
- The "content" must be the EXACT code from the block, do not modify it
- The "action" should be "create" for new files, "update" for modifications, "replace" for full rewrites, "delete" for deletions
- If a code block has no identifiable file path, still include it with path as empty string
- Do NOT invent or modify any code content`;

  try {
    const response = await ollamaGenerate(prompt, config);
    const parsed = extractJSON<CleanedResponse>(response);
    if (!parsed || !Array.isArray(parsed.files)) return null;

    return {
      reasoning: String(parsed.reasoning || ''),
      files: parsed.files
        .filter((f: any) => f && typeof f.content === 'string' && f.content.length > 0)
        .map((f: any) => ({
          path: String(f.path || ''),
          action: ['create', 'update', 'delete', 'replace'].includes(f.action) ? f.action : 'update',
          content: String(f.content),
          diff: String(f.diff || ''),
          original_block: String(f.original_block || ''),
        })),
      unparsed_text: String(parsed.unparsed_text || ''),
    };
  } catch {
    return null;
  }
}

export function cleanedResponseToBlocks(cleaned: CleanedResponse): import('./code-parser').ParsedBlock[] {
  return cleaned.files
    .filter(f => f.content.length > 0 && f.action !== 'delete')
    .map(f => {
      const ext = f.path.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';
      const extMap: Record<string, string> = {
        ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        html: 'html', css: 'css', json: 'json', py: 'python',
        sql: 'sql', yaml: 'yaml', yml: 'yaml', md: 'markdown',
        glsl: 'glsl', vue: 'vue', svelte: 'svelte', go: 'go',
        rs: 'rust', rb: 'ruby', java: 'java', swift: 'swift',
        sh: 'bash', scss: 'scss', less: 'less',
      };
      return {
        filePath: f.path,
        code: f.content,
        language: extMap[ext] || 'typescript',
      };
    });
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  category: 'fix' | 'enhance' | 'add' | 'optimize';
}

export interface QuickActionsResult {
  usedOllama: boolean;
  actions: QuickAction[];
}

function heuristicQuickActions(
  fileTree: string[],
  packageJson: Record<string, any> | null,
  errorCount: number,
  cssContent: string,
): QuickAction[] {
  const actions: QuickAction[] = [];
  const deps = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };
  const depNames = Object.keys(deps);
  const hasTailwind = depNames.includes('tailwindcss') || fileTree.some(f => f.includes('tailwind.config'));
  const hasTests = fileTree.some(f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));
  const hasAuth = depNames.some(d => d.includes('auth') || d.includes('clerk') || d.includes('next-auth') || d.includes('passport')) || fileTree.some(f => f.toLowerCase().includes('auth'));
  const hasDarkMode = cssContent.includes('.dark') || cssContent.includes('dark:') || depNames.includes('next-themes');
  const hasResponsive = cssContent.includes('md:') || cssContent.includes('lg:') || cssContent.includes('sm:') || cssContent.includes('@media');
  const tsxFiles = fileTree.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));
  const cssFiles = fileTree.filter(f => f.endsWith('.css') || f.endsWith('.scss'));
  const cssIsMinimal = cssFiles.length <= 1 && cssContent.length < 500;

  if (errorCount > 0) {
    actions.push({
      id: 'fix-errors',
      label: `Fix ${errorCount} error${errorCount > 1 ? 's' : ''}`,
      icon: 'AlertTriangle',
      prompt: `The app preview currently has ${errorCount} error${errorCount > 1 ? 's' : ''} in the console/build output. Please analyze the errors from the project context above and fix all issues. Return corrected code blocks for each affected file using the format:\n// file: path/to/file.tsx\n\`\`\`tsx\n// corrected content\n\`\`\``,
      category: 'fix',
    });
  }

  if (!hasDarkMode && hasTailwind) {
    actions.push({
      id: 'add-dark-mode',
      label: 'Add dark mode',
      icon: 'Moon',
      prompt: `This project uses Tailwind CSS but has no dark mode support. Add dark mode toggle functionality:\n1. Configure darkMode: ["class"] in tailwind.config.ts if not already set\n2. Add CSS variables for dark theme in the main CSS file\n3. Create a ThemeProvider with localStorage persistence\n4. Add a dark mode toggle button component\n5. Update existing components to use dark: variants where needed\n\nCurrent project files: ${tsxFiles.slice(0, 10).join(', ')}\nReturn all changed files as code blocks.`,
      category: 'add',
    });
  }

  if (!hasAuth) {
    actions.push({
      id: 'add-auth',
      label: 'Add authentication',
      icon: 'Lock',
      prompt: `This project has no authentication. Add a simple authentication system:\n1. Add a login/signup form component\n2. Add auth context/provider with state management\n3. Add protected route wrapper\n4. Add a user menu/avatar in the header\n\nKeep it lightweight — use localStorage for demo or integrate with the existing backend if one exists.\nCurrent project files: ${tsxFiles.slice(0, 10).join(', ')}\nReturn all changed files as code blocks.`,
      category: 'add',
    });
  }

  if (cssIsMinimal && !hasTailwind) {
    actions.push({
      id: 'improve-styling',
      label: 'Improve styling',
      icon: 'Palette',
      prompt: `The project has minimal CSS styling (${cssFiles.length} CSS file${cssFiles.length !== 1 ? 's' : ''}, ~${cssContent.length} chars total). Significantly improve the visual design:\n1. Add a cohesive color scheme\n2. Improve spacing, typography, and layout\n3. Add hover/focus states for interactive elements\n4. Add transitions for smoother interactions\n\nCurrent component files: ${tsxFiles.slice(0, 10).join(', ')}\nReturn updated files with improved styling.`,
      category: 'enhance',
    });
  }

  if (!hasResponsive && tsxFiles.length > 0) {
    actions.push({
      id: 'add-responsive',
      label: 'Add mobile responsiveness',
      icon: 'Smartphone',
      prompt: `This project lacks responsive design — no responsive breakpoint classes (sm:, md:, lg:) or @media queries detected. Make it mobile-friendly:\n1. Add responsive breakpoints to layouts\n2. Stack horizontal layouts vertically on small screens\n3. Adjust font sizes and spacing for mobile\n4. Ensure navigation works on mobile (hamburger menu if needed)\n\nFiles to update: ${tsxFiles.slice(0, 10).join(', ')}\nReturn all modified files as code blocks.`,
      category: 'enhance',
    });
  }

  if (!hasTests && tsxFiles.length > 0) {
    actions.push({
      id: 'add-tests',
      label: 'Add tests',
      icon: 'TestTube',
      prompt: `This project has no test files. Add meaningful tests:\n1. Add unit tests for key utility functions\n2. Add component tests for main UI components\n3. Use vitest and @testing-library/react\n4. Cover at least the main page component and any critical business logic\n\nCurrent source files: ${tsxFiles.slice(0, 8).join(', ')}\nReturn test files with proper imports and assertions.`,
      category: 'add',
    });
  }

  if (tsxFiles.length > 5) {
    actions.push({
      id: 'optimize-performance',
      label: 'Optimize performance',
      icon: 'Gauge',
      prompt: `Review this project for performance improvements:\n1. Add React.memo to components that receive stable props\n2. Use useMemo/useCallback where appropriate\n3. Add lazy loading for routes if using a router\n4. Optimize any large lists with virtualization if needed\n5. Check for unnecessary re-renders\n\nComponent files: ${tsxFiles.slice(0, 10).join(', ')}\nReturn optimized files with explanations.`,
      category: 'optimize',
    });
  }

  return actions.slice(0, 5);
}

export async function suggestQuickActions(
  fileTree: string[],
  packageJson: Record<string, any> | null,
  errorCount: number,
  cssContent: string,
  config?: OllamaToasterConfig
): Promise<QuickActionsResult> {
  const heuristic = heuristicQuickActions(fileTree, packageJson, errorCount, cssContent);

  const availability = await checkToasterAvailability(config);
  if (!availability.available) {
    return { usedOllama: false, actions: heuristic };
  }

  const tsxFiles = fileTree.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));
  const depsStr = packageJson ? Object.keys({ ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) }).join(', ') : 'unknown';

  const prompt = `You are a project analyzer. Given a project's file tree and dependencies, suggest 3-5 high-impact quick actions the developer should take next.

=== FILE TREE (${fileTree.length} files) ===
${fileTree.slice(0, 60).join('\n')}
${fileTree.length > 60 ? `... (${fileTree.length} total)` : ''}

=== DEPENDENCIES ===
${depsStr}

=== CSS CONTENT SNIPPET ===
${cssContent.slice(0, 1000)}

=== ERROR COUNT ===
${errorCount}

Output ONLY valid JSON array of objects with this exact format, nothing else:
[
  {
    "id": "unique-id",
    "label": "Short button label (3-5 words)",
    "icon": "LucideIconName",
    "prompt": "Detailed prompt the developer should send to an AI assistant. Reference specific files from the tree. Be specific about what to change.",
    "category": "fix|enhance|add|optimize"
  }
]

Rules:
- Suggest 3-5 actions only
- Prioritize fixes if errors exist
- Reference actual file paths from the tree
- Each prompt should be detailed and actionable
- Categories: "fix" for bugs/errors, "enhance" for improvements, "add" for new features, "optimize" for performance`;

  try {
    const response = await ollamaGenerate(prompt, config);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { usedOllama: true, actions: heuristic };

    const parsed = JSON.parse(jsonMatch[0]) as QuickAction[];
    if (!Array.isArray(parsed) || parsed.length === 0) return { usedOllama: true, actions: heuristic };

    const valid = parsed
      .filter((a: any) => a && typeof a.label === 'string' && typeof a.prompt === 'string')
      .map((a: any) => ({
        id: String(a.id || crypto.randomUUID()),
        label: String(a.label).slice(0, 30),
        icon: String(a.icon || 'Zap'),
        prompt: String(a.prompt),
        category: (['fix', 'enhance', 'add', 'optimize'].includes(a.category) ? a.category : 'enhance') as QuickAction['category'],
      }))
      .slice(0, 5);

    return { usedOllama: true, actions: valid.length > 0 ? valid : heuristic };
  } catch {
    return { usedOllama: true, actions: heuristic };
  }
}

export function formatAnalysisForPrompt(analysis: ToasterAnalysis): string {
  let result = `=== OLLAMA PRE-ANALYSIS ===\n`;
  result += `Priority: ${analysis.priority.toUpperCase()}\n`;
  result += `Error Summary: ${analysis.error_summary}\n`;
  if (analysis.affected_files.length > 0) {
    result += `Affected Files: ${analysis.affected_files.join(', ')}\n`;
  }
  if (analysis.missing_files.length > 0) {
    result += `Missing Files: ${analysis.missing_files.join(', ')}\n`;
  }
  result += `=== END PRE-ANALYSIS ===\n`;
  return result;
}
