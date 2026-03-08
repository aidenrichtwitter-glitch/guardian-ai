import React, { useEffect, useState } from 'react';
import { loadJournal, JournalEntry } from '@/lib/cloud-memory';
import { ScrollText, Target, Zap, Star, Rocket, Brain, Clock, RefreshCw } from 'lucide-react';

const eventIcons: Record<string, React.ReactNode> = {
  goal_completed: <Target className="w-3.5 h-3.5 text-terminal-green" />,
  goal_dreamed: <Brain className="w-3.5 h-3.5 text-purple-400" />,
  capability_acquired: <Zap className="w-3.5 h-3.5 text-primary" />,
  evolution_level_up: <Star className="w-3.5 h-3.5 text-terminal-amber" />,
  milestone: <Rocket className="w-3.5 h-3.5 text-primary" />,
  system_boot: <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />,
  rate_limit_survived: <Clock className="w-3.5 h-3.5 text-terminal-amber" />,
};

const eventColors: Record<string, string> = {
  goal_completed: 'border-terminal-green/30 bg-terminal-green/5',
  goal_dreamed: 'border-purple-500/30 bg-purple-500/5',
  capability_acquired: 'border-primary/30 bg-primary/5',
  evolution_level_up: 'border-terminal-amber/30 bg-terminal-amber/5',
  milestone: 'border-primary/30 bg-primary/5',
  system_boot: 'border-border bg-card/30',
  rate_limit_survived: 'border-terminal-amber/20 bg-card/30',
};

interface EvolutionJournalProps {
  refreshTrigger?: number;
}

const EvolutionJournal: React.FC<EvolutionJournalProps> = ({ refreshTrigger }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJournal(100).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-4 h-4 text-muted-foreground/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border bg-secondary/20 shrink-0">
        <div className="flex items-center gap-2">
          <ScrollText className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
            Evolution Journal
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground/50 mt-0.5">
          Persistent memory across sessions — {entries.length} events recorded
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <ScrollText className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/40">
              No journal entries yet — the system will start recording as it evolves.
            </p>
          </div>
        ) : (
          <div className="relative px-3 py-2">
            {/* Timeline line */}
            <div className="absolute left-[22px] top-4 bottom-4 w-px bg-border" />

            <div className="space-y-1">
              {entries.map((entry, i) => (
                <div key={entry.id} className="relative flex gap-2.5 group">
                  {/* Timeline dot */}
                  <div className="relative z-10 mt-1.5 shrink-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                      eventColors[entry.event_type] || 'border-border bg-card'
                    }`}>
                      {eventIcons[entry.event_type] || <Zap className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`flex-1 rounded-md border p-2 mb-1 transition-colors ${
                    eventColors[entry.event_type] || 'border-border bg-card/30'
                  } group-hover:bg-card/60`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-medium text-foreground/90">
                        {entry.title}
                      </span>
                      <span className="text-[8px] text-muted-foreground/40 shrink-0 tabular-nums">
                        {formatJournalTime(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-relaxed">
                      {entry.description}
                    </p>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && entry.event_type !== 'system_boot' && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(entry.metadata).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="text-[8px] px-1 py-0.5 rounded bg-muted/30 text-muted-foreground/50">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function formatJournalTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default EvolutionJournal;
