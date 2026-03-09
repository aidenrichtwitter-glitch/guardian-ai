import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send, Shield, Check, AlertTriangle, Undo2, FileCode, Sparkles, Bot,
  User, Loader2, Code2, Trash2, ChevronDown, Globe, MessageSquare,
  Clipboard, ClipboardCheck, Zap, X, ChevronUp, ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { validateChange } from '@/lib/safety-engine';
import { SELF_SOURCE } from '@/lib/self-source';
import { SafetyCheck } from '@/lib/self-reference';
import { parseCodeBlocks, ParsedBlock } from '@/lib/code-parser';

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

function ClipboardExtractor({ onApply, onApplyAll }: { onApply: (filePath: string, code: string) => void; onApplyAll?: (blocks: { filePath: string; code: string }[]) => void }) {
  const [blocks, setBlocks] = useState<ExtractedBlock[]>([]);
  const [responseContext, setResponseContext] = useState<string>('');
  const [contextSections, setContextSections] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(true);
  const [lastClipboard, setLastClipboard] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [clipboardAvailable, setClipboardAvailable] = useState(true);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const extractFromText = useCallback((text: string) => {
    if (text === lastClipboard || text.length < 10) return;
    setLastClipboard(text);
    setResponseContext(text);
    setContextSections(extractContextSections(text));
    const parsed = parseCodeBlocks(text);
    const newBlocks: ExtractedBlock[] = parsed.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      applied: false,
    }));
    setBlocks(newBlocks);
    setCollapsed(false);
    setShowPasteBox(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  }, [lastClipboard]);

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

  return (
    <div className={`absolute bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm shadow-2xl transition-colors ${flash ? 'border-primary bg-primary/10' : 'border-primary/30'}`}>
      {/* Toolbar */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-border/30">
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
          onClick={() => { setShowPasteBox(p => !p); setTimeout(() => pasteRef.current?.focus(), 50); }}
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
          <span className="text-[9px] text-primary/70 ml-1">{blocks.length} block{blocks.length > 1 ? 's' : ''} detected</span>
        )}
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
            <button onClick={() => setBlocks([])} className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => setCollapsed(c => !c)} className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors">
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Extracted blocks + context */}
      {!collapsed && (
        <div className="max-h-96 overflow-auto p-3 space-y-2">
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
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{pending.exists ? 'Modify' : 'Create'} File</span>
            <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">{pending.filePath}</span>
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
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            {pending.exists ? 'Changes' : 'New File Content'} ({pending.newContent.split('\n').length} lines)
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
  onApply: (filePath: string, code: string) => void;
  onApplyAll?: (blocks: { filePath: string; code: string }[]) => void;
}

function GrokDesktopBrowser({ browserUrl, setBrowserUrl, customUrl, setCustomUrl, onApply, onApplyAll }: GrokDesktopBrowserProps) {
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

    const onLoading = () => setLoading(true);
    const onLoaded = () => setLoading(false);
    const onNavigation = (e: any) => {
      if (e.url && e.url !== currentUrlRef.current) {
        currentUrlRef.current = e.url;
        setBrowserUrl(e.url);
      }
    };

    wv.addEventListener('did-start-loading', onLoading);
    wv.addEventListener('did-stop-loading', onLoaded);
    wv.addEventListener('did-navigate', onNavigation);

    return () => {
      wv.removeEventListener('did-start-loading', onLoading);
      wv.removeEventListener('did-stop-loading', onLoaded);
      wv.removeEventListener('did-navigate', onNavigation);
    };
  }, [setBrowserUrl]);

  const currentSite = BROWSER_SITES.find(s => browserUrl.startsWith(s.url));

  if (!isElectron) {
    return (
      <div className="flex-1 flex flex-col relative min-h-0">
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
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-center space-y-3 max-w-lg">
            <Globe className="w-10 h-10 text-primary/60 mx-auto" />
            <h2 className="text-base font-bold text-foreground" data-testid="text-browser-status">Web Mode</h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Running in web mode. Sites open in new browser tabs. For the full embedded browser experience, run the desktop app with <code className="text-primary/80">npm run electron:dev</code>
            </p>
          </div>
        </div>
        <ClipboardExtractor onApply={onApply} onApplyAll={onApplyAll} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative min-h-0">
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

      <div className="flex-1 relative min-h-0">
        {/* @ts-ignore - webview is an Electron-specific HTML element */}
        <webview
          ref={(el: any) => { webviewRef.current = el; }}
          src={initialUrlRef.current}
          partition="persist:grok"
          data-testid="webview-browser"
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowpopups="true"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Loading {currentSite?.name || 'page'}...</p>
            </div>
          </div>
        )}
      </div>

      <ClipboardExtractor onApply={onApply} onApplyAll={onApplyAll} />
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
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [validationResults, setValidationResults] = useState<Map<string, SafetyCheck[]>>(new Map());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [browserUrl, setBrowserUrl] = useState('https://grok.com');
  const [customUrl, setCustomUrl] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    const userMsg: Msg = { role: 'user', content: text };
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
        setConversations(prev => prev.map(c => c.id === convoId ? { ...c, messages: [...allMessages, { role: 'assistant' as const, content: assistantSoFar }], title: generateTitle(allMessages), model } : c));
      },
      onError: (err) => { setIsLoading(false); setStatusMessage(`⚠ ${err}`); },
    });
  }, [input, isLoading, messages, model, activeConvoId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const runValidation = useCallback((blockKey: string, code: string, filePath: string) => {
    const checks = validateChange(code, filePath || 'unknown.ts');
    setValidationResults(prev => new Map(prev).set(blockKey, checks));
  }, []);

  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);
  const [applyStage, setApplyStage] = useState<ApplyStage>('confirm');
  const [applyStageMessage, setApplyStageMessage] = useState('');
  const [applyCompileError, setApplyCompileError] = useState('');
  const lastBackupPathRef = useRef('');

  const applyBlock = useCallback(async (filePath: string, code: string) => {
    if (!filePath) { setStatusMessage('⚠ No file path detected'); return; }

    if (isElectron) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const readResult = await ipcRenderer.invoke('read-file', { filePath });
        if (!readResult.success) { setStatusMessage(`⚠ ${readResult.error}`); return; }
        const safetyChecks = validateChange(code, filePath);
        setPendingApply({
          filePath,
          newContent: code,
          oldContent: readResult.content || '',
          exists: readResult.exists ?? false,
          safetyChecks,
        });
        setApplyStage('confirm');
        setApplyStageMessage('');
        setApplyCompileError('');
        lastBackupPathRef.current = '';
      } catch (e: any) {
        setStatusMessage(`⚠ ${e.message || 'Failed to read file'}`);
      }
    } else {
      try {
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
        const safetyChecks = validateChange(code, filePath);
        setPendingApply({
          filePath,
          newContent: code,
          oldContent: readData.content || '',
          exists: readData.exists ?? false,
          safetyChecks,
        });
        setApplyStage('confirm');
        setApplyStageMessage('');
        setApplyCompileError('');
      } catch (e: any) {
        setStatusMessage(`⚠ ${e.message || 'Failed to read file'}`);
      }
    }
  }, []);

  const confirmApply = useCallback(async () => {
    if (!pendingApply) return;
    const { filePath, newContent, oldContent } = pendingApply;
    try {
      if (isElectron) {
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

      const existing = SELF_SOURCE.find(f => f.path === filePath);
      if (existing) { existing.content = newContent; existing.isModified = true; existing.lastModified = Date.now(); }
      else {
        const name = filePath.split('/').pop() || filePath;
        const ext = name.split('.').pop() || 'ts';
        const langMap: Record<string, string> = { ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', css: 'css', json: 'json' };
        SELF_SOURCE.push({ name, path: filePath, content: newContent, language: langMap[ext] || 'plaintext', isModified: true, lastModified: Date.now() });
      }

      setAppliedChanges(prev => [...prev, {
        filePath,
        previousContent: oldContent,
        newContent,
        timestamp: Date.now(),
        backupPath: lastBackupPathRef.current,
      }]);
    } catch (e: any) {
      setApplyStage('error');
      setApplyStageMessage(`Error: ${e.message || 'Unknown failure'}`);
    }
  }, [pendingApply]);

  const rollbackPending = useCallback(async () => {
    if (!pendingApply) { setPendingApply(null); return; }
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
    if (!isElectron || blocks.length === 0) return;
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

      setBatchStage('done');
      const gitNote = commitResult.success ? ' + committed' : '';
      setBatchMessage(`${blocks.length} files applied${gitNote}`);

      setTimeout(() => { setBatchStage('idle'); setBatchMessage(''); }, 4000);
    } catch (e: any) {
      setBatchStage('error');
      setBatchMessage(`Error: ${e.message || 'Unknown'}`);
    }
  }, []);

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

  const buildProjectContext = useCallback(async () => {
    setContextLoading(true);
    try {
      let context = `=== PROJECT CONTEXT ===\n`;
      context += `This is a React + TypeScript + Vite desktop app (Electron) called Guardian AI ("lambda Recursive").\n\n`;

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

        context += `=== FILE TREE ===\n`;
        context += fileTree.slice(0, 80).join('\n') + '\n';
        if (fileTree.length > 80) context += `... (${fileTree.length} total files)\n`;

        if (gitResult.success && gitResult.log) {
          context += `\n=== RECENT GIT LOG ===\n${gitResult.log}\n`;
        }

        if (contentsResult.success) {
          for (const file of contentsResult.files) {
            context += `\n=== ${file.path} ===\n${file.content}\n`;
          }
        }
      } else {
        context += `=== FILE TREE ===\n`;
        context += SELF_SOURCE.map(f => f.path).join('\n') + '\n';

        for (const file of SELF_SOURCE.filter(f => f.content && f.content.length < 8000).slice(0, 15)) {
          context += `\n=== ${file.path} ===\n${file.content}\n`;
        }
      }

      if (lastErrors) {
        context += `\n=== CURRENT ERRORS ===\n${lastErrors}\n`;
      }

      context += `\n=== INSTRUCTIONS ===\n`;
      context += `When suggesting code changes, use this exact format for each file:\n`;
      context += `// file: path/to/file.tsx\n`;
      context += `\`\`\`tsx\n// full file content here\n\`\`\`\n`;
      context += `Include the complete file content, not partial patches.\n`;
      context += `The code extractor will automatically detect and apply these blocks.\n`;

      setProjectContext(context);
      setContextLoading(false);
    } catch (e: any) {
      setContextLoading(false);
      setStatusMessage(`⚠ Context build failed: ${e.message}`);
    }
  }, [lastErrors]);

  useEffect(() => {
    if (mode === 'browser') {
      buildProjectContext();
    }
  }, [mode]);

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

  const buildErrorFeedback = useCallback(async (errorText: string) => {
    setLastErrors(errorText);
    const errorPrompt = `The following errors occurred after applying code changes:\n\n${errorText}\n\n` +
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
      setStatusMessage('✓ Error feedback copied — paste into Grok for fix');
    } catch {
      setStatusMessage('⚠ Could not copy error feedback');
    }
  }, [projectContext]);

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
    const blocks = parseCodeBlocks(msg.content);
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
    <div className="h-full flex flex-col bg-background text-foreground font-mono">
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

      {/* ── Top bar with mode toggle ── */}
      <div className="shrink-0 border-b border-border/40 bg-card/60 px-4 py-2 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[hsl(var(--terminal-amber))]" />
          <span className="text-xs font-bold text-foreground">AI Bridge</span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 bg-secondary/40 rounded-lg p-0.5">
          <button
            onClick={() => setMode('browser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
              mode === 'browser' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="w-3 h-3" /> Browser Chat
          </button>
          <button
            onClick={() => setMode('api')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
              mode === 'api' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-3 h-3" /> API Chat
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={copyContextToClipboard}
            disabled={contextLoading || !projectContext}
            data-testid="button-copy-context"
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 disabled:opacity-40"
          >
            {contextLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />}
            Copy Context
          </button>
          {lastErrors && (
            <button
              onClick={() => buildErrorFeedback(lastErrors)}
              data-testid="button-send-errors-top"
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20"
            >
              <AlertTriangle className="w-3 h-3" /> Send Errors
            </button>
          )}
        </div>

        {statusMessage && (
          <span className="text-[9px] text-primary/70 ml-2">{statusMessage}</span>
        )}

        {/* Applied changes */}
        {appliedChanges.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[8px] uppercase tracking-widest text-muted-foreground/40 shrink-0">Applied:</span>
            {appliedChanges.map((change, i) => (
              <button key={i} onClick={() => rollback(change)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive text-[9px] transition-colors shrink-0 group">
                <FileCode className="w-2.5 h-2.5" />
                {change.filePath.split('/').pop()}
                <Undo2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mode: Browser Chat (Grok Desktop webview) ── */}
      {mode === 'browser' && (
        <GrokDesktopBrowser browserUrl={browserUrl} setBrowserUrl={setBrowserUrl} customUrl={customUrl} setCustomUrl={setCustomUrl} onApply={applyBlock} onApplyAll={batchApplyAll} />
      )}

      {/* ── Mode: API Chat ── */}
      {mode === 'api' && (
        <div className="flex-1 flex min-h-0">
          {/* Conversations sidebar */}
          <div className="w-52 border-r border-border/30 bg-card/30 flex flex-col shrink-0">
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
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
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
    </div>
  );
};

export default GrokBridge;
