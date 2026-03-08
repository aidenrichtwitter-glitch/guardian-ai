// ═══════════════════════════════════════════════════
// TASK DECOMPOSITION ENGINE — Break any task/chore
// into actionable steps WITHOUT AI. Uses templates,
// keyword matching, and deterministic logic.
// ═══════════════════════════════════════════════════

export interface TaskStep {
  order: number;
  action: string;
  estimateMinutes: number;
  category: 'prepare' | 'execute' | 'verify' | 'cleanup';
}

export interface DecomposedTask {
  originalTask: string;
  summary: string;
  steps: TaskStep[];
  totalMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

// Template library — deterministic task patterns
const TASK_TEMPLATES: { keywords: string[]; category: string; steps: Omit<TaskStep, 'order'>[] }[] = [
  {
    keywords: ['clean', 'tidy', 'organize', 'declutter', 'wash'],
    category: 'cleaning',
    steps: [
      { action: 'Gather cleaning supplies and tools', estimateMinutes: 5, category: 'prepare' },
      { action: 'Remove all items that don\'t belong', estimateMinutes: 10, category: 'execute' },
      { action: 'Sort items into keep, donate, and trash piles', estimateMinutes: 15, category: 'execute' },
      { action: 'Wipe down surfaces and clean thoroughly', estimateMinutes: 20, category: 'execute' },
      { action: 'Organize remaining items into logical groups', estimateMinutes: 15, category: 'execute' },
      { action: 'Take out trash and donations', estimateMinutes: 5, category: 'cleanup' },
      { action: 'Do a final walkthrough to verify everything is clean', estimateMinutes: 3, category: 'verify' },
    ],
  },
  {
    keywords: ['cook', 'meal', 'dinner', 'lunch', 'breakfast', 'recipe', 'food', 'bake'],
    category: 'cooking',
    steps: [
      { action: 'Decide on the recipe and check ingredients', estimateMinutes: 5, category: 'prepare' },
      { action: 'Gather all ingredients and tools', estimateMinutes: 10, category: 'prepare' },
      { action: 'Prep ingredients (chop, measure, etc.)', estimateMinutes: 15, category: 'execute' },
      { action: 'Follow cooking steps in order', estimateMinutes: 30, category: 'execute' },
      { action: 'Plate and serve', estimateMinutes: 5, category: 'execute' },
      { action: 'Clean up kitchen and wash dishes', estimateMinutes: 15, category: 'cleanup' },
    ],
  },
  {
    keywords: ['fix', 'repair', 'broken', 'replace', 'install'],
    category: 'repair',
    steps: [
      { action: 'Identify the exact problem and what\'s needed', estimateMinutes: 10, category: 'prepare' },
      { action: 'Research the fix (manual, video, etc.)', estimateMinutes: 15, category: 'prepare' },
      { action: 'Gather tools and replacement parts', estimateMinutes: 10, category: 'prepare' },
      { action: 'Perform the repair step by step', estimateMinutes: 30, category: 'execute' },
      { action: 'Test that the fix works properly', estimateMinutes: 10, category: 'verify' },
      { action: 'Clean up workspace and put tools away', estimateMinutes: 5, category: 'cleanup' },
    ],
  },
  {
    keywords: ['shop', 'buy', 'purchase', 'grocery', 'store', 'order'],
    category: 'shopping',
    steps: [
      { action: 'Make a list of what you need', estimateMinutes: 10, category: 'prepare' },
      { action: 'Check what you already have at home', estimateMinutes: 5, category: 'prepare' },
      { action: 'Compare prices and find best deals', estimateMinutes: 10, category: 'execute' },
      { action: 'Go shopping or place the order', estimateMinutes: 30, category: 'execute' },
      { action: 'Put items away and organize', estimateMinutes: 10, category: 'cleanup' },
    ],
  },
  {
    keywords: ['write', 'draft', 'compose', 'email', 'letter', 'document', 'report'],
    category: 'writing',
    steps: [
      { action: 'Define the purpose and audience', estimateMinutes: 5, category: 'prepare' },
      { action: 'Outline the key points', estimateMinutes: 10, category: 'prepare' },
      { action: 'Write the first draft', estimateMinutes: 20, category: 'execute' },
      { action: 'Review and edit for clarity', estimateMinutes: 10, category: 'verify' },
      { action: 'Proofread for grammar and spelling', estimateMinutes: 5, category: 'verify' },
      { action: 'Send or submit the final version', estimateMinutes: 2, category: 'cleanup' },
    ],
  },
  {
    keywords: ['plan', 'schedule', 'event', 'party', 'meeting', 'trip', 'travel'],
    category: 'planning',
    steps: [
      { action: 'Define the goal, date, and scope', estimateMinutes: 10, category: 'prepare' },
      { action: 'List everything that needs to happen', estimateMinutes: 10, category: 'prepare' },
      { action: 'Assign responsibilities or deadlines', estimateMinutes: 10, category: 'execute' },
      { action: 'Book or reserve what\'s needed', estimateMinutes: 15, category: 'execute' },
      { action: 'Confirm all details with everyone involved', estimateMinutes: 10, category: 'verify' },
      { action: 'Create a day-of checklist', estimateMinutes: 5, category: 'cleanup' },
    ],
  },
  {
    keywords: ['exercise', 'workout', 'run', 'gym', 'fitness', 'stretch'],
    category: 'fitness',
    steps: [
      { action: 'Choose workout type and set a goal', estimateMinutes: 3, category: 'prepare' },
      { action: 'Warm up with light movement', estimateMinutes: 5, category: 'prepare' },
      { action: 'Complete the main workout', estimateMinutes: 30, category: 'execute' },
      { action: 'Cool down and stretch', estimateMinutes: 5, category: 'execute' },
      { action: 'Hydrate and log your session', estimateMinutes: 2, category: 'cleanup' },
    ],
  },
  {
    keywords: ['study', 'learn', 'research', 'read', 'course', 'exam'],
    category: 'learning',
    steps: [
      { action: 'Define what you want to learn and why', estimateMinutes: 5, category: 'prepare' },
      { action: 'Gather resources (books, videos, notes)', estimateMinutes: 10, category: 'prepare' },
      { action: 'Study the material actively (take notes)', estimateMinutes: 30, category: 'execute' },
      { action: 'Test yourself on what you learned', estimateMinutes: 10, category: 'verify' },
      { action: 'Review and fill knowledge gaps', estimateMinutes: 10, category: 'cleanup' },
    ],
  },
];

// Generic fallback for unknown tasks
const GENERIC_STEPS: Omit<TaskStep, 'order'>[] = [
  { action: 'Clarify exactly what needs to be done', estimateMinutes: 5, category: 'prepare' },
  { action: 'List what you need to get started', estimateMinutes: 5, category: 'prepare' },
  { action: 'Do the main work', estimateMinutes: 30, category: 'execute' },
  { action: 'Check that it was done correctly', estimateMinutes: 5, category: 'verify' },
  { action: 'Clean up and note what you learned', estimateMinutes: 5, category: 'cleanup' },
];

/**
 * Decompose any task description into actionable steps.
 * Fully deterministic — no AI needed.
 */
export function decomposeTask(taskDescription: string): DecomposedTask {
  const lower = taskDescription.toLowerCase();

  // Find best matching template
  let bestMatch = { template: TASK_TEMPLATES[0], score: 0 };
  for (const template of TASK_TEMPLATES) {
    const score = template.keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestMatch.score) {
      bestMatch = { template, score };
    }
  }

