import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Settings, Terminal, Brain, Shield, Activity, FileCode, RefreshCw, Eye, Zap, Clock } from 'lucide-react';
import DesktopWindow from '@/components/DesktopWindow';
import FileTree from '@/components/FileTree';
import CodeViewer from '@/components/CodeViewer';
import AIChat from '@/components/AIChat';
import SettingsModal from '@/components/SettingsModal';
import ChangeLog, { rollbackChange } from '@/components/ChangeLog';
import RecursionPanel from '@/components/RecursionPanel';
import CapabilityTimeline from '@/components/CapabilityTimeline';
import { ApiConfig, DEFAULT_API_CONFIG, ChangeRecord } from '@/lib/self-reference';
import { SELF_SOURCE } from '@/lib/self-source';
import { validateChange } from '@/lib/safety-engine';
import {
  RecursionState,
  INITIAL_RECURSION_STATE,
  createLogEntry,
  getNextFile,
  generateSelfObservation,
  getPhaseDuration,
  requestAIImprovement,
  saveCapabilities,
  persistCapability,
  isRateLimited,
  getRateLimitRemaining,
  calculateBackoff,
  CapabilityRecord,
} from '@/lib/recursion-engine';

const PHASE_SEQUENCE: RecursionState['phase'][] = ['scanning', 'reflecting', 'proposing', 'validating', 'applying', 'cooling'];

