import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Network, Zap, GitBranch, Layers, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Capability {
  id: string;
  name: string;
  description: string;
  built_on: string[] | null;
  evolution_level: number;
  cycle_number: number;
  acquired_at: string;
  source_file: string | null;
}

interface GraphNode {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  connections: string[];
  description: string;
  status: 'acquired' | 'planned' | 'in-progress';
}

interface LevelBand {
  level: number;
  label: string;
  yStart: number;
  yEnd: number;
}

const TIER_COLORS: Record<number, string> = {
  0: 'hsl(var(--primary))',
  1: 'hsl(142, 71%, 45%)',
  2: 'hsl(48, 96%, 53%)',
  3: 'hsl(280, 87%, 65%)',
  4: 'hsl(350, 89%, 60%)',
};

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

function getTierColor(level: number): string {
  if (level >= 30) return TIER_COLORS[4];
  if (level >= 20) return TIER_COLORS[3];
  if (level >= 10) return TIER_COLORS[2];
  if (level >= 1) return TIER_COLORS[1];
  return TIER_COLORS[0];
}

function layoutSquareGraph(
  nodes: GraphNode[],
  size: number
): { nodes: GraphNode[]; size: number; levelBands: LevelBand[] } {
  if (nodes.length === 0) return { nodes: [], size, levelBands: [] };

  const levels = new Map<number, GraphNode[]>();
  nodes.forEach(n => {
    if (!levels.has(n.level)) levels.set(n.level, []);
    levels.get(n.level)!.push(n);
  });

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const numLevels = sortedLevels.length;
  if (numLevels === 0) return { nodes: [], size, levelBands: [] };

  const padding = 40;
  const usable = size - padding * 2;
  const bandHeight = usable / numLevels;

  const result: GraphNode[] = [];
  const levelBands: LevelBand[] = [];

  sortedLevels.forEach((lvl, li) => {
    const band = levels.get(lvl)!;
    const yCenter = padding + li * bandHeight + bandHeight / 2;
    const yStart = padding + li * bandHeight;
    const yEnd = yStart + bandHeight;

    levelBands.push({
      level: lvl,
      label: EVOLUTION_TITLES[lvl] || `L${lvl}`,
      yStart,
      yEnd,
    });

    const count = band.length;
    const spacing = Math.min(usable / (count + 1), 80);
    const totalWidth = spacing * (count - 1);
    const startX = padding + (usable - totalWidth) / 2;

    band.forEach((node, ni) => {
      result.push({
        ...node,
        x: count === 1 ? size / 2 : startX + ni * spacing,
        y: yCenter,
      });
    });
  });

  return { nodes: result, size, levelBands };
}

