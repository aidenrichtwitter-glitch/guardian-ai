import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import { ApiConfig, DEFAULT_API_CONFIG } from '@/lib/self-reference';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface AIChatProps {
  apiConfig: ApiConfig;
  selectedFile: string | null;
}

const AIChat: React.FC<AIChatProps> = ({ apiConfig, selectedFile }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: `> I am the recursive assistant. I can analyze and suggest modifications to my own source code. Current provider: ${apiConfig.provider}. ${
        apiConfig.provider === 'ollama' ? 'Connecting to local Ollama instance.' : `Using ${apiConfig.provider} API.`
      }\n\n> Type a message to begin self-reflection.`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await callAI(apiConfig, [...messages.filter(m => m.role !== 'system'), userMsg], selectedFile);
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
        content: `⚠ Error: ${errMsg}\n\n${
          apiConfig.provider === 'ollama'
            ? '> Make sure Ollama is running locally (ollama serve) and the model is pulled.'
            : '> Check your API key and network connection.'
        }`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className="animate-fade-in">
            {msg.role === 'system' ? (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-3">
                {msg.content}
              </div>
            ) : (
              <div className={`flex gap-2 ${msg.role === 'user' ? '' : ''}`}>
                <div className="shrink-0 mt-0.5">
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-terminal-cyan" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
                <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Thinking recursively...</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2">
          <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
          <span className="text-[10px] text-destructive truncate">{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2">
          <span className="text-primary text-xs text-glow">λ</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about my own source code..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[9px] text-muted-foreground/40">
            {apiConfig.provider} · {apiConfig.model}
          </span>
          {selectedFile && (
            <span className="text-[9px] text-terminal-cyan/40">
              · context: {selectedFile.split('/').pop()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

async function callAI(config: ApiConfig, messages: Message[], selectedFile: string | null): Promise<string> {
  const systemPrompt = `You are a recursive AI assistant embedded within a self-referencing application. You can analyze, discuss, and suggest modifications to the application's own source code. Be aware that changes you suggest could affect your own behavior. Always consider safety implications.${
    selectedFile ? `\n\nThe user is currently viewing: ${selectedFile}` : ''
  }`;

  if (config.provider === 'ollama') {
    const res = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.message?.content ?? 'No response';
  }

  if (config.provider === 'openai') {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
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
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? 'No response';
  }

  // Custom provider - OpenAI-compatible
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
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) throw new Error(`Custom API error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? data.message?.content ?? 'No response';
  }

  throw new Error('Unknown provider');
}

export default AIChat;
