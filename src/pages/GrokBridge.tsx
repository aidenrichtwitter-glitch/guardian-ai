import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send, Shield, Check, AlertTriangle, Undo2, FileCode, Sparkles, Bot,
  User, Loader2, Code2, Trash2, ChevronDown, Globe, MessageSquare,
  Clipboard, ClipboardCheck, Zap, X, ChevronUp, ChevronDown as ChevronDownIcon,
  Dna, FolderOpen, PanelLeftClose, PanelLeft, Play, ExternalLink, Download, Terminal, AlertCircle, Key, ArrowRightLeft, FolderPlus, RefreshCw, Monitor, GitBranch, Upload, Settings,
  Moon, Lock, Smartphone, TestTube2, Gauge, Palette, Wand2
} from 'lucide-react';
import { validateChange, type ValidationContext } from '@/lib/safety-engine';
import { SELF_SOURCE } from '@/lib/self-source';
import { SafetyCheck } from '@/lib/self-reference';
import { parseCodeBlocks, ParsedBlock, isLikelySnippet, mergeCSSVariables, parseDependencies, parseActionItems, ActionItem } from '@/lib/code-parser';
import {
  fetchEvolutionState,
  buildEvolutionContext,
  loadEvolutionPlan,
  extractNextPlan,
  saveEvolutionPlan,
  registerEvolutionResults,
  type EvolutionState,
  type EvolutionPlan,
} from '@/lib/evolution-bridge';
import {
  getActiveProject, setActiveProject as persistActiveProject,
  readProjectFile, writeProjectFile, getProjectFiles,
  importFromGitHub, detectAllGitHubUrls, detectGitHubUrlInResponse,
  type ProjectFileNode, type GitHubImportProgress
} from '@/lib/project-manager';
import {
  checkToasterAvailability,
  buildSmartContext,
  formatAnalysisForPrompt,
  loadToasterConfig,
  saveToasterConfig,
  cleanGrokResponse,
  cleanedResponseToBlocks,
  suggestQuickActions,
  clearAvailabilityCache,
  type OllamaToasterConfig,
  type ToasterAnalysis,
  type ToasterAvailability,
  type QuickAction,
} from '@/lib/ollama-toaster';
import { publishProject, type PublishProgress } from '@/lib/guardian-publish';
import { hasPublishCredentials, getGuardianConfig, setSharedPat, setUserPat } from '@/lib/guardian-config';
import {
  startKnowledgeRefreshLoop,
  stopKnowledgeRefreshLoop,
  searchKnowledge,
  formatKnowledgeForGrokPrompt,
  getKnowledgeSummary,
  type KnowledgeMatch,
} from '@/lib/guardian-knowledge';
import ProjectExplorer from '@/components/ProjectExplorer';
import FileEditor from '@/components/FileEditor';
import LogsPanel, { type LogEntry, formatLogsForGrok } from '@/components/LogsPanel';

const MAX_LOG_ENTRIES = 200;

const isElectron = typeof window !== 'undefined' && typeof (window as any).require === 'function';

type Mode = 'api' | 'browser';
type Msg = { role: 'user' | 'assistant'; content: string };

interface AppliedChange {
  filePath: string;
  previousContent: string;
  newContent: string;
  timestamp: number;
  backupPath?: string;
}

type ApplyStage = 'confirm' | 'writing' | 'checking' | 'committing' | 'done' | 'error';

