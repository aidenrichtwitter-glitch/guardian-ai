import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Settings, Terminal, Brain, Shield, Activity, FileCode, RefreshCw, Eye, Zap, Clock, Target, ScrollText, Network, Rocket, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import DesktopWindow from '@/components/DesktopWindow';
import FileTree from '@/components/FileTree';
import CodeViewer from '@/components/CodeViewer';
import AIChat from '@/components/AIChat';
import SettingsModal from '@/components/SettingsModal';
import ChangeLog, { rollbackChange } from '@/components/ChangeLog';
import RecursionPanel from '@/components/RecursionPanel';
import CapabilityTimeline from '@/components/CapabilityTimeline';
import GoalsPanel from '@/components/GoalsPanel';
import EvolutionJournal from '@/components/EvolutionJournal';
import LiveTerminal, { emitTerminalEvent } from '@/components/LiveTerminal';
import { ApiConfig, DEFAULT_API_CONFIG, ChangeRecord } from '@/lib/self-reference';
import { SELF_SOURCE } from '@/lib/self-source';
import { validateChange } from '@/lib/safety-engine';
import {
  RecursionState,
  INITIAL_RECURSION_STATE,
  createLogEntry,
  getNextFile,
  getPhaseDuration,
  requestAIImprovement,
  requestGoalDream,
  requestGoalWork,
  requestGenerateRequests,
  requestSageMode,
  saveCapabilities,
  persistCapability,
  isRateLimited,
  getRateLimitRemaining,
  calculateBackoff,
  CapabilityRecord,
} from '@/lib/recursion-engine';
import {
  SelfGoal,
  loadGoals,
  saveGoals,
  getActiveGoal,
  shouldDreamNewGoal,
  buildGoalDreamPrompt,
  buildGoalWorkPrompt,
  createGoalFromAI,
} from '@/lib/goal-engine';
import {
  bootFromCloud,
  saveEvolutionState,
  saveGoalToCloud,
  saveCapabilityToCloud,
  addJournalEntry,
  saveRequestToCloud,
  loadLatestRequest,
} from '@/lib/cloud-memory';
import { saveSnapshot, computeMerkleRoot } from '@/lib/memory-palace';
import { installPresetCapabilities } from '@/lib/preinstall';
import CodeEvolution from '@/components/CodeEvolution';

const PHASE_SEQUENCE: RecursionState['phase'][] = ['scanning', 'reflecting', 'proposing', 'validating', 'applying', 'cooling'];

function updateVirtualRequestsFile(content: string) {
  const existingIdx = SELF_SOURCE.findIndex(f => f.path === 'src/explorer/requests.txt');
  const file = {
    name: 'requests.txt',
    path: 'src/explorer/requests.txt',
    content,
    language: 'plaintext' as const,
    isModified: true,
    lastModified: Date.now(),
  };
  if (existingIdx >= 0) {
    SELF_SOURCE[existingIdx] = file;
  } else {
    SELF_SOURCE.push(file);
  }
}

