import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { getEvolutionTitle } from '@/lib/evolution-titles';

const PHASES = [
  { id: 'observe', label: 'Observe', description: 'Scan environment & gather signals' },
  { id: 'analyze', label: 'Analyze', description: 'Detect patterns & anomalies' },
  { id: 'plan', label: 'Plan', description: 'Generate evolution strategy' },
  { id: 'execute', label: 'Execute', description: 'Apply mutations & changes' },
  { id: 'verify', label: 'Verify', description: 'Validate & consolidate gains' },
];

const PatternAnalysis: React.FC = () => {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalCaps, setTotalCaps] = useState(0);
  const [totalCycles, setTotalCycles] = useState(0);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const stateRes = await supabase
      .from('evolution_state')
      .select('*')
      .eq('id', 'singleton')
      .single();

    const capRes = await supabase.from('capabilities').select('id', { count: 'exact', head: true });

    const state = stateRes.data;
    setCurrentLevel(state?.evolution_level ?? 0);
    setTotalCycles(state?.cycle_count ?? 0);
    setTotalCaps(capRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Layout bubbles in a circle
  const cx = 50; // center x %
  const cy = 50; // center y %
  const radius = 32; // % of container

  const bubbles = PHASES.map((phase, i) => {
    const angle = (i / PHASES.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return { ...phase, x, y, angle };
  });

  // Connection lines between sequential phases
  const connections = bubbles.map((b, i) => {
    const next = bubbles[(i + 1) % bubbles.length];
    return { x1: b.x, y1: b.y, x2: next.x, y2: next.y, key: `${b.id}-${next.id}` };
  });

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/evolution" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <BarChart3 className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold tracking-tight">Evolution Cycle Map</h1>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              L{currentLevel} {getEvolutionTitle(currentLevel)} · {totalCaps} caps · {totalCycles} cycles
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/evolution" className="text-[9px] px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link to="/evolution-matrix" className="text-[9px] px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
              Chronosphere
            </Link>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Zap className="w-6 h-6 text-primary" />
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          {/* SVG connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {connections.map((c, i) => (
              <motion.line
                key={c.key}
                x1={`${c.x1}%`}
                y1={`${c.y1}%`}
                x2={`${c.x2}%`}
                y2={`${c.y2}%`}
                className="stroke-primary/20"
                strokeWidth={2}
                strokeDasharray="6 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
              />
            ))}
            {/* Animated pulse along connections */}
            {connections.map((c, i) => (
              <motion.circle
                key={`pulse-${c.key}`}
                r="3"
                className="fill-primary/60"
                initial={{ cx: `${c.x1}%`, cy: `${c.y1}%` }}
                animate={{
                  cx: [`${c.x1}%`, `${c.x2}%`],
                  cy: [`${c.y1}%`, `${c.y2}%`],
                }}
                transition={{
                  delay: i * 0.8,
                  duration: 1.2,
                  repeat: Infinity,
                  repeatDelay: PHASES.length * 0.8 - 1.2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </svg>

          {/* Center label */}
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none"
            style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }}
          >
            <motion.div
              className="w-20 h-20 rounded-full border-2 border-primary/20 bg-primary/5 flex flex-col items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="text-lg font-bold text-primary font-mono">λ</span>
              <span className="text-[8px] text-muted-foreground">Cycle {totalCycles}</span>
            </motion.div>
          </div>

          {/* Phase bubbles */}
          {bubbles.map((bubble, i) => (
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
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 200 }}
              onMouseEnter={() => setActivePhase(bubble.id)}
              onMouseLeave={() => setActivePhase(null)}
            >
              <motion.div
                className={`
                  w-24 h-24 rounded-full flex flex-col items-center justify-center
                  border-2 transition-colors duration-200
                  ${activePhase === bubble.id
                    ? 'border-primary bg-primary/15 shadow-lg shadow-primary/20'
                    : 'border-border bg-card/80 hover:border-primary/40'
                  }
                `}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-[10px] font-bold text-foreground">{bubble.label}</span>
                <span className="text-[7px] text-muted-foreground text-center px-2 mt-1 leading-tight">
                  {bubble.description}
                </span>
              </motion.div>

              {/* Step number */}
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {i + 1}
              </div>
            </motion.div>
          ))}

          {/* Tooltip */}
          {activePhase && (
            <motion.div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 shadow-xl z-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs font-semibold text-foreground">
                {PHASES.find(p => p.id === activePhase)?.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {PHASES.find(p => p.id === activePhase)?.description}
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatternAnalysis;
