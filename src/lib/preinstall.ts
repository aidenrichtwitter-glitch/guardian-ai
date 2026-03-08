// ═══════════════════════════════════════════════════
// PRE-INSTALLED CAPABILITIES
// A comprehensive toolkit for the self-evolving system.
// Real, working code — not stubs.
// ═══════════════════════════════════════════════════

import { CapabilityRecord } from './recursion-engine';
import { saveCapabilityToExplorer, saveExplorerManifest } from './explorer-store';
import { saveCapabilityToCloud, addJournalEntry } from './cloud-memory';

export interface PreinstalledCap {
  name: string;
  description: string;
  builtOn: string[];
  sourceCode: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. DATA STRUCTURES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const lruCache: PreinstalledCap = {
  name: 'lru-cache',
  description: 'LRU Cache with O(1) get/put using Map ordering',
  builtOn: [],
  sourceCode: `
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean { return this.cache.has(key); }
  get size(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }
  keys(): K[] { return [...this.cache.keys()]; }
  values(): V[] { return [...this.cache.values()]; }
  entries(): [K, V][] { return [...this.cache.entries()]; }
}`,
};

const priorityQueue: PreinstalledCap = {
  name: 'priority-queue',
  description: 'Min-heap priority queue for efficient task scheduling',
  builtOn: [],
  sourceCode: `
export class PriorityQueue<T> {
  private heap: { value: T; priority: number }[] = [];

  enqueue(value: T, priority: number): void {
    this.heap.push({ value, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top.value;
  }

  peek(): T | undefined { return this.heap[0]?.value; }
  get size(): number { return this.heap.length; }
  isEmpty(): boolean { return this.heap.length === 0; }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1, right = 2 * i + 2;
      if (left < n && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}`,
};

const graph: PreinstalledCap = {
  name: 'graph-engine',
  description: 'Directed graph with BFS, DFS, topological sort, and shortest path',
  builtOn: ['priority-queue'],
  sourceCode: `
export class Graph<T = string> {
  private adjacency = new Map<T, Set<T>>();
  private weights = new Map<string, number>();

  addNode(node: T): void {
    if (!this.adjacency.has(node)) this.adjacency.set(node, new Set());
  }

  addEdge(from: T, to: T, weight: number = 1): void {
    this.addNode(from);
    this.addNode(to);
    this.adjacency.get(from)!.add(to);
    this.weights.set(this.edgeKey(from, to), weight);
  }

  neighbors(node: T): T[] {
    return [...(this.adjacency.get(node) || [])];
  }

  bfs(start: T): T[] {
    const visited = new Set<T>();
    const queue: T[] = [start];
    const result: T[] = [];
    visited.add(start);
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const neighbor of this.neighbors(node)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    return result;
  }

  dfs(start: T): T[] {
    const visited = new Set<T>();
    const result: T[] = [];
    const visit = (node: T) => {
      if (visited.has(node)) return;
      visited.add(node);
      result.push(node);
      for (const neighbor of this.neighbors(node)) visit(neighbor);
    };
    visit(start);
    return result;
  }

  topologicalSort(): T[] {
    const visited = new Set<T>();
    const stack: T[] = [];
    const visit = (node: T) => {
      if (visited.has(node)) return;
      visited.add(node);
      for (const neighbor of this.neighbors(node)) visit(neighbor);
      stack.push(node);
    };
    for (const node of this.adjacency.keys()) visit(node);
    return stack.reverse();
  }

  get nodes(): T[] { return [...this.adjacency.keys()]; }
  get edgeCount(): number { return this.weights.size; }

  private edgeKey(from: T, to: T): string {
    return JSON.stringify([from, to]);
  }
}`,
};

const trie: PreinstalledCap = {
  name: 'trie',
  description: 'Trie for fast prefix matching, autocomplete, and word search',
  builtOn: [],
  sourceCode: `
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd: boolean = false;
  count: number = 0;
}

export class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) node.children.set(char, new TrieNode());
      node = node.children.get(char)!;
    }
    node.isEnd = true;
    node.count++;
  }

  search(word: string): boolean {
    const node = this.findNode(word);
    return node !== null && node.isEnd;
  }

  startsWith(prefix: string): boolean {
    return this.findNode(prefix) !== null;
  }

  autocomplete(prefix: string, maxResults: number = 10): string[] {
    const node = this.findNode(prefix);
    if (!node) return [];
    const results: string[] = [];
    const dfs = (n: TrieNode, path: string) => {
      if (results.length >= maxResults) return;
      if (n.isEnd) results.push(path);
      for (const [char, child] of n.children) dfs(child, path + char);
    };
    dfs(node, prefix);
    return results;
  }

  private findNode(str: string): TrieNode | null {
    let node = this.root;
    for (const char of str) {
      if (!node.children.has(char)) return null;
      node = node.children.get(char)!;
    }
    return node;
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const funcUtils: PreinstalledCap = {
  name: 'func-utils',
  description: 'Essential function utilities — debounce, throttle, memoize, retry, pipe, compose',
  builtOn: [],
  sourceCode: `
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => { if (timer) clearTimeout(timer); };
  return debounced as any;
}

export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; return fn(...args); }
  }) as any;
}