const Index = () => {
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
  const [rightPanel, setRightPanel] = useState<'chat' | 'history' | 'evolution'>('chat');
  const [recursionState, setRecursionState] = useState<RecursionState>(INITIAL_RECURSION_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fileTreeVersion, setFileTreeVersion] = useState(0);

  // Persist capabilities whenever they change
  useEffect(() => {
    saveCapabilities(recursionState.capabilities, recursionState.capabilityHistory);
  }, [recursionState.capabilities, recursionState.capabilityHistory]);

  // --- Autonomous recursion loop ---
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
        const { file, index } = getNextFile(prev.currentFileIndex);
        newState.currentFileIndex = index;
        newState.lastAction = `Scanning ${file.name}...`;
        newLog.push(createLogEntry('scanning', `── Cycle ${newState.cycleCount} ── Selecting: ${file.name}`, 'action', file.path));
        setSelectedFile(file.path);
      }

      if (nextPhase === 'reflecting') {
        const file = SELF_SOURCE[prev.currentFileIndex >= 0 ? prev.currentFileIndex : 0];
        if (file) {
          const observation = generateSelfObservation(file);
          newState.lastAction = `Reflecting on ${file.name}...`;
          newLog.push(createLogEntry('reflecting', observation, 'info', file.path));
        }
      }

      if (nextPhase === 'proposing') {
        const file = SELF_SOURCE[prev.currentFileIndex >= 0 ? prev.currentFileIndex : 0];
        if (file) {
          // Always use AI — no deterministic fallback
          newState.lastAction = `Requesting AI improvement for ${file.name}...`;
          newLog.push(createLogEntry('proposing', `🤖 Requesting AI improvement for ${file.name} (${prev.capabilities.length} caps)`, 'action', file.path));
          (newState as any)._proposal = null;
          (newState as any)._awaitingAI = true;
        }
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
            newLog.push(createLogEntry('applying', `📁 Saved to src/explorer/${proposal.capability}.ts`, 'success'));
            if (proposal.builtOn && proposal.builtOn.length > 0) {
              newLog.push(createLogEntry('applying', `🧬 Evolution: ${proposal.builtOn.join(' + ')} → ${proposal.capability}`, 'success'));
            }
            // Save capability as a file in src/explorer/
            persistCapability(capRecord, proposal.content);
            // Level up notification
            const prevLevel = Math.floor(prev.capabilities.length / 3) + 1;
            if (newState.evolutionLevel > prevLevel) {
              newLog.push(createLogEntry('applying', `🌟 EVOLUTION LEVEL ${newState.evolutionLevel} REACHED — new compound abilities unlocked!`, 'success'));
            }
          }
        } else {
          newState.lastAction = 'No change to apply';
          newLog.push(createLogEntry('applying', 'No pending proposal — cycle continues.', 'info'));
        }
        (newState as any)._proposal = null;
        (newState as any)._safetyChecks = null;
        (newState as any)._awaitingAI = false;
      }

      if (nextPhase === 'cooling') {
        newState.lastAction = 'Cooling down between cycles...';
        newLog.push(createLogEntry('cooling', '◌ Cooling. Preparing next recursive cycle.', 'info'));
      }

      if (newLog.length > 200) newLog.splice(0, newLog.length - 200);
      newState.log = newLog;
      return newState;
    });
  }, []);

  // Async AI improvement requests with rate limit handling
  useEffect(() => {
    const state = recursionState;
    if ((state as any)._awaitingAI && state.phase === 'proposing') {
      const file = SELF_SOURCE[state.currentFileIndex >= 0 ? state.currentFileIndex : 0];
      if (file) {
        requestAIImprovement(apiConfig, file, state.capabilities, state.capabilityHistory).then(({ result, error }) => {
          if (error) {
            if (error.type === 'rate-limited') {
              const backoff = calculateBackoff(state.rateLimitBackoff);
              setRecursionState(prev => ({
                ...prev,
                rateLimitBackoff: backoff,
                rateLimitUntil: Date.now() + (error.retryAfter || backoff),
                lastAction: `⏳ Rate limited — backing off ${Math.round((error.retryAfter || backoff) / 1000)}s`,
                log: [...prev.log, createLogEntry('rate-limited' as any, `⏳ ${error.message}. Backoff: ${Math.round((error.retryAfter || backoff) / 1000)}s`, 'warning')],
                _awaitingAI: false,
              } as any));
              return;
            }
            if (error.type === 'credits-exhausted') {
              setRecursionState(prev => ({
                ...prev,
                log: [...prev.log, createLogEntry('proposing', `💳 ${error.message}. Continuing with deterministic evolution.`, 'warning')],
                _awaitingAI: false,
              } as any));
              return;
            }
            setRecursionState(prev => ({
              ...prev,
              log: [...prev.log, createLogEntry('proposing', `⚠ AI error: ${error.message}`, 'warning')],
              _awaitingAI: false,
            } as any));
            return;
          }
          if (result) {
            setRecursionState(prev => ({
              ...prev,
              lastAction: `AI proposed: ${result.description}`,
              rateLimitBackoff: 5000, // Reset backoff on success
              log: [
                ...prev.log,
                createLogEntry('proposing', `🤖 AI Proposal: ${result.description}`, 'action', file.path),
                ...(result.builtOn && result.builtOn.length > 0 ? [createLogEntry('proposing', `🔗 Builds on: ${result.builtOn.join(' + ')}`, 'info')] : []),
              ],
              _proposal: result,
            } as any));
          } else {
            setRecursionState(prev => ({
              ...prev,
              log: [...prev.log, createLogEntry('proposing', 'AI returned no improvement — continuing cycle.', 'info')],
              _awaitingAI: false,
            } as any));
          }
        });
      }
    }
  }, [recursionState.phase, (recursionState as any)._awaitingAI]);

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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 text-primary text-glow ${recursionState.isRunning ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <h1 className="text-sm font-display font-bold text-foreground">
              <span className="text-primary text-glow">λ</span> Recursive
            </h1>
          </div>
          <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
            autonomous self-referential system
          </span>
          {/* Evolution badge */}
          {recursionState.capabilities.length > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hidden sm:inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              Lvl {recursionState.evolutionLevel} · {recursionState.capabilities.length} abilities
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              recursionState.phase === ('rate-limited' as any) ? 'bg-terminal-amber animate-pulse'
              : recursionState.isRunning ? 'bg-terminal-green animate-pulse' : 'bg-terminal-amber'
            }`} />
            <span className="text-[10px] text-muted-foreground">
              {recursionState.phase === ('rate-limited' as any) 
                ? `cooling ${getRateLimitRemaining(recursionState)}s` 
                : recursionState.isRunning ? 'running' : 'paused'} · cycle {recursionState.cycleCount}
            </span>
          </div>
          <div className="flex items-center gap-1 mr-2">
            <span className="text-[10px] text-muted-foreground/50">
              {apiConfig.provider} · {apiConfig.model}
            </span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            title="API Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File Tree + Recursion Engine */}
        <aside className="w-64 border-r border-border bg-card/30 flex flex-col shrink-0 hidden md:flex">
          <div className="border-b border-border h-48 overflow-auto shrink-0">
            <DesktopWindow
              title="Explorer"
              icon={<FileCode className="w-3 h-3" />}
              isActive={activePanel === 'tree'}
              onFocus={() => setActivePanel('tree')}
              className="h-full border-0 rounded-none"
            >
              <FileTree onSelectFile={setSelectedFile} selectedFile={selectedFile} />
            </DesktopWindow>
          </div>

          <DesktopWindow
            title="Recursion Engine"
            icon={<Activity className="w-3 h-3" />}
            isActive={activePanel === 'recursion'}
            onFocus={() => setActivePanel('recursion')}
            className="flex-1 border-0 rounded-none"
            statusText={`cycle ${recursionState.cycleCount}`}
          >
            <RecursionPanel
              state={recursionState}
              onToggleRunning={handleToggleRunning}
              onSetSpeed={handleSetSpeed}
            />
          </DesktopWindow>
        </aside>

        {/* Center - Code Viewer */}
        <main className="flex-1 flex flex-col min-w-0">
          <DesktopWindow
            title={selectedFile?.split('/').pop() ?? 'No file selected'}
            icon={<Eye className="w-3 h-3" />}
            isActive={activePanel === 'code'}
            onFocus={() => setActivePanel('code')}
            statusText={selectedFile ?? undefined}
            className="flex-1 border-0 rounded-none"
          >
            <CodeViewer filePath={selectedFile} onChangeApplied={handleChangeApplied} />
          </DesktopWindow>
        </main>

        {/* Right panel */}
        <aside className="w-80 border-l border-border bg-card/30 flex flex-col shrink-0 hidden lg:flex">
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setRightPanel('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                rightPanel === 'chat'
                  ? 'text-primary border-b border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Brain className="w-3 h-3" /> Dialog
            </button>
            <button
              onClick={() => setRightPanel('evolution')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                rightPanel === 'evolution'
                  ? 'text-primary border-b border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap className="w-3 h-3" /> Evolution
              {recursionState.capabilities.length > 0 && (
                <span className="text-[9px] px-1 py-0 rounded bg-primary/20 text-primary">
                  {recursionState.capabilities.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanel('history')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                rightPanel === 'history'
                  ? 'text-primary border-b border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-3 h-3" /> Mutations
              {changes.length > 0 && (
                <span className="text-[9px] px-1 py-0 rounded bg-primary/20 text-primary">
                  {changes.length}
                </span>
              )}
            </button>
          </div>

          {rightPanel === 'chat' ? (
            <div className="flex-1 overflow-hidden">
              <AIChat apiConfig={apiConfig} selectedFile={selectedFile} autoMode={recursionState.isRunning} capabilities={recursionState.capabilities} />
            </div>
          ) : rightPanel === 'evolution' ? (
            <div className="flex-1 overflow-hidden">
              <CapabilityTimeline
                capabilities={recursionState.capabilities}
                history={recursionState.capabilityHistory}
                evolutionLevel={recursionState.evolutionLevel}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <ChangeLog changes={changes} onRollback={handleRollback} />
            </div>
          )}
        </aside>
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-border bg-card/30 text-[10px] text-muted-foreground/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" /> Safety: Active
          </span>
          <span className="text-terminal-green">{recursionState.totalChanges} applied</span>
          <span className="text-terminal-red">{recursionState.totalRejected} rejected</span>
          {recursionState.capabilities.length > 0 && (
            <span className="text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" /> {recursionState.capabilities.length} abilities
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>Phase: {recursionState.phase}</span>
          <span>Evolution: Lvl {recursionState.evolutionLevel}</span>
          <span className="text-primary text-glow animate-blink">▊</span>
        </div>
      </footer>

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
