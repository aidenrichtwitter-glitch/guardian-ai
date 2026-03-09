import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Activity, Zap, AlertTriangle, BarChart3, Target, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { getEvolutionTitle } from '@/lib/evolution-titles';
import { detectPatterns, forecastGrowth, type EvolutionPattern, type GrowthForecast } from '@/lib/pattern-recognition';
import { predictNextEvolutions, type EvolutionPrediction } from '@/lib/evolution-forecasting';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

const PATTERN_ICONS: Record<EvolutionPattern['type'], React.ReactNode> = {
  'growth-burst': <Zap className="w-4 h-4 text-primary" />,
  'stagnation': <AlertTriangle className="w-4 h-4 text-destructive" />,
  'cyclic': <Activity className="w-4 h-4 text-accent-foreground" />,
  'plateau': <Layers className="w-4 h-4 text-muted-foreground" />,
  'breakthrough': <TrendingUp className="w-4 h-4 text-primary" />,
};

const TREND_COLORS: Record<GrowthForecast['trend'], string> = {
  accelerating: 'text-primary',
  steady: 'text-muted-foreground',
  decelerating: 'text-destructive',
  stagnant: 'text-destructive/60',
};

const CATEGORY_COLORS: Record<EvolutionPrediction['category'], string> = {
  infrastructure: 'bg-primary/15 text-primary border-primary/25',
  intelligence: 'bg-accent/15 text-accent-foreground border-accent/25',
  autonomy: 'bg-secondary/30 text-secondary-foreground border-secondary/40',
  resilience: 'bg-destructive/10 text-destructive border-destructive/20',
  integration: 'bg-muted text-muted-foreground border-border',
};