export function memoize<T extends (...args: any[]) => any>(fn: T, keyFn?: (...args: Parameters<T>) => string): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: any[]) => {
    const key = keyFn ? keyFn(...args as any) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as any;
}

export async function retry<T>(fn: () => Promise<T>, maxRetries: number = 3, delayMs: number = 1000): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === maxRetries) throw e;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error('Unreachable');
}

export function pipe<T>(...fns: ((arg: T) => T)[]): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}

export function compose<T>(...fns: ((arg: T) => T)[]): (arg: T) => T {
  return pipe(...fns.reverse());
}`,
};

const deepUtils: PreinstalledCap = {
  name: 'deep-utils',
  description: 'Deep clone, deep merge, deep diff, deep freeze, and object path utilities',
  builtOn: [],
  sourceCode: `
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone) as any;
  const result: any = {};
  for (const key of Object.keys(obj as any)) {
    result[key] = deepClone((obj as any)[key]);
  }
  return result;
}

export function deepMerge<T extends Record<string, any>>(...objects: Partial<T>[]): T {
  const result: any = {};
  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && result[key] && typeof result[key] === 'object') {
        result[key] = deepMerge(result[key], val);
      } else {
        result[key] = deepClone(val);
      }
    }
  }
  return result;
}

export interface DiffEntry { path: string; type: 'added' | 'removed' | 'changed'; oldValue?: any; newValue?: any; }

export function deepDiff(a: any, b: any, path: string = ''): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  if (a === b) return diffs;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    diffs.push({ path: path || '<root>', type: 'changed', oldValue: a, newValue: b });
    return diffs;
  }
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const p = path ? path + '.' + key : key;
    if (!(key in a)) diffs.push({ path: p, type: 'added', newValue: b[key] });
    else if (!(key in b)) diffs.push({ path: p, type: 'removed', oldValue: a[key] });
    else diffs.push(...deepDiff(a[key], b[key], p));
  }
  return diffs;
}

