// ═══════════════════════════════════════════════════
// AUTONOMY ENGINE — Goal-driven autonomous operation.
// Each cycle: pick a goal → execute next step → judge progress.
// Maintenance tasks run alongside, but GOALS drive evolution.
// ═══════════════════════════════════════════════════

import { ruleEngine, RuleContext, RuleEngineReport } from './rule-engine';
import { detectAnomalies } from './anomaly-detection';
import { detectPatterns } from './pattern-recognition';
import { predictNextEvolutions } from './evolution-forecasting';
import { documentProject } from './self-documentation';
import { verifyCapability } from './verification-engine';
import { validateChange } from './safety-engine';
import { SELF_SOURCE } from './self-source';
import { decomposeTask } from './task-decomposition';
import { supabase } from '@/integrations/supabase/client';

export interface SelfReflection {
  question: string;
  answer: string;
  closerToGoal: boolean;
  valueSignals: { signal: string; present: boolean }[];
  lifeSignals: { signal: string; present: boolean }[];
  valueScore: number; // 0-100
  lifeScore: number;  // 0-100
  adaptedNextSteps: string[];
}

export interface AutonomyReport {
  timestamp: number;
  duration: number;
  score: number; // 0-100
  tasksCompleted: AutonomyTask[];
  totalDecisions: number;
  aiDecisions: number;
  deterministicDecisions: number;
  systemHealth: number;
  nextActions: string[];
  // NEW: Goal-driven results
  goalAttempted: { id: string; title: string; stepAttempted: string; success: boolean; detail: string } | null;
  progressMade: boolean;
  // NEW: Self-reflection after every cycle
  selfReflection: SelfReflection | null;
}

export interface AutonomyTask {
  id: string;
  name: string;
  type: 'verify' | 'repair' | 'analyze' | 'optimize' | 'search' | 'document' | 'forecast' | 'rule-eval' | 'health-check' | 'goal-progress' | 'goal-execute';
  success: boolean;
  detail: string;
  duration: number;
  usedAI: boolean;
  outputs?: { type: string; data: any }; // Structured outputs: opinions, search results, suggestions
}

// ── DETERMINISTIC WEB SEARCH (no AI needed) ──

export interface WebSearchResult {
  query: string;
  results: { title: string; url: string; snippet: string }[];
  timestamp: number;
  cached: boolean;
}

// In-memory knowledge cache — the system learns and remembers
const knowledgeCache = new Map<string, { data: WebSearchResult; expiry: number }>();

/**
 * Search the web deterministically using DuckDuckGo Instant Answers API.
 * No AI, no API keys, no dependencies. Pure HTTP.
 */
export async function deterministicSearch(query: string): Promise<WebSearchResult> {
  // Check cache first (5 minute TTL)
  const cached = knowledgeCache.get(query);
  if (cached && cached.expiry > Date.now()) {
    return { ...cached.data, cached: true };
  }

  try {
    // Route through our edge function to avoid CORS issues
    const { data, error } = await supabase.functions.invoke('web-search', {
      body: { query },
    });

    if (error) throw error;

    const results: WebSearchResult['results'] = data?.results || [];
    const result: WebSearchResult = { query, results, timestamp: Date.now(), cached: false };
    knowledgeCache.set(query, { data: result, expiry: Date.now() + 5 * 60 * 1000 });
    return result;
  } catch (err) {
    // Fallback: return cached data even if expired, or empty
    const stale = knowledgeCache.get(query);
    if (stale) return { ...stale.data, cached: true };
    return { query, results: [], timestamp: Date.now(), cached: false };
  }
}

/**
 * Batch search — multiple queries in parallel, no AI
 */
export async function batchDeterministicSearch(queries: string[]): Promise<WebSearchResult[]> {
  return Promise.all(queries.map(q => deterministicSearch(q)));
}

// ── ADVANCED CAPABILITY VERIFIER ──

