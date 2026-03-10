import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Save, Send, X, AlertTriangle, Check, Loader2, FileCode } from 'lucide-react';
import { validateChange } from '@/lib/safety-engine';
import { SafetyCheck } from '@/lib/self-reference';

interface FileEditorProps {
  filePath: string;
  content: string;
  projectName: string | null;
  onSave: (filePath: string, content: string) => Promise<void>;
  onClose: () => void;
  onSendToGrok?: (prompt: string) => void;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql',
    graphql: 'graphql',
    toml: 'toml',
  };
  return map[ext] || 'plaintext';
}

const FileEditor: React.FC<FileEditorProps> = ({ filePath, content, projectName, onSave, onClose, onSendToGrok }) => {
  const [editorContent, setEditorContent] = useState(content);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationChecks, setValidationChecks] = useState<SafetyCheck[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const editorRef = useRef<any>(null);
  const saveRef = useRef<() => void>(() => {});

  useEffect(() => {
    setEditorContent(content);
    setIsDirty(false);
    setValidationChecks([]);
    setSaveStatus('idle');
  }, [filePath, content]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveStatus('idle');

    const checks = validateChange(editorContent, filePath, content);
    setValidationChecks(checks);

    try {
      await onSave(filePath, editorContent);
      setIsDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setSaving(false);
    }
  }, [editorContent, filePath, content, onSave, saving]);

  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  const handleSendToGrok = useCallback(() => {
    if (!onSendToGrok) return;
    const prompt = `Here is the current content of ${filePath}:\n\n\`\`\`${detectLanguage(filePath)}\n${editorContent}\n\`\`\`\n\nHelp me improve/fix this file.`;
    onSendToGrok(prompt);
  }, [filePath, editorContent, onSendToGrok]);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
    editor.addCommand(
      2048 + 49,
      () => { saveRef.current(); }
    );
  }, []);

  const language = detectLanguage(filePath);

  return (
    <div className="flex flex-col h-full bg-background" data-testid="panel-file-editor">
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-card/50">
        <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-[10px] font-medium text-foreground/80 truncate flex-1" data-testid="text-editor-filepath">
          {projectName ? `${projectName}/` : ''}{filePath}
        </span>
        {isDirty && (
          <span className="text-[8px] text-amber-400 shrink-0">Modified</span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-[9px] text-[hsl(150_60%_55%)] shrink-0" data-testid="text-save-success">
            <Check className="w-2.5 h-2.5" /> Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1 text-[9px] text-destructive shrink-0" data-testid="text-save-error">
            <AlertTriangle className="w-2.5 h-2.5" /> Save failed
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            data-testid="button-editor-save"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors border border-primary/20 disabled:opacity-30"
            title="Save (Ctrl+S)"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
          {onSendToGrok && (
            <button
              data-testid="button-editor-send-to-grok"
              onClick={handleSendToGrok}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-[hsl(280_60%_50%/0.15)] text-[hsl(280_60%_65%)] hover:bg-[hsl(280_60%_50%/0.25)] transition-colors border border-[hsl(280_60%_50%/0.3)]"
              title="Send file content to Grok for help"
            >
              <Send className="w-3 h-3" /> Send to Grok
            </button>
          )}
          <button
            data-testid="button-editor-close"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            title="Close editor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={editorContent}
          theme="vs-dark"
          onChange={(value) => {
            const newVal = value || '';
            setEditorContent(newVal);
            setIsDirty(newVal !== content);
          }}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      </div>

      {validationChecks.length > 0 && validationChecks.some(c => c.severity !== 'info') && (
        <div className="shrink-0 border-t border-border/30 bg-card/30 px-3 py-1.5 max-h-24 overflow-auto" data-testid="panel-editor-validation">
          {validationChecks.filter(c => c.severity !== 'info').map((check, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[9px] py-0.5">
              {check.severity === 'error' ? (
                <AlertTriangle className="w-2.5 h-2.5 text-destructive shrink-0" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              )}
              <span className={check.severity === 'error' ? 'text-destructive' : 'text-amber-400'}>
                {check.message}
              </span>
              {check.line && (
                <span className="text-muted-foreground/50">Line {check.line}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileEditor;
