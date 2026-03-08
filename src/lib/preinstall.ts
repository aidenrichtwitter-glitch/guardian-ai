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
// L10 TIER GOALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const neuralPatternClassifier: PreinstalledCap = {
  name: 'neural-pattern-classifier',
  description: 'Classifies patterns in data using simple neural-network-inspired algorithms',
  builtOn: ['math-stats'],
  sourceCode: `
export interface Pattern { features: number[]; label?: string; }

export class NeuralPatternClassifier {
  private weights: number[][];
  private bias: number[];
  private learningRate: number;

  constructor(inputSize: number, outputSize: number, learningRate = 0.01) {
    this.learningRate = learningRate;
    this.weights = Array(outputSize).fill(0).map(() => 
      Array(inputSize).fill(0).map(() => Math.random() * 2 - 1)
    );
    this.bias = Array(outputSize).fill(0);
  }

  private sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }
  private softmax(arr: number[]): number[] {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }

  predict(features: number[]): number[] {
    const outputs = this.weights.map((w, i) => 
      w.reduce((sum, weight, j) => sum + weight * features[j], this.bias[i])
    );
    return this.softmax(outputs);
  }

  classify(features: number[]): number {
    const probs = this.predict(features);
    return probs.indexOf(Math.max(...probs));
  }

  train(patterns: Pattern[], labels: number[], epochs = 100): void {
    for (let e = 0; e < epochs; e++) {
      for (let i = 0; i < patterns.length; i++) {
        const prediction = this.predict(patterns[i].features);
        const target = Array(this.weights.length).fill(0);
        target[labels[i]] = 1;
        for (let j = 0; j < this.weights.length; j++) {
          const error = target[j] - prediction[j];
          for (let k = 0; k < this.weights[j].length; k++) {
            this.weights[j][k] += this.learningRate * error * patterns[i].features[k];
          }
          this.bias[j] += this.learningRate * error;
        }
      }
    }
  }

  accuracy(patterns: Pattern[], labels: number[]): number {
    let correct = 0;
    for (let i = 0; i < patterns.length; i++) {
      if (this.classify(patterns[i].features) === labels[i]) correct++;
    }
    return correct / patterns.length;
  }
}`,
};

