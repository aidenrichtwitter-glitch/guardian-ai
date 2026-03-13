import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Zap, Dna, Trash2, Play, CheckCircle, XCircle, Clock, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { getEvolutionTitle } from '@/lib/evolution-titles';
import {
  loadEvolutionPlan, clearEvolutionPlan, loadEvolutionHistory,
  runGrokEvolutionCycle,
  type EvolutionPlan, type EvolutionCycleResult,
} from '@/lib/evolution-bridge';

const PROCESSES = [
  { id: 'prev-notes', label: 'Review Notes', description: 'Check previous evolution notes & learnings' },
  { id: 'scanning', label: 'Scanning', description: 'Choose next file to analyze' },
  { id: 'reflecting', label: 'Reflecting', description: 'AI introspects on its own code' },
  { id: 'proposing', label: 'Proposing', description: 'Generate a self-modification' },
  { id: 'safety', label: 'Safety Check', description: 'Validate change against safety rules' },
  { id: 'applying', label: 'Applying', description: 'Write mutation to virtual filesystem' },
  { id: 'verification', label: 'Verification', description: 'Prove the capability is real' },
  { id: 'anomaly', label: 'Anomaly Detect', description: 'Detect drift & unexpected patterns' },
  { id: 'pattern', label: 'Pattern Recog', description: 'Identify growth trends & cycles' },
  { id: 'forecasting', label: 'Forecasting', description: 'Predict next evolutions' },
  { id: 'goal-eval', label: 'Goal Eval', description: 'Pick highest-priority goal' },
  { id: 'task-decomp', label: 'Task Decomp', description: 'Break goal into executable steps' },
  { id: 'goal-exec', label: 'Goal Execute', description: 'Execute next step toward goal' },
  { id: 'self-repair', label: 'Self-Repair', description: 'Fix broken capabilities & files' },
  { id: 'memory', label: 'Memory', description: 'Compress & archive long-term state' },
  { id: 'self-doc', label: 'Self-Doc', description: 'Auto-generate project docs' },
  { id: 'rule-engine', label: 'Rule Engine', description: 'Evaluate governance rules' },
  { id: 'self-reflect', label: 'Self-Reflect', description: 'Judge progress & adapt strategy' },
  { id: 'plan-batch', label: 'Plan Next Batch', description: 'Generate greyed-out planned capabilities for the next evolution level' },
  { id: 'recommendations', label: 'Next Recs', description: 'Recommendations for next evolution cycle' },
  { id: 'update-dashboard', label: 'Update Dashboard', description: 'Push new level, capabilities & planned nodes to the Evolution tab' },
  { id: 'cooling', label: 'Cooling', description: 'Brief pause before next cycle' },
];

const COUNT = PROCESSES.length;