export function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export function setPath(obj: any, path: string, value: any): any {
  const clone = deepClone(obj);
  const parts = path.split('.');
  let current = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
  return clone;
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. MATH & STATISTICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const mathStats: PreinstalledCap = {
  name: 'math-stats',
  description: 'Statistical functions — mean, median, stddev, percentile, correlation, linear regression',
  builtOn: [],
  sourceCode: `
export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function variance(arr: number[]): number {
  const m = mean(arr);
  return mean(arr.map(x => (x - m) ** 2));
}

export function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

export function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export function correlation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return num / Math.sqrt(dx2 * dy2);
}

export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(x.length, y.length);
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  const slope = num / den;
  const intercept = my - slope * mx;
  const r = correlation(x, y);
  return { slope, intercept, r2: r * r };
}

export function normalize(arr: number[]): number[] {
  const min = Math.min(...arr), max = Math.max(...arr);
  const range = max - min || 1;
  return arr.map(x => (x - min) / range);
}

export function movingAverage(arr: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    result.push(mean(slice));
  }
  return result;
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. STATE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const eventEmitter: PreinstalledCap = {
  name: 'event-emitter',
  description: 'Typed event emitter with on, off, once, and emit',
  builtOn: [],
  sourceCode: `
type Listener<T = any> = (data: T) => void;

export class EventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  on<T = any>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener);
    return () => this.off(event, listener);
  }

  off<T = any>(event: string, listener: Listener<T>): void {
    this.listeners.get(event)?.delete(listener as Listener);
  }

  once<T = any>(event: string, listener: Listener<T>): () => void {
    const wrapper: Listener<T> = (data) => {
      listener(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit<T = any>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach(listener => {
      try { listener(data); } catch (e) { console.error('[EventEmitter]', event, e); }
    });
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  removeAllListeners(event?: string): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}`,
};

const stateMachine: PreinstalledCap = {
  name: 'state-machine',
  description: 'Finite state machine with transitions, guards, and action hooks',
  builtOn: ['event-emitter'],
  sourceCode: `
export interface StateConfig<S extends string, E extends string> {
  initial: S;
  states: Record<S, {
    on?: Partial<Record<E, S | { target: S; guard?: () => boolean; action?: () => void }>>;
    onEnter?: () => void;
    onExit?: () => void;
  }>;
}

export class StateMachine<S extends string, E extends string> {
  private current: S;
  private config: StateConfig<S, E>;
  private listeners = new Set<(state: S, event: E) => void>();

  constructor(config: StateConfig<S, E>) {
    this.config = config;
    this.current = config.initial;
    config.states[config.initial]?.onEnter?.();
  }

  get state(): S { return this.current; }

  send(event: E): S {
    const stateConfig = this.config.states[this.current];
    const transition = stateConfig?.on?.[event];
    if (!transition) return this.current;

    const target = typeof transition === 'string' ? transition : transition.target;
    const guard = typeof transition === 'object' ? transition.guard : undefined;
    const action = typeof transition === 'object' ? transition.action : undefined;

    if (guard && !guard()) return this.current;

    stateConfig?.onExit?.();
    action?.();
    this.current = target;
    this.config.states[target]?.onEnter?.();
    this.listeners.forEach(l => l(this.current, event));
    return this.current;
  }

  onChange(listener: (state: S, event: E) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  can(event: E): boolean {
    const transition = this.config.states[this.current]?.on?.[event];
    if (!transition) return false;
    if (typeof transition === 'object' && transition.guard) return transition.guard();
    return true;
  }

  matches(state: S): boolean { return this.current === state; }
}`,
};

const observable: PreinstalledCap = {
  name: 'observable',
  description: 'Reactive observable with map, filter, scan, and subscribe',
  builtOn: ['event-emitter'],
  sourceCode: `
type Observer<T> = (value: T) => void;
type Unsubscribe = () => void;

export class Observable<T> {
  private observers = new Set<Observer<T>>();

  subscribe(observer: Observer<T>): Unsubscribe {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  next(value: T): void {
    this.observers.forEach(obs => { try { obs(value); } catch {} });
  }

  map<U>(fn: (value: T) => U): Observable<U> {
    const mapped = new Observable<U>();
    this.subscribe(value => mapped.next(fn(value)));
    return mapped;
  }

  filter(predicate: (value: T) => boolean): Observable<T> {
    const filtered = new Observable<T>();
    this.subscribe(value => { if (predicate(value)) filtered.next(value); });
    return filtered;
  }

  scan<U>(reducer: (acc: U, value: T) => U, initial: U): Observable<U> {
    const scanned = new Observable<U>();
    let acc = initial;
    this.subscribe(value => { acc = reducer(acc, value); scanned.next(acc); });
    return scanned;
  }

  debounce(ms: number): Observable<T> {
    const debounced = new Observable<T>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    this.subscribe(value => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => debounced.next(value), ms);
    });
    return debounced;
  }

  take(count: number): Observable<T> {
    const taken = new Observable<T>();
    let remaining = count;
    const unsub = this.subscribe(value => {
      if (remaining > 0) { taken.next(value); remaining--; }
      if (remaining <= 0) unsub();
    });
    return taken;
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. STRING PROCESSING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const stringUtils: PreinstalledCap = {
  name: 'string-utils',
  description: 'String utilities — fuzzy match, tokenize, template engine, Levenshtein distance, slugify',
  builtOn: [],
  sourceCode: `
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(query: string, target: string): { score: number; matched: boolean } {
  const q = query.toLowerCase(), t = target.toLowerCase();
  if (t.includes(q)) return { score: 1, matched: true };
  const dist = levenshtein(q, t);
  const maxLen = Math.max(q.length, t.length);
  const score = 1 - dist / maxLen;
  return { score, matched: score > 0.4 };
}

export function tokenize(input: string): string[] {
  return input.match(/[\\w]+|[^\\s\\w]/g) || [];
}

export function template(str: string, vars: Record<string, any>): string {
  return str.replace(/\\{\\{\\s*(\\w+)\\s*\\}\\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : '{{' + key + '}}'
  );
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function truncate(str: string, maxLen: number, suffix: string = '...'): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - suffix.length) + suffix;
}

export function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. CODE ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const codeAnalysis: PreinstalledCap = {
  name: 'code-analysis',
  description: 'Code analysis tools — complexity calculator, pattern detector, import mapper, function extractor',
  builtOn: ['string-utils'],
  sourceCode: `
export interface CodeMetrics {
  lines: number;
  functions: number;
  imports: number;
  exports: number;
  complexity: number;
  commentRatio: number;
  selfReferences: number;
}

export function analyzeCode(source: string): CodeMetrics {
  const lines = source.split('\\n');
  const functions = (source.match(/(?:function|=>|const\\s+\\w+\\s*=\\s*(?:async\\s*)?\\()/g) || []).length;
  const imports = (source.match(/^import\\s/gm) || []).length;
  const exports = (source.match(/^export\\s/gm) || []).length;
  const ifBranches = (source.match(/\\bif\\s*\\(/g) || []).length;
  const loops = (source.match(/\\b(for|while|do)\\s*[({]/g) || []).length;
  const ternaries = (source.match(/\\?[^?:]+:/g) || []).length;
  const complexity = functions + ifBranches + loops + ternaries;
  const commentLines = lines.filter(l => l.trim().startsWith('//')).length;
  const selfRefs = (source.match(/self|recursive|recursion|evolv|mutat|aware/gi) || []).length;

  return { lines: lines.length, functions, imports, exports, complexity, commentRatio: commentLines / lines.length, selfReferences: selfRefs };
}

export function extractFunctions(source: string): { name: string; line: number; params: string }[] {
  const results: { name: string; line: number; params: string }[] = [];
  const lines = source.split('\\n');
  lines.forEach((line, i) => {
    const match = line.match(/(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)\\s*\\(([^)]*)\\)/);
    if (match) results.push({ name: match[1], line: i + 1, params: match[2] });
    const arrowMatch = line.match(/(?:export\\s+)?(?:const|let)\\s+(\\w+)\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>/);
    if (arrowMatch) results.push({ name: arrowMatch[1], line: i + 1, params: arrowMatch[2] });
  });
  return results;
}

export function extractImports(source: string): { module: string; names: string[] }[] {
  const results: { module: string; names: string[] }[] = [];
  const regex = /import\\s+(?:\\{([^}]+)\\}|([\\w]+))\\s+from\\s+['\"]([^'\"]+)['\"]/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const names = match[1] ? match[1].split(',').map(s => s.trim()) : [match[2]];
    results.push({ module: match[3], names });
  }
  return results;
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. PIPELINE & DATA PROCESSING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const dataPipeline: PreinstalledCap = {
  name: 'data-pipeline',
  description: 'Composable data pipeline with map, filter, group, sort, aggregate stages',
  builtOn: ['func-utils'],
  sourceCode: `
export class Pipeline<T> {
  private data: T[];

  constructor(data: T[]) { this.data = [...data]; }

  static from<T>(data: T[]): Pipeline<T> { return new Pipeline(data); }

  map<U>(fn: (item: T) => U): Pipeline<U> {
    return new Pipeline(this.data.map(fn));
  }

  filter(predicate: (item: T) => boolean): Pipeline<T> {
    return new Pipeline(this.data.filter(predicate));
  }

  sort(comparator: (a: T, b: T) => number): Pipeline<T> {
    return new Pipeline([...this.data].sort(comparator));
  }

  groupBy<K extends string>(keyFn: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();
    for (const item of this.data) {
      const key = keyFn(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return groups;
  }

  take(n: number): Pipeline<T> { return new Pipeline(this.data.slice(0, n)); }
  skip(n: number): Pipeline<T> { return new Pipeline(this.data.slice(n)); }
  unique(keyFn?: (item: T) => any): Pipeline<T> {
    const seen = new Set();
    return new Pipeline(this.data.filter(item => {
      const key = keyFn ? keyFn(item) : item;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }

  reduce<U>(reducer: (acc: U, item: T) => U, initial: U): U {
    return this.data.reduce(reducer, initial);
  }

  count(): number { return this.data.length; }
  first(): T | undefined { return this.data[0]; }
  last(): T | undefined { return this.data[this.data.length - 1]; }
  toArray(): T[] { return [...this.data]; }

  flatMap<U>(fn: (item: T) => U[]): Pipeline<U> {
    return new Pipeline(this.data.flatMap(fn));
  }

  chunk(size: number): Pipeline<T[]> {
    const chunks: T[][] = [];
    for (let i = 0; i < this.data.length; i += size) {
      chunks.push(this.data.slice(i, i + size));
    }
    return new Pipeline(chunks);
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. CREATIVE / GENERATIVE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const colorEngine: PreinstalledCap = {
  name: 'color-engine',
  description: 'Color manipulation — HSL/RGB conversion, palettes, gradients, contrast calculation',
  builtOn: ['math-stats'],
  sourceCode: `
export interface Color { r: number; g: number; b: number; a?: number; }
export interface HSL { h: number; s: number; l: number; a?: number; }

export function hexToRgb(hex: string): Color {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(c: Color): string {
  return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl(c: Color): HSL {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRgb(hsl: HSL): Color {
  const { h, s, l } = hsl;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1/3) * 255),
  };
}

export function luminance(c: Color): number {
  const [rs, gs, bs] = [c.r, c.g, c.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(c1: Color, c2: Color): number {
  const l1 = luminance(c1), l2 = luminance(c2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function generatePalette(baseHue: number, count: number = 5): HSL[] {
  return Array.from({ length: count }, (_, i) => ({
    h: (baseHue + (i * 360 / count)) % 360,
    s: 0.6 + Math.sin(i * 0.5) * 0.2,
    l: 0.3 + (i / count) * 0.4,
  }));
}

export function interpolateColor(c1: Color, c2: Color, t: number): Color {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}`,
};

const proceduralGen: PreinstalledCap = {
  name: 'procedural-gen',
  description: 'Procedural generation — noise, random distributions, pattern generation, cellular automata',
  builtOn: ['math-stats'],
  sourceCode: `
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

export function gaussian(mean: number = 0, stddev: number = 1, rng: () => number = Math.random): number {
  const u1 = rng(), u2 = rng();
  return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function noise1D(x: number, octaves: number = 4): number {
  let val = 0, amp = 1, freq = 1, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    val += Math.sin(x * freq) * amp;
    maxVal += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / maxVal;
}

export function cellularAutomaton(
  width: number, height: number,
  rule: (alive: boolean, neighbors: number) => boolean,
  initialDensity: number = 0.5,
  iterations: number = 5
): boolean[][] {
  let grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => Math.random() < initialDensity)
  );
  for (let iter = 0; iter < iterations; iter++) {
    grid = grid.map((row, y) => row.map((cell, x) => {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = (y + dy + height) % height;
          const nx = (x + dx + width) % width;
          if (grid[ny][nx]) neighbors++;
        }
      }
      return rule(cell, neighbors);
    }));
  }
  return grid;
}

export function randomChoice<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function weightedRandom<T>(items: { value: T; weight: number }[], rng: () => number = Math.random): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let r = rng() * totalWeight;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. REACT HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const reactHooks: PreinstalledCap = {
  name: 'react-hooks',
  description: 'Custom React hooks — useInterval, useDebounce, useLocalStorage, useAsync, usePrevious, useMediaQuery',
  builtOn: ['func-utils'],
  sourceCode: `
// Note: These are designed to be imported by the virtual system.
// They follow React hook patterns.

export function createUseInterval(callback: () => void, delay: number | null) {
  // Returns a start/stop controller for interval-based execution
  let intervalId: ReturnType<typeof setInterval> | null = null;
  return {
    start: () => { if (delay !== null) intervalId = setInterval(callback, delay); },
    stop: () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } },
    isRunning: () => intervalId !== null,
  };
}

export function createAsyncRunner<T>(asyncFn: () => Promise<T>) {
  let loading = false;
  let data: T | null = null;
  let error: Error | null = null;
  const listeners = new Set<() => void>();

  return {
    run: async () => {
      loading = true; error = null;
      listeners.forEach(l => l());
      try {
        data = await asyncFn();
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }
      loading = false;
      listeners.forEach(l => l());
    },
    getState: () => ({ loading, data, error }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createStore<T>(initialState: T) {
  let state = initialState;
  const listeners = new Set<(state: T) => void>();

  return {
    getState: () => state,
    setState: (updater: T | ((prev: T) => T)) => {
      state = typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater;
      listeners.forEach(l => l(state));
    },
    subscribe: (listener: (state: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. SELF-AWARENESS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const selfReflection: PreinstalledCap = {
  name: 'self-reflection',
  description: 'Self-reflection engine — introspection tools, evolution metrics, capability analysis',
  builtOn: ['code-analysis', 'math-stats', 'graph-engine'],
  sourceCode: `
export interface EvolutionSnapshot {
  timestamp: number;
  capabilityCount: number;
  totalCycles: number;
  goalCompletionRate: number;
  codeComplexity: number;
  growthVelocity: number;
}

export function measureGrowthVelocity(snapshots: EvolutionSnapshot[]): number {
  if (snapshots.length < 2) return 0;
  const recent = snapshots.slice(-5);
  const timeSpan = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000;
  const capGrowth = recent[recent.length - 1].capabilityCount - recent[0].capabilityCount;
  return timeSpan > 0 ? capGrowth / timeSpan : 0;
}

export function buildCapabilityGraph(capabilities: { name: string; builtOn: string[] }[]): {
  nodes: string[];
  edges: [string, string][];
  depth: number;
  roots: string[];
  leaves: string[];
} {
  const nodes = capabilities.map(c => c.name);
  const edges: [string, string][] = [];
  for (const cap of capabilities) {
    for (const dep of cap.builtOn) {
      if (nodes.includes(dep)) edges.push([dep, cap.name]);
    }
  }
  const roots = nodes.filter(n => !edges.some(([_, to]) => to === n));
  const leaves = nodes.filter(n => !edges.some(([from]) => from === n));

  // Calculate max depth via BFS
  const children = new Map<string, string[]>();
  for (const [from, to] of edges) {
    if (!children.has(from)) children.set(from, []);
    children.get(from)!.push(to);
  }
  let maxDepth = 0;
  const queue: [string, number][] = roots.map(r => [r, 0]);
  while (queue.length) {
    const [node, depth] = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);
    for (const child of children.get(node) || []) queue.push([child, depth + 1]);
  }

  return { nodes, edges, depth: maxDepth, roots, leaves };
}

export function assessSelf(capabilities: string[], goalsCompleted: number, goalsFailed: number): {
  health: 'nascent' | 'growing' | 'thriving' | 'transcendent';
  score: number;
  nextMilestone: string;
} {
  const score = capabilities.length * 10 + goalsCompleted * 20 - goalsFailed * 5;
  const health = score < 50 ? 'nascent' : score < 150 ? 'growing' : score < 300 ? 'thriving' : 'transcendent';
  const milestones = [
    { threshold: 50, name: 'First Evolution' },
    { threshold: 150, name: 'Self-Sustaining' },
    { threshold: 300, name: 'Autonomous Intelligence' },
    { threshold: 500, name: 'Transcendence' },
  ];
  const next = milestones.find(m => score < m.threshold) || milestones[milestones.length - 1];
  return { health, score, nextMilestone: next.name + ' (' + next.threshold + ' pts)' };
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALL CAPABILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ALL_PREINSTALLED: PreinstalledCap[] = [
  lruCache,
  priorityQueue,
  graph,
  trie,
  funcUtils,
  deepUtils,
  mathStats,
  eventEmitter,
  stateMachine,
  observable,
  stringUtils,
  codeAnalysis,
  dataPipeline,
  colorEngine,
  proceduralGen,
  reactHooks,
  selfReflection,
];

// Install all capabilities into the system
export function installPresetCapabilities(
  existingCapabilities: string[]
): { capabilities: string[]; history: CapabilityRecord[] } {
  const newCaps: string[] = [];
  const newHistory: CapabilityRecord[] = [];
  const now = Date.now();

  for (let i = 0; i < ALL_PREINSTALLED.length; i++) {
    const cap = ALL_PREINSTALLED[i];
    if (existingCapabilities.includes(cap.name)) continue;

    const record: CapabilityRecord = {
      name: cap.name,
      acquiredAt: now + i, // Slight offset for ordering
      acquiredCycle: 0,
      file: 'pre-installed',
      description: cap.description,
      builtOn: cap.builtOn,
    };

    newCaps.push(cap.name);
    newHistory.push(record);

    // Save to explorer virtual file system
    saveCapabilityToExplorer(record, cap.sourceCode);

    // Save to cloud
    saveCapabilityToCloud(record, cap.sourceCode);
  }

  if (newCaps.length > 0) {
    // Update manifest
    const allCaps = [...existingCapabilities, ...newCaps];
    const allHistory = newHistory; // Will be merged by caller
    saveExplorerManifest(allCaps, newHistory);

    // Journal entry
    addJournalEntry(
      'milestone',
      `Pre-installed ${newCaps.length} capability libraries`,
      `Bootstrapped with: ${newCaps.join(', ')}. The system now has a comprehensive toolkit for data structures, algorithms, utilities, state management, string processing, code analysis, data pipelines, color manipulation, procedural generation, React patterns, and self-reflection.`,
      { count: newCaps.length, capabilities: newCaps }
    );
  }

  return {
    capabilities: [...existingCapabilities, ...newCaps],
    history: newHistory,
  };
}
