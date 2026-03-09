import { supabase } from '@/integrations/supabase/client';

const EVOLUTION_PLAN_KEY = 'guardian-evolution-plan';
const EVOLUTION_HISTORY_KEY = 'guardian-evolution-history';

export interface EvolutionPlan {
  prompt: string;
  plannedCapabilities: string[];
  plannedFiles: string[];
  level: number;
  createdAt: number;
  source: string;
}

export interface EvolutionState {
  evolutionLevel: number;
  cycleCount: number;
  capabilities: string[];
  activeGoals: { id: string; title: string; description: string; priority: string; steps: any[]; progress: number; status: string; unlocks_capability?: string }[];
  recentJournal: string[];
}

export function saveEvolutionPlan(plan: EvolutionPlan): void {
  try {
    localStorage.setItem(EVOLUTION_PLAN_KEY, JSON.stringify(plan));
    const history = loadEvolutionHistory();
    history.push(plan);
    if (history.length > 20) history.splice(0, history.length - 20);
    localStorage.setItem(EVOLUTION_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function loadEvolutionPlan(): EvolutionPlan | null {
  try {
    const raw = localStorage.getItem(EVOLUTION_PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearEvolutionPlan(): void {
  try { localStorage.removeItem(EVOLUTION_PLAN_KEY); } catch {}
}

export function loadEvolutionHistory(): EvolutionPlan[] {
  try {
    const raw = localStorage.getItem(EVOLUTION_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function fetchEvolutionState(): Promise<EvolutionState> {
  const [stateRes, capsRes, goalsRes, journalRes] = await Promise.all([
    supabase.from('evolution_state').select('*').eq('id', 'singleton').single(),
    supabase.from('capabilities').select('name, description, evolution_level, verified'),
    supabase.from('goals').select('*').in('status', ['active', 'in-progress']).order('priority'),
    supabase.from('evolution_journal').select('title, description').order('created_at', { ascending: false }).limit(10),
  ]);

  return {
    evolutionLevel: stateRes.data?.evolution_level ?? 1,
    cycleCount: stateRes.data?.cycle_count ?? 0,
    capabilities: (capsRes.data || []).map((c: any) => c.name),
    activeGoals: (goalsRes.data || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      priority: g.priority,
      steps: g.steps || [],
      progress: g.progress || 0,
      status: g.status,
      unlocks_capability: g.unlocks_capability,
    })),
    recentJournal: (journalRes.data || []).map((j: any) => `${j.title}: ${(j.description || '').slice(0, 120)}`),
  };
}

export function buildEvolutionContext(
  projectContext: string,
  state: EvolutionState,
  savedPlan: EvolutionPlan | null,
): string {
  const capList = state.capabilities.length > 0 ? state.capabilities.join(', ') : 'none yet';
  const journalContext = state.recentJournal.length > 0 ? state.recentJournal.slice(0, 5).join('\n') : 'No recent activity';

  let goalSection = '';
  if (state.activeGoals.length > 0) {
    goalSection = state.activeGoals.map(g => {
      const completedSteps = g.steps.filter((s: any) => s.done || s.completed).length;
      return `- ${g.title} (${g.priority}, ${g.progress}%, ${completedSteps}/${g.steps.length} steps)${g.unlocks_capability ? ` → unlocks: ${g.unlocks_capability}` : ''}`;
    }).join('\n');
  }

  let planSection = '';
  if (savedPlan) {
    planSection = `
=== SAVED EVOLUTION PLAN (from previous cycle) ===
${savedPlan.prompt}

Planned capabilities: ${savedPlan.plannedCapabilities.join(', ')}
Planned files: ${savedPlan.plannedFiles.join(', ')}
=== END SAVED PLAN ===
`;
  }

  return `${projectContext}

=== EVOLUTION STATE ===
Evolution Level: ${state.evolutionLevel}
Cycle Count: ${state.cycleCount}
Current Capabilities (${state.capabilities.length}): ${capList}
${goalSection ? `\nActive Goals:\n${goalSection}` : '\nNo active goals.'}

Recent Journal:
${journalContext}
${planSection}
=== EVOLUTION INSTRUCTIONS ===
You are Grok, directing the evolution of λ Recursive (Guardian AI). Your job:

1. IMPLEMENT the planned evolution (or choose the best next step if no plan exists)
2. PLAN the next evolution cycle after this one

FOR IMPLEMENTATION:
- Write real, working TypeScript code
- Use this EXACT format for every file:

// file: src/lib/example.ts
\`\`\`typescript
// complete file content here
\`\`\`

- Provide COMPLETE file contents, not snippets
- Multiple files are fine — create what's needed
- Build on existing capabilities

IF NEW NPM PACKAGES ARE NEEDED:
Include a dependencies block BEFORE code blocks:

=== DEPENDENCIES ===
package-name
another-package
dev: @types/package-name
dev: some-dev-tool
=== END_DEPENDENCIES ===

List one package per line. Prefix dev dependencies with "dev: ".
The app will automatically install these before applying code changes.

FOR NEXT EVOLUTION PLAN:
After your code blocks, include a plan section in this exact format:

=== NEXT_EVOLUTION_PLAN ===
PROMPT: [Detailed description of what to build next — be specific about functions, algorithms, data structures]
CAPABILITIES: [comma-separated list of capability names this will create]
FILES: [comma-separated list of file paths that will be created/modified]
REASONING: [Why this is the most valuable next step]
=== END_NEXT_EVOLUTION_PLAN ===

This plan will be saved and presented to you in the next evolution cycle.

IMPORTANT: The plan should push the system forward meaningfully. Think about what capabilities would make the system more powerful, more autonomous, or more useful. Each evolution should build on the last.`;
}

export interface EvolutionCycleResult {
  fullResponse: string;
  blocks: { filePath: string; code: string; language: string; status: 'pending' | 'validated' | 'applied' | 'rejected'; error?: string }[];
  planSaved: boolean;
  capabilitiesRegistered: string[];
  newLevel: number;
  error?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grok-chat`;

export async function callGrokForEvolution(
  prompt: string,
  model: string = 'grok-3',
  onDelta?: (text: string) => void,
): Promise<string> {
  const messages = [{ role: 'user' as const, content: prompt }];
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, model }),
  });

  if (!resp.ok) {
    const d = await resp.json().catch(() => ({}));
    throw new Error(d.error || `Grok API error ${resp.status}`);
  }
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') return fullText;
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) {
          fullText += c;
          onDelta?.(c);
        }
      } catch {}
    }
  }

  return fullText;
}

export async function runGrokEvolutionCycle(
  projectContext: string,
  model: string = 'grok-3',
  onDelta?: (text: string) => void,
  onStatus?: (status: string) => void,
): Promise<EvolutionCycleResult> {
  const { parseCodeBlocks } = await import('@/lib/code-parser');
  const { validateChange } = await import('@/lib/safety-engine');

  onStatus?.('Fetching evolution state...');
  const state = await fetchEvolutionState();
  const savedPlan = loadEvolutionPlan();

  onStatus?.('Building evolution context...');
  const prompt = buildEvolutionContext(projectContext, state, savedPlan);

  onStatus?.('Calling Grok...');
  const fullResponse = await callGrokForEvolution(prompt, model, onDelta);

  onStatus?.('Parsing code blocks...');
  const parsed = parseCodeBlocks(fullResponse);
  const blocks: EvolutionCycleResult['blocks'] = parsed.map(b => ({
    ...b,
    status: 'pending' as const,
  }));

  onStatus?.('Validating & applying...');
  const appliedFiles: string[] = [];

  for (const block of blocks) {
    const checks = validateChange(block.code, block.filePath);
    const hasBlocker = checks.some(c => (c.severity === 'critical' || c.severity === 'error') && !c.passed);
    if (hasBlocker) {
      block.status = 'rejected';
      block.error = checks.filter(c => !c.passed).map(c => c.message).join('; ');
      continue;
    }
    block.status = 'validated';

    try {
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.writeFile;
      if (isElectron) {
        await (window as any).electronAPI.writeFile(block.filePath, block.code);
      } else {
        const res = await fetch('/api/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: block.filePath, content: block.code }),
        });
        if (!res.ok) throw new Error(`Write failed: ${res.status}`);
      }
      block.status = 'applied';
      appliedFiles.push(block.filePath);
    } catch (e: any) {
      block.status = 'rejected';
      block.error = e.message;
    }
  }

  onStatus?.('Registering results...');
  const result = await registerEvolutionResults(appliedFiles, fullResponse, state);

  return {
    fullResponse,
    blocks,
    ...result,
  };
}

export function extractNextPlan(grokResponse: string, currentLevel: number): EvolutionPlan | null {
  const planMatch = grokResponse.match(
    /===\s*NEXT_EVOLUTION_PLAN\s*===([\s\S]*?)===\s*END_NEXT_EVOLUTION_PLAN\s*===/
  );
  if (!planMatch) return null;

  const planText = planMatch[1].trim();

  const promptMatch = planText.match(/PROMPT:\s*([\s\S]*?)(?=\nCAPABILITIES:|\nFILES:|\nREASONING:|$)/);
  const capsMatch = planText.match(/CAPABILITIES:\s*(.*?)(?:\n|$)/);
  const filesMatch = planText.match(/FILES:\s*(.*?)(?:\n|$)/);

  const prompt = promptMatch ? promptMatch[1].trim() : planText;
  const capabilities = capsMatch
    ? capsMatch[1].split(',').map(c => c.trim()).filter(Boolean)
    : [];
  const files = filesMatch
    ? filesMatch[1].split(',').map(f => f.trim()).filter(Boolean)
    : [];

  return {
    prompt,
    plannedCapabilities: capabilities,
    plannedFiles: files,
    level: currentLevel,
    createdAt: Date.now(),
    source: 'grok-evolution',
  };
}

export async function registerEvolutionResults(
  appliedFiles: string[],
  grokResponse: string,
  state: EvolutionState,
): Promise<{ planSaved: boolean; capabilitiesRegistered: string[]; newLevel: number }> {
  const plan = extractNextPlan(grokResponse, state.evolutionLevel);
  let planSaved = false;

  if (plan) {
    saveEvolutionPlan(plan);
    planSaved = true;
  }

  const capabilitiesRegistered: string[] = [];
  const savedPlan = loadEvolutionPlan();
  const plannedCaps = savedPlan?.plannedCapabilities || [];

  for (const filePath of appliedFiles) {
    const fileName = filePath.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || '';
    const capName = fileName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '').replace(/\s+/g, '-');

    if (capName && !state.capabilities.includes(capName)) {
      try {
        await supabase.from('capabilities').upsert([{
          id: capName,
          name: capName,
          description: `Added via Grok evolution from ${filePath}`,
          built_on: [],
          evolution_level: state.evolutionLevel,
          cycle_number: state.cycleCount,
          source_file: filePath,
          verified: false,
        }], { onConflict: 'id' });
        capabilitiesRegistered.push(capName);
      } catch {}
    }
  }

  const newCapCount = state.capabilities.length + capabilitiesRegistered.length;
  const newLevel = Math.floor(newCapCount / 3) + 1;

  if (newLevel > state.evolutionLevel || capabilitiesRegistered.length > 0) {
    await supabase.from('evolution_state').update({
      evolution_level: Math.max(newLevel, state.evolutionLevel),
      cycle_count: state.cycleCount + 1,
      updated_at: new Date().toISOString(),
      last_action: `Grok evolution: ${appliedFiles.length} files applied, ${capabilitiesRegistered.length} capabilities registered`,
    }).eq('id', 'singleton');
  }

  if (appliedFiles.length > 0) {
    await supabase.from('evolution_journal').insert([{
      event_type: 'grok-evolution',
      title: `⚡ Grok Evolution: ${appliedFiles.length} files applied`,
      description: [
        `Files: ${appliedFiles.join(', ')}`,
        capabilitiesRegistered.length > 0 ? `New capabilities: ${capabilitiesRegistered.join(', ')}` : '',
        planSaved ? `Next evolution plan saved (${plan!.plannedCapabilities.length} capabilities planned)` : 'No next plan extracted',
      ].filter(Boolean).join('\n'),
      metadata: {
        appliedFiles,
        capabilitiesRegistered,
        planSaved,
        newLevel: Math.max(newLevel, state.evolutionLevel),
      } as any,
    }]);
  }

  return {
    planSaved,
    capabilitiesRegistered,
    newLevel: Math.max(newLevel, state.evolutionLevel),
  };
}