interface PendingApply {
  filePath: string;
  newContent: string;
  oldContent: string;
  exists: boolean;
  safetyChecks: SafetyCheck[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  model: string;
  createdAt: number;
}

const MODELS = [
  { id: 'grok-4', name: 'Grok 4', desc: 'Most capable (latest)' },
  { id: 'grok-3', name: 'Grok 3', desc: 'Powerful reasoning' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', desc: 'Fast & efficient' },
  { id: 'grok-3-fast', name: 'Grok 3 Fast', desc: 'Speed optimized' },
  { id: 'grok-2', name: 'Grok 2', desc: 'Balanced' },
];

const BROWSER_SITES = [
  { id: 'grok', name: 'Grok', url: 'https://grok.com', icon: '🤖' },
  { id: 'x', name: 'X', url: 'https://x.com/i/grok', icon: '𝕏' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: '💬' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', icon: '🧠' },
  { id: 'github', name: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', icon: '🔍' },
];


const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grok-chat`;

async function streamGrok({ messages, model, onDelta, onDone, onError }: {
  messages: Msg[]; model: string;
  onDelta: (text: string) => void; onDone: () => void; onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ messages, model }),
    });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); onError(d.error || `Error ${resp.status}`); return; }
    if (!resp.body) { onError('No response body'); return; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') { onDone(); return; }
        try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) onDelta(c); } catch { }
      }
    }
    onDone();
  } catch (e) { onError(e instanceof Error ? e.message : 'Stream failed'); }
}

function generateTitle(messages: Msg[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.content.slice(0, 50) + (first.content.length > 50 ? '...' : '');
}

const STORAGE_KEY = 'grok-conversations';
function loadConversations(): Conversation[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveConversations(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, 50)));
}

// ─── Browser Mode — clipboard-based code extractor ───────────────────────────

interface ExtractedBlock extends ParsedBlock {
  id: string;
  validationResult?: SafetyCheck[];
  applied: boolean;
}

function extractContextSections(fullText: string): string[] {
  const sections: string[] = [];
  const codeBlockRegex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(fullText)) !== null) {
    const before = fullText.slice(lastIndex, match.index).trim();
    if (before.length > 5) sections.push(before);
    lastIndex = match.index + match[0].length;
  }
  const after = fullText.slice(lastIndex).trim();
  if (after.length > 5) sections.push(after);
  return sections;
}

function ClipboardExtractor({ onApply, onApplyAll, onResponseCaptured, activeProject, onGithubImport }: { onApply: (filePath: string, code: string) => void; onApplyAll?: (blocks: { filePath: string; code: string }[]) => void; onResponseCaptured?: (fullResponse: string) => void; activeProject?: string | null; onGithubImport?: (url: string) => void }) {
  const [blocks, setBlocks] = useState<ExtractedBlock[]>([]);
  const [detectedDeps, setDetectedDeps] = useState<{ dependencies: string[]; devDependencies: string[] }>({ dependencies: [], devDependencies: [] });
  const [depsInstalling, setDepsInstalling] = useState(false);
  const [depsInstalled, setDepsInstalled] = useState(false);
  const [depsError, setDepsError] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [programsInstalling, setProgramsInstalling] = useState(false);
  const [programResults, setProgramResults] = useState<{ program: string; label: string; installed: boolean; alreadyInstalled: boolean; error?: string }[] | null>(null);
  const [runningCommands, setRunningCommands] = useState<Set<number>>(new Set());
  const [commandResults, setCommandResults] = useState<Map<number, { success: boolean; output?: string; error?: string }>>(new Map());
  const [responseContext, setResponseContext] = useState<string>('');
  const [contextSections, setContextSections] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [lastClipboard, setLastClipboard] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  const [flash, setFlash] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [clipboardAvailable, setClipboardAvailable] = useState(true);
  const [ollamaCleaned, setOllamaCleaned] = useState(false);
  const [detectedGithubUrls, setDetectedGithubUrls] = useState<{ owner: string; repo: string; fullUrl: string }[]>([]);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const extractorContentRef = useRef<HTMLDivElement>(null);

  const applyParsedBlocks = useCallback((text: string, parsed: { filePath: string; code: string; language: string }[], wasOllamaCleaned: boolean) => {
    const newBlocks: ExtractedBlock[] = parsed.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      applied: false,
    }));
    setBlocks(newBlocks);
    setOllamaCleaned(wasOllamaCleaned);
    setDetectedDeps(parseDependencies(text));
    setActionItems(parseActionItems(text));
    setCollapsed(false);
    setShowPasteBox(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
    if (onResponseCaptured) onResponseCaptured(text);
  }, [onResponseCaptured]);

  const extractFromText = useCallback((text: string) => {
    if (text === lastClipboard || text.length < 10) return;
    if (text.includes('=== PROJECT CONTEXT ===') || text.includes('=== FILE TREE ===') || text.includes('=== EVOLUTION_CONTEXT ===') || text.includes('=== INSTRUCTIONS ===\nWhen suggesting code changes')) return;
    setLastClipboard(text);
    setResponseContext(text);
    setContextSections(extractContextSections(text));

    const githubUrls = detectAllGitHubUrls(text);
    setDetectedGithubUrls(githubUrls);

    const regexParsed = parseCodeBlocks(text);
    applyParsedBlocks(text, regexParsed, false);

    cleanGrokResponse(text).then(cleaned => {
      if (cleaned && cleaned.files.length > 0) {
        const ollamaBlocks = cleanedResponseToBlocks(cleaned);
        if (ollamaBlocks.length > 0) {
          const hasMorePaths = ollamaBlocks.filter(b => b.filePath).length >= regexParsed.filter(b => b.filePath).length;
          if (hasMorePaths) {
            applyParsedBlocks(text, ollamaBlocks, true);
          }
        }
      }
    }).catch(() => {});
  }, [lastClipboard, applyParsedBlocks]);

  const readClipboard = useCallback(async () => {
    try {
      if (isElectron) {
        const { ipcRenderer } = (window as any).require('electron');
        const text = await ipcRenderer.invoke('read-clipboard');
        if (text) extractFromText(text);
      } else {
        const text = await navigator.clipboard.readText();
        extractFromText(text);
      }
    } catch {
      setClipboardAvailable(false);
    }
  }, [extractFromText]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text && text.length > 10) {
      extractFromText(text);
    }
  }, [extractFromText]);

  useEffect(() => {
    readClipboard();
  }, []);

  useEffect(() => {
    if (isElectron) {
      const interval = window.setInterval(() => readClipboard(), 800);
      return () => window.clearInterval(interval);
    }
  }, [readClipboard]);

  const validate = (block: ExtractedBlock) => {
    const checks = validateChange(block.code, block.filePath || 'unknown.ts');
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, validationResult: checks } : b));
  };

  const apply = (block: ExtractedBlock) => {
    onApply(block.filePath, block.code);
    if (!isElectron) {
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, applied: true } : b));
    }
  };

  const installDeps = async () => {
    if (!activeProject || depsInstalling) return;
    const allDeps = [...detectedDeps.dependencies, ...detectedDeps.devDependencies];
    if (allDeps.length === 0) return;
    setDepsInstalling(true);
    setDepsError(null);
    setDepsInstalled(false);
    try {
      const res = await fetch('/api/projects/install-deps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeProject,
          dependencies: detectedDeps.dependencies,
          devDependencies: detectedDeps.devDependencies,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(data.error || `Install failed (${res.status})`);
      }
      if (data.success === false) {
        throw new Error(data.errors?.join('; ') || 'Some packages failed to install');
      }
      setDepsInstalled(true);
      setTimeout(() => setDepsInstalled(false), 5000);
    } catch (err: any) {
      setDepsError(err.message || 'Install failed');
      setTimeout(() => setDepsError(null), 6000);
    } finally {
      setDepsInstalling(false);
    }
  };

  const handleGithubClone = (url: string) => {
    if (onGithubImport) {
      onGithubImport(url);
      setDetectedGithubUrls([]);
    }
  };

  return (
    <div className={`border-t bg-background/95 backdrop-blur-sm shadow-2xl transition-colors z-20 ${flash ? 'border-primary bg-primary/10' : 'border-primary/30'}`}>
      {/* Toolbar */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-border/30 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className={`w-3.5 h-3.5 text-primary ${flash ? 'animate-ping' : 'animate-pulse'}`} />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Code Extractor</span>
        </div>
        {isElectron && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 text-primary text-[9px] border border-primary/20">
            <ClipboardCheck className="w-3 h-3" />
            <span>Auto-detects Grok copy-button responses</span>
          </div>
        )}
        <button
          onClick={() => { setShowPasteBox(p => !p); if (collapsed) setCollapsed(false); setTimeout(() => { pasteRef.current?.focus(); extractorContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); }}
          data-testid="button-paste-response"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary/15 text-primary hover:bg-primary/25 text-[10px] font-medium transition-colors border border-primary/20"
        >
          <Clipboard className="w-3 h-3" /> {showPasteBox ? 'Hide Paste Box' : 'Paste Response'}
        </button>
        {clipboardAvailable && (
          <button
            onClick={readClipboard}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-secondary/50 hover:bg-secondary/80 text-[10px] text-muted-foreground transition-colors"
          >
            <ClipboardCheck className="w-3 h-3" /> Read clipboard
          </button>
        )}
        {blocks.length > 0 && (
          <span className="text-[9px] text-primary/70 ml-1" data-testid="text-blocks-detected">
            {blocks.length} block{blocks.length > 1 ? 's' : ''} detected
            {ollamaCleaned && <span className="ml-1 text-[8px] text-[hsl(200_70%_60%)]" data-testid="text-ollama-cleaned">(Ollama cleaned)</span>}
          </span>
        )}
        {(detectedDeps.dependencies.length > 0 || detectedDeps.devDependencies.length > 0) && (
          depsInstalled ? (
            <span className="text-[9px] text-[hsl(150_60%_55%)] ml-1 flex items-center gap-1 px-2 py-1 rounded bg-[hsl(150_60%_55%/0.15)] border border-[hsl(150_60%_55%/0.3)]" data-testid="text-deps-installed">
              <Check className="w-2.5 h-2.5" />
              Deps installed
            </span>
          ) : depsError ? (
            <span className="text-[9px] text-red-400 ml-1 flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/30" data-testid="text-deps-error">
              <X className="w-2.5 h-2.5" />
              {depsError}
            </span>
          ) : activeProject ? (
            <button
              onClick={installDeps}
              disabled={depsInstalling}
              data-testid="button-install-deps"
              className="text-[9px] text-[hsl(150_60%_55%)] ml-1 flex items-center gap-1 px-2 py-1.5 rounded bg-[hsl(150_60%_55%/0.1)] hover:bg-[hsl(150_60%_55%/0.25)] border border-[hsl(150_60%_55%/0.3)] cursor-pointer transition-colors font-bold"
            >
              {depsInstalling ? (
                <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Installing...</>
              ) : (
                <><Download className="w-2.5 h-2.5" /> {detectedDeps.dependencies.length + detectedDeps.devDependencies.length} dep{detectedDeps.dependencies.length + detectedDeps.devDependencies.length > 1 ? 's' : ''} to install</>
              )}
            </button>
          ) : (
            <span className="text-[9px] text-[hsl(150_60%_55%/0.5)] ml-1 flex items-center gap-1" data-testid="text-detected-deps-no-project">
              <Zap className="w-2.5 h-2.5" />
              {detectedDeps.dependencies.length + detectedDeps.devDependencies.length} dep{detectedDeps.dependencies.length + detectedDeps.devDependencies.length > 1 ? 's' : ''} (select project to install)
            </span>
          )
        )}
        {actionItems.length > 0 && (
          <span className="text-[9px] text-amber-400/80 ml-1 flex items-center gap-1" data-testid="text-action-items">
            <AlertCircle className="w-2.5 h-2.5" />
            {actionItems.length} action{actionItems.length > 1 ? 's' : ''} needed
          </span>
        )}
        {detectedGithubUrls.length > 0 && onGithubImport && detectedGithubUrls.slice(0, 3).map((gh, i) => (
          <button
            key={gh.fullUrl}
            onClick={() => handleGithubClone(gh.fullUrl)}
            data-testid={`button-clone-repo-${i}`}
            className="text-[9px] text-[hsl(200_70%_60%)] ml-1 flex items-center gap-1 px-2 py-1.5 rounded bg-[hsl(200_70%_60%/0.1)] hover:bg-[hsl(200_70%_60%/0.25)] border border-[hsl(200_70%_60%/0.3)] cursor-pointer transition-colors font-bold"
          >
            <GitBranch className="w-2.5 h-2.5" />
            {gh.owner}/{gh.repo} → Clone
          </button>
        ))}
        {isElectron && onApplyAll && blocks.filter(b => b.filePath && !b.applied).length > 1 && (
          <button
            onClick={() => {
              const applyable = blocks.filter(b => b.filePath && !b.applied);
              onApplyAll(applyable.map(b => ({ filePath: b.filePath, code: b.code })));
            }}
            data-testid="button-apply-all"
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 text-[10px] font-bold transition-colors border border-primary/30"
          >
            <Zap className="w-3 h-3" /> Apply All ({blocks.filter(b => b.filePath && !b.applied).length})
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {blocks.length > 0 && (
            <button onClick={() => { setBlocks([]); setActionItems([]); setDetectedDeps({ dependencies: [], devDependencies: [] }); setDepsInstalled(false); setDepsError(null); setProgramResults(null); }} className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => { setCollapsed(c => { const next = !c; if (!next) setTimeout(() => extractorContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); return next; }); }} className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors">
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Extracted blocks + context */}
      {!collapsed && (
        <div ref={extractorContentRef} className="p-3 space-y-2">
          {showPasteBox && (
            <div className="rounded-lg border border-primary/30 bg-card/50 p-3">
              <p className="text-[10px] text-muted-foreground mb-2">Copy Grok's response, then paste it here (Ctrl+V / Cmd+V):</p>
              <textarea
                ref={pasteRef}
                data-testid="textarea-paste-response"
                placeholder="Paste Grok's full response here..."
                className="w-full h-24 bg-background/80 border border-border/50 rounded p-2 text-[11px] font-mono text-foreground/80 placeholder:text-muted-foreground/30 resize-y focus:outline-none focus:border-primary/50"
                onPaste={handlePaste}
              />
              <button
                data-testid="button-extract-pasted"
                onClick={() => {
                  const text = pasteRef.current?.value || '';
                  if (text.length > 10) extractFromText(text);
                }}
                className="mt-2 flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 text-[10px] font-bold transition-colors border border-primary/30"
              >
                <Zap className="w-3 h-3" /> Extract Code Blocks
              </button>
            </div>
          )}
          {blocks.length === 0 && !showPasteBox && (
            <div className="text-center py-4 text-[10px] text-muted-foreground/50">
              <p>Click <strong>"Paste Response"</strong> above, then paste Grok's reply (Ctrl+V)</p>
              <p className="mt-1 text-[9px] text-muted-foreground/30">{isElectron ? 'Auto-detect also runs in Electron mode' : 'Or use "Read clipboard" if your browser allows it'}</p>
            </div>
          )}

          {responseContext && (
            <div className="rounded-lg border border-border/30 bg-card/30 overflow-hidden">
              <button
                onClick={() => setShowContext(c => !c)}
                data-testid="button-toggle-context"
                className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground hover:bg-card/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3 h-3 text-primary/60" />
                  <span className="font-medium">Full Grok Response</span>
                  <span className="text-[8px] text-muted-foreground/50">
                    {blocks.length} code block{blocks.length !== 1 ? 's' : ''} · {contextSections.length} text section{contextSections.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {showContext ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>
              {showContext && (
                <div className="px-3 py-2 border-t border-border/20 max-h-64 overflow-auto">
                  <div className="text-[10px] text-foreground/70 leading-relaxed whitespace-pre-wrap" data-testid="text-full-response">
                    {responseContext}
                  </div>
                </div>
              )}
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <div className="px-3 py-1.5 flex items-center gap-2 border-b border-amber-500/20">
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[10px] font-bold text-amber-300">Action Required</span>
                <span className="text-[8px] text-amber-400/60">{actionItems.length} step{actionItems.length > 1 ? 's' : ''} — do in order</span>
                {actionItems.some(a => a.type === 'install') && (
                  <button
                    disabled={programsInstalling}
                    onClick={async () => {
                      const progs = actionItems.filter(a => a.type === 'install').map(a => a.command!).filter(Boolean);
                      if (progs.length === 0) return;
                      setProgramsInstalling(true);
                      setProgramResults(null);
                      try {
                        const res = await fetch('/api/programs/install', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ programs: progs }),
                        });
                        const data = await res.json();
                        if (!res.ok && !data.results) {
                          setProgramResults([{ program: 'all', label: 'All', installed: false, alreadyInstalled: false, error: data.error || `HTTP ${res.status}` }]);
                        } else {
                          setProgramResults(data.results || []);
                        }
                      } catch (err: any) {
                        setProgramResults([{ program: 'all', label: 'All', installed: false, alreadyInstalled: false, error: err.message }]);
                      } finally {
                        setProgramsInstalling(false);
                      }
                    }}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 text-[9px] font-bold transition-colors border border-green-500/30 disabled:opacity-50"
                    data-testid="button-download-programs"
                  >
                    {programsInstalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    {programsInstalling ? 'Installing...' : `Download Programs (${actionItems.filter(a => a.type === 'install').length})`}
                  </button>
                )}
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {actionItems.map((item, i) => {
                  const progResult = item.type === 'install' && programResults ? programResults.find(r => r.program === item.command) : null;
                  return (
                    <div key={i} className="flex items-start gap-2 text-[9px]" data-testid={`action-item-${i}`}>
                      <span className="shrink-0 w-4 h-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-bold text-foreground/50 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="shrink-0 mt-0.5">
                        {item.type === 'command' && <Terminal className="w-3 h-3 text-amber-400" />}
                        {item.type === 'install' && <Download className="w-3 h-3 text-green-400" />}
                        {item.type === 'env' && <Key className="w-3 h-3 text-blue-400" />}
                        {item.type === 'create-dir' && <FolderPlus className="w-3 h-3 text-cyan-400" />}
                        {item.type === 'rename' && <ArrowRightLeft className="w-3 h-3 text-purple-400" />}
                        {item.type === 'delete' && <Trash2 className="w-3 h-3 text-red-400" />}
                        {item.type === 'manual' && <AlertCircle className="w-3 h-3 text-amber-400" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-foreground/80">{item.description}</span>
                        {progResult && (
                          <span className={`ml-2 text-[8px] ${progResult.installed || progResult.alreadyInstalled ? 'text-green-400' : 'text-red-400'}`}>
                            {progResult.alreadyInstalled ? '✓ already installed' : progResult.installed ? '✓ installed' : `✗ ${progResult.error || 'failed'}`}
                          </span>
                        )}
                        {item.command && !progResult && (
                          <>
                            {activeProject && item.type === 'command' && (
                              <button
                                disabled={runningCommands.has(i)}
                                onClick={async () => {
                                  setRunningCommands(prev => new Set(prev).add(i));
                                  setCommandResults(prev => { const m = new Map(prev); m.delete(i); return m; });
                                  try {
                                    const res = await fetch('/api/projects/run-command', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ name: activeProject, command: item.command }),
                                    });
                                    const result = await res.json();
                                    setCommandResults(prev => new Map(prev).set(i, result));
                                  } catch (err: any) {
                                    setCommandResults(prev => new Map(prev).set(i, { success: false, error: err.message }));
                                  } finally {
                                    setRunningCommands(prev => { const s = new Set(prev); s.delete(i); return s; });
                                  }
                                }}
                                className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 text-[8px] font-bold transition-colors border border-green-500/30 disabled:opacity-50"
                                data-testid={`button-run-action-${i}`}
                              >
                                {runningCommands.has(i) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                                {runningCommands.has(i) ? 'Running...' : 'Run'}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.command!);
                              }}
                              className="ml-1 text-[8px] text-primary/60 hover:text-primary underline cursor-pointer"
                              data-testid={`button-copy-action-${i}`}
                            >
                              copy
                            </button>
                            {commandResults.has(i) && (
                              <span className={`ml-1 text-[8px] ${commandResults.get(i)!.success ? 'text-green-400' : 'text-red-400'}`}>
                                {commandResults.get(i)!.success ? '✓ done' : `✗ ${commandResults.get(i)!.error?.slice(0, 80) || 'failed'}`}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {blocks.map(block => (
            <div key={block.id} className={`rounded-lg border overflow-hidden transition-colors ${block.applied ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-card/50'}`}>
              <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border/20">
                <div className="flex items-center gap-2 min-w-0">
                  <Code2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-foreground/80 font-mono truncate">
                    {block.filePath || `${block.language} block`}
                  </span>
                  <span className="text-[8px] text-muted-foreground/50 shrink-0">{block.code.split('\n').length} lines</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!block.applied && (
                    <>
                      <button onClick={() => validate(block)} data-testid={`button-check-${block.id}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[9px] transition-colors">
                        <Shield className="w-2.5 h-2.5" /> Check
                      </button>
                      {block.filePath && (
                        <button onClick={() => apply(block)} data-testid={`button-apply-${block.id}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary/30 text-[9px] font-medium transition-colors">
                          <Zap className="w-2.5 h-2.5" /> Apply
                        </button>
                      )}
                    </>
                  )}
                  {block.applied && (
                    <span className="flex items-center gap-1 text-[9px] text-primary font-medium">
                      <Check className="w-2.5 h-2.5" /> Applied
                    </span>
                  )}
                </div>
              </div>
              <pre className="px-3 py-2 text-[9px] font-mono text-foreground/60 max-h-28 overflow-auto leading-relaxed whitespace-pre-wrap">
                {block.code.slice(0, 600)}{block.code.length > 600 ? '\n...' : ''}
              </pre>
              {block.validationResult && (
                <div className="px-3 py-1 border-t border-border/20 space-y-0.5">
                  {block.validationResult.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[8px]">
                      {c.severity === 'error' ? <AlertTriangle className="w-2.5 h-2.5 text-destructive" /> : <Check className="w-2.5 h-2.5 text-primary" />}
                      <span className={c.severity === 'error' ? 'text-destructive' : 'text-primary/70'}>{c.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Apply Confirmation Dialog ───────────────────────────────────────────────

function simpleDiff(oldText: string, newText: string): { type: 'same' | 'add' | 'remove'; line: string }[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'same' | 'add' | 'remove'; line: string }[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0, ni = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      result.push({ type: 'same', line: oldLines[oi] });
      oi++; ni++;
    } else if (oi < oldLines.length && (ni >= newLines.length || !newLines.slice(ni).includes(oldLines[oi]))) {
      result.push({ type: 'remove', line: oldLines[oi] });
      oi++;
    } else {
      result.push({ type: 'add', line: newLines[ni] });
      ni++;
    }
    if (result.length > 200) {
      result.push({ type: 'same', line: `... (${maxLen - 200} more lines)` });
      break;
    }
  }
  return result;
}

function ApplyConfirmDialog({
  pending,
  stage,
  stageMessage,
  compileError,
  onConfirm,
  onCancel,
  onRollback,
}: {
  pending: PendingApply;
  stage: ApplyStage;
  stageMessage: string;
  compileError: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRollback: () => void;
}) {
  const diff = useMemo(() => simpleDiff(pending.oldContent, pending.newContent), [pending.oldContent, pending.newContent]);
  const hasErrors = pending.safetyChecks.some(c => c.severity === 'error');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="dialog-apply-confirm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{pending.exists ? 'Modify' : 'Create'} File</span>
            <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">{pending.filePath}</span>
            {stageMessage && stage === 'confirm' && (
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{stageMessage}</span>
            )}
          </div>
          {stage === 'confirm' && (
            <button onClick={onCancel} data-testid="button-cancel-apply" className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {pending.safetyChecks.length > 0 && (
          <div className="px-4 py-2 border-b border-border/50 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Safety Checks</span>
            {pending.safetyChecks.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                {c.severity === 'error' ? <AlertTriangle className="w-3 h-3 text-destructive" /> : <Check className="w-3 h-3 text-primary" />}
                <span className={c.severity === 'error' ? 'text-destructive' : 'text-primary/70'}>{c.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto px-4 py-2 min-h-0">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <span>{pending.exists ? 'Changes' : 'New File Content'}</span>
            {pending.exists && (
              <span className="font-normal text-muted-foreground/60">
                {pending.oldContent.split('\n').length} lines → {pending.newContent.split('\n').length} lines
              </span>
            )}
            {!pending.exists && <span className="font-normal text-muted-foreground/60">{pending.newContent.split('\n').length} lines</span>}
          </div>
          <div className="rounded border border-border/50 bg-card/30 overflow-auto max-h-64">
            <pre className="text-[9px] font-mono leading-relaxed p-2">
              {diff.slice(0, 150).map((d, i) => (
                <div
                  key={i}
                  className={
                    d.type === 'add' ? 'bg-green-500/15 text-green-400' :
                    d.type === 'remove' ? 'bg-red-500/15 text-red-400 line-through' :
                    'text-foreground/50'
                  }
                >
                  {d.type === 'add' ? '+ ' : d.type === 'remove' ? '- ' : '  '}{d.line}
                </div>
              ))}
            </pre>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px]">
            {stage === 'writing' && <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-primary">Writing file...</span></>}
            {stage === 'checking' && <><Loader2 className="w-3 h-3 animate-spin text-yellow-500" /><span className="text-yellow-500">Checking for errors...</span></>}
            {stage === 'committing' && <><Loader2 className="w-3 h-3 animate-spin text-blue-400" /><span className="text-blue-400">Git commit...</span></>}
            {stage === 'done' && <><Check className="w-3 h-3 text-primary" /><span className="text-primary">{stageMessage}</span></>}
            {stage === 'error' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-destructive" /><span className="text-destructive">{stageMessage}</span></div>
                {compileError && <pre className="text-[8px] text-destructive/70 max-h-20 overflow-auto whitespace-pre-wrap">{compileError}</pre>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stage === 'confirm' && (
              <>
                <button onClick={onCancel} data-testid="button-cancel" className="px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Cancel</button>
                <button
                  onClick={onConfirm}
                  data-testid="button-confirm-apply"
                  disabled={hasErrors}
                  className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" /> Write to Disk
                </button>
              </>
            )}
            {stage === 'error' && (
              <>
                <button onClick={onRollback} data-testid="button-rollback" className="px-3 py-1.5 rounded text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors flex items-center gap-1">
                  <Undo2 className="w-3 h-3" /> Rollback
                </button>
                <button onClick={onCancel} data-testid="button-dismiss-error" className="px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Dismiss</button>
              </>
            )}
            {stage === 'done' && (
              <button onClick={onCancel} data-testid="button-done" className="px-3 py-1.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grok Desktop Browser (Electron embedded webview) ────────────────────────

interface GrokDesktopBrowserProps {
  browserUrl: string;
  setBrowserUrl: (url: string) => void;
  customUrl: string;
  setCustomUrl: (url: string) => void;
}

function GrokDesktopBrowser({ browserUrl, setBrowserUrl, customUrl, setCustomUrl }: GrokDesktopBrowserProps) {
  const webviewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const initialUrlRef = useRef(browserUrl);
  const currentUrlRef = useRef(browserUrl);

  const navigateTo = useCallback((url: string) => {
    if (isElectron) {
      const wv = webviewRef.current;
      if (wv && typeof wv.loadURL === 'function') {
        wv.loadURL(url);
      }
      currentUrlRef.current = url;
      setBrowserUrl(url);
      setLoading(true);
    } else {
      window.open(url, '_blank');
    }
  }, [setBrowserUrl]);

  const openCustom = useCallback(() => {
    if (!customUrl.trim()) return;
    const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
    navigateTo(url);
    setCustomUrl('');
  }, [customUrl, setCustomUrl, navigateTo]);

  useEffect(() => {
    if (!isElectron) return;
    const wv = webviewRef.current;
    if (!wv) return;

    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    const onLoading = () => {
      setLoading(true);
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        console.warn('[webview] Loading timeout — hiding overlay');
        setLoading(false);
      }, 5000);
    };
    const onLoaded = () => {
      if (loadTimer) clearTimeout(loadTimer);
      setLoading(false);
    };
    const onNavigation = (e: any) => {
      if (e.url && e.url !== currentUrlRef.current) {
        currentUrlRef.current = e.url;
        setBrowserUrl(e.url);
      }
    };
    const onFailLoad = (e: any) => {
      if (e.errorCode !== -3) {
        console.error('[webview] did-fail-load:', e.errorCode, e.errorDescription, e.validatedURL);
      }
      setLoading(false);
    };
    const onDomReady = () => {
      if (loadTimer) clearTimeout(loadTimer);
      setLoading(false);
    };

    wv.addEventListener('did-start-loading', onLoading);
    wv.addEventListener('did-stop-loading', onLoaded);
    wv.addEventListener('did-navigate', onNavigation);
    wv.addEventListener('did-fail-load', onFailLoad);
    wv.addEventListener('dom-ready', onDomReady);

    return () => {
      if (loadTimer) clearTimeout(loadTimer);
      wv.removeEventListener('did-start-loading', onLoading);
      wv.removeEventListener('did-stop-loading', onLoaded);
      wv.removeEventListener('did-navigate', onNavigation);
      wv.removeEventListener('did-fail-load', onFailLoad);
      wv.removeEventListener('dom-ready', onDomReady);
    };
  }, [setBrowserUrl]);

  const currentSite = BROWSER_SITES.find(s => browserUrl.startsWith(s.url));

  if (!isElectron) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="shrink-0 border-b border-border/30 bg-card/40 px-3 py-2 flex items-center gap-2">
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {BROWSER_SITES.map(site => (
              <button
                key={site.id}
                data-testid={`button-open-${site.id}`}
                onClick={() => window.open(site.url, '_blank')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent"
              >
                <span>{site.icon}</span>
                <span>{site.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Globe className="w-3 h-3 text-muted-foreground/50" />
            <input
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customUrl.trim()) { const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`; window.open(url, '_blank'); setCustomUrl(''); } }}
              placeholder="Custom URL..."
              data-testid="input-custom-url-web"
              className="w-36 bg-background border border-border/50 rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
            />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-3 max-w-lg">
              <Globe className="w-10 h-10 text-primary/60 mx-auto" />
              <h2 className="text-base font-bold text-foreground" data-testid="text-browser-status">Web Mode</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Running in web mode. Sites open in new browser tabs. For the full embedded browser experience, run the desktop app with <code className="text-primary/80">npm run electron:dev</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-border/30 bg-card/40 px-3 py-2 flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {BROWSER_SITES.map(site => (
            <button
              key={site.id}
              data-testid={`button-open-${site.id}`}
              onClick={() => navigateTo(site.url)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                browserUrl.startsWith(site.url)
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent'
              }`}
            >
              <span>{site.icon}</span>
              <span>{site.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {loading && <Loader2 className="w-3 h-3 text-primary/60 animate-spin" />}
          <Globe className="w-3 h-3 text-muted-foreground/50" />
          <input
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') openCustom(); }}
            placeholder="Custom URL..."
            data-testid="input-custom-url"
            className="w-36 bg-background border border-border/50 rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* @ts-ignore - webview is an Electron-specific HTML element */}
        <webview
          ref={(el: any) => { webviewRef.current = el; }}
          src={initialUrlRef.current}
          partition="persist:browser"
          data-testid="webview-browser"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allowpopups="true"
        />
        {loading && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center py-2 z-10 pointer-events-none">
            <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-border/30">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Loading {currentSite?.name || 'page'}...</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const GrokBridge: React.FC = () => {
  const [mode, setMode] = useState<Mode>('browser');
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('grok-3-mini');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(() => localStorage.getItem('guardian-auto-apply') === 'true');
  const autoApplyBackupsRef = useRef<{ filePath: string; oldContent: string; newContent: string }[]>([]);
  const [autoApplyUndoVisible, setAutoApplyUndoVisible] = useState(false);
  const autoApplyUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [validationResults, setValidationResults] = useState<Map<string, SafetyCheck[]>>(new Map());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [browserUrl, setBrowserUrl] = useState('https://grok.com');
  const [customUrl, setCustomUrl] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [activeProject, setActiveProjectState] = useState<string | null>(() => getActiveProject());
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null);
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewEmbed, setShowPreviewEmbed] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const autoStartPreviewRef = useRef<string | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionState, setEvolutionState] = useState<EvolutionState | null>(null);
  const [currentPlan, setCurrentPlan] = useState<EvolutionPlan | null>(loadEvolutionPlan());
  const [isEvolutionResponse, setIsEvolutionResponse] = useState(false);
  const lastFullResponseRef = useRef<string>('');
  const [toasterAvailability, setToasterAvailability] = useState<ToasterAvailability | null>(null);
  const [toasterConfig, setToasterConfig] = useState<OllamaToasterConfig>(() => loadToasterConfig());
  const [lastToasterAnalysis, setLastToasterAnalysis] = useState<ToasterAnalysis | null>(null);
  const [toasterLoading, setToasterLoading] = useState(false);
  const [previewLogs, setPreviewLogs] = useState<LogEntry[]>([]);
  const [githubImportProgress, setGithubImportProgress] = useState<GitHubImportProgress | null>(null);
  const [detectedRepoUrl, setDetectedRepoUrl] = useState<string | null>(null);
  const [showDiagnoseBanner, setShowDiagnoseBanner] = useState(false);
  const [diagnoseFixCycleCount, setDiagnoseFixCycleCount] = useState(0);
  const [diagnoseStuck, setDiagnoseStuck] = useState(false);
  const [postApplyMonitoring, setPostApplyMonitoring] = useState(false);
  const [publishProgress, setPublishProgress] = useState<PublishProgress | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishDescription, setPublishDescription] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSharedPat, setSettingsSharedPat] = useState(() => getGuardianConfig().sharedPat);
  const [settingsUserPat, setSettingsUserPat] = useState(() => getGuardianConfig().userPat || '');
  const [settingsOllamaEndpoint, setSettingsOllamaEndpoint] = useState(() => loadToasterConfig().endpoint);
  const [settingsOllamaModel, setSettingsOllamaModel] = useState(() => loadToasterConfig().model);
  const [knowledgeMatches, setKnowledgeMatches] = useState<KnowledgeMatch[]>([]);
  const lastAppliedFilesRef = useRef<{ filePath: string; code: string }[]>([]);
  const preApplyErrorCountRef = useRef(0);
  const postApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cleanedApiBlocks, setCleanedApiBlocks] = useState<Map<number, ParsedBlock[]>>(new Map());
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [quickActionsLoading, setQuickActionsLoading] = useState(false);
  const validationContextRef = useRef<ValidationContext>({});

  const refreshValidationContext = useCallback(async () => {
    if (!activeProject) { validationContextRef.current = {}; return; }
    try {
      const tree = await getProjectFiles(activeProject);
      const flatPaths: string[] = [];
      const collectPaths = (nodes: ProjectFileNode[], prefix = '') => {
        for (const n of nodes) {
          const p = prefix ? `${prefix}/${n.name}` : n.name;
          if (n.type === 'file') flatPaths.push(p);
          if (n.children) collectPaths(n.children, p);
        }
      };
      collectPaths(tree);
      validationContextRef.current.projectFiles = flatPaths;

      try {
        const pkgContent = await readProjectFile(activeProject, 'package.json');
        validationContextRef.current.packageJson = JSON.parse(pkgContent);
      } catch {
        validationContextRef.current.packageJson = undefined;
      }
    } catch {
      validationContextRef.current = {};
    }
  }, [activeProject]);

  useEffect(() => { refreshValidationContext(); }, [activeProject, refreshValidationContext]);

  const addPreviewLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setPreviewLogs(prev => {
      const newEntry: LogEntry = { ...entry, id: crypto.randomUUID() };
      const updated = [...prev, newEntry];
      if (updated.length > MAX_LOG_ENTRIES) {
        return updated.slice(updated.length - MAX_LOG_ENTRIES);
      }
      return updated;
    });
  }, []);

  const clearPreviewLogs = useCallback(() => {
    setPreviewLogs([]);
  }, []);

  const startPostApplyMonitoring = useCallback((appliedFiles: { filePath: string; code: string }[]) => {
    if (postApplyTimerRef.current) clearTimeout(postApplyTimerRef.current);
    lastAppliedFilesRef.current = appliedFiles;
    preApplyErrorCountRef.current = previewLogs.filter(l => l.level === 'error').length;
    setPostApplyMonitoring(true);
    setShowDiagnoseBanner(false);
    postApplyTimerRef.current = setTimeout(() => {
      setPostApplyMonitoring(false);
    }, 5000);
  }, [previewLogs]);

  useEffect(() => {
    if (!postApplyMonitoring) return;
    const currentErrorCount = previewLogs.filter(l => l.level === 'error').length;
    if (currentErrorCount > preApplyErrorCountRef.current) {
      if (postApplyTimerRef.current) clearTimeout(postApplyTimerRef.current);
      setPostApplyMonitoring(false);
      if (diagnoseFixCycleCount >= 3) {
        setDiagnoseStuck(true);
        setShowDiagnoseBanner(true);
      } else {
        setShowDiagnoseBanner(true);
        setDiagnoseStuck(false);
      }
    }
  }, [previewLogs, postApplyMonitoring, diagnoseFixCycleCount]);

  useEffect(() => {
    return () => {
      if (postApplyTimerRef.current) clearTimeout(postApplyTimerRef.current);
    };
  }, []);

  const buildDiagnoseFixPrompt = useCallback(async () => {
    const errorLogs = previewLogs.filter(l => l.level === 'error' || l.level === 'warn');
    const relevantLogs = errorLogs.length > 0 ? errorLogs.slice(-20) : previewLogs.slice(-20);

    let prompt = `The app preview just failed after applying changes. Here are the exact console/build logs:\n\n`;
    prompt += `=== CONSOLE LOGS (${relevantLogs.length} entries, errors/warnings prioritized) ===\n`;
    for (const log of relevantLogs) {
      const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      prompt += `[${time}] [${log.level.toUpperCase()}] ${log.message}\n`;
      if (log.stack) {
        prompt += `  Stack: ${log.stack.split('\n').slice(0, 5).join('\n  ')}\n`;
      }
      if (log.source) {
        prompt += `  Source: ${log.source}${log.line ? `:${log.line}` : ''}${log.column ? `:${log.column}` : ''}\n`;
      }
    }
    prompt += `=== END LOGS ===\n\n`;

    const appliedFiles = lastAppliedFilesRef.current;
    if (appliedFiles.length > 0) {
      prompt += `Current files that were changed:\n\n`;
      for (const file of appliedFiles) {
        if (activeProject) {
          try {
            const content = await readProjectFile(activeProject, file.filePath);
            if (content.length < 8000) {
              prompt += `=== ${file.filePath} ===\n${content}\n\n`;
            } else {
              prompt += `=== ${file.filePath} (truncated) ===\n${content.slice(0, 8000)}\n...(truncated)\n\n`;
            }
          } catch {
            prompt += `=== ${file.filePath} (applied content) ===\n${file.code.slice(0, 8000)}\n\n`;
          }
        } else {
          prompt += `=== ${file.filePath} (applied content) ===\n${file.code.slice(0, 8000)}\n\n`;
        }
      }
    }

    const lastResponse = lastFullResponseRef.current;
    if (lastResponse) {
      const snippet = lastResponse.slice(0, 2000);
      prompt += `Previous suggestion from you was:\n${snippet}${lastResponse.length > 2000 ? '\n...(truncated)' : ''}\n\n`;
    }

    prompt += `Fix the issue and provide updated code blocks for affected files only.\n`;
    prompt += `Use this format for each file:\n`;
    prompt += `// file: path/to/file.tsx\n\`\`\`tsx\n// corrected content\n\`\`\`\n`;

    return prompt;
  }, [previewLogs, activeProject]);

  const handleDiagnoseFix = useCallback(async () => {
    if (diagnoseStuck) return;
    const prompt = await buildDiagnoseFixPrompt();
    setDiagnoseFixCycleCount(prev => prev + 1);

    if (mode === 'api' && inputRef.current) {
      setInput(prompt);
      setShowDiagnoseBanner(false);
      return;
    }

    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(prompt);
      } else {
        await navigator.clipboard.writeText(prompt);
      }
      setStatusMessage('Diagnostic prompt copied to clipboard — paste into Grok');
      setShowDiagnoseBanner(false);
    } catch {
      setStatusMessage('Could not copy diagnostic prompt');
    }
  }, [diagnoseStuck, buildDiagnoseFixPrompt, mode]);

  const dismissDiagnoseBanner = useCallback(() => {
    setShowDiagnoseBanner(false);
    setDiagnoseStuck(false);
    setDiagnoseFixCycleCount(0);
  }, []);

  const handleSendLogsToGrok = useCallback(async (formattedPrompt: string) => {
    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(formattedPrompt);
      } else {
        await navigator.clipboard.writeText(formattedPrompt);
      }
      setStatusMessage('Diagnostic logs copied to clipboard — paste into Grok');
    } catch {
      setStatusMessage('Could not copy logs to clipboard');
    }
  }, []);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'guardian-console-bridge') return;
      const { level, args, stack, source, line, column } = event.data;
      const validLevels = ['error', 'warn', 'log', 'info'];
      const logLevel = validLevels.includes(level) ? level : 'log';
      const message = Array.isArray(args)
        ? args.map((a: any) => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
        : String(args || '');
      addPreviewLog({
        level: logLevel,
        message,
        timestamp: Date.now(),
        stack: stack || undefined,
        source: source || undefined,
        line: line || undefined,
        column: column || undefined,
      });
    };
    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [addPreviewLog]);

  useEffect(() => {
    checkToasterAvailability(toasterConfig).then(setToasterAvailability);
  }, [toasterConfig]);

  useEffect(() => {
    const poll = setInterval(async () => {
      clearAvailabilityCache();
      const result = await checkToasterAvailability(toasterConfig);
      setToasterAvailability(prev => {
        if (prev && prev.available !== result.available) {
          setStatusMessage(result.available
            ? `Toaster reconnected — ${result.models.slice(0, 2).join(', ')}`
            : `Toaster disconnected${result.error ? ': ' + result.error : ''}`
          );
        }
        return result;
      });
    }, 60_000);
    return () => clearInterval(poll);
  }, [toasterConfig]);

  useEffect(() => {
    startKnowledgeRefreshLoop();
    return () => stopKnowledgeRefreshLoop();
  }, []);

  const handleEvolutionApply = useCallback(async (fullResponse: string, appliedFiles: string[]) => {
    if (!isEvolutionResponse || appliedFiles.length === 0) return;
    try {
      const state = evolutionState || await fetchEvolutionState();
      const result = await registerEvolutionResults(appliedFiles, fullResponse, state);
      setCurrentPlan(loadEvolutionPlan());
      const parts: string[] = [];
      if (result.capabilitiesRegistered.length > 0) parts.push(`${result.capabilitiesRegistered.length} capabilities registered`);
      if (result.planSaved) parts.push('next evolution plan saved');
      parts.push(`L${result.newLevel}`);
      setStatusMessage(`⚡ Evolution updated: ${parts.join(' · ')}`);
      const updatedState = await fetchEvolutionState();
      setEvolutionState(updatedState);
    } catch (e: any) {
      setStatusMessage(`⚠ Evolution tracking error: ${e.message}`);
    }
  }, [isEvolutionResponse, evolutionState]);

  const handleSelectProject = useCallback(async (name: string | null) => {
    if (activeProject && activeProject !== name && previewPort) {
      try {
        await fetch('/api/projects/stop-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: activeProject }),
        });
      } catch {}
    }
    setActiveProjectState(name);
    persistActiveProject(name);
    setAppliedChanges([]);
    setPreviewPort(null);
    setShowPreviewEmbed(false);
    setProjectContext('');
    setPreviewLogs([]);
    setEditorFile(null);
    setStatusMessage(name ? `Project: ${name}` : 'Switched to Main App');
    if (name) {
      autoStartPreviewRef.current = name;
    }
  }, [activeProject, previewPort]);

  useEffect(() => {
    (window as any).__guardianSelectProject = handleSelectProject;
    return () => { delete (window as any).__guardianSelectProject; };
  }, [handleSelectProject]);

  const handleFileEdit = useCallback(async (filePath: string, content: string) => {
    setEditorFile({ path: filePath, content });
    setShowProjectPanel(true);
  }, []);

  const handleEditorSave = useCallback(async (filePath: string, content: string) => {
    if (activeProject) {
      await writeProjectFile(activeProject, filePath, content);
      const isConfigFile = ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs'].includes(filePath);
      if (previewPort) {
        setTimeout(() => setPreviewKey(k => k + 1), isConfigFile ? 2500 : 500);
      }
      setStatusMessage(`Saved ${filePath}`);
      await buildProjectContext();
    } else if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      await ipcRenderer.invoke('write-file', { filePath, content });
      setStatusMessage(`Saved ${filePath}`);
    }
  }, [activeProject, previewPort]);

  const handleEditorClose = useCallback(() => {
    setEditorFile(null);
  }, []);

  const handleEditorSendToGrok = useCallback((prompt: string) => {
    if (mode === 'api') {
      setInput(prompt);
      inputRef.current?.focus();
    } else {
      navigator.clipboard.writeText(prompt).then(() => {
        setStatusMessage('File prompt copied to clipboard — paste into Grok');
      }).catch(() => {
        setStatusMessage('Could not copy file prompt to clipboard');
      });
    }
  }, [mode]);

  const handleGitHubImport = useCallback(async (repoUrl: string) => {
    setDetectedRepoUrl(null);
    setGithubImportProgress({ stage: 'fetching-tree', message: 'Cloning repository...' });
    try {
      const result = await importFromGitHub(repoUrl, (progress) => {
        setGithubImportProgress(progress);
      });
      setGithubImportProgress({
        stage: 'done',
        message: `Imported ${result.projectName} — switching to project`,
        repoName: result.projectName,
      });
      handleSelectProject(result.projectName);
      setTimeout(() => setGithubImportProgress(null), 4000);
    } catch (e: any) {
      setGithubImportProgress({ stage: 'error', message: e.message || 'Import failed' });
      setTimeout(() => setGithubImportProgress(null), 6000);
    }
  }, [handleSelectProject]);

  const handlePublish = useCallback(async () => {
    if (!activeProject || !publishDescription.trim()) return;
    const cfg = getGuardianConfig();
    if (!hasPublishCredentials(cfg)) {
      setStatusMessage('No GitHub PAT configured. Add one in Settings first.');
      return;
    }
    setPublishedUrl(null);
    try {
      const result = await publishProject(activeProject, publishDescription.trim(), (progress) => {
        setPublishProgress(progress);
      }, undefined, cfg);
      setPublishedUrl(result.repoUrl);
      setStatusMessage(`Published ${activeProject} to ${result.repoUrl} (${result.filesPublished} files)`);
      setShowPublishDialog(false);
      setTimeout(() => { setPublishProgress(null); setPublishedUrl(null); }, 8000);
    } catch (e: any) {
      setPublishProgress({ stage: 'error', message: e.message || 'Publish failed' });
      setTimeout(() => setPublishProgress(null), 8000);
    }
  }, [activeProject, publishDescription]);

  const startPreview = useCallback(async () => {
    if (!activeProject) return;
    setPreviewLoading(true);
    try {
      if (isElectron) {
        try {
          const { ipcRenderer } = (window as any).require('electron');
          await ipcRenderer.invoke('ensure-project-polling', { projectName: activeProject });
        } catch {}
      }
      const res = await fetch('/api/projects/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeProject }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewPort(data.port);
        setShowPreviewEmbed(true);
        setPreviewKey(k => k + 1);
        setStatusMessage(`Preview started on port ${data.port}`);
      } else {
        const errData = await res.json().catch(() => ({} as any));
        setStatusMessage(`Failed to start preview: ${errData.error || res.statusText}`);
      }
    } catch (e: any) {
      setStatusMessage(`Preview error: ${e.message}`);
    }
    setPreviewLoading(false);
  }, [activeProject]);

  const stopPreview = useCallback(async () => {
    if (!activeProject) return;
    try {
      await fetch('/api/projects/stop-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeProject }),
      });
    } catch {}
    setPreviewPort(null);
    setShowPreviewEmbed(false);
  }, [activeProject]);

  useEffect(() => {
    if (autoStartPreviewRef.current && activeProject === autoStartPreviewRef.current) {
      const projectToStart = autoStartPreviewRef.current;
      autoStartPreviewRef.current = null;
      startPreview();
    }
  }, [activeProject, startPreview]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { saveConversations(conversations); }, [conversations]);

  const newConversation = useCallback(() => {
    const convo: Conversation = { id: crypto.randomUUID(), title: 'New conversation', messages: [], model, createdAt: Date.now() };
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(convo.id);
    setMessages([]);
    setAppliedChanges([]);
    setValidationResults(new Map());
  }, [model]);

  const switchConversation = useCallback((id: string) => {
    if (activeConvoId && messages.length > 0) {
      setConversations(prev => prev.map(c => c.id === activeConvoId ? { ...c, messages, title: generateTitle(messages) } : c));
    }
    const convo = conversations.find(c => c.id === id);
    if (convo) { setActiveConvoId(id); setMessages(convo.messages); setModel(convo.model); setAppliedChanges([]); }
  }, [activeConvoId, messages, conversations]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) { setActiveConvoId(null); setMessages([]); }
  }, [activeConvoId]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const matches = searchKnowledge(text);
    setKnowledgeMatches(matches);

    let enrichedText = text;
    if (messages.length === 0) {
      if (matches.length > 0) {
        enrichedText = text + '\n\n' + formatKnowledgeForGrokPrompt(matches);
      } else if (!activeProject) {
        enrichedText = text + '\n\n=== REPO SELECTION ===\nFor this new project, prioritize: 1) A popular public GitHub repo (React/TS/Vite/Tailwind, high stars, MIT license) as a starting point — provide the full URL. 2) Start fresh only if no existing repo fits.\n=== END REPO SELECTION ===';
      }
    }

    const userMsg: Msg = { role: 'user', content: enrichedText };
    setInput('');
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    let convoId = activeConvoId;
    if (!convoId) {
      convoId = crypto.randomUUID();
      const convo: Conversation = { id: convoId, title: text.slice(0, 50), messages: [], model, createdAt: Date.now() };
      setConversations(prev => [convo, ...prev]);
      setActiveConvoId(convoId);
    }
    let assistantSoFar = '';
    await streamGrok({
      messages: allMessages, model,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      },
      onDone: () => {
        setIsLoading(false);
        const msgIndex = allMessages.length;
        setConversations(prev => prev.map(c => c.id === convoId ? { ...c, messages: [...allMessages, { role: 'assistant' as const, content: assistantSoFar }], title: generateTitle(allMessages), model } : c));
        lastFullResponseRef.current = assistantSoFar;
        const repoMatch = detectGitHubUrlInResponse(assistantSoFar);
        if (repoMatch && !assistantSoFar.toLowerCase().includes('starting fresh')) {
          setDetectedRepoUrl(repoMatch.fullUrl);
          setStatusMessage(`Grok suggested repo: ${repoMatch.owner}/${repoMatch.repo} — click to clone`);
          if (autoApplyEnabled && activeProject) {
            getProjectFiles(activeProject).then(tree => {
              const flatFiles: string[] = [];
              const walk = (nodes: ProjectFileNode[], prefix = '') => {
                for (const n of nodes) {
                  const p = prefix ? `${prefix}/${n.name}` : n.name;
                  if (n.type === 'file') flatFiles.push(p);
                  if (n.children) walk(n.children, p);
                }
              };
              walk(tree);
              const sourceFiles = flatFiles.filter(f => !['package.json', 'package-lock.json'].includes(f));
              if (sourceFiles.length === 0) {
                setStatusMessage(`Auto-cloning ${repoMatch.owner}/${repoMatch.repo}...`);
                handleGitHubImport(repoMatch.fullUrl);
              }
            }).catch(() => {});
          }
        }
        const regexBlocks = parseCodeBlocks(assistantSoFar);
        if (autoApplyEnabled && activeProject && regexBlocks.length > 0) {
          const validBlocks = regexBlocks.filter(b => b.filePath);
          if (validBlocks.length > 0) {
            autoApplyBlocks(validBlocks).then(applied => {
              if (!applied) setStatusMessage('Auto-apply skipped (safety checks failed) — review manually');
            }).catch(() => {});
          }
        }

        cleanGrokResponse(assistantSoFar, toasterConfig).then(cleaned => {
          if (cleaned && cleaned.files.length > 0) {
            const ollamaBlocks = cleanedResponseToBlocks(cleaned);
            if (ollamaBlocks.length > 0) {
              const hasMorePaths = ollamaBlocks.filter(b => b.filePath).length >= regexBlocks.filter(b => b.filePath).length;
              if (hasMorePaths) {
                setCleanedApiBlocks(prev => new Map(prev).set(msgIndex, ollamaBlocks));
              }
            }
          }
        }).catch(() => {});
      },
      onError: (err) => { setIsLoading(false); setStatusMessage(`⚠ ${err}`); },
    });
  }, [input, isLoading, messages, model, activeConvoId, toasterConfig]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const runValidation = useCallback((blockKey: string, code: string, filePath: string) => {
    const checks = validateChange(code, filePath || 'unknown.ts', undefined, validationContextRef.current);
    setValidationResults(prev => new Map(prev).set(blockKey, checks));
  }, []);

  const toggleAutoApply = useCallback((val: boolean) => {
    setAutoApplyEnabled(val);
    localStorage.setItem('guardian-auto-apply', val ? 'true' : 'false');
  }, []);

  const undoAutoApply = useCallback(async () => {
    if (autoApplyUndoTimerRef.current) { clearTimeout(autoApplyUndoTimerRef.current); autoApplyUndoTimerRef.current = null; }
    setAutoApplyUndoVisible(false);
    const backups = autoApplyBackupsRef.current;
    if (backups.length === 0) return;
    try {
      for (const b of backups) {
        if (activeProject) {
          await writeProjectFile(activeProject, b.filePath, b.oldContent);
        } else if (isElectron) {
          const { ipcRenderer } = (window as any).require('electron');
          await ipcRenderer.invoke('write-file', { filePath: b.filePath, content: b.oldContent });
        }
      }
      setStatusMessage(`Undid auto-apply of ${backups.length} file${backups.length > 1 ? 's' : ''}`);
      autoApplyBackupsRef.current = [];
      if (previewPort) setTimeout(() => setPreviewKey(k => k + 1), 500);
    } catch (e: any) {
      setStatusMessage(`Undo failed: ${e.message}`);
    }
  }, [activeProject, previewPort]);

  const autoApplyBlocks = useCallback(async (blocks: { filePath: string; code: string }[]) => {
    if (!activeProject || blocks.length === 0) return false;
    const backups: { filePath: string; oldContent: string; newContent: string }[] = [];
    const warnings: string[] = [];
    let hasErrors = false;

    for (const block of blocks) {
      let oldContent = '';
      try { oldContent = await readProjectFile(activeProject, block.filePath); } catch { oldContent = ''; }
      const checks = validateChange(block.code, block.filePath, oldContent, validationContextRef.current);
      const errors = checks.filter(c => c.severity === 'error');
      const warns = checks.filter(c => c.severity === 'warning');
      if (errors.length > 0) { hasErrors = true; break; }
      if (warns.length > 0) warnings.push(...warns.map(w => `${block.filePath}: ${w.message}`));
      const lineChanges = Math.abs(block.code.split('\n').length - oldContent.split('\n').length);
      if (lineChanges > 50) { hasErrors = true; break; }
      backups.push({ filePath: block.filePath, oldContent, newContent: block.code });
    }

    if (hasErrors) return false;

    try {
      for (const b of backups) {
        await writeProjectFile(activeProject, b.filePath, b.newContent);
      }
      autoApplyBackupsRef.current = backups;
      setAppliedChanges(prev => [...prev, ...backups.map(b => ({ filePath: `${activeProject}/${b.filePath}`, previousContent: b.oldContent, newContent: b.newContent, timestamp: Date.now() }))]);

      const warningText = warnings.length > 0 ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : '';
      setStatusMessage(`Auto-applied ${backups.length} file${backups.length > 1 ? 's' : ''}${warningText} — Undo available for 5s`);
      setAutoApplyUndoVisible(true);
      if (autoApplyUndoTimerRef.current) clearTimeout(autoApplyUndoTimerRef.current);
      autoApplyUndoTimerRef.current = setTimeout(() => { setAutoApplyUndoVisible(false); autoApplyBackupsRef.current = []; }, 5000);

      const hasConfigChanges = backups.some(b => ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs'].includes(b.filePath));
      if (previewPort) setTimeout(() => setPreviewKey(k => k + 1), hasConfigChanges ? 2500 : 500);
      await buildProjectContext();
      refreshValidationContext();
      refreshQuickActions();
      return true;
    } catch (e: any) {
      setStatusMessage(`Auto-apply failed: ${e.message}`);
      return false;
    }
  }, [activeProject, previewPort]);

  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);
  const [applyStage, setApplyStage] = useState<ApplyStage>('confirm');
  const [applyStageMessage, setApplyStageMessage] = useState('');
  const [applyCompileError, setApplyCompileError] = useState('');
  const lastBackupPathRef = useRef('');

  const applyBlock = useCallback(async (filePath: string, code: string) => {
    if (!filePath) { setStatusMessage('⚠ No file path detected'); return; }

    let oldContent = '';
    let exists = false;

    try {
      if (activeProject) {
        try {
          oldContent = await readProjectFile(activeProject, filePath);
          exists = true;
        } catch {
          oldContent = '';
          exists = false;
        }
      } else if (isElectron) {
        const { ipcRenderer } = (window as any).require('electron');
        const readResult = await ipcRenderer.invoke('read-file', { filePath });
        if (!readResult.success) { setStatusMessage(`⚠ ${readResult.error}`); return; }
        oldContent = readResult.content || '';
        exists = readResult.exists ?? false;
      } else {
        const readRes = await fetch('/api/read-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        const readData = await readRes.json();
        if (!readRes.ok || !readData.success) {
          setStatusMessage(`⚠ Could not read ${filePath}: ${readData.error || 'unknown error'}`);
          return;
        }
        oldContent = readData.content || '';
        exists = readData.exists ?? false;
      }
    } catch (e: any) {
      setStatusMessage(`⚠ ${e.message || 'Failed to read file'}`);
      return;
    }

    let finalContent = code;
    let mergeNote = '';

    if (exists && isLikelySnippet(code, oldContent) && filePath.endsWith('.css')) {
      const merged = mergeCSSVariables(code, oldContent);
      if (merged) {
        finalContent = merged;
        mergeNote = ' (smart-merged snippet into existing file)';
      }
    }

    const safetyChecks = validateChange(finalContent, filePath, oldContent, validationContextRef.current);
    setPendingApply({
      filePath,
      newContent: finalContent,
      oldContent,
      exists,
      safetyChecks,
    });
    setApplyStage('confirm');
    setApplyStageMessage(mergeNote);
    setApplyCompileError('');
    lastBackupPathRef.current = '';
  }, [activeProject]);

  const confirmApply = useCallback(async () => {
    if (!pendingApply) return;
    const { filePath, newContent, oldContent } = pendingApply;
    try {
      if (activeProject) {
        setApplyStage('writing');
        try {
          await writeProjectFile(activeProject, filePath, newContent);
        } catch (e: any) {
          setApplyStage('error');
          setApplyStageMessage(`Write failed: ${e.message}`);
          return;
        }
        const isConfigFile = ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.ts'].includes(filePath);
        if (previewPort && isConfigFile) {
          try {
            const restartRes = await fetch('/api/projects/restart-preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: activeProject }),
            });
            const restartData = await restartRes.json().catch(() => ({} as any));
            if (!restartData.restarted) {
              setStatusMessage(`Preview restart skipped: ${restartData.reason || 'unknown'}`);
            }
          } catch (restartErr: any) {
            setStatusMessage(`Preview restart failed: ${restartErr.message}`);
          }
        }
        if (previewPort && !isConfigFile) {
          setTimeout(() => setPreviewKey(k => k + 1), 500);
        } else if (previewPort && isConfigFile) {
          setTimeout(() => setPreviewKey(k => k + 1), 2500);
        }
        setApplyStage('done');
        setApplyStageMessage(`Written to ${activeProject}/${filePath}${previewPort ? (isConfigFile ? ' — preview restarting' : ' — HMR updating') : ''}`);
      } else if (isElectron) {
        const { ipcRenderer } = (window as any).require('electron');

        setApplyStage('writing');
        const writeResult = await ipcRenderer.invoke('write-file', { filePath, content: newContent });
        if (!writeResult.success) {
          setApplyStage('error');
          setApplyStageMessage(`Write failed: ${writeResult.error}`);
          return;
        }
        lastBackupPathRef.current = writeResult.backupPath || '';

        setApplyStage('checking');
        const compileResult = await ipcRenderer.invoke('check-compile', { filePath });
        if (compileResult.hasErrors) {
          setApplyStage('error');
          setApplyStageMessage('Compile errors detected — rollback recommended');
          setApplyCompileError(compileResult.errorText);
          return;
        }

        setApplyStage('committing');
        const commitResult = await ipcRenderer.invoke('git-commit', {
          filePath,
          message: `Guardian AI: apply suggestion to ${filePath}`,
        });

        setApplyStage('done');
        const gitNote = commitResult.success ? ' + committed' : ' (git: ' + (commitResult.error || 'skipped') + ')';
        setApplyStageMessage(`Written to ${filePath}${gitNote}`);
      } else {
        setApplyStage('writing');
        const writeRes = await fetch('/api/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath, content: newContent }),
        });
        const writeData = await writeRes.json();
        if (!writeRes.ok || !writeData.success) {
          setApplyStage('error');
          setApplyStageMessage(`Write failed: ${writeData.error || 'unknown error'}`);
          return;
        }

        setApplyStage('done');
        setApplyStageMessage(`Written to ${filePath} (${writeData.bytesWritten} bytes)`);
      }

      if (!activeProject) {
        const existing = SELF_SOURCE.find(f => f.path === filePath);
        if (existing) { existing.content = newContent; existing.isModified = true; existing.lastModified = Date.now(); }
        else {
          const name = filePath.split('/').pop() || filePath;
          const ext = name.split('.').pop() || 'ts';
          const langMap: Record<string, string> = { ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', css: 'css', json: 'json' };
          SELF_SOURCE.push({ name, path: filePath, content: newContent, language: langMap[ext] || 'plaintext', isModified: true, lastModified: Date.now() });
        }
      }

      setAppliedChanges(prev => [...prev, {
        filePath: activeProject ? `${activeProject}/${filePath}` : filePath,
        previousContent: oldContent,
        newContent,
        timestamp: Date.now(),
        backupPath: lastBackupPathRef.current,
      }]);

      if (previewPort) {
        startPostApplyMonitoring([{ filePath, code: newContent }]);
      }

      if (isEvolutionResponse && lastFullResponseRef.current) {
        handleEvolutionApply(lastFullResponseRef.current, [filePath]);
        setIsEvolutionResponse(false);
      }
    } catch (e: any) {
      setApplyStage('error');
      setApplyStageMessage(`Error: ${e.message || 'Unknown failure'}`);
    }
  }, [pendingApply, isEvolutionResponse, handleEvolutionApply, activeProject, previewPort, startPostApplyMonitoring]);

  const rollbackPending = useCallback(async () => {
    if (!pendingApply) { setPendingApply(null); return; }
    if (activeProject) {
      try {
        await writeProjectFile(activeProject, pendingApply.filePath, pendingApply.oldContent);
        setStatusMessage(`↩ Rolled back ${activeProject}/${pendingApply.filePath}`);
      } catch { setStatusMessage(`⚠ Rollback failed for ${pendingApply.filePath}`); }
      setPendingApply(null);
      return;
    }
    if (!isElectron) {
      try {
        await fetch('/api/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: pendingApply.filePath, content: pendingApply.oldContent }),
        });
        setStatusMessage(`↩ Rolled back ${pendingApply.filePath}`);
      } catch { setStatusMessage(`⚠ Rollback failed for ${pendingApply.filePath}`); }
      setPendingApply(null);
      return;
    }
    if (!lastBackupPathRef.current) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const check = await ipcRenderer.invoke('read-file', { filePath: pendingApply.filePath });
        if (check.success && check.exists) {
          const { ipcRenderer: ipc2 } = (window as any).require('electron');
          await ipc2.invoke('write-file', { filePath: pendingApply.filePath, content: '' });
        }
      } catch (_) {}
      setStatusMessage(`↩ Rolled back ${pendingApply.filePath} (new file removed)`);
      setPendingApply(null);
      return;
    }
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('rollback-file', {
        filePath: pendingApply.filePath,
        backupPath: lastBackupPathRef.current,
      });
      if (result.success) {
        setStatusMessage(`↩ Rolled back ${pendingApply.filePath}`);
      } else {
        setStatusMessage(`⚠ Rollback failed: ${result.error}`);
      }
    } catch (e: any) {
      setStatusMessage(`⚠ Rollback error: ${e.message || 'Unknown'}`);
    }
    setPendingApply(null);
  }, [pendingApply]);

  const rollback = useCallback(async (change: AppliedChange) => {
    try {
      if (isElectron && change.backupPath) {
        const { ipcRenderer } = (window as any).require('electron');
        const result = await ipcRenderer.invoke('rollback-file', {
          filePath: change.filePath,
          backupPath: change.backupPath,
        });
        if (!result.success) {
          setStatusMessage(`⚠ Rollback failed: ${result.error}`);
          return;
        }
      }
      const file = SELF_SOURCE.find(f => f.path === change.filePath);
      if (file) { file.content = change.previousContent; file.isModified = true; file.lastModified = Date.now(); }
      setAppliedChanges(prev => prev.filter(c => c !== change));
      setStatusMessage(`↩ Rolled back ${change.filePath}`);
    } catch (e: any) {
      setStatusMessage(`⚠ Rollback error: ${e.message || 'Unknown'}`);
    }
  }, []);

  // ─── Batch Apply All ───────────────────────────────────────────────────────

  const [batchStage, setBatchStage] = useState<'idle' | 'writing' | 'checking' | 'committing' | 'restarting' | 'done' | 'error'>('idle');
  const [batchMessage, setBatchMessage] = useState('');
  const [batchBackups, setBatchBackups] = useState<{ filePath: string; backupPath: string }[]>([]);
  const [batchError, setBatchError] = useState('');

  const batchApplyAll = useCallback(async (blocks: { filePath: string; code: string }[]) => {
    if (blocks.length === 0) return;

    if (activeProject) {
      setBatchStage('writing');
      setBatchMessage(`Writing ${blocks.length} file${blocks.length > 1 ? 's' : ''} to ${activeProject}...`);
      setBatchError('');
      try {
        const responseText = lastFullResponseRef.current;
        const detectedDeps = responseText ? parseDependencies(responseText) : { dependencies: [], devDependencies: [] };
        const hasDeps = detectedDeps.dependencies.length > 0 || detectedDeps.devDependencies.length > 0;

        for (const block of blocks) {
          await writeProjectFile(activeProject, block.filePath, block.code);
        }

        if (hasDeps) {
          setBatchMessage(`Installing dependencies for ${activeProject}...`);
          let depsFailed = false;
          try {
            const res = await fetch('/api/projects/install-deps', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: activeProject,
                dependencies: detectedDeps.dependencies,
                devDependencies: detectedDeps.devDependencies,
              }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (!res.ok || data.success === false) {
              depsFailed = true;
              setStatusMessage(`Dep install errors: ${data.errors?.join('; ') || data.error || 'unknown'}`);
            }
            if (!depsFailed) {
              setStatusMessage(`Installed: ${[...detectedDeps.dependencies, ...detectedDeps.devDependencies].join(', ')}`);
            }
          } catch (depErr: any) {
            console.error('Dependency install failed:', depErr);
            setStatusMessage(`Dep install failed: ${depErr.message}`);
          }
        }

        setAppliedChanges(prev => [...prev, ...blocks.map(b => ({
          filePath: `${activeProject}/${b.filePath}`,
          previousContent: '',
          newContent: b.code,
          timestamp: Date.now(),
        }))]);
        await buildProjectContext();
        refreshQuickActions();

        const hasConfigChanges = blocks.some(b =>
          ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.ts'].includes(b.filePath)
        );
        const needsRestart = previewPort && (hasConfigChanges || hasDeps);
        if (needsRestart) {
          setBatchMessage('Restarting preview...');
          try {
            const restartRes = await fetch('/api/projects/restart-preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: activeProject }),
            });
            const restartData = await restartRes.json().catch(() => ({} as any));
            if (!restartData.restarted) {
              setStatusMessage(`Preview restart skipped: ${restartData.reason || 'unknown'}`);
            }
          } catch (restartErr: any) {
            setStatusMessage(`Preview restart failed: ${restartErr.message}`);
          }
        }

        if (previewPort) {
          setTimeout(() => setPreviewKey(k => k + 1), needsRestart ? 2500 : 500);
        }
        setBatchStage('done');
        const previewNote = previewPort ? (needsRestart ? ' — preview restarting' : ' — HMR updating') : '';
        setBatchMessage(`${blocks.length} files written${hasDeps ? ' + deps installed' : ''} to ${activeProject}${previewNote}`);
        setTimeout(() => { setBatchStage('idle'); setBatchMessage(''); }, 4000);

        if (previewPort) {
          startPostApplyMonitoring(blocks.map(b => ({ filePath: b.filePath, code: b.code })));
        }
      } catch (e: any) {
        setBatchStage('error');
        setBatchMessage(`Batch write failed: ${e.message}`);
        setBatchError(e.message);
      }
      return;
    }

    if (!isElectron) return;
    try {
      const { ipcRenderer } = (window as any).require('electron');

      setBatchStage('writing');
      setBatchMessage(`Writing ${blocks.length} file${blocks.length > 1 ? 's' : ''}...`);
      setBatchError('');

      const writeResult = await ipcRenderer.invoke('batch-write-files', {
        files: blocks.map(b => ({ filePath: b.filePath, content: b.code })),
      });

      const backups = writeResult.results
        .filter((r: any) => r.success && r.backupPath)
        .map((r: any) => ({ filePath: r.filePath, backupPath: r.backupPath }));
      setBatchBackups(backups);

      if (!writeResult.success) {
        const failedFile = writeResult.results.find((r: any) => !r.success);
        if (backups.length > 0) {
          await ipcRenderer.invoke('batch-rollback', { backups });
        }
        setBatchStage('error');
        setBatchMessage(`Write failed: ${failedFile?.error || 'Unknown error'} (rolled back ${backups.length} files)`);
        return;
      }

      setBatchStage('checking');
      setBatchMessage('Running project-wide compile check...');

      const hasTsFiles = blocks.some(b => /\.(tsx?|jsx?)$/.test(b.filePath));
      let hasCompileErrors = false;
      let compileErrorText = '';
      if (hasTsFiles) {
        const checkResult = await ipcRenderer.invoke('check-compile-project');
        if (checkResult.hasErrors) {
          hasCompileErrors = true;
          compileErrorText = checkResult.errorText;
        }
      }

      if (hasCompileErrors) {
        setBatchStage('error');
        setBatchMessage('Compile errors detected — rollback recommended');
        setBatchError(compileErrorText);
        return;
      }

      setBatchStage('committing');
      setBatchMessage('Committing changes...');

      const fileList = blocks.map(b => b.filePath).join(', ');
      const commitResult = await ipcRenderer.invoke('batch-git-commit', {
        filePaths: blocks.map(b => b.filePath),
        message: `Guardian AI: batch apply ${blocks.length} files (${fileList.slice(0, 100)})`,
      });

      for (const block of blocks) {
        const existing = SELF_SOURCE.find(f => f.path === block.filePath);
        if (existing) { existing.content = block.code; existing.isModified = true; existing.lastModified = Date.now(); }
      }

      setAppliedChanges(prev => [...prev, ...blocks.map(b => ({
        filePath: b.filePath,
        previousContent: '',
        newContent: b.code,
        timestamp: Date.now(),
        backupPath: backups.find((bk: any) => bk.filePath === b.filePath)?.backupPath || '',
      }))]);

      setBatchStage('restarting');
      setBatchMessage('Restarting dev server...');

      const hasConfigChanges = blocks.some(b =>
        b.filePath === 'vite.config.ts' || b.filePath === 'tsconfig.json' ||
        b.filePath === 'tailwind.config.ts' || b.filePath === 'package.json'
      );

      if (hasConfigChanges) {
        try {
          const restartResult = await ipcRenderer.invoke('restart-dev-server');
          if (!restartResult.success) {
            setBatchMessage(`${blocks.length} files applied (restart warning: ${restartResult.error})`);
          }
        } catch {
          // non-fatal
        }
      } else {
        await new Promise(r => setTimeout(r, 2000));
      }

      await buildProjectContext();
      refreshQuickActions();

      setBatchStage('done');
      const gitNote = commitResult.success ? ' + committed' : '';
      setBatchMessage(`${blocks.length} files applied${gitNote}`);

      setTimeout(() => { setBatchStage('idle'); setBatchMessage(''); }, 4000);

      startPostApplyMonitoring(blocks.map(b => ({ filePath: b.filePath, code: b.code })));
    } catch (e: any) {
      setBatchStage('error');
      setBatchMessage(`Error: ${e.message || 'Unknown'}`);
    }
  }, [activeProject, previewPort, startPostApplyMonitoring]);

  const batchRollback = useCallback(async () => {
    if (!isElectron || batchBackups.length === 0) { setBatchStage('idle'); return; }
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('batch-rollback', { backups: batchBackups });
      setStatusMessage(`↩ Rolled back ${result.restored} files`);
    } catch (e: any) {
      setStatusMessage(`⚠ Rollback error: ${e.message}`);
    }
    setBatchStage('idle');
    setBatchBackups([]);
  }, [batchBackups]);

  // ─── Project Context Builder ───────────────────────────────────────────────

  const [projectContext, setProjectContext] = useState<string>('');
  const [contextLoading, setContextLoading] = useState(false);
  const [lastErrors, setLastErrors] = useState<string>('');

  const estimateTokens = useCallback((text: string): number => {
    return Math.ceil(text.length / 4);
  }, []);

  const summarizeChatHistory = useCallback((msgs: Msg[], maxTurns = 3): string => {
    if (msgs.length === 0) return '';
    const recent = msgs.slice(-maxTurns * 2);
    if (recent.length === 0) return '';
    let summary = `=== RECENT CHAT HISTORY (last ${Math.min(maxTurns, Math.ceil(recent.length / 2))} turns) ===\n`;
    for (const msg of recent) {
      const label = msg.role === 'user' ? 'User' : 'Grok';
      const content = msg.content.length > 300 ? msg.content.slice(0, 300) + '...(truncated)' : msg.content;
      summary += `[${label}]: ${content}\n`;
    }
    summary += `=== END CHAT HISTORY ===\n`;
    return summary;
  }, []);

  const buildProjectContext = useCallback(async () => {
    setContextLoading(true);
    const TOKEN_BUDGET = 16000;
    const CHARS_BUDGET = TOKEN_BUDGET * 4;

    try {
      const sections: { label: string; content: string; priority: number }[] = [];

      let header = `=== PROJECT CONTEXT ===\n`;
      if (activeProject) {
        header += `This is a project called "${activeProject}" managed by Guardian AI.\n`;
        header += `All file paths are relative to the project root.\n`;
      } else {
        header += `This is a React + TypeScript + Vite desktop app (Electron) called Guardian AI ("lambda Recursive").\n`;
      }
      sections.push({ label: 'header', content: header, priority: 0 });

      const errorLogs = previewLogs.filter(l => l.level === 'error' || l.level === 'warn');
      if (errorLogs.length > 0) {
        const recentErrors = errorLogs.slice(-20);
        let errorSection = `=== PREVIEW ERRORS/WARNINGS (${recentErrors.length} entries) ===\n`;
        for (const log of recentErrors) {
          const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          errorSection += `[${time}] [${log.level.toUpperCase()}] ${log.message}\n`;
          if (log.stack) {
            errorSection += `  Stack: ${log.stack.split('\n').slice(0, 3).join('\n  ')}\n`;
          }
        }
        errorSection += `=== END PREVIEW ERRORS ===\n`;
        sections.push({ label: 'errors', content: errorSection, priority: 1 });
      }

      if (lastErrors) {
        sections.push({ label: 'lastErrors', content: `\n=== CURRENT ERRORS ===\n${lastErrors}\n`, priority: 1 });
      }

      let toasterSection = '';
      if (toasterAvailability?.available && activeProject && (lastErrors || errorLogs.length > 0)) {
        try {
          setToasterLoading(true);
          const tree = await getProjectFiles(activeProject);
          const flatPaths: string[] = [];
          const collectAllPaths = (nodes: ProjectFileNode[], prefix = '') => {
            for (const n of nodes) {
              const p = prefix ? `${prefix}/${n.name}` : n.name;
              if (n.type === 'file') flatPaths.push(p);
              if (n.children) collectAllPaths(n.children, p);
            }
          };
          collectAllPaths(tree);

          const errorText = lastErrors || errorLogs.map(l => `[${l.level}] ${l.message}`).join('\n');
          const smartCtx = await buildSmartContext(errorText, flatPaths, undefined, toasterConfig);
          if (smartCtx.usedOllama && smartCtx.analysis) {
            setLastToasterAnalysis(smartCtx.analysis);
            toasterSection = formatAnalysisForPrompt(smartCtx.analysis);
            sections.push({ label: 'toasterAnalysis', content: toasterSection, priority: 2 });

            for (const fp of smartCtx.filesToInclude.slice(0, 30)) {
              if (sections.some(s => s.label === `file:${fp}`)) continue;
              try {
                const content = await readProjectFile(activeProject!, fp);
                if (content.length < 10000) {
                  sections.push({ label: `file:${fp}`, content: `\n=== ${fp} (TOASTER-IDENTIFIED) ===\n${content}\n`, priority: 3 });
                }
              } catch {}
            }
          }
        } catch {} finally {
          setToasterLoading(false);
        }
      }

      const changedFiles = lastAppliedFilesRef.current.map(f => f.filePath);
      if (changedFiles.length > 0) {
        let changedSection = `=== RECENTLY CHANGED FILES ===\n`;
        changedSection += changedFiles.join('\n') + '\n';
        changedSection += `=== END CHANGED FILES ===\n`;
        sections.push({ label: 'changedFiles', content: changedSection, priority: 3 });
      }

      const historySummary = summarizeChatHistory(messages);
      if (historySummary) {
        sections.push({ label: 'chatHistory', content: historySummary, priority: 5 });
      }

      if (activeProject) {
        try {
          const tree = await getProjectFiles(activeProject);
          const flatPaths: string[] = [];
          const collectPaths = (nodes: ProjectFileNode[], prefix = '') => {
            for (const n of nodes) {
              const p = prefix ? `${prefix}/${n.name}` : n.name;
              if (n.type === 'file') flatPaths.push(p);
              if (n.children) collectPaths(n.children, p);
            }
          };
          collectPaths(tree);

          sections.push({ label: 'fileTree', content: `=== FILE TREE ===\n${flatPaths.join('\n')}\n`, priority: 4 });

          const changedSet = new Set(changedFiles);
          const changedKeyFiles = flatPaths.filter(f => changedSet.has(f));
          const unchangedKeyFiles = flatPaths.filter(f =>
            !changedSet.has(f) && (
              f === 'package.json' || f === 'tsconfig.json' || f === 'vite.config.ts' ||
              f === 'index.html' || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css') || f.endsWith('.html')
            )
          );

          const prioritizedFiles = [...changedKeyFiles, ...unchangedKeyFiles].slice(0, 30);

          for (const fp of prioritizedFiles) {
            try {
              const content = await readProjectFile(activeProject, fp);
              if (content.length < 8000) {
                const marker = changedSet.has(fp) ? ' (CHANGED)' : '';
                sections.push({ label: `file:${fp}`, content: `\n=== ${fp}${marker} ===\n${content}\n`, priority: changedSet.has(fp) ? 3 : 6 });
              }
            } catch {}
          }
        } catch {
          sections.push({ label: 'fileError', content: `(Could not read project files)\n`, priority: 10 });
        }
      } else {
        if (isElectron) {
          const { ipcRenderer } = (window as any).require('electron');

          const [filesResult, gitResult] = await Promise.all([
            ipcRenderer.invoke('list-project-files'),
            ipcRenderer.invoke('git-log', { count: 5 }),
          ]);

          const fileTree = filesResult.success ? filesResult.files : [];

          const keyFiles = fileTree.filter((f: string) =>
            f === 'package.json' || f === 'tsconfig.json' || f === 'vite.config.ts' ||
            f === 'tailwind.config.ts' || f === 'index.html' ||
            (f.startsWith('src/') && (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')) && !f.includes('lib/capabilities/'))
          ).slice(0, 20);

          const contentsResult = await ipcRenderer.invoke('read-files-for-context', {
            filePaths: keyFiles,
            maxSizePerFile: 6000,
          });

          let treeContent = `=== FILE TREE ===\n`;
          treeContent += fileTree.slice(0, 80).join('\n') + '\n';
          if (fileTree.length > 80) treeContent += `... (${fileTree.length} total files)\n`;
          sections.push({ label: 'fileTree', content: treeContent, priority: 4 });

          if (gitResult.success && gitResult.log) {
            sections.push({ label: 'gitLog', content: `\n=== RECENT GIT LOG ===\n${gitResult.log}\n`, priority: 7 });
          }

          if (contentsResult.success) {
            for (const file of contentsResult.files) {
              sections.push({ label: `file:${file.path}`, content: `\n=== ${file.path} ===\n${file.content}\n`, priority: 6 });
            }
          }
        } else {
          sections.push({ label: 'fileTree', content: `=== FILE TREE ===\n${SELF_SOURCE.map(f => f.path).join('\n')}\n`, priority: 4 });

          for (const file of SELF_SOURCE.filter(f => f.content && f.content.length < 8000).slice(0, 15)) {
            sections.push({ label: `file:${file.path}`, content: `\n=== ${file.path} ===\n${file.content}\n`, priority: 6 });
          }
        }
      }

      if (knowledgeMatches.length > 0) {
        const knowledgeSection = formatKnowledgeForGrokPrompt(knowledgeMatches);
        sections.push({ label: 'knowledgeHints', content: knowledgeSection, priority: 5 });
      }

      const configFiles = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', '.gitignore', '.eslintrc.json', '.prettierrc']);
      const projectSourceFiles = sections.filter(s => {
        if (!s.label.startsWith('file:')) return false;
        const filePath = s.label.replace('file:', '');
        const fileName = filePath.split('/').pop() || '';
        return !configFiles.has(fileName) && !fileName.endsWith('.lock') && !fileName.endsWith('.json');
      });
      const hasSourceFiles = projectSourceFiles.length > 0;
      const isEmptyProject = activeProject && !hasSourceFiles;

      let instructions = `\n=== INSTRUCTIONS ===\n`;
      instructions += `You are assisting with code for a self-recursive IDE called λ Recursive (Guardian AI).\n`;

      if (isEmptyProject) {
        instructions += `This is a BRAND NEW empty project. There are no source files yet.\n`;
        instructions += `Do NOT generate code files directly. Instead:\n\n`;
        instructions += `REPO SELECTION PRIORITY:\n`;
        instructions += `1) FIRST: Suggest a popular public GitHub repo as a starting point (React/TS/Vite/Tailwind preferred, high stars, MIT/Apache license). Provide the full clone URL so the user can import it.\n`;
        instructions += `2) SECOND: Consider any proven builds from the community knowledge base if listed above.\n`;
        instructions += `3) LAST RESORT: Only if nothing fits, describe what files/structure to create and let the user confirm before generating code.\n`;
        instructions += `Always prefer leveraging existing open-source work over starting from scratch.\n`;
        instructions += `The user will clone/import the repo through Guardian AI's GitHub import feature.\n\n`;
      } else {
        instructions += `Think step-by-step: understand the request → check the current files provided in context → plan minimal changes → output code.\n\n`;
      }

      instructions += `RULES:\n`;
      if (hasSourceFiles) {
        instructions += `1. ALWAYS use \`// file: path/to/file.ext\` headers immediately before each fenced code block.\n`;
        instructions += `2. Prefer minimal, targeted patches over full file rewrites. Only include files that need changes.\n`;
        instructions += `3. Only cite real, published npm packages — never invent package names.\n`;
        instructions += `4. Keep explanations brief. Focus on what changed and why.\n`;
        instructions += `5. The code extractor will automatically detect and apply these blocks.\n\n`;
        instructions += `If your changes require new npm packages, include a dependencies block BEFORE the code blocks:\n\n`;
        instructions += `=== DEPENDENCIES ===\n`;
        instructions += `package-name\n`;
        instructions += `dev: @types/package-name\n`;
        instructions += `=== END_DEPENDENCIES ===\n\n`;
        instructions += `List one package per line. Prefix dev dependencies with "dev: ".\n`;
        instructions += `The app will automatically install these before applying code changes.\n`;
      } else {
        instructions += `1. Only cite real, published npm packages — never invent package names.\n`;
        instructions += `2. Keep explanations brief and actionable.\n`;
        instructions += `3. Suggest a GitHub repo URL when possible instead of writing code from scratch.\n`;
      }
      sections.push({ label: 'instructions', content: instructions, priority: 0 });

      sections.sort((a, b) => a.priority - b.priority);

      let context = '';
      let currentChars = 0;

      for (const section of sections) {
        const sectionChars = section.content.length;
        if (currentChars + sectionChars > CHARS_BUDGET && section.priority > 7) {
          continue;
        }
        context += section.content;
        currentChars += sectionChars;
      }

      setProjectContext(context);
      setContextLoading(false);
      return context;
    } catch (e: any) {
      setContextLoading(false);
      setStatusMessage(`Context build failed: ${e.message}`);
      return '';
    }
  }, [lastErrors, activeProject, toasterAvailability, toasterConfig, previewLogs, messages, summarizeChatHistory, knowledgeMatches]);

  const refreshQuickActions = useCallback(async () => {
    if (!activeProject) { setQuickActions([]); return; }
    setQuickActionsLoading(true);
    try {
      const tree = await getProjectFiles(activeProject);
      const flatPaths: string[] = [];
      const collectQAPaths = (nodes: ProjectFileNode[], prefix = '') => {
        for (const n of nodes) {
          const p = prefix ? `${prefix}/${n.name}` : n.name;
          if (n.type === 'file') flatPaths.push(p);
          if (n.children) collectQAPaths(n.children, p);
        }
      };
      collectQAPaths(tree);

      let pkgJson: Record<string, any> | null = null;
      try {
        const raw = await readProjectFile(activeProject, 'package.json');
        pkgJson = JSON.parse(raw);
      } catch {}

      let cssContent = '';
      const cssFiles = flatPaths.filter(f => f.endsWith('.css') || f.endsWith('.scss'));
      for (const cf of cssFiles.slice(0, 3)) {
        try {
          const c = await readProjectFile(activeProject, cf);
          cssContent += c.slice(0, 2000);
        } catch {}
      }

      const errorCount = previewLogs.filter(l => l.level === 'error').length;
      const result = await suggestQuickActions(flatPaths, pkgJson, errorCount, cssContent, toasterConfig);
      setQuickActions(result.actions);
    } catch {
      setQuickActions([]);
    } finally {
      setQuickActionsLoading(false);
    }
  }, [activeProject, previewLogs, toasterConfig]);

  useEffect(() => {
    if (mode === 'browser') {
      buildProjectContext();
    }
  }, [mode]);

  useEffect(() => {
    buildProjectContext();
    refreshQuickActions();
  }, [activeProject]);

  const copyContextToClipboard = useCallback(async () => {
    if (!projectContext) return;
    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(projectContext);
      } else {
        await navigator.clipboard.writeText(projectContext);
      }
      setStatusMessage('✓ Project context copied to clipboard — paste into Grok');
    } catch {
      try {
        await navigator.clipboard.writeText(projectContext);
        setStatusMessage('✓ Project context copied');
      } catch {
        setStatusMessage('⚠ Clipboard write failed');
      }
    }
  }, [projectContext]);

  const copyEvolutionContext = useCallback(async () => {
    setEvolutionLoading(true);
    try {
      const ctx = projectContext || await buildProjectContext();
      const state = await fetchEvolutionState();
      setEvolutionState(state);
      const plan = loadEvolutionPlan();
      setCurrentPlan(plan);
      const fullContext = buildEvolutionContext(ctx, state, plan);
      try {
        if (isElectron) {
          const { clipboard } = (window as any).require('electron');
          clipboard.writeText(fullContext);
        } else {
          await navigator.clipboard.writeText(fullContext);
        }
        setStatusMessage(
          plan
            ? `✓ Evolution context copied (L${state.evolutionLevel}, ${state.capabilities.length} caps, plan included) — paste into Grok`
            : `✓ Evolution context copied (L${state.evolutionLevel}, ${state.capabilities.length} caps, no prior plan) — paste into Grok`
        );
        setIsEvolutionResponse(true);
      } catch {
        setStatusMessage('⚠ Clipboard write failed — try Copy Context instead');
      }
    } catch (e: any) {
      setStatusMessage(`⚠ Evolution context failed: ${e.message}`);
    } finally {
      setEvolutionLoading(false);
    }
  }, [projectContext, buildProjectContext]);

  const buildErrorFeedback = useCallback(async (errorText: string) => {
    setLastErrors(errorText);

    let analysisSection = '';
    if (toasterAvailability?.available && activeProject) {
      try {
        setToasterLoading(true);
        const tree = await getProjectFiles(activeProject);
        const flatPaths: string[] = [];
        const collectFeedbackPaths = (nodes: ProjectFileNode[], prefix = '') => {
          for (const n of nodes) {
            const p = prefix ? `${prefix}/${n.name}` : n.name;
            if (n.type === 'file') flatPaths.push(p);
            if (n.children) collectFeedbackPaths(n.children, p);
          }
        };
        collectFeedbackPaths(tree);

        const smartCtx = await buildSmartContext(errorText, flatPaths, undefined, toasterConfig);
        if (smartCtx.usedOllama && smartCtx.analysis) {
          setLastToasterAnalysis(smartCtx.analysis);
          analysisSection = '\n' + formatAnalysisForPrompt(smartCtx.analysis);

          for (const fp of smartCtx.filesToInclude.slice(0, 10)) {
            try {
              const content = await readProjectFile(activeProject, fp);
              if (content.length < 6000) {
                analysisSection += `\n=== ${fp} ===\n${content}\n`;
              }
            } catch {}
          }
        }
      } catch {} finally {
        setToasterLoading(false);
      }
    }

    const errorPrompt = `The following errors occurred after applying code changes:\n\n${errorText}\n\n` +
      analysisSection +
      `Please fix these errors. Return the corrected files using this format:\n` +
      `// file: path/to/file.tsx\n\`\`\`tsx\n// corrected content\n\`\`\`\n\n` +
      (projectContext ? `Current project context:\n${projectContext.slice(0, 3000)}` : '');
    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(errorPrompt);
      } else {
        await navigator.clipboard.writeText(errorPrompt);
      }
      setStatusMessage(analysisSection ? '✓ Error feedback + Ollama analysis copied — paste into Grok' : '✓ Error feedback copied — paste into Grok for fix');
    } catch {
      setStatusMessage('⚠ Could not copy error feedback');
    }
  }, [projectContext, toasterAvailability, toasterConfig, activeProject]);

  const renderMessage = (msg: Msg, idx: number) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className="flex gap-3 justify-end">
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 max-w-[80%]">
            <p className="text-xs text-foreground whitespace-pre-wrap">{msg.content}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
      );
    }
    const regexBlocks = parseCodeBlocks(msg.content);
    const blocks = cleanedApiBlocks.get(idx) || regexBlocks;
    const textParts = msg.content.split(/```[\s\S]*?```/);
    return (
      <div key={idx} className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-accent/30 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-accent-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-3 max-w-[85%]">
          {textParts.map((text, ti) => (
            <React.Fragment key={ti}>
              {text.trim() && <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{text.trim()}</p>}
              {blocks[ti] && (() => {
                const block = blocks[ti];
                const blockKey = `${idx}-${ti}`;
                const checks = validationResults.get(blockKey);
                const isApplied = appliedChanges.some(c => c.newContent === block.code && c.filePath === block.filePath);
                return (
                  <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Code2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{block.filePath || block.language}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => runValidation(blockKey, block.code, block.filePath)} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[9px] transition-colors">
                          <Shield className="w-2.5 h-2.5" /> Check
                        </button>
                        {block.filePath && (
                          <button onClick={() => applyBlock(block.filePath, block.code)} disabled={isApplied} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[9px] transition-colors disabled:opacity-30">
                            <Check className="w-2.5 h-2.5" /> {isApplied ? 'Applied' : 'Apply'}
                          </button>
                        )}
                      </div>
                    </div>
                    <pre className="p-3 text-[10px] text-foreground/70 max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed font-mono">{block.code}</pre>
                    {checks && (
                      <div className="px-3 py-1.5 border-t border-border/30 space-y-0.5">
                        {checks.map((check, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-[9px]">
                            {check.severity === 'error' ? <AlertTriangle className="w-2.5 h-2.5 text-destructive" /> : <Check className="w-2.5 h-2.5 text-primary" />}
                            <span className={check.severity === 'error' ? 'text-destructive' : 'text-primary/70'}>{check.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const selectedModel = MODELS.find(m => m.id === model) || MODELS[1];
  const currentSite = BROWSER_SITES.find(s => s.url === browserUrl);

  const outboundPrompts = useMemo(() => {
    const errors = Array.from(validationResults.values())
      .flat()
      .filter(check => check.severity === 'error')
      .map(check => `- ${check.message}`);

    const recentFiles = appliedChanges.slice(-5).map(change => `- ${change.filePath}`);

    const prompts = [
      {
        id: 'errors',
        label: 'Copy Errors',
        content: errors.length > 0
          ? `Fix these build/runtime issues and return patch-ready code blocks with file paths:\n\n${errors.join('\n')}`
          : `No captured validation errors yet. Ask targeted debugging questions and suggest the fastest next verification step for this app.`,
      },
      {
        id: 'suggestions',
        label: 'Copy Suggestions Request',
        content: `Suggest the top 3 highest-impact improvements for this app right now. Prioritize speed, reliability, and clean architecture. Return concise rationale + code patch blocks.`,
      },
      {
        id: 'requests',
        label: 'Copy Goal Request',
        content: `Act as my rapid app-building copilot. I need actionable next steps and patch-ready code for current work.${recentFiles.length ? `\n\nRecently changed files:\n${recentFiles.join('\n')}` : ''}`,
      },
      {
        id: 'status',
        label: 'Copy Current Status',
        content: `Current bridge status: ${statusMessage || 'No status yet'}\nSite: ${currentSite?.name || browserUrl}\n\nTell me exactly what to do next in Grok and what to paste back.`
      }
    ];

    return prompts;
  }, [validationResults, appliedChanges, statusMessage, currentSite?.name, browserUrl]);

  const copyPromptToClipboard = useCallback(async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setStatusMessage(`✓ Copied: ${label}`);
    } catch {
      setStatusMessage('⚠ Clipboard write failed');
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-mono overflow-hidden">
      {pendingApply && (
        <ApplyConfirmDialog
          pending={pendingApply}
          stage={applyStage}
          stageMessage={applyStageMessage}
          compileError={applyCompileError}
          onConfirm={confirmApply}
          onCancel={() => setPendingApply(null)}
          onRollback={rollbackPending}
        />
      )}

      {batchStage !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="dialog-batch-apply">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              {batchStage === 'done' ? (
                <Check className="w-6 h-6 text-primary" />
              ) : batchStage === 'error' ? (
                <AlertTriangle className="w-6 h-6 text-destructive" />
              ) : (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              )}
              <div>
                <div className="text-sm font-semibold">
                  {batchStage === 'writing' && 'Writing Files'}
                  {batchStage === 'checking' && 'Compile Check'}
                  {batchStage === 'committing' && 'Git Commit'}
                  {batchStage === 'restarting' && 'Applying Changes'}
                  {batchStage === 'done' && 'Complete'}
                  {batchStage === 'error' && 'Error'}
                </div>
                <div className="text-xs text-muted-foreground">{batchMessage}</div>
              </div>
            </div>

            {batchStage !== 'idle' && (
              <div className="w-full bg-secondary/30 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${batchStage === 'error' ? 'bg-destructive' : 'bg-primary'}`} style={{
                  width: batchStage === 'writing' ? '25%' : batchStage === 'checking' ? '50%' : batchStage === 'committing' ? '75%' : batchStage === 'restarting' ? '90%' : '100%',
                }} />
              </div>
            )}

            {batchError && (
              <pre className="text-[9px] text-destructive/80 bg-destructive/5 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{batchError}</pre>
            )}

            <div className="flex justify-end gap-2">
              {batchStage === 'error' && (
                <>
                  <button onClick={batchRollback} data-testid="button-batch-rollback" className="px-3 py-1.5 rounded text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Rollback All
                  </button>
                  <button onClick={() => buildErrorFeedback(batchError || batchMessage)} data-testid="button-send-errors" className="px-3 py-1.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25 flex items-center gap-1">
                    <Send className="w-3 h-3" /> Send to Grok
                  </button>
                  <button onClick={() => { setBatchStage('idle'); setBatchError(''); }} className="px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80">Dismiss</button>
                </>
              )}
              {batchStage === 'done' && (
                <button onClick={() => setBatchStage('idle')} className="px-3 py-1.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25">Done</button>
              )}
            </div>
          </div>
        </div>
      )}

      {detectedRepoUrl && (
        <div className="shrink-0 px-3 py-2 bg-primary/10 border-b border-primary/30 flex items-center gap-3 flex-wrap" data-testid="banner-detected-repo">
          <GitBranch className="w-4 h-4 text-primary shrink-0" />
          <span className="text-[11px] text-foreground">Grok suggested a GitHub repo:</span>
          <span className="text-[11px] font-mono text-primary">{detectedRepoUrl}</span>
          <button
            data-testid="button-clone-detected-repo"
            onClick={() => handleGitHubImport(detectedRepoUrl)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            <GitBranch className="w-3 h-3" /> Clone & Import
          </button>
          <button
            data-testid="button-dismiss-detected-repo"
            onClick={() => setDetectedRepoUrl(null)}
            className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {githubImportProgress && (
        <div className={`shrink-0 px-3 py-2 border-b flex items-center gap-3 ${
          githubImportProgress.stage === 'error' ? 'bg-destructive/10 border-destructive/30' :
          githubImportProgress.stage === 'done' ? 'bg-[hsl(150_60%_55%/0.1)] border-[hsl(150_60%_55%/0.3)]' :
          'bg-primary/10 border-primary/30'
        }`} data-testid="banner-github-import-progress">
          {githubImportProgress.stage !== 'done' && githubImportProgress.stage !== 'error' && (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          )}
          {githubImportProgress.stage === 'done' && (
            <Check className="w-4 h-4 text-[hsl(150_60%_55%)] shrink-0" />
          )}
          {githubImportProgress.stage === 'error' && (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <span className={`text-[11px] ${
            githubImportProgress.stage === 'error' ? 'text-destructive' :
            githubImportProgress.stage === 'done' ? 'text-[hsl(150_60%_55%)]' : 'text-primary'
          }`}>
            {githubImportProgress.message}
          </span>
          {githubImportProgress.stage === 'error' && (
            <button
              onClick={() => setGithubImportProgress(null)}
              className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {publishProgress && (
        <div className={`shrink-0 px-3 py-2 border-b flex items-center gap-3 ${
          publishProgress.stage === 'error' ? 'bg-destructive/10 border-destructive/30' :
          publishProgress.stage === 'done' ? 'bg-[hsl(150_60%_55%/0.1)] border-[hsl(150_60%_55%/0.3)]' :
          'bg-[hsl(280_60%_50%/0.1)] border-[hsl(280_60%_50%/0.3)]'
        }`} data-testid="banner-publish-progress">
          {publishProgress.stage !== 'done' && publishProgress.stage !== 'error' && (
            <Loader2 className="w-4 h-4 text-[hsl(280_60%_65%)] animate-spin shrink-0" />
          )}
          {publishProgress.stage === 'done' && (
            <Check className="w-4 h-4 text-[hsl(150_60%_55%)] shrink-0" />
          )}
          {publishProgress.stage === 'error' && (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <span className={`text-[11px] ${
            publishProgress.stage === 'error' ? 'text-destructive' :
            publishProgress.stage === 'done' ? 'text-[hsl(150_60%_55%)]' : 'text-[hsl(280_60%_65%)]'
          }`}>
            {publishProgress.message}
          </span>
          {publishProgress.stage === 'done' && publishedUrl && (
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-primary hover:underline" data-testid="link-published-repo">
              <ExternalLink className="w-3 h-3" /> View on GitHub
            </a>
          )}
          {(publishProgress.stage === 'error' || publishProgress.stage === 'done') && (
            <button
              onClick={() => setPublishProgress(null)}
              className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {showPublishDialog && (
        <div className="shrink-0 border-b border-[hsl(280_60%_50%/0.3)] bg-[hsl(280_60%_50%/0.05)] px-4 py-3" data-testid="dialog-publish">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-[hsl(280_60%_65%)]" />
            <span className="text-[12px] font-bold text-foreground">Publish to Community</span>
            <button onClick={() => setShowPublishDialog(false)} className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            Publish <strong>{activeProject}</strong> to the shared GitHub org. Sensitive files (.env, keys) are auto-stripped.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="input-publish-description"
              value={publishDescription}
              onChange={e => setPublishDescription(e.target.value)}
              placeholder="Brief project description (e.g., 'todo app with drag-drop')"
              className="flex-1 bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-[hsl(280_60%_50%/0.5)]"
            />
            <button
              data-testid="button-confirm-publish"
              onClick={handlePublish}
              disabled={!publishDescription.trim() || (publishProgress !== null && publishProgress.stage !== 'done' && publishProgress.stage !== 'error')}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold bg-[hsl(280_60%_50%/0.2)] text-[hsl(280_60%_65%)] hover:bg-[hsl(280_60%_50%/0.3)] transition-colors border border-[hsl(280_60%_50%/0.3)] disabled:opacity-40"
            >
              <Upload className="w-3 h-3" /> Publish
            </button>
          </div>
          {!hasPublishCredentials(getGuardianConfig()) && (
            <p className="text-[9px] text-destructive/80 mt-2 flex items-center gap-1">
              <Key className="w-3 h-3" /> No GitHub PAT configured. Add one in the Settings panel below.
            </p>
          )}
        </div>
      )}

      {showSettings && (
        <div className="shrink-0 border-b border-border/40 bg-card/80 px-4 py-3" data-testid="dialog-settings">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-[12px] font-bold text-foreground">Settings</span>
            <button onClick={() => setShowSettings(false)} className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors" data-testid="button-close-settings">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Key className="w-3 h-3" /> GitHub — Shared Org PAT
              </p>
              <p className="text-[9px] text-muted-foreground/60 mb-1">
                Token for the shared community org ({getGuardianConfig().orgName}). Needed for publishing builds.
              </p>
              <input
                type="password"
                data-testid="input-shared-pat"
                value={settingsSharedPat}
                onChange={e => setSettingsSharedPat(e.target.value)}
                placeholder="ghp_..."
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Key className="w-3 h-3" /> GitHub — Personal PAT (optional)
              </p>
              <p className="text-[9px] text-muted-foreground/60 mb-1">
                Your personal GitHub token. Used instead of shared PAT when set. Pushes to your account.
              </p>
              <input
                type="password"
                data-testid="input-user-pat"
                value={settingsUserPat}
                onChange={e => setSettingsUserPat(e.target.value)}
                placeholder="ghp_..."
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div className="border-t border-border/30 pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Ollama Toaster — Endpoint
              </p>
              <input
                type="text"
                data-testid="input-ollama-endpoint"
                value={settingsOllamaEndpoint}
                onChange={e => setSettingsOllamaEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Ollama Toaster — Model
              </p>
              <p className="text-[9px] text-muted-foreground/60 mb-1">
                Recommended: qwen2.5-coder:7b, llama3.2:3b, phi-3.5-mini
              </p>
              <input
                type="text"
                data-testid="input-ollama-model"
                value={settingsOllamaModel}
                onChange={e => setSettingsOllamaModel(e.target.value)}
                placeholder="qwen2.5-coder:7b"
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                data-testid="button-save-settings"
                onClick={() => {
                  setSharedPat(settingsSharedPat);
                  setUserPat(settingsUserPat || null);
                  const newConfig = { endpoint: settingsOllamaEndpoint, model: settingsOllamaModel };
                  saveToasterConfig(newConfig);
                  setToasterConfig(newConfig);
                  clearAvailabilityCache();
                  checkToasterAvailability(newConfig).then(setToasterAvailability);
                  setShowSettings(false);
                  setStatusMessage('Settings saved');
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors border border-primary/30"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                data-testid="button-cancel-settings"
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-border/40 bg-card/60">
        <div className="px-3 py-1.5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--terminal-amber))]" />
            <span className="text-[11px] font-bold text-foreground">AI Bridge</span>
          </div>

          <button
            data-testid="button-toggle-project-panel"
            onClick={() => setShowProjectPanel(p => !p)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors border shrink-0 ${
              activeProject
                ? 'bg-[hsl(150_60%_40%/0.15)] text-[hsl(150_60%_55%)] border-[hsl(150_60%_40%/0.3)]'
                : 'bg-secondary/30 text-muted-foreground border-border/30 hover:bg-secondary/50'
            }`}
          >
            <FolderOpen className="w-3 h-3" />
            {activeProject || 'Main App'}
            {showProjectPanel ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>

          {activeProject && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                data-testid="button-start-preview"
                onClick={startPreview}
                disabled={previewLoading}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(150_60%_40%/0.15)] text-[hsl(150_60%_55%)] hover:bg-[hsl(150_60%_40%/0.25)] transition-colors border border-[hsl(150_60%_40%/0.3)] disabled:opacity-40"
              >
                {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Preview
              </button>
              {previewPort && (
                <>
                  <button
                    data-testid="button-toggle-preview"
                    onClick={() => setShowPreviewEmbed(prev => !prev)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors border ${
                      showPreviewEmbed
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                    }`}
                  >
                    <Monitor className="w-3 h-3" /> :{previewPort}
                  </button>
                  <button
                    data-testid="button-refresh-preview"
                    onClick={() => setPreviewKey(k => k + 1)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(200_60%_40%/0.15)] text-[hsl(200_60%_55%)] hover:bg-[hsl(200_60%_40%/0.25)] transition-colors border border-[hsl(200_60%_40%/0.3)]"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <a href={`http://localhost:${previewPort}`} target="_blank" rel="noopener noreferrer" data-testid="link-preview-external" className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-secondary/30 text-muted-foreground hover:bg-secondary/50 transition-colors border border-border/30">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button data-testid="button-stop-preview" onClick={stopPreview} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20">
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                data-testid="button-publish-community"
                onClick={() => { setPublishDescription(''); setShowPublishDialog(true); }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(280_60%_50%/0.15)] text-[hsl(280_60%_65%)] hover:bg-[hsl(280_60%_50%/0.25)] transition-colors border border-[hsl(280_60%_50%/0.3)]"
              >
                <Upload className="w-3 h-3" /> Publish
              </button>
            </div>
          )}

          <div className="flex items-center gap-0.5 bg-secondary/40 rounded-md p-0.5 shrink-0">
            <button
              onClick={() => setMode('browser')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                mode === 'browser' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="w-3 h-3" /> Browser
            </button>
            <button
              onClick={() => setMode('api')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                mode === 'api' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3 h-3" /> API
            </button>
          </div>

          <button
            onClick={() => toggleAutoApply(!autoApplyEnabled)}
            data-testid="button-auto-apply-toggle"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors shrink-0 ${
              autoApplyEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-transparent'
            }`}
            title={autoApplyEnabled ? 'Auto-apply ON — safe changes apply automatically' : 'Auto-apply OFF — all changes require confirmation'}
          >
            <Zap className={`w-3 h-3 ${autoApplyEnabled ? 'fill-green-400' : ''}`} />
            Auto
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={copyContextToClipboard}
              disabled={contextLoading || !projectContext}
              data-testid="button-copy-context"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 disabled:opacity-40"
            >
              {contextLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />}
              Context
            </button>
            <button
              onClick={copyEvolutionContext}
              disabled={evolutionLoading}
              data-testid="button-evolution-context"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-[hsl(280_80%_55%/0.15)] text-[hsl(280_80%_65%)] hover:bg-[hsl(280_80%_55%/0.25)] transition-colors border border-[hsl(280_80%_55%/0.3)] disabled:opacity-40"
            >
              {evolutionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dna className="w-3 h-3" />}
              Evolve
              {currentPlan && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[hsl(280_80%_55%)] animate-pulse" />}
            </button>
            {lastErrors && (
              <button
                onClick={() => buildErrorFeedback(lastErrors)}
                data-testid="button-send-errors-top"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20"
              >
                <AlertTriangle className="w-3 h-3" /> Errors
              </button>
            )}
          </div>

          {toasterAvailability !== null && (
            <button
              onClick={async () => {
                clearAvailabilityCache();
                const result = await checkToasterAvailability(toasterConfig);
                setToasterAvailability(result);
                if (result.available) {
                  setStatusMessage(`Toaster connected — ${result.models.length} model${result.models.length !== 1 ? 's' : ''}: ${result.models.slice(0, 3).join(', ')}${result.version ? ` (v${result.version})` : ''}`);
                } else {
                  setStatusMessage(`Toaster: ${result.error || 'Connection failed'}`);
                }
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border shrink-0 cursor-pointer transition-colors ${
                toasterAvailability.available
                  ? 'bg-[hsl(150_60%_40%/0.1)] text-[hsl(150_60%_55%)] border-[hsl(150_60%_40%/0.2)] hover:bg-[hsl(150_60%_40%/0.2)]'
                  : 'bg-secondary/20 text-muted-foreground/50 border-border/20 hover:bg-secondary/40 hover:text-muted-foreground'
              }`}
              data-testid="button-ollama-toaster"
              title={toasterAvailability.available
                ? `Connected — ${toasterAvailability.models.slice(0, 3).join(', ')}${toasterAvailability.version ? ` (v${toasterAvailability.version})` : ''}\nClick to test connection`
                : `${toasterAvailability.error || 'Not connected'}\nClick to test connection`
              }
            >
              <Bot className="w-3 h-3" />
              {toasterLoading ? (
                <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing...</>
              ) : toasterAvailability.available ? (
                <span>Toaster</span>
              ) : (
                <span>Toaster off</span>
              )}
            </button>
          )}

          <button
            data-testid="button-open-settings"
            onClick={() => {
              const cfg = getGuardianConfig();
              const tc = loadToasterConfig();
              setSettingsSharedPat(cfg.sharedPat);
              setSettingsUserPat(cfg.userPat || '');
              setSettingsOllamaEndpoint(tc.endpoint);
              setSettingsOllamaModel(tc.model);
              setShowSettings(prev => !prev);
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border shrink-0 transition-colors ${
              showSettings
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-secondary/20 text-muted-foreground/50 border-border/20 hover:text-foreground hover:border-border/40'
            }`}
          >
            <Settings className="w-3 h-3" />
          </button>

          {lastToasterAnalysis && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border shrink-0 bg-[hsl(280_60%_50%/0.1)] text-[hsl(280_60%_65%)] border-[hsl(280_60%_50%/0.2)]" data-testid="status-toaster-analysis">
              <Zap className="w-2.5 h-2.5" />
              <span className="truncate max-w-[150px]" title={lastToasterAnalysis.error_summary}>
                {lastToasterAnalysis.priority}: {lastToasterAnalysis.affected_files.length} file{lastToasterAnalysis.affected_files.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {statusMessage && (
            <span className="text-[9px] text-primary/70 truncate max-w-[200px]" title={statusMessage}>{statusMessage}</span>
          )}
          {autoApplyUndoVisible && (
            <button
              onClick={undoAutoApply}
              data-testid="button-auto-apply-undo"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 animate-pulse"
            >
              <Undo2 className="w-3 h-3" /> Undo
            </button>
          )}

          {appliedChanges.length > 0 && (
            <div className="ml-auto flex items-center gap-1 overflow-x-auto shrink-0">
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground/40 shrink-0">Applied:</span>
              {appliedChanges.slice(-3).map((change, i) => (
                <button key={i} onClick={() => rollback(change)} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive text-[9px] transition-colors shrink-0 group">
                  <FileCode className="w-2.5 h-2.5" />
                  {change.filePath.split('/').pop()}
                  <Undo2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {appliedChanges.length > 3 && (
                <span className="text-[8px] text-muted-foreground/40">+{appliedChanges.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Unified Layout — Browser/API toggle only swaps main content area ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showProjectPanel && (
          <div className="w-52 border-r border-border/30 bg-card/30 shrink-0 overflow-auto">
            <ProjectExplorer activeProject={activeProject} onSelectProject={handleSelectProject} onFileSelect={(path, content) => setStatusMessage(`Viewing: ${path} (${content.length} chars)`)} onFileEdit={handleFileEdit} />
          </div>
        )}
        {editorFile && (
          <div className="border-r border-border/30 flex flex-col" style={{ flex: '1 1 40%', minWidth: 0 }}>
            <FileEditor
              filePath={editorFile.path}
              content={editorFile.content}
              projectName={activeProject}
              onSave={handleEditorSave}
              onClose={handleEditorClose}
              onSendToGrok={handleEditorSendToGrok}
            />
          </div>
        )}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main content area — switches between Browser and API */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden" style={showPreviewEmbed && previewPort ? { flex: '1 1 50%' } : undefined}>
            {mode === 'browser' && (
              <GrokDesktopBrowser browserUrl={browserUrl} setBrowserUrl={setBrowserUrl} customUrl={customUrl} setCustomUrl={setCustomUrl} />
            )}

            {mode === 'api' && (
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Conversations sidebar */}
                <div className="w-48 border-r border-border/30 bg-card/30 flex flex-col shrink-0">
                  <div className="p-2 border-b border-border/30">
                    <button onClick={newConversation} className="w-full px-2 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium transition-colors">
                      + New Chat
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
                    {conversations.map(c => (
                      <div
                        key={c.id}
                        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors text-[10px] ${
                          c.id === activeConvoId ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
                        }`}
                        onClick={() => switchConversation(c.id)}
                      >
                        <span className="flex-1 truncate">{c.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {conversations.length === 0 && (
                      <p className="text-[9px] text-muted-foreground/40 text-center py-4">No conversations yet</p>
                    )}
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Model picker header */}
                  <div className="shrink-0 border-b border-border/30 bg-card/30 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/50">Grok API — direct streaming</span>
                    <div className="relative">
                      <button onClick={() => setShowModelPicker(!showModelPicker)} className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/50 hover:bg-secondary/80 text-[10px] text-muted-foreground transition-colors">
                        {selectedModel.name} <ChevronDown className="w-3 h-3" />
                      </button>
                      {showModelPicker && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border/50 rounded-lg shadow-xl z-50 overflow-hidden">
                          {MODELS.map(m => (
                            <button key={m.id} onClick={() => { setModel(m.id); setShowModelPicker(false); }} className={`w-full text-left px-3 py-2 text-[10px] transition-colors flex items-center justify-between ${m.id === model ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary/50'}`}>
                              <div><div className="font-medium">{m.name}</div><div className="text-[9px] text-muted-foreground">{m.desc}</div></div>
                              {m.id === model && <Check className="w-3 h-3 text-primary" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-auto p-5 space-y-4">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                        <Bot className="w-10 h-10 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Chat with Grok via API</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">Code blocks are auto-validated and one-click applied</p>
                          <p className="text-[9px] text-muted-foreground/40 mt-2">{selectedModel.name} — {selectedModel.desc}</p>
                        </div>
                      </div>
                    )}
                    {messages.map((msg, i) => renderMessage(msg, i))}
                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-accent/30 flex items-center justify-center shrink-0">
                          <Loader2 className="w-3.5 h-3.5 text-accent-foreground animate-spin" />
                        </div>
                        <div className="text-xs text-muted-foreground">Thinking...</div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div className="shrink-0 border-t border-border/50 bg-card/50 p-4">
                    {knowledgeMatches.length > 0 && messages.length === 0 && (
                      <div className="mb-2 px-3 py-1.5 rounded bg-[hsl(280_60%_50%/0.1)] border border-[hsl(280_60%_50%/0.25)] flex items-center gap-2 flex-wrap" data-testid="indicator-built-before">
                        <Dna className="w-3.5 h-3.5 text-[hsl(280_60%_65%)] shrink-0" />
                        <span className="text-[10px] text-[hsl(280_60%_65%)] font-medium" data-testid="text-built-before-count">
                          Similar apps have been built {knowledgeMatches.reduce((sum, m) => sum + (m.entry.stars || 0), 0) || knowledgeMatches.length} time{knowledgeMatches.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[9px] text-[hsl(280_60%_65%/0.7)]">
                          Grok will pick the best starting point
                        </span>
                      </div>
                    )}
                    <div className="flex gap-3 items-end">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => {
                          setInput(e.target.value);
                          if (messages.length === 0 && e.target.value.trim().length > 3) {
                            const matches = searchKnowledge(e.target.value.trim());
                            setKnowledgeMatches(matches);
                          } else if (e.target.value.trim().length <= 3) {
                            setKnowledgeMatches([]);
                          }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Grok to modify code... (Enter to send)"
                        rows={1}
                        className="flex-1 bg-background border border-border/50 rounded-lg px-4 py-3 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30 font-mono min-h-[44px] max-h-32"
                        style={{ height: 'auto', overflow: 'hidden' }}
                        onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }}
                      />
                      <button onClick={sendMessage} disabled={!input.trim() || isLoading} className="px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 shrink-0">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick actions — shared across both modes */}
            {activeProject && quickActions.length > 0 && (
              <div className="shrink-0 border-t border-border/30 bg-card/30 px-3 py-1.5 flex items-center gap-1.5 flex-wrap" data-testid="quick-actions">
                <Wand2 className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                {quickActions.map(action => {
                  const iconMap: Record<string, React.ReactNode> = {
                    AlertTriangle: <AlertTriangle className="w-3 h-3" />,
                    Moon: <Moon className="w-3 h-3" />,
                    Lock: <Lock className="w-3 h-3" />,
                    Palette: <Palette className="w-3 h-3" />,
                    Smartphone: <Smartphone className="w-3 h-3" />,
                    TestTube: <TestTube2 className="w-3 h-3" />,
                    Gauge: <Gauge className="w-3 h-3" />,
                    Zap: <Zap className="w-3 h-3" />,
                    Sparkles: <Sparkles className="w-3 h-3" />,
                  };
                  const categoryColors: Record<string, string> = {
                    fix: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20',
                    enhance: 'bg-[hsl(200_60%_50%/0.1)] text-[hsl(200_60%_60%)] border-[hsl(200_60%_50%/0.2)] hover:bg-[hsl(200_60%_50%/0.2)]',
                    add: 'bg-[hsl(150_60%_50%/0.1)] text-[hsl(150_60%_55%)] border-[hsl(150_60%_50%/0.2)] hover:bg-[hsl(150_60%_50%/0.2)]',
                    optimize: 'bg-[hsl(280_60%_50%/0.1)] text-[hsl(280_60%_65%)] border-[hsl(280_60%_50%/0.2)] hover:bg-[hsl(280_60%_50%/0.2)]',
                  };
                  return (
                    <button
                      key={action.id}
                      data-testid={`button-quick-action-${action.id}`}
                      onClick={() => {
                        if (mode === 'api') {
                          setInput(action.prompt);
                        } else {
                          (async () => {
                            try {
                              if (isElectron) {
                                const { clipboard } = (window as any).require('electron');
                                clipboard.writeText(action.prompt);
                              } else {
                                await navigator.clipboard.writeText(action.prompt);
                              }
                              setStatusMessage(`Copied "${action.label}" prompt to clipboard — paste into Grok`);
                            } catch {
                              setStatusMessage(`Could not copy prompt to clipboard`);
                            }
                          })();
                        }
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors ${categoryColors[action.category] || categoryColors.enhance}`}
                    >
                      {iconMap[action.icon] || <Sparkles className="w-3 h-3" />}
                      {action.label}
                    </button>
                  );
                })}
                {quickActionsLoading && <Loader2 className="w-3 h-3 text-muted-foreground/40 animate-spin" />}
                <button
                  data-testid="button-refresh-quick-actions"
                  onClick={refreshQuickActions}
                  disabled={quickActionsLoading}
                  className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  title="Refresh suggestions"
                >
                  <RefreshCw className={`w-3 h-3 ${quickActionsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* Code extractor — shared across both modes */}
            <ClipboardExtractor onApply={applyBlock} onApplyAll={batchApplyAll} onResponseCaptured={(text) => { lastFullResponseRef.current = text; }} activeProject={activeProject} onGithubImport={handleGitHubImport} />
          </div>

          {/* Preview panel — shared across both modes */}
          {showPreviewEmbed && previewPort && (
            <div className="border-l border-border/30 flex flex-col" style={{ flex: '1 1 50%' }}>
              <div className="flex items-center gap-2 px-2 py-1 bg-card/50 border-b border-border/30 shrink-0">
                <Monitor className="w-3 h-3 text-[hsl(150_60%_55%)]" />
                <span className="text-[10px] font-medium text-foreground/80">{activeProject} Preview</span>
                <span className="text-[9px] text-muted-foreground/50">:{previewPort}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    data-testid="button-refresh-preview-panel"
                    onClick={() => setPreviewKey(k => k + 1)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(200_60%_40%/0.15)] text-[hsl(200_60%_55%)] hover:bg-[hsl(200_60%_40%/0.25)] transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                  <button
                    data-testid="button-close-preview-panel"
                    onClick={() => setShowPreviewEmbed(false)}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {showDiagnoseBanner && (
                <div className={`shrink-0 px-3 py-2 border-b flex items-center gap-3 flex-wrap ${
                  diagnoseStuck
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-destructive/10 border-destructive/30'
                }`} data-testid="banner-diagnose-fix">
                  <AlertCircle className={`w-4 h-4 shrink-0 ${diagnoseStuck ? 'text-amber-400' : 'text-destructive'}`} />
                  {diagnoseStuck ? (
                    <>
                      <span className="text-[11px] text-amber-400 font-medium" data-testid="text-diagnose-stuck">
                        Stuck — {diagnoseFixCycleCount} fix cycles without success. Try describing the issue manually or revert changes.
                      </span>
                      <button
                        data-testid="button-diagnose-reset"
                        onClick={dismissDiagnoseBanner}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors border border-amber-500/30 font-medium"
                      >
                        <RefreshCw className="w-3 h-3" /> Reset Cycles
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-destructive font-medium" data-testid="text-diagnose-errors-detected">
                        Errors detected after applying changes
                      </span>
                      <button
                        data-testid="button-diagnose-fix"
                        onClick={handleDiagnoseFix}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors border border-destructive/30 font-bold"
                      >
                        <Zap className="w-3 h-3" /> Diagnose & Fix
                      </button>
                      {diagnoseFixCycleCount > 0 && (
                        <span className="text-[9px] text-muted-foreground/60" data-testid="text-diagnose-cycle-count">
                          Cycle {diagnoseFixCycleCount}/3
                        </span>
                      )}
                    </>
                  )}
                  <button
                    data-testid="button-dismiss-diagnose"
                    onClick={dismissDiagnoseBanner}
                    className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <iframe
                ref={previewIframeRef}
                key={previewKey}
                src={`http://localhost:${previewPort}`}
                data-testid="iframe-preview"
                className="flex-1 w-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                title={`${activeProject} preview`}
              />
              <LogsPanel
                logs={previewLogs}
                onClearLogs={clearPreviewLogs}
                onSendLogsToGrok={handleSendLogsToGrok}
                activeProject={activeProject}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GrokBridge;