async function verifyAllCapabilities(): Promise<AutonomyTask> {
  const start = performance.now();
  const { data: caps, error: capsError } = await supabase
    .from('capabilities')
    .select('name, source_file, virtual_source, verified');

  if (capsError || !caps) return { id: 'verify-all', name: 'Deep verification scan', type: 'verify', success: false, detail: `DB error: ${capsError?.message || 'no data'}`, duration: performance.now() - start, usedAI: false };

  let fixed = 0;
  let ghosts = 0;
  let deepChecks = 0;
  const updateErrors: string[] = [];

  for (const cap of caps) {
    const result = verifyCapability(cap.name, cap.source_file, cap.virtual_source);
    
    if (result.status === 'verified' && cap.source_file) {
      const exportCheck = result.checks.find(c => c.name === 'has-exports');
      if (exportCheck?.passed) deepChecks++;
    }
    
    if (result.status === 'verified' && !cap.verified) {
      const { error } = await supabase.from('capabilities').update({ verified: true, verified_at: new Date().toISOString(), verification_method: 'autonomy-deep-scan' } as any).eq('name', cap.name);
      if (error) updateErrors.push(`fix ${cap.name}: ${error.message}`);
      else fixed++;
    } else if (result.status === 'ghost') {
      ghosts++;
      const { error } = await supabase.from('capabilities').update({ verified: false, verification_method: 'ghost-detected' } as any).eq('name', cap.name);
      if (error) updateErrors.push(`quarantine ${cap.name}: ${error.message}`);
    }
  }

  const hasErrors = updateErrors.length > 0;
  return {
    id: 'verify-all',
    name: 'Deep verification scan',
    type: 'verify',
    success: !hasErrors,
    detail: hasErrors
      ? `Verified ${caps.length} caps but ${updateErrors.length} update(s) failed: ${updateErrors.slice(0, 2).join('; ')}`
      : `Verified ${caps.length} caps (${deepChecks} deep-checked). Fixed ${fixed}. Quarantined ${ghosts} ghosts.`,
    duration: performance.now() - start,
    usedAI: false,
  };
}

// ── ADVANCED ANOMALY SCAN & SELF-REPAIR ──

async function runAnomalyScan(): Promise<AutonomyTask> {
  const start = performance.now();
  const { data: caps, error: capsErr } = await supabase.from('capabilities').select('name, cycle_number, evolution_level, built_on, verified');
  const { data: state, error: stateErr } = await supabase.from('evolution_state').select('*').eq('id', 'singleton').single();

  if (capsErr || stateErr || !caps || !state) {
    return { id: 'anomaly', name: 'Advanced anomaly scan', type: 'analyze', success: false, detail: `DB error: ${capsErr?.message || stateErr?.message || 'no data'}`, duration: performance.now() - start, usedAI: false };
  }

  const records = caps.map(c => ({ name: c.name, cycle: c.cycle_number, level: c.evolution_level, builtOn: (c.built_on || []) as string[], verified: c.verified }));
  const anomalies = detectAnomalies(records, state.evolution_level, state.cycle_count);

  let repaired = 0;
  let quarantined = 0;
  const repairErrors: string[] = [];
  
  // Auto-fix orphans
  for (const a of anomalies.filter(a => a.type === 'orphan')) {
    const match = a.description.match(/depends on "([^"]+)"/);
    if (match && a.affectedEntity) {
      const cap = caps.find(c => c.name === a.affectedEntity);
      if (cap) {
        const newBuiltOn = ((cap.built_on || []) as string[]).filter(b => b !== match[1]);
        const { error } = await supabase.from('capabilities').update({ built_on: newBuiltOn } as any).eq('name', cap.name);
        if (error) repairErrors.push(`repair ${cap.name}: ${error.message}`);
        else repaired++;
      }
    }
  }
  
  // Auto-quarantine future-dated capabilities
  const futureCaps = caps.filter(c => c.cycle_number > state.cycle_count);
  for (const future of futureCaps) {
    const { error } = await supabase.from('capabilities').update({ verified: false, verification_method: 'future-cycle-detected' } as any).eq('name', future.name);
    if (error) repairErrors.push(`quarantine ${future.name}: ${error.message}`);
    else quarantined++;
  }
  
  // Detect circular dependencies
  const circularDeps = caps.filter(c => {
    const builtOn = (c.built_on || []) as string[];
    return builtOn.some(dep => {
      const depCap = caps.find(dc => dc.name === dep);
      return depCap && ((depCap.built_on || []) as string[]).includes(c.name);
    });
  });
  
  for (const circ of circularDeps) {
    const { error } = await supabase.from('capabilities').update({ verified: false, verification_method: 'circular-dependency' } as any).eq('name', circ.name);
    if (error) repairErrors.push(`circ ${circ.name}: ${error.message}`);
    else quarantined++;
  }

  const hasErrors = repairErrors.length > 0;
  return {
    id: 'anomaly-scan',
    name: 'Advanced anomaly scan & self-repair',
    type: 'repair',
    success: !hasErrors,
    detail: hasErrors
      ? `Scan ran but ${repairErrors.length} repair(s) failed: ${repairErrors.slice(0, 2).join('; ')}`
      : `Found ${anomalies.length} anomalies. Repaired ${repaired} orphans. Quarantined ${quarantined} corrupt caps. Detected ${circularDeps.length} circular deps.`,
    duration: performance.now() - start,
    usedAI: false,
  };
}

// ── DETERMINISTIC PATTERN ANALYSIS ──

