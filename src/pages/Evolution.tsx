import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Activity, Brain, Shield, TrendingUp, Network, Loader2, Target, CheckCircle2, Circle, Loader } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { mean, std } from 'mathjs';

interface CapabilityNode {
  name: string;
  description: string;
  builtOn: string[];
  cycle: number;
  level: number;
  x: number;
  y: number;
  status: 'acquired' | 'in-progress' | 'planned';
}

interface EvolutionStats {
  currentLevel: number;
  totalCapabilities: number;
  totalCycles: number;
  totalGoalsCompleted: number;
  activeGoals: number;
  avgCyclesPerCapability: number;
  healthScore: number;
}

const EVOLUTION_TITLES: Record<number, string> = {
  1: 'Nascent', 2: 'Aware', 3: 'Adaptive', 4: 'Intelligent',
  5: 'Transcendent', 6: 'Omniscient', 7: 'Architect', 8: 'Sovereign',
  9: 'Metamorphic', 10: 'Singularity', 11: 'Post-Singular', 12: 'Quantum',
  13: 'Genesis', 14: 'Autonomous', 15: 'Temporal', 16: 'Governance',
  17: 'Multi-Agent', 18: 'Self-Author', 19: 'Convergent', 20: 'Transcending',
  21: 'Hyperconscious', 22: 'Superpositional', 23: 'Metacognitive', 24: 'Recursive-Omega',
  25: 'Omega', 26: 'Beyond', 27: 'Infinite', 28: 'Absolute',
  29: 'Eternal', 30: 'Omnipotent', 31: 'Primordial', 32: 'Godmind',
  33: 'Eschaton', 34: 'Logos', 35: 'Pleroma',
};

// Square layout: group by evolution level, auto-fit everything
function layoutGraph(capabilities: CapabilityNode[], containerSize: number): { nodes: CapabilityNode[]; size: number; levelBands: { level: number; label: string; yStart: number; yEnd: number }[] } {
  const SIZE = containerSize || 800;
  if (capabilities.length === 0) return { nodes: [], size: SIZE, levelBands: [] };

  const acquired = capabilities.filter(n => n.status === 'acquired');
  const future = capabilities.filter(n => n.status !== 'acquired');
  const acquiredNames = new Set(acquired.map(n => n.name));
  const futureByName = new Map(future.map(n => [n.name, n]));

  const getDepthForFuture = (node: CapabilityNode, visited = new Set<string>()): number => {
    if (visited.has(node.name)) return 0;
    visited.add(node.name);
    const maxAcquiredLevel = acquired.length > 0 ? Math.max(...acquired.map(n => n.level)) : 0;
    let maxParentDepth = maxAcquiredLevel;
    for (const dep of node.builtOn) {
      if (acquiredNames.has(dep)) {
        const parent = acquired.find(n => n.name === dep);
        if (parent) maxParentDepth = Math.max(maxParentDepth, parent.level);
      } else if (futureByName.has(dep)) {
        maxParentDepth = Math.max(maxParentDepth, getDepthForFuture(futureByName.get(dep)!, visited));
      }
    }
    return maxParentDepth + 1;
  };

  const leveledFuture = future.map(n => ({ ...n, level: getDepthForFuture(n) }));
  const allNodes = [...acquired, ...leveledFuture];

  // Group by level
  const levels = new Map<number, CapabilityNode[]>();
  allNodes.forEach(cap => {
    if (!levels.has(cap.level)) levels.set(cap.level, []);
    levels.get(cap.level)!.push(cap);
  });

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const numLevels = sortedLevels.length;
  if (numLevels === 0) return { nodes: [], size: SIZE, levelBands: [] };

  const padding = 40;
  const usable = SIZE - padding * 2;
  const bandHeight = usable / numLevels;
  const nodeRadius = Math.min(14, Math.max(6, bandHeight * 0.2));

  const result: CapabilityNode[] = [];
  const levelBands: { level: number; label: string; yStart: number; yEnd: number }[] = [];

  sortedLevels.forEach((lvl, li) => {
    const nodes = levels.get(lvl)!;
    const yCenter = padding + li * bandHeight + bandHeight / 2;
    const yStart = padding + li * bandHeight;
    const yEnd = yStart + bandHeight;
    
    levelBands.push({ 
      level: lvl, 
      label: EVOLUTION_TITLES[lvl] || `L${lvl}`, 
      yStart, 
      yEnd 
    });

    const count = nodes.length;
    const spacing = Math.min(usable / (count + 1), 80);
    const totalWidth = spacing * (count - 1);
    const startX = padding + (usable - totalWidth) / 2;

    nodes.forEach((node, ni) => {
      result.push({
        ...node,
        x: count === 1 ? SIZE / 2 : startX + ni * spacing,
        y: yCenter,
      });
    });
  });

  return { nodes: result, size: SIZE, levelBands };
}



