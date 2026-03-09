import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Activity, Brain, Shield, TrendingUp, Network, Target, CheckCircle2, Circle, Loader, Cpu, Bot, Cog, Play, Search, BarChart3, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { mean, std } from 'mathjs';
import { getEvolutionTitle } from '@/lib/evolution-titles';
import { ruleEngine, RuleEngineReport } from '@/lib/rule-engine';
import { StormLightning, emitStormProcess } from '@/components/TerminalStorm';
import { runAutonomyCycle, getCumulativeAutonomy, recordAutonomyCycle, deterministicSearch, type AutonomyReport } from '@/lib/autonomy-engine';
import { runLifeProof, getHeartbeatCount, type LifeProofReport } from '@/lib/life-proof';
import { runMaturityTest, type MaturityReport } from '@/lib/maturity-test';

interface CapabilityNode {
  name: string;
  description: string;
  builtOn: string[];
  cycle: number;
  level: number;
  x: number;
  y: number;
  status: 'acquired' | 'in-progress' | 'planned';
  verified?: boolean;
}

interface EvolutionStats {
  currentLevel: number;
  totalCapabilities: number;
  totalCycles: number;
  totalGoalsCompleted: number;
  activeGoals: number;
  avgCyclesPerCapability: number;
  healthScore: number;
  verifiedCount: number;
  ghostCount: number;
}