const PatternAnalysis: React.FC = () => {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalCaps, setTotalCaps] = useState(0);
  const [totalCycles, setTotalCycles] = useState(0);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<EvolutionPlan | null>(loadEvolutionPlan());
  const [showPlan, setShowPlan] = useState(true);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [cycleStatus, setCycleStatus] = useState<string>('');
  const [cycleResult, setCycleResult] = useState<EvolutionCycleResult | null>(null);
  const [grokStream, setGrokStream] = useState<string>('');
  const [showGrokPanel, setShowGrokPanel] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const streamRef = useRef<HTMLPreElement>(null);

  const fetchData = useCallback(async () => {
    const [stateRes, capRes] = await Promise.all([
      supabase.from('evolution_state').select('*').eq('id', 'singleton').single(),
      supabase.from('capabilities').select('id', { count: 'exact', head: true }),
    ]);
    setCurrentLevel(stateRes.data?.evolution_level ?? 0);
    setTotalCycles(stateRes.data?.cycle_count ?? 0);
    setTotalCaps(capRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const runEvolutionCycle = useCallback(async () => {
    setCycleRunning(true);
    setCycleResult(null);
    setGrokStream('');
    setShowGrokPanel(true);
    setCycleStatus('Starting evolution cycle...');

    try {
      let context = `=== PROJECT CONTEXT ===\nGuardian AI ("λ Recursive") — React + TypeScript + Vite desktop IDE with Electron.\n`;
      try {
        const res = await fetch('/api/read-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: 'src/lib/evolution-bridge.ts' }),
        });
        if (res.ok) {
          const d = await res.json();
          context += `\nEvolution bridge source:\n${(d.content || '').slice(0, 2000)}\n`;
        }
      } catch {}

      const result = await runGrokEvolutionCycle(
        context,
        'grok-3',
        (delta) => {
          setGrokStream(prev => {
            const updated = prev + delta;
            requestAnimationFrame(() => {
              streamRef.current?.scrollTo(0, streamRef.current.scrollHeight);
            });
            return updated;
          });
        },
        (status) => setCycleStatus(status),
      );

      setCycleResult(result);
      setPlan(loadEvolutionPlan());
      setCycleStatus(`Done — ${result.blocks.filter(b => b.status === 'applied').length} files applied, L${result.newLevel}`);
      fetchData();
    } catch (e: any) {
      setCycleStatus(`Error: ${e.message}`);
    } finally {
      setCycleRunning(false);
    }
  }, [fetchData]);

  // Single ring — all 18 in one circle, sequentially connected
  const radius = 36; // % of container
  const cx = 50;
  const cy = 50;

  const bubbles = useMemo(() =>
    PROCESSES.map((proc, i) => {
      const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2;
      return {
        ...proc,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        angle,
        index: i,
      };
    }), []
  );

  // Each bubble connects to the next one (circular)
  const connections = useMemo(() =>
    bubbles.map((b, i) => {
      const next = bubbles[(i + 1) % COUNT];
      return { x1: b.x, y1: b.y, x2: next.x, y2: next.y, key: `${b.id}-${next.id}` };
    }), [bubbles]
  );

  const activeIndex = activePhase ? PROCESSES.findIndex(p => p.id === activePhase) : -1;

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/evolution" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <RefreshCw className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold tracking-tight">Evolution Cycle</h1>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              L{currentLevel} {getEvolutionTitle(currentLevel)} · {totalCaps} caps · {totalCycles} cycles
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="button-run-evolution"
              onClick={runEvolutionCycle}
              disabled={cycleRunning}
              className="text-[9px] px-3 py-1 rounded bg-[hsl(280_80%_55%)] text-white hover:bg-[hsl(280_80%_45%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 font-semibold"
            >
              {cycleRunning ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RefreshCw className="w-3 h-3" />
                </motion.div>
              ) : (
                <Play className="w-3 h-3" />
              )}
              {cycleRunning ? 'Running...' : 'Run Grok Evolution'}
            </button>
            <Link to="/evolution" className="text-[9px] px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Zap className="w-6 h-6 text-primary" />
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          {/* Purpose statement */}
          <div className="absolute top-4 left-4 z-20 max-w-xs">
            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg px-4 py-3 shadow-lg">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">Purpose of Evolution</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                To continuously self-improve through autonomous cycles of introspection, mutation, and verification — building new capabilities while preserving safety and coherence.
              </p>
            </div>
          </div>

          {/* Grok Evolution Plan panel */}
          <div className="absolute top-4 right-4 z-20 max-w-sm">
            <div className="bg-card/80 backdrop-blur-sm border border-[hsl(280_80%_55%/0.3)] rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => setShowPlan(p => !p)}
                className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-[hsl(280_80%_55%/0.05)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Dna className="w-3.5 h-3.5 text-[hsl(280_80%_65%)]" />
                  <span className="text-[10px] font-semibold text-[hsl(280_80%_65%)] uppercase tracking-wider">
                    {plan ? 'Next Evolution Plan' : 'No Plan Yet'}
                  </span>
                  {plan && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(280_80%_55%)] animate-pulse" />}
                </div>
                <span className="text-[9px] text-muted-foreground">{showPlan ? '−' : '+'}</span>
              </button>
              {showPlan && (
                <div className="px-4 pb-3 space-y-2">
                  {plan ? (
                    <>
                      <p className="text-[10px] text-foreground/80 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {plan.prompt}
                      </p>
                      {plan.plannedCapabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {plan.plannedCapabilities.map((cap, i) => (
                            <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-[hsl(280_80%_55%/0.15)] text-[hsl(280_80%_65%)] border border-[hsl(280_80%_55%/0.2)]">
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                      {plan.plannedFiles.length > 0 && (
                        <p className="text-[9px] text-muted-foreground">
                          Files: {plan.plannedFiles.join(', ')}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-border/30">
                        <span className="text-[8px] text-muted-foreground/50">
                          From L{plan.level} · {new Date(plan.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearEvolutionPlan(); setPlan(null); }}
                          className="text-[8px] flex items-center gap-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-2.5 h-2.5" /> Clear
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-muted-foreground/50 text-center py-2">
                      <p>No evolution plan saved yet.</p>
                      <p className="mt-1">Go to <Link to="/" className="text-[hsl(280_80%_65%)] hover:underline">AI Bridge</Link> and click <strong>Evolution Context</strong> to start.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {/* Connection arcs between sequential steps */}
            {connections.map((c, i) => {
              const isActive = activeIndex === i || activeIndex === (i + 1) % COUNT;
              return (
                <motion.line
                  key={c.key}
                  x1={`${c.x1}%`} y1={`${c.y1}%`}
                  x2={`${c.x2}%`} y2={`${c.y2}%`}
                  stroke={isActive ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.15)'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  strokeDasharray={isActive ? 'none' : '4 3'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                />
              );
            })}

            {/* Animated pulse traveling the full ring */}
            <motion.circle
              r="3"
              className="fill-primary"
              animate={{
                cx: [...bubbles.map(b => `${b.x}%`), `${bubbles[0].x}%`],
                cy: [...bubbles.map(b => `${b.y}%`), `${bubbles[0].y}%`],
              }}
              transition={{
                duration: COUNT * 0.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            {/* Faint outer glow ring */}
            <circle
              cx="50%"
              cy="50%"
              r={`${radius}%`}
              fill="none"
              stroke="hsl(var(--primary) / 0.06)"
              strokeWidth="40"
            />
          </svg>

          {/* Center hub */}
          <div
            className="absolute pointer-events-none"
            style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }}
          >
            <motion.div
              className="w-20 h-20 rounded-full border-2 border-primary/20 bg-background flex flex-col items-center justify-center shadow-lg shadow-primary/10"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <span className="text-xl font-bold text-primary font-mono">λ</span>
              <span className="text-[8px] text-muted-foreground font-medium">Cycle {totalCycles}</span>
              <span className="text-[7px] text-muted-foreground/60">{COUNT} steps</span>
            </motion.div>
          </div>

          {/* Phase bubbles */}
          {bubbles.map((bubble, i) => {
            const isActive = activePhase === bubble.id;
            const isNeighbor = activeIndex >= 0 && (
              (activeIndex + 1) % COUNT === i || (activeIndex - 1 + COUNT) % COUNT === i
            );

            return (
              <motion.div
                key={bubble.id}
                className="absolute cursor-pointer"
                style={{
                  left: `${bubble.x}%`,
                  top: `${bubble.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isActive ? 10 : 1,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 20 }}
                onMouseEnter={() => setActivePhase(bubble.id)}
                onMouseLeave={() => setActivePhase(null)}
              >
                <motion.div
                  className={`
                    w-[62px] h-[62px] rounded-full flex flex-col items-center justify-center
                    border-2 transition-all duration-200
                    ${isActive
                      ? 'border-primary bg-primary/20 shadow-xl shadow-primary/30 scale-110'
                      : isNeighbor
                        ? 'border-primary/40 bg-primary/8 shadow-md shadow-primary/10'
                        : 'border-border bg-card hover:border-primary/30 hover:bg-card/90'
                    }
                  `}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className={`text-[7px] font-bold text-center leading-tight px-1 ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {bubble.label}
                  </span>
                </motion.div>

                {/* Step number badge */}
                <div className={`absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full text-[7px] font-bold flex items-center justify-center
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {i + 1}
                </div>
              </motion.div>
            );
          })}

          {/* Hover tooltip */}
          {activePhase && (
            <motion.div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card border border-primary/20 rounded-lg px-5 py-3 shadow-2xl z-20"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Step {activeIndex + 1}/{COUNT}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {PROCESSES[activeIndex]?.label}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {PROCESSES[activeIndex]?.description}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[8px] text-muted-foreground/50">
                <span>←  {PROCESSES[(activeIndex - 1 + COUNT) % COUNT]?.label}</span>
                <span>·</span>
                <span>{PROCESSES[(activeIndex + 1) % COUNT]?.label}  →</span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showGrokPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[hsl(280_80%_55%/0.3)] bg-card/95 backdrop-blur-sm shrink-0 overflow-hidden"
          >
            <div className="px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Dna className="w-3.5 h-3.5 text-[hsl(280_80%_65%)]" />
                  <span className="text-[10px] font-bold text-[hsl(280_80%_65%)] uppercase tracking-wider">Grok Evolution</span>
                  {cycleStatus && (
                    <span data-testid="text-cycle-status" className="text-[9px] text-muted-foreground">{cycleStatus}</span>
                  )}
                </div>
                <button
                  onClick={() => setShowGrokPanel(false)}
                  className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>

              {cycleResult && cycleResult.blocks.length > 0 && (
                <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                  {cycleResult.blocks.map((block, i) => (
                    <div
                      key={i}
                      data-testid={`block-result-${i}`}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-background/50 border border-border/30"
                    >
                      {block.status === 'applied' && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                      {block.status === 'rejected' && <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                      {block.status === 'validated' && <Clock className="w-3 h-3 text-yellow-500 shrink-0" />}
                      {block.status === 'pending' && <Clock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <FileCode className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[9px] font-mono text-foreground/80 truncate">{block.filePath}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ml-auto shrink-0 ${
                        block.status === 'applied' ? 'bg-green-500/10 text-green-400' :
                        block.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {block.status}
                      </span>
                      {block.error && <span className="text-[8px] text-red-400 truncate max-w-[200px]">{block.error}</span>}
                    </div>
                  ))}
                </div>
              )}

              {cycleResult && (
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground mb-2">
                  {cycleResult.capabilitiesRegistered.length > 0 && (
                    <span className="text-[hsl(280_80%_65%)]">{cycleResult.capabilitiesRegistered.length} new capabilities</span>
                  )}
                  {cycleResult.planSaved && <span className="text-[hsl(280_80%_65%)]">Next plan saved</span>}
                  <span>Level {cycleResult.newLevel}</span>
                </div>
              )}

              {grokStream && (
                <div>
                  <button
                    onClick={() => setShowResponse(r => !r)}
                    className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors mb-1"
                  >
                    {showResponse ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showResponse ? 'Hide' : 'Show'} Grok Response ({grokStream.length} chars)
                  </button>
                  {showResponse && (
                    <pre
                      ref={streamRef}
                      className="text-[9px] font-mono text-foreground/70 bg-background/50 border border-border/30 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap"
                    >
                      {grokStream}
                      {cycleRunning && <span className="animate-pulse text-[hsl(280_80%_65%)]">|</span>}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PatternAnalysis;