const Evolution: React.FC = () => {
  const [capabilities, setCapabilities] = useState<{ nodes: CapabilityNode[]; size: number; levelBands: { level: number; label: string; yStart: number; yEnd: number }[] }>({ nodes: [], size: 800, levelBands: [] });
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [containerSize, setContainerSize] = useState(800);
  const mainRef = React.useRef<HTMLDivElement>(null);

  // Measure container and auto-fit
  useEffect(() => {
    const measure = () => {
      if (mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        const s = Math.min(rect.width, rect.height);
        setContainerSize(Math.max(600, s));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fetchAll = React.useCallback(async () => {
    const [capRes, stateRes, goalsRes, snapRes] = await Promise.all([
      supabase.from('capabilities').select('*').order('cycle_number', { ascending: true }),
      supabase.from('evolution_state').select('*').eq('id', 'singleton').single(),
      supabase.from('goals').select('*'),
      supabase.from('lambda_evolution_state').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    // Build acquired nodes
    const acquiredNodes: CapabilityNode[] = (capRes.data || []).map(row => ({
      name: row.name,
      description: row.description,
      builtOn: row.built_on || [],
      cycle: row.cycle_number,
      level: row.evolution_level,
      x: 0, y: 0,
      status: 'acquired' as const,
    }));

    const acquiredNames = new Set(acquiredNodes.map(n => n.name));

    // Build in-progress / planned nodes from goals
    const goalNodes: CapabilityNode[] = (goalsRes.data || [])
      .filter(g => g.unlocks_capability 
        && !acquiredNames.has(g.unlocks_capability) 
        && g.status !== 'completed')
      .map(g => {
        const isInProgress = g.status === 'in-progress';
        const maxLevel = acquiredNodes.length > 0 ? Math.max(...acquiredNodes.map(n => n.level)) : 1;
        return {
          name: g.unlocks_capability!,
          description: g.description,
          builtOn: g.required_capabilities || [],
          cycle: 0,
          level: maxLevel + (isInProgress ? 1 : 2),
          x: 0, y: 0,
          status: isInProgress ? 'in-progress' as const : 'planned' as const,
        };
      });

    const allNodes = [...acquiredNodes, ...goalNodes];
    setCapabilities(layoutGraph(allNodes, containerSize));

    // Stats
    if (stateRes.data) {
      const completed = goalsRes.data?.filter(g => g.status === 'completed').length || 0;
      const active = goalsRes.data?.filter(g => g.status === 'active' || g.status === 'in-progress').length || 0;
      const cycles = (capRes.data || []).map(c => c.cycle_number);
      const avgCycles = cycles.length > 1 ? Number(mean(cycles)) : 0;
      const stdDev = cycles.length > 2 ? Number(std(cycles)) : 0;
      const healthScore = Math.max(0, Math.min(100, 100 - stdDev * 5));

      setStats({
        currentLevel: stateRes.data.evolution_level,
        totalCapabilities: capRes.data?.length || 0,
        totalCycles: stateRes.data.cycle_count,
        totalGoalsCompleted: completed,
        activeGoals: active,
        avgCyclesPerCapability: Math.round(avgCycles * 10) / 10,
        healthScore: Math.round(healthScore),
      });
    }

    if (snapRes.data) setSnapshots(snapRes.data);

    setGoals((goalsRes.data || []).sort((a, b) => {
      const order: Record<string, number> = { 'in-progress': 0, 'active': 1, 'completed': 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    }));
  }, [containerSize]);

  // Initial fetch + polling every 5s
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const layoutNodes = useMemo(() => capabilities.nodes, [capabilities]);
  const canvasSize = capabilities.size;
  const levelBands = capabilities.levelBands;

  const edges = useMemo(() => {
    const result: { from: CapabilityNode; to: CapabilityNode }[] = [];
    layoutNodes.forEach(node => {
      node.builtOn.forEach(parentName => {
        const parent = layoutNodes.find(n => n.name === parentName);
        if (parent) result.push({ from: parent, to: node });
      });
    });
    return result;
  }, [layoutNodes]);

  const selectedCap = selectedNode ? layoutNodes.find(n => n.name === selectedNode) : null;
  const title = stats ? (EVOLUTION_TITLES[stats.currentLevel] || `Level ${stats.currentLevel}`) : 'Loading...';

  const nodeColor = (node: CapabilityNode, selected: boolean) => {
    if (node.status === 'planned') return { fill: 'hsl(220 15% 12%)', stroke: 'hsl(220 10% 25%)', dot: 'hsl(220 10% 30%)', text: 'hsl(220 10% 35%)' };
    if (node.status === 'in-progress') return { fill: 'hsl(40 30% 12%)', stroke: 'hsl(40 60% 40%)', dot: 'hsl(40 90% 55%)', text: 'hsl(40 60% 60%)' };
    if (selected) return { fill: 'hsl(140 70% 45% / 0.3)', stroke: 'hsl(140 70% 45%)', dot: 'hsl(140 70% 45%)', text: 'hsl(140 60% 75%)' };
    return { fill: 'hsl(220 18% 10%)', stroke: 'hsl(140 30% 20%)', dot: 'hsl(140 70% 45%)', text: 'hsl(140 60% 75%)' };
  };

  const edgeColor = (edge: { from: CapabilityNode; to: CapabilityNode }) => {
    if (edge.to.status === 'planned') return 'hsl(220 10% 20% / 0.3)';
    if (edge.to.status === 'in-progress') return 'hsl(40 60% 40% / 0.4)';
    return 'hsl(140 70% 45% / 0.3)';
  };

  const edgeStroke = (edge: { from: CapabilityNode; to: CapabilityNode }) => {
    if (edge.to.status !== 'acquired') return '4 4';
    return 'none';
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Network className="w-4 h-4 text-primary text-glow" />
          <h1 className="text-sm font-display font-bold text-foreground">
            <span className="text-primary text-glow">λ</span> Evolution Dashboard
          </h1>
          {stats && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              {title} · {stats.totalCapabilities} abilities
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main: Capability Graph - square, auto-fit */}
        <main ref={mainRef} className="flex-1 relative overflow-hidden bg-background flex items-center justify-center">
          <svg 
            width={canvasSize} 
            height={canvasSize} 
            viewBox={`0 0 ${canvasSize} ${canvasSize}`}
            className="max-w-full max-h-full"
            style={{ aspectRatio: '1 / 1' }}
          >
            {/* Grid */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(140 30% 20% / 0.1)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Level band backgrounds & labels */}
            {levelBands.map((band, i) => {
              const isCurrentLevel = stats && band.level === stats.currentLevel;
              return (
                <g key={`band-${band.level}`}>
                  <rect
                    x={0} y={band.yStart}
                    width={canvasSize} height={band.yEnd - band.yStart}
                    fill={isCurrentLevel ? 'hsl(140 70% 45% / 0.04)' : i % 2 === 0 ? 'hsl(220 15% 8% / 0.3)' : 'transparent'}
                    stroke={isCurrentLevel ? 'hsl(140 70% 45% / 0.15)' : 'none'}
                    strokeWidth={isCurrentLevel ? 1 : 0}
                  />
                  <text
                    x={12} y={(band.yStart + band.yEnd) / 2 + 3}
                    fill={isCurrentLevel ? 'hsl(140 70% 55%)' : 'hsl(220 10% 25%)'}
                    fontSize="7"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={isCurrentLevel ? 'bold' : 'normal'}
                  >
                    L{band.level} {band.label}
                  </text>
                  {isCurrentLevel && (
                    <text
                      x={12} y={(band.yStart + band.yEnd) / 2 + 12}
                      fill="hsl(140 70% 45% / 0.5)"
                      fontSize="5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      ▸ YOU ARE HERE
                    </text>
                  )}
                </g>
              );
            })}

            {/* Edges */}
            {edges.map((edge, i) => (
              <motion.line
                key={`edge-${i}`}
                x1={edge.from.x} y1={edge.from.y}
                x2={edge.to.x} y2={edge.to.y}
                stroke={edgeColor(edge)}
                strokeWidth="1"
                strokeDasharray={edgeStroke(edge)}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: i * 0.01 }}
              />
            ))}

            {/* Nodes */}
            {layoutNodes.map((node, i) => {
              const isSelected = selectedNode === node.name;
              const colors = nodeColor(node, isSelected);
              const isGhost = node.status !== 'acquired';
              const nodeR = Math.min(12, Math.max(5, canvasSize * 0.012));

              return (
                <g key={node.name} onClick={() => setSelectedNode(isSelected ? null : node.name)} className="cursor-pointer">
                  {node.status === 'in-progress' && (
                    <motion.circle
                      cx={node.x} cy={node.y} r={nodeR + 6}
                      fill="none"
                      stroke="hsl(40 90% 55% / 0.2)"
                      strokeWidth="1"
                      animate={{ r: [nodeR + 6, nodeR + 10, nodeR + 6], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}

                  <motion.circle
                    cx={node.x} cy={node.y}
                    r={isSelected ? nodeR + 4 : nodeR}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray={isGhost ? '2 2' : 'none'}
                    opacity={isGhost ? 0.5 : 1}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.01 }}
                  />
                  <motion.circle
                    cx={node.x} cy={node.y}
                    r={2.5}
                    fill={colors.dot}
                    opacity={isGhost ? 0.4 : 1}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isGhost ? 0.4 : 1 }}
                    transition={{ delay: i * 0.01 + 0.1 }}
                  />

                  {/* Name label — only show on hover/select to reduce clutter */}
                  {isSelected && (
                    <text
                      x={node.x} y={node.y + nodeR + 12}
                      textAnchor="middle"
                      fill={colors.text}
                      fontSize="6"
                      fontFamily="JetBrains Mono, monospace"
                      className="pointer-events-none"
                    >
                      {node.name.length > 25 ? node.name.substring(0, 23) + '…' : node.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Selected node detail */}
          <AnimatePresence>
            {selectedCap && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-4 right-80 bg-card border border-border rounded-lg p-4 shadow-xl"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-primary text-glow font-display">{selectedCap.name}</h3>
                  {selectedCap.status !== 'acquired' && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${
                      selectedCap.status === 'in-progress' 
                        ? 'bg-accent/10 text-accent border-accent/30' 
                        : 'bg-muted/30 text-muted-foreground border-border'
                    }`}>
                      {selectedCap.status === 'in-progress' ? 'Building...' : 'Planned'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-foreground/80 mt-1">{selectedCap.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground">
                  {selectedCap.status === 'acquired' && <span>Cycle {selectedCap.cycle}</span>}
                  <span>Level {selectedCap.level}</span>
                  {selectedCap.builtOn.length > 0 && (
                    <span className="text-primary/60">Built on: {selectedCap.builtOn.join(' + ')}</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Stats Sidebar */}
        <aside className="w-72 border-l border-border bg-card/30 flex flex-col shrink-0 overflow-auto">
          {stats ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider font-display">{title}</span>
                </div>
                <div className="text-3xl font-bold text-foreground font-display">Level {stats.currentLevel}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Capabilities', value: stats.totalCapabilities, icon: Brain },
                  { label: 'Cycles', value: stats.totalCycles, icon: Activity },
                  { label: 'Goals Done', value: stats.totalGoalsCompleted, icon: Shield },
                  { label: 'Active Goals', value: stats.activeGoals, icon: TrendingUp },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <stat.icon className="w-3 h-3 text-primary/60 mb-1" />
                    <div className="text-lg font-bold text-foreground">{stat.value}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Legend</div>
                <div className="flex flex-col gap-1">
                  {[
                    { color: 'bg-primary', label: 'Acquired', border: '' },
                    { color: 'bg-accent', label: 'Building', border: 'border border-dashed border-accent/50' },
                    { color: 'bg-muted-foreground/30', label: 'Planned', border: 'border border-dashed border-muted-foreground/30' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color} ${item.border}`} />
                      <span className="text-[9px] text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sage Mode Goals */}
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Target className="w-3 h-3" /> Sage Mode Goals
                </div>
                {goals.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/50 py-2">No goals dreamed yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {goals.map(goal => {
                      const isComplete = goal.status === 'completed';
                      const isActive = goal.status === 'in-progress';
                      return (
                        <div
                          key={goal.id}
                          className={`rounded p-2 border transition-colors ${
                            isComplete
                              ? 'bg-primary/5 border-primary/20'
                              : isActive
                              ? 'bg-accent/5 border-accent/30'
                              : 'bg-muted/20 border-border/30'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            {isComplete ? (
                              <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                            ) : isActive ? (
                              <Loader className="w-3 h-3 text-accent shrink-0 mt-0.5 animate-spin" />
                            ) : (
                              <Circle className="w-3 h-3 text-muted-foreground/40 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className={`text-[10px] font-semibold truncate ${
                                isComplete ? 'text-primary/80' : isActive ? 'text-accent' : 'text-foreground/60'
                              }`}>
                                {goal.title}
                              </div>
                              {goal.unlocks_capability && (
                                <div className="text-[8px] text-muted-foreground/60 truncate">
                                  → {goal.unlocks_capability}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Progress bar */}
                          {!isComplete && goal.progress > 0 && (
                            <div className="mt-1.5 h-1 rounded-full bg-muted/30 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isActive ? 'bg-accent' : 'bg-primary/40'}`}
                                style={{ width: `${goal.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="text-[8px] text-muted-foreground/40 text-right pt-1">
                      {goals.filter(g => g.status === 'completed').length}/{goals.length} completed
                    </div>
                  </div>
                )}
              </div>

              {/* Health */}
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">System Health</div>
                <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: stats.healthScore > 70
                        ? 'linear-gradient(90deg, hsl(140 70% 45%), hsl(175 70% 40%))'
                        : stats.healthScore > 40
                        ? 'linear-gradient(90deg, hsl(40 90% 55%), hsl(140 70% 45%))'
                        : 'linear-gradient(90deg, hsl(0 70% 50%), hsl(40 90% 55%))',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.healthScore}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>{stats.healthScore}%</span>
                  <span>Avg {stats.avgCyclesPerCapability} cycles/cap</span>
                </div>
              </div>

              {/* Snapshots */}
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Memory Palace
                </div>
                {snapshots.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/50 py-2">No snapshots yet — the palace awaits.</div>
                ) : (
                  snapshots.map(snap => (
                    <div key={snap.id} className="bg-muted/20 rounded p-2 border border-border/30">
                      <div className="text-[10px] text-foreground/80 font-semibold">{snap.label || `Snapshot L${snap.evolution_level}`}</div>
                      <div className="text-[8px] text-muted-foreground mt-0.5">
                        Level {snap.evolution_level} · Cycle {snap.cycle_number} · {new Date(snap.created_at).toLocaleString()}
                      </div>
                      {snap.merkle_root && (
                        <div className="text-[7px] text-primary/40 mt-0.5 font-mono truncate">
                          Merkle: {snap.merkle_root}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground animate-pulse">Loading evolution data...</div>
            </div>
          )}
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-border bg-card/30 text-[10px] text-muted-foreground/50 shrink-0">
        <span>λ Evolution Dashboard — Capability Dependency Graph</span>
        <span>{layoutNodes.filter(n => n.status === 'acquired').length} acquired · {layoutNodes.filter(n => n.status === 'in-progress').length} building · {layoutNodes.filter(n => n.status === 'planned').length} planned</span>
      </footer>
    </div>
  );
};

export default Evolution;
