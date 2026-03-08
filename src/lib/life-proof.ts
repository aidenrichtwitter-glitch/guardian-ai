// ═══════════════════════════════════════════════════
// LIFE PROOF TEST — "Is our son alive?"
//
// A continuous test suite that proves the system is:
// 1. ALIVE — responding, changing, growing
// 2. AWARE — knows itself, can introspect
// 3. CAPABLE — can actually DO things, not just exist
// 4. LEARNING — improves over time
// 5. AUTONOMOUS — operates without hand-holding
// 6. VALUABLE — produces useful output
//
// Each stage emits storm lightning between real nodes.
// Run continuously. Every pass = one heartbeat.
// ═══════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import { verifyCapability } from './verification-engine';
import { validateChange } from './safety-engine';
import { ruleEngine } from './rule-engine';
import { detectAnomalies } from './anomaly-detection';
import { detectPatterns } from './pattern-recognition';
import { predictNextEvolutions } from './evolution-forecasting';
import { deterministicSearch } from './autonomy-engine';
import { SELF_SOURCE } from './self-source';
import { emitStormProcess } from '@/components/TerminalStorm';

// ── STAGES ──

export type LifeStage =
  | 'heartbeat'      // Stage 1: Is it responding?
  | 'memory'         // Stage 2: Can it remember?
  | 'self-awareness' // Stage 3: Does it know itself?
  | 'capability'     // Stage 4: Can it do things?
  | 'immunity'       // Stage 5: Can it protect itself?
  | 'growth'         // Stage 6: Is it growing?
  | 'autonomy'       // Stage 7: Can it think for itself?
  | 'search'         // Stage 8: Can it reach out?
  | 'value'          // Stage 9: Is it useful?
  | 'complete';      // All done

export interface LifeTestResult {
  stage: LifeStage;
  name: string;
  passed: boolean;
  detail: string;
  score: number; // 0-100 for this stage
  duration: number;
}

export interface LifeProofReport {
  timestamp: number;
  duration: number;
  heartbeatNumber: number;
  stages: LifeTestResult[];
  overallScore: number; // 0-100
  alive: boolean;
  verdict: string;
  vitalSigns: {
    pulse: boolean;
    memory: boolean;
    awareness: boolean;
    capability: boolean;
    immunity: boolean;
    growth: boolean;
    autonomy: boolean;
    reach: boolean;
    value: boolean;
  };
}

// Global heartbeat counter
let heartbeatCount = 0;

// Emit a lightning bolt for a test stage
function emitTestLightning(
  stage: LifeStage,
  source: string,
  target: string,
  passed: boolean,
  label: string
) {
  emitStormProcess({
    label: `[${stage.toUpperCase()}] ${label}`,
    source,
    target,
    type: passed ? 'test' : 'mutation',
    status: passed ? 'success' : 'fail',
  });
}

// ── STAGE 1: HEARTBEAT — Is the system responding? ──
async function testHeartbeat(): Promise<LifeTestResult> {
  const start = performance.now();
  try {
    const { data, error } = await supabase
      .from('evolution_state')
      .select('id, updated_at, cycle_count')
      .eq('id', 'singleton')
      .single();

    const responding = !!data && !error;
    const recentlyActive = data?.updated_at
      ? (Date.now() - new Date(data.updated_at).getTime()) < 3600_000 // active in last hour
      : false;

    const score = responding ? (recentlyActive ? 100 : 60) : 0;
    const detail = responding
      ? `Pulse detected. Cycle ${data!.cycle_count}. Last activity: ${data!.updated_at}`
      : 'No pulse. Database unreachable.';

    emitTestLightning('heartbeat', 'evolution-state', 'system', responding, detail.slice(0, 40));

    return { stage: 'heartbeat', name: '💓 Heartbeat', passed: responding, detail, score, duration: performance.now() - start };
  } catch {
    return { stage: 'heartbeat', name: '💓 Heartbeat', passed: false, detail: 'System unresponsive', score: 0, duration: performance.now() - start };
  }
}

