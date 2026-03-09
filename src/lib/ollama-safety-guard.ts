// ═══════════════════════════════════════════════════
// CAPABILITY: ollama-safety-guard
// Wraps Ollama interactions with safety guardrails
// so the local AI can't break the app. All changes
// proposed by Ollama go through validation, snapshot,
// and can be paused/rolled back instantly.
// Built on: safety-engine + anomaly-detection + self-repair
// ═══════════════════════════════════════════════════

import { validateChange } from './safety-engine';
import { type SafetyCheck } from './self-reference';

export interface OllamaGuardConfig {
  /** Whether Ollama autonomy is allowed to make changes */
  enabled: boolean;
  /** Whether changes require manual approval */
  requireApproval: boolean;
  /** Max number of files Ollama can change per cycle */
  maxChangesPerCycle: number;
  /** Files that Ollama is NEVER allowed to modify */
  protectedFiles: string[];
  /** Patterns in code that Ollama is not allowed to produce */
  bannedPatterns: string[];
  /** Max % of a file Ollama can replace (prevents total erasure) */
  maxReplacementPercent: number;
}

export const DEFAULT_GUARD_CONFIG: OllamaGuardConfig = {
  enabled: true,
  requireApproval: false,
  maxChangesPerCycle: 3,
  protectedFiles: [
    'src/lib/safety-engine.ts',
    'src/lib/self-reference.ts',
    'src/lib/self-source.ts',
    'src/lib/cloud-memory.ts',
    'src/lib/ollama-safety-guard.ts',
    'src/integrations/supabase/client.ts',
    'src/integrations/supabase/types.ts',
    'src/main.tsx',
    'src/App.tsx',
    'src/App.css',
    'src/index.css',
    'index.html',
    'package.json',
    'vite.config.ts',
    'tsconfig.app.json',
    'tsconfig.json',
  ],
  bannedPatterns: [
    'process.exit',
    'require("child_process")',
    'exec(',
    'eval(',
    'Function(',
    'document.write',
    'innerHTML =',      // XSS vector
    'localStorage.clear',
    'indexedDB.deleteDatabase',
  ],
  maxReplacementPercent: 80,
};

export interface GuardVerdict {
  allowed: boolean;
  reason: string;
  checks: SafetyCheck[];
  warnings: string[];
  snapshot?: string; // previous content for rollback
}

/**
 * Check if Ollama is available at the expected endpoint
 */
export async function checkOllamaAvailability(baseUrl = 'http://localhost:11434'): Promise<{
  available: boolean;
  models: string[];
  version?: string;
}> {
  try {
    const [tagsRes, versionRes] = await Promise.all([
      fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) }).catch(() => null),
      fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) }).catch(() => null),
    ]);

    if (!tagsRes || !tagsRes.ok) {
      return { available: false, models: [] };
    }

    const tagsData = await tagsRes.json();
    const models = (tagsData.models || []).map((m: any) => m.name || m.model || '');

    let version: string | undefined;
    if (versionRes?.ok) {
      const vData = await versionRes.json();
      version = vData.version;
    }

    return { available: true, models, version };
  } catch {
    return { available: false, models: [] };
  }
}

/**
 * Validate a proposed change from Ollama before applying it.
 * This is the core safety gate — Ollama cannot bypass this.
 */
export function validateOllamaChange(
  filePath: string,
  currentContent: string,
  proposedContent: string,
  config: OllamaGuardConfig = DEFAULT_GUARD_CONFIG
): GuardVerdict {
  const warnings: string[] = [];

  // 1. Check if file is protected
  if (config.protectedFiles.some(p => filePath === p || filePath.endsWith(p))) {
    return {
      allowed: false,
      reason: `🛡️ "${filePath}" is a protected file — Ollama cannot modify it`,
      checks: [],
      warnings: [],
    };
  }

  // 2. Check replacement percentage (prevent total erasure)
  if (currentContent.length > 50) {
    const originalLines = currentContent.split('\n').length;
    const proposedLines = proposedContent.split('\n').length;
    const replacementPercent = Math.abs(1 - proposedLines / originalLines) * 100;

    if (proposedContent.trim().length < 10) {
      return {
        allowed: false,
        reason: `🚫 Ollama tried to erase "${filePath}" (content reduced to ${proposedContent.length} chars)`,
        checks: [],
        warnings: [],
      };
    }

    if (replacementPercent > config.maxReplacementPercent) {
      warnings.push(`⚠ Large change: ${replacementPercent.toFixed(0)}% of file modified (limit: ${config.maxReplacementPercent}%)`);
      // Allow but warn — don't block structural changes
    }
  }

  // 3. Check for banned patterns
  for (const pattern of config.bannedPatterns) {
    if (proposedContent.includes(pattern) && !currentContent.includes(pattern)) {
      return {
        allowed: false,
        reason: `🚫 Banned pattern detected: "${pattern}" — Ollama cannot introduce this`,
        checks: [],
        warnings: [],
      };
    }
  }

  // 4. Run standard safety checks
  const checks = validateChange(proposedContent, filePath);
  const hasErrors = checks.some(c => c.severity === 'error');

  if (hasErrors) {
    return {
      allowed: false,
      reason: `Safety validation failed: ${checks.filter(c => c.severity === 'error').map(c => c.message).join('; ')}`,
      checks,
      warnings,
    };
  }

  // 5. Check for empty export (common Ollama mistake — replaces everything with a single export)
  const originalExports = (currentContent.match(/export\s+(?:function|class|const|interface|type)\s+\w+/g) || []).length;
  const newExports = (proposedContent.match(/export\s+(?:function|class|const|interface|type)\s+\w+/g) || []).length;

  if (originalExports > 3 && newExports < originalExports * 0.3) {
    return {
      allowed: false,
      reason: `🚫 Ollama would delete ${originalExports - newExports} exports from "${filePath}" (${originalExports} → ${newExports})`,
      checks,
      warnings,
    };
  }

  // Passed all checks
  return {
    allowed: true,
    reason: checks.every(c => c.severity === 'info')
      ? '✓ All safety checks passed'
      : `✓ Passed with ${checks.filter(c => c.severity === 'warning').length} warning(s)`,
    checks,
    warnings,
    snapshot: currentContent,
  };
}

/**
 * Storage key for guard config persistence
 */
const GUARD_CONFIG_KEY = 'ollama-guard-config';

export function loadGuardConfig(): OllamaGuardConfig {
  try {
    const raw = localStorage.getItem(GUARD_CONFIG_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Merge with defaults to pick up any new fields
      return { ...DEFAULT_GUARD_CONFIG, ...saved };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_GUARD_CONFIG };
}

export function saveGuardConfig(config: OllamaGuardConfig): void {
  localStorage.setItem(GUARD_CONFIG_KEY, JSON.stringify(config));
}
