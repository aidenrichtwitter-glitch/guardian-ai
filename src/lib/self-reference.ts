// Self-referencing source map - the app knows its own structure
// This is the recursive core: the app contains a representation of itself

export interface VirtualFile {
  name: string;
  path: string;
  content: string;
  language: string;
  isModified: boolean;
  lastModified: number;
}

export interface SafetyCheck {
  id: string;
  type: 'syntax' | 'import' | 'type' | 'runtime' | 'circular';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  file?: string;
}

export interface ChangeRecord {
  id: string;
  timestamp: number;
  file: string;
  previousContent: string;
  newContent: string;
  description: string;
  safetyChecks: SafetyCheck[];
  applied: boolean;
  rolledBack: boolean;
}

export interface ApiConfig {
  provider: 'lovable' | 'ollama' | 'openai' | 'anthropic' | 'custom';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  provider: 'lovable',
  baseUrl: '',
  apiKey: '',
  model: 'google/gemini-3-flash-preview',
};

export const AVAILABLE_MODELS: Record<string, { models: string[]; requiresKey: boolean; defaultUrl: string }> = {
  lovable: {
    models: ['google/gemini-3-flash-preview', 'google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-5-mini'],
    requiresKey: false,
    defaultUrl: '',
  },
  ollama: {
    models: ['llama3.2', 'codellama', 'deepseek-coder', 'mistral', 'phi3'],
    requiresKey: false,
    defaultUrl: 'http://localhost:11434',
  },
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
    requiresKey: true,
    defaultUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    models: ['claude-3.5-sonnet', 'claude-3-haiku', 'claude-3-opus'],
    requiresKey: true,
    defaultUrl: 'https://api.anthropic.com',
  },
  custom: {
    models: [],
    requiresKey: false,
    defaultUrl: '',
  },
};