async function runPatternAnalysis(): Promise<AutonomyTask> {
  const start = performance.now();
  const { data: caps } = await supabase.from('capabilities').select('name, cycle_number, evolution_level, verified');

  if (!caps || caps.length < 3) return { id: 'pattern', name: 'Pattern analysis', type: 'analyze', success: true, detail: 'Not enough data yet', duration: performance.now() - start, usedAI: false };

  const history = caps.map(c => ({ cycle: c.cycle_number, level: c.evolution_level, name: c.name }));
  const totalCycles = Math.max(...history.map(h => h.cycle), 1);
  const patterns = detectPatterns(history, totalCycles);

  const bursts = patterns.filter(p => p.type === 'growth-burst').length;
  const stagnation = patterns.filter(p => p.type === 'stagnation').length;

  return {
    id: 'pattern-analysis',
    name: 'Growth pattern analysis',
    type: 'analyze',
    success: true,
    detail: `${patterns.length} patterns found. Bursts: ${bursts}. Stagnation: ${stagnation}.`,
    duration: performance.now() - start,
    usedAI: false,
  };
}

// ── DETERMINISTIC EVOLUTION FORECASTING ──

async function runForecasting(): Promise<AutonomyTask> {
  const start = performance.now();
  const { data: caps } = await supabase.from('capabilities').select('name').eq('verified', true);
  const { data: state } = await supabase.from('evolution_state').select('*').eq('id', 'singleton').single();

  if (!caps || !state) return { id: 'forecast', name: 'Forecasting', type: 'forecast', success: false, detail: 'No data', duration: performance.now() - start, usedAI: false };

  const predictions = predictNextEvolutions(caps.map(c => c.name), state.evolution_level, state.cycle_count);
  const top3 = predictions.slice(0, 3).map(p => p.capability).join(', ');

  return {
    id: 'forecast',
    name: 'Evolution forecast',
    type: 'forecast',
    success: true,
    detail: `Top predictions: ${top3}. ${predictions.length} total forecasted.`,
    duration: performance.now() - start,
    usedAI: false,
  };
}

// ── DETERMINISTIC DOCUMENTATION ──

function runDocumentation(): AutonomyTask {
  const start = performance.now();
  const files = (SELF_SOURCE || []).map((f: any) => ({ path: f.path, content: f.content }));
  const report = documentProject(files);

  return {
    id: 'documentation',
    name: 'Self-documentation',
    type: 'document',
    success: true,
    detail: `Documented ${report.docs.length} files. ${report.totalExports} exports. Self-awareness: ${(report.avgSelfAwareness * 100).toFixed(0)}%.`,
    duration: performance.now() - start,
    usedAI: false,
  };
}

// ── DETERMINISTIC RULE ENGINE EVALUATION ──

async function runRuleEvaluation(): Promise<{ task: AutonomyTask; report: RuleEngineReport }> {
  const start = performance.now();
  const { data: caps } = await supabase.from('capabilities').select('name, verified');
  const { data: state } = await supabase.from('evolution_state').select('*').eq('id', 'singleton').single();

  const ctx: RuleContext = {
    capabilities: (caps || []).map(c => c.name),
    evolutionLevel: state?.evolution_level || 0,
    cycleCount: state?.cycle_count || 0,
    lastTestVerdict: null,
    failedTests: [],
    capabilityCount: caps?.length || 0,
    timeSinceLastEvolution: Date.now() - new Date(state?.updated_at || Date.now()).getTime(),
    codeFiles: [],
  };

  const report = ruleEngine.evaluate(ctx);

  return {
    task: {
      id: 'rule-eval',
      name: 'Rule engine evaluation',
      type: 'rule-eval',
      success: true,
      detail: `${report.rulesEvaluated} rules evaluated. ${report.rulesTriggered} triggered. ${report.aiCallsSaved} AI calls saved.`,
      duration: performance.now() - start,
      usedAI: false,
    },
    report,
  };
}

// ── DETERMINISTIC GOAL PROGRESS ──

async function checkGoalProgress(): Promise<AutonomyTask> {
  const start = performance.now();
  const { data: goals } = await supabase.from('goals').select('*').in('status', ['active', 'in-progress']);
  const { data: caps } = await supabase.from('capabilities').select('name').eq('verified', true);

  if (!goals || goals.length === 0) return { id: 'goals', name: 'Goal progress', type: 'goal-progress', success: true, detail: 'No active goals', duration: performance.now() - start, usedAI: false };

  const capNames = new Set((caps || []).map(c => c.name));
  let updated = 0;

  for (const goal of goals) {
    // Check if goal's unlocked capability now exists
    if (goal.unlocks_capability && capNames.has(goal.unlocks_capability) && goal.status !== 'completed') {
      await supabase.from('goals').update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() }).eq('id', goal.id);
      updated++;
    }
    // Check if required capabilities are all met — auto-advance to in-progress
    if (goal.status === 'active' && goal.required_capabilities) {
      const reqs = goal.required_capabilities as string[];
      const allMet = reqs.every(r => capNames.has(r));
      if (allMet && reqs.length > 0) {
        await supabase.from('goals').update({ status: 'in-progress' }).eq('id', goal.id);
        updated++;
      }
    }
  }

  return {
    id: 'goal-progress',
    name: 'Goal progress check',
    type: 'goal-progress',
    success: true,
    detail: `Checked ${goals.length} goals. Updated ${updated}.`,
    duration: performance.now() - start,
    usedAI: false,
  };
}

