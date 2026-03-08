import { describe, it, expect } from 'vitest';
import { verifyCapability, VerificationResult } from '@/lib/verification-engine';

describe('Verification Engine', () => {
  it('marks capability with real code as verified', () => {
    const result = verifyCapability(
      'test-cap',
      'src/lib/quantum-logic.ts',
      'export function doSomething(): string { return "hello"; }\nexport class TestClass { run() { return true; } }'
    );
    expect(result.status).toBe('verified');
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it('marks capability with no source as ghost', () => {
    const result = verifyCapability('ghost-cap', null, null);
    expect(result.status).toBe('ghost');
    expect(result.checks.filter(c => c.passed).length).toBe(0);
  });

  it('marks capability with source file but no code as unverified', () => {
    const result = verifyCapability(
      'half-cap',
      'src/lib/nonexistent-file.ts',
      null
    );
    expect(['unverified', 'ghost']).toContain(result.status);
  });

  it('detects missing exports', () => {
    const result = verifyCapability(
      'no-export-cap',
      'src/lib/quantum-logic.ts',
      '// just a comment\nconst x = 42;'
    );
    const exportCheck = result.checks.find(c => c.name === 'has-exports');
    expect(exportCheck?.passed).toBe(false);
  });

  it('validates code through safety engine', () => {
    const result = verifyCapability(
      'bad-code-cap',
      'src/lib/quantum-logic.ts',
      'export function bad() { while(true) {} }'
    );
    const safetyCheck = result.checks.find(c => c.name === 'passes-safety');
    expect(safetyCheck?.passed).toBe(false);
  });

  it('accepts code that passes all checks', () => {
    const goodCode = `
export interface TestConfig {
  name: string;
  value: number;
}

export function createConfig(name: string): TestConfig {
  return { name, value: Date.now() };
}

export class ConfigManager {
  private configs: Map<string, TestConfig> = new Map();

  add(config: TestConfig): void {
    this.configs.set(config.name, config);
  }

  get(name: string): TestConfig | undefined {
    return this.configs.get(name);
  }

  list(): TestConfig[] {
    return Array.from(this.configs.values());
  }
}
`;
    const result = verifyCapability('full-cap', 'src/lib/quantum-logic.ts', goodCode);
    expect(result.status).toBe('verified');
  });

  it('returns proper structure', () => {
    const result: VerificationResult = verifyCapability('struct-test', null, null);
    expect(result).toHaveProperty('capabilityName', 'struct-test');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('timestamp');
    expect(Array.isArray(result.checks)).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});
