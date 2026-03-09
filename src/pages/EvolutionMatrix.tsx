import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Network, Zap, GitBranch, Layers, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEvolutionTitle } from '@/lib/evolution-titles';

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

// Journey zones — nested squares from smallest (bottom-left) to largest
const JOURNEY_ZONES = [
  { key: 'think', label: 'Can Think', maxLevel: 3, color: 'hsl(var(--primary) / 0.12)', border: 'hsl(var(--primary) / 0.3)' },
  { key: 'remember', label: 'Can Remember', maxLevel: 6, color: 'hsl(142 71% 45% / 0.08)', border: 'hsl(142 71% 45% / 0.25)' },
  { key: 'learn', label: 'Can Learn', maxLevel: 10, color: 'hsl(48 96% 53% / 0.07)', border: 'hsl(48 96% 53% / 0.2)' },
  { key: 'create', label: 'Can Create', maxLevel: 16, color: 'hsl(280 87% 65% / 0.06)', border: 'hsl(280 87% 65% / 0.18)' },
  { key: 'evolve', label: 'Can Evolve', maxLevel: 23, color: 'hsl(350 89% 60% / 0.05)', border: 'hsl(350 89% 60% / 0.15)' },
  { key: 'transcend', label: 'Can Transcend', maxLevel: Infinity, color: 'hsl(220 15% 50% / 0.03)', border: 'hsl(220 15% 50% / 0.1)' },
];

function getZoneForLevel(level: number) {
  return JOURNEY_ZONES.find(z => level <= z.maxLevel) || JOURNEY_ZONES[JOURNEY_ZONES.length - 1];
}

function getZoneIndex(level: number) {
  return JOURNEY_ZONES.findIndex(z => level <= z.maxLevel);
}

const TIER_COLORS: Record<number, string> = {
  0: 'hsl(var(--primary))',
  1: 'hsl(142, 71%, 45%)',
  2: 'hsl(48, 96%, 53%)',
  3: 'hsl(280, 87%, 65%)',
  4: 'hsl(350, 89%, 60%)',
  5: 'hsl(220, 60%, 70%)',
};

function getTierColor(level: number): string {
  const zi = getZoneIndex(level);
  return TIER_COLORS[Math.min(zi, 5)] || TIER_COLORS[0];
}

/**
 * Layout nodes into nested squares anchored at bottom-left.
 * Each zone is a square region; zones nest inside each other.
 */
function layoutNestedSquares(
  nodes: GraphNode[],
  size: number
): { nodes: GraphNode[]; size: number; zones: { key: string; label: string; x: number; y: number; w: number; h: number; color: string; border: string; nodeCount: number }[] } {
  if (nodes.length === 0) return { nodes: [], size, zones: [] };

  // Group nodes by zone
  const zoneNodes = new Map<number, GraphNode[]>();
  nodes.forEach(n => {
    const zi = getZoneIndex(n.level);
    if (!zoneNodes.has(zi)) zoneNodes.set(zi, []);
    zoneNodes.get(zi)!.push(n);
  });

  // Find max zone that has nodes (or planned)
  const activeZones = JOURNEY_ZONES.map((z, i) => ({
    ...z,
    index: i,
    nodes: zoneNodes.get(i) || [],
  })).filter((_, i) => {
    // Include zone if it or any smaller zone has nodes
    for (let j = 0; j <= i; j++) {
      if (zoneNodes.has(j) && zoneNodes.get(j)!.length > 0) return true;
    }
    return false;
  });

  // Always show at least up to the zone that contains nodes
  const maxActiveIndex = Math.max(...Array.from(zoneNodes.keys()), 0);
  const zonesToShow = JOURNEY_ZONES.slice(0, Math.max(maxActiveIndex + 1, 1));

  const padding = 30;
  const totalSize = size - padding * 2;
  const numZones = zonesToShow.length;

  // Each zone square: zone 0 is smallest (bottom-left), zone N is largest
  // Zone i occupies fraction (i+1)/numZones of total space
  const zoneRects: { key: string; label: string; x: number; y: number; w: number; h: number; color: string; border: string; nodeCount: number }[] = [];
  
  zonesToShow.forEach((zone, i) => {
    const frac = (i + 1) / numZones;
    const w = totalSize * frac;
    const h = totalSize * frac;
    // Anchored bottom-left
    const x = padding;
    const y = padding + totalSize - h;
    const nc = zoneNodes.get(i)?.length || 0;
    zoneRects.push({ key: zone.key, label: zone.label, x, y, w, h, color: zone.color, border: zone.border, nodeCount: nc });
  });

  // Place nodes within their zone's exclusive area
  const result: GraphNode[] = [];
  
  zonesToShow.forEach((zone, zi) => {
    const nodesInZone = zoneNodes.get(zi) || [];
    if (nodesInZone.length === 0) return;

    const rect = zoneRects[zi];
    // The exclusive area for this zone is the ring between this square and the inner square
    const innerRect = zi > 0 ? zoneRects[zi - 1] : null;
    
    // Place nodes in the exclusive ring area
    // For the innermost zone, use the full square
    let minX: number, maxX: number, minY: number, maxY: number;
    
    if (!innerRect) {
      // Innermost zone — use full square with padding
      minX = rect.x + 15;
      maxX = rect.x + rect.w - 15;
      minY = rect.y + 18;
      maxY = rect.y + rect.h - 15;
    } else {
      // Ring zone — place in the L-shaped area around the inner square
      // Use the right and top strips of the ring
      minX = rect.x + 15;
      maxX = rect.x + rect.w - 15;
      minY = rect.y + 18;
      maxY = rect.y + rect.h - 15;
    }

    // Distribute nodes. For ring zones, avoid the inner square area
    const count = nodesInZone.length;
    
    if (!innerRect) {
      // Grid layout in full square
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const xStep = (maxX - minX) / Math.max(cols, 1);
      const yStep = (maxY - minY) / Math.max(rows, 1);
      
      nodesInZone.forEach((node, ni) => {
        const col = ni % cols;
        const row = Math.floor(ni / cols);
        result.push({
          ...node,
          x: minX + xStep * 0.5 + col * xStep,
          y: minY + yStep * 0.5 + row * yStep,
        });
      });
    } else {
      // Place in ring: collect valid positions along top strip and right strip
      const positions: { x: number; y: number }[] = [];
      const innerRight = innerRect.x + innerRect.w;
      const innerTop = innerRect.y;
      
      // Top strip (above inner square)
      const topStripH = innerTop - rect.y;
      if (topStripH > 20) {
        const cols = Math.max(1, Math.floor((maxX - minX) / 40));
        const rows = Math.max(1, Math.floor(topStripH / 40));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            positions.push({
              x: minX + ((maxX - minX) / (cols + 1)) * (c + 1),
              y: minY + (topStripH / (rows + 1)) * (r + 1),
            });
          }
        }
      }
      
      // Right strip (right of inner square, below top strip)
      const rightStripW = rect.x + rect.w - innerRight;
      if (rightStripW > 20) {
        const rsMinY = Math.max(innerTop, minY);
        const rsMaxY = maxY;
        const cols = Math.max(1, Math.floor(rightStripW / 40));
        const rows = Math.max(1, Math.floor((rsMaxY - rsMinY) / 40));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            positions.push({
              x: innerRight + (rightStripW / (cols + 1)) * (c + 1),
              y: rsMinY + ((rsMaxY - rsMinY) / (rows + 1)) * (r + 1),
            });
          }
        }
      }

      // If we don't have enough positions, add more evenly
      while (positions.length < count) {
        const angle = (positions.length / count) * Math.PI * 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = (maxX - minX) * 0.35;
        const ry = (maxY - minY) * 0.35;
        positions.push({
          x: cx + Math.cos(angle) * rx,
          y: cy + Math.sin(angle) * ry,
        });
      }

      nodesInZone.forEach((node, ni) => {
        const pos = positions[ni % positions.length];
        result.push({ ...node, x: pos.x, y: pos.y });
      });
    }
  });

  return { nodes: result, size, zones: zoneRects };
}

