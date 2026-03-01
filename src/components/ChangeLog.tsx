import React from 'react';
import { ChangeRecord } from '@/lib/self-reference';
import { getSeverityColor } from '@/lib/safety-engine';
import { History, RotateCcw, Clock } from 'lucide-react';
import { SELF_SOURCE } from '@/lib/self-source';

interface ChangeLogProps {
  changes: ChangeRecord[];
  onRollback: (changeId: string) => void;
}

const ChangeLog: React.FC<ChangeLogProps> = ({ changes, onRollback }) => {
  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <History className="w-5 h-5 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground/50">No changes recorded yet</p>
        <p className="text-[10px] text-muted-foreground/30 mt-1">
          Edit a file to see the change history
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      <div className="px-2 py-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Change History
        </span>
      </div>
      {changes.map((change) => (
        <div
          key={change.id}
          className={`border rounded p-2.5 text-xs animate-fade-in ${
            change.rolledBack
              ? 'border-muted bg-muted/10 opacity-50'
              : 'border-border bg-card/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-foreground/70 font-medium truncate">
              {change.file.split('/').pop()}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Clock className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] text-muted-foreground/50">
                {new Date(change.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          {/* Safety summary */}
          <div className="flex flex-wrap gap-1 mb-2">
            {change.safetyChecks.map((check) => (
              <span
                key={check.id}
                className={`text-[9px] px-1.5 py-0.5 rounded ${getSeverityColor(check.severity)} bg-muted/30`}
              >
                {check.severity === 'error' ? '✗' : check.severity === 'warning' ? '⚠' : '✓'}{' '}
                {check.type}
              </span>
            ))}
          </div>

          {/* Rollback */}
          {change.applied && !change.rolledBack && (
            <button
              onClick={() => onRollback(change.id)}
              className="text-[10px] text-terminal-amber hover:text-terminal-amber/80 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Rollback
            </button>
          )}
          {change.rolledBack && (
            <span className="text-[10px] text-muted-foreground/40 italic">Rolled back</span>
          )}
        </div>
      ))}
    </div>
  );
};

export function rollbackChange(change: ChangeRecord): boolean {
  const idx = SELF_SOURCE.findIndex(f => f.path === change.file);
  if (idx === -1) return false;
  
  SELF_SOURCE[idx] = {
    ...SELF_SOURCE[idx],
    content: change.previousContent,
    isModified: false,
    lastModified: Date.now(),
  };
  
  return true;
}

export default ChangeLog;
