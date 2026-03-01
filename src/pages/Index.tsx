import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Settings, Terminal, Brain, Shield, Activity, FileCode, RefreshCw, Eye } from 'lucide-react';
import DesktopWindow from '@/components/DesktopWindow';
import FileTree from '@/components/FileTree';
import CodeViewer from '@/components/CodeViewer';
import AIChat from '@/components/AIChat';
import SettingsModal from '@/components/SettingsModal';
import ChangeLog, { rollbackChange } from '@/components/ChangeLog';
import RecursionPanel from '@/components/RecursionPanel';
import { ApiConfig, DEFAULT_API_CONFIG, ChangeRecord } from '@/lib/self-reference';
import { SELF_SOURCE } from '@/lib/self-source';
import { validateChange } from '@/lib/safety-engine';
import {
  RecursionState,
  INITIAL_RECURSION_STATE,
  createLogEntry,
  getNextFile,
  generateSelfObservation,
  attemptSelfImprovement,
  getPhaseDuration,
} from '@/lib/recursion-engine';

const PHASE_SEQUENCE: RecursionState['phase'][] = ['scanning', 'reflecting', 'proposing', 'validating', 'applying', 'cooling'];

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>('src/lib/self-reference.ts');
  const [activePanel, setActivePanel] = useState<string>('recursion');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    const saved = localStorage.getItem('recursive-api-config');
    return saved ? JSON.parse(saved) : DEFAULT_API_CONFIG;
  });
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [rightPanel, setRightPanel] = useState<'chat' | 'history'>('chat');
  const [recursionState, setRecursionState] = useState<RecursionState>(INITIAL_RECURSION_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Autonomous recursion loop ---
  const advancePhase = useCallback(() => {
    setRecursionState(prev => {
      if (!prev.isRunning) return prev;

      const currentPhaseIdx = PHASE_SEQUENCE.indexOf(prev.phase);
      const nextPhaseIdx = (currentPhaseIdx + 1) % PHASE_SEQUENCE.length;
      const nextPhase = PHASE_SEQUENCE[nextPhaseIdx];
      const newLog = [...prev.log];
      let newState = { ...prev, phase: nextPhase };

      // Cycle completed
      if (nextPhase === 'scanning') {
        newState.cycleCount = prev.cycleCount + 1;
        const { file, index } = getNextFile(prev.currentFileIndex);
        newState.currentFileIndex = index;
        newState.lastAction = `Scanning ${file.name}...`;
        newLog.push(createLogEntry('scanning', `── Cycle ${newState.cycleCount} ── Selecting: ${file.name}`, 'action', file.path));
        // Auto-select file in viewer
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
          const improvement = attemptSelfImprovement(file);
          if (improvement) {
            newState.lastAction = `Proposing: ${improvement.description}`;
            newLog.push(createLogEntry('proposing', `Proposal: ${improvement.description}`, 'action', file.path));
            // Store proposal in a temp spot via lastAction for the validate phase
            (newState as any)._proposal = improvement;
          } else {
            newState.lastAction = `No improvements needed for ${file.name}`;
            newLog.push(createLogEntry('proposing', `${file.name} — no modifications proposed. Moving on.`, 'info', file.path));
            (newState as any)._proposal = null;
          }
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
            newLog.push(createLogEntry('validating', `✓ Safety checks passed${warnings.length ? ` (${warnings.length} warnings)` : ''}`, 'success', file.path));
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
          // Apply the change
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
        } else {
          newState.lastAction = 'No change to apply';
          newLog.push(createLogEntry('applying', 'No pending proposal — cycle continues.', 'info'));
        }
        (newState as any)._proposal = null;
        (newState as any)._safetyChecks = null;
      }

      if (nextPhase === 'cooling') {
        newState.lastAction = 'Cooling down between cycles...';
        newLog.push(createLogEntry('cooling', '◌ Cooling. Preparing next recursive cycle.', 'info'));
      }

      // Keep log bounded
      if (newLog.length > 200) newLog.splice(0, newLog.length - 200);
      newState.log = newLog;

      return newState;
    });
  }, []);

  useEffect(() => {
    if (recursionState.isRunning) {
      const duration = getPhaseDuration(recursionState.phase, recursionState.speed);
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
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              recursionState.isRunning ? 'bg-terminal-green animate-pulse' : 'bg-terminal-amber'
            }`} />
            <span className="text-[10px] text-muted-foreground">
              {recursionState.isRunning ? 'running' : 'paused'} · cycle {recursionState.cycleCount}
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
          {/* File Tree - compact */}
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

          {/* Recursion Engine - main view */}
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

        {/* Right panel - AI Chat or History */}
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
              <Brain className="w-3 h-3" /> Self-Dialog
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
              <AIChat apiConfig={apiConfig} selectedFile={selectedFile} autoMode={recursionState.isRunning} />
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
        </div>
        <div className="flex items-center gap-3">
          <span>Phase: {recursionState.phase}</span>
          <span>Depth: ∞ → bounded</span>
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
