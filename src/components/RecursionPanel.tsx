import React, { useEffect, useRef } from 'react';
import { RecursionLogEntry } from '@/lib/recursion-engine';
import { Shield, Activity, Zap, Pause, Play, Gauge, Sparkles } from 'lucide-react';
import { RecursionState } from '@/lib/recursion-engine';

interface RecursionPanelProps {
  state: RecursionState;
  onToggleRunning: () => void;
  onSetSpeed: (speed: 'slow' | 'normal' | 'fast') => void;
}

const phaseColors: Record<string, string> = {
  idle: 'text-muted-foreground',
  scanning: 'text-terminal-cyan',
  reflecting: 'text-foreground',
  proposing: 'text-terminal-amber',
  validating: 'text-primary',
  applying: 'text-terminal-green',
  cooling: 'text-muted-foreground',
  paused: 'text-terminal-amber',
};

const phaseIcons: Record<string, string> = {
  idle: '○',
  scanning: '◎',
  reflecting: '◉',
  proposing: '◈',
  validating: '◇',
  applying: '●',
  cooling: '◌',
  paused: '‖',
};

const severityStyles: Record<string, string> = {
  info: 'text-muted-foreground',
  action: 'text-terminal-cyan',
  warning: 'text-terminal-amber',
  error: 'text-terminal-red',
  success: 'text-terminal-green',
};

const RecursionPanel: React.FC<RecursionPanelProps> = ({ state, onToggleRunning, onSetSpeed }) => {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.log.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Status header */}
      <div className="px-3 py-2 border-b border-border bg-secondary/20 space-y-2 shrink-0">
        {/* Phase indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${phaseColors[state.phase]} ${state.isRunning ? 'animate-pulse' : ''}`}>
              {phaseIcons[state.phase]}
            </span>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${phaseColors[state.phase]}`}>
              {state.phase}
            </span>
          </div>
          <button
            onClick={onToggleRunning}
            className={`p-1.5 rounded transition-colors ${
              state.isRunning 
                ? 'bg-terminal-amber/10 text-terminal-amber hover:bg-terminal-amber/20' 
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            title={state.isRunning ? 'Pause recursion' : 'Resume recursion'}
          >
            {state.isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" /> Cycles: {state.cycleCount}
          </span>
          <span className="flex items-center gap-1 text-terminal-green">
            <Zap className="w-3 h-3" /> Applied: {state.totalChanges}
          </span>
          <span className="flex items-center gap-1 text-terminal-red">
            <Shield className="w-3 h-3" /> Rejected: {state.totalRejected}
          </span>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3 h-3 text-muted-foreground" />
          {(['slow', 'normal', 'fast'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
                state.speed === s
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Acquired capabilities */}
        {state.capabilities.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Self-given abilities</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {state.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[8px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current action */}
      <div className="px-3 py-1.5 border-b border-border bg-card/30 shrink-0">
        <p className="text-[10px] text-foreground/70 truncate">
          <span className="text-primary mr-1">λ</span>
          {state.lastAction}
        </p>
      </div>

      {/* Log stream */}
      <div ref={logRef} className="flex-1 overflow-auto p-2 space-y-0.5">
        {state.log.map((entry) => (
          <LogEntry key={entry.id} entry={entry} />
        ))}
        {state.isRunning && (
          <div className="flex items-center gap-1.5 py-0.5 px-1 text-[10px] text-primary animate-pulse">
            <span>▊</span>
          </div>
        )}
      </div>
    </div>
  );
};

const LogEntry: React.FC<{ entry: RecursionLogEntry }> = ({ entry }) => {
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex gap-1.5 py-0.5 px-1 text-[10px] leading-relaxed animate-fade-in hover:bg-muted/20 rounded-sm transition-colors">
      <span className="text-muted-foreground/40 shrink-0 tabular-nums">{time}</span>
      <span className={`shrink-0 ${phaseColors[entry.phase]}`}>
        {phaseIcons[entry.phase]}
      </span>
      <span className={severityStyles[entry.severity]}>
        {entry.message}
      </span>
    </div>
  );
};

export default RecursionPanel;
