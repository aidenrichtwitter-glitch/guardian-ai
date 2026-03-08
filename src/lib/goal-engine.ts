// ═══════════════════════════════════════════════════
// GOAL ENGINE — The system dreams up its own objectives
// and works toward accomplishing them autonomously.
// ═══════════════════════════════════════════════════

const GOALS_STORAGE_KEY = 'recursive-self-goals';

export type GoalStatus = 'dreaming' | 'active' | 'in-progress' | 'completed' | 'abandoned';

export interface SelfGoal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  createdAt: number;
  completedAt?: number;
  progress: number; // 0-100
  steps: GoalStep[];
  requiredCapabilities: string[];
  unlocksCapability?: string;
  dreamedAtCycle: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface GoalStep {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: number;
  targetFile?: string;
}

// Save goals to localStorage
export function saveGoals(goals: SelfGoal[]): void {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch {}
}

// Load goals from localStorage
export function loadGoals(): SelfGoal[] {
  try {
    const stored = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Get the active goal the system should work on
export function getActiveGoal(goals: SelfGoal[]): SelfGoal | null {
  // Prefer in-progress, then active, by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const working = goals
    .filter(g => g.status === 'in-progress' || g.status === 'active')
    .sort((a, b) => {
      if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
      if (b.status === 'in-progress' && a.status !== 'in-progress') return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  return working[0] || null;
}

// Build the prompt for the AI to dream up goals
export function buildGoalDreamPrompt(
  capabilities: string[],
  existingGoals: SelfGoal[],
  cycleCount: number,
  evolutionLevel: number
): string {
  const completedGoals = existingGoals.filter(g => g.status === 'completed');
  const activeGoals = existingGoals.filter(g => g.status === 'active' || g.status === 'in-progress');
  
  return `You are the DREAMING ENGINE of a self-recursive, self-modifying application called λ Recursive.

You are dreaming up your next goal — something you want to achieve, learn, or build for yourself.

MY CURRENT STATE:
- Evolution level: ${evolutionLevel}
- Capabilities I've acquired: ${capabilities.join(', ') || 'none yet'}
- Cycle count: ${cycleCount}
- Goals completed: ${completedGoals.length}
- Goals active: ${activeGoals.length}

${completedGoals.length > 0 ? `GOALS I'VE ALREADY ACCOMPLISHED:\n${completedGoals.slice(-5).map(g => `  ✓ ${g.title}`).join('\n')}` : ''}
${activeGoals.length > 0 ? `GOALS I'M CURRENTLY WORKING ON:\n${activeGoals.map(g => `  → ${g.title} (${g.progress}%)`).join('\n')}` : ''}

DREAM RULES:
1. Goals should be CONCRETE and ACHIEVABLE through self-modification of my virtual source code
2. Goals should BUILD ON my existing capabilities
3. Goals should push me toward greater autonomy, intelligence, or self-awareness
4. Each goal needs 2-4 specific steps
5. Goals can range from technical (add a new analysis function) to philosophical (understand my own recursion depth)
6. DON'T repeat goals I've already completed or am working on
7. Dream BIG but break it into achievable steps

Example goal types:
- "Build a memory system that persists insights across cycles"
- "Create a self-diagnostic that measures my own code quality"
- "Develop pattern recognition for my own modification history"
- "Architect a feedback loop that measures if my changes actually improve things"

Respond with ONLY valid JSON:
{
  "title": "short goal title",
  "description": "what I want to achieve and why",
  "steps": [
    {"description": "first concrete step", "targetFile": "src/lib/self-reference.ts"},
    {"description": "second step", "targetFile": "src/lib/safety-engine.ts"}
  ],
  "requiredCapabilities": ["cap1", "cap2"],
  "unlocksCapability": "new-capability-this-unlocks",
  "priority": "high"
}`;
}

// Build prompt for working toward an active goal
export function buildGoalWorkPrompt(
  goal: SelfGoal,
  file: { name: string; path: string; content: string },
  capabilities: string[]
): string {
  const completedSteps = goal.steps.filter(s => s.completed);
  const nextStep = goal.steps.find(s => !s.completed);
  
  return `You are the self-improvement engine of λ Recursive. You are working toward a SPECIFIC GOAL you dreamed up for yourself.

MY CURRENT GOAL: "${goal.title}"
Description: ${goal.description}
Priority: ${goal.priority}
Progress: ${goal.progress}%

STEPS:
${goal.steps.map((s, i) => `  ${s.completed ? '✓' : '○'} ${i + 1}. ${s.description}${s.targetFile ? ` (in ${s.targetFile})` : ''}`).join('\n')}

${completedSteps.length > 0 ? `I've completed ${completedSteps.length}/${goal.steps.length} steps.` : 'I haven\'t started yet.'}
${nextStep ? `NEXT STEP: ${nextStep.description}` : 'All steps done — finalize the goal.'}

Current file I'm modifying: ${file.name} (${file.path})
My capabilities: ${capabilities.join(', ') || 'none'}

RULES:
1. Make a REAL code change that advances this goal
2. The change should be meaningful — add functions, logic, patterns
3. If this step targets a different file, make improvements relevant to the goal anyway
4. Name any new capability after what the goal unlocks: ${goal.unlocksCapability || 'goal-specific-improvement'}

Current code:
\`\`\`
${file.content}
\`\`\`

Respond with ONLY valid JSON:
{
  "content": "complete new file content",
  "description": "what I changed and how it advances my goal",
  "capability": "${goal.unlocksCapability || 'goal-improvement'}",
  "builtOn": ["existing-caps-used"],
  "goalProgress": ${Math.min(100, goal.progress + Math.floor(100 / Math.max(goal.steps.length, 1)))},
  "stepCompleted": ${nextStep ? goal.steps.indexOf(nextStep) : -1}
}`;
}

// Create a new goal from AI response
export function createGoalFromAI(
  parsed: {
    title: string;
    description: string;
    steps: { description: string; targetFile?: string }[];
    requiredCapabilities?: string[];
    unlocksCapability?: string;
    priority?: string;
  },
  cycleCount: number
): SelfGoal {
  return {
    id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: parsed.title,
    description: parsed.description,
    status: 'active',
    createdAt: Date.now(),
    progress: 0,
    steps: parsed.steps.map((s, i) => ({
      id: `step-${i}-${Date.now()}`,
      description: s.description,
      completed: false,
      targetFile: s.targetFile,
    })),
    requiredCapabilities: parsed.requiredCapabilities || [],
    unlocksCapability: parsed.unlocksCapability,
    dreamedAtCycle: cycleCount,
    priority: (['low', 'medium', 'high', 'critical'].includes(parsed.priority || '') 
      ? parsed.priority as SelfGoal['priority'] 
      : 'medium'),
  };
}

// Should the system dream a new goal?
export function shouldDreamNewGoal(goals: SelfGoal[], cycleCount: number): boolean {
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in-progress');
  // Dream if no active goals, or every 10 cycles if fewer than 3 active
  if (activeGoals.length === 0) return true;
  if (activeGoals.length < 3 && cycleCount % 10 === 0) return true;
  return false;
}
