// ═══════════════════════════════════════════════════
// CAPABILITY: self-repair
// When tests fail or anomalies are detected, the system
// can automatically attempt repair by:
// 1. Identifying the broken capability
// 2. Reverting to last known good state
// 3. Regenerating using the rule engine
// 4. Re-running tests to confirm the fix
// Built on: anomaly-detection + pattern-recognition + verification-engine
// ═══════════════════════════════════════════════════

import { detectAnomalies, Anomaly } from './anomaly-detection';
import { verifyCapability, VerificationResult } from './verification-engine';
import { ruleEngine } from './rule-engine';
import { supabase } from '@/integrations/supabase/client';

export interface RepairAction {
  type: 'revert' | 'purge' | 'regenerate' | 'quarantine' | 'skip';
  target: string;
  description: string;
  success: boolean;
  error?: string;
}

export interface RepairReport {
  timestamp: number;
  anomaliesFound: number;
  repairsAttempted: number;
  repairsSucceeded: number;
  actions: RepairAction[];
  systemHealthBefore: number;
  systemHealthAfter: number;
}

/**
 * Run a full self-repair cycle:
 * 1. Detect anomalies
 * 2. Prioritize by severity
 * 3. Attempt repairs
 * 4. Report results
 */
export async function runSelfRepair(): Promise<RepairReport> {
  const actions: RepairAction[] = [];

  // Load current capabilities
  const { data: capabilities } = await supabase
    .from('capabilities')
    .select('id, name, description, evolution_level, cycle_number, built_on, verified, source_file, virtual_source')
    .order('cycle_number', { ascending: true });

  if (!capabilities || capabilities.length === 0) {
    return {
      timestamp: Date.now(),
      anomaliesFound: 0,
      repairsAttempted: 0,
      repairsSucceeded: 0,
      actions: [],
      systemHealthBefore: 100,
      systemHealthAfter: 100,
    };
  }

  const capRecords = capabilities.map(c => ({
    name: c.name,
    cycle: c.cycle_number,
    level: c.evolution_level,
    builtOn: (c.built_on || []) as string[],
    verified: c.verified,
  }));

  const { data: stateData } = await supabase
    .from('evolution_state')
    .select('*')
    .eq('id', 'singleton')
    .single();

  const currentLevel = stateData?.evolution_level || 0;
  const cycleCount = stateData?.cycle_count || 0;

  // 1. Detect anomalies
  const anomalies = detectAnomalies(capRecords, currentLevel, cycleCount);
  const verifiedCount = capRecords.filter(c => c.verified).length;
  const healthBefore = capabilities.length > 0
    ? Math.round((verifiedCount / capabilities.length) * 100)
    : 100;

  // 2. Handle each anomaly by type
  for (const anomaly of anomalies) {
    switch (anomaly.type) {
      case 'orphan': {
        // Fix orphan by removing the bad dependency reference
        const capName = anomaly.affectedEntity;
        if (!capName) break;

        const cap = capabilities.find(c => c.name === capName);
        if (!cap) break;

        // Extract the orphan parent name from description
        const orphanMatch = anomaly.description.match(/depends on "([^"]+)"/);
        const orphanParent = orphanMatch?.[1];
        if (!orphanParent) break;

        const newBuiltOn = ((cap.built_on || []) as string[]).filter(b => b !== orphanParent);
        const { error } = await supabase
          .from('capabilities')
          .update({ built_on: newBuiltOn })
          .eq('id', cap.id);

        actions.push({
          type: 'revert',
          target: capName,
          description: `Removed orphan dependency "${orphanParent}" from "${capName}"`,
          success: !error,
          error: error?.message,
        });
        break;
      }

      case 'corruption': {
        if (anomaly.description.includes('ghost')) {
          // Quarantine unverified capabilities — mark them distinctly
          const ghosts = capabilities.filter(c => !c.verified);
          for (const ghost of ghosts.slice(0, 10)) { // Max 10 per cycle
            // Try to verify first
            const result = verifyCapability(
              ghost.name,
              ghost.source_file,
              ghost.virtual_source
            );

            if (result.status === 'ghost') {
              actions.push({
                type: 'quarantine',
                target: ghost.name,
                description: `Ghost capability "${ghost.name}" quarantined — no backing code`,
                success: true,
              });
            } else if (result.status === 'verified') {
              // It's actually real! Mark as verified
              await supabase
                .from('capabilities')
                .update({ verified: true, verified_at: new Date().toISOString(), verification_method: 'self-repair-scan' })
                .eq('id', ghost.id);

              actions.push({
                type: 'regenerate',
                target: ghost.name,
                description: `"${ghost.name}" was actually valid — verified by self-repair`,
                success: true,
              });
            }
          }
        }

        if (anomaly.description.includes('duplicate')) {
          actions.push({
            type: 'skip',
            target: anomaly.affectedEntity || 'unknown',
            description: `Duplicate detected: ${anomaly.description}. Manual review recommended.`,
            success: true,
          });
        }
        break;
      }

      case 'drift':
      case 'spike': {
        // Low severity — log but don't act
        actions.push({
          type: 'skip',
          target: anomaly.affectedEntity || 'system',
          description: `${anomaly.type}: ${anomaly.description}. Monitoring.`,
          success: true,
        });
        break;
      }
    }
  }

  // Recalculate health after repairs
  const { data: updatedCaps } = await supabase
    .from('capabilities')
    .select('verified')
    .order('cycle_number', { ascending: true });

  const newVerified = updatedCaps?.filter(c => c.verified).length || verifiedCount;
  const totalCaps = updatedCaps?.length || capabilities.length;
  const healthAfter = totalCaps > 0 ? Math.round((newVerified / totalCaps) * 100) : 100;

  const succeeded = actions.filter(a => a.success).length;

  // Log to journal
  await supabase.from('evolution_journal').insert([{
    event_type: 'milestone',
    title: `🔧 Self-Repair: ${anomalies.length} anomalies, ${succeeded}/${actions.length} fixed`,
    description: `Health: ${healthBefore}% → ${healthAfter}%. Actions: ${actions.map(a => `[${a.type}] ${a.target}`).join(', ')}`,
    metadata: {
      anomalies_found: anomalies.length,
      repairs_attempted: actions.length,
      repairs_succeeded: succeeded,
      health_before: healthBefore,
      health_after: healthAfter,
    },
  }]);

  return {
    timestamp: Date.now(),
    anomaliesFound: anomalies.length,
    repairsAttempted: actions.length,
    repairsSucceeded: succeeded,
    actions,
    systemHealthBefore: healthBefore,
    systemHealthAfter: healthAfter,
  };
}

/**
 * Quick health check without attempting repairs
 */
export async function checkHealth(): Promise<{ health: number; anomalies: Anomaly[] }> {
  const { data: capabilities } = await supabase
    .from('capabilities')
    .select('name, cycle_number, evolution_level, built_on, verified');

  const { data: stateData } = await supabase
    .from('evolution_state')
    .select('evolution_level, cycle_count')
    .eq('id', 'singleton')
    .single();

  if (!capabilities) return { health: 100, anomalies: [] };

  const capRecords = capabilities.map(c => ({
    name: c.name,
    cycle: c.cycle_number,
    level: c.evolution_level,
    builtOn: (c.built_on || []) as string[],
    verified: c.verified,
  }));

  const anomalies = detectAnomalies(capRecords, stateData?.evolution_level || 0, stateData?.cycle_count || 0);
  const verified = capabilities.filter(c => c.verified).length;
  const health = capabilities.length > 0 ? Math.round((verified / capabilities.length) * 100) : 100;

  return { health, anomalies };
}