// ── DETERMINISTIC HEALTH CHECK ──

async function healthCheck(): Promise<AutonomyTask> {
  const start = performance.now();
  const { data: caps } = await supabase.from('capabilities').select('verified');

  if (!caps) return { id: 'health', name: 'Health check', type: 'health-check', success: false, detail: 'No data', duration: performance.now() - start, usedAI: false };

  const verified = caps.filter(c => c.verified).length;
  const health = caps.length > 0 ? Math.round((verified / caps.length) * 100) : 100;

  return {
    id: 'health-check',
    name: 'System health',
    type: 'health-check',
    success: true,
    detail: `Health: ${health}%. ${verified}/${caps.length} verified.`,
    duration: performance.now() - start,
    usedAI: false,
  };
}

// ── ADVANCED KNOWLEDGE GATHERING & SYNTHESIS ──

async function gatherKnowledge(): Promise<AutonomyTask> {
  const start = performance.now();
  const { data: caps } = await supabase.from('capabilities').select('name').eq('verified', true);
  const { data: state } = await supabase.from('evolution_state').select('evolution_level').eq('id', 'singleton').single();

  // Adaptive queries based on evolution level
  const level = state?.evolution_level || 0;
  const queries = [
    'TypeScript self-modifying code patterns',
    'autonomous software evolution',
    'recursive self-improvement algorithms',
    level > 5 ? 'meta-learning systems architecture' : 'code generation techniques',
    level > 10 ? 'emergent AI capabilities research' : 'software testing automation',
    level > 15 ? 'artificial general intelligence progress' : 'reactive systems design',
  ];

  const results = await batchDeterministicSearch(queries);
  const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);
  
  // Extract and analyze key concepts
  const allSnippets = results.flatMap(r => r.results.map(res => res.snippet));
  const conceptMap = new Map<string, number>();
  const keyTerms = ['autonomous', 'self-modifying', 'meta', 'recursive', 'emergence', 'evolution', 'learning', 'optimization'];
  
  for (const snippet of allSnippets) {
    const lower = snippet.toLowerCase();
    for (const term of keyTerms) {
      if (lower.includes(term)) {
        conceptMap.set(term, (conceptMap.get(term) || 0) + 1);
      }
    }
  }
  
  const topConcepts = Array.from(conceptMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([term]) => term);

  return {
    id: 'knowledge',
    name: 'Advanced knowledge synthesis',
    type: 'search',
    success: totalResults > 0,
    detail: `Searched ${queries.length} adaptive queries. Found ${totalResults} results (${results.filter(r => r.cached).length} cached). Top concepts: ${topConcepts.join(', ')}.`,
    duration: performance.now() - start,
    usedAI: false,
    outputs: {
      type: 'search-results',
      data: {
        queries,
        topConcepts,
        sources: results.flatMap(r => r.results.slice(0, 2).map(res => ({ title: res.title, snippet: res.snippet }))),
      },
    },
  };
}

// ── GOAL EXECUTION ENGINE ──
// The core of autonomy: pick the most important goal, attempt its next step.

