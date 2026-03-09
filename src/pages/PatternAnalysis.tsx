import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { getEvolutionTitle } from '@/lib/evolution-titles';

const PROCESSES = [
  { id: 'scanning', label: 'Scanning', description: 'Choose next file to analyze' },
  { id: 'reflecting', label: 'Reflecting', description: 'AI introspects on its own code' },
  { id: 'proposing', label: 'Proposing', description: 'Generate a self-modification' },
  { id: 'safety', label: 'Safety Check', description: 'Validate change against safety rules' },
  { id: 'applying', label: 'Applying', description: 'Write mutation to virtual filesystem' },
  { id: 'verification', label: 'Verification', description: 'Prove the capability is real' },
  { id: 'anomaly', label: 'Anomaly Detection', description: 'Detect drift & unexpected patterns' },
  { id: 'pattern', label: 'Pattern Recognition', description: 'Identify growth trends & cycles' },
  { id: 'forecasting', label: 'Forecasting', description: 'Predict next evolutions' },
  { id: 'goal-eval', label: 'Goal Evaluation', description: 'Pick highest-priority goal' },
  { id: 'task-decomp', label: 'Task Decomposition', description: 'Break goal into executable steps' },
  { id: 'goal-exec', label: 'Goal Execution', description: 'Execute next step toward goal' },
  { id: 'self-repair', label: 'Self-Repair', description: 'Fix broken capabilities & files' },
  { id: 'memory', label: 'Memory Consolidation', description: 'Compress & archive long-term state' },
  { id: 'self-doc', label: 'Self-Documentation', description: 'Auto-generate project docs' },
  { id: 'rule-engine', label: 'Rule Engine', description: 'Evaluate governance rules' },
  { id: 'self-reflect', label: 'Self-Reflection', description: 'Judge progress & adapt strategy' },
  { id: 'cooling', label: 'Cooling', description: 'Brief pause before next cycle' },
];

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

  const cx = 50;
  const cy = 50;
  const count = PROCESSES.length;

  // Two rings: inner (first 9) and outer (last 9)
  const innerCount = Math.ceil(count / 2);
  const outerCount = count - innerCount;
  const innerRadius = 22;
  const outerRadius = 38;

  const bubbles = PROCESSES.map((proc, i) => {
    const isInner = i < innerCount;
    const ring = isInner ? innerCount : outerCount;
    const idx = isInner ? i : i - innerCount;
    const angle = (idx / ring) * Math.PI * 2 - Math.PI / 2;
    const r = isInner ? innerRadius : outerRadius;
    return {
      ...proc,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      ring: isInner ? 'inner' : 'outer',
    };
  });

  // Sequential connections within each ring
  const innerBubbles = bubbles.filter(b => b.ring === 'inner');
  const outerBubbles = bubbles.filter(b => b.ring === 'outer');

  const makeConnections = (ring: typeof innerBubbles) =>
    ring.map((b, i) => {
      const next = ring[(i + 1) % ring.length];
      return { x1: b.x, y1: b.y, x2: next.x, y2: next.y, key: `${b.id}-${next.id}` };
    });

  const connections = [...makeConnections(innerBubbles), ...makeConnections(outerBubbles)];

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
          {/* SVG connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {connections.map((c, i) => (
              <motion.line
                key={c.key}
                x1={`${c.x1}%`} y1={`${c.y1}%`}
                x2={`${c.x2}%`} y2={`${c.y2}%`}
                className="stroke-primary/15"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              />
            ))}
            {/* Pulse dots on inner ring */}
            {makeConnections(innerBubbles).map((c, i) => (
              <motion.circle
                key={`pulse-${c.key}`}
                r="2.5"
                className="fill-primary/50"
                initial={{ cx: `${c.x1}%`, cy: `${c.y1}%` }}
                animate={{ cx: [`${c.x1}%`, `${c.x2}%`], cy: [`${c.y1}%`, `${c.y2}%`] }}
                transition={{
                  delay: i * 0.6,
                  duration: 1,
                  repeat: Infinity,
                  repeatDelay: innerBubbles.length * 0.6 - 1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </svg>

          {/* Center hub */}
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none"
            style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }}
          >
            <motion.div
              className="w-16 h-16 rounded-full border-2 border-primary/20 bg-primary/5 flex flex-col items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="text-base font-bold text-primary font-mono">λ</span>
              <span className="text-[7px] text-muted-foreground">Cycle {totalCycles}</span>
            </motion.div>
          </div>

          {/* Phase bubbles */}
          {bubbles.map((bubble, i) => {
            const isInner = bubble.ring === 'inner';
            const size = isInner ? 'w-[72px] h-[72px]' : 'w-[68px] h-[68px]';
            return (
              <motion.div
                key={bubble.id}
                className="absolute cursor-pointer"
                style={{
                  left: `${bubble.x}%`,
                  top: `${bubble.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
                onMouseEnter={() => setActivePhase(bubble.id)}
                onMouseLeave={() => setActivePhase(null)}
              >
                <motion.div
                  className={`
                    ${size} rounded-full flex flex-col items-center justify-center
                    border transition-colors duration-200
                    ${activePhase === bubble.id
                      ? 'border-primary bg-primary/15 shadow-lg shadow-primary/20'
                      : isInner
                        ? 'border-border bg-card/80 hover:border-primary/40'
                        : 'border-border/60 bg-card/60 hover:border-primary/30'
                    }
                  `}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-[8px] font-bold text-foreground text-center leading-tight px-1">
                    {bubble.label}
                  </span>
                </motion.div>

                <div className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[7px] font-bold flex items-center justify-center ${isInner ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'}`}>
                  {i + 1}
                </div>
              </motion.div>
            );
          })}

          {/* Tooltip */}
          {activePhase && (
            <motion.div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 shadow-xl z-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs font-semibold text-foreground">
                {PROCESSES.find(p => p.id === activePhase)?.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {PROCESSES.find(p => p.id === activePhase)?.description}
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatternAnalysis;
