import React from 'react';
import { SelfGoal } from '@/lib/goal-engine';
import { Target, CheckCircle2, Circle, Flame, Sparkles, Clock } from 'lucide-react';

interface GoalsPanelProps {
  goals: SelfGoal[];
  currentGoalId?: string | null;
}

const priorityColors: Record<string, string> = {
  critical: 'text-terminal-red',
  high: 'text-terminal-amber',
  medium: 'text-primary',
  low: 'text-muted-foreground',
};

const priorityIcons: Record<string, string> = {
  critical: '🔥',
  high: '⚡',
  medium: '◈',
  low: '○',
};

const statusColors: Record<string, string> = {
  dreaming: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  active: 'bg-primary/10 text-primary border-primary/30',
  'in-progress': 'bg-terminal-amber/10 text-terminal-amber border-terminal-amber/30',
  completed: 'bg-terminal-green/10 text-terminal-green border-terminal-green/30',
  abandoned: 'bg-muted text-muted-foreground border-border',
};

const GoalsPanel: React.FC<GoalsPanelProps> = ({ goals, currentGoalId }) => {
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in-progress');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const dreamingGoals = goals.filter(g => g.status === 'dreaming');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-secondary/20 shrink-0">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
            Self-Directed Goals
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-terminal-amber" /> Active: {activeGoals.length}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-terminal-green" /> Done: {completedGoals.length}
          </span>
          {dreamingGoals.length > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" /> Dreaming: {dreamingGoals.length}
            </span>
          )}
        </div>
      </div>

      {/* Goals list */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {goals.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/50">
              No goals yet — the system will dream one up soon...
            </p>
          </div>
        )}

        {/* Active/In-progress goals first */}
        {activeGoals.map(goal => (
          <GoalCard key={goal.id} goal={goal} isCurrent={goal.id === currentGoalId} />
        ))}

        {/* Completed goals */}
        {completedGoals.map(goal => (
          <GoalCard key={goal.id} goal={goal} isCurrent={false} />
        ))}
      </div>
    </div>
  );
};

const GoalCard: React.FC<{ goal: SelfGoal; isCurrent: boolean }> = ({ goal, isCurrent }) => {
  const timeAgo = getTimeAgo(goal.createdAt);
  
  return (
    <div className={`rounded-md border p-2 transition-all ${
      isCurrent 
        ? 'border-primary/40 bg-primary/5 shadow-sm shadow-primary/10' 
        : 'border-border bg-card/30 hover:bg-card/50'
    }`}>
      {/* Title row */}
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] mt-0.5 shrink-0">{priorityIcons[goal.priority]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-medium ${
              goal.status === 'completed' ? 'text-terminal-green line-through opacity-70' : 'text-foreground'
            }`}>
              {goal.title}
            </span>
            {isCurrent && (
              <span className="text-[8px] px-1 py-0 rounded bg-primary/20 text-primary animate-pulse">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-0.5 line-clamp-2">
            {goal.description}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {goal.status !== 'completed' && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary/60 rounded-full transition-all duration-500"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
          <span className="text-[8px] text-muted-foreground tabular-nums">
            {goal.progress}%
          </span>
        </div>
      )}

      {/* Steps */}
      <div className="mt-1.5 space-y-0.5">
        {goal.steps.map(step => (
          <div key={step.id} className="flex items-start gap-1">
            {step.completed ? (
              <CheckCircle2 className="w-2.5 h-2.5 text-terminal-green shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
            )}
            <span className={`text-[9px] ${
              step.completed ? 'text-terminal-green/60 line-through' : 'text-muted-foreground/70'
            }`}>
              {step.description}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-[8px] px-1.5 py-0.5 rounded border ${statusColors[goal.status]}`}>
          {goal.status}
        </span>
        <span className="text-[8px] text-muted-foreground/40 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" /> {timeAgo}
        </span>
      </div>
    </div>
  );
};

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default GoalsPanel;