const EvolutionMatrix: React.FC = () => {
  const [graphData, setGraphData] = useState<ReturnType<typeof layoutNestedSquares>>({ nodes: [], size: 800, zones: [] });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [containerSize, setContainerSize] = useState(800);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalCaps, setTotalCaps] = useState(0);
  const mainRef = React.useRef<HTMLDivElement>(null);

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

    const acquiredNodes: GraphNode[] = caps.map(cap => ({
      id: cap.id,
      name: cap.name,
      level: cap.evolution_level,
      x: 0, y: 0,
      connections: cap.built_on || [],
      description: cap.description,
      status: 'acquired' as const,
    }));

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
    setGraphData(layoutNestedSquares(allNodes, containerSize));
    setTotalCaps(caps.length);
    if (stateRes.data) setCurrentLevel(stateRes.data.evolution_level);
    setLoading(false);
  }, [containerSize]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const { nodes, size, zones } = graphData;
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

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
              L{currentLevel} {getEvolutionTitle(currentLevel)} · {totalCaps} caps
            </span>
          </div>
          {/* Zone legend */}
          <div className="flex items-center gap-3">
            {zones.map((zone) => (
              <div key={zone.key} className="flex items-center gap-1 text-[9px]">
                <div className="w-2.5 h-2.5 rounded-sm border" style={{ backgroundColor: zone.color, borderColor: zone.border }} />
                <span className="text-muted-foreground">{zone.label}</span>
                <span className="font-mono text-foreground">{zone.nodeCount}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
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

              {/* Nested zone squares — render largest first (back) to smallest (front) */}
              {[...zones].reverse().map((zone, ri) => (
                <g key={zone.key}>
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.h}
                    fill={zone.color}
                    stroke={zone.border}
                    strokeWidth={1}
                    rx={4}
                  />
                  {/* Zone label — bottom-right corner of each zone */}
                  <text
                    x={zone.x + zone.w - 8}
                    y={zone.y + 14}
                    textAnchor="end"
                    fill={zone.border}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    opacity={0.7}
                  >
                    {zone.label}
                  </text>
                  {zone.nodeCount > 0 && (
                    <text
                      x={zone.x + zone.w - 8}
                      y={zone.y + 24}
                      textAnchor="end"
                      fill={zone.border}
                      fontSize="7"
                      fontFamily="monospace"
                      opacity={0.4}
                    >
                      {zone.nodeCount} node{zone.nodeCount !== 1 ? 's' : ''}
                    </text>
                  )}
                </g>
              ))}

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
              {nodes.map((node) => {
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
                    L{selectedNode.level} · {getEvolutionTitle(selectedNode.level)} · {getZoneForLevel(selectedNode.level).label}
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
