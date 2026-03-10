import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, FileCode, Folder, FolderOpen,
  Plus, Trash2, FolderOpen as FolderOpenIcon, RefreshCw, Loader2, X, GitBranch, Pencil
} from 'lucide-react';
import {
  listProjects, createProject, deleteProject, getProjectFiles,
  readProjectFile, importFromGitHub, type Project, type ProjectFileNode,
  type GitHubImportProgress
} from '@/lib/project-manager';

interface ProjectExplorerProps {
  activeProject: string | null;
  onSelectProject: (projectName: string | null) => void;
  onFileSelect?: (filePath: string, content: string) => void;
  onFileEdit?: (filePath: string, content: string) => void;
}

const FileNode: React.FC<{
  node: ProjectFileNode;
  depth: number;
  projectName: string;
  selectedFile: string | null;
  onSelect: (path: string, content: string) => void;
  onEdit?: (path: string, content: string) => void;
}> = ({ node, depth, projectName, selectedFile, onSelect, onEdit }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === 'directory';
  const isSelected = node.path === selectedFile;

  const handleClick = async () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      try {
        const content = await readProjectFile(projectName, node.path);
        onSelect(node.path, content);
      } catch {
        onSelect(node.path, '');
      }
    }
  };

  return (
    <div
      className="group/filerow"
      onMouseEnter={(e) => {
        const editBtn = e.currentTarget.querySelector('[data-edit-btn]') as HTMLElement;
        if (editBtn) editBtn.style.visibility = 'visible';
      }}
      onMouseLeave={(e) => {
        const editBtn = e.currentTarget.querySelector('[data-edit-btn]') as HTMLElement;
        if (editBtn) editBtn.style.visibility = 'hidden';
      }}
    >
      <button
        data-testid={`file-node-${node.path}`}
        className={`flex items-center gap-1.5 w-full px-2 py-0.5 text-left text-xs transition-colors hover:bg-muted/50 ${
          isSelected ? 'bg-primary/10 text-primary' : 'text-foreground/70'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          <>
            {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
            {expanded ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3 h-3 shrink-0" />
            <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {!isDir && onEdit && (
          <span
            data-edit-btn
            data-testid={`button-edit-file-${node.path}`}
            role="button"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const content = await readProjectFile(projectName, node.path);
                onEdit(node.path, content);
              } catch {
                onEdit(node.path, '');
              }
            }}
            className="p-0.5 hover:text-primary transition-all shrink-0"
            style={{ visibility: 'hidden' }}
            title="Edit in Monaco editor"
          >
            <Pencil className="w-2.5 h-2.5" />
          </span>
        )}
      </button>
      {isDir && expanded && node.children?.map(child => (
        <FileNode key={child.path} node={child} depth={depth + 1} projectName={projectName} selectedFile={selectedFile} onSelect={onSelect} onEdit={onEdit} />
      ))}
    </div>
  );
};

const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ activeProject, onSelectProject, onFileSelect, onFileEdit }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileTree, setFileTree] = useState<ProjectFileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFramework, setNewFramework] = useState<'react' | 'vanilla' | 'html'>('react');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<GitHubImportProgress | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } catch {}
    setLoading(false);
  }, []);

  const fetchFileTree = useCallback(async (name: string) => {
    setTreeLoading(true);
    try {
      const tree = await getProjectFiles(name);
      setFileTree(tree);
    } catch {
      setFileTree([]);
    }
    setTreeLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (activeProject) {
      fetchFileTree(activeProject);
      setSelectedFile(null);
    } else {
      setFileTree([]);
    }
  }, [activeProject, fetchFileTree]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProject(newName.trim().replace(/\s+/g, '-').toLowerCase(), newFramework, newDescription);
      await fetchProjects();
      onSelectProject(newName.trim().replace(/\s+/g, '-').toLowerCase());
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
    } catch {}
    setCreating(false);
  };

  const handleImportGitHub = async () => {
    if (!importUrl.trim() || importing) return;
    setImporting(true);
    setImportProgress({ stage: 'parsing', message: 'Parsing GitHub URL...' });
    try {
      const result = await importFromGitHub(importUrl.trim(), (progress) => {
        setImportProgress(progress);
      });
      await fetchProjects();
      onSelectProject(result.projectName);
      setShowImport(false);
      setImportUrl('');
      setImportProgress(null);
    } catch (e: any) {
      setImportProgress({ stage: 'error', message: e.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteProject(name);
      if (activeProject === name) onSelectProject(null);
      await fetchProjects();
    } catch {}
  };

  const handleFileSelect = (path: string, content: string) => {
    setSelectedFile(path);
    onFileSelect?.(path, content);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FolderOpenIcon className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Projects</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="button-refresh-projects"
            onClick={fetchProjects}
            className="p-1 hover:bg-muted/50 rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            data-testid="button-import-github"
            onClick={() => setShowImport(true)}
            className="p-1 hover:bg-muted/50 rounded transition-colors"
            title="Import from GitHub"
          >
            <GitBranch className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            data-testid="button-new-project"
            onClick={() => setShowCreate(true)}
            className="p-1 hover:bg-muted/50 rounded transition-colors"
          >
            <Plus className="w-3 h-3 text-primary" />
          </button>
        </div>
      </div>

      {showImport && (
        <div className="px-3 py-2 border-b border-border/30 bg-card/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold text-foreground uppercase">Import from GitHub</span>
            <button onClick={() => { setShowImport(false); setImportProgress(null); }} className="p-0.5 hover:bg-muted/50 rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <input
            data-testid="input-github-url"
            type="text"
            placeholder="https://github.com/owner/repo"
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleImportGitHub(); }}
            className="w-full px-2 py-1 text-[10px] bg-background border border-border/50 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
            disabled={importing}
          />
          {importProgress && (
            <div className={`text-[9px] px-2 py-1 rounded ${importProgress.stage === 'error' ? 'bg-destructive/10 text-destructive' : importProgress.stage === 'done' ? 'bg-[hsl(150_60%_55%/0.1)] text-[hsl(150_60%_55%)]' : 'bg-primary/10 text-primary'}`} data-testid="text-import-progress">
              <div className="flex items-center gap-1">
                {importProgress.stage !== 'done' && importProgress.stage !== 'error' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                {importProgress.message}
              </div>
            </div>
          )}
          <button
            data-testid="button-import-github-submit"
            onClick={handleImportGitHub}
            disabled={!importUrl.trim() || importing}
            className="w-full px-2 py-1 rounded text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
          >
            {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
            {importing ? 'Importing...' : 'Import Repository'}
          </button>
        </div>
      )}

      {showCreate && (
        <div className="px-3 py-2 border-b border-border/30 bg-card/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold text-foreground uppercase">New Project</span>
            <button onClick={() => setShowCreate(false)} className="p-0.5 hover:bg-muted/50 rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <input
            data-testid="input-project-name"
            type="text"
            placeholder="Project name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-2 py-1 text-[10px] bg-background border border-border/50 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            data-testid="input-project-description"
            type="text"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            className="w-full px-2 py-1 text-[10px] bg-background border border-border/50 rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex gap-1">
            {(['react', 'vanilla', 'html'] as const).map(fw => (
              <button
                key={fw}
                data-testid={`button-framework-${fw}`}
                onClick={() => setNewFramework(fw)}
                className={`px-2 py-0.5 rounded text-[9px] transition-colors ${
                  newFramework === fw
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground border border-border/30 hover:bg-muted/50'
                }`}
              >
                {fw === 'react' ? 'React' : fw === 'vanilla' ? 'Vanilla TS' : 'HTML'}
              </button>
            ))}
          </div>
          <button
            data-testid="button-create-project"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="w-full px-2 py-1 rounded text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Create Project
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <button
          data-testid="button-select-main-app"
          onClick={() => onSelectProject(null)}
          className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-left text-[10px] transition-colors ${
            !activeProject ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/30'
          }`}
        >
          <FolderOpenIcon className="w-3 h-3" />
          Main App (λ Recursive)
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </div>
        ) : (
          <>
            {projects.map(p => (
              <div key={p.name} className="group">
                <button
                  data-testid={`button-select-project-${p.name}`}
                  onClick={() => onSelectProject(p.name)}
                  className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-left text-[10px] transition-colors ${
                    activeProject === p.name ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-[8px] text-muted-foreground/40">{p.framework}</span>
                  <button
                    data-testid={`button-delete-project-${p.name}`}
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </button>
              </div>
            ))}
            {projects.length === 0 && !loading && (
              <p className="text-[9px] text-muted-foreground/40 text-center py-3">No projects yet</p>
            )}
          </>
        )}

        {activeProject && (
          <>
            <div className="px-3 py-1.5 border-t border-border/30 flex items-center justify-between">
              <span className="text-[9px] font-semibold text-foreground/60 uppercase tracking-wider">Files</span>
              <button
                data-testid="button-refresh-files"
                onClick={() => fetchFileTree(activeProject)}
                className="p-0.5 hover:bg-muted/50 rounded transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            </div>
            {treeLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              </div>
            ) : fileTree.length > 0 ? (
              fileTree.map(node => (
                <FileNode key={node.path} node={node} depth={0} projectName={activeProject} selectedFile={selectedFile} onSelect={handleFileSelect} onEdit={onFileEdit} />
              ))
            ) : (
              <p className="text-[9px] text-muted-foreground/40 text-center py-3">No files yet</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectExplorer;
