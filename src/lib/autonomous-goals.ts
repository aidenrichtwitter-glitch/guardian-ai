// ═══════════════════════════════════════════════════
// CAPABILITY: autonomous-goal-generation
// The system generates its own goals based on:
// - Evolution forecasting predictions
// - Anomaly detection findings
// - Capability gap analysis
// Built on: evolution-forecasting + anomaly-detection + pattern-recognition
// ═══════════════════════════════════════════════════

import { predictNextEvolutions, EvolutionPrediction } from './evolution-forecasting';
import { supabase } from '@/integrations/supabase/client';

export interface GeneratedGoal {
  title: string;
  description: string;
  priority: string;
  unlocks_capability: string;
  required_capabilities: string[];
  steps: { label: string; done: boolean }[];
}

/**
 * Autonomously generate goals based on current system state
 */
export async function generateGoals(): Promise<GeneratedGoal[]> {
  // Load current capabilities and goals
  const [capRes, goalRes, stateRes] = await Promise.all([
    supabase.from('capabilities').select('name').eq('verified', true),
    supabase.from('goals').select('unlocks_capability, status'),
    supabase.from('evolution_state').select('evolution_level, cycle_count').eq('id', 'singleton').single(),
  ]);

  const existingCaps = (capRes.data || []).map(c => c.name);
  const existingGoalCaps = new Set(
    (goalRes.data || [])
      .filter(g => g.status !== 'completed')
      .map(g => g.unlocks_capability)
      .filter(Boolean)
  );

  const currentLevel = stateRes.data?.evolution_level || 0;
  const cycleCount = stateRes.data?.cycle_count || 0;

  // Get predictions
  const predictions = predictNextEvolutions(existingCaps, currentLevel, cycleCount);

  // Filter out already-goaled predictions
  const newPredictions = predictions.filter(p => !existingGoalCaps.has(p.capability));

  // Convert top predictions to goals
  const goals: GeneratedGoal[] = newPredictions.slice(0, 3).map(pred => ({
    title: `Build: ${pred.capability}`,
    description: pred.description,
    priority: pred.priority >= 8 ? 'high' : pred.priority >= 6 ? 'medium' : 'low',
    unlocks_capability: pred.capability,
    required_capabilities: pred.prerequisites,
    steps: generateSteps(pred),
  }));

  return goals;
}

/**
 * Generate steps for a prediction
 */
function generateSteps(pred: EvolutionPrediction): { label: string; done: boolean }[] {
  const steps = [
    { label: `Design ${pred.capability} architecture`, done: false },
    { label: `Implement core logic`, done: false },
    { label: `Add to self-test runner`, done: false },
    { label: `Register and verify capability`, done: false },
  ];

  if (pred.category === 'autonomy') {
    steps.splice(2, 0, { label: 'Add deterministic rule for AI-free operation', done: false });
  }
  if (pred.category === 'resilience') {
    steps.splice(2, 0, { label: 'Add safety checks and rollback mechanism', done: false });
  }

  return steps;
}

/**
 * Generate and persist goals to the database
 */
export async function generateAndPersistGoals(): Promise<number> {
  const goals = await generateGoals();

  if (goals.length === 0) return 0;

  const { data: stateData } = await supabase
    .from('evolution_state')
    .select('cycle_count')
    .eq('id', 'singleton')
    .single();

  const cycleCount = stateData?.cycle_count || 0;

  const rows = goals.map(g => ({
    id: `auto-goal-${g.unlocks_capability}-${Date.now()}`,
    title: g.title,
    description: g.description,
    priority: g.priority,
    unlocks_capability: g.unlocks_capability,
    required_capabilities: g.required_capabilities,
    steps: g.steps,
    dreamed_at_cycle: cycleCount,
    status: 'active',
  }));

  const { error } = await supabase.from('goals').insert(rows);
  if (error) {
    console.error('Failed to persist auto-goals:', error);
    return 0;
  }

  // Log to journal
  await supabase.from('evolution_journal').insert([{
    event_type: 'goal',
    title: `🎯 Auto-generated ${goals.length} goals`,
    description: goals.map(g => g.title).join(', '),
    metadata: { count: goals.length, capabilities: goals.map(g => g.unlocks_capability) },
  }]);

  return goals.length;
}
