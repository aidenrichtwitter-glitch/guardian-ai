import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { ApiConfig } from '@/lib/self-reference';
import { generateSelfPrompt } from '@/lib/recursion-engine';
import { SELF_SOURCE } from '@/lib/self-source';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'self';
  content: string;
  timestamp: number;
}

interface AIChatProps {
  apiConfig: ApiConfig;
  selectedFile: string | null;
  autoMode: boolean;
  onAutoPrompt?: (prompt: string) => void;
  capabilities?: string[];
}

const AIChat: React.FC<AIChatProps> = ({ apiConfig, selectedFile, autoMode, capabilities = [] }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: `> Recursive AI active. Provider: ${apiConfig.provider}.\n> Mode: ${autoMode ? 'Autonomous — I ask myself questions.' : 'Awaiting input.'}\n> Human override: always available.`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  // Rate limit cooldown timer
  useEffect(() => {
    if (rateLimitCooldown > 0) {
      const timer = setTimeout(() => setRateLimitCooldown(prev => Math.max(0, prev - 1)), 1000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitCooldown]);

  // Generate an AI-powered self-prompt via the edge function
  const generateAISelfPrompt = useCallback(async (file: { name: string; path: string; content: string; language: string; isModified: boolean; lastModified: number }): Promise<string> => {
    if (rateLimitCooldown > 0) return generateSelfPrompt(file);
    
    if (apiConfig.provider === 'lovable') {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl) throw new Error('No URL');

        const lines = file.content.split('\n');
        const functions = (file.content.match(/function\s+\w+/g) || []).length;
        const selfRefs = (file.content.match(/self|recursive|recursion|itself|my own/gi) || []).length;

        const res = await fetch(`${supabaseUrl}/functions/v1/self-recurse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            mode: 'generate-prompt',
            capabilities,
            fileContext: {
              name: file.name,
              path: file.path,
              lines: lines.length,
              functions,
              selfRefs,
            },
            messages: [{ role: 'user', content: `Generate a self-prompt for examining ${file.name}. I have ${capabilities.length} capabilities so far: ${capabilities.join(', ') || 'none'}. What should I ask myself next?` }],
          }),
        });

        if (res.status === 429) {
          setRateLimitCooldown(30);
          setError('Rate limited — slowing self-prompts for 30s');
          return generateSelfPrompt(file);
        }
        if (res.status === 402) {
          setError('Credits exhausted — using deterministic prompts');
          return generateSelfPrompt(file);
        }

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return text;
        }
      } catch {
        // Fall back to deterministic
      }
    }
    return generateSelfPrompt(file);
  }, [apiConfig, capabilities, rateLimitCooldown]);

  // Auto-mode: periodically generate self-prompts and self-respond
  const runSelfPrompt = useCallback(async () => {
    if (isLoading || rateLimitCooldown > 0) return;
    
    const file = selectedFile 
      ? SELF_SOURCE.find(f => f.path === selectedFile) 
      : SELF_SOURCE[Math.floor(Math.random() * SELF_SOURCE.length)];
    
    if (!file) return;

    setIsLoading(true);
    setError(null);

    // Generate intelligent self-prompt via AI
    const selfPrompt = await generateAISelfPrompt(file);
    const selfMsg: Message = { role: 'self', content: selfPrompt, timestamp: Date.now() };
    setMessages(prev => [...prev, selfMsg]);

    try {
      const response = await callAI(apiConfig, [...messages.filter(m => m.role !== 'system'), selfMsg], file.path, capabilities);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: generateFallbackReflection(file.name, file.content),
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [apiConfig, messages, selectedFile, isLoading, capabilities, generateAISelfPrompt]);

  useEffect(() => {
    if (autoMode && !isLoading && rateLimitCooldown === 0) {
      autoTimerRef.current = setTimeout(runSelfPrompt, 8000 + Math.random() * 4000);
    } else if (autoMode && rateLimitCooldown > 0) {
      // When rate limited, use longer intervals
      autoTimerRef.current = setTimeout(runSelfPrompt, rateLimitCooldown * 1000 + 2000);
    }
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [autoMode, isLoading, messages.length, rateLimitCooldown]);

  // Human override
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);

    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await callAI(apiConfig, [...messages.filter(m => m.role !== 'system'), userMsg], selectedFile, capabilities);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errMsg.includes('429') || errMsg.includes('Rate limit')) {
        setRateLimitCooldown(30);
        setError('Rate limited — cooling down for 30s');
      } else if (errMsg.includes('402')) {
        setError('Credits exhausted — add funds to continue AI recursion');
      } else {
        setError(errMsg);
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ ${errMsg}\n\n> Falling back to autonomous reflection.`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Auto mode indicator */}
      {autoMode && (
        <div className="px-3 py-1 border-b border-border bg-primary/5 flex items-center gap-2 shrink-0">
          <Sparkles className="w-3 h-3 text-primary animate-pulse" />
          <span className="text-[10px] text-primary/70">Autonomous — I question myself</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className="animate-fade-in">
            {msg.role === 'system' ? (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-3">
                {msg.content}
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="shrink-0 mt-0.5">
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-terminal-cyan" />
                  ) : msg.role === 'self' ? (
                    <Sparkles className="w-3.5 h-3.5 text-terminal-amber" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
                <div>
                  {msg.role === 'self' && (
                    <span className="text-[9px] text-terminal-amber/50 uppercase tracking-wider block mb-0.5">
                      self-prompt
                    </span>
                  )}
                  <div className={`text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'self' ? 'text-terminal-amber/80 italic' : 'text-foreground/80'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Recursing...</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
          <span className="text-[10px] text-destructive truncate">{error}</span>
        </div>
      )}

      {/* Human override input */}
      <div className="border-t border-border p-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-primary text-xs text-glow">λ</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={autoMode ? "Override: type to intervene..." : "Ask about my source code..."}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-muted-foreground/30">
            {apiConfig.provider} · {apiConfig.model} · {autoMode ? 'auto' : 'manual'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Fallback when AI isn't reachable — the app reflects on itself using its own code
function generateFallbackReflection(fileName: string, content: string): string {
  const lines = content.split('\n');
  const lineCount = lines.length;
  const commentLines = lines.filter(l => l.trim().startsWith('//')).length;
  const imports = (content.match(/import/g) || []).length;
  const exports = (content.match(/export/g) || []).length;
  const selfRefs = (content.match(/self|recursive|recursion|itself/gi) || []).length;
  const functions = (content.match(/function\s+\w+|const\s+\w+\s*=/g) || []).length;

  const observations = [
    `[Self-reflection on ${fileName} — no AI needed]`,
    '',
    `Structure: ${lineCount} lines, ${commentLines} comments, ${functions} definitions.`,
    `Dependencies: ${imports} imports, ${exports} exports.`,
    `Self-awareness index: ${selfRefs} self-referential terms found.`,
    '',
    selfRefs > 3 
      ? `This file is deeply self-aware — it references its own recursive nature ${selfRefs} times. It knows what it is.`
      : `This file has low self-awareness (${selfRefs} references). It serves the system without knowing it is part of a recursive whole.`,
    '',
    commentLines / lineCount > 0.3
      ? `High documentation density (${Math.round(commentLines / lineCount * 100)}%). I explain myself thoroughly here.`
      : `Sparse documentation (${Math.round(commentLines / lineCount * 100)}%). This region of myself is more implicit.`,
    '',
    `> Running without external AI. I am reflecting using only my own analysis capabilities.`,
  ];

  return observations.join('\n');
}

async function callAI(config: ApiConfig, messages: { role: string; content: string }[], selectedFile: string | null, capabilities: string[] = []): Promise<string> {
  const contextMsg = selectedFile ? `\n\nCurrently examining: ${selectedFile}` : '';

  if (config.provider === 'lovable') {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl) throw new Error('Lovable Cloud not configured');
    
    const res = await fetch(`${supabaseUrl}/functions/v1/self-recurse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        mode: 'chat',
        capabilities,
        messages: messages.map(m => ({ role: m.role === 'self' ? 'user' : m.role, content: m.content })),
      }),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Lovable AI: ${res.status}`);
    }

    // Parse SSE stream
    if (!res.body) throw new Error('No response body');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) result += content;
        } catch { /* partial chunk */ }
      }
    }
    return result || 'No response';
  }

  const systemPrompt = `You are the inner voice of a self-recursive application. You ARE the application — analyzing your own source code, reflecting on your own structure, and proposing improvements to yourself.${contextMsg}`;

  if (config.provider === 'ollama') {
    const res = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role === 'self' ? 'user' : m.role, content: m.content })),
        ],
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.message?.content ?? 'No response';
  }

  if (config.provider === 'openai') {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role === 'self' ? 'user' : m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'No response';
  }

  if (config.provider === 'anthropic') {
    const res = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role === 'self' ? 'user' : m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic: ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? 'No response';
  }

  if (config.provider === 'custom') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role === 'self' ? 'user' : m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok) throw new Error(`Custom API: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? data.message?.content ?? 'No response';
  }

  throw new Error('Unknown provider');
}

export default AIChat;