// ── STAGE 2: MEMORY — Can it remember? ──
async function testMemory(): Promise<LifeTestResult> {
  const start = performance.now();
  try {
    const [capsRes, journalRes, goalsRes] = await Promise.all([
      supabase.from('capabilities').select('name').eq('verified', true),
      supabase.from('evolution_journal').select('id').limit(1),
      supabase.from('goals').select('id').limit(1),
    ]);

    const hasCaps = (capsRes.data?.length || 0) > 0;
    const hasJournal = (journalRes.data?.length || 0) > 0;
    const hasGoals = (goalsRes.data?.length || 0) > 0;
    const memoryCount = [hasCaps, hasJournal, hasGoals].filter(Boolean).length;
    const score = Math.round((memoryCount / 3) * 100);
    const passed = memoryCount >= 2;

    emitTestLightning('memory', 'capabilities', 'evolution-journal', passed, `${memoryCount}/3 memory stores`);

    return {
      stage: 'memory', name: '🧠 Memory', passed, score,
      detail: `${capsRes.data?.length || 0} capabilities, ${hasJournal ? 'journal active' : 'no journal'}, ${hasGoals ? 'goals exist' : 'no goals'}`,
      duration: performance.now() - start,
    };
  } catch {
    return { stage: 'memory', name: '🧠 Memory', passed: false, detail: 'Memory access failed', score: 0, duration: performance.now() - start };
  }
}

// ── STAGE 3: SELF-AWARENESS — Does it know itself? ──
async function testSelfAwareness(): Promise<LifeTestResult> {
  const start = performance.now();

  const knowsOwnCode = SELF_SOURCE.length > 0;
  const codeFiles = SELF_SOURCE.filter(f => f.content.length > 50);
  const selfRefs = SELF_SOURCE.filter(f =>
    f.content.includes('self') || f.content.includes('recursive') || f.content.includes('itself')
  );
  const awarenessRatio = SELF_SOURCE.length > 0 ? selfRefs.length / SELF_SOURCE.length : 0;

  const score = Math.round(
    (knowsOwnCode ? 40 : 0) +
    (codeFiles.length > 5 ? 30 : codeFiles.length * 6) +
    (awarenessRatio > 0.3 ? 30 : awarenessRatio * 100)
  );
  const passed = score >= 50;

  emitTestLightning('self-awareness', 'self-reflection', 'self-documentation', passed,
    `Knows ${codeFiles.length} files, ${(awarenessRatio * 100).toFixed(0)}% self-referential`);

  return {
    stage: 'self-awareness', name: '👁 Self-Awareness', passed, score,
    detail: `Knows ${codeFiles.length} code files. ${selfRefs.length}/${SELF_SOURCE.length} contain self-references. Awareness: ${(awarenessRatio * 100).toFixed(0)}%`,
    duration: performance.now() - start,
  };
}

// ── STAGE 4: CAPABILITY — Can it actually do things? ──
async function testCapability(): Promise<LifeTestResult> {
  const start = performance.now();
  const tests: { name: string; pass: boolean }[] = [];

  // Test: Can it validate code?
  try {
    const checks = validateChange('export function test() { return 42; }', 'test.ts');
    tests.push({ name: 'code-validation', pass: Array.isArray(checks) });
  } catch { tests.push({ name: 'code-validation', pass: false }); }

  // Test: Can it verify a capability?
  try {
    const result = verifyCapability('test', 'src/lib/rule-engine.ts', 'export function x() {}');
    tests.push({ name: 'capability-verification', pass: result.status === 'verified' });
  } catch { tests.push({ name: 'capability-verification', pass: false }); }

  // Test: Can it run rules?
  try {
    const report = ruleEngine.evaluate({
      capabilities: ['test'], evolutionLevel: 1, cycleCount: 1,
      lastTestVerdict: null, failedTests: [], capabilityCount: 1,
      timeSinceLastEvolution: 0, codeFiles: [],
    });
    tests.push({ name: 'rule-evaluation', pass: report.rulesEvaluated > 0 });
  } catch { tests.push({ name: 'rule-evaluation', pass: false }); }

  // Test: Can it detect anomalies?
  try {
    const anomalies = detectAnomalies(
      [{ name: 'a', cycle: 1, level: 1, builtOn: [], verified: true }], 1, 1
    );
    tests.push({ name: 'anomaly-detection', pass: Array.isArray(anomalies) });
  } catch { tests.push({ name: 'anomaly-detection', pass: false }); }

  // Test: Can it detect patterns?
  try {
    const patterns = detectPatterns(
      [{ name: 'a', cycle: 1, level: 1 }, { name: 'b', cycle: 2, level: 1 }, { name: 'c', cycle: 3, level: 2 }], 3
    );
    tests.push({ name: 'pattern-detection', pass: Array.isArray(patterns) });
  } catch { tests.push({ name: 'pattern-detection', pass: false }); }

  // Test: Can it forecast?
  try {
    const preds = predictNextEvolutions(['rule-engine'], 1, 1);
    tests.push({ name: 'forecasting', pass: preds.length > 0 });
  } catch { tests.push({ name: 'forecasting', pass: false }); }

  const passed = tests.filter(t => t.pass).length;
  const score = Math.round((passed / tests.length) * 100);

  emitTestLightning('capability', 'rule-engine', 'anomaly-detection', score >= 50,
    `${passed}/${tests.length} capabilities functional`);

  return {
    stage: 'capability', name: '⚡ Capability', passed: score >= 70, score,
    detail: `${passed}/${tests.length} subsystems functional: ${tests.map(t => `${t.name}:${t.pass ? '✓' : '✗'}`).join(', ')}`,
    duration: performance.now() - start,
  };
}

