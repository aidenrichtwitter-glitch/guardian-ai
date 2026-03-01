import React, { useState, useCallback } from 'react';
import { getFileByPath, SELF_SOURCE } from '@/lib/self-source';
import { validateChange, getSeverityColor } from '@/lib/safety-engine';
import { ChangeRecord, SafetyCheck } from '@/lib/self-reference';
import { Shield, AlertTriangle, CheckCircle, RotateCcw, Save } from 'lucide-react';

interface CodeViewerProps {
  filePath: string | null;
  onChangeApplied?: (record: ChangeRecord) => void;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ filePath, onChangeApplied }) => {
  const file = filePath ? getFileByPath(filePath) : null;
  const [editContent, setEditContent] = useState<string | null>(null);
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheck[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const content = editContent ?? file?.content ?? '';

  const handleEdit = useCallback(() => {
    if (file) {
      setEditContent(file.content);
      setIsEditing(true);
      setSafetyChecks([]);
    }
  }, [file]);

  const handleValidate = useCallback(() => {
    if (editContent && filePath) {
      const checks = validateChange(editContent, filePath);
      setSafetyChecks(checks);
    }
  }, [editContent, filePath]);

  const handleSave = useCallback(() => {
    if (!file || !editContent || !filePath) return;
    
    const hasErrors = safetyChecks.some(c => c.severity === 'error');
    if (hasErrors) return;

    const record: ChangeRecord = {
      id: `change-${Date.now()}`,
      timestamp: Date.now(),
      file: filePath,
      previousContent: file.content,
      newContent: editContent,
      description: 'Manual edit',
      safetyChecks,
      applied: true,
      rolledBack: false,
    };

    // Update the virtual file
    const idx = SELF_SOURCE.findIndex(f => f.path === filePath);
    if (idx !== -1) {
      SELF_SOURCE[idx] = { ...SELF_SOURCE[idx], content: editContent, isModified: true, lastModified: Date.now() };
    }

    setIsEditing(false);
    setEditContent(null);
    setSafetyChecks([]);
    onChangeApplied?.(record);
  }, [file, editContent, filePath, safetyChecks, onChangeApplied]);

  const handleDiscard = useCallback(() => {
    setIsEditing(false);
    setEditContent(null);
    setSafetyChecks([]);
  }, []);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center animate-fade-in">
          <div className="text-4xl mb-3 text-glow">λ</div>
          <p className="text-sm text-muted-foreground">Select a file to view</p>
          <p className="text-xs text-muted-foreground/60 mt-1">I am the editor that edits itself</p>
        </div>
      </div>
    );
  }

  const lines = content.split('\n');
  const hasErrors = safetyChecks.some(c => c.severity === 'error');
  const hasWarnings = safetyChecks.some(c => c.severity === 'warning');

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/60">{file.path}</span>
          {file.isModified && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-amber/10 text-terminal-amber">
              modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isEditing ? (
            <button
              onClick={handleEdit}
              className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleValidate}
                className="text-[10px] px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors flex items-center gap-1"
              >
                <Shield className="w-3 h-3" /> Validate
              </button>
              <button
                onClick={handleSave}
                disabled={hasErrors || safetyChecks.length === 0}
                className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Save className="w-3 h-3" /> Apply
              </button>
              <button
                onClick={handleDiscard}
                className="text-[10px] px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Discard
              </button>
            </>
          )}
        </div>
      </div>

      {/* Safety checks panel */}
      {safetyChecks.length > 0 && (
        <div className="border-b border-border bg-card/50 px-3 py-2 animate-fade-in">
          <div className="flex items-center gap-2 mb-1.5">
            {hasErrors ? (
              <AlertTriangle className="w-3.5 h-3.5 text-terminal-red" />
            ) : hasWarnings ? (
              <AlertTriangle className="w-3.5 h-3.5 text-terminal-amber" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5 text-terminal-green" />
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Safety Analysis
            </span>
          </div>
          {safetyChecks.map((check) => (
            <div key={check.id} className="flex items-start gap-2 text-[11px] py-0.5">
              <span className={`${getSeverityColor(check.severity)} shrink-0 mt-0.5`}>
                {check.severity === 'error' ? '✗' : check.severity === 'warning' ? '⚠' : '✓'}
              </span>
              <span className={getSeverityColor(check.severity)}>{check.message}</span>
              {check.line && (
                <span className="text-muted-foreground ml-auto shrink-0">L{check.line}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Code content */}
      <div className="flex-1 overflow-auto relative">
        {/* Scanline overlay */}
        <div className="absolute inset-0 scanline z-10" />
        
        {isEditing ? (
          <textarea
            value={editContent ?? ''}
            onChange={(e) => { setEditContent(e.target.value); setSafetyChecks([]); }}
            className="w-full h-full bg-transparent text-foreground font-mono text-xs p-4 resize-none focus:outline-none leading-relaxed"
            spellCheck={false}
          />
        ) : (
          <pre className="p-4 text-xs leading-relaxed">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-muted/20 transition-colors">
                <span className="w-8 shrink-0 text-right pr-3 text-muted-foreground/40 select-none text-[10px]">
                  {i + 1}
                </span>
                <code className="text-foreground/90 whitespace-pre-wrap break-all">
                  {highlightSyntax(line)}
                </code>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
};

// Basic syntax highlighting
function highlightSyntax(line: string): React.ReactNode {
  // Comments
  if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/*')) {
    return <span className="text-muted-foreground/60 italic">{line}</span>;
  }

  // Keywords
  const parts = line.split(/(\b(?:import|export|from|const|let|var|function|return|if|else|interface|type|async|await|new|class|extends|implements|default)\b|'[^']*'|"[^"]*"|`[^`]*`|\/\/.*$)/g);

  return parts.map((part, i) => {
    if (/^(import|export|from|const|let|var|function|return|if|else|interface|type|async|await|new|class|extends|implements|default)$/.test(part)) {
      return <span key={i} className="text-terminal-cyan">{part}</span>;
    }
    if (/^['"`]/.test(part)) {
      return <span key={i} className="text-terminal-amber">{part}</span>;
    }
    if (part.startsWith('//')) {
      return <span key={i} className="text-muted-foreground/50 italic">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default CodeViewer;
