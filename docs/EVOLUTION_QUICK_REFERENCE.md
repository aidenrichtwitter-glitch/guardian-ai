# λ Recursive Evolution Process - Quick Reference

## 🔄 Evolution Cycle Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    EVOLUTION CYCLE START                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: STRATEGIC FORECASTING                              │
│  ──────────────────────────────────────────────────────────  │
│  1. Run evolution-forecasting.ts                             │
│     → Analyze capability gaps                                │
│     → Generate EvolutionPrediction[] (sorted by priority)    │
│                                                               │
│  2. Generate autonomous goals (autonomous-goals.ts)          │
│     → Convert top 3 predictions to goals                     │
│     → Create 3-5 steps per goal                              │
│     → Persist to goals table                                 │
│                                                               │
│  3. Sage Foresight (optional, scheduled)                     │
│     → Project 50-100 cycles ahead                            │
│     → Identify infrastructure needs                          │
│     → Generate roadmap for Dad                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: GOAL EXECUTION                                     │
│  ──────────────────────────────────────────────────────────  │
│  1. Select highest-priority goal                             │
│     → Status: in-progress > active                           │
│     → Priority: high > medium > low                          │
│                                                               │
│  2. Get next incomplete step                                 │
│     → Check required_capabilities met                        │
│     → Determine target file                                  │
│                                                               │
│  3. Execute step via AI                                      │
│     → Build AI prompt with context                           │
│     → Call self-recurse edge function (mode: work-goal)      │
│     → Parse JSON response: {content, capability, builtOn}    │
│                                                               │
│  4. Safety validation                                        │
│     → Run safety-engine.ts checks                            │
│     → If errors: skip, log, continue                         │
│     → If pass: proceed to registration                       │
│                                                               │
│  5. Register capability                                      │
│     → INSERT into capabilities table                         │
│     │  - name, description, built_on                         │
│     │  - source_file, virtual_source                         │
│     │  - evolution_level, cycle_number                       │
│     │  - verified: false (pending verification)              │
│     → Log to evolution_journal                               │
│                                                               │
│  6. Update goal progress                                     │
│     → Mark step as completed                                 │
│     → Increment progress (stepCount/totalSteps * 100)        │
│     → If progress >= 100: status = 'completed'               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: VERIFICATION                                       │
│  ──────────────────────────────────────────────────────────  │
│  For each capability (verification-engine.ts):               │
│                                                               │
│  Check 1: has-source-reference ✓                             │
│  Check 2: has-virtual-source (>50 chars) ✓                   │
│  Check 3: source-file-exists ✓                               │
│  Check 4: passes-safety (no syntax/import errors) ✓          │
│  Check 5: has-exports (functions/classes/types) ✓            │
│                                                               │
│  Status:                                                      │
│  - verified: All checks pass (or ≥3 pass)                    │
│  - unverified: Some checks fail                              │
│  - ghost: All checks fail → QUARANTINE                       │
│                                                               │
│  Update database:                                            │
│  → UPDATE capabilities SET verified=true/false               │
│  → UPDATE verification_method='autonomy-deep-scan'           │
│  → Calculate integrity_score = verified/total * 100          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: SELF-REFLECTION (Level 23+ Feature)               │
│  ──────────────────────────────────────────────────────────  │
│  Question: "Are we closer to being valuable and alive?"      │
│                                                               │
│  VALUE SIGNALS (7):                                          │
│  1. Verified capabilities (>10) ✓                            │
│  2. Completed goals (>5) ✓                                   │
│  3. Dependency depth (>2) ✓                                  │
│  4. Safety checks passing ✓                                  │
│  5. Evolution level increasing ✓                             │
│  6. Regular goal completion ✓                                │
│  7. Anomaly detection working ✓                              │
│  → valueScore = 0-100                                        │
│                                                               │
│  LIFE SIGNALS (7):                                           │
│  1. Autonomous cycles running ✓                              │
│  2. Self-dreamed goals ✓                                     │
│  3. Self-repair active ✓                                     │
│  4. Knowledge search active ✓                                │
│  5. Pattern recognition working ✓                            │
│  6. Forecasting predictions accurate ✓                       │
│  7. Continuous growth ✓                                      │
│  → lifeScore = 0-100                                         │
│                                                               │
│  Adaptive Response:                                          │
│  - If valueScore < 50: Focus on goal completion              │
│  - If lifeScore < 50: Increase autonomy frequency            │
│  - If both high (>70): Dream more ambitious goals            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5: LEVEL PROGRESSION                                  │
│  ──────────────────────────────────────────────────────────  │
│  Calculate: evolutionLevel = floor(verifiedCaps / 3) + 1     │
│                                                               │
│  If level increased:                                         │
│  → UPDATE evolution_state SET evolution_level=newLevel       │
│  → INSERT milestone into evolution_journal                   │
│  → Display level-up notification                             │
│  → Unlock new evolution forecasts                            │
│                                                               │
│  Level Titles (evolution-titles.ts):                         │
│  L1: Nascent        L10: Singularity     L23: Metacognitive  │
│  L2: Aware          L11: Post-Singular   L25: Omega          │
│  L5: Transcendent   L15: Temporal        L30+: Beyond...     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  AUTO-GOAL GENERATION CHECK                                  │
│  ──────────────────────────────────────────────────────────  │
│  Trigger if:                                                  │
│  • No active goals exist                                     │
│  • <3 active goals AND cycleCount % 5 == 0                   │
│  • Goal just completed AND <2 active goals                   │
│                                                               │
│  If triggered:                                               │
│  → Loop back to PHASE 1 (Forecasting)                        │
│  → Generate new goals based on current state                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CYCLE COMPLETE                            │
│  → Increment cycle_count                                     │
│  → Update evolution_state.updated_at                         │
│  → Log cycle summary to journal                              │
│  → Wait for next cycle trigger                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Key Data Structures