  const templateSteps = bestMatch.score > 0 ? bestMatch.template.steps : GENERIC_STEPS;
  const category = bestMatch.score > 0 ? bestMatch.template.category : 'general';

  // Customize step actions with the actual task context
  const taskNoun = extractTaskNoun(lower);
  const steps: TaskStep[] = templateSteps.map((s, i) => ({
    ...s,
    order: i + 1,
    action: taskNoun ? s.action.replace(/the (?:main )?work/i, taskNoun) : s.action,
  }));

  const totalMinutes = steps.reduce((sum, s) => sum + s.estimateMinutes, 0);
  const difficulty: DecomposedTask['difficulty'] =
    totalMinutes > 90 ? 'hard' : totalMinutes > 45 ? 'medium' : 'easy';

  return {
    originalTask: taskDescription,
    summary: `${category.charAt(0).toUpperCase() + category.slice(1)} task with ${steps.length} steps (~${totalMinutes} min)`,
    steps,
    totalMinutes,
    difficulty,
    tags: [category, difficulty, ...(bestMatch.score > 0 ? bestMatch.template.keywords.filter(kw => lower.includes(kw)) : [])],
  };
}

function extractTaskNoun(text: string): string | null {
  // Simple extraction: take words after the verb
  const verbs = ['clean', 'cook', 'fix', 'buy', 'write', 'plan', 'organize', 'wash', 'repair', 'build', 'make', 'study'];
  for (const verb of verbs) {
    const idx = text.indexOf(verb);
    if (idx >= 0) {
      const rest = text.slice(idx + verb.length).trim();
      const noun = rest.split(/[,.!?]/).find(s => s.trim().length > 0)?.trim();
      if (noun && noun.length > 2 && noun.length < 50) return noun;
    }
  }
  return null;
}

/**
 * Get all available task categories
 */
export function getTaskCategories(): string[] {
  return TASK_TEMPLATES.map(t => t.category);
}
