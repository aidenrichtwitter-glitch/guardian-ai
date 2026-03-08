import React, { useEffect, useState } from 'react';
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
}

const TIER_COLORS: Record<number, string> = {
  0: 'hsl(var(--primary))',
  1: 'hsl(142, 71%, 45%)',
  2: 'hsl(48, 96%, 53%)',
  3: 'hsl(280, 87%, 65%)',
  4: 'hsl(350, 89%, 60%)',
};

function getTierColor(level: number): string {
  if (level >= 30) return TIER_COLORS[4];
  if (level >= 20) return TIER_COLORS[3];
  if (level >= 10) return TIER_COLORS[2];
  if (level >= 1) return TIER_COLORS[1];
  return TIER_COLORS[0];
}

function getTierLabel(level: number): string {
  if (level >= 40) return 'SINGULARITY';
  if (level >= 30) return 'ARCHITECT';
  if (level >= 20) return 'OPTIMIZER';
  if (level >= 10) return 'SAGE';
  if (level >= 1) return 'FOUNDATION';
  return 'NASCENT';
}

function layoutGraph(capabilities: Capability[]): GraphNode[] {
  // Group by evolution level tiers
  const tiers = new Map<number, Capability[]>();
  capabilities.forEach(cap => {
    const tier = Math.floor(cap.evolution_level / 5) * 5;
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier)!.push(cap);
  });

  const sortedTiers = Array.from(tiers.entries()).sort((a, b) => a[0] - b[0]);
  const nodes: GraphNode[] = [];
  const padding = 80;
  const tierHeight = 120;

  sortedTiers.forEach(([_tier, caps], tierIdx) => {
    const y = padding + tierIdx * tierHeight;
    const totalWidth = 900;
    const spacing = totalWidth / (caps.length + 1);

    caps.forEach((cap, capIdx) => {
      nodes.push({
        id: cap.id,
        name: cap.name,
        level: cap.evolution_level,
        x: padding + spacing * (capIdx + 1),
        y,
        connections: cap.built_on || [],
        description: cap.description,
      });
    });
  });

  return nodes;
}

const EvolutionMatrix: React.FC = () => {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCapabilities = async () => {
      const { data } = await supabase
        .from('capabilities')
        .select('*')
        .order('evolution_level', { ascending: true });

      if (data) {
        setCapabilities(data);
        setNodes(layoutGraph(data));
      }
      setLoading(false);
    };
    fetchCapabilities();
  }, []);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const svgHeight = Math.max(600, nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) + 120 : 600);

  // Tier summary stats
  const tierStats = capabilities.reduce((acc, cap) => {
    const label = getTierLabel(cap.evolution_level);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Network className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">Evolution Chronosphere</h1>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {capabilities.length} capabilities
            </span>
          </div>
          <div className="flex items-center gap-4">
            {Object.entries(tierStats).map(([label, count]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{
                  backgroundColor: getTierColor(
                    label === 'SINGULARITY' ? 40 :
                    label === 'ARCHITECT' ? 30 :
                    label === 'OPTIMIZER' ? 20 :
                    label === 'SAGE' ? 10 :
                    label === 'FOUNDATION' ? 1 : 0
                  )
                }} />
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-4 flex gap-4">
        {/* Graph */}
        <div className="flex-1 bg-card/30 border border-border rounded-lg overflow-auto relative">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Activity className="w-6 h-6 text-primary animate-pulse" />
            </div>
          ) : (
            <svg width="1100" height={svgHeight} className="w-full">
              {/* Connections */}
              {nodes.map(node =>
                node.connections.map(depId => {
                  const dep = nodeMap.get(depId);
                  if (!dep) return null;
                  const isHighlighted = hoveredNode === node.id || hoveredNode === depId;
                  return (
                    <line
                      key={`${node.id}-${depId}`}
                      x1={dep.x}
                      y1={dep.y}
                      x2={node.x}
                      y2={node.y}
                      stroke={isHighlighted ? getTierColor(node.level) : 'hsl(var(--border))'}
                      strokeWidth={isHighlighted ? 2 : 0.5}
                      strokeOpacity={isHighlighted ? 0.9 : 0.3}
                      strokeDasharray={isHighlighted ? 'none' : '4 4'}
                    />
                  );
                })
              )}

              {/* Nodes */}
              {nodes.map(node => {
                const isHovered = hoveredNode === node.id;
                const color = getTierColor(node.level);
                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer"
                  >
                    {/* Glow */}
                    {isHovered && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={14}
                        fill={color}
                        opacity={0.15}
                      />
                    )}
                    {/* Node circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isHovered ? 8 : 5}
                      fill={color}
                      stroke={isHovered ? 'hsl(var(--foreground))' : 'none'}
                      strokeWidth={1}
                      style={{ transition: 'r 0.15s ease' }}
                    />
                    {/* Label */}
                    <text
                      x={node.x}
                      y={node.y + 18}
                      textAnchor="middle"
                      fill={isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
                      fontSize={isHovered ? 10 : 8}
                      fontFamily="monospace"
                      style={{ transition: 'font-size 0.15s ease' }}
                    >
                      {node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Detail Panel */}
        <div className="w-72 shrink-0">
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-card border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTierColor(selectedNode.level) }} />
                  <span className="text-xs text-muted-foreground font-mono">
                    L{selectedNode.level} · {getTierLabel(selectedNode.level)}
                  </span>
                </div>
                <h3 className="font-bold text-sm">{selectedNode.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedNode.description.slice(0, 300)}
                </p>
                {selectedNode.connections.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <GitBranch className="w-3 h-3" /> Built on
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.connections.map(dep => (
                        <span key={dep} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Dependents */}
                {(() => {
                  const dependents = nodes.filter(n => n.connections.includes(selectedNode.id));
                  if (dependents.length === 0) return null;
                  return (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Enables
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {dependents.map(d => (
                          <span key={d.id} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card/50 border border-dashed border-border rounded-lg p-6 text-center"
              >
                <Network className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Click a node to inspect</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default EvolutionMatrix;