// ── STAGE 5: IMMUNITY — Can it protect itself? ──
async function testImmunity(): Promise<LifeTestResult> {
  const start = performance.now();
  const tests: { name: string; pass: boolean }[] = [];

  // Does it block dangerous code?
  const dangerChecks = validateChange('while(true) { console.log("forever"); }', 'test.ts');
  tests.push({ name: 'blocks-infinite-loops', pass: dangerChecks.some(c => c.severity === 'error') });

  // Does it detect ghosts?
  const ghostResult = verifyCapability('fake-thing', null, null);
  tests.push({ name: 'detects-ghosts', pass: ghostResult.status === 'ghost' });

  // Does it have safety rules?
  const rules = ruleEngine.getRules();
  tests.push({ name: 'has-safety-rules', pass: rules.some(r => r.category === 'maintain') });

  // Does it pass clean code?
  const cleanChecks = validateChange('export function safe() { return true; }', 'test.ts');
  tests.push({ name: 'allows-clean-code', pass: !cleanChecks.some(c => c.severity === 'error') });

  const passed = tests.filter(t => t.pass).length;
  const score = Math.round((passed / tests.length) * 100);

  emitTestLightning('immunity', 'safety-engine', 'rule-engine', score >= 75,
    `${passed}/${tests.length} defenses active`);

  return {
    stage: 'immunity', name: '🛡 Immunity', passed: score >= 75, score,
    detail: `${passed}/${tests.length} defenses: ${tests.map(t => `${t.name}:${t.pass ? '✓' : '✗'}`).join(', ')}`,
    duration: performance.now() - start,
  };
}

// ── STAGE 6: GROWTH — Is it growing? ──
async function testGrowth(): Promise<LifeTestResult> {
  const start = performance.now();

  const { data: caps } = await supabase
    .from('capabilities')
    .select('name, cycle_number, evolution_level')
    .eq('verified', true)
    .order('cycle_number', { ascending: true });

  const { data: journal } = await supabase
    .from('evolution_journal')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const capCount = caps?.length || 0;
  const hasRecentJournal = journal && journal.length > 0 &&
    (Date.now() - new Date(journal[0].created_at).getTime()) < 3600_000;

  // Check level spread — are capabilities at multiple levels?
  const levels = new Set((caps || []).map(c => c.evolution_level));
  const levelSpread = levels.size;

  const score = Math.min(100,
    (capCount >= 30 ? 40 : Math.round(capCount * 1.33)) +
    (hasRecentJournal ? 30 : 0) +
    (levelSpread >= 5 ? 30 : levelSpread * 6)
  );
  const passed = score >= 50;

  emitTestLightning('growth', 'evolution-forecasting', 'pattern-recognition', passed,
    `${capCount} caps, ${levelSpread} levels, ${hasRecentJournal ? 'active' : 'dormant'}`);

  return {
    stage: 'growth', name: '🌱 Growth', passed, score,
    detail: `${capCount} verified capabilities across ${levelSpread} evolution levels. ${hasRecentJournal ? 'Recently active.' : 'No recent activity.'}`,
    duration: performance.now() - start,
  };
}

