import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardPaste, Shield, Check, AlertTriangle, Undo2, FileCode, ExternalLink, Sparkles, Copy } from 'lucide-react';
import { validateChange } from '@/lib/safety-engine';
import { SELF_SOURCE } from '@/lib/self-source';
import { SafetyCheck } from '@/lib/self-reference';

interface ParsedBlock {
  filePath: string;
  code: string;
  language: string;
}

interface AppliedChange {
  filePath: string;
  previousContent: string;
  newContent: string;
  timestamp: number;
}

function parseCodeBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  // Match ```lang\n...``` with optional file path in comments or preceding line
  const regex = /(?:(?:\/\/|#|<!--)\s*(?:file:\s*)?(\S+\.(?:tsx?|jsx?|css|html|json|md))\s*(?:-->)?\s*\n)?```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const filePath = match[1] || '';
    const language = match[2] || 'typescript';
    const code = match[3].trim();
    if (code.length > 0) {
      blocks.push({ filePath, code, language });
    }
  }

  // If no fenced blocks found, try to detect raw code
  if (blocks.length === 0 && text.trim().length > 20) {
    const trimmed = text.trim();
    const looksLikeCode = /^(import |export |const |function |class |interface |type |<|\/\/)/.test(trimmed);
    if (looksLikeCode) {
      blocks.push({ filePath: '', code: trimmed, language: 'typescript' });
    }
  }

  return blocks;
}

