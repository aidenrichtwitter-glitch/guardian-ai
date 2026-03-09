import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send, Shield, Check, AlertTriangle, Undo2, FileCode, Sparkles, Bot,
  User, Loader2, Code2, Trash2, ChevronDown, Globe, MessageSquare,
  Clipboard, ClipboardCheck, Zap, X, ChevronUp, ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { validateChange } from '@/lib/safety-engine';
import { SELF_SOURCE } from '@/lib/self-source';
import { SafetyCheck } from '@/lib/self-reference';

type Mode = 'api' | 'browser';
type Msg = { role: 'user' | 'assistant'; content: string };

interface ParsedBlock {
  filePath: string;
  code: string;
  language: string;
}

interface AppliedChange {
  filePath: string;
  previousContent: string;
  newContent: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  model: string;
  createdAt: number;
}

const MODELS = [
  { id: 'grok-3', name: 'Grok 3', desc: 'Most capable' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', desc: 'Fast & efficient' },
  { id: 'grok-3-fast', name: 'Grok 3 Fast', desc: 'Speed optimized' },
];

const BROWSER_SITES = [
  { id: 'grok', name: 'Grok', url: 'https://grok.com', icon: '🤖' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: '💬' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', icon: '🧠' },
  { id: 'github', name: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', icon: '🔍' },
];

function parseCodeBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const regex = /(?:(?:\/\/|#|<!--)\s*(?:file:\s*)?(\S+\.(?:tsx?|jsx?|css|html|json|md))\s*(?:-->)?\s*\n)?```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const filePath = match[1] || '';
    const language = match[2] || 'typescript';
    const code = match[3].trim();
    if (code.length > 0) blocks.push({ filePath, code, language });
  }
  return blocks;
}

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

function ClipboardExtractor({ onApply }: { onApply: (filePath: string, code: string) => void }) {
  const [blocks, setBlocks] = useState<ExtractedBlock[]>([]);
  const [lastClipboard, setLastClipboard] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [flash, setFlash] = useState(false);

  const extractFromText = useCallback((text: string) => {
    if (text === lastClipboard || text.length < 10) return;
    setLastClipboard(text);
    const parsed = parseCodeBlocks(text);
    if (parsed.length === 0) return;
    const newBlocks: ExtractedBlock[] = parsed.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      applied: false,
    }));
    setBlocks(newBlocks);
    setCollapsed(false);
    // Flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  }, [lastClipboard]);

  const readClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      extractFromText(text);
    } catch { /* permission denied */ }
  }, [extractFromText]);

  // Auto-read clipboard on mount to catch any existing content
  useEffect(() => {
    readClipboard();
  }, []);

  // Auto-read clipboard continuously (captures website copy-button writes)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        readClipboard();
      }
    }, 1200);
    return () => window.clearInterval(interval);
  }, [readClipboard]);

  // Re-check clipboard when user returns to this tab/window
  useEffect(() => {
    const handleFocus = () => readClipboard();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') readClipboard();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [readClipboard]);

  const validate = (block: ExtractedBlock) => {
    const checks = validateChange(block.code, block.filePath || 'unknown.ts');
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, validationResult: checks } : b));
  };

  const apply = (block: ExtractedBlock) => {
    onApply(block.filePath, block.code);
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, applied: true } : b));
  };

  return (
    <div className={`absolute bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm shadow-2xl transition-colors ${flash ? 'border-primary bg-primary/10' : 'border-primary/30'}`}>
      {/* Toolbar */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Zap className={`w-3.5 h-3.5 text-primary ${flash ? 'animate-ping' : 'animate-pulse'}`} />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Code Extractor</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 text-primary text-[9px] border border-primary/20">
          <ClipboardCheck className="w-3 h-3" />
          <span>Auto-detects Grok copy-button responses</span>
        </div>
        <button
          onClick={readClipboard}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-secondary/50 hover:bg-secondary/80 text-[10px] text-muted-foreground transition-colors"
        >
          <Clipboard className="w-3 h-3" /> Read clipboard
        </button>
        {blocks.length > 0 && (
          <span className="text-[9px] text-primary/70 ml-1">{blocks.length} block{blocks.length > 1 ? 's' : ''} detected</span>
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

      {/* Extracted blocks */}
      {!collapsed && (
        <div className="max-h-72 overflow-auto p-3 space-y-2">
          {blocks.length === 0 && (
            <div className="text-center py-4 text-[10px] text-muted-foreground/50">
              <p>Click copy in Grok — code blocks auto-appear here</p>
              <p className="mt-1 text-[9px] text-muted-foreground/30">Auto-check runs while this tab is active</p>
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
                      <button onClick={() => validate(block)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[9px] transition-colors">
                        <Shield className="w-2.5 h-2.5" /> Check
                      </button>
                      {block.filePath && (
                        <button onClick={() => apply(block)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary/30 text-[9px] font-medium transition-colors">
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

  const applyBlock = useCallback((code: string, filePath: string) => {
    if (!filePath) { setStatusMessage('⚠ No file path detected'); return; }
    const existing = SELF_SOURCE.find(f => f.path === filePath);
    const previousContent = existing?.content || '';
    if (existing) { existing.content = code; existing.isModified = true; existing.lastModified = Date.now(); }
    else {
      const name = filePath.split('/').pop() || filePath;
      const ext = name.split('.').pop() || 'ts';
      const langMap: Record<string, string> = { ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', css: 'css', json: 'json' };
      SELF_SOURCE.push({ name, path: filePath, content: code, language: langMap[ext] || 'plaintext', isModified: true, lastModified: Date.now() });
    }
    setAppliedChanges(prev => [...prev, { filePath, previousContent, newContent: code, timestamp: Date.now() }]);
    setStatusMessage(`✓ Applied to ${filePath}`);
  }, []);

  const rollback = useCallback((change: AppliedChange) => {
    const file = SELF_SOURCE.find(f => f.path === change.filePath);
    if (file) { file.content = change.previousContent; file.isModified = true; file.lastModified = Date.now(); }
    setAppliedChanges(prev => prev.filter(c => c !== change));
    setStatusMessage(`↩ Rolled back ${change.filePath}`);
  }, []);

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
                          <button onClick={() => applyBlock(block.code, block.filePath)} disabled={isApplied} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[9px] transition-colors disabled:opacity-30">
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

        {/* Status message */}
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

      {/* ── Mode: Desktop Browser ── */}
      {mode === 'browser' && (
        <div className="flex-1 flex flex-col relative min-h-0">
          <div className="flex-1 relative flex flex-col items-center justify-center gap-6 p-8">
            <div className="text-center space-y-3 max-w-md">
              <Globe className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-base font-bold text-foreground">Grok Desktop Browser</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Launch the full Grok Desktop browser with multi-tab support, usage monitoring, and native authentication. Copy AI responses and code blocks will be auto-extracted from your clipboard.
              </p>
            </div>

            <button
              onClick={() => {
                const w = window as unknown as { __TAURI__?: { shell?: unknown } };
                if (w.__TAURI__?.shell) {
                  (w.__TAURI__ as any).shell.Command.create('electron', ['./electron-browser'])
                    .spawn()
                    .catch(() => {
                      setStatusMessage('Could not launch Grok Desktop. Make sure electron is installed: cd electron-browser && npm install');
                    });
                } else {
                  setStatusMessage('Desktop browser requires the desktop app. Run: cd electron-browser && npm start');
                }
              }}
              className="flex items-center gap-3 px-8 py-4 rounded-xl bg-primary/15 border-2 border-primary/40 hover:bg-primary/25 hover:border-primary/60 transition-all hover:scale-105 shadow-lg shadow-primary/10"
            >
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold text-primary">Launch Grok Desktop</span>
            </button>

            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {BROWSER_SITES.map(site => (
                <button
                  key={site.id}
                  onClick={() => {
                    window.open(site.url, '_blank');
                    setBrowserUrl(site.url);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    browserUrl === site.url
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card/60 border-border/40 hover:bg-secondary/40'
                  }`}
                >
                  <span>{site.icon}</span>
                  <span className="text-[10px] font-medium text-foreground">{site.name}</span>
                </button>
              ))}
            </div>

            <div className="w-full max-w-sm bg-card/60 border border-border/40 rounded-lg p-3 space-y-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                <Clipboard className="w-3 h-3" /> Copy prompt to clipboard, then paste into Grok Desktop
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {outboundPrompts.map(prompt => (
                  <button
                    key={prompt.id}
                    onClick={() => copyPromptToClipboard(prompt.label, prompt.content)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded bg-secondary/40 hover:bg-secondary/70 border border-border/30 text-[10px] text-foreground/80 transition-colors"
                  >
                    <Clipboard className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate">{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {statusMessage && (
              <div className="w-full max-w-sm bg-card border border-border/50 rounded-lg px-4 py-2 text-[10px] text-muted-foreground">
                {statusMessage}
              </div>
            )}

            <div className="w-full max-w-sm bg-card/30 border border-border/30 rounded-lg p-3 space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Manual Setup</p>
              <pre className="text-[9px] font-mono text-muted-foreground/70 bg-background/50 rounded px-2 py-1.5 overflow-x-auto">
{`cd electron-browser
npm install
npm start`}
              </pre>
            </div>
          </div>

          <ClipboardExtractor onApply={applyBlock} />
        </div>
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