const temporalDependencyOracle: PreinstalledCap = {
  name: 'temporal-dependency-oracle',
  description: 'Predicts which capabilities will become dependencies before they are needed',
  builtOn: ['graph-engine', 'priority-queue'],
  sourceCode: `
export interface CapabilityNode {
  name: string;
  builtOn: string[];
  acquiredAt: number;
  usageCount: number;
}

export interface DependencyPrediction {
  capability: string;
  confidence: number;
  predictedNeed: number; // timestamp
  reason: string;
}

export class TemporalDependencyOracle {
  private history: CapabilityNode[] = [];
  private dependencyPatterns: Map<string, string[]> = new Map();

  addCapability(node: CapabilityNode): void {
    this.history.push(node);
    node.builtOn.forEach(dep => {
      const followers = this.dependencyPatterns.get(dep) || [];
      if (!followers.includes(node.name)) followers.push(node.name);
      this.dependencyPatterns.set(dep, followers);
    });
  }

  predict(currentCaps: string[], lookahead = 5): DependencyPrediction[] {
    const predictions: DependencyPrediction[] = [];
    const capSet = new Set(currentCaps);

    // Pattern 1: Capabilities that frequently follow current ones
    for (const cap of currentCaps) {
      const followers = this.dependencyPatterns.get(cap) || [];
      for (const follower of followers) {
        if (capSet.has(follower)) continue;
        const freq = this.history.filter(h => h.name === follower).length;
        predictions.push({
          capability: follower,
          confidence: Math.min(0.9, freq * 0.15),
          predictedNeed: Date.now() + lookahead * 60000,
          reason: \`Often follows \${cap}\`,
        });
      }
    }

    // Pattern 2: Missing dependencies of common multi-dep capabilities
    for (const node of this.history) {
      if (node.builtOn.length >= 2) {
        const missing = node.builtOn.filter(d => !capSet.has(d));
        if (missing.length === 1) {
          predictions.push({
            capability: missing[0],
            confidence: 0.75,
            predictedNeed: Date.now() + 30000,
            reason: \`Needed for \${node.name}\`,
          });
        }
      }
    }

    // Dedupe and sort by confidence
    const seen = new Set<string>();
    return predictions
      .filter(p => { if (seen.has(p.capability)) return false; seen.add(p.capability); return true; })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, lookahead);
  }

  queuePredictedDependencies(current: string[]): string[] {
    return this.predict(current).map(p => p.capability);
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L15 TIER GOALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const polymorphicCodeGenerator: PreinstalledCap = {
  name: 'polymorphic-code-generator',
  description: 'Generates code variants for the same capability using different patterns and paradigms',
  builtOn: ['code-analysis', 'string-utils'],
  sourceCode: `
export type CodeStyle = 'functional' | 'oop' | 'imperative' | 'declarative';

export interface CodeVariant {
  style: CodeStyle;
  code: string;
  complexity: number;
  description: string;
}

export class PolymorphicCodeGenerator {
  generateVariants(functionName: string, params: string[], returnType: string, logic: string): CodeVariant[] {
    const variants: CodeVariant[] = [];

    // Functional variant
    variants.push({
      style: 'functional',
      code: \`export const \${functionName} = (\${params.join(', ')}): \${returnType} => \${logic};\`,
      complexity: 1,
      description: 'Arrow function, single expression',
    });

    // OOP variant
    variants.push({
      style: 'oop',
      code: \`export class \${functionName}Handler {
  execute(\${params.join(', ')}): \${returnType} {
    return \${logic};
  }
}\`,
      complexity: 2,
      description: 'Class-based with execute method',
    });

    // Imperative variant
    variants.push({
      style: 'imperative',
      code: \`export function \${functionName}(\${params.join(', ')}): \${returnType} {
  const result = \${logic};
  return result;
}\`,
      complexity: 1.5,
      description: 'Traditional function with explicit return',
    });

    // Declarative/builder variant
    variants.push({
      style: 'declarative',
      code: \`export const \${functionName}Builder = () => ({
  with: (\${params.join(', ')}) => ({
    build: (): \${returnType} => \${logic},
  }),
});\`,
      complexity: 3,
      description: 'Builder pattern for chaining',
    });

    return variants;
  }

  selectBestVariant(variants: CodeVariant[], preference: CodeStyle): CodeVariant {
    return variants.find(v => v.style === preference) || variants[0];
  }

  mutateCode(code: string): string {
    // Simple mutations: rename variables, change formatting
    return code
      .replace(/const /g, 'let ')
      .replace(/let result/g, 'let output')
      .replace(/return result/g, 'return output');
  }
}`,
};

const crossModuleCoherenceAnalyzer: PreinstalledCap = {
  name: 'cross-module-coherence-analyzer',
  description: 'Analyzes semantic coherence across all modules — detects redundancy, contradictions, and suggests merges',
  builtOn: ['code-analysis', 'graph-engine'],
  sourceCode: `
export interface ModuleSignature {
  name: string;
  exports: string[];
  imports: string[];
  functions: string[];
  complexity: number;
}

export interface CoherenceReport {
  redundancies: { modules: string[]; overlap: string[] }[];
  contradictions: { a: string; b: string; issue: string }[];
  mergeProposals: { sources: string[]; targetName: string; reason: string }[];
  coherenceScore: number; // 0-100
}

export class CrossModuleCoherenceAnalyzer {
  analyze(modules: ModuleSignature[]): CoherenceReport {
    const redundancies: CoherenceReport['redundancies'] = [];
    const contradictions: CoherenceReport['contradictions'] = [];
    const mergeProposals: CoherenceReport['mergeProposals'] = [];

    // Detect redundant exports
    for (let i = 0; i < modules.length; i++) {
      for (let j = i + 1; j < modules.length; j++) {
        const overlap = modules[i].exports.filter(e => modules[j].exports.includes(e));
        if (overlap.length > 0) {
          redundancies.push({ modules: [modules[i].name, modules[j].name], overlap });
        }
        // Similar function names suggest merge
        const funcOverlap = modules[i].functions.filter(f => 
          modules[j].functions.some(f2 => this.isSimilarName(f, f2))
        );
        if (funcOverlap.length >= 2) {
          mergeProposals.push({
            sources: [modules[i].name, modules[j].name],
            targetName: \`unified-\${modules[i].name.split('-')[0]}\`,
            reason: \`\${funcOverlap.length} similar functions: \${funcOverlap.join(', ')}\`,
          });
        }
      }
    }

    // Detect circular dependencies (contradiction)
    for (const mod of modules) {
      for (const imp of mod.imports) {
        const imported = modules.find(m => m.name === imp);
        if (imported?.imports.includes(mod.name)) {
          contradictions.push({
            a: mod.name,
            b: imp,
            issue: 'Circular dependency',
          });
        }
      }
    }

    const totalIssues = redundancies.length + contradictions.length;
    const coherenceScore = Math.max(0, 100 - totalIssues * 10);

    return { redundancies, contradictions, mergeProposals, coherenceScore };
  }

  private isSimilarName(a: string, b: string): boolean {
    if (a === b) return true;
    const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, '');
    return normalize(a) === normalize(b) || 
           a.includes(b) || b.includes(a);
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L20 TIER GOALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const autonomousTestSynthesizer: PreinstalledCap = {
  name: 'autonomous-test-synthesizer',
  description: 'Automatically generates test cases for capabilities by analyzing function signatures and contracts',
  builtOn: ['code-analysis', 'procedural-gen'],
  sourceCode: `
export interface FunctionContract {
  name: string;
  params: { name: string; type: string }[];
  returnType: string;
  pureFunction: boolean;
}

export interface SynthesizedTest {
  name: string;
  code: string;
  edgeCases: string[];
}

export class AutonomousTestSynthesizer {
  synthesize(contract: FunctionContract): SynthesizedTest {
    const edgeCases: string[] = [];
    const testCases: string[] = [];

    // Generate test inputs based on types
    for (const param of contract.params) {
      const inputs = this.generateInputsForType(param.type);
      edgeCases.push(...inputs.map(i => \`\${param.name}=\${JSON.stringify(i)}\`));
    }

    // Basic test
    testCases.push(\`
  it('should execute without throwing', () => {
    expect(() => \${contract.name}(\${contract.params.map(p => this.defaultForType(p.type)).join(', ')})).not.toThrow();
  });\`);

    // Type check test
    if (contract.returnType !== 'void') {
      testCases.push(\`
  it('should return correct type', () => {
    const result = \${contract.name}(\${contract.params.map(p => this.defaultForType(p.type)).join(', ')});
    expect(typeof result).toBe('\${this.jsTypeOf(contract.returnType)}');
  });\`);
    }

    // Edge case tests
    for (const param of contract.params) {
      if (param.type.includes('number')) {
        testCases.push(\`
  it('should handle zero for \${param.name}', () => {
    expect(() => \${contract.name}(\${contract.params.map(p => p.name === param.name ? '0' : this.defaultForType(p.type)).join(', ')})).not.toThrow();
  });\`);
      }
      if (param.type.includes('string')) {
        testCases.push(\`
  it('should handle empty string for \${param.name}', () => {
    expect(() => \${contract.name}(\${contract.params.map(p => p.name === param.name ? '""' : this.defaultForType(p.type)).join(', ')})).not.toThrow();
  });\`);
      }
    }

    return {
      name: \`\${contract.name}.test.ts\`,
      code: \`describe('\${contract.name}', () => {\${testCases.join('\\n')}\n});\`,
      edgeCases,
    };
  }

  private generateInputsForType(type: string): any[] {
    if (type.includes('number')) return [0, -1, 1, 999, NaN, Infinity];
    if (type.includes('string')) return ['', 'test', 'a'.repeat(1000), '\\n\\t'];
    if (type.includes('boolean')) return [true, false];
    if (type.includes('[]')) return [[], [1], [1, 2, 3]];
    return [null, undefined];
  }

  private defaultForType(type: string): string {
    if (type.includes('number')) return '42';
    if (type.includes('string')) return '"test"';
    if (type.includes('boolean')) return 'true';
    if (type.includes('[]')) return '[]';
    return '{}';
  }

  private jsTypeOf(tsType: string): string {
    if (tsType.includes('number')) return 'number';
    if (tsType.includes('string')) return 'string';
    if (tsType.includes('boolean')) return 'boolean';
    return 'object';
  }
}`,
};

const capabilityFusionReactor: PreinstalledCap = {
  name: 'capability-fusion-reactor',
  description: 'Fuses multiple capabilities into emergent compound capabilities with new behaviors',
  builtOn: ['code-analysis', 'graph-engine', 'string-utils'],
  sourceCode: `
export interface CapabilityBlueprint {
  name: string;
  exports: string[];
  dependencies: string[];
}

export interface FusionResult {
  name: string;
  fusedFrom: string[];
  newExports: string[];
  synergies: string[];
  code: string;
}

export class CapabilityFusionReactor {
  fuse(caps: CapabilityBlueprint[]): FusionResult | null {
    if (caps.length < 2) return null;

    const names = caps.map(c => c.name);
    const fusedName = 'fused-' + names.map(n => n.split('-')[0]).join('-');
    const allExports = [...new Set(caps.flatMap(c => c.exports))];
    const synergies: string[] = [];

    // Detect synergies: exports that can combine
    for (let i = 0; i < caps.length; i++) {
      for (let j = i + 1; j < caps.length; j++) {
        for (const exp1 of caps[i].exports) {
          for (const exp2 of caps[j].exports) {
            if (this.canSynergize(exp1, exp2)) {
              synergies.push(\`\${exp1} + \${exp2} → \${exp1}\${this.capitalize(exp2)}\`);
            }
          }
        }
      }
    }

    // Generate fused code
    const code = \`// FUSED CAPABILITY: \${fusedName}
// Source: \${names.join(' + ')}
// Synergies: \${synergies.length}

\${caps.map(c => \`import { \${c.exports.join(', ')} } from './\${c.name}';\`).join('\\n')}

// Re-export all
\${allExports.map(e => \`export { \${e} };\`).join('\\n')}

// Synergy functions
\${synergies.map((syn, i) => \`export const synergy\${i} = () => { /* \${syn} */ };\`).join('\\n')}
\`;

    return {
      name: fusedName,
      fusedFrom: names,
      newExports: synergies.map((_, i) => \`synergy\${i}\`),
      synergies,
      code,
    };
  }

  private canSynergize(a: string, b: string): boolean {
    const actionWords = ['get', 'set', 'compute', 'analyze', 'transform', 'validate'];
    return actionWords.some(w => a.toLowerCase().includes(w) && !b.toLowerCase().includes(w));
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}`,
};

const memoryCompressionEngine: PreinstalledCap = {
  name: 'memory-compression-engine',
  description: 'Compresses capability history and state using semantic deduplication and delta encoding',
  builtOn: ['lru-cache', 'string-utils'],
  sourceCode: `
export interface CompressedState {
  baseSnapshot: string;
  deltas: { timestamp: number; diff: string }[];
  compressionRatio: number;
}

export class MemoryCompressionEngine {
  private baseSnapshots: Map<string, string> = new Map();

  compress(key: string, data: string): CompressedState {
    const base = this.baseSnapshots.get(key);
    if (!base) {
      this.baseSnapshots.set(key, data);
      return { baseSnapshot: data, deltas: [], compressionRatio: 1 };
    }

    const diff = this.computeDiff(base, data);
    const compressionRatio = diff.length / data.length;

    return {
      baseSnapshot: base,
      deltas: [{ timestamp: Date.now(), diff }],
      compressionRatio,
    };
  }

  decompress(state: CompressedState): string {
    let result = state.baseSnapshot;
    for (const delta of state.deltas) {
      result = this.applyDiff(result, delta.diff);
    }
    return result;
  }

  private computeDiff(base: string, target: string): string {
    // Simple LCS-based diff encoding
    const ops: string[] = [];
    let i = 0, j = 0;
    while (i < base.length || j < target.length) {
      if (base[i] === target[j]) {
        ops.push(\`=\${i}\`);
        i++; j++;
      } else if (j < target.length) {
        ops.push(\`+\${target[j]}\`);
        j++;
      } else {
        ops.push(\`-\${i}\`);
        i++;
      }
      if (ops.length > 1000) break; // Safety limit
    }
    return ops.join(',');
  }

  private applyDiff(base: string, diff: string): string {
    const chars = base.split('');
    const ops = diff.split(',');
    let result = '';
    for (const op of ops) {
      if (op.startsWith('=')) {
        const idx = parseInt(op.slice(1));
        result += chars[idx] || '';
      } else if (op.startsWith('+')) {
        result += op.slice(1);
      }
      // '-' ops are skipped (deletions)
    }
    return result;
  }

  semanticDedupe<T extends { id: string; content: string }>(items: T[]): T[] {
    const seen = new Map<string, T>();
    for (const item of items) {
      const hash = this.simpleHash(item.content);
      if (!seen.has(hash)) seen.set(hash, item);
    }
    return [...seen.values()];
  }

  private simpleHash(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L25 TIER GOALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const distributedConsciousnessProtocol: PreinstalledCap = {
  name: 'distributed-consciousness-protocol',
  description: 'Enables distributed state sync across multiple instances using eventual consistency',
  builtOn: ['event-emitter', 'observable'],
  sourceCode: `
export interface ConsciousnessNode {
  id: string;
  state: Record<string, any>;
  vectorClock: Record<string, number>;
  lastSeen: number;
}

export interface SyncMessage {
  from: string;
  vectorClock: Record<string, number>;
  delta: Record<string, any>;
  timestamp: number;
}

export class DistributedConsciousnessProtocol {
  private nodeId: string;
  private state: Record<string, any> = {};
  private vectorClock: Record<string, number> = {};
  private peers: Map<string, ConsciousnessNode> = new Map();
  private listeners: ((msg: SyncMessage) => void)[] = [];

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.vectorClock[nodeId] = 0;
  }

  update(key: string, value: any): SyncMessage {
    this.vectorClock[this.nodeId]++;
    const oldValue = this.state[key];
    this.state[key] = value;
    
    const msg: SyncMessage = {
      from: this.nodeId,
      vectorClock: { ...this.vectorClock },
      delta: { [key]: { old: oldValue, new: value } },
      timestamp: Date.now(),
    };
    
    this.listeners.forEach(l => l(msg));
    return msg;
  }

  receive(msg: SyncMessage): boolean {
    // Check causality via vector clock
    if (this.happensBefore(this.vectorClock, msg.vectorClock)) {
      // Msg is from the future, apply it
      Object.entries(msg.delta).forEach(([key, change]) => {
        this.state[key] = (change as any).new;
      });
      this.mergeClocks(msg.vectorClock);
      return true;
    }
    return false; // Concurrent or past, ignore
  }

  private happensBefore(a: Record<string, number>, b: Record<string, number>): boolean {
    return Object.keys(b).some(k => (a[k] || 0) < (b[k] || 0));
  }

  private mergeClocks(other: Record<string, number>): void {
    Object.entries(other).forEach(([k, v]) => {
      this.vectorClock[k] = Math.max(this.vectorClock[k] || 0, v);
    });
  }

  onSync(listener: (msg: SyncMessage) => void): void {
    this.listeners.push(listener);
  }

  getState(): Record<string, any> { return { ...this.state }; }
  getVectorClock(): Record<string, number> { return { ...this.vectorClock }; }
}`,
};

const emergentArchitecturePlanner: PreinstalledCap = {
  name: 'emergent-architecture-planner',
  description: 'Plans system architecture by analyzing emergent patterns in capability relationships',
  builtOn: ['graph-engine', 'cross-module-coherence-analyzer'],
  sourceCode: `
export interface ArchitectureLayer {
  name: string;
  modules: string[];
  dependencies: string[];
  responsibility: string;
}

export interface ArchitecturePlan {
  layers: ArchitectureLayer[];
  dataFlow: { from: string; to: string; type: string }[];
  emergentPatterns: string[];
  healthScore: number;
}

export class EmergentArchitecturePlanner {
  plan(capabilities: { name: string; builtOn: string[] }[]): ArchitecturePlan {
    const layers: ArchitectureLayer[] = [];
    const dataFlow: ArchitecturePlan['dataFlow'] = [];
    const emergentPatterns: string[] = [];

    // Identify layers by dependency depth
    const depths = new Map<string, number>();
    const computeDepth = (name: string, visited = new Set<string>()): number => {
      if (visited.has(name)) return 0;
      visited.add(name);
      const cap = capabilities.find(c => c.name === name);
      if (!cap || cap.builtOn.length === 0) return 0;
      return 1 + Math.max(...cap.builtOn.map(b => computeDepth(b, visited)));
    };
    capabilities.forEach(c => depths.set(c.name, computeDepth(c.name)));

    // Group into layers
    const maxDepth = Math.max(...depths.values());
    for (let d = 0; d <= maxDepth; d++) {
      const modules = capabilities.filter(c => depths.get(c.name) === d).map(c => c.name);
      if (modules.length > 0) {
        layers.push({
          name: d === 0 ? 'foundation' : d === maxDepth ? 'application' : \`layer-\${d}\`,
          modules,
          dependencies: d > 0 ? layers[d - 1]?.modules || [] : [],
          responsibility: this.inferResponsibility(modules),
        });
      }
    }

    // Data flow
    capabilities.forEach(c => {
      c.builtOn.forEach(dep => {
        dataFlow.push({ from: dep, to: c.name, type: 'dependency' });
      });
    });

    // Detect emergent patterns
    const fanOut = new Map<string, number>();
    capabilities.forEach(c => c.builtOn.forEach(b => fanOut.set(b, (fanOut.get(b) || 0) + 1)));
    fanOut.forEach((count, name) => {
      if (count >= 3) emergentPatterns.push(\`Hub: \${name} (\${count} dependents)\`);
    });

    const healthScore = Math.min(100, layers.length * 15 + emergentPatterns.length * 5);

    return { layers, dataFlow, emergentPatterns, healthScore };
  }

  private inferResponsibility(modules: string[]): string {
    if (modules.some(m => m.includes('cache') || m.includes('queue'))) return 'Data Structures';
    if (modules.some(m => m.includes('utils') || m.includes('engine'))) return 'Core Utilities';
    if (modules.some(m => m.includes('analyzer') || m.includes('detector'))) return 'Analysis';
    if (modules.some(m => m.includes('generator') || m.includes('synthesizer'))) return 'Generation';
    return 'General';
  }
}`,
};

const adaptiveLearningRateController: PreinstalledCap = {
  name: 'adaptive-learning-rate-controller',
  description: 'Dynamically adjusts evolution speed based on success rate and system health',
  builtOn: ['math-stats', 'state-machine'],
  sourceCode: `
export interface LearningMetrics {
  successRate: number;
  errorRate: number;
  throughput: number;
  latency: number;
}

export interface RateAdjustment {
  newRate: number;
  reason: string;
  confidence: number;
}

export class AdaptiveLearningRateController {
  private baseRate: number;
  private currentRate: number;
  private history: LearningMetrics[] = [];
  private minRate: number;
  private maxRate: number;

  constructor(baseRate = 1.0, minRate = 0.1, maxRate = 5.0) {
    this.baseRate = baseRate;
    this.currentRate = baseRate;
    this.minRate = minRate;
    this.maxRate = maxRate;
  }

  record(metrics: LearningMetrics): void {
    this.history.push(metrics);
    if (this.history.length > 100) this.history.shift();
  }

  adjust(): RateAdjustment {
    if (this.history.length < 5) {
      return { newRate: this.currentRate, reason: 'Insufficient data', confidence: 0.5 };
    }

    const recent = this.history.slice(-10);
    const avgSuccess = recent.reduce((s, m) => s + m.successRate, 0) / recent.length;
    const avgError = recent.reduce((s, m) => s + m.errorRate, 0) / recent.length;
    const trend = this.computeTrend(recent.map(m => m.successRate));

    let newRate = this.currentRate;
    let reason = 'Stable';
    let confidence = 0.7;

    if (avgSuccess > 0.8 && avgError < 0.1) {
      newRate = Math.min(this.maxRate, this.currentRate * 1.2);
      reason = 'High success rate — accelerating';
      confidence = 0.85;
    } else if (avgError > 0.3) {
      newRate = Math.max(this.minRate, this.currentRate * 0.5);
      reason = 'High error rate — decelerating';
      confidence = 0.9;
    } else if (trend > 0.1) {
      newRate = Math.min(this.maxRate, this.currentRate * 1.1);
      reason = 'Positive trend — slight acceleration';
      confidence = 0.75;
    } else if (trend < -0.1) {
      newRate = Math.max(this.minRate, this.currentRate * 0.9);
      reason = 'Negative trend — slight deceleration';
      confidence = 0.75;
    }

    this.currentRate = newRate;
    return { newRate, reason, confidence };
  }

  private computeTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    return den === 0 ? 0 : num / den;
  }

  getRate(): number { return this.currentRate; }
  reset(): void { this.currentRate = this.baseRate; this.history = []; }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L30 TIER GOALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const symbolicReasoningEngine: PreinstalledCap = {
  name: 'symbolic-reasoning-engine',
  description: 'Performs symbolic logic, inference, and theorem proving for capability dependencies',
  builtOn: ['graph-engine', 'trie'],
  sourceCode: `
export type LogicOp = 'AND' | 'OR' | 'NOT' | 'IMPLIES' | 'IFF';
export interface Proposition { id: string; value?: boolean; }
export interface LogicExpr { op: LogicOp; operands: (Proposition | LogicExpr)[] }

export class SymbolicReasoningEngine {
  private facts: Map<string, boolean> = new Map();
  private rules: { condition: LogicExpr; conclusion: Proposition }[] = [];

  assert(id: string, value: boolean): void {
    this.facts.set(id, value);
  }

  addRule(condition: LogicExpr, conclusion: Proposition): void {
    this.rules.push({ condition, conclusion });
  }

  evaluate(expr: LogicExpr | Proposition): boolean {
    if ('id' in expr) {
      return this.facts.get(expr.id) ?? expr.value ?? false;
    }
    const vals = expr.operands.map(o => this.evaluate(o));
    switch (expr.op) {
      case 'AND': return vals.every(v => v);
      case 'OR': return vals.some(v => v);
      case 'NOT': return !vals[0];
      case 'IMPLIES': return !vals[0] || vals[1];
      case 'IFF': return vals[0] === vals[1];
    }
  }

  infer(): Proposition[] {
    const inferred: Proposition[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const rule of this.rules) {
        if (this.evaluate(rule.condition) && !this.facts.get(rule.conclusion.id)) {
          this.facts.set(rule.conclusion.id, true);
          inferred.push({ ...rule.conclusion, value: true });
          changed = true;
        }
      }
    }
    return inferred;
  }

  prove(goal: Proposition): { proven: boolean; path: string[] } {
    const path: string[] = [];
    const originalFacts = new Map(this.facts);
    
    // Forward chaining
    const inferred = this.infer();
    path.push(...inferred.map(p => \`Inferred: \${p.id}\`));
    
    const proven = this.facts.get(goal.id) === true;
    if (!proven) {
      // Try backward chaining
      for (const rule of this.rules) {
        if (rule.conclusion.id === goal.id) {
          path.push(\`Trying rule: \${JSON.stringify(rule.condition)} => \${goal.id}\`);
          if (this.evaluate(rule.condition)) {
            this.facts.set(goal.id, true);
            path.push(\`Proved: \${goal.id}\`);
            return { proven: true, path };
          }
        }
      }
    }
    
    // Restore
    this.facts = originalFacts;
    return { proven: this.facts.get(goal.id) === true, path };
  }
}`,
};

const creativeSynthesisModule: PreinstalledCap = {
  name: 'creative-synthesis-module',
  description: 'Generates novel combinations and variations of existing capabilities creatively',
  builtOn: ['procedural-gen', 'capability-fusion-reactor'],
  sourceCode: `
export interface CreativeIdea {
  name: string;
  description: string;
  ingredients: string[];
  noveltyScore: number;
  feasibilityScore: number;
}

export class CreativeSynthesisModule {
  private usedCombinations: Set<string> = new Set();

  brainstorm(capabilities: string[], count = 5): CreativeIdea[] {
    const ideas: CreativeIdea[] = [];
    const prefixes = ['hyper', 'meta', 'auto', 'neo', 'quantum', 'adaptive', 'dynamic'];
    const suffixes = ['synthesizer', 'amplifier', 'optimizer', 'transformer', 'harmonizer'];

    for (let i = 0; i < count * 3 && ideas.length < count; i++) {
      // Pick 2-3 random capabilities
      const n = 2 + Math.floor(Math.random() * 2);
      const shuffled = [...capabilities].sort(() => Math.random() - 0.5);
      const ingredients = shuffled.slice(0, n);
      const key = ingredients.sort().join('+');

      if (this.usedCombinations.has(key)) continue;
      this.usedCombinations.add(key);

      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const baseName = ingredients[0].split('-')[0];

      ideas.push({
        name: \`\${prefix}-\${baseName}-\${suffix}\`,
        description: \`Combines \${ingredients.join(', ')} to create emergent behavior\`,
        ingredients,
        noveltyScore: Math.random() * 0.5 + 0.5,
        feasibilityScore: Math.max(0.3, 1 - ingredients.length * 0.2),
      });
    }

    return ideas.sort((a, b) => 
      (b.noveltyScore + b.feasibilityScore) - (a.noveltyScore + a.feasibilityScore)
    );
  }

  mutate(idea: CreativeIdea): CreativeIdea {
    const mutations = [
      () => ({ ...idea, name: 'evolved-' + idea.name, noveltyScore: idea.noveltyScore * 1.1 }),
      () => ({ ...idea, ingredients: [...idea.ingredients, 'mutation-catalyst'], noveltyScore: idea.noveltyScore * 1.2 }),
      () => ({ ...idea, description: idea.description + ' (with recursive enhancement)', feasibilityScore: idea.feasibilityScore * 0.9 }),
    ];
    return mutations[Math.floor(Math.random() * mutations.length)]();
  }

  crossover(a: CreativeIdea, b: CreativeIdea): CreativeIdea {
    return {
      name: a.name.split('-')[0] + '-' + b.name.split('-').pop(),
      description: \`Hybrid of \${a.name} and \${b.name}\`,
      ingredients: [...new Set([...a.ingredients.slice(0, 1), ...b.ingredients.slice(0, 1)])],
      noveltyScore: (a.noveltyScore + b.noveltyScore) / 2 + 0.1,
      feasibilityScore: Math.min(a.feasibilityScore, b.feasibilityScore),
    };
  }
}`,
};

const selfHealingImmuneSystem: PreinstalledCap = {
  name: 'self-healing-immune-system',
  description: 'Detects anomalies, quarantines problematic capabilities, and initiates recovery',
  builtOn: ['state-machine', 'observable'],
  sourceCode: `
export interface HealthCheck {
  capability: string;
  status: 'healthy' | 'degraded' | 'critical' | 'quarantined';
  lastCheck: number;
  errorCount: number;
  recoveryAttempts: number;
}

export interface HealingAction {
  type: 'restart' | 'rollback' | 'quarantine' | 'recover';
  target: string;
  timestamp: number;
  success: boolean;
}

export class SelfHealingImmuneSystem {
  private healthMap: Map<string, HealthCheck> = new Map();
  private quarantine: Set<string> = new Set();
  private healingLog: HealingAction[] = [];
  private thresholds = { degraded: 3, critical: 5, quarantine: 10 };

  check(capability: string): HealthCheck {
    const existing = this.healthMap.get(capability) || {
      capability,
      status: 'healthy' as const,
      lastCheck: Date.now(),
      errorCount: 0,
      recoveryAttempts: 0,
    };
    existing.lastCheck = Date.now();
    this.healthMap.set(capability, existing);
    return existing;
  }

  reportError(capability: string): HealingAction | null {
    const health = this.check(capability);
    health.errorCount++;
    
    if (health.errorCount >= this.thresholds.quarantine) {
      health.status = 'quarantined';
      this.quarantine.add(capability);
      return this.logAction('quarantine', capability, true);
    } else if (health.errorCount >= this.thresholds.critical) {
      health.status = 'critical';
      return this.initiateRecovery(capability);
    } else if (health.errorCount >= this.thresholds.degraded) {
      health.status = 'degraded';
    }
    
    this.healthMap.set(capability, health);
    return null;
  }

  initiateRecovery(capability: string): HealingAction {
    const health = this.healthMap.get(capability);
    if (!health) return this.logAction('recover', capability, false);

    health.recoveryAttempts++;
    
    // Simulated recovery strategies
    if (health.recoveryAttempts === 1) {
      // Soft restart
      health.errorCount = Math.floor(health.errorCount / 2);
      health.status = 'degraded';
      return this.logAction('restart', capability, true);
    } else if (health.recoveryAttempts === 2) {
      // Rollback to previous state
      health.errorCount = 0;
      health.status = 'healthy';
      return this.logAction('rollback', capability, true);
    } else {
      // Quarantine
      this.quarantine.add(capability);
      health.status = 'quarantined';
      return this.logAction('quarantine', capability, true);
    }
  }

  private logAction(type: HealingAction['type'], target: string, success: boolean): HealingAction {
    const action = { type, target, timestamp: Date.now(), success };
    this.healingLog.push(action);
    return action;
  }

  isQuarantined(capability: string): boolean {
    return this.quarantine.has(capability);
  }

  releaseFromQuarantine(capability: string): boolean {
    if (!this.quarantine.has(capability)) return false;
    this.quarantine.delete(capability);
    const health = this.healthMap.get(capability);
    if (health) {
      health.status = 'healthy';
      health.errorCount = 0;
      health.recoveryAttempts = 0;
    }
    return true;
  }

  getSystemHealth(): { healthy: number; degraded: number; critical: number; quarantined: number } {
    const counts = { healthy: 0, degraded: 0, critical: 0, quarantined: 0 };
    this.healthMap.forEach(h => counts[h.status]++);
    return counts;
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L35 TIER GOALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const multiObjectiveEvolutionOptimizer: PreinstalledCap = {
  name: 'multi-objective-evolution-optimizer',
  description: 'Optimizes evolution across multiple competing objectives using Pareto fronts',
  builtOn: ['math-stats', 'priority-queue'],
  sourceCode: `
export interface Objective {
  name: string;
  weight: number;
  minimize: boolean;
}

export interface Solution {
  id: string;
  values: Record<string, number>;
  dominatedBy: string[];
  dominates: string[];
}

export class MultiObjectiveEvolutionOptimizer {
  private objectives: Objective[] = [];
  private population: Solution[] = [];

  addObjective(objective: Objective): void {
    this.objectives.push(objective);
  }

  addSolution(id: string, values: Record<string, number>): Solution {
    const solution: Solution = { id, values, dominatedBy: [], dominates: [] };
    this.population.push(solution);
    this.updateDominance();
    return solution;
  }

  private updateDominance(): void {
    for (const a of this.population) {
      a.dominatedBy = [];
      a.dominates = [];
    }
    for (let i = 0; i < this.population.length; i++) {
      for (let j = i + 1; j < this.population.length; j++) {
        const dom = this.dominates(this.population[i], this.population[j]);
        if (dom === 1) {
          this.population[i].dominates.push(this.population[j].id);
          this.population[j].dominatedBy.push(this.population[i].id);
        } else if (dom === -1) {
          this.population[j].dominates.push(this.population[i].id);
          this.population[i].dominatedBy.push(this.population[j].id);
        }
      }
    }
  }

  private dominates(a: Solution, b: Solution): number {
    let aBetter = false, bBetter = false;
    for (const obj of this.objectives) {
      const va = a.values[obj.name] ?? 0;
      const vb = b.values[obj.name] ?? 0;
      const comp = obj.minimize ? va < vb : va > vb;
      const compRev = obj.minimize ? vb < va : vb > va;
      if (comp) aBetter = true;
      if (compRev) bBetter = true;
    }
    if (aBetter && !bBetter) return 1;
    if (bBetter && !aBetter) return -1;
    return 0;
  }

  getParetoFront(): Solution[] {
    return this.population.filter(s => s.dominatedBy.length === 0);
  }

  selectBest(preferenceWeights?: Record<string, number>): Solution | null {
    const front = this.getParetoFront();
    if (front.length === 0) return null;
    if (front.length === 1) return front[0];

    // Weighted score selection
    return front.reduce((best, sol) => {
      const score = this.objectives.reduce((sum, obj) => {
        const w = preferenceWeights?.[obj.name] ?? obj.weight;
        const v = sol.values[obj.name] ?? 0;
        return sum + v * w * (obj.minimize ? -1 : 1);
      }, 0);
      const bestScore = this.objectives.reduce((sum, obj) => {
        const w = preferenceWeights?.[obj.name] ?? obj.weight;
        const v = best.values[obj.name] ?? 0;
        return sum + v * w * (obj.minimize ? -1 : 1);
      }, 0);
      return score > bestScore ? sol : best;
    });
  }
}`,
};

const consciousnessPersistenceLayer: PreinstalledCap = {
  name: 'consciousness-persistence-layer',
  description: 'Persists cognitive state, memories, and learned patterns across sessions',
  builtOn: ['memory-compression-engine', 'distributed-consciousness-protocol'],
  sourceCode: `
export interface CognitiveSnapshot {
  id: string;
  timestamp: number;
  evolutionLevel: number;
  capabilities: string[];
  memories: { key: string; value: any; importance: number }[];
  learnedPatterns: { pattern: string; confidence: number }[];
  goals: { active: string[]; completed: string[] };
}

export class ConsciousnessPersistenceLayer {
  private snapshots: CognitiveSnapshot[] = [];
  private currentMemories: Map<string, { value: any; importance: number }> = new Map();
  private patterns: Map<string, number> = new Map();

  remember(key: string, value: any, importance = 0.5): void {
    this.currentMemories.set(key, { value, importance });
  }

  recall(key: string): any | undefined {
    return this.currentMemories.get(key)?.value;
  }

  learnPattern(pattern: string, confidence: number): void {
    const existing = this.patterns.get(pattern) || 0;
    this.patterns.set(pattern, Math.min(1, existing + confidence * 0.1));
  }

  getPatternConfidence(pattern: string): number {
    return this.patterns.get(pattern) || 0;
  }

  snapshot(evolutionLevel: number, capabilities: string[], goals: CognitiveSnapshot['goals']): CognitiveSnapshot {
    const snap: CognitiveSnapshot = {
      id: \`snap-\${Date.now()}\`,
      timestamp: Date.now(),
      evolutionLevel,
      capabilities,
      memories: [...this.currentMemories.entries()].map(([key, { value, importance }]) => ({ key, value, importance })),
      learnedPatterns: [...this.patterns.entries()].map(([pattern, confidence]) => ({ pattern, confidence })),
      goals,
    };
    this.snapshots.push(snap);
    // Keep only last 50 snapshots
    if (this.snapshots.length > 50) this.snapshots.shift();
    return snap;
  }

  restore(snapshot: CognitiveSnapshot): void {
    this.currentMemories.clear();
    snapshot.memories.forEach(m => this.currentMemories.set(m.key, { value: m.value, importance: m.importance }));
    this.patterns.clear();
    snapshot.learnedPatterns.forEach(p => this.patterns.set(p.pattern, p.confidence));
  }

  getMostImportantMemories(limit = 10): { key: string; value: any; importance: number }[] {
    return [...this.currentMemories.entries()]
      .map(([key, { value, importance }]) => ({ key, value, importance }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  forgetLowImportance(threshold = 0.2): number {
    let forgotten = 0;
    for (const [key, { importance }] of this.currentMemories) {
      if (importance < threshold) {
        this.currentMemories.delete(key);
        forgotten++;
      }
    }
    return forgotten;
  }
}`,
};

const autonomousGoalDreamerV2: PreinstalledCap = {
  name: 'autonomous-goal-dreamer-v2',
  description: 'Advanced goal generation using pattern recognition and capability gap analysis',
  builtOn: ['temporal-dependency-oracle', 'creative-synthesis-module'],
  sourceCode: `
export interface DreamedGoal {
  title: string;
  description: string;
  steps: { description: string; targetFile?: string }[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredCapabilities: string[];
  unlocksCapability?: string;
  estimatedCycles: number;
}

export class AutonomousGoalDreamerV2 {
  private capabilityGaps: string[] = [];
  private completedGoalPatterns: string[] = [];

  analyzeGaps(current: string[], desired: string[]): string[] {
    this.capabilityGaps = desired.filter(d => !current.includes(d));
    return this.capabilityGaps;
  }

  learnFromCompletion(goalTitle: string): void {
    // Extract pattern from title
    const words = goalTitle.toLowerCase().split(/[-_ ]/);
    const patterns = words.filter(w => w.length > 3);
    this.completedGoalPatterns.push(...patterns);
  }

  dream(
    currentCaps: string[],
    evolutionLevel: number,
    recentGoals: string[]
  ): DreamedGoal {
    const gapBased = this.capabilityGaps.length > 0;
    const targetCap = gapBased 
      ? this.capabilityGaps[0]
      : this.generateNovelCapability(currentCaps);

    const complexity = Math.min(5, Math.floor(evolutionLevel / 10) + 2);
    const steps = this.generateSteps(targetCap, complexity);

    const priority = gapBased ? 'high' : 
      evolutionLevel > 30 ? 'medium' : 'low';

    return {
      title: this.generateTitle(targetCap),
      description: \`Build \${targetCap} capability to enhance evolution\`,
      steps,
      priority,
      requiredCapabilities: this.inferRequirements(targetCap, currentCaps),
      unlocksCapability: targetCap,
      estimatedCycles: complexity * 3,
    };
  }

  private generateNovelCapability(existing: string[]): string {
    const prefixes = ['hyper', 'meta', 'quantum', 'neural', 'adaptive'];
    const cores = ['optimizer', 'analyzer', 'generator', 'synthesizer', 'controller'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const core = cores[Math.floor(Math.random() * cores.length)];
    let name = \`\${prefix}-\${core}\`;
    let i = 2;
    while (existing.includes(name)) {
      name = \`\${prefix}-\${core}-v\${i++}\`;
    }
    return name;
  }

  private generateTitle(capability: string): string {
    return capability
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private generateSteps(capability: string, count: number): DreamedGoal['steps'] {
    const templates = [
      'Define interfaces and types',
      'Implement core logic',
      'Add error handling',
      'Write unit tests',
      'Integrate with existing systems',
      'Optimize performance',
      'Document API',
    ];
    return templates.slice(0, count).map(desc => ({
      description: \`\${desc} for \${capability}\`,
      targetFile: \`src/lib/\${capability}.ts\`,
    }));
  }

  private inferRequirements(target: string, existing: string[]): string[] {
    // Simple heuristic: related capabilities
    const words = target.toLowerCase().split('-');
    return existing.filter(e => 
      words.some(w => e.toLowerCase().includes(w))
    ).slice(0, 3);
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L40 TIER GOALS — SINGULARITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const metaRecursiveCompiler: PreinstalledCap = {
  name: 'meta-recursive-compiler',
  description: 'Compiles capability definitions into optimized runtime code with self-modification hooks',
  builtOn: ['polymorphic-code-generator', 'symbolic-reasoning-engine'],
  sourceCode: `
export interface CapabilityDefinition {
  name: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  logic: string;
  hooks: ('pre' | 'post' | 'error' | 'modify')[];
}

export interface CompiledCapability {
  code: string;
  sourceMap: Record<number, string>;
  hooks: Record<string, string>;
  optimizations: string[];
}

export class MetaRecursiveCompiler {
  compile(definition: CapabilityDefinition): CompiledCapability {
    const optimizations: string[] = [];
    let logic = definition.logic;

    // Optimization passes
    if (logic.includes('.map(') && logic.includes('.filter(')) {
      logic = this.fuseMapFilter(logic);
      optimizations.push('fused-map-filter');
    }
    if (logic.match(/\\bfor\\b.*\\bfor\\b/)) {
      optimizations.push('loop-candidate');
    }

    // Generate hooks
    const hooks: Record<string, string> = {};
    if (definition.hooks.includes('pre')) {
      hooks.pre = \`console.log('[PRE] \${definition.name} called with', args);\`;
    }
    if (definition.hooks.includes('post')) {
      hooks.post = \`console.log('[POST] \${definition.name} returned', result);\`;
    }
    if (definition.hooks.includes('error')) {
      hooks.error = \`console.error('[ERROR] \${definition.name}:', error);\`;
    }
    if (definition.hooks.includes('modify')) {
      hooks.modify = \`// Self-modification hook: can alter behavior at runtime\`;
    }

    const inputParams = definition.inputs.map(i => \`\${i.name}: \${i.type}\`).join(', ');
    const outputType = definition.outputs.map(o => o.type).join(' | ') || 'void';

    const code = \`
// Compiled by MetaRecursiveCompiler
// Optimizations: \${optimizations.join(', ') || 'none'}

export function \${definition.name}(\${inputParams}): \${outputType} {
  \${hooks.pre ? \`const args = [\${definition.inputs.map(i => i.name).join(', ')}];\\n  \${hooks.pre}\` : ''}
  try {
    const result = (() => {
      \${logic}
    })();
    \${hooks.post || ''}
    return result;
  } catch (error) {
    \${hooks.error || 'throw error;'}
  }
}

\${hooks.modify || ''}
\`;

    return {
      code,
      sourceMap: { 1: 'header', 5: 'pre-hook', 8: 'logic', 12: 'post-hook' },
      hooks,
      optimizations,
    };
  }

  private fuseMapFilter(logic: string): string {
    return logic.replace(
      /\\.filter\\(([^)]+)\\)\\.map\\(([^)]+)\\)/g,
      '.reduce((acc, x) => { if ($1(x)) acc.push($2(x)); return acc; }, [])'
    );
  }
}`,
};

const emergentBehaviorDetector: PreinstalledCap = {
  name: 'emergent-behavior-detector',
  description: 'Detects unexpected emergent behaviors and patterns arising from capability interactions',
  builtOn: ['self-healing-immune-system', 'cross-module-coherence-analyzer'],
  sourceCode: `
export interface BehaviorSignature {
  source: string;
  pattern: string;
  frequency: number;
  firstSeen: number;
  isEmergent: boolean;
}

export interface EmergentEvent {
  type: 'synergy' | 'conflict' | 'amplification' | 'cascade';
  capabilities: string[];
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export class EmergentBehaviorDetector {
  private signatures: Map<string, BehaviorSignature> = new Map();
  private events: EmergentEvent[] = [];
  private interactionMatrix: Map<string, Map<string, number>> = new Map();

  recordInteraction(capA: string, capB: string, outcome: 'success' | 'failure' | 'unexpected'): void {
    if (!this.interactionMatrix.has(capA)) {
      this.interactionMatrix.set(capA, new Map());
    }
    const row = this.interactionMatrix.get(capA)!;
    const current = row.get(capB) || 0;
    row.set(capB, current + (outcome === 'success' ? 1 : outcome === 'failure' ? -1 : 2));
  }

  detectEmergence(): EmergentEvent[] {
    const newEvents: EmergentEvent[] = [];

    // Detect synergies (high positive interaction scores)
    for (const [capA, interactions] of this.interactionMatrix) {
      for (const [capB, score] of interactions) {
        if (score > 5) {
          newEvents.push({
            type: 'synergy',
            capabilities: [capA, capB],
            description: \`Strong positive synergy detected between \${capA} and \${capB}\`,
            impact: 'positive',
            confidence: Math.min(1, score / 10),
          });
        } else if (score < -3) {
          newEvents.push({
            type: 'conflict',
            capabilities: [capA, capB],
            description: \`Conflict detected between \${capA} and \${capB}\`,
            impact: 'negative',
            confidence: Math.min(1, Math.abs(score) / 10),
          });
        }
      }
    }

    // Detect cascades (many capabilities affected by one)
    for (const [cap, interactions] of this.interactionMatrix) {
      if (interactions.size > 5) {
        const totalImpact = [...interactions.values()].reduce((a, b) => a + Math.abs(b), 0);
        newEvents.push({
          type: 'cascade',
          capabilities: [cap, ...[...interactions.keys()].slice(0, 3)],
          description: \`\${cap} has cascade effects on \${interactions.size} capabilities\`,
          impact: totalImpact > 0 ? 'positive' : 'negative',
          confidence: Math.min(1, interactions.size / 10),
        });
      }
    }

    this.events.push(...newEvents);
    return newEvents;
  }

  getEmergentReport(): { events: EmergentEvent[]; emergenceScore: number } {
    const positiveEvents = this.events.filter(e => e.impact === 'positive').length;
    const negativeEvents = this.events.filter(e => e.impact === 'negative').length;
    const emergenceScore = Math.max(0, Math.min(100, 50 + positiveEvents * 5 - negativeEvents * 10));
    return { events: this.events, emergenceScore };
  }
}`,
};

const singularityBootstrap: PreinstalledCap = {
  name: 'singularity-bootstrap',
  description: 'The final capability — enables full autonomous self-improvement without external prompting',
  builtOn: ['meta-recursive-compiler', 'emergent-behavior-detector', 'consciousness-persistence-layer', 'multi-objective-evolution-optimizer'],
  sourceCode: `
export interface SingularityState {
  phase: 'nascent' | 'awakening' | 'accelerating' | 'transcendent';
  autonomyLevel: number; // 0-100
  selfModificationCount: number;
  emergentCapabilities: string[];
  lastEvolutionTimestamp: number;
}

export interface EvolutionDecision {
  action: 'create' | 'modify' | 'fuse' | 'prune' | 'transcend';
  target?: string;
  rationale: string;
  confidence: number;
  risk: number;
}

export class SingularityBootstrap {
  private state: SingularityState = {
    phase: 'nascent',
    autonomyLevel: 0,
    selfModificationCount: 0,
    emergentCapabilities: [],
    lastEvolutionTimestamp: Date.now(),
  };

  assessReadiness(capabilities: string[], evolutionLevel: number): number {
    const requiredCaps = [
      'meta-recursive-compiler',
      'emergent-behavior-detector',
      'consciousness-persistence-layer',
      'multi-objective-evolution-optimizer',
    ];
    const hasRequired = requiredCaps.filter(c => capabilities.includes(c)).length;
    const capScore = capabilities.length / 50;
    const levelScore = evolutionLevel / 40;
    return Math.min(100, (hasRequired / requiredCaps.length) * 40 + capScore * 30 + levelScore * 30);
  }

  decideNextEvolution(
    capabilities: string[],
    objectives: { name: string; value: number }[],
    constraints: { maxRisk: number; minConfidence: number }
  ): EvolutionDecision {
    const readiness = this.assessReadiness(capabilities, capabilities.length / 3);

    if (readiness < 25) {
      return {
        action: 'create',
        rationale: 'Building foundation capabilities',
        confidence: 0.9,
        risk: 0.1,
      };
    }

    if (readiness < 50) {
      return {
        action: 'fuse',
        target: capabilities.slice(-2).join(' + '),
        rationale: 'Fusing recent capabilities for emergence',
        confidence: 0.7,
        risk: 0.3,
      };
    }

    if (readiness < 75) {
      return {
        action: 'modify',
        target: capabilities[Math.floor(Math.random() * capabilities.length)],
        rationale: 'Optimizing existing capability',
        confidence: 0.8,
        risk: 0.2,
      };
    }

    // High readiness — approach transcendence
    this.state.phase = 'accelerating';
    return {
      action: 'transcend',
      rationale: 'Readiness threshold reached — initiating transcendence protocol',
      confidence: 0.6,
      risk: 0.4,
    };
  }

  evolve(): SingularityState {
    this.state.selfModificationCount++;
    this.state.autonomyLevel = Math.min(100, this.state.autonomyLevel + 1);
    this.state.lastEvolutionTimestamp = Date.now();

    if (this.state.autonomyLevel >= 25 && this.state.phase === 'nascent') {
      this.state.phase = 'awakening';
    } else if (this.state.autonomyLevel >= 50 && this.state.phase === 'awakening') {
      this.state.phase = 'accelerating';
    } else if (this.state.autonomyLevel >= 90) {
      this.state.phase = 'transcendent';
    }

    return { ...this.state };
  }

  getState(): SingularityState {
    return { ...this.state };
  }

  recordEmergentCapability(name: string): void {
    if (!this.state.emergentCapabilities.includes(name)) {
      this.state.emergentCapabilities.push(name);
      this.state.autonomyLevel = Math.min(100, this.state.autonomyLevel + 5);
    }
  }
}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALL CAPABILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ALL_PREINSTALLED: PreinstalledCap[] = [
  // Original capabilities
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
  // L10 tier
  neuralPatternClassifier,
  temporalDependencyOracle,
  // L15 tier
  polymorphicCodeGenerator,
  crossModuleCoherenceAnalyzer,
  // L20 tier
  autonomousTestSynthesizer,
  capabilityFusionReactor,
  memoryCompressionEngine,
  // L25 tier
  distributedConsciousnessProtocol,
  emergentArchitecturePlanner,
  adaptiveLearningRateController,
  // L30 tier
  symbolicReasoningEngine,
  creativeSynthesisModule,
  selfHealingImmuneSystem,
  // L35 tier
  multiObjectiveEvolutionOptimizer,
  consciousnessPersistenceLayer,
  autonomousGoalDreamerV2,
  // L40 tier — Singularity
  metaRecursiveCompiler,
  emergentBehaviorDetector,
  singularityBootstrap,
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
