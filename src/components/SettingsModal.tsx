import React, { useState } from 'react';
import { ApiConfig, DEFAULT_API_CONFIG, AVAILABLE_MODELS } from '@/lib/self-reference';
import { X, Server, Key, Globe, Cpu } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (config: ApiConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [draft, setDraft] = useState<ApiConfig>({ ...config });

  if (!isOpen) return null;

  const providerInfo = AVAILABLE_MODELS[draft.provider];

  const handleProviderChange = (provider: ApiConfig['provider']) => {
    const info = AVAILABLE_MODELS[provider];
    setDraft({
      provider,
      baseUrl: info.defaultUrl,
      apiKey: provider === config.provider ? config.apiKey : '',
      model: info.models[0] || '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="window-chrome rounded-lg w-full max-w-md mx-4 border-glow">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground/90">API Configuration</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Provider selection */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
              Provider
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['ollama', 'openai', 'anthropic', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`text-[11px] py-2 px-2 rounded border transition-all ${
                    draft.provider === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:border-border hover:bg-muted/50'
                  }`}
                >
                  {p === 'ollama' ? '🦙 Ollama' : p === 'openai' ? '🤖 OpenAI' : p === 'anthropic' ? '🧠 Claude' : '⚡ Custom'}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Base URL
            </label>
            <input
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              className="w-full bg-input border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="http://localhost:11434"
            />
          </div>

          {/* API Key */}
          {providerInfo?.requiresKey && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                <Key className="w-3 h-3" /> API Key
              </label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                className="w-full bg-input border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="sk-..."
              />
              <p className="text-[9px] text-muted-foreground/50 mt-1">
                Stored locally in browser memory only. Never sent to any server except the provider.
              </p>
            </div>
          )}

          {/* Model */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
              <Server className="w-3 h-3" /> Model
            </label>
            {providerInfo?.models.length ? (
              <select
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                className="w-full bg-input border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {providerInfo.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                className="w-full bg-input border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="model-name"
              />
            )}
          </div>

          {/* Info */}
          {draft.provider === 'ollama' && (
            <div className="border border-border rounded p-3 bg-muted/20">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <span className="text-primary">→</span> Ollama runs locally. Make sure it's running with{' '}
                <code className="bg-muted px-1 py-0.5 rounded text-foreground/70">ollama serve</code> and pull a model with{' '}
                <code className="bg-muted px-1 py-0.5 rounded text-foreground/70">ollama pull {draft.model}</code>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="text-xs px-4 py-2 rounded border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(draft); onClose(); }}
              className="text-xs px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