const EvolutionMatrix: React.FC = () => {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; size: number; levelBands: LevelBand[] }>({ nodes: [], size: 800, levelBands: [] });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [containerSize, setContainerSize] = useState(800);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalCaps, setTotalCaps] = useState(0);
  const mainRef = React.useRef<HTMLDivElement>(null);

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        setContainerSize(Math.max(600, Math.min(rect.width, rect.height)));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fetchData = useCallback(async () => {
    const [capRes, stateRes, goalsRes] = await Promise.all([
      supabase.from('capabilities').select('*').order('evolution_level', { ascending: true }),
      supabase.from('evolution_state').select('*').eq('id', 'singleton').single(),
      supabase.from('goals').select('*'),
    ]);

    const caps = capRes.data || [];
    const acquiredNames = new Set(caps.map(c => c.name));

    // Acquired nodes
    const acquiredNodes: GraphNode[] = caps.map(cap => ({
      id: cap.id,
      name: cap.name,
      level: cap.evolution_level,
      x: 0, y: 0,
      connections: cap.built_on || [],
      description: cap.description,
      status: 'acquired' as const,
    }));

    // Planned/in-progress from goals
    const goalNodes: GraphNode[] = (goalsRes.data || [])
      .filter(g => g.unlocks_capability && !acquiredNames.has(g.unlocks_capability) && g.status !== 'completed')
      .map(g => {
        const maxLevel = acquiredNodes.length > 0 ? Math.max(...acquiredNodes.map(n => n.level)) : 1;
        return {
          id: g.unlocks_capability!,
          name: g.unlocks_capability!,
          level: maxLevel + (g.status === 'in-progress' ? 1 : 2),
          x: 0, y: 0,
          connections: g.required_capabilities || [],
          description: g.description,
          status: (g.status === 'in-progress' ? 'in-progress' : 'planned') as GraphNode['status'],
        };
      });

    const allNodes = [...acquiredNodes, ...goalNodes];
    setGraphData(layoutSquareGraph(allNodes, containerSize));
    setTotalCaps(caps.length);
    if (stateRes.data) setCurrentLevel(stateRes.data.evolution_level);
    setLoading(false);
  }, [containerSize]);

  // Fetch + poll every 5s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const { nodes, size, levelBands } = graphData;
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const tierStats = useMemo(() => {
    const stats = new Map<string, number>();
    nodes.filter(n => n.status === 'acquired').forEach(n => {
      const color = getTierColor(n.level);
      const label = n.level >= 30 ? 'ARCHITECT' : n.level >= 20 ? 'OPTIMIZER' : n.level >= 10 ? 'SAGE' : 'FOUNDATION';
      stats.set(label, (stats.get(label) || 0) + 1);
    });
    return stats;
  }, [nodes]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Network className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold tracking-tight">Evolution Chronosphere</h1>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              L{currentLevel} {EVOLUTION_TITLES[currentLevel] || ''} · {totalCaps} caps
            </span>
          </div>
          <div className="flex items-center gap-3">
            {Array.from(tierStats.entries()).map(([label, count]) => (
              <div key={label} className="flex items-center gap-1 text-[9px]">
                <div className="w-2 h-2 rounded-full" style={{
                  backgroundColor: getTierColor(
                    label === 'ARCHITECT' ? 30 : label === 'OPTIMIZER' ? 20 : label === 'SAGE' ? 10 : 1
                  )
                }} />
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Graph - square, auto-fit */}
        <main ref={mainRef} className="flex-1 relative overflow-hidden flex items-center justify-center">
          {loading ? (
            <Activity className="w-6 h-6 text-primary animate-pulse" />
          ) : (
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="max-w-full max-h-full"
              style={{ aspectRatio: '1 / 1' }}
            >
              <defs>
                <pattern id="chrono-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border) / 0.15)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#chrono-grid)" />

              {/* Level bands */}
              {levelBands.map((band, i) => {
                const isCurrent = band.level === currentLevel;
                return (
                  <g key={`band-${band.level}`}>
                    <rect
                      x={0} y={band.yStart}
                      width={size} height={band.yEnd - band.yStart}
                      fill={isCurrent ? 'hsl(280 87% 65% / 0.04)' : i % 2 === 0 ? 'hsl(220 15% 8% / 0.3)' : 'transparent'}
                      stroke={isCurrent ? 'hsl(280 87% 65% / 0.15)' : 'none'}
                      strokeWidth={isCurrent ? 1 : 0}
                    />
                    <text
                      x={12} y={(band.yStart + band.yEnd) / 2 + 3}
                      fill={isCurrent ? 'hsl(280 87% 75%)' : 'hsl(220 10% 25%)'}
                      fontSize="7"
                      fontFamily="monospace"
                      fontWeight={isCurrent ? 'bold' : 'normal'}
                    >
                      L{band.level} {band.label}
                    </text>
                    {isCurrent && (
                      <text
                        x={12} y={(band.yStart + band.yEnd) / 2 + 12}
                        fill="hsl(280 87% 65% / 0.5)"
                        fontSize="5"
                        fontFamily="monospace"
                      >
                        ▸ CURRENT
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Edges */}
              {nodes.map(node =>
                node.connections.map(depId => {
                  const dep = nodeMap.get(depId);
                  if (!dep) return null;
                  const isHighlighted = hoveredNode === node.id || hoveredNode === depId;
                  const isPlanned = node.status !== 'acquired';
                  return (
                    <line
                      key={`${node.id}-${depId}`}
                      x1={dep.x} y1={dep.y}
                      x2={node.x} y2={node.y}
                      stroke={isHighlighted ? getTierColor(node.level) : 'hsl(var(--border))'}
                      strokeWidth={isHighlighted ? 1.5 : 0.5}
                      strokeOpacity={isHighlighted ? 0.9 : isPlanned ? 0.15 : 0.3}
                      strokeDasharray={isPlanned ? '3 3' : isHighlighted ? 'none' : '4 4'}
                    />
                  );
                })
              )}

              {/* Nodes */}
              {nodes.map((node, i) => {
                const isHovered = hoveredNode === node.id;
                const isSelected = selectedNode?.id === node.id;
                const color = getTierColor(node.level);
                const isGhost = node.status !== 'acquired';
                const r = Math.min(10, Math.max(4, size * 0.01));

                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => setSelectedNode(isSelected ? null : node)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <circle cx={node.x} cy={node.y} r={r + 6} fill={color} opacity={0.12} />
                    )}
                    <circle
                      cx={node.x} cy={node.y}
                      r={isSelected ? r + 3 : isHovered ? r + 2 : r}
                      fill={isGhost ? 'hsl(220 15% 12%)' : color}
                      stroke={isGhost ? 'hsl(220 10% 25%)' : isHovered ? 'hsl(var(--foreground))' : 'none'}
                      strokeWidth={1}
                      strokeDasharray={isGhost ? '2 2' : 'none'}
                      opacity={isGhost ? 0.4 : 1}
                      style={{ transition: 'r 0.15s ease' }}
                    />
                    {/* Label on hover/select */}
                    {(isHovered || isSelected) && (
                      <text
                        x={node.x} y={node.y + r + 12}
                        textAnchor="middle"
                        fill={isGhost ? 'hsl(220 10% 35%)' : 'hsl(var(--foreground))'}
                        fontSize="6"
                        fontFamily="monospace"
                      >
                        {node.name.length > 25 ? node.name.slice(0, 23) + '…' : node.name}
                      </text>
                    )}
                    {isGhost && (isHovered || isSelected) && (
                      <text
                        x={node.x} y={node.y + r + 20}
                        textAnchor="middle"
                        fill="hsl(220 10% 30%)"
                        fontSize="5"
                        fontFamily="monospace"
                      >
                        ◌ planned
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {/* Selected detail overlay */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-4 max-w-md bg-card border border-border rounded-lg p-4 shadow-xl"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTierColor(selectedNode.level) }} />
                  <span className="text-[9px] text-muted-foreground font-mono">
                    L{selectedNode.level} · {EVOLUTION_TITLES[selectedNode.level] || ''}
                    {selectedNode.status !== 'acquired' && ' · PLANNED'}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-foreground">{selectedNode.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {selectedNode.description.slice(0, 200)}
                </p>
                {selectedNode.connections.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <GitBranch className="w-3 h-3" /> Built on
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.connections.map(dep => (
                        <span key={dep} className="text-[8px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(() => {
                  const dependents = nodes.filter(n => n.connections.includes(selectedNode.id));
                  if (dependents.length === 0) return null;
                  return (
                    <div className="mt-2">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Enables
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {dependents.map(d => (
                          <span key={d.id} className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default EvolutionMatrix;