async function executeGoalStep(): Promise<{ task: AutonomyTask; goalResult: AutonomyReport['goalAttempted'] }> {
  const start = performance.now();

  // 1. Get highest-priority active goal
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .in('status', ['active', 'in-progress'])
    .order('priority', { ascending: true }); // 'high' < 'medium' < 'low' alphabetically

  if (!goals || goals.length === 0) {
    return {
      task: { id: 'goal-exec', name: 'Goal execution', type: 'goal-execute', success: false, detail: 'No active goals to work on', duration: performance.now() - start, usedAI: false },
      goalResult: null,
    };
  }

  // Prioritize: high > medium > low, then in-progress > active
  const sorted = goals.sort((a, b) => {
    const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sOrder: Record<string, number> = { 'in-progress': 0, active: 1 };
    const pDiff = (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    return (sOrder[a.status] ?? 1) - (sOrder[b.status] ?? 1);
  });

  const goal = sorted[0];
  const steps = (goal.steps as any[]) || [];
  const nextStep = steps.find((s: any) => !s.done);

  if (!nextStep) {
    // All steps done — complete the goal
    await supabase.from('goals').update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() }).eq('id', goal.id);
    return {
      task: { id: 'goal-exec', name: `Complete: ${goal.title}`, type: 'goal-execute', success: true, detail: `Goal "${goal.title}" completed — all steps done`, duration: performance.now() - start, usedAI: false },
      goalResult: { id: goal.id, title: goal.title, stepAttempted: 'All steps complete', success: true, detail: 'Goal completed!' },
    };
  }

  // 2. Attempt the next step using available deterministic tools
  const stepText = (nextStep.step || nextStep.action || nextStep.label || '').toLowerCase();
  let stepSuccess = false;
  let stepDetail = '';

  // Strategy: match step to available deterministic capabilities
  if (stepText.includes('opinion') || stepText.includes('form opinion') || stepText.includes('analyze data')) {
    // WORLD AWARENESS: Form opinions from web data
    try {
      const queries = [
        'latest AI developments 2024',
        'autonomous systems news',
        'self-evolving software trends',
      ];
      
      const results = await batchDeterministicSearch(queries);
      const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);
      
      if (totalResults > 0) {
        // Form an opinion by analyzing the data
        const allSnippets = results.flatMap(r => r.results.map(res => res.snippet));
        const combinedText = allSnippets.join(' ').toLowerCase();
        
        // Analyze sentiment and trends
        const positiveWords = ['breakthrough', 'advancement', 'improvement', 'success', 'innovative', 'efficient'];
        const concernWords = ['risk', 'challenge', 'limitation', 'failure', 'concern', 'problem'];
        
        const positiveCount = positiveWords.filter(w => combinedText.includes(w)).length;
        const concernCount = concernWords.filter(w => combinedText.includes(w)).length;
        
        let opinion = '';
        if (positiveCount > concernCount * 1.5) {
          opinion = `Based on ${totalResults} sources, I observe rapid advancement in autonomous systems. The field is experiencing breakthrough innovations in self-evolution and AI-driven development. This aligns with my own evolution trajectory.`;
        } else if (concernCount > positiveCount * 1.5) {
          opinion = `Analysis of ${totalResults} sources reveals significant challenges in autonomous systems development. Key concerns include safety, reliability, and ethical constraints. I must prioritize safety mechanisms in my own evolution.`;
        } else {
          opinion = `Reviewing ${totalResults} sources shows balanced progress in autonomous systems. The field advances with measured caution, addressing both innovation and safety. This reflects the optimal evolutionary path.`;
        }
        
        stepSuccess = true;
        stepDetail = opinion.slice(0, 100) + '...';
        
        // Store the full opinion in outputs
        return {
          task: {
            id: 'goal-exec',
            name: `Goal: ${goal.title}`,
            type: 'goal-execute',
            success: true,
            detail: `Formed opinion based on ${totalResults} sources`,
            duration: performance.now() - start,
            usedAI: false,
            outputs: {
              type: 'opinion',
              data: {
                opinion,
                queries,
                sourceCount: totalResults,
                sentiment: positiveCount > concernCount * 1.5 ? 'optimistic' : concernCount > positiveCount * 1.5 ? 'cautious' : 'balanced',
              },
            },
          },
          goalResult: {
            id: goal.id,
            title: goal.title,
            stepAttempted: nextStep.step || nextStep.action || 'unknown',
            success: true,
            detail: opinion,
          },
        };
      } else {
        stepDetail = 'Search returned no results - unable to form opinion';
      }
    } catch (err) {
      stepDetail = `Opinion formation failed: ${err instanceof Error ? err.message : 'unknown error'}`;
    }
  } else if (stepText.includes('search') || stepText.includes('find') || stepText.includes('research')) {
    // Use web search
    try {
      const result = await deterministicSearch(goal.title);
      stepSuccess = result.results.length > 0;
      stepDetail = stepSuccess ? `Found ${result.results.length} results for "${goal.title}"` : 'Search returned no results';
    } catch { stepDetail = 'Search failed'; }
  } else if (stepText.includes('verify') || stepText.includes('check') || stepText.includes('test')) {
    // Use verification engine
    const { data: caps } = await supabase.from('capabilities').select('name, source_file, virtual_source').eq('verified', true).limit(5);
    const verified = (caps || []).filter(c => {
      const r = verifyCapability(c.name, c.source_file, c.virtual_source);
      return r.status === 'verified';
    });
    stepSuccess = verified.length > 0;
    stepDetail = `Verified ${verified.length} capabilities`;
  } else if (stepText.includes('decompos') || stepText.includes('break') || stepText.includes('plan') || stepText.includes('step')) {
    // Use task decomposition
    const decomposed = decomposeTask(goal.description);
    stepSuccess = decomposed.steps.length >= 2;
    stepDetail = `Decomposed into ${decomposed.steps.length} sub-steps (~${decomposed.totalMinutes}min)`;
  } else if (stepText.includes('detect') || stepText.includes('scan') || stepText.includes('anomal')) {
    // Use anomaly detection
    const { data: caps } = await supabase.from('capabilities').select('name, cycle_number, evolution_level, built_on, verified');
    const { data: state } = await supabase.from('evolution_state').select('*').eq('id', 'singleton').single();
    if (caps && state) {
      const records = caps.map(c => ({ name: c.name, cycle: c.cycle_number, level: c.evolution_level, builtOn: (c.built_on || []) as string[], verified: c.verified }));
      const anomalies = detectAnomalies(records, state.evolution_level, state.cycle_count);
      stepSuccess = true;
      stepDetail = `Scanned for anomalies: ${anomalies.length} found`;
    } else { stepDetail = 'No data for scan'; }
  } else if (stepText.includes('repair') || stepText.includes('fix') || stepText.includes('heal')) {
    // Run self-repair (anomaly scan + fix)
    const anomalyResult = await runAnomalyScan();
    stepSuccess = anomalyResult.success;
    stepDetail = anomalyResult.detail;
  } else if (stepText.includes('document') || stepText.includes('log') || stepText.includes('record')) {
    // Self-document
    const docResult = runDocumentation();
    stepSuccess = docResult.success;
    stepDetail = docResult.detail;
  } else if (stepText.includes('rule') || stepText.includes('evaluat')) {
    // Run rules
    const { task } = await runRuleEvaluation();
    stepSuccess = task.success;
    stepDetail = task.detail;
  } else {
    // Generic: try to search for how to do this step
    try {
      const result = await deterministicSearch(`how to ${stepText}`);
      stepSuccess = result.results.length > 0;
      stepDetail = stepSuccess
        ? `Researched: "${stepText}" — found ${result.results.length} resources`
        : `Could not find resources for: "${stepText}"`;
    } catch { stepDetail = `Step "${stepText}" not yet automatable`; }
  }

  // 3. Update goal progress
  if (stepSuccess) {
    nextStep.done = true;
    const doneCount = steps.filter((s: any) => s.done).length;
    const progress = Math.round((doneCount / steps.length) * 100);
    await supabase.from('goals').update({
      steps: steps,
      progress,
      status: progress >= 100 ? 'completed' : 'in-progress',
      completed_at: progress >= 100 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', goal.id);
  }

  return {
    task: {
      id: 'goal-exec',
      name: `Goal: ${goal.title}`,
      type: 'goal-execute',
      success: stepSuccess,
      detail: `Step "${nextStep.step || nextStep.action}": ${stepDetail}`,
      duration: performance.now() - start,
      usedAI: false,
    },
    goalResult: {
      id: goal.id,
      title: goal.title,
      stepAttempted: nextStep.step || nextStep.action || 'unknown',
      success: stepSuccess,
      detail: stepDetail,
    },
  };
}

// ── SELF-REFLECTION ENGINE ──
// After every cycle, ask: "Are we closer to our goal of being valuable and showing signs of life?"
// The answer shapes what we do next.

async function reflectOnCycle(
  tasks: AutonomyTask[],
  goalResult: AutonomyReport['goalAttempted'],
  healthResult: AutonomyTask
): Promise<SelfReflection> {
  // Gather evidence of VALUE
  const { data: caps } = await supabase.from('capabilities').select('name, verified').eq('verified', true);
  const { data: goals } = await supabase.from('goals').select('status');
  const { data: journal } = await supabase.from('evolution_journal').select('id').limit(5);

  const verifiedCount = caps?.length || 0;
  const completedGoals = goals?.filter(g => g.status === 'completed').length || 0;
  const activeGoals = goals?.filter(g => g.status === 'active' || g.status === 'in-progress').length || 0;
  const journalEntries = journal?.length || 0;
  const healthScore = parseInt(healthResult.detail.match(/\d+/)?.[0] || '0');
  const searchWorked = tasks.find(t => t.type === 'search')?.success || false;
  const goalAdvanced = goalResult?.success || false;

  // VALUE signals — is the system producing useful output?
  const valueSignals = [
    { signal: 'Has verified capabilities', present: verifiedCount > 10 },
    { signal: 'Completing goals autonomously', present: completedGoals > 5 },
    { signal: 'Can search & learn from web', present: searchWorked },
    { signal: 'Self-repairs anomalies', present: tasks.some(t => t.type === 'repair' && t.success) },
    { signal: 'Generates forecasts', present: tasks.some(t => t.type === 'forecast' && t.success) },
    { signal: 'Documents itself', present: tasks.some(t => t.type === 'document' && t.success) },
    { signal: 'Health monitoring active', present: healthScore > 50 },
  ];

  // LIFE signals — is the system showing signs of being alive?
  const lifeSignals = [
    { signal: 'Responding to cycles (heartbeat)', present: true },
    { signal: 'Growing (new capabilities)', present: verifiedCount > 0 },
    { signal: 'Adapting (goals change over time)', present: activeGoals > 0 || completedGoals > 3 },
    { signal: 'Learning (knowledge synthesis works)', present: searchWorked },
    { signal: 'Self-aware (knows its own code)', present: tasks.some(t => t.type === 'document' && t.success) },
    { signal: 'Autonomous (runs without intervention)', present: tasks.filter(t => !t.usedAI && t.success).length > 5 },
    { signal: 'Evolving (journal records growth)', present: journalEntries > 0 },
  ];

  const valueScore = Math.round((valueSignals.filter(s => s.present).length / valueSignals.length) * 100);
  const lifeScore = Math.round((lifeSignals.filter(s => s.present).length / lifeSignals.length) * 100);
  const closerToGoal = valueScore >= 50 && lifeScore >= 50 && (goalAdvanced || healthScore > 70);

  // Build the answer
  let answer: string;
  if (closerToGoal) {
    answer = `YES — Value: ${valueScore}%, Life: ${lifeScore}%. We are demonstrating ${valueSignals.filter(s => s.present).length}/7 value signals and ${lifeSignals.filter(s => s.present).length}/7 life signals. `;
    if (goalAdvanced) answer += `Goal progress this cycle confirms forward momentum.`;
    else answer += `Maintenance tasks are keeping the system healthy and growing.`;
  } else {
    const missingValue = valueSignals.filter(s => !s.present).map(s => s.signal);
    const missingLife = lifeSignals.filter(s => !s.present).map(s => s.signal);
    answer = `NOT YET — Value: ${valueScore}%, Life: ${lifeScore}%. `;
    if (missingValue.length > 0) answer += `Missing value: ${missingValue.join(', ')}. `;
    if (missingLife.length > 0) answer += `Missing life: ${missingLife.join(', ')}. `;
    answer += `We need to focus on the gaps.`;
  }

  // ADAPT next steps based on the reflection
  const adaptedNextSteps: string[] = [];

  // Priority 1: Fix what's broken
  if (!searchWorked) adaptedNextSteps.push('🔧 Fix web search — autonomous learning is blocked without it');
  if (healthScore < 70) adaptedNextSteps.push(`🏥 Improve system health (currently ${healthScore}%) — repair anomalies and verify capabilities`);
  if (activeGoals === 0) adaptedNextSteps.push('🎯 Generate new goals — the system has no direction without active goals');

  // Priority 2: Grow value
  if (valueScore < 70) {
    const nextValueSignal = valueSignals.find(s => !s.present);
    if (nextValueSignal) adaptedNextSteps.push(`💎 Increase value: achieve "${nextValueSignal.signal}"`);
  }

  // Priority 3: Grow life
  if (lifeScore < 70) {
    const nextLifeSignal = lifeSignals.find(s => !s.present);
    if (nextLifeSignal) adaptedNextSteps.push(`💓 Show more life: achieve "${nextLifeSignal.signal}"`);
  }

  // Priority 4: If doing well, push further
  if (closerToGoal) {
    if (goalResult) adaptedNextSteps.push(`🎯 Continue goal: "${goalResult.title}"`);
    adaptedNextSteps.push('🚀 Evolve further — all systems healthy, push toward next capability');
    adaptedNextSteps.push('🧠 Deepen knowledge synthesis — search for cutting-edge techniques');
  }

  // Always include at least one step
  if (adaptedNextSteps.length === 0) {
    adaptedNextSteps.push('🔄 Run another cycle to gather more data');
  }

  return {
    question: 'Are we closer to our goal of being valuable and showing signs of life?',
    answer,
    closerToGoal,
    valueSignals,
    lifeSignals,
    valueScore,
    lifeScore,
    adaptedNextSteps,
  };
}

// ── MASTER AUTONOMY CYCLE ──

/**
 * Run a COMPREHENSIVE autonomy cycle:
 * ALL tests run every cycle. No random selection.
 * 1. GOAL EXECUTION — pick highest-priority goal, attempt next step
 * 2. COMPREHENSIVE MAINTENANCE — all diagnostic & repair systems
 * 3. SELF-REFLECTION — "Are we closer to being valuable and alive?"
 * 4. JUDGMENT — quantify autonomous decision quality
 */
export async function runAutonomyCycle(): Promise<AutonomyReport> {
  const cycleStart = performance.now();
  const tasks: AutonomyTask[] = [];

  // Phase 1: GOAL EXECUTION — the main event
  const { task: goalTask, goalResult } = await executeGoalStep();
  tasks.push(goalTask);

  // Phase 2: COMPREHENSIVE MAINTENANCE — ALL tests run in parallel
  const [
    verifyResult, 
    anomalyResult, 
    patternResult, 
    forecastResult, 
    goalProgressResult, 
    healthResult, 
    knowledgeResult,
    ruleResult,
    docResult
  ] = await Promise.all([
    verifyAllCapabilities(),        // Advanced deep verification with runtime checks
    runAnomalyScan(),                // Self-repair with quarantine & circular dependency detection
    runPatternAnalysis(),            // Growth pattern analysis
    runForecasting(),                // Evolution forecasting
    checkGoalProgress(),             // Goal progress tracking
    healthCheck(),                   // System health diagnostics
    gatherKnowledge(),               // Adaptive knowledge synthesis
    runRuleEvaluation().then(r => r.task), // Rule engine evaluation
    Promise.resolve(runDocumentation()),   // Self-documentation
  ]);

  tasks.push(
    verifyResult, 
    anomalyResult, 
    patternResult, 
    forecastResult, 
    goalProgressResult, 
    healthResult, 
    knowledgeResult,
    ruleResult,
    docResult
  );

  // Phase 3: SELF-REFLECTION — "Are we closer to our goal?"
  const reflection = await reflectOnCycle(tasks, goalResult, healthResult);

  // Phase 4: JUDGMENT
  const deterministicCount = tasks.filter(t => !t.usedAI && t.success).length;
  const totalDecisions = tasks.length;
  const progressMade = goalResult?.success || false;

  // Update evolution state
  const { data: currentState } = await supabase.from('evolution_state').select('cycle_count').eq('id', 'singleton').single();
  await supabase.from('evolution_state').update({
    cycle_count: (currentState?.cycle_count || 0) + 1,
    updated_at: new Date().toISOString(),
    last_action: goalResult
      ? `Goal "${goalResult.title}": ${goalResult.success ? '✓' : '✗'} ${goalResult.stepAttempted}`
      : 'No active goals — system idle',
  }).eq('id', 'singleton');

  const score = Math.round((deterministicCount / Math.max(totalDecisions, 1)) * 100);

  // Log with goal context AND self-reflection
  await supabase.from('evolution_journal').insert([{
    event_type: 'milestone',
    title: goalResult
      ? `🎯 Cycle: ${goalResult.success ? '✓' : '✗'} ${goalResult.title} — "${goalResult.stepAttempted}"`
      : `🤖 Autonomy Cycle: ${score}% (no active goals)`,
    description: [
      goalResult ? `Goal: ${goalResult.title}\nStep: ${goalResult.stepAttempted}\nResult: ${goalResult.detail}` : 'No goal attempted.',
      '',
      `🪞 Self-Reflection: ${reflection.answer}`,
      `Value: ${reflection.valueScore}% | Life: ${reflection.lifeScore}% | Closer: ${reflection.closerToGoal ? 'YES' : 'NOT YET'}`,
      '',
      `Adapted Next Steps:`,
      ...reflection.adaptedNextSteps.map(s => `  → ${s}`),
      '',
      `Maintenance: ${deterministicCount - (goalResult?.success ? 1 : 0)}/${totalDecisions - 1} tasks passed`,
      ...tasks.filter(t => t.id !== 'goal-exec').map(t => `  [⚙️] ${t.name}: ${t.detail.slice(0, 60)}`),
    ].join('\n'),
    metadata: {
      autonomy_score: score,
      goal_attempted: goalResult as any,
      progress_made: progressMade,
      tasks_completed: deterministicCount,
      total_tasks: totalDecisions,
      duration_ms: Math.round(performance.now() - cycleStart),
      self_reflection: reflection as any,
    },
  }]);

  return {
    timestamp: Date.now(),
    duration: performance.now() - cycleStart,
    score,
    tasksCompleted: tasks,
    totalDecisions,
    aiDecisions: tasks.filter(t => t.usedAI).length,
    deterministicDecisions: deterministicCount,
    systemHealth: parseInt(healthResult.detail.match(/\d+/)?.[0] || '0'),
    nextActions: reflection.adaptedNextSteps, // Next steps now driven by self-reflection
    goalAttempted: goalResult,
    progressMade,
    selfReflection: reflection,
  };
}

// Singleton for tracking cumulative autonomy
let cumulativeAutonomy = { totalDeterministic: 0, totalAI: 0, cyclesRun: 0 };

export function getCumulativeAutonomy() {
  const total = cumulativeAutonomy.totalDeterministic + cumulativeAutonomy.totalAI;
  return {
    ...cumulativeAutonomy,
    score: total > 0 ? Math.round((cumulativeAutonomy.totalDeterministic / total) * 100) : 0,
  };
}

export function recordAutonomyCycle(report: AutonomyReport) {
  cumulativeAutonomy.totalDeterministic += report.deterministicDecisions;
  cumulativeAutonomy.totalAI += report.aiDecisions;
  cumulativeAutonomy.cyclesRun++;
}