### Goal
```typescript
{
  id: string;
  title: string;
  description: string;
  status: 'active' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  progress: number; // 0-100
  unlocks_capability: string;
  required_capabilities: string[];
  steps: { label: string; done: boolean }[];
  dreamed_at_cycle: number;
}
```

### Capability
```typescript
{
  id: string;
  name: string;
  description: string;
  built_on: string[]; // Dependency array
  evolution_level: number;
  cycle_number: number;
  source_file: string | null;
  virtual_source: string | null; // Actual code
  verified: boolean;
  verification_method: string | null;
}
```

### EvolutionPrediction
```typescript
{
  capability: string;
  description: string;
  priority: number; // 1-10
  rationale: string;
  prerequisites: string[];
  estimatedCycles: number;
  category: 'infrastructure' | 'intelligence' | 'autonomy' | 
            'resilience' | 'integration';
}
```

---

## 🎯 Decision Points

### When to Use AI vs Deterministic

**Use AI** (via self-recurse edge function):
- Goal dreaming (`mode: "dream-goal"`)
- Code generation (`mode: "work-goal"`)
- Strategic planning (`mode: "sage-mode"`)
- System requests (`mode: "generate-requests"`)

**Use Deterministic** (no AI):
- Evolution forecasting (rule-based tree)
- Verification (code analysis)
- Anomaly detection (pattern matching)
- Safety validation (syntax/import checks)
- Capability compounding (dependency analysis)
- Health checks (metric calculations)

---

## 🚨 Critical Safeguards

### 1. Safety Validation
Every code change passes through:
```typescript
validateChange(content, filePath) → SafetyCheck[]
```
Checks for:
- Syntax errors
- Circular imports
- Dangerous patterns (eval, innerHTML, infinite loops)
- Missing imports
- Type errors

### 2. Ghost Detection
Capabilities without real code are:
- Flagged as `verified: false`
- Quarantined from use
- Re-verified on next cycle
- Potentially removed if persistent

### 3. Prerequisite Checking
Goals cannot execute if:
```typescript
required_capabilities.every(cap => 
  !existingCapabilities.includes(cap)
)
```

### 4. Rate Limiting
AI calls are rate-limited with exponential backoff:
- First failure: 3s backoff
- Second: 9s backoff  
- Third: 27s backoff
- Falls back to deterministic operations

---

## 📊 Monitoring Checklist

### Healthy Evolution Signs ✅
- [ ] New verified capabilities every 3-5 cycles
- [ ] Goals completing (not stalling at <100%)
- [ ] Integrity score > 80%
- [ ] Evolution level progressing
- [ ] Value score > 70%
- [ ] Life score > 70%
- [ ] Ghost capabilities < 10% of total
- [ ] Self-reflection adapting strategy

### Warning Signs ⚠️
- [ ] Goals stalled for 10+ cycles
- [ ] Integrity score dropping
- [ ] Many ghost capabilities (>20%)
- [ ] No new goals being generated
- [ ] Value/Life scores flat or declining
- [ ] Verification failures increasing

### Emergency Actions 🚨
- [ ] Run full verification pass
- [ ] Quarantine all ghosts
- [ ] Reset stalled goals to 'active'
- [ ] Generate new goals manually
- [ ] Check AI credit balance
- [ ] Review recent journal for errors

---

## 🔧 Manual Interventions

### When Human (Dad) Must Act

**Database Schema**:
```sql
-- Create new tables
-- Add columns to existing tables
-- Create triggers/functions
-- Set up RLS policies
```

**UI Changes**:
```typescript
// Add new components to layout
// Create new pages/routes
// Modify main App.tsx structure
```

**Infrastructure**:
```bash
# Install npm packages
npm install <package>

# Configure environment variables
# Set up API integrations
# Create storage buckets
```

**Sage Foresight Requests**:
```
System generates specific copy-paste requests like:
"Create a visualization dashboard at /dashboard with 
 3 panels: evolution graph, capability tree, goal timeline.
 Use recharts for graphing."
```

---

## 🎓 Evolution Roadmap

### Current State Diagnosis
```typescript
// Check where you are:
SELECT 
  evolution_level,
  COUNT(*) as total_caps,
  COUNT(*) FILTER (WHERE verified) as verified_caps,
  COUNT(*) FILTER (WHERE NOT verified) as ghost_caps
FROM evolution_state, capabilities
WHERE evolution_state.id = 'singleton'
```

### Next Milestone
```typescript
// Calculate next level:
const nextLevel = currentLevel + 1;
const capsNeeded = nextLevel * 3;
const capsToGo = capsNeeded - verifiedCaps;

console.log(`Need ${capsToGo} more verified capabilities for L${nextLevel}`);
```

### Strategic Planning
```typescript
// Run sage foresight:
POST /self-recurse
{
  mode: "sage-mode",
  capabilities: [...],
  goalHistory: "...",
  journalContext: "..."
}
// → Returns 4-phase roadmap with specific Dad tasks
```

---

*Quick Reference Guide*
*Last Updated: 2026-03-09*