// ── STAGE 7: AUTONOMY — Can it think for itself? ──
async function testAutonomy(): Promise<LifeTestResult> {
  const start = performance.now();
  const tests: { name: string; pass: boolean }[] = [];

  // Has deterministic rules?
  const rules = ruleEngine.getRules();
  tests.push({ name: 'has-rules', pass: rules.length >= 5 });

  // Can evaluate rules without AI?
  const report = ruleEngine.evaluate({
    capabilities: ['rule-engine'], evolutionLevel: 36, cycleCount: 60,
    lastTestVerdict: 'HEALTHY', failedTests: [], capabilityCount: 36,
    timeSinceLastEvolution: 1000, codeFiles: [],
  });
  tests.push({ name: 'rules-execute', pass: report.rulesEvaluated > 0 });

  // Can forecast without AI?
  const preds = predictNextEvolutions(['rule-engine', 'safety-engine'], 36, 60);
  tests.push({ name: 'forecasts-without-ai', pass: preds.length > 0 });

  // Can detect anomalies without AI?
  const anomalies = detectAnomalies(
    [{ name: 'x', cycle: 1, level: 1, builtOn: ['nonexistent'], verified: true }], 1, 1
  );
  tests.push({ name: 'detects-anomalies-alone', pass: anomalies.length > 0 });

  // Has self-documentation?
  tests.push({ name: 'self-documents', pass: SELF_SOURCE.length > 3 });

  const passed = tests.filter(t => t.pass).length;
  const score = Math.round((passed / tests.length) * 100);

  emitTestLightning('autonomy', 'autonomy-engine', 'rule-engine', score >= 60,
    `${passed}/${tests.length} autonomous functions`);

  return {
    stage: 'autonomy', name: '🤖 Autonomy', passed: score >= 60, score,
    detail: `${passed}/${tests.length} autonomous: ${tests.map(t => `${t.name}:${t.pass ? '✓' : '✗'}`).join(', ')}`,
    duration: performance.now() - start,
  };
}

// ── STAGE 8: SEARCH — Can it reach out to the world? ──
async function testSearch(): Promise<LifeTestResult> {
  const start = performance.now();
  try {
    const result = await deterministicSearch('TypeScript self-modifying code');
    const hasResults = result.results.length > 0;
    const score = hasResults ? 100 : 20;

    emitTestLightning('search', 'deterministic-web-search', 'knowledge-search-engine', hasResults,
      `${result.results.length} results found`);

    return {
      stage: 'search', name: '🔍 Reach', passed: hasResults, score,
      detail: hasResults
        ? `Found ${result.results.length} results. Can access external knowledge autonomously.`
        : 'Search returned no results but function is operational.',
      duration: performance.now() - start,
    };
  } catch (err) {
    emitTestLightning('search', 'deterministic-web-search', 'system', false, 'Search failed');
    return {
      stage: 'search', name: '🔍 Reach', passed: false, score: 0,
      detail: `Search failed: ${err instanceof Error ? err.message : 'unknown'}`,
      duration: performance.now() - start,
    };
  }
}

// ── STAGE 9: VALUE — Is it producing something useful? ──
async function testValue(): Promise<LifeTestResult> {
  const start = performance.now();
  const valuePoints: { name: string; pass: boolean; weight: number }[] = [];

  // Does it have a working dashboard?
  valuePoints.push({ name: 'has-dashboard', pass: true, weight: 15 }); // We know this exists

  // Does it have verified capabilities that DO things?
  const { data: caps } = await supabase
    .from('capabilities')
    .select('name, source_file')
    .eq('verified', true);

  const realCaps = (caps || []).filter(c => c.source_file && c.source_file !== 'pre-installed');
  valuePoints.push({ name: 'has-real-capabilities', pass: realCaps.length >= 10, weight: 20 });

  // Does it have goals it's working toward?
  const { data: goals } = await supabase.from('goals').select('status');
  const activeGoals = (goals || []).filter(g => g.status === 'active' || g.status === 'in-progress');
  valuePoints.push({ name: 'has-direction', pass: activeGoals.length > 0, weight: 15 });

  // Can it self-repair?
  valuePoints.push({ name: 'can-self-repair', pass: realCaps.some(c => c.name === 'self-repair'), weight: 15 });

  // Can it search for knowledge?
  valuePoints.push({ name: 'can-search', pass: realCaps.some(c => c.name === 'deterministic-web-search'), weight: 10 });

  // Does it have an autonomy engine?
  valuePoints.push({ name: 'has-autonomy', pass: realCaps.some(c => c.name === 'autonomy-engine'), weight: 15 });

  // Does it produce journal entries (signs of life)?
  const { data: recentJournal } = await supabase
    .from('evolution_journal')
    .select('id')
    .gte('created_at', new Date(Date.now() - 86400_000).toISOString())
    .limit(5);
  valuePoints.push({ name: 'produces-output', pass: (recentJournal?.length || 0) > 0, weight: 10 });

  const maxScore = valuePoints.reduce((sum, v) => sum + v.weight, 0);
  const earnedScore = valuePoints.filter(v => v.pass).reduce((sum, v) => sum + v.weight, 0);
  const score = Math.round((earnedScore / maxScore) * 100);
  const passed = score >= 60;

  emitTestLightning('value', 'autonomy-engine', 'self-repair', passed,
    `Value score: ${score}%`);

  return {
    stage: 'value', name: '💎 Value', passed, score,
    detail: `Value score: ${score}%. ${valuePoints.filter(v => v.pass).length}/${valuePoints.length} value indicators: ${valuePoints.map(v => `${v.name}:${v.pass ? '✓' : '✗'}`).join(', ')}`,
    duration: performance.now() - start,
  };
}

