import { checkOllamaAvailability } from './ollama-safety-guard';

export interface OllamaToasterConfig {
  endpoint: string;
  model: string;
}

const TOASTER_CONFIG_KEY = 'ollama-toaster-config';

const DEFAULT_TOASTER_CONFIG: OllamaToasterConfig = {
  endpoint: 'http://localhost:11434',
  model: 'auto',
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

export interface ToasterTestResult {
  model: string;
  message: string;
}

export async function toasterReadyTest(config?: OllamaToasterConfig, preResolvedModel?: string): Promise<ToasterTestResult> {
  const cfg = config || loadToasterConfig();
  const model = preResolvedModel || await resolveModel(cfg);
  const resp = await fetch(`${cfg.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: 'Respond with exactly: "Toaster is ready!" and nothing else.' }
      ],
      stream: false,
      options: { temperature: 0.0, num_predict: 32 },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status} — model "${model}" not found`);
  const data = await resp.json();
  const reply = (data.message?.content || '').trim();
  return { model, message: reply || 'Toaster is ready!' };
}

export async function resolveModel(config: OllamaToasterConfig): Promise<string> {
  const availability = await checkToasterAvailability(config);
  if (!availability.available || availability.models.length === 0) {
    return config.model === 'auto' ? 'qwen2.5-coder:1.5b' : config.model;
  }
  if (config.model !== 'auto') {
    const installed = availability.models.map(m => m.toLowerCase());
    if (installed.some(m => m.startsWith(config.model.toLowerCase().split(':')[0]))) {
      const match = availability.models.find(m =>
        m.toLowerCase().startsWith(config.model.toLowerCase().split(':')[0])
      );
      return match || config.model;
    }
  }
  const preferred = [
    'qwen2.5-coder:1.5b', 'qwen2.5-coder:3b', 'qwen2.5-coder:0.5b',
    'gemma2:2b', 'phi3:mini', 'phi3:3.8b', 'phi',
    'qwen2.5-coder:7b', 'qwen2.5-coder',
    'deepseek-coder:1.3b', 'deepseek-coder:6.7b', 'deepseek-coder',
    'codellama:7b', 'codellama',
    'qwen2.5:0.5b', 'qwen2.5:1.5b', 'qwen2.5:3b', 'qwen2.5',
    'llama3.2:1b', 'llama3.2:3b', 'llama3.1:8b', 'llama3',
    'mistral',
  ];
  for (const pref of preferred) {
    const match = availability.models.find(m => m.toLowerCase().startsWith(pref));
    if (match) return match;
  }
  for (const pref of preferred) {
    const base = pref.split(':')[0];
    const match = availability.models.find(m => m.toLowerCase().includes(base));
    if (match) return match;
  }
  return availability.models[0];
}

let _resolvedModel: string | null = null;
let _resolvedModelTs = 0;
let _resolvedModelKey = '';
const RESOLVED_MODEL_TTL = 120_000;

function configCacheKey(config: OllamaToasterConfig): string {
  return `${config.endpoint}||${config.model}`;
}

export async function getResolvedModel(config: OllamaToasterConfig): Promise<string> {
  const now = Date.now();
  const key = configCacheKey(config);
  if (_resolvedModel && now - _resolvedModelTs < RESOLVED_MODEL_TTL && _resolvedModelKey === key) return _resolvedModel;
  _resolvedModel = await resolveModel(config);
  _resolvedModelTs = now;
  _resolvedModelKey = key;
  return _resolvedModel;
}

export function clearResolvedModelCache(): void {
  _resolvedModel = null;
  _resolvedModelTs = 0;
  _resolvedModelKey = '';
}

async function ollamaGenerate(prompt: string, config?: OllamaToasterConfig): Promise<string> {
  const cfg = config || loadToasterConfig();
  const model = await getResolvedModel(cfg);
  const promptLen = prompt.length;
  const maxTokens = promptLen > 8000 ? 1024 : promptLen > 4000 ? 768 : 512;
  const resp = await fetch(`${cfg.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a code analysis assistant. Output ONLY valid JSON, no commentary.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: {
        temperature: 0.0,
        num_predict: maxTokens,
      },
      keep_alive: '5m',
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Ollama ${resp.status} (model: ${model}): ${errText}`);
  }

  const data = await resp.json();
  return data.message?.content || '';
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

  const prompt = `Analyze errors. Output ONLY valid JSON.

LOGS: ${logs.slice(0, 3000)}

FILES: ${filesSection}
${contentsSection ? `\nCONTENTS:\n${contentsSection}` : ''}

JSON: {"error_summary":"one-line","affected_files":["path"],"missing_files":["path"],"priority":"critical|high|medium|low","suggested_context_to_include":["path"]}`;

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

  const { parseCodeBlocks } = await import('./code-parser');

  const truncated = rawResponse.slice(0, 8000);

  const prompt = `Reformat this AI response so every code block has a file path comment on the first line and is wrapped in a fenced code block with the language tag.

Rules:
- Each code block must start with a comment like: // file: src/App.tsx
- Use the correct comment style for the language (// for JS/TS, # for Python/bash/env, <!-- --> for HTML)
- Wrap each block in triple backticks with the language: \`\`\`tsx ... \`\`\`
- Keep the original code exactly as-is, only add the file path comment if missing
- If you can tell what file a block belongs to from context, add the path
- Output ONLY the reformatted code blocks, no other commentary

${truncated}`;

  try {
    const cfg = config || loadToasterConfig();
    const model = await getResolvedModel(cfg);
    const resp = await fetch(`${cfg.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.0, num_predict: 4096 },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const cleaned = (data.message?.content || '').trim();
    if (!cleaned) return null;

    const ollamaBlocks = parseCodeBlocks(cleaned);
    if (ollamaBlocks.length === 0) return null;

    const files: CleanedFile[] = ollamaBlocks
      .filter(b => b.code.length > 0)
      .map(b => ({
        path: b.filePath || '',
        action: 'update' as const,
        content: b.code,
        diff: '',
        original_block: '',
      }));

    return {
      reasoning: `Toaster reformatted → ${ollamaBlocks.length} blocks, ${ollamaBlocks.filter(b => b.filePath).length} with paths`,
      files,
      unparsed_text: '',
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

  const prompt = `Suggest 3-5 quick actions for this project. Output ONLY valid JSON array.

Files(${fileTree.length}): ${fileTree.slice(0, 40).join(', ')}
Deps: ${depsStr.slice(0, 500)}
Errors: ${errorCount}

JSON: [{"id":"x","label":"3-5 words","icon":"LucideIcon","prompt":"detailed action referencing file paths","category":"fix|enhance|add|optimize"}]`;

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

export async function toasterChat(
  message: string,
  config?: OllamaToasterConfig
): Promise<{ model: string; reply: string }> {
  const cfg = config || loadToasterConfig();
  const model = await getResolvedModel(cfg);
  const resp = await fetch(`${cfg.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: message }],
      stream: false,
      options: { temperature: 0.7, num_predict: 256 },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
  const data = await resp.json();
  return { model, reply: (data.message?.content || '').trim() };
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
