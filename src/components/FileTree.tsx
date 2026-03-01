import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from 'lucide-react';
import { getFileTree } from '@/lib/self-source';

interface FileTreeProps {
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
}

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

const TreeItem: React.FC<{
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
}> = ({ node, depth, selectedFile, onSelect }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = !!node.children;
  const isSelected = node.path === selectedFile;

  return (
    <div>
      <button
        className={`flex items-center gap-1.5 w-full px-2 py-0.5 text-left text-xs transition-colors hover:bg-muted/50 ${
          isSelected ? 'bg-primary/10 text-primary' : 'text-foreground/70'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onSelect(node.path);
        }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-terminal-amber shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-terminal-amber shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileCode className="w-3.5 h-3.5 text-terminal-cyan shrink-0" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && expanded && node.children?.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedFile={selectedFile}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({ onSelectFile, selectedFile }) => {
  const tree = getFileTree();

  return (
    <div className="py-2">
      <div className="px-3 py-1 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Explorer — Self
        </span>
      </div>
      {tree.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          onSelect={onSelectFile}
        />
      ))}
      <div className="px-3 py-2 mt-4 border-t border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="text-terminal-amber">⚠</span> These files are representations of this app's own source code. 
          Modifications are validated before application.
        </p>
      </div>
    </div>
  );
};

export default FileTree;