const PatternAnalysis: React.FC = () => {
  const [patterns, setPatterns] = useState<EvolutionPattern[]>([]);
  const [forecast, setForecast] = useState<GrowthForecast | null>(null);
  const [predictions, setPredictions] = useState<EvolutionPrediction[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalCaps, setTotalCaps] = useState(0);
  const [totalCycles, setTotalCycles] = useState(0);
  const [capHistory, setCapHistory] = useState<{ cycle: number; level: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [capRes, stateRes] = await Promise.all([
      supabase.from('capabilities').select('*').order('cycle_number', { ascending: true }),
      supabase.from('evolution_state').select('*').eq('id', 'singleton').single(),
    ]);

    const caps = capRes.data || [];
    const state = stateRes.data;
    const level = state?.evolution_level ?? 0;
    const cycles = state?.cycle_count ?? 0;

    const history = caps.map(c => ({ cycle: c.cycle_number, level: c.evolution_level, name: c.name }));
    const capNames = caps.map(c => c.name);

    setCapHistory(history);
    setCurrentLevel(level);
    setTotalCaps(caps.length);
    setTotalCycles(cycles);
    setPatterns(detectPatterns(history, cycles));
    setForecast(forecastGrowth(history, level, cycles));
    setPredictions(predictNextEvolutions(capNames, level, cycles));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Sparkline data: capability count over cycles
  const sparkline = useMemo(() => {
    if (capHistory.length === 0) return [];
    const maxCycle = Math.max(...capHistory.map(c => c.cycle), totalCycles);
    const bucketSize = Math.max(1, Math.floor(maxCycle / 30));
    const buckets: number[] = [];
    for (let i = 0; i <= maxCycle; i += bucketSize) {
      buckets.push(capHistory.filter(c => c.cycle <= i + bucketSize).length);
    }
    return buckets;
  }, [capHistory, totalCycles]);

  const sparkMax = Math.max(...sparkline, 1);

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
            <h1 className="text-sm font-bold tracking-tight">Pattern Analysis</h1>
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
          <Activity className="w-6 h-6 text-primary animate-pulse" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 max-w-5xl mx-auto">
            {/* Growth sparkline */}
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Growth Curve
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-end gap-[2px] h-16">
                  {sparkline.map((val, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${(val / sparkMax) * 100}%` }}
                      transition={{ delay: i * 0.02, duration: 0.3 }}
                      className="flex-1 rounded-t-sm bg-primary/70 min-w-[2px]"
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[8px] text-muted-foreground/50">
                  <span>Cycle 0</span>
                  <span>Cycle {totalCycles}</span>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="patterns" className="w-full">
              <TabsList className="w-full bg-muted/30">
                <TabsTrigger value="patterns" className="flex-1 text-xs">Detected Patterns</TabsTrigger>
                <TabsTrigger value="forecast" className="flex-1 text-xs">Growth Forecast</TabsTrigger>
                <TabsTrigger value="next" className="flex-1 text-xs">Next Evolutions</TabsTrigger>
              </TabsList>

              {/* Detected Patterns */}
              <TabsContent value="patterns" className="space-y-2 mt-3">
                {patterns.length === 0 ? (
                  <Card className="bg-card/40 border-border/30">
                    <CardContent className="py-8 text-center text-muted-foreground text-xs">
                      Not enough evolution history to detect patterns yet. Keep evolving.
                    </CardContent>
                  </Card>
                ) : (
                  patterns.map((p, i) => (
                    <motion.div
                      key={p.type + i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Card className="bg-card/60 border-border/50 hover:border-primary/20 transition-colors">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {PATTERN_ICONS[p.type]}
                              <span className="text-xs font-semibold capitalize">{p.type.replace('-', ' ')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground">
                                cycles {p.startCycle}–{p.endCycle}
                              </span>
                              <div className="flex items-center gap-1">
                                <div className="w-12 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary/70"
                                    style={{ width: `${p.confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-[8px] text-muted-foreground/60">
                                  {Math.round(p.confidence * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{p.description}</p>
                          <div className="flex items-start gap-1.5 pt-1 border-t border-border/30">
                            <Target className="w-3 h-3 text-primary/50 mt-0.5 shrink-0" />
                            <p className="text-[9px] text-primary/70">{p.recommendation}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </TabsContent>

              {/* Growth Forecast */}
              <TabsContent value="forecast" className="mt-3">
                {forecast && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="bg-card/60 border-border/50">
                      <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Trend</p>
                            <p className={`text-sm font-bold capitalize ${TREND_COLORS[forecast.trend]}`}>
                              {forecast.trend}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Growth Rate</p>
                            <p className="text-sm font-bold text-foreground font-mono">
                              {forecast.growthRate} <span className="text-[9px] text-muted-foreground font-normal">caps/cycle</span>
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Predicted Caps (20 cycles)</p>
                            <p className="text-sm font-bold text-foreground font-mono">{forecast.predictedCapabilities}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Cycles to Next Level</p>
                            <p className="text-sm font-bold text-foreground font-mono">
                              {forecast.cyclesUntilNextLevel === Infinity ? '∞' : forecast.cyclesUntilNextLevel}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-border/30">
                          <div className="flex justify-between text-[9px] text-muted-foreground">
                            <span>Current Level {currentLevel}</span>
                            <span>Predicted Level {forecast.predictedLevel}</span>
                          </div>
                          <Progress value={(currentLevel / Math.max(forecast.predictedLevel, currentLevel + 1)) * 100} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              {/* Next Evolutions */}
              <TabsContent value="next" className="space-y-2 mt-3">
                {predictions.length === 0 ? (
                  <Card className="bg-card/40 border-border/30">
                    <CardContent className="py-8 text-center text-muted-foreground text-xs">
                      All predicted evolutions have been built. The system has exceeded its roadmap.
                    </CardContent>
                  </Card>
                ) : (
                  predictions.map((pred, i) => (
                    <motion.div
                      key={pred.capability}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Card className="bg-card/60 border-border/50 hover:border-primary/20 transition-colors">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[pred.category]}`}>
                                {pred.category}
                              </span>
                              <span className="text-xs font-semibold">{pred.capability}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground">~{pred.estimatedCycles} cycles</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                P{pred.priority}
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{pred.description}</p>
                          <p className="text-[9px] text-muted-foreground/70 italic">{pred.rationale}</p>
                          {pred.prerequisites.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[8px] text-muted-foreground/50">requires:</span>
                              {pred.prerequisites.map(p => (
                                <span key={p} className="text-[7px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default PatternAnalysis;