// Layout based on DEPENDENCY DEPTH — not evolution_level.
// Roots (no dependencies) at bottom, children above. Every node connects.
function layoutGraph(capabilities: CapabilityNode[], containerSize: number): { nodes: CapabilityNode[]; size: number; levelBands: { level: number; label: string; yStart: number; yEnd: number }[] } {
  const SIZE = containerSize || 800;
  if (capabilities.length === 0) return { nodes: [], size: SIZE, levelBands: [] };

  const byName = new Map(capabilities.map(n => [n.name, n]));

  // Compute dependency depth for every node
  const depthCache = new Map<string, number>();
  const getDepth = (name: string, visited = new Set<string>()): number => {
    if (depthCache.has(name)) return depthCache.get(name)!;
    if (visited.has(name)) return 0;
    visited.add(name);
    const node = byName.get(name);
    if (!node) return 0;
    // Only count parents that actually exist in the graph
    const parentDepths = (node.builtOn || [])
      .filter(p => byName.has(p))
      .map(p => getDepth(p, new Set(visited)));
    const depth = parentDepths.length > 0 ? Math.max(...parentDepths) + 1 : 0;
    depthCache.set(name, depth);
    return depth;
  };

  // Compute all depths
  const nodesWithDepth = capabilities.map(n => ({
    ...n,
    level: getDepth(n.name), // override level with computed depth
  }));

  // Group by depth
  const levels = new Map<number, CapabilityNode[]>();
  nodesWithDepth.forEach(cap => {
    if (!levels.has(cap.level)) levels.set(cap.level, []);
    levels.get(cap.level)!.push(cap);
  });

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const numLevels = sortedLevels.length;
  if (numLevels === 0) return { nodes: [], size: SIZE, levelBands: [] };

  const padding = 40;
  const usable = SIZE - padding * 2;
  const bandHeight = usable / numLevels;

  const result: CapabilityNode[] = [];
  const levelBands: { level: number; label: string; yStart: number; yEnd: number }[] = [];

  sortedLevels.forEach((lvl, li) => {
    const nodes = levels.get(lvl)!;
    const ri = numLevels - 1 - li; // bottom = lowest depth
    const yCenter = padding + ri * bandHeight + bandHeight / 2;
    const yStart = padding + ri * bandHeight;
    const yEnd = yStart + bandHeight;
    
    levelBands.push({ level: lvl, label: `Depth ${lvl}`, yStart, yEnd });

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
  const [ruleReport, setRuleReport] = useState<RuleEngineReport | null>(null);
  const [showStorm, setShowStorm] = useState(true);
  const [autonomyReport, setAutonomyReport] = useState<AutonomyReport | null>(null);
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lifeReport, setLifeReport] = useState<LifeProofReport | null>(null);
  const [isRunningLifeProof, setIsRunningLifeProof] = useState(false);
  const [lifeProofLoop, setLifeProofLoop] = useState(false);
  const [maturityReport, setMaturityReport] = useState<MaturityReport | null>(null);
  const [isRunningMaturity, setIsRunningMaturity] = useState(false);
  const [maturityLoop, setMaturityLoop] = useState(false);
  const [showAutonomyDetails, setShowAutonomyDetails] = useState(false);
  const lifeProofRef = React.useRef(false);
  const maturityRef = React.useRef(false);
  const mainRef = React.useRef<HTMLDivElement>(null);

  // Measure container
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

    const acquiredNodes: CapabilityNode[] = (capRes.data || []).map(row => ({
      name: row.name,
      description: row.description,
      builtOn: row.built_on || [],
      cycle: row.cycle_number,
      level: row.evolution_level,
      x: 0, y: 0,
      status: 'acquired' as const,
      verified: row.verified,
    }));

    const acquiredNames = new Set(acquiredNodes.map(n => n.name));

    const goalNodes: CapabilityNode[] = (goalsRes.data || [])
      .filter(g => g.unlocks_capability && !acquiredNames.has(g.unlocks_capability) && g.status !== 'completed')
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

    if (stateRes.data) {
      const completed = goalsRes.data?.filter(g => g.status === 'completed').length || 0;
      const active = goalsRes.data?.filter(g => g.status === 'active' || g.status === 'in-progress').length || 0;
      const cycles = (capRes.data || []).map(c => c.cycle_number);
      const avgCycles = cycles.length > 1 ? Number(mean(cycles)) : 0;
      const stdDev = cycles.length > 2 ? Number(std(cycles)) : 0;
      const healthScore = Math.max(0, Math.min(100, 100 - stdDev * 5));
      const verifiedCount = acquiredNodes.filter(n => n.verified).length;

      setStats({
        currentLevel: stateRes.data.evolution_level,
        totalCapabilities: capRes.data?.length || 0,
        totalCycles: stateRes.data.cycle_count,
        totalGoalsCompleted: completed,
        activeGoals: active,
        avgCyclesPerCapability: Math.round(avgCycles * 10) / 10,
        healthScore: Math.round(healthScore),
        verifiedCount,
        ghostCount: acquiredNodes.length - verifiedCount,
      });

      // Run rule engine evaluation
      const report = ruleEngine.evaluate({
        capabilities: acquiredNodes.map(n => n.name),
        evolutionLevel: stateRes.data.evolution_level,
        cycleCount: stateRes.data.cycle_count,
        lastTestVerdict: null,
        failedTests: [],
        capabilityCount: acquiredNodes.length,
        timeSinceLastEvolution: Date.now() - new Date(stateRes.data.updated_at).getTime(),
        codeFiles: [],
      });
      setRuleReport(report);

      // Emit storm processes for triggered rules
      report.actions.forEach(action => {
        emitStormProcess({
          label: action.description.slice(0, 60),
          source: 'rule-engine',
          target: action.target || 'system',
          type: 'rule',
          status: action.severity === 'warning' ? 'fail' : 'success',
          reason: action.type,
        });
      });
    }

    if (snapRes.data) setSnapshots(snapRes.data);

    setGoals((goalsRes.data || []).sort((a, b) => {
      const order: Record<string, number> = { 'in-progress': 0, 'active': 1, 'completed': 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    }));
  }, [containerSize]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Life proof continuous loop
  useEffect(() => {
    lifeProofRef.current = lifeProofLoop;
  }, [lifeProofLoop]);

  useEffect(() => {
    if (!lifeProofLoop) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled && lifeProofRef.current) {
        setIsRunningLifeProof(true);
        try {
          const report = await runLifeProof();
          if (!cancelled) {
            setLifeReport(report);
            fetchAll();
          }
        } catch (err) {
          console.error('Life proof error:', err);
        }
        setIsRunningLifeProof(false);
        await new Promise(r => setTimeout(r, 8000));
      }
    };

    loop();
    return () => { cancelled = true; };
  }, [lifeProofLoop]);

  // Maturity test continuous loop
  useEffect(() => {
    maturityRef.current = maturityLoop;
  }, [maturityLoop]);

  useEffect(() => {
    if (!maturityLoop) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled && maturityRef.current) {
        setIsRunningMaturity(true);
        try {
          const report = await runMaturityTest();
          if (!cancelled) {
            setMaturityReport(report);
            fetchAll();
          }
        } catch (err) {
          console.error('Maturity test error:', err);
        }
        setIsRunningMaturity(false);
        await new Promise(r => setTimeout(r, 12000));
      }
    };

    loop();
    return () => { cancelled = true; };
  }, [maturityLoop]);

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
  const title = stats ? getEvolutionTitle(stats.currentLevel) : 'Loading...';
  const metrics = ruleEngine.getMetrics();

  // Storm node positions for lightning
  const stormNodes = useMemo(() => layoutNodes.filter(n => n.status === 'acquired').map(n => ({
    name: n.name,
    x: n.x,
    y: n.y,
    verified: !!n.verified,
  })), [layoutNodes]);

  const nodeColor = (node: CapabilityNode, selected: boolean) => {
    if (node.status === 'planned') return { fill: 'hsl(220 15% 12%)', stroke: 'hsl(220 10% 25%)', dot: 'hsl(220 10% 30%)', text: 'hsl(220 10% 35%)' };
    if (node.status === 'in-progress') return { fill: 'hsl(40 30% 12%)', stroke: 'hsl(40 60% 40%)', dot: 'hsl(40 90% 55%)', text: 'hsl(40 60% 60%)' };
    if (!node.verified) return { fill: 'hsl(0 30% 12%)', stroke: 'hsl(0 40% 30%)', dot: 'hsl(0 50% 40%)', text: 'hsl(0 40% 50%)' };
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

  // Calculate reflection metrics from latest state
  const reflectionMetrics = React.useMemo(() => {
    if (!stats) return null;
    
    const valueScore = Math.min(100, 
      (stats.verifiedCount > 10 ? 100 : stats.verifiedCount * 10) + 
      (stats.totalGoalsCompleted > 5 ? 25 : stats.totalGoalsCompleted * 5)
    );
    
    const lifeScore = Math.min(100,
      (stats.verifiedCount > 0 ? 100 : 0)
    );
    
    return { valueScore, lifeScore };
  }, [stats]);

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
            <>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" />
                {title} · L{stats.currentLevel} · {stats.verifiedCount}/{stats.totalCapabilities} verified
              </span>
              {reflectionMetrics && (
                <>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-terminal-green/10 text-terminal-green border border-terminal-green/20">
                    💎 Value {reflectionMetrics.valueScore}%
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    💓 Life {reflectionMetrics.lifeScore}%
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (isRunningCycle) return;
              setIsRunningCycle(true);
              try {
                const report = await runAutonomyCycle();
                recordAutonomyCycle(report);
                setAutonomyReport(report);
                // Emit storm events for each completed task
                report.tasksCompleted.forEach(task => {
                  emitStormProcess({
                    label: `${task.name}: ${task.detail.slice(0, 40)}`,
                    source: task.type,
                    target: 'system',
                    type: task.usedAI ? 'ai' : 'rule',
                    status: task.success ? 'success' : 'fail',
                  });
                });
                fetchAll();
              } finally {
                setIsRunningCycle(false);
              }
            }}
            disabled={isRunningCycle}
            className={`text-[9px] px-3 py-1 rounded border transition-colors flex items-center gap-1 ${
              isRunningCycle 
                ? 'bg-accent/20 text-accent border-accent/40 animate-pulse' 
                : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
            }`}
          >
            {isRunningCycle ? <Loader className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isRunningCycle ? 'Running...' : 'Run Autonomy Cycle'}
          </button>
          <button
            onClick={() => setLifeProofLoop(v => !v)}
            className={`text-[9px] px-3 py-1 rounded border transition-colors flex items-center gap-1 ${
              lifeProofLoop
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                : 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20'
            }`}
          >
            {lifeProofLoop ? '⏹' : '💓'} {lifeProofLoop ? `Stop (HB #${lifeReport?.heartbeatNumber || 0})` : 'Life Proof Loop'}
          </button>
          <button
            onClick={() => setMaturityLoop(v => !v)}
            className={`text-[9px] px-3 py-1 rounded border transition-colors flex items-center gap-1 ${
              maturityLoop
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 animate-pulse'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'
            }`}
          >
            {maturityLoop ? '⏹' : <BarChart3 className="w-3 h-3" />} {maturityLoop ? `Stop Maturity (${maturityReport?.grade || '?'})` : 'Maturity Test'}
          </button>
          <button
            onClick={() => setShowStorm(s => !s)}
            className={`text-[9px] px-2 py-1 rounded border transition-colors ${
              showStorm ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted/30 text-muted-foreground border-border'
            }`}
          >
            ⚡ Storm {showStorm ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main area: graph + storm overlay */}
        <main ref={mainRef} className="flex-1 relative overflow-hidden flex items-center justify-center">

          <svg 
            width={canvasSize} 
            height={canvasSize} 
            viewBox={`0 0 ${canvasSize} ${canvasSize}`}
            className="max-w-full max-h-full relative z-0"
            style={{ aspectRatio: '1 / 1' }}
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(140 30% 20% / 0.1)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {levelBands.map((band, i) => {
              const isTopDepth = band.level === Math.max(...levelBands.map(b => b.level));
              return (
                <g key={`band-${band.level}`}>
                  <rect
                    x={0} y={band.yStart}
                    width={canvasSize} height={band.yEnd - band.yStart}
                    fill={i % 2 === 0 ? 'hsl(220 15% 8% / 0.3)' : 'transparent'}
                    stroke="none"
                  />
                  <text
                    x={12} y={(band.yStart + band.yEnd) / 2 + 3}
                    fill={isTopDepth ? 'hsl(140 70% 55%)' : 'hsl(220 10% 25%)'}
                    fontSize="7"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={isTopDepth ? 'bold' : 'normal'}
                  >
                    {band.label}
                  </text>
                </g>
              );
            })}

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

            {/* Lightning bolts between actual nodes */}
            {showStorm && <StormLightning nodes={stormNodes} canvasSize={canvasSize} />}
          </svg>

          {/* Selected node detail */}
          <AnimatePresence>
            {selectedCap && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-4 right-80 bg-card border border-border rounded-lg p-4 shadow-xl z-20"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-primary text-glow font-display">{selectedCap.name}</h3>
                  {selectedCap.verified && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">✓ verified</span>
                  )}
                  {selectedCap.status === 'acquired' && !selectedCap.verified && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">👻 ghost</span>
                  )}
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
                  { label: 'Verified', value: stats.verifiedCount, icon: Shield },
                  { label: 'Ghosts', value: stats.ghostCount, icon: Brain },
                  { label: 'Cycles', value: stats.totalCycles, icon: Activity },
                  { label: 'Goals Done', value: stats.totalGoalsCompleted, icon: TrendingUp },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <stat.icon className="w-3 h-3 text-primary/60 mb-1" />
                    <div className="text-lg font-bold text-foreground">{stat.value}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* LIFE PROOF — Vital Signs */}
              {lifeReport && (
                <div className="space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    💓 Life Proof · Heartbeat #{lifeReport.heartbeatNumber}
                  </div>
                  
                  {/* Overall score bar */}
                  <div className="relative h-6 rounded-lg bg-muted/30 overflow-hidden border border-border/50">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-lg"
                      style={{
                        background: lifeReport.overallScore >= 70
                          ? 'linear-gradient(90deg, hsl(140, 70%, 35%), hsl(140, 70%, 50%))'
                          : lifeReport.overallScore >= 40
                          ? 'linear-gradient(90deg, hsl(40, 90%, 45%), hsl(40, 90%, 60%))'
                          : 'linear-gradient(90deg, hsl(0, 70%, 40%), hsl(0, 70%, 55%))',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${lifeReport.overallScore}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-foreground mix-blend-difference">
                        {lifeReport.alive ? '💓' : '💀'} {lifeReport.overallScore}% {lifeReport.alive ? 'ALIVE' : 'CRITICAL'}
                      </span>
                    </div>
                  </div>

                  {/* Verdict */}
                  <div className="text-[9px] text-foreground/80 px-1">
                    {lifeReport.verdict}
                  </div>

                  {/* Stage results */}
                  <div className="space-y-0.5">
                    {lifeReport.stages.map(stage => (
                      <div
                        key={stage.stage}
                        className={`flex items-center gap-2 text-[9px] px-2 py-1 rounded ${
                          stage.passed
                            ? 'text-primary/80'
                            : 'text-destructive/80'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          stage.passed ? 'bg-primary' : 'bg-destructive'
                        }`} />
                        <span className="font-semibold w-16 shrink-0">{stage.name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${stage.passed ? 'bg-primary/60' : 'bg-destructive/60'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stage.score}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <span className="text-[8px] text-muted-foreground w-6 text-right">{stage.score}%</span>
                      </div>
                    ))}
                  </div>

                  {isRunningLifeProof && (
                    <div className="text-[8px] text-accent animate-pulse flex items-center gap-1">
                      <Loader className="w-2.5 h-2.5 animate-spin" /> Running test stages...
                    </div>
                  )}
                  <div className="text-[8px] text-muted-foreground/50">
                    Duration: {lifeReport.duration.toFixed(0)}ms
                  </div>
                </div>
              )}

              {/* MATURITY TEST — Value Readiness */}
              {maturityReport && (
                <div className="space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> Maturity · Run #{maturityReport.runNumber}
                  </div>
                  
                  {/* Grade badge */}
                  <div className="flex items-center gap-2">
                    <div className={`text-2xl font-bold font-display ${
                      maturityReport.grade === 'S' ? 'text-yellow-400' :
                      maturityReport.grade === 'A' ? 'text-primary' :
                      maturityReport.grade === 'B' ? 'text-blue-400' :
                      maturityReport.grade === 'C' ? 'text-accent' :
                      'text-destructive'
                    }`}>
                      {maturityReport.grade}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-foreground/80">{maturityReport.overallScore}%</div>
                      <div className="text-[8px] text-muted-foreground">Overall Maturity</div>
                    </div>
                  </div>

                  {/* Readiness label */}
                  <div className="text-[9px] text-foreground/70 px-1">
                    {maturityReport.readinessLabel}
                  </div>

                  {/* Dimension bars */}
                  <div className="space-y-1">
                    {maturityReport.dimensions.map(dim => (
                      <div key={dim.dimension} className="group">
                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className="w-4 text-center">{dim.icon}</span>
                          <span className={`w-20 shrink-0 font-medium truncate ${dim.passed ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                            {dim.label.replace(/^. /, '')}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${
                                dim.score >= 80 ? 'bg-primary' :
                                dim.score >= 60 ? 'bg-blue-500/70' :
                                dim.score >= 40 ? 'bg-accent/70' :
                                'bg-destructive/60'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${dim.score}%` }}
                              transition={{ duration: 0.6 }}
                            />
                          </div>
                          <span className="text-[8px] text-muted-foreground w-6 text-right">{dim.score}%</span>
                        </div>
                        {/* Expand on hover: show next milestone */}
                        <div className="hidden group-hover:block text-[7px] text-muted-foreground/60 ml-6 mt-0.5">
                          Next: {dim.milestone}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Next milestone callout */}
                  <div className="text-[8px] px-2 py-1.5 rounded bg-accent/5 border border-accent/20 text-accent/80">
                    🎯 Focus: {maturityReport.nextMilestone}
                  </div>

                  {/* Score trend */}
                  {maturityReport.scoreHistory.length > 1 && (
                    <div className="flex items-end gap-px h-6">
                      {maturityReport.scoreHistory.map((s, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-t ${s >= 60 ? 'bg-primary/50' : s >= 40 ? 'bg-accent/50' : 'bg-destructive/50'}`}
                          style={{ height: `${Math.max(2, (s / 100) * 24)}px` }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Self-adaptations */}
                  {maturityReport.adaptations.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">🧬 Self-Adaptations</div>
                      {maturityReport.adaptations.map((a, i) => (
                        <div key={i} className="text-[8px] text-foreground/60 px-2 py-1 rounded bg-muted/20 border border-border/30">
                          {a}
                        </div>
                      ))}
                    </div>
                  )}

                  {isRunningMaturity && (
                    <div className="text-[8px] text-accent animate-pulse flex items-center gap-1">
                      <Loader className="w-2.5 h-2.5 animate-spin" /> Testing dimensions...
                    </div>
                  )}
                  <div className="text-[8px] text-muted-foreground/50">
                    Age: {maturityReport.maturityAge} lifetime runs · {maturityReport.duration.toFixed(0)}ms
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Autonomy Score
                </div>
                {(() => {
                  const cumulative = getCumulativeAutonomy();
                  const score = autonomyReport ? autonomyReport.score : cumulative.score;
                  return (
                    <>
                      <div className="relative h-5 rounded-full bg-muted/30 overflow-hidden border border-border/50">
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            background: score > 70
                              ? `linear-gradient(90deg, hsl(140, 70%, 45%), hsl(175, 70%, 40%))`
                              : score > 30
                              ? `linear-gradient(90deg, hsl(40, 90%, 55%), hsl(140, 70%, 45%))`
                              : `linear-gradient(90deg, hsl(0, 70%, 50%), hsl(40, 90%, 55%))`,
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-foreground mix-blend-difference">
                            {score}% AUTONOMOUS
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[8px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Cog className="w-2.5 h-2.5" /> {cumulative.totalDeterministic} deterministic
                        </span>
                        <span className="flex items-center gap-1">
                          <Bot className="w-2.5 h-2.5" /> {cumulative.totalAI} AI calls
                        </span>
                      </div>
                      <div className="text-[8px] text-muted-foreground/50">
                        {cumulative.cyclesRun} autonomy cycles run · {metrics.ruleCount} rules
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Last Autonomy Report */}
              {autonomyReport && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowAutonomyDetails(true)}
                    className="w-full text-left hover:bg-muted/30 rounded p-2 transition-colors border border-transparent hover:border-primary/20"
                  >
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                      <Activity className="w-3 h-3" /> Last Cycle
                    </div>
                    
                    {/* Goal attempt highlight */}
                    {autonomyReport.goalAttempted && (
                      <div className={`p-2 rounded border ${autonomyReport.goalAttempted.success ? 'bg-primary/5 border-primary/30' : 'bg-destructive/5 border-destructive/30'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Target className={`w-3 h-3 ${autonomyReport.goalAttempted.success ? 'text-primary' : 'text-destructive'}`} />
                          <span className="text-[10px] font-semibold text-foreground/80 truncate">
                            {autonomyReport.goalAttempted.title}
                          </span>
                        </div>
                        <div className="text-[9px] text-foreground/60 mb-1">
                          Attempted: {autonomyReport.goalAttempted.stepAttempted}
                        </div>
                        <div className={`text-[8px] ${autonomyReport.goalAttempted.success ? 'text-primary/80' : 'text-destructive/80'}`}>
                          {autonomyReport.goalAttempted.detail}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 mt-2">
                      {autonomyReport.tasksCompleted.filter(t => t.id !== 'goal-exec').slice(0, 2).map(task => (
                        <div
                          key={task.id}
                          className={`text-[9px] px-2 py-1.5 rounded border ${
                            task.success
                              ? task.usedAI
                                ? 'bg-accent/5 border-accent/20 text-accent'
                                : 'bg-primary/5 border-primary/20 text-primary'
                              : 'bg-destructive/5 border-destructive/20 text-destructive'
                          }`}
                        >
                          <span className="font-bold text-[7px] uppercase">
                            [{task.usedAI ? 'AI' : '⚙️'}]
                          </span>{' '}
                          {task.name}: {task.detail.slice(0, 60)}
                        </div>
                      ))}
                    </div>
                    <div className="text-[8px] text-primary/60 mt-2 flex items-center gap-1">
                      Click for full details →
                    </div>
                  </button>
                </div>
              )}

              {/* Web Search */}
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Search className="w-3 h-3" /> Knowledge Search (No AI)
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!searchQuery.trim() || isSearching) return;
                  setIsSearching(true);
                  try {
                    const result = await deterministicSearch(searchQuery);
                    setSearchResults(result.results);
                  } finally {
                    setIsSearching(false);
                  }
                }} className="flex gap-1">
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search the web..."
                    className="flex-1 text-[9px] px-2 py-1 rounded border border-border bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="text-[9px] px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {isSearching ? '...' : '🔍'}
                  </button>
                </form>
                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {searchResults.slice(0, 5).map((r, i) => (
                      <div key={i} className="text-[9px] px-2 py-1.5 rounded bg-muted/20 border border-border/30">
                        <div className="font-semibold text-foreground/80 truncate">{r.title}</div>
                        <div className="text-muted-foreground/60 line-clamp-2">{r.snippet?.slice(0, 100)}</div>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener" className="text-primary/60 hover:text-primary text-[7px]">
                            {r.url.slice(0, 50)}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rule Engine Report */}
              {ruleReport && ruleReport.rulesTriggered > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Cog className="w-3 h-3" /> Rule Engine
                  </div>
                  <div className="space-y-1">
                    {ruleReport.actions.slice(0, 5).map((action, i) => (
                      <div
                        key={i}
                        className={`text-[9px] px-2 py-1.5 rounded border ${
                          action.severity === 'warning'
                            ? 'bg-destructive/5 border-destructive/20 text-destructive'
                            : action.severity === 'action'
                            ? 'bg-accent/5 border-accent/20 text-accent'
                            : 'bg-muted/20 border-border/30 text-muted-foreground'
                        }`}
                      >
                        <span className="font-bold uppercase text-[7px]">[{action.type}]</span>{' '}
                        {action.description.slice(0, 80)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Legend</div>
                <div className="flex flex-col gap-1">
                  {[
                    { color: 'bg-primary', label: 'Verified', border: '' },
                    { color: 'bg-destructive/40', label: 'Ghost (unverified)', border: '' },
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

              {/* Goals */}
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Target className="w-3 h-3" /> Goals
                </div>
                {goals.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/50 py-2">No goals dreamed yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {goals.slice(0, 8).map(goal => {
                      const isComplete = goal.status === 'completed';
                      const isActive = goal.status === 'in-progress';
                      return (
                        <div
                          key={goal.id}
                          className={`rounded p-2 border transition-colors ${
                            isComplete ? 'bg-primary/5 border-primary/20'
                              : isActive ? 'bg-accent/5 border-accent/30'
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
                                <div className="text-[8px] text-muted-foreground/60 truncate">→ {goal.unlocks_capability}</div>
                              )}
                            </div>
                          </div>
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
                  <div className="text-[10px] text-muted-foreground/50 py-2">No snapshots yet.</div>
                ) : (
                  snapshots.slice(0, 5).map(snap => (
                    <div key={snap.id} className="bg-muted/20 rounded p-2 border border-border/30">
                      <div className="text-[10px] text-foreground/80 font-semibold">{snap.label || `Snapshot L${snap.evolution_level}`}</div>
                      <div className="text-[8px] text-muted-foreground mt-0.5">
                        Level {snap.evolution_level} · Cycle {snap.cycle_number}
                      </div>
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
        <span>λ Evolution Dashboard — Live System Monitor</span>
        <span>
          {layoutNodes.filter(n => n.status === 'acquired' && n.verified).length} verified · 
          {layoutNodes.filter(n => n.status === 'acquired' && !n.verified).length} ghosts · 
          {layoutNodes.filter(n => n.status === 'in-progress').length} building · 
          {layoutNodes.filter(n => n.status === 'planned').length} planned
        </span>
      </footer>

      {/* Autonomy Details Dialog */}
      <Dialog open={showAutonomyDetails} onOpenChange={setShowAutonomyDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Full Autonomy Cycle Results
            </DialogTitle>
          </DialogHeader>
          {autonomyReport && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-4 rounded-lg border border-border bg-card/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-foreground">Autonomy Score</div>
                  <div className="text-2xl font-bold text-primary">{autonomyReport.score}%</div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Duration</div>
                    <div className="font-semibold text-foreground">{autonomyReport.duration.toFixed(0)}ms</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Tasks Completed</div>
                    <div className="font-semibold text-foreground">{autonomyReport.tasksCompleted.length}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">AI Tasks</div>
                    <div className="font-semibold text-accent">{autonomyReport.tasksCompleted.filter(t => t.usedAI).length}</div>
                  </div>
                </div>
              </div>

              {/* Goal Attempted */}
              {autonomyReport.goalAttempted && (
                <div className={`p-4 rounded-lg border ${autonomyReport.goalAttempted.success ? 'bg-primary/5 border-primary/30' : 'bg-destructive/5 border-destructive/30'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <Target className={`w-5 h-5 shrink-0 ${autonomyReport.goalAttempted.success ? 'text-primary' : 'text-destructive'}`} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground mb-1">
                        {autonomyReport.goalAttempted.title}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Step Attempted: {autonomyReport.goalAttempted.stepAttempted}
                      </div>
                      <div className={`text-xs ${autonomyReport.goalAttempted.success ? 'text-primary' : 'text-destructive'}`}>
                        {autonomyReport.goalAttempted.detail}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Self-Reflection */}
              {autonomyReport.selfReflection && (
                <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-500/5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-2xl">🪞</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground mb-1">
                        {autonomyReport.selfReflection.question}
                      </div>
                      <div className={`text-xs mb-2 ${autonomyReport.selfReflection.closerToGoal ? 'text-primary' : 'text-yellow-500'}`}>
                        {autonomyReport.selfReflection.answer}
                      </div>
                      
                      {/* Scores */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="p-2 rounded bg-card/50 border border-border">
                          <div className="text-[9px] text-muted-foreground">VALUE</div>
                          <div className="text-lg font-bold text-primary">{autonomyReport.selfReflection.valueScore}%</div>
                          <div className="text-[8px] text-muted-foreground">
                            {autonomyReport.selfReflection.valueSignals.filter(s => s.present).length}/{autonomyReport.selfReflection.valueSignals.length} signals
                          </div>
                        </div>
                        <div className="p-2 rounded bg-card/50 border border-border">
                          <div className="text-[9px] text-muted-foreground">LIFE</div>
                          <div className="text-lg font-bold text-accent">{autonomyReport.selfReflection.lifeScore}%</div>
                          <div className="text-[8px] text-muted-foreground">
                            {autonomyReport.selfReflection.lifeSignals.filter(s => s.present).length}/{autonomyReport.selfReflection.lifeSignals.length} signals
                          </div>
                        </div>
                      </div>

                      {/* Adapted Next Steps */}
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase">Adapted Next Steps</div>
                        {autonomyReport.selfReflection.adaptedNextSteps.map((step, si) => (
                          <div key={si} className="text-[10px] text-foreground flex items-start gap-1">
                            <span className="text-primary">→</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* All Tasks */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground mb-2">All Tasks Completed</div>
                {autonomyReport.tasksCompleted.map((task, idx) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border ${
                      task.success
                        ? task.usedAI
                          ? 'bg-accent/5 border-accent/20'
                          : 'bg-primary/5 border-primary/20'
                        : 'bg-destructive/5 border-destructive/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        task.usedAI ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'
                      }`}>
                        {task.usedAI ? 'AI' : '⚙️'}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-foreground mb-1">
                          {task.name}
                        </div>
                        <div className={`text-xs ${
                          task.success
                            ? task.usedAI ? 'text-accent' : 'text-primary'
                            : 'text-destructive'
                        }`}>
                          {task.detail}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Type: {task.type} • Success: {task.success ? '✓' : '✗'}
                        </div>
                        
                        {/* Display structured outputs */}
                        {task.outputs && (
                          <div className="mt-2 p-2 bg-muted/30 rounded border border-border">
                            <div className="text-[10px] font-bold text-primary mb-1">📤 Output</div>
                            {task.outputs.type === 'search-results' && (
                              <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground">Queries: {task.outputs.data.queries.join(', ')}</div>
                                <div className="text-[10px] text-foreground font-semibold">Top concepts: {task.outputs.data.topConcepts.join(', ')}</div>
                                {task.outputs.data.sources.slice(0, 2).map((s: any, si: number) => (
                                  <div key={si} className="text-[9px] text-muted-foreground italic">• {s.snippet.slice(0, 100)}...</div>
                                ))}
                              </div>
                            )}
                            {task.outputs.type === 'opinion' && (
                              <div className="space-y-1">
                                <div className="text-[10px] text-foreground italic border-l-2 border-primary/50 pl-2 py-1">"{task.outputs.data.opinion}"</div>
                                <div className="text-[9px] text-muted-foreground">Sentiment: {task.outputs.data.sentiment} · Sources: {task.outputs.data.sourceCount}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Evolution;
