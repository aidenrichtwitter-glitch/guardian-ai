import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Shield, Check, AlertTriangle, Undo2, FileCode, Sparkles, Bot, User, Loader2, Code2, Trash2, ChevronDown, Download, Globe, PanelRightClose, PanelRight } from 'lucide-react';
import { validateChange } from '@/lib/safety-engine';
import { SELF_SOURCE } from '@/lib/self-source';
import { SafetyCheck } from '@/lib/self-reference';

// Detect if running inside Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

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
  { id: 'google', name: 'Google', url: 'https://google.com', icon: '🔍' },
  { id: 'docs', name: 'Tauri Docs', url: 'https://tauri.app/v2/guides/', icon: '📚' },
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

async function streamGrok({
  messages,
  model,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  model: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, model }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      onError(data.error || `Error ${resp.status}`);
      return;
    }

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
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') { onDone(); return; }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* partial json */ }
      }
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : 'Stream failed');
  }
}

function generateTitle(messages: Msg[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.content.slice(0, 50) + (first.content.length > 50 ? '...' : '');
}

const STORAGE_KEY = 'grok-conversations';

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConversations(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, 50)));
}

const GrokBridge: React.FC = () => {
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
  const [showBrowser, setShowBrowser] = useState(true);
  const [browserUrl, setBrowserUrl] = useState('https://grok.com');
  const [customUrl, setCustomUrl] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist conversations
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  const newConversation = useCallback(() => {
    const convo: Conversation = {
      id: crypto.randomUUID(),
      title: 'New conversation',
      messages: [],
      model,
      createdAt: Date.now(),
    };
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(convo.id);
    setMessages([]);
    setAppliedChanges([]);
    setValidationResults(new Map());
  }, [model]);

  const switchConversation = useCallback((id: string) => {
    if (activeConvoId && messages.length > 0) {
      setConversations(prev => prev.map(c =>
        c.id === activeConvoId ? { ...c, messages, title: generateTitle(messages) } : c
      ));
    }
    const convo = conversations.find(c => c.id === id);
    if (convo) {
      setActiveConvoId(id);
      setMessages(convo.messages);
      setModel(convo.model);
      setAppliedChanges([]);
    }
  }, [activeConvoId, messages, conversations]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) {
      setActiveConvoId(null);
      setMessages([]);
    }
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
      messages: allMessages,
      model,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      },
      onDone: () => {
        setIsLoading(false);
        setConversations(prev => prev.map(c =>
          c.id === convoId ? { ...c, messages: [...allMessages, { role: 'assistant' as const, content: assistantSoFar }], title: generateTitle(allMessages), model } : c
        ));
      },
      onError: (err) => {
        setIsLoading(false);
        setStatusMessage(`⚠ ${err}`);
      },
    });
  }, [input, isLoading, messages, model, activeConvoId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const runValidation = useCallback((blockKey: string, code: string, filePath: string) => {
    const checks = validateChange(code, filePath || 'unknown.ts');
    setValidationResults(prev => new Map(prev).set(blockKey, checks));
  }, []);

  const applyBlock = useCallback((code: string, filePath: string) => {
    if (!filePath) {
      setStatusMessage('⚠ No file path detected for this block');
      return;
    }
    const existing = SELF_SOURCE.find(f => f.path === filePath);
    const previousContent = existing?.content || '';

    if (existing) {
      existing.content = code;
      existing.isModified = true;
      existing.lastModified = Date.now();
    } else {
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
              {text.trim() && (
                <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{text.trim()}</p>
              )}
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
                        <span className="text-[10px] text-muted-foreground truncate">
                          {block.filePath || block.language}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => runValidation(blockKey, block.code, block.filePath)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[9px] transition-colors"
                        >
                          <Shield className="w-2.5 h-2.5" /> Check
                        </button>
                        {block.filePath && (
                          <button
                            onClick={() => applyBlock(block.code, block.filePath)}
                            disabled={isApplied}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[9px] transition-colors disabled:opacity-30"
                          >
                            <Check className="w-2.5 h-2.5" /> {isApplied ? 'Applied' : 'Apply'}
                          </button>
                        )}
                      </div>
                    </div>
                    <pre className="p-3 text-[10px] text-foreground/70 max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed font-mono">
                      {block.code}
                    </pre>
                    {checks && (
                      <div className="px-3 py-1.5 border-t border-border/30 space-y-0.5">
                        {checks.map((check, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-[9px]">
                            {check.severity === 'error' ? (
                              <AlertTriangle className="w-2.5 h-2.5 text-destructive shrink-0" />
                            ) : check.severity === 'warning' ? (
                              <AlertTriangle className="w-2.5 h-2.5 text-[hsl(var(--terminal-amber))] shrink-0" />
                            ) : (
                              <Check className="w-2.5 h-2.5 text-primary shrink-0" />
                            )}
                            <span className={
                              check.severity === 'error' ? 'text-destructive' :
                              check.severity === 'warning' ? 'text-[hsl(var(--terminal-amber))]' : 'text-primary/70'
                            }>{check.message}</span>
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

  return (
    <div className="h-full flex bg-background text-foreground font-mono">
      {/* Left panel: chat (with inline conversation list) */}
      <div className={`flex flex-col min-w-0 ${showBrowser ? 'w-[360px] shrink-0' : 'flex-1'} border-r border-border/30`}>
        {/* Header */}
          <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[hsl(var(--terminal-amber))]" />
                <h1 className="text-xs font-bold text-foreground">AI Chat</h1>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowBrowser(!showBrowser)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[hsl(var(--terminal-amber))]/10 text-[hsl(var(--terminal-amber))] hover:bg-[hsl(var(--terminal-amber))]/20 text-[9px] font-medium transition-colors"
                >
                  {showBrowser ? <PanelRightClose className="w-3 h-3" /> : <PanelRight className="w-3 h-3" />}
                  {showBrowser ? 'Hide' : 'Browser'}
                </button>
                {/* Model picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/50 hover:bg-secondary/80 text-[9px] text-muted-foreground transition-colors"
                  >
                    {selectedModel.name}
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                  {showModelPicker && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border/50 rounded-lg shadow-xl z-50 overflow-hidden">
                      {MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                          className={`w-full text-left px-3 py-2 text-[10px] transition-colors flex items-center justify-between ${
                            m.id === model ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary/50'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{m.name}</div>
                            <div className="text-[9px] text-muted-foreground">{m.desc}</div>
                          </div>
                          {m.id === model && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Conversation list + new chat button */}
          <div className="border-b border-border/30 bg-card/30 px-2 py-2 shrink-0 space-y-1">
            <button
              onClick={newConversation}
              className="w-full px-2 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium transition-colors"
            >
              + New Chat
            </button>
            {conversations.length > 0 && (
              <div className="max-h-24 overflow-auto space-y-0.5">
                {conversations.map(c => (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors text-[9px] ${
                      c.id === activeConvoId ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
                    }`}
                    onClick={() => switchConversation(c.id)}
                  >
                    <span className="flex-1 truncate">{c.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50">
                <Bot className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Chat with Grok</p>
                  <p className="text-[9px] text-muted-foreground/40 mt-1">
                    {selectedModel.name} — {selectedModel.desc}
                  </p>
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

          {/* Applied changes bar */}
          {appliedChanges.length > 0 && (
            <div className="border-t border-border/30 bg-card/30 px-6 py-2 flex items-center gap-3 overflow-x-auto shrink-0">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 shrink-0">Applied:</span>
              {appliedChanges.map((change, i) => (
                <button
                  key={i}
                  onClick={() => rollback(change)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive text-[9px] transition-colors shrink-0 group"
                >
                  <FileCode className="w-2.5 h-2.5" />
                  {change.filePath.split('/').pop()}
                  <Undo2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border/50 bg-card/50 p-4 shrink-0">
            <div className="flex gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Grok to modify code..."
                rows={1}
                className="flex-1 bg-background border border-border/50 rounded-lg px-4 py-3 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30 font-mono min-h-[44px] max-h-32"
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

      {/* ═══ Embedded Browser Panel ═══ */}
      {showBrowser && (
        <div className="flex-1 flex flex-col bg-card/20 min-w-0">
          {/* Browser toolbar */}
          <div className="border-b border-border/30 bg-card/50 px-3 py-2 flex items-center gap-2 shrink-0">
            {/* Site quick-select buttons */}
            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
              {BROWSER_SITES.map(site => (
                <button
                  key={site.id}
                  onClick={() => setBrowserUrl(site.url)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors ${
                    browserUrl === site.url
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent'
                  }`}
                >
                  <span>{site.icon}</span>
                  <span>{site.name}</span>
                </button>
              ))}
            </div>
            {/* Custom URL input */}
            <div className="flex items-center gap-1 shrink-0">
              <input
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customUrl.trim()) {
                    const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
                    setBrowserUrl(url);
                    setCustomUrl('');
                  }
                }}
                placeholder="URL..."
                className="w-32 bg-background border border-border/50 rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
              />
              <button
                onClick={() => {
                  if (customUrl.trim()) {
                    const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
                    setBrowserUrl(url);
                    setCustomUrl('');
                  }
                }}
                className="p-1 rounded bg-secondary/50 hover:bg-secondary/80 transition-colors"
              >
                <Globe className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Browser address bar */}
          <div className="border-b border-border/20 bg-card/30 px-3 py-1.5 flex items-center gap-2">
            <Globe className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[10px] text-muted-foreground/70 truncate flex-1">{browserUrl}</span>
            {currentSite && (
              <span className="text-[9px] text-primary/60 shrink-0">{currentSite.name}</span>
            )}
          </div>

          {/* Iframe */}
          <div className="flex-1 relative">
            <iframe
              key={browserUrl}
              src={browserUrl}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              allow="clipboard-write"
              title="Embedded Browser"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GrokBridge;
