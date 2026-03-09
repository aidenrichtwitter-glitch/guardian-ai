import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { getEvolutionTitle } from '@/lib/evolution-titles';

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
  { id: 'recommendations', label: 'Next Recs', description: 'Recommendations for next evolution cycle' },
  { id: 'cooling', label: 'Cooling', description: 'Brief pause before next cycle' },
];

const COUNT = PROCESSES.length;

const PatternAnalysis: React.FC = () => {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalCaps, setTotalCaps] = useState(0);
  const [totalCycles, setTotalCycles] = useState(0);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
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
          <Link to="/evolution" className="text-[9px] px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
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
    </div>
  );
};

export default PatternAnalysis;
