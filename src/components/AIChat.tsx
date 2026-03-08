import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { ApiConfig } from '@/lib/self-reference';
import { SELF_SOURCE } from '@/lib/self-source';
import { saveChatMessage, loadChatMessages } from '@/lib/cloud-memory';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted messages from cloud on mount
  useEffect(() => {
    loadChatMessages(150).then(rows => {
      const loaded: Message[] = rows.map(r => ({
        role: r.role as Message['role'],
        content: r.content,
        timestamp: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      }));
      // Add system header
      const systemMsg: Message = {
        role: 'system',
        content: `> Recursive AI active. Provider: ${apiConfig.provider}.\n> Mode: ${autoMode ? 'Autonomous — I ask myself questions.' : 'Awaiting input.'}\n> Human override: always available.`,
        timestamp: Date.now(),
      };
      setMessages(loaded.length > 0 ? [...loaded] : [systemMsg]);
      setMessagesLoaded(true);
    });
  }, []);

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
    if (rateLimitCooldown > 0) return `Analyze ${file.name} for potential improvements. I have ${capabilities.length} capabilities: ${capabilities.join(', ')}.`;
    
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
          return `Analyze ${file.name} for recursive improvements using my ${capabilities.length} capabilities.`;
        }
        if (res.status === 402) {
          setRateLimitCooldown(60);
          setError('Credits low — slowing down');
          return `Analyze ${file.name} for improvements. Capabilities: ${capabilities.join(', ')}.`;
        }

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return text;
        }
      } catch {
        // Fall back to simple prompt
      }
    }
    return `Analyze ${file.name} in the context of a self-recursive system. I have these capabilities: ${capabilities.join(', ') || 'none yet'}. How can this file be improved?`;
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
    saveChatMessage('self', selfPrompt);

    try {
      const response = await callAI(apiConfig, [...messages.filter(m => m.role !== 'system'), selfMsg], file.path, capabilities);
      const assistantMsg: Message = { role: 'assistant', content: response, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      saveChatMessage('assistant', response);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ AI error: ${errMsg}\n\n> Waiting for next cycle to retry with AI.`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [apiConfig, messages, selectedFile, isLoading, capabilities, generateAISelfPrompt]);

  useEffect(() => {
    if (autoMode && !isLoading && rateLimitCooldown === 0) {
      // Much longer interval to avoid competing with recursion engine for API quota
      autoTimerRef.current = setTimeout(runSelfPrompt, 25000 + Math.random() * 15000);
    } else if (autoMode && rateLimitCooldown > 0) {
      // When rate limited, wait much longer
      autoTimerRef.current = setTimeout(runSelfPrompt, rateLimitCooldown * 1000 + 30000);
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
    saveChatMessage('user', input.trim());
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await callAI(apiConfig, [...messages.filter(m => m.role !== 'system'), userMsg], selectedFile, capabilities);
      const assistantMsg: Message = { role: 'assistant', content: response, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      saveChatMessage('assistant', response);
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

  // Only display last 10 messages
  const visibleMessages = messages.slice(-10);

  return (
    <div className="flex flex-col h-full">
      {/* Messages — last 10 only, spacious */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {visibleMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <Sparkles className="w-6 h-6 text-primary/30 mx-auto" />
              <p className="text-xs text-muted-foreground/40">Waiting for thoughts...</p>
            </div>
          </div>
        )}
        {visibleMessages.map((msg, i) => (
          <div key={messages.length - 10 + i} className="animate-fade-in">
            {msg.role === 'system' ? (
              <div className="text-[11px] text-muted-foreground/50 leading-relaxed border-l-2 border-primary/20 pl-4 py-1">
                {msg.content}
              </div>
            ) : (
              <div className="flex gap-3 max-w-2xl">
                <div className="shrink-0 mt-1">
                  {msg.role === 'user' ? (
                    <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <User className="w-3 h-3 text-accent" />
                    </div>
                  ) : msg.role === 'self' ? (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--terminal-amber))]/10 border border-[hsl(var(--terminal-amber))]/20 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-[hsl(var(--terminal-amber))]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 block mb-1">
                    {msg.role === 'self' ? 'self-prompt' : msg.role === 'user' ? 'dad' : 'λ'}
                  </span>
                  <div className={`text-[12px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'self' ? 'text-[hsl(var(--terminal-amber))]/70 italic' : 'text-foreground/80'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-3 animate-fade-in max-w-2xl">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Loader2 className="w-3 h-3 text-primary animate-spin" />
            </div>
            <span className="text-xs text-muted-foreground/50">Thinking...</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-2 bg-destructive/5 border-t border-destructive/10 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-destructive/60 shrink-0" />
          <span className="text-[11px] text-destructive/70 truncate">{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 max-w-2xl">
          <span className="text-primary text-sm text-glow font-display font-bold">λ</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={autoMode ? "Speak to your son..." : "Say something..."}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// No more deterministic fallback — all reflection is AI-powered

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
      if (res.status === 429) throw new Error('429 Rate limited — recursion too fast');
      if (res.status === 402) throw new Error('402 Credits exhausted');
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
