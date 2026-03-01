import React, { useState, useCallback } from 'react';
import { Settings, Terminal, Brain, Shield, History, FileCode, RefreshCw } from 'lucide-react';
import DesktopWindow from '@/components/DesktopWindow';
import FileTree from '@/components/FileTree';
import CodeViewer from '@/components/CodeViewer';
import AIChat from '@/components/AIChat';
import SettingsModal from '@/components/SettingsModal';
import ChangeLog, { rollbackChange } from '@/components/ChangeLog';
import { ApiConfig, DEFAULT_API_CONFIG, ChangeRecord } from '@/lib/self-reference';

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>('src/lib/self-reference.ts');
  const [activePanel, setActivePanel] = useState<string>('code');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    const saved = localStorage.getItem('recursive-api-config');
    return saved ? JSON.parse(saved) : DEFAULT_API_CONFIG;
  });
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [rightPanel, setRightPanel] = useState<'chat' | 'history'>('chat');

  const handleSaveConfig = useCallback((config: ApiConfig) => {
    setApiConfig(config);
    localStorage.setItem('recursive-api-config', JSON.stringify(config));
  }, []);

  const handleChangeApplied = useCallback((record: ChangeRecord) => {
    setChanges(prev => [record, ...prev]);
  }, []);

  const handleRollback = useCallback((changeId: string) => {
    setChanges(prev => prev.map(c => {
      if (c.id === changeId) {
        rollbackChange(c);
        return { ...c, rolledBack: true };
      }
      return c;
    }));
    // Force re-render by toggling file
    setSelectedFile(prev => {
      const tmp = prev;
      setTimeout(() => setSelectedFile(tmp), 0);
      return null;
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary text-glow animate-pulse-glow" />
            <h1 className="text-sm font-display font-bold text-foreground">
              <span className="text-primary text-glow">λ</span> Recursive
            </h1>
          </div>
          <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
            self-referential development environment
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              apiConfig.provider === 'ollama' ? 'bg-terminal-green animate-pulse-glow' : 'bg-terminal-cyan'
            }`} />
            <span className="text-[10px] text-muted-foreground">
              {apiConfig.provider} · {apiConfig.model}
            </span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            title="API Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        <aside className="w-56 border-r border-border bg-card/30 overflow-auto shrink-0 hidden md:block">
          <DesktopWindow
            title="Explorer"
            icon={<FileCode className="w-3 h-3" />}
            isActive={activePanel === 'tree'}
            onFocus={() => setActivePanel('tree')}
            className="h-full border-0 rounded-none"
          >
            <FileTree onSelectFile={setSelectedFile} selectedFile={selectedFile} />
          </DesktopWindow>
        </aside>

        {/* Center - Code Viewer */}
        <main className="flex-1 flex flex-col min-w-0">
          <DesktopWindow
            title={selectedFile?.split('/').pop() ?? 'No file selected'}
            icon={<Terminal className="w-3 h-3" />}
            isActive={activePanel === 'code'}
            onFocus={() => setActivePanel('code')}
            statusText={selectedFile ?? undefined}
            className="flex-1 border-0 rounded-none"
          >
            <CodeViewer filePath={selectedFile} onChangeApplied={handleChangeApplied} />
          </DesktopWindow>
        </main>

        {/* Right panel - AI Chat or History */}
        <aside className="w-80 border-l border-border bg-card/30 flex flex-col shrink-0 hidden lg:flex">
          {/* Panel tabs */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setRightPanel('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                rightPanel === 'chat'
                  ? 'text-primary border-b border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Brain className="w-3 h-3" /> AI Chat
            </button>
            <button
              onClick={() => setRightPanel('history')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                rightPanel === 'history'
                  ? 'text-primary border-b border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-3 h-3" /> Changes
              {changes.length > 0 && (
                <span className="text-[9px] px-1 py-0 rounded bg-primary/20 text-primary">
                  {changes.length}
                </span>
              )}
            </button>
          </div>

          {rightPanel === 'chat' ? (
            <div className="flex-1 overflow-hidden">
              <AIChat apiConfig={apiConfig} selectedFile={selectedFile} />
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <ChangeLog changes={changes} onRollback={handleRollback} />
            </div>
          )}
        </aside>
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-border bg-card/30 text-[10px] text-muted-foreground/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" /> Safety: Active
          </span>
          <span>{changes.filter(c => c.applied && !c.rolledBack).length} changes applied</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Recursion depth: ∞ → bounded</span>
          <span className="text-primary text-glow animate-blink">▊</span>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={apiConfig}
        onSave={handleSaveConfig}
      />
    </div>
  );
};

export default Index;
