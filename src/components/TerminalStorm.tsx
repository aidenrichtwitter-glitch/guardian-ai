import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface StormProcess {
  id: string;
  label: string;
  source: string;
  target: string;
  type: 'rule' | 'ai' | 'test' | 'capability' | 'mutation';
  status: 'running' | 'success' | 'fail';
  reason?: string;
  timestamp: number;
}

// Global bus for storm events
const stormListeners: Set<(p: StormProcess) => void> = new Set();
export function emitStormProcess(p: Omit<StormProcess, 'id' | 'timestamp'>) {
  const event: StormProcess = {
    ...p,
    id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
  };
  stormListeners.forEach(fn => fn(event));
}

const TYPE_COLORS: Record<StormProcess['type'], string> = {
  rule: 'hsl(140, 70%, 45%)',
  ai: 'hsl(40, 90%, 55%)',
  test: 'hsl(175, 70%, 40%)',
  capability: 'hsl(140, 70%, 65%)',
  mutation: 'hsl(280, 87%, 65%)',
};

interface NodePosition {
  name: string;
  x: number;
  y: number;
  verified: boolean;
}

interface LightningBolt {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  label: string;
  status: 'success' | 'fail' | 'running';
  createdAt: number;
  duration: number;
  midPoints: { x: number; y: number }[];
}

/**
 * SVG-based lightning that travels between actual graph nodes.
 * Rendered inside the capability graph SVG.
 */
export const StormLightning: React.FC<{
  nodes: NodePosition[];
  canvasSize: number;
}> = ({ nodes, canvasSize }) => {
  const [bolts, setBolts] = useState<LightningBolt[]>([]);

  // Listen for storm events and map them to actual node positions
  useEffect(() => {
    if (nodes.length < 2) return;

    const handler = (p: StormProcess) => {
      // Pick two random nodes to connect
      const fromIdx = Math.floor(Math.random() * nodes.length);
      let toIdx = Math.floor(Math.random() * nodes.length);
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % nodes.length;

      const from = nodes[fromIdx];
      const to = nodes[toIdx];

      // Generate jagged mid-points for lightning effect
      const midPoints = generateLightningPath(from.x, from.y, to.x, to.y, 3);

      const bolt: LightningBolt = {
        id: p.id,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        color: p.status === 'fail' ? 'hsl(0, 70%, 50%)' : TYPE_COLORS[p.type],
        label: p.label,
        status: p.status,
        createdAt: Date.now(),
        duration: 1200 + Math.random() * 800,
        midPoints,
      };

      setBolts(prev => [...prev.slice(-15), bolt]);
    };

    stormListeners.add(handler);
    return () => { stormListeners.delete(handler); };
  }, [nodes]);

  // Decay old bolts
  useEffect(() => {
    const interval = setInterval(() => {
      setBolts(prev => prev.filter(b => Date.now() - b.createdAt < b.duration));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  if (nodes.length < 2) return null;

  return (
    <g className="storm-lightning">
      <AnimatePresence>
        {bolts.map(bolt => {
          const pathD = buildLightningPath(bolt);
          return (
            <g key={bolt.id}>
              {/* Glow under-layer */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={bolt.color}
                strokeWidth="3"
                strokeOpacity={0.15}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1, strokeOpacity: [0.15, 0.05] }}
                exit={{ strokeOpacity: 0 }}
                transition={{ duration: bolt.duration / 1000, ease: 'easeOut' }}
              />
              {/* Main bolt */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={bolt.color}
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, strokeOpacity: 0.8 }}
                animate={{ pathLength: 1, strokeOpacity: [0.8, 0] }}
                exit={{ strokeOpacity: 0 }}
                transition={{ duration: bolt.duration / 1000, ease: 'easeOut' }}
              />
              {/* Impact flash on target node */}
              <motion.circle
                cx={bolt.toX}
                cy={bolt.toY}
                r={4}
                fill={bolt.color}
                initial={{ opacity: 0, r: 2 }}
                animate={{ opacity: [0.6, 0], r: [2, 12] }}
                transition={{ duration: 0.5, delay: (bolt.duration / 1000) * 0.7 }}
              />
            </g>
          );
        })}
      </AnimatePresence>
    </g>
  );
};

/** Generate jagged lightning mid-points between two positions */
function generateLightningPath(
  x1: number, y1: number, x2: number, y2: number, segments: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const jitter = dist * 0.15; // 15% of distance as jitter

  for (let i = 1; i <= segments; i++) {
    const t = i / (segments + 1);
    points.push({
      x: x1 + dx * t + (Math.random() - 0.5) * jitter,
      y: y1 + dy * t + (Math.random() - 0.5) * jitter,
    });
  }

  return points;
}

/** Build SVG path string for a lightning bolt with jagged mid-points */
function buildLightningPath(bolt: LightningBolt): string {
  const parts = [`M ${bolt.fromX} ${bolt.fromY}`];
  for (const pt of bolt.midPoints) {
    parts.push(`L ${pt.x} ${pt.y}`);
  }
  parts.push(`L ${bolt.toX} ${bolt.toY}`);
  return parts.join(' ');
}

export default StormLightning;