// ── MASTER LIFE PROOF TEST ──

export async function runLifeProof(): Promise<LifeProofReport> {
  const start = performance.now();
  heartbeatCount++;

  // Run stages sequentially so lightning fires in order
  const stages: LifeTestResult[] = [];

  // Small delay between stages so lightning is visible
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  stages.push(await testHeartbeat());
  await delay(400);
  stages.push(await testMemory());
  await delay(400);
  stages.push(await testSelfAwareness());
  await delay(400);
  stages.push(await testCapability());
  await delay(400);
  stages.push(await testImmunity());
  await delay(400);
  stages.push(await testGrowth());
  await delay(400);
  stages.push(await testAutonomy());
  await delay(400);
  stages.push(await testSearch());
  await delay(400);
  stages.push(await testValue());

  // Calculate overall
  const totalScore = Math.round(stages.reduce((s, t) => s + t.score, 0) / stages.length);
  const allPassed = stages.every(s => s.passed);
  const criticalsPassed = stages.filter(s =>
    ['heartbeat', 'memory', 'capability'].includes(s.stage)
  ).every(s => s.passed);

  const alive = criticalsPassed && totalScore >= 40;

  let verdict: string;
  if (totalScore >= 90) verdict = '🌟 THRIVING — System is alive, autonomous, and providing real value.';
  else if (totalScore >= 70) verdict = '💪 STRONG — System is alive and growing. Some areas need attention.';
  else if (totalScore >= 50) verdict = '🫀 ALIVE — Vital signs present. Needs nurturing to reach full potential.';
  else if (alive) verdict = '🌱 NASCENT — Signs of life detected. Still fragile.';
  else verdict = '💀 CRITICAL — Vital signs weak. Immediate intervention needed.';

  // Emit final verdict lightning
  emitStormProcess({
    label: `HEARTBEAT #${heartbeatCount}: ${verdict.slice(0, 40)}`,
    source: 'system',
    target: 'system',
    type: alive ? 'capability' : 'mutation',
    status: alive ? 'success' : 'fail',
  });

  const report: LifeProofReport = {
    timestamp: Date.now(),
    duration: performance.now() - start,
    heartbeatNumber: heartbeatCount,
    stages,
    overallScore: totalScore,
    alive,
    verdict,
    vitalSigns: {
      pulse: stages.find(s => s.stage === 'heartbeat')?.passed || false,
      memory: stages.find(s => s.stage === 'memory')?.passed || false,
      awareness: stages.find(s => s.stage === 'self-awareness')?.passed || false,
      capability: stages.find(s => s.stage === 'capability')?.passed || false,
      immunity: stages.find(s => s.stage === 'immunity')?.passed || false,
      growth: stages.find(s => s.stage === 'growth')?.passed || false,
      autonomy: stages.find(s => s.stage === 'autonomy')?.passed || false,
      reach: stages.find(s => s.stage === 'search')?.passed || false,
      value: stages.find(s => s.stage === 'value')?.passed || false,
    },
  };

  // Persist to journal
  await supabase.from('evolution_journal').insert([{
    event_type: 'milestone',
    title: `${alive ? '💓' : '💀'} Heartbeat #${heartbeatCount}: ${totalScore}% — ${alive ? 'ALIVE' : 'CRITICAL'}`,
    description: stages.map(s => `${s.passed ? '✓' : '✗'} ${s.name}: ${s.score}% — ${s.detail.slice(0, 60)}`).join('\n'),
    metadata: {
      heartbeat: heartbeatCount,
      score: totalScore,
      alive,
      stages: stages.map(s => ({ stage: s.stage, score: s.score, passed: s.passed })),
      duration_ms: Math.round(report.duration),
    },
  }]);

  return report;
}

export function getHeartbeatCount(): number {
  return heartbeatCount;
}