const GrokBridge: React.FC = () => {
  const [pastedText, setPastedText] = useState('');
  const [parsedBlocks, setParsedBlocks] = useState<ParsedBlock[]>([]);
  const [validationResults, setValidationResults] = useState<Map<number, SafetyCheck[]>>(new Map());
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Map<number, string>>(new Map());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handlePaste = useCallback((text: string) => {
    setPastedText(text);
    const blocks = parseCodeBlocks(text);
    setParsedBlocks(blocks);
    setValidationResults(new Map());
    setStatusMessage(blocks.length > 0 ? `Found ${blocks.length} code block(s)` : 'No code blocks detected — paste AI output with fenced code blocks');

    // Auto-set targets from parsed file paths
    const targets = new Map<number, string>();
    blocks.forEach((b, i) => {
      if (b.filePath) targets.set(i, b.filePath);
    });
    setSelectedTargets(targets);
  }, []);

  const runValidation = useCallback((index: number) => {
    const block = parsedBlocks[index];
    const target = selectedTargets.get(index) || 'unknown.ts';
    const checks = validateChange(block.code, target);
    setValidationResults(prev => new Map(prev).set(index, checks));
  }, [parsedBlocks, selectedTargets]);

  const applyBlock = useCallback((index: number) => {
    const block = parsedBlocks[index];
    const targetPath = selectedTargets.get(index);
    if (!targetPath) {
      setStatusMessage('⚠ Select a target file before applying');
      return;
    }

    const existing = SELF_SOURCE.find(f => f.path === targetPath);
    const previousContent = existing?.content || '';

    // Apply to virtual file system
    if (existing) {
      existing.content = block.code;
      existing.isModified = true;
      existing.lastModified = Date.now();
    } else {
      const name = targetPath.split('/').pop() || targetPath;
      const ext = name.split('.').pop() || 'ts';
      const langMap: Record<string, string> = { ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact', css: 'css', json: 'json', md: 'markdown' };
      SELF_SOURCE.push({
        name,
        path: targetPath,
        content: block.code,
        language: langMap[ext] || 'plaintext',
        isModified: true,
        lastModified: Date.now(),
      });
    }

    setAppliedChanges(prev => [...prev, { filePath: targetPath, previousContent, newContent: block.code, timestamp: Date.now() }]);
    setStatusMessage(`✓ Applied to ${targetPath}`);
  }, [parsedBlocks, selectedTargets]);

  const rollback = useCallback((change: AppliedChange) => {
    const file = SELF_SOURCE.find(f => f.path === change.filePath);
    if (file) {
      file.content = change.previousContent;
      file.isModified = true;
      file.lastModified = Date.now();
    }
    setAppliedChanges(prev => prev.filter(c => c !== change));
    setStatusMessage(`↩ Rolled back ${change.filePath}`);
  }, []);

  const virtualFiles = SELF_SOURCE.map(f => f.path).sort();

  const contextPrompt = `I'm working on a self-recursive IDE called λ Recursive. Here are the virtual files:\n${virtualFiles.slice(0, 30).join('\n')}\n\nPlease provide code changes as fenced code blocks with file paths like:\n// file: src/lib/example.ts\n\`\`\`typescript\n// code here\n\`\`\``;

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[hsl(var(--terminal-amber))]" />
              <h1 className="text-lg font-bold font-display text-foreground">AI Bridge</h1>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 border border-border/50 px-2 py-0.5 rounded">paste → validate → apply</span>
          </div>
          <a
            href="https://grok.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-xs"
          >
            <ExternalLink className="w-3 h-3" />
            Open Grok
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-[hsl(var(--terminal-amber))]">
              <span className="text-lg font-bold">1</span>
              <ExternalLink className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground">Open Grok (or any AI) in a new tab. Copy the context prompt below to give it info about your codebase.</p>
          </div>
          <div className="bg-card border border-border/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-[hsl(var(--terminal-cyan))]">
              <span className="text-lg font-bold">2</span>
              <ClipboardPaste className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground">Ask it to generate code changes. Copy the response and paste it here — code blocks are auto-detected.</p>
          </div>
          <div className="bg-card border border-border/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <span className="text-lg font-bold">3</span>
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground">Validate each block with the safety engine, pick a target file, and apply. Rollback anytime.</p>
          </div>
        </div>

        {/* Context prompt copier */}
        <div className="bg-card border border-border/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Context prompt — copy this to Grok</span>
            <button
              onClick={() => { navigator.clipboard.writeText(contextPrompt); setStatusMessage('Copied context prompt!'); }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-[10px]"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="text-[10px] text-muted-foreground/60 max-h-24 overflow-auto whitespace-pre-wrap">{contextPrompt}</pre>
        </div>

        {/* Paste area */}
        <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border/30 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Paste AI response</span>
            {statusMessage && (
              <span className="text-[11px] text-[hsl(var(--terminal-amber))] animate-fade-in">{statusMessage}</span>
            )}
          </div>
          <textarea
            value={pastedText}
            onChange={e => handlePaste(e.target.value)}
            onPaste={e => { e.preventDefault(); handlePaste(e.clipboardData.getData('text')); }}
            placeholder="Paste the AI's response here... Code blocks (```...```) will be auto-detected."
            className="w-full h-40 bg-background/50 text-xs text-foreground/80 p-4 resize-y focus:outline-none placeholder:text-muted-foreground/25 font-mono"
          />
        </div>

        {/* Parsed blocks */}
        {parsedBlocks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5" />
              Detected Code Blocks ({parsedBlocks.length})
            </h2>

            {parsedBlocks.map((block, i) => {
              const checks = validationResults.get(i);
              const hasErrors = checks?.some(c => c.severity === 'error');
              const allPassed = checks && !hasErrors;
              const isApplied = appliedChanges.some(c => c.newContent === block.code);

              return (
                <div key={i} className="bg-card border border-border/50 rounded-lg overflow-hidden">
                  {/* Block header */}
                  <div className="px-4 py-2 border-b border-border/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-[hsl(var(--terminal-amber))]">#{i + 1}</span>
                      <span className="text-[10px] text-muted-foreground/50">{block.language}</span>
                      <select
                        value={selectedTargets.get(i) || ''}
                        onChange={e => setSelectedTargets(prev => new Map(prev).set(i, e.target.value))}
                        className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 rounded border border-border/50 flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        <option value="">Select target file...</option>
                        <option value="__new__">+ New file...</option>
                        {virtualFiles.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      {selectedTargets.get(i) === '__new__' && (
                        <input
                          placeholder="src/lib/new-file.ts"
                          onChange={e => setSelectedTargets(prev => new Map(prev).set(i, e.target.value))}
                          className="bg-background text-xs text-foreground px-2 py-1 rounded border border-border/50 w-48 focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => runValidation(i)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[hsl(var(--terminal-cyan))]/10 text-[hsl(var(--terminal-cyan))] hover:bg-[hsl(var(--terminal-cyan))]/20 text-[10px] transition-colors"
                      >
                        <Shield className="w-3 h-3" /> Validate
                      </button>
                      <button
                        onClick={() => applyBlock(i)}
                        disabled={!selectedTargets.get(i) || selectedTargets.get(i) === '__new__' || isApplied}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[10px] transition-colors disabled:opacity-30"
                      >
                        <Check className="w-3 h-3" /> {isApplied ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                  </div>

                  {/* Code preview */}
                  <pre className="p-4 text-[11px] text-foreground/70 max-h-60 overflow-auto whitespace-pre-wrap leading-relaxed">
                    {block.code}
                  </pre>

                  {/* Validation results */}
                  {checks && (
                    <div className="px-4 py-2 border-t border-border/30 space-y-1">
                      {checks.map((check, j) => (
                        <div key={j} className="flex items-center gap-2 text-[10px]">
                          {check.severity === 'error' ? (
                            <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                          ) : check.severity === 'warning' ? (
                            <AlertTriangle className="w-3 h-3 text-[hsl(var(--terminal-amber))] shrink-0" />
                          ) : (
                            <Check className="w-3 h-3 text-primary shrink-0" />
                          )}
                          <span className={
                            check.severity === 'error' ? 'text-destructive' :
                            check.severity === 'warning' ? 'text-[hsl(var(--terminal-amber))]' :
                            'text-primary/70'
                          }>{check.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Applied changes / rollback */}
        {appliedChanges.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-primary" />
              Applied Changes ({appliedChanges.length})
            </h2>
            {appliedChanges.map((change, i) => (
              <div key={i} className="bg-card border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-primary font-medium">{change.filePath}</span>
                  <span className="text-muted-foreground/50 ml-2">
                    {new Date(change.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <button
                  onClick={() => rollback(change)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 text-[10px] transition-colors"
                >
                  <Undo2 className="w-3 h-3" /> Rollback
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Benefits footer */}
        <div className="border-t border-border/30 pt-6 pb-12">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-4">Why use AI Bridge?</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Zero API cost', desc: 'Use free web AI tiers' },
              { label: 'Any AI works', desc: 'Grok, ChatGPT, Claude, Gemini' },
              { label: 'Safety validated', desc: 'Every change is checked' },
              { label: 'Instant rollback', desc: 'Undo any applied change' },
            ].map((b, i) => (
              <div key={i} className="bg-card/50 border border-border/30 rounded-lg p-3">
                <p className="text-[11px] font-medium text-foreground/80">{b.label}</p>
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrokBridge;
