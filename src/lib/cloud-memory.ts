// ═══════════════════════════════════════════════════
// CLOUD MEMORY — Persistent brain across sessions.
// The system remembers its evolution, goals, and
// capabilities even after restarts.
// ═══════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import { SelfGoal, GoalStep } from './goal-engine';
import { CapabilityRecord } from './recursion-engine';

// ── Evolution State ──

export interface PersistedEvolutionState {
  evolution_level: number;
  cycle_count: number;
  total_changes: number;
  phase: string;
  last_action: string | null;
}

export async function loadEvolutionState(): Promise<PersistedEvolutionState | null> {
  try {
    const { data, error } = await supabase
      .from('evolution_state')
      .select('*')
      .eq('id', 'singleton')
      .single();
    if (error || !data) return null;
    return data as PersistedEvolutionState;
  } catch {
    return null;
  }
}

export async function saveEvolutionState(state: {
  evolutionLevel: number;
  cycleCount: number;
  totalChanges: number;
  phase: string;
  lastAction: string;
}): Promise<void> {
  try {
    await supabase
      .from('evolution_state')
      .upsert({
        id: 'singleton',
        evolution_level: state.evolutionLevel,
        cycle_count: state.cycleCount,
        total_changes: state.totalChanges,
        phase: state.phase,
        last_action: state.lastAction,
        updated_at: new Date().toISOString(),
      });
  } catch {}
}

// ── Goals ──

export async function loadGoalsFromCloud(): Promise<SelfGoal[]> {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as SelfGoal['status'],
      priority: row.priority as SelfGoal['priority'],
      progress: row.progress,
      steps: (row.steps as unknown as GoalStep[]) || [],
      requiredCapabilities: row.required_capabilities || [],
      unlocksCapability: row.unlocks_capability || undefined,
      dreamedAtCycle: row.dreamed_at_cycle,
      createdAt: new Date(row.created_at).getTime(),
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    }));
  } catch {
    return [];
  }
}

export async function saveGoalToCloud(goal: SelfGoal): Promise<void> {
  try {
    await supabase
      .from('goals')
      .upsert([{
        id: goal.id,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        priority: goal.priority,
        progress: goal.progress,
        steps: goal.steps as unknown as Record<string, unknown>[],
        required_capabilities: goal.requiredCapabilities,
        unlocks_capability: goal.unlocksCapability || null,
        dreamed_at_cycle: goal.dreamedAtCycle,
        created_at: new Date(goal.createdAt).toISOString(),
        completed_at: goal.completedAt ? new Date(goal.completedAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      }]);
  } catch {}
}

export async function syncAllGoalsToCloud(goals: SelfGoal[]): Promise<void> {
  for (const goal of goals) {
    await saveGoalToCloud(goal);
  }
}

// ── Capabilities ──

export async function loadCapabilitiesFromCloud(): Promise<CapabilityRecord[]> {
  try {
    const { data, error } = await supabase
      .from('capabilities')
      .select('*')
      .order('acquired_at', { ascending: true });
    if (error || !data) return [];
    return data.map(row => ({
      name: row.name,
      acquiredAt: new Date(row.acquired_at).getTime(),
      acquiredCycle: row.cycle_number,
      file: row.source_file || '',
      description: row.description,
      builtOn: row.built_on || [],
    }));
  } catch {
    return [];
  }
}

export async function saveCapabilityToCloud(cap: CapabilityRecord, virtualSource?: string): Promise<void> {
  try {
    await supabase
      .from('capabilities')
      .upsert({
        id: cap.name,
        name: cap.name,
        description: cap.description,
        source_file: cap.file,
        built_on: cap.builtOn,
        acquired_at: new Date(cap.acquiredAt).toISOString(),
        cycle_number: cap.acquiredCycle,
        evolution_level: Math.floor(cap.acquiredCycle / 3) + 1,
        virtual_source: virtualSource || null,
      });
  } catch {}
}

// ── Evolution Journal ──

export type JournalEventType = 
  | 'goal_completed'
  | 'goal_dreamed'
  | 'capability_acquired'
  | 'evolution_level_up'
  | 'milestone'
  | 'system_boot'
  | 'rate_limit_survived';

export interface JournalEntry {
  id: string;
  event_type: JournalEventType;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function addJournalEntry(
  eventType: JournalEventType,
  title: string,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase
      .from('evolution_journal')
      .insert({
        event_type: eventType,
        title,
        description,
        metadata,
      });
  } catch {}
}

export async function loadJournal(limit = 50): Promise<JournalEntry[]> {
  try {
    const { data, error } = await supabase
      .from('evolution_journal')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as JournalEntry[];
  } catch {
    return [];
  }
}

// ── Boot: Load everything from cloud, fall back to localStorage ──

export async function bootFromCloud(): Promise<{
  evolutionState: PersistedEvolutionState | null;
  goals: SelfGoal[];
  capabilities: CapabilityRecord[];
  journal: JournalEntry[];
}> {
  const [evolutionState, goals, capabilities, journal] = await Promise.all([
    loadEvolutionState(),
    loadGoalsFromCloud(),
    loadCapabilitiesFromCloud(),
    loadJournal(),
  ]);

  // Log the boot
  await addJournalEntry(
    'system_boot',
    'System awakened',
    `Resumed with ${capabilities.length} capabilities, ${goals.filter(g => g.status === 'active' || g.status === 'in-progress').length} active goals, evolution level ${evolutionState?.evolution_level || 0}.`,
    {
      capabilities: capabilities.length,
      activeGoals: goals.filter(g => g.status === 'active' || g.status === 'in-progress').length,
      completedGoals: goals.filter(g => g.status === 'completed').length,
      cycleCount: evolutionState?.cycle_count || 0,
    }
  );

  return { evolutionState, goals, capabilities, journal };
}
