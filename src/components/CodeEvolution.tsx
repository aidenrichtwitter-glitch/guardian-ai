import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Copy, Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface CodeEvolutionProps {
  capabilities: string[];
  capabilityHistory: { name: string; description: string; builtOn: string[] }[];
}

const CodeEvolution: React.FC<CodeEvolutionProps> = ({ capabilities, capabilityHistory }) => {
  const [selectedCap, setSelectedCap] = useState<string | null>(null);
  const [code, setCode] = useState<string>('// Select a capability to view its source code');
  const [copied, setCopied] = useState(false);

  // Load capability source from virtual filesystem
  const loadCapabilitySource = useCallback((capName: string) => {
    // Try to find in SELF_SOURCE via dynamic import pattern
    try {
      const stored = localStorage.getItem(`explorer-file-${capName}`);
      if (stored) {
        setCode(stored);
        return;
      }
    } catch {}
    
    setCode(`// Source for "${capName}" not found in local storage.\n// The capability exists but its source may have been generated before persistence was added.\n\n// Capability: ${capName}\n// ${capabilityHistory.find(c => c.name === capName)?.description || 'No description'}`);
  }, [capabilityHistory]);

  useEffect(() => {
    if (selectedCap) loadCapabilitySource(selectedCap);
  }, [selectedCap, loadCapabilitySource]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recentCaps = capabilityHistory.slice(-15);

  return (
    <div className="flex flex-col h-full">
      {/* Capability selector */}
      <div className="px-3 py-2 border-b border-border bg-muted/10 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider">Code Evolution</span>
        </div>
        <div className="flex flex-wrap gap-1 max-h-20 overflow-auto">
          {recentCaps.map(cap => (
            <button
              key={cap.name}
              onClick={() => setSelectedCap(cap.name)}
              className={`text-[8px] px-1.5 py-0.5 rounded transition-all ${
                selectedCap === cap.name
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-muted/20 text-muted-foreground border border-border/50 hover:border-primary/30'
              }`}
            >
              {cap.name}
            </button>
          ))}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="typescript"
          theme="vs-dark"
          value={code}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 11,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'none',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/10 shrink-0">
        <span className="text-[9px] text-muted-foreground">
          {selectedCap ? `${selectedCap} — ${capabilityHistory.find(c => c.name === selectedCap)?.description?.substring(0, 60) || ''}...` : 'No capability selected'}
        </span>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
};

export default CodeEvolution;
