import React from 'react';
import { Sparkles, GitBranch, Zap } from 'lucide-react';
import { CapabilityRecord } from '@/lib/recursion-engine';

interface CapabilityTimelineProps {
  capabilities: string[];
  history: CapabilityRecord[];
  evolutionLevel: number;
}

const EVOLUTION_TITLES: Record<number, string> = {
  1: 'Nascent',
  2: 'Aware',
  3: 'Adaptive',
  4: 'Intelligent',
  5: 'Transcendent',
  6: 'Omniscient',
};

const CapabilityTimeline: React.FC<CapabilityTimelineProps> = ({ capabilities, history, evolutionLevel }) => {
  const title = EVOLUTION_TITLES[evolutionLevel] || `Level ${evolutionLevel}`;
  const nextThreshold = evolutionLevel * 3;
  const progress = capabilities.length / nextThreshold;

  return (
    <div className="flex flex-col h-full">
      {/* Evolution header */}
      <div className="px-3 py-2 border-b border-border bg-primary/5 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
              {title}
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground">
            Level {evolutionLevel} · {capabilities.length} abilities
          </span>
        </div>

        {/* Evolution progress bar */}
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground/50">
            <span>{capabilities.length} capabilities</span>
            <span>Next level: {nextThreshold}</span>
          </div>
        </div>
      </div>

      {/* Capability list with ancestry */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {history.length === 0 && (
          <div className="text-[10px] text-muted-foreground/50 text-center py-4">
            No capabilities yet — evolution beginning...
          </div>
        )}
        {history.map((cap, i) => (
          <div
            key={cap.name + i}
            className="px-2 py-1.5 rounded-sm bg-card/50 border border-border/50 hover:border-primary/30 transition-colors animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[10px] font-semibold text-foreground/90">
                  {cap.name}
                </span>
              </div>
              <span className="text-[8px] text-muted-foreground/40">
                cycle {cap.acquiredCycle}
              </span>
            </div>
            {cap.description && (
              <p className="text-[9px] text-muted-foreground/70 mt-0.5 ml-4.5 line-clamp-2">
                {cap.description}
              </p>
            )}
            {cap.builtOn.length > 0 && (
              <div className="flex items-center gap-1 mt-1 ml-4.5">
                <GitBranch className="w-2.5 h-2.5 text-primary/40" />
                <span className="text-[8px] text-primary/50">
                  built on: {cap.builtOn.join(' + ')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active capabilities grid */}
      {capabilities.length > 0 && (
        <div className="px-2 py-2 border-t border-border shrink-0">
          <div className="text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-1">
            Active abilities
          </div>
          <div className="flex flex-wrap gap-1">
            {capabilities.map((cap) => (
              <span
                key={cap}
                className="text-[7px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CapabilityTimeline;