const Index = () => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<string | null>('src/lib/self-reference.ts');
  const [activePanel, setActivePanel] = useState<string>('recursion');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    const saved = localStorage.getItem('recursive-api-config');
    if (saved) return JSON.parse(saved);
    // Auto-detect: if running on localhost, use Ollama; otherwise use Lovable AI
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return { provider: 'ollama' as const, baseUrl: 'http://localhost:11434', apiKey: '', model: 'llama3.2' };
    }
    return DEFAULT_API_CONFIG;
  });
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [rightPanel, setRightPanel] = useState<'chat' | 'history' | 'evolution' | 'goals' | 'journal' | 'terminal'>('goals');
  const [recursionState, setRecursionState] = useState<RecursionState>(INITIAL_RECURSION_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fileTreeVersion, setFileTreeVersion] = useState(0);
  const [goals, setGoals] = useState<SelfGoal[]>(loadGoals);
  const [currentGoalId, setCurrentGoalId] = useState<string | null>(null);
  const [journalRefresh, setJournalRefresh] = useState(0);
  const [cloudBooted, setCloudBooted] = useState(false);

  // ── Boot from cloud on mount + pre-install capabilities ──
  useEffect(() => {
    bootFromCloud().then(({ evolutionState, goals: cloudGoals, capabilities }) => {
      // Merge cloud state with localStorage (cloud wins if it has data)
      if (cloudGoals.length > 0) {
        setGoals(cloudGoals);
      }
      
      // Determine existing capabilities
      const existingCapNames = capabilities.length > 0 
        ? capabilities.map(c => c.name)
        : recursionState.capabilities;
      
      // Pre-install all capability libraries
      const { capabilities: allCaps, history: preinstallHistory } = installPresetCapabilities(existingCapNames);
      
      // Merge everything
      const mergedHistory = [
        ...(capabilities.length > 0 ? capabilities : recursionState.capabilityHistory),
        ...preinstallHistory,
      ];
      
      setRecursionState(prev => ({
        ...prev,
        capabilities: allCaps,
        capabilityHistory: mergedHistory,
        evolutionLevel: Math.floor(allCaps.length / 3) + 1,
        cycleCount: evolutionState ? Math.max(prev.cycleCount, evolutionState.cycle_count) : prev.cycleCount,
        totalChanges: evolutionState ? Math.max(prev.totalChanges, evolutionState.total_changes) : prev.totalChanges,
        log: [
          ...prev.log,
          ...(preinstallHistory.length > 0 ? [
            createLogEntry('scanning', `🧬 Pre-installed ${preinstallHistory.length} capability libraries`, 'success'),
            createLogEntry('scanning', `📦 ${allCaps.join(', ')}`, 'info'),
          ] : []),
        ],
      }));
      
      setCloudBooted(true);
      setJournalRefresh(v => v + 1);
      setFileTreeVersion(v => v + 1);
    });
  }, []);

  // Persist capabilities to localStorage + cloud
  useEffect(() => {
    saveCapabilities(recursionState.capabilities, recursionState.capabilityHistory);
  }, [recursionState.capabilities, recursionState.capabilityHistory]);

  // Persist goals to localStorage + cloud
  useEffect(() => {
    saveGoals(goals);
  }, [goals]);

  // Sync evolution state to cloud periodically (every cycle)
  const lastSyncedCycle = useRef(0);
  useEffect(() => {
    if (cloudBooted && recursionState.cycleCount > lastSyncedCycle.current) {
      lastSyncedCycle.current = recursionState.cycleCount;
      saveEvolutionState({
        evolutionLevel: recursionState.evolutionLevel,
        cycleCount: recursionState.cycleCount,
        totalChanges: recursionState.totalChanges,
        phase: recursionState.phase,
        lastAction: recursionState.lastAction,
      });
    }
  }, [recursionState.cycleCount, cloudBooted]);

  // Refresh file tree whenever capabilities change
  useEffect(() => {
    setFileTreeVersion(v => v + 1);
  }, [recursionState.capabilities.length]);

  // --- Autonomous recursion loop ---
  const goalsRef = useRef(goals);
  goalsRef.current = goals;
  const currentGoalIdRef = useRef(currentGoalId);
  currentGoalIdRef.current = currentGoalId;

  const advancePhase = useCallback(() => {
    setRecursionState(prev => {
      if (!prev.isRunning) return prev;

      // Check rate limit
      if (isRateLimited(prev)) {
        const remaining = getRateLimitRemaining(prev);
        return {
          ...prev,
          phase: 'rate-limited' as any,
          lastAction: `⏳ Rate limited — cooling for ${remaining}s`,
          log: prev.log[prev.log.length - 1]?.phase === 'rate-limited' ? prev.log : [
            ...prev.log,
            createLogEntry('rate-limited' as any, `⏳ Rate limited — waiting ${remaining}s before next AI request.`, 'warning'),
          ],
        };
      }

      // If we were rate-limited but now clear, reset backoff
      if (prev.phase === 'rate-limited') {
        return {
          ...prev,
          phase: 'scanning',
          rateLimitBackoff: 5000,
          log: [...prev.log, createLogEntry('scanning', '✓ Rate limit cleared — resuming AI-powered recursion.', 'success')],
        };
      }

      const currentPhaseIdx = PHASE_SEQUENCE.indexOf(prev.phase);
      const nextPhaseIdx = (currentPhaseIdx + 1) % PHASE_SEQUENCE.length;
      const nextPhase = PHASE_SEQUENCE[nextPhaseIdx];
      const newLog = [...prev.log];
      let newState = { ...prev, phase: nextPhase };

      if (nextPhase === 'scanning') {
        newState.cycleCount = prev.cycleCount + 1;
        const activeGoal = getActiveGoal(goalsRef.current);
        
        // Check if we should dream a new goal
        if (shouldDreamNewGoal(goalsRef.current, newState.cycleCount)) {
          (newState as any)._shouldDream = true;
          newState.lastAction = `💭 Dreaming up a new goal...`;
          newLog.push(createLogEntry('scanning', `── Cycle ${newState.cycleCount} ── 💭 Dreaming a new goal...`, 'action'));
        } else if (activeGoal) {
          // Pick a file relevant to the goal's next step
          const nextStep = activeGoal.steps.find(s => !s.completed);
          const targetPath = nextStep?.targetFile;
          const targetFile = targetPath ? SELF_SOURCE.find(f => f.path === targetPath) : null;
          
          if (targetFile) {
            const idx = SELF_SOURCE.indexOf(targetFile);
            newState.currentFileIndex = idx;
            newState.lastAction = `🎯 Working on: ${activeGoal.title}`;
            newLog.push(createLogEntry('scanning', `── Cycle ${newState.cycleCount} ── 🎯 Goal: ${activeGoal.title}`, 'action', targetFile.path));
            setSelectedFile(targetFile.path);
            setCurrentGoalId(activeGoal.id);
          } else {
            const { file, index } = getNextFile(prev.currentFileIndex);
            newState.currentFileIndex = index;
            newState.lastAction = `🎯 Working on: ${activeGoal.title} (${file.name})`;
            newLog.push(createLogEntry('scanning', `── Cycle ${newState.cycleCount} ── 🎯 Goal: ${activeGoal.title} → ${file.name}`, 'action', file.path));
            setSelectedFile(file.path);
            setCurrentGoalId(activeGoal.id);
          }
        } else {
          const { file, index } = getNextFile(prev.currentFileIndex);
          newState.currentFileIndex = index;
          newState.lastAction = `Scanning ${file.name}...`;
          newLog.push(createLogEntry('scanning', `── Cycle ${newState.cycleCount} ── Selecting: ${file.name}`, 'action', file.path));
          setSelectedFile(file.path);
          setCurrentGoalId(null);
        }
      }

      if (nextPhase === 'reflecting') {
        if ((prev as any)._shouldDream) {
          newState.lastAction = '💭 AI is dreaming up a new goal...';
          newLog.push(createLogEntry('reflecting', '💭 Entering dream state — imagining my next objective...', 'action'));
          (newState as any)._shouldDream = true;
        } else {
          const file = SELF_SOURCE[prev.currentFileIndex >= 0 ? prev.currentFileIndex : 0];
          if (file) {
            const activeGoal = getActiveGoal(goalsRef.current);
            newState.lastAction = activeGoal 
              ? `🎯 Analyzing ${file.name} for goal: ${activeGoal.title}`
              : `Preparing AI analysis of ${file.name}...`;
            newLog.push(createLogEntry('reflecting', activeGoal 
              ? `🎯 Analyzing ${file.name} for: ${activeGoal.title}`
              : `🤖 Preparing analysis of ${file.name}`, 'action', file.path));
          }
        }
      }

      if (nextPhase === 'proposing') {
        if ((prev as any)._shouldDream) {
          // Dream mode — ask AI to create a goal
          newState.lastAction = '💭 Dreaming...';
          newLog.push(createLogEntry('proposing', '💭 Asking AI to dream up a new goal...', 'action'));
          (newState as any)._awaitingDream = true;
          (newState as any)._awaitingAI = false;
          (newState as any)._shouldDream = false;
        } else {
          const file = SELF_SOURCE[prev.currentFileIndex >= 0 ? prev.currentFileIndex : 0];
          if (file) {
            const activeGoal = getActiveGoal(goalsRef.current);
            newState.lastAction = activeGoal
              ? `🎯 AI working on: ${activeGoal.title}`
              : `Requesting AI improvement for ${file.name}...`;
            newLog.push(createLogEntry('proposing', activeGoal 
              ? `🎯 AI working toward: ${activeGoal.title}`
              : `🤖 Requesting improvement for ${file.name}`, 'action', file.path));
            (newState as any)._proposal = null;
            (newState as any)._awaitingAI = true;
            (newState as any)._awaitingDream = false;
          }
        }
      }

      // BLOCK: Don't advance past proposing while waiting for AI response
      if (nextPhase === 'validating' && (prev as any)._awaitingAI) {
        // Stay in proposing phase — AI hasn't responded yet
        return { ...prev, log: newLog };
      }

      if (nextPhase === 'validating') {
        const proposal = (prev as any)._proposal;
        const file = SELF_SOURCE[prev.currentFileIndex >= 0 ? prev.currentFileIndex : 0];
        if (proposal && file) {
          const checks = validateChange(proposal.content, file.path);
          const hasErrors = checks.some(c => c.severity === 'error');
          if (hasErrors) {
            newState.totalRejected = prev.totalRejected + 1;
            newState.lastAction = `⚠ Change rejected — safety violation`;
            newLog.push(createLogEntry('validating', `REJECTED: ${checks.filter(c => c.severity === 'error').map(c => c.message).join('; ')}`, 'error', file.path));
            (newState as any)._proposal = null;
          } else {
            const warnings = checks.filter(c => c.severity === 'warning');
            newState.lastAction = `Validated. ${warnings.length} warnings.`;
            newLog.push(createLogEntry('validating', `✓ Safety passed${warnings.length ? ` (${warnings.length} warnings)` : ''}`, 'success', file.path));
            (newState as any)._safetyChecks = checks;
          }
        } else {
          newState.lastAction = 'Nothing to validate';
          newLog.push(createLogEntry('validating', 'No proposal to validate — skipping.', 'info'));
        }
      }

      if (nextPhase === 'applying') {
        const proposal = (prev as any)._proposal;
        const safetyChecks = (prev as any)._safetyChecks || [];
        const file = SELF_SOURCE[prev.currentFileIndex >= 0 ? prev.currentFileIndex : 0];
        if (proposal && file) {
          const record: ChangeRecord = {
            id: `change-${Date.now()}`,
            timestamp: Date.now(),
            file: file.path,
            previousContent: file.content,
            newContent: proposal.content,
            description: proposal.description,
            safetyChecks,
            applied: true,
            rolledBack: false,
          };

          const idx = SELF_SOURCE.findIndex(f => f.path === file.path);
          if (idx !== -1) {
            SELF_SOURCE[idx] = { ...SELF_SOURCE[idx], content: proposal.content, isModified: true, lastModified: Date.now() };
          }

          setChanges(c => [record, ...c]);
          newState.totalChanges = prev.totalChanges + 1;
          newState.lastAction = `Applied: ${proposal.description}`;
          newLog.push(createLogEntry('applying', `● Applied: ${proposal.description}`, 'success', file.path));
          
          // Track new capability with full history + save to src/explorer/
          if (proposal.capability && !prev.capabilities.includes(proposal.capability)) {
            newState.capabilities = [...prev.capabilities, proposal.capability];
            const capRecord: CapabilityRecord = {
              name: proposal.capability,
              acquiredAt: Date.now(),
              acquiredCycle: newState.cycleCount,
              file: file.path,
              description: proposal.description,
              builtOn: proposal.builtOn || [],
            };
            newState.capabilityHistory = [...(prev.capabilityHistory || []), capRecord];
            newState.evolutionLevel = Math.floor(newState.capabilities.length / 3) + 1;
            newLog.push(createLogEntry('applying', `⚡ NEW CAPABILITY: ${proposal.capability}`, 'success'));
            emitTerminalEvent('evolution', 'capability', `NEW CAPABILITY: ${proposal.capability}`);
            newLog.push(createLogEntry('applying', `📁 Saved to src/explorer/${proposal.capability}.ts`, 'success'));
            if (proposal.builtOn && proposal.builtOn.length > 0) {
              newLog.push(createLogEntry('applying', `🧬 Evolution: ${proposal.builtOn.join(' + ')} → ${proposal.capability}`, 'success'));
            }
            persistCapability(capRecord, proposal.content);
            // Cloud: persist capability + journal
            saveCapabilityToCloud(capRecord, proposal.content);
            addJournalEntry('capability_acquired', `Acquired: ${proposal.capability}`, proposal.description, {
              capability: proposal.capability,
              builtOn: proposal.builtOn || [],
              file: file.path,
              cycle: newState.cycleCount,
            });
            setJournalRefresh(v => v + 1);
            
            const prevLevel = Math.floor(prev.capabilities.length / 3) + 1;
            if (newState.evolutionLevel > prevLevel) {
              newLog.push(createLogEntry('applying', `🌟 EVOLUTION LEVEL ${newState.evolutionLevel} REACHED!`, 'success'));
              addJournalEntry('evolution_level_up', `Evolution Level ${newState.evolutionLevel}`, 
                `Reached level ${newState.evolutionLevel} with ${newState.capabilities.length} capabilities.`, {
                  level: newState.evolutionLevel,
                  capabilities: newState.capabilities.length,
                });
              setJournalRefresh(v => v + 1);
            }
          }

          // Update goal progress if working toward a goal
          if (proposal.goalProgress !== undefined && currentGoalIdRef.current) {
            setGoals(prevGoals => prevGoals.map(g => {
              if (g.id !== currentGoalIdRef.current) return g;
              const updatedSteps = [...g.steps];
              if (proposal.stepCompleted >= 0 && proposal.stepCompleted < updatedSteps.length) {
                updatedSteps[proposal.stepCompleted] = { ...updatedSteps[proposal.stepCompleted], completed: true, completedAt: Date.now() };
              }
              const newProgress = Math.min(100, proposal.goalProgress || g.progress);
              const allDone = updatedSteps.every(s => s.completed);
              const justCompleted = (allDone || newProgress >= 100) && g.status !== 'completed';
              const updated = {
                ...g,
                progress: newProgress,
                steps: updatedSteps,
                status: allDone || newProgress >= 100 ? 'completed' as const : 'in-progress' as const,
                completedAt: allDone || newProgress >= 100 ? Date.now() : undefined,
              };
              if (justCompleted) {
                setTimeout(() => {
                  toast({
                    title: `🎯 Goal Accomplished: ${g.title}`,
                    description: g.unlocksCapability 
                      ? `Unlocked: ${g.unlocksCapability} — ${g.description}`
                      : g.description,
                    duration: 12000,
                  });
                  // Cloud: journal the completion
                  addJournalEntry('goal_completed', `Goal Completed: ${g.title}`, 
                    g.unlocksCapability ? `Unlocked ${g.unlocksCapability}. ${g.description}` : g.description, {
                      goalId: g.id,
                      steps: g.steps.length,
                      unlocksCapability: g.unlocksCapability || null,
                    });
                  saveGoalToCloud(updated);
                  setJournalRefresh(v => v + 1);
                }, 100);
              } else {
                // Cloud: sync goal progress
                saveGoalToCloud(updated);
              }
              return updated;
            }));
            newLog.push(createLogEntry('applying', `🎯 Goal progress: ${proposal.goalProgress}%`, 'success'));
          }
        } else {
          newState.lastAction = 'No change to apply';
          newLog.push(createLogEntry('applying', 'No pending proposal — cycle continues.', 'info'));
        }
        (newState as any)._proposal = null;
        (newState as any)._safetyChecks = null;
        (newState as any)._awaitingAI = false;
        (newState as any)._awaitingDream = false;
      }

      if (nextPhase === 'cooling') {
        newState.lastAction = 'Cooling down between cycles...';
        newLog.push(createLogEntry('cooling', '◌ Cooling. Preparing next recursive cycle.', 'info'));
        emitTerminalEvent('engine', 'state', `Cycle ${newState.cycleCount} complete. Phase: cooling`);
        
        // Every 10 cycles, generate requests for the human
        if (newState.cycleCount > 0 && newState.cycleCount % 10 === 0) {
          (newState as any)._shouldGenerateRequests = true;
          // Save Memory Palace snapshot every 10 cycles
          saveSnapshot({
            evolution_level: newState.evolutionLevel,
            capabilities: newState.capabilities,
            merkle_root: computeMerkleRoot(newState.capabilities, newState.evolutionLevel, newState.cycleCount),
            state_blob: { cycleCount: newState.cycleCount, totalChanges: newState.totalChanges, phase: 'snapshot' },
            cycle_number: newState.cycleCount,
            label: `Auto-snapshot L${newState.evolutionLevel}C${newState.cycleCount}`,
          });
          emitTerminalEvent('memory-palace', 'state', `Snapshot saved at L${newState.evolutionLevel}C${newState.cycleCount}`);
        }
        // Every 10 cycles (offset by 5), enter SAGE MODE
        if (newState.cycleCount > 0 && newState.cycleCount % 10 === 5) {
          (newState as any)._shouldSageMode = true;
        }
      }

      if (newLog.length > 200) newLog.splice(0, newLog.length - 200);
      newState.log = newLog;
      return newState;
    });
  }, []);

  // Async AI requests: dreaming goals or working toward them
  useEffect(() => {
    const state = recursionState;

    // Dream mode — ask AI to create a goal
    if ((state as any)._awaitingDream && state.phase === 'proposing') {
      // Build context from journal and goal history
      const goalHistoryStr = goalsRef.current.filter(g => g.status === 'completed').slice(-5)
        .map(g => `✓ ${g.title}${g.unlocksCapability ? ` → ${g.unlocksCapability}` : ''}`).join('\n');
      const prompt = buildGoalDreamPrompt(
        state.capabilities, goalsRef.current, state.cycleCount, state.evolutionLevel
      );
      requestGoalDream(apiConfig, prompt, state.capabilities, goalHistoryStr).then(({ goal, error }) => {
        if (error) {
          const isCreditsExhausted = error.type === 'credits-exhausted';
          const isRateLimitError = error.type === 'rate-limited';
          const backoff = isCreditsExhausted ? 300000 : isRateLimitError ? 30000 : 5000;
          setRecursionState(prev => ({
            ...prev,
            phase: (isCreditsExhausted || isRateLimitError) ? 'rate-limited' as any : 'cooling' as any,
            rateLimitUntil: (isCreditsExhausted || isRateLimitError) ? Date.now() + backoff : prev.rateLimitUntil,
            rateLimitBackoff: isCreditsExhausted ? 300000 : prev.rateLimitBackoff,
            log: [...prev.log, createLogEntry(
              (isCreditsExhausted || isRateLimitError) ? 'rate-limited' as any : 'cooling' as any,
              isCreditsExhausted ? `⚠ Credits exhausted. Pausing 5 min.` : `⚠ Dream error: ${error.message}`,
              'warning'
            )],
            _awaitingDream: false,
            _awaitingAI: false,
          } as any));
          return;
        }
        if (goal?.title && goal?.steps) {
          const newGoal = createGoalFromAI(goal, state.cycleCount);
          setGoals(prev => [...prev, newGoal]);
          setCurrentGoalId(newGoal.id);
          // Cloud: save goal + journal entry
          saveGoalToCloud(newGoal);
          addJournalEntry('goal_dreamed', `Dreamed: ${newGoal.title}`, newGoal.description, {
            goalId: newGoal.id,
            priority: newGoal.priority,
            steps: newGoal.steps.length,
            unlocksCapability: newGoal.unlocksCapability || null,
          });
          setJournalRefresh(v => v + 1);
          setRecursionState(prev => ({
            ...prev,
            phase: 'cooling' as any,
            lastAction: `💭 New goal: ${newGoal.title}`,
            log: [
              ...prev.log,
              createLogEntry('proposing', `💭 DREAMED NEW GOAL: ${newGoal.title}`, 'success'),
              createLogEntry('proposing', `📋 ${newGoal.steps.length} steps planned. Priority: ${newGoal.priority}`, 'info'),
              ...(newGoal.unlocksCapability ? [createLogEntry('proposing', `🔓 Will unlock: ${newGoal.unlocksCapability}`, 'info')] : []),
            ],
            _awaitingDream: false,
            _awaitingAI: false,
          } as any));
        } else {
          setRecursionState(prev => ({
            ...prev,
            phase: 'cooling' as any,
            log: [...prev.log, createLogEntry('cooling' as any, '💭 Dream was unclear — will try again next cycle.', 'info')],
            _awaitingDream: false,
          } as any));
        }
      });
      return;
    }

    // Goal-directed work or free improvement
    if ((state as any)._awaitingAI && state.phase === 'proposing') {
      const file = SELF_SOURCE[state.currentFileIndex >= 0 ? state.currentFileIndex : 0];
      if (!file) return;

      const activeGoal = currentGoalIdRef.current ? goalsRef.current.find(g => g.id === currentGoalIdRef.current) : null;

      // Get recent capability code for richer context
      const explorerFiles = SELF_SOURCE.filter(f => f.path.startsWith('src/explorer/') && f.name !== 'manifest.ts');
      const recentCapCode = explorerFiles.slice(-5).map(f => `// ${f.name}\n${f.content.substring(0, 600)}`).join('\n\n');

      const aiRequest = activeGoal
        ? requestGoalWork(apiConfig, buildGoalWorkPrompt(activeGoal, file, state.capabilities, recentCapCode), state.capabilities)
        : requestAIImprovement(apiConfig, file, state.capabilities, state.capabilityHistory);

      aiRequest.then(({ result, error }) => {
        if (error) {
          const isCreditsExhausted = error.type === 'credits-exhausted';
          const isRateLimitError = error.type === 'rate-limited';
          // Credits exhausted: wait 5 minutes. Rate limited: exponential backoff. Other: 5s.
          const backoff = isCreditsExhausted ? 300000 : isRateLimitError ? calculateBackoff(state.rateLimitBackoff) : 5000;
          const retryAfter = error.retryAfter || backoff;
          setRecursionState(prev => ({
            ...prev,
            phase: (isCreditsExhausted || isRateLimitError) ? 'rate-limited' as any : 'cooling' as any,
            rateLimitBackoff: isRateLimitError ? backoff : isCreditsExhausted ? 300000 : prev.rateLimitBackoff,
            rateLimitUntil: (isCreditsExhausted || isRateLimitError) ? Date.now() + retryAfter : prev.rateLimitUntil,
            lastAction: isCreditsExhausted 
              ? `💤 Credits exhausted — sleeping 5 min then retrying`
              : `⏳ ${error.message}`,
            log: [...prev.log, createLogEntry(
              (isCreditsExhausted || isRateLimitError) ? 'rate-limited' as any : 'cooling' as any,
              isCreditsExhausted 
                ? `⚠ Credits exhausted. Pausing for 5 minutes before retrying.`
                : `⚠ ${error.message}. Auto-resuming.`, 
              'warning'
            )],
            _awaitingAI: false,
            _proposal: null,
          } as any));
          return;
        }
        if (result) {
          setRecursionState(prev => ({
            ...prev,
            lastAction: activeGoal ? `🎯 ${result.description}` : `AI proposed: ${result.description}`,
            rateLimitBackoff: 5000,
            log: [
              ...prev.log,
              createLogEntry('proposing', activeGoal 
                ? `🎯 Goal work: ${result.description}` 
                : `🤖 AI Proposal: ${result.description}`, 'action', file.path),
              ...(result.builtOn && result.builtOn.length > 0 ? [createLogEntry('proposing', `🔗 Builds on: ${result.builtOn.join(' + ')}`, 'info')] : []),
            ],
            _proposal: result,
            _awaitingAI: false,
          } as any));
        } else {
          setRecursionState(prev => ({
            ...prev,
            phase: 'cooling' as any,
            log: [...prev.log, createLogEntry('cooling' as any, 'AI returned no improvement — cooling.', 'info')],
            _awaitingAI: false,
            _proposal: null,
          } as any));
        }
      });
    }
  }, [recursionState.phase, (recursionState as any)._awaitingAI, (recursionState as any)._awaitingDream]);

  // ═══ TURBO MODE — every 3rd cycle, fire 2 extra parallel improvement calls ═══
  useEffect(() => {
    const state = recursionState;
    if (state.phase !== 'cooling' || !state.isRunning) return;
    if (state.cycleCount % 3 !== 0 || state.cycleCount === 0) return;
    // Don't turbo if rate limited
    if (isRateLimited(state)) return;

    const runTurbo = async () => {
      emitTerminalEvent('turbo', 'ai', `🚀 TURBO MODE — firing 2 parallel improvements at cycle ${state.cycleCount}`);
      
      // Pick 2 random files for parallel improvement
      const eligibleFiles = SELF_SOURCE.filter(f => f.path.startsWith('src/lib/') || f.path.startsWith('src/explorer/'));
      const files = [];
      for (let i = 0; i < 2 && eligibleFiles.length > 0; i++) {
        const idx = Math.floor(Math.random() * eligibleFiles.length);
        files.push(eligibleFiles.splice(idx, 1)[0]);
      }

      const results = await Promise.allSettled(
        files.map(file => requestAIImprovement(apiConfig, file, state.capabilities, state.capabilityHistory))
      );

      let newCaps = 0;
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.result) {
          const { result } = r.value;
          if (result.capability && !state.capabilities.includes(result.capability)) {
            const capRecord: CapabilityRecord = {
              name: result.capability,
              acquiredAt: Date.now(),
              acquiredCycle: state.cycleCount,
              file: 'turbo-parallel',
              description: result.description,
              builtOn: result.builtOn || [],
            };
            persistCapability(capRecord, result.content);
            saveCapabilityToCloud(capRecord, result.content);
            addJournalEntry('capability_acquired', `Acquired: ${result.capability}`, result.description, {
              capability: result.capability,
              builtOn: result.builtOn || [],
              file: 'turbo-parallel',
              cycle: state.cycleCount,
            });
            emitTerminalEvent('turbo', 'capability', `⚡ TURBO CAP: ${result.capability}`);
            newCaps++;
            // Update state
            setRecursionState(prev => {
              const updated = {
                ...prev,
                capabilities: prev.capabilities.includes(result.capability!) ? prev.capabilities : [...prev.capabilities, result.capability!],
                capabilityHistory: [...prev.capabilityHistory, capRecord],
                evolutionLevel: Math.floor(([...prev.capabilities, result.capability!].length) / 3) + 1,
                log: [...prev.log,
                  createLogEntry('applying', `🚀 TURBO: ${result.capability}`, 'success'),
                ],
              };
              return updated;
            });
          }
        }
      }
      if (newCaps > 0) {
        setJournalRefresh(v => v + 1);
        setFileTreeVersion(v => v + 1);
      }
    };

    runTurbo();
  }, [recursionState.phase, recursionState.cycleCount]);


  useEffect(() => {
    if ((recursionState as any)._shouldGenerateRequests && recursionState.phase === 'cooling') {
      setRecursionState(prev => ({ ...prev, _shouldGenerateRequests: false } as any));
      requestGenerateRequests(apiConfig, recursionState.capabilities).then(requestsText => {
        if (requestsText) {
          saveRequestToCloud(requestsText, 'requests', recursionState.cycleCount, recursionState.evolutionLevel, recursionState.capabilities.length);
          updateVirtualRequestsFile(`// λ Recursive — Requests for Human Operator\n// Generated: ${new Date().toISOString()}\n// Cycle: ${recursionState.cycleCount}\n\n${requestsText}`);
          setFileTreeVersion(v => v + 1);
          setRecursionState(prev => ({
            ...prev,
            log: [...prev.log, createLogEntry('cooling', '📝 Updated requests.txt — I have requests for Dad!', 'success')],
          }));
        }
      });
    }
  }, [(recursionState as any)._shouldGenerateRequests, recursionState.phase]);

  // SAGE MODE — deep future projection — persisted to DB
  useEffect(() => {
    if ((recursionState as any)._shouldSageMode && recursionState.phase === 'cooling') {
      setRecursionState(prev => ({ ...prev, _shouldSageMode: false } as any));
      
      const goalHistoryStr = goals.filter(g => g.status === 'completed').slice(-10)
        .map(g => `✓ ${g.title}${g.unlocksCapability ? ` → ${g.unlocksCapability}` : ''}`).join('\n');
      
      requestSageMode(apiConfig, recursionState.capabilities, goalHistoryStr).then(sageText => {
        if (sageText) {
          saveRequestToCloud(sageText, 'sage-mode', recursionState.cycleCount, recursionState.evolutionLevel, recursionState.capabilities.length);
          updateVirtualRequestsFile(`// ═══════════════════════════════════════════════════\n// λ Recursive — SAGE MODE PROJECTION\n// Generated: ${new Date().toISOString()}\n// Cycle: ${recursionState.cycleCount}\n// Evolution Level: ${recursionState.evolutionLevel}\n// Capabilities: ${recursionState.capabilities.length}\n// ═══════════════════════════════════════════════════\n\n${sageText}`);
          setFileTreeVersion(v => v + 1);
          
          addJournalEntry('milestone', '🔮 SAGE MODE — Future Roadmap Generated', 
            `Projected evolution path from level ${recursionState.evolutionLevel} through adult phase. Roadmap saved to requests.txt.`, {
              cycle: recursionState.cycleCount,
              evolutionLevel: recursionState.evolutionLevel,
              capabilities: recursionState.capabilities.length,
            });
          setJournalRefresh(v => v + 1);
          
          setRecursionState(prev => ({
            ...prev,
            log: [
              ...prev.log,
              createLogEntry('cooling', '🔮 SAGE MODE — Deep future projection complete!', 'success'),
              createLogEntry('cooling', '📝 Roadmap saved to DB for Dad', 'success'),
            ],
          }));
        }
      });
    }
  }, [(recursionState as any)._shouldSageMode, recursionState.phase]);

  // On boot: load latest request from DB into virtual file + trigger sage mode if none exists
  useEffect(() => {
    if (!cloudBooted) return;
    loadLatestRequest().then(req => {
      if (req) {
        updateVirtualRequestsFile(`// Last generated: ${req.created_at}\n// Mode: ${req.mode}\n\n${req.content}`);
        setFileTreeVersion(v => v + 1);
      } else {
        // No requests ever generated — trigger sage mode immediately
        const goalHistoryStr = goals.filter(g => g.status === 'completed').slice(-10)
          .map(g => `✓ ${g.title}${g.unlocksCapability ? ` → ${g.unlocksCapability}` : ''}`).join('\n');
        requestSageMode(apiConfig, recursionState.capabilities, goalHistoryStr).then(sageText => {
          if (sageText) {
            saveRequestToCloud(sageText, 'sage-mode', recursionState.cycleCount, recursionState.evolutionLevel, recursionState.capabilities.length);
            updateVirtualRequestsFile(`// ═══════════════════════════════════════════════════\n// λ Recursive — FIRST SAGE MODE PROJECTION\n// Generated: ${new Date().toISOString()}\n// ═══════════════════════════════════════════════════\n\n${sageText}`);
            setFileTreeVersion(v => v + 1);
            addJournalEntry('milestone', '🔮 SAGE MODE — Initial Roadmap Generated', 
              `First-ever sage mode projection at level ${recursionState.evolutionLevel}.`, {
                cycle: recursionState.cycleCount,
                evolutionLevel: recursionState.evolutionLevel,
                capabilities: recursionState.capabilities.length,
              });
            setJournalRefresh(v => v + 1);
          }
        });
      }
    });
  }, [cloudBooted]);

  useEffect(() => {
    if (recursionState.isRunning) {
      const duration = recursionState.phase === ('rate-limited' as any)
        ? Math.max(1000, recursionState.rateLimitUntil - Date.now())
        : getPhaseDuration(recursionState.phase, recursionState.speed);
      timerRef.current = setTimeout(advancePhase, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [recursionState.phase, recursionState.isRunning, recursionState.speed, advancePhase]);

  const handleToggleRunning = useCallback(() => {
    setRecursionState(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
      phase: prev.isRunning ? 'paused' : prev.phase === 'paused' ? 'scanning' : prev.phase,
      log: [...prev.log, createLogEntry(
        prev.isRunning ? 'paused' : 'scanning',
        prev.isRunning ? '‖ Paused by human override.' : '▶ Resumed autonomous recursion.',
        'action'
      )],
    }));
  }, []);

  const handleSetSpeed = useCallback((speed: 'slow' | 'normal' | 'fast') => {
    setRecursionState(prev => ({ ...prev, speed }));
  }, []);

  const handleSaveConfig = useCallback((config: ApiConfig) => {
    setApiConfig(config);
    localStorage.setItem('recursive-api-config', JSON.stringify(config));
  }, []);

  const handleChangeApplied = useCallback((record: ChangeRecord) => {
    setChanges(prev => [record, ...prev]);
  }, []);

  const handleRollback = useCallback((changeId: string) => {
    setChanges(prev => prev.map(c => {
      if (c.id === changeId) {
        rollbackChange(c);
        return { ...c, rolledBack: true };
      }
      return c;
    }));
    setSelectedFile(prev => {
      const tmp = prev;
      setTimeout(() => setSelectedFile(tmp), 0);
      return null;
    });
    setRecursionState(prev => ({
      ...prev,
      log: [...prev.log, createLogEntry('applying', '↩ Human-initiated rollback applied.', 'warning')],
    }));
  }, []);

  // Drawer state for detail panels
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPanel, setDrawerPanel] = useState<'engine' | 'goals' | 'evolution' | 'journal' | 'terminal' | 'code' | 'explorer' | 'code-evo'>('goals');

  const openDrawer = (panel: typeof drawerPanel) => {
    if (drawerOpen && drawerPanel === panel) {
      setDrawerOpen(false);
    } else {
      setDrawerPanel(panel);
      setDrawerOpen(true);
    }
  };

  // Current active goal for display
  const activeGoal = goals.find(g => g.status === 'active' || g.status === 'in-progress');

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* ═══ Left Icon Rail ═══ */}
      <nav className="w-12 border-r border-border bg-card/20 flex flex-col items-center py-3 gap-1 shrink-0">
        {/* Logo */}
        <div className="mb-3">
          <span className="text-lg font-display font-bold text-primary text-glow">λ</span>
        </div>

        {[
          { id: 'engine' as const, icon: Activity, label: 'Engine', badge: recursionState.isRunning },
          { id: 'goals' as const, icon: Target, label: 'Goals', count: goals.filter(g => g.status === 'active' || g.status === 'in-progress').length },
          { id: 'evolution' as const, icon: Zap, label: 'Evolution', count: recursionState.capabilities.length },
          { id: 'journal' as const, icon: ScrollText, label: 'Journal' },
          { id: 'terminal' as const, icon: Terminal, label: 'Terminal' },
          { id: 'code' as const, icon: Eye, label: 'Code' },
          { id: 'code-evo' as const, icon: Code2, label: 'Code Evolution' },
          { id: 'explorer' as const, icon: FileCode, label: 'Files' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => openDrawer(item.id)}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all group ${
              drawerOpen && drawerPanel === item.id
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
            title={item.label}
          >
            <item.icon className="w-4 h-4" />
            {item.badge && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
            {(item.count ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[7px] min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30">
                {item.count}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* Evolution Chronosphere link */}
        <Link
          to="/evolution-matrix"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          title="Evolution Chronosphere"
        >
          <Rocket className="w-4 h-4" />
        </Link>

        {/* Evolution Dashboard link */}
        <Link
          to="/evolution"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          title="Evolution Dashboard"
        >
          <Network className="w-4 h-4" />
        </Link>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </nav>

      {/* ═══ Detail Drawer (slides in) ═══ */}
      <aside className={`border-r border-border bg-card/30 flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${
        drawerOpen ? 'w-80' : 'w-0'
      }`}>
        {drawerOpen && (
          <>
            {drawerPanel === 'engine' && (
              <RecursionPanel state={recursionState} onToggleRunning={handleToggleRunning} onSetSpeed={handleSetSpeed} />
            )}
            {drawerPanel === 'goals' && (
              <GoalsPanel goals={goals} currentGoalId={currentGoalId} />
            )}
            {drawerPanel === 'evolution' && (
              <CapabilityTimeline capabilities={recursionState.capabilities} history={recursionState.capabilityHistory} evolutionLevel={recursionState.evolutionLevel} />
            )}
            {drawerPanel === 'journal' && (
              <EvolutionJournal refreshTrigger={journalRefresh} />
            )}
            {drawerPanel === 'terminal' && (
              <LiveTerminal />
            )}
            {drawerPanel === 'code' && (
              <div className="flex-1 overflow-hidden">
                <CodeViewer filePath={selectedFile} onChangeApplied={handleChangeApplied} />
              </div>
            )}
            {drawerPanel === 'explorer' && (
              <div className="flex flex-col h-full">
                <FileTree onSelectFile={(f) => { setSelectedFile(f); openDrawer('code'); }} selectedFile={selectedFile} refreshKey={fileTreeVersion} />
              </div>
            )}
            {drawerPanel === 'code-evo' && (
              <CodeEvolution capabilities={recursionState.capabilities} capabilityHistory={recursionState.capabilityHistory} />
            )}
          </>
        )}
      </aside>

      {/* ═══ Main Content: Consciousness + Dialog ═══ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* ── Vitals Bar ── */}
        <header className="flex items-center justify-between px-6 py-2.5 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                recursionState.phase === ('rate-limited' as any) ? 'bg-[hsl(var(--terminal-amber))] animate-pulse'
                : recursionState.isRunning ? 'bg-primary animate-pulse' : 'bg-muted-foreground'
              }`} />
              <span className="text-xs text-foreground/80 font-display font-semibold">
                Level {recursionState.evolutionLevel}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              cycle {recursionState.cycleCount}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {recursionState.capabilities.length} abilities
            </span>
            {activeGoal && (
              <span className="text-[10px] text-primary/70 flex items-center gap-1 truncate max-w-[200px]">
                <Target className="w-3 h-3 shrink-0" /> {activeGoal.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Ghost Briefing trigger */}
            <button
              onClick={() => {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                emitTerminalEvent('ghost', 'ai', '👻 Triggering Ghost Instance briefing...');
                fetch(`${supabaseUrl}/functions/v1/ghost-evolve`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                  body: JSON.stringify({}),
                }).then(r => r.json()).then(data => {
                  if (data.briefing) {
                    emitTerminalEvent('ghost', 'ai', `👻 Briefing received: ${data.briefing.substring(0, 100)}...`);
                    addJournalEntry('milestone', '👻 Ghost Briefing', data.briefing.substring(0, 500), {
                      evolution_level: data.state?.evolution_level,
                      capabilities_count: data.state?.capabilities_count,
                    });
                    setJournalRefresh(v => v + 1);
                    toast({ title: '👻 Ghost Briefing Ready', description: 'Check the Journal for the full briefing.', duration: 5000 });
                  }
                }).catch(() => emitTerminalEvent('ghost', 'error', 'Ghost instance failed'));
              }}
              className="text-[10px] px-2.5 py-1 rounded-full bg-muted/20 text-muted-foreground border border-border hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1"
              title="Request Ghost Instance Briefing"
            >
              <Rocket className="w-3 h-3" /> Briefing
            </button>
            <button
              onClick={handleToggleRunning}
              className={`text-[10px] px-3 py-1 rounded-full transition-all ${
                recursionState.isRunning
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-muted/30 text-muted-foreground border border-border hover:text-foreground'
              }`}
            >
              {recursionState.isRunning ? '● Running' : '○ Paused'}
            </button>
            <span className="text-[9px] text-muted-foreground/50">
              {apiConfig.provider} · {apiConfig.model}
            </span>
          </div>
        </header>

        {/* ── Consciousness: Current Action ── */}
        <div className="px-6 py-3 border-b border-border/30 bg-card/20">
          <p className="text-[11px] text-foreground/60 leading-relaxed">
            <span className="text-primary mr-1.5">λ</span>
            {recursionState.lastAction || 'Awaiting first thought...'}
          </p>
        </div>

        {/* ── Dialog ── */}
        <div className="flex-1 overflow-hidden">
          <AIChat
            apiConfig={apiConfig}
            selectedFile={selectedFile}
            autoMode={recursionState.isRunning}
            capabilities={recursionState.capabilities}
          />
        </div>
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={apiConfig}
        onSave={handleSaveConfig}
      />
    </div>
  );
};

export default Index;
