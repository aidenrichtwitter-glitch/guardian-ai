import { describe, it, expect } from 'vitest';
import { validateChange, getSeverityColor } from '@/lib/safety-engine';

describe('Safety Engine', () => {
  it('passes clean code', () => {
    const checks = validateChange(
      'export function hello() { return "world"; }',
      'test.ts'
    );
    expect(checks.some(c => c.severity === 'error')).toBe(false);
  });

  it('detects unbalanced brackets', () => {
    const checks = validateChange(
      'function broken() { { { }',
      'test.ts'
    );
    const bracketIssue = checks.find(c => c.type === 'syntax');
    expect(bracketIssue).toBeTruthy();
  });

  it('detects circular self-imports', () => {
    const checks = validateChange(
      "import { foo } from './test';",
      'src/lib/test.ts'
    );
    const circular = checks.find(c => c.type === 'circular');
    expect(circular).toBeTruthy();
  });

  it('blocks infinite loops without break/return', () => {
    const checks = validateChange(
      'function inf() { while(true) { console.log("forever"); } }',
      'test.ts'
    );
    const runtime = checks.find(c => c.type === 'runtime' && c.severity === 'error');
    expect(runtime).toBeTruthy();
  });

  it('allows loops with break', () => {
    const checks = validateChange(
      'function ok() { while(true) { if (done) break; } }',
      'test.ts'
    );
    const runtime = checks.find(c => c.type === 'runtime' && c.severity === 'error');
    expect(runtime).toBeFalsy();
  });

  it('returns severity colors', () => {
    expect(getSeverityColor('error')).toBe('text-terminal-red');
    expect(getSeverityColor('warning')).toBe('text-terminal-amber');
    expect(getSeverityColor('info')).toBe('text-terminal-green');
  });
});
