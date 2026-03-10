export interface Project {
  name: string;
  path: string;
  createdAt: number;
  framework: 'react' | 'vanilla' | 'html';
  description: string;
}

export interface ProjectFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: ProjectFileNode[];
}

const ACTIVE_PROJECT_KEY = 'active-project';

export async function listProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects/list', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to list projects');
  const data = await res.json();
  return data.projects ?? [];
}

export async function createProject(
  name: string,
  framework: Project['framework'],
  description: string
): Promise<Project> {
  const res = await fetch('/api/projects/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, framework, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create project' }));
    throw new Error(err.error || 'Failed to create project');
  }
  return res.json();
}

export async function deleteProject(name: string): Promise<void> {
  const res = await fetch('/api/projects/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function getProjectFiles(name: string): Promise<ProjectFileNode[]> {
  const res = await fetch('/api/projects/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to get project files');
  const data = await res.json();
  return data.files ?? data.tree ?? [];
}

export async function readProjectFile(project: string, filePath: string): Promise<string> {
  const res = await fetch('/api/projects/read-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project, filePath }),
  });
  if (!res.ok) throw new Error('Failed to read project file');
  const data = await res.json();
  return data.content ?? '';
}

export async function writeProjectFile(
  project: string,
  filePath: string,
  content: string
): Promise<void> {
  const res = await fetch('/api/projects/write-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project, filePath, content }),
  });
  if (!res.ok) throw new Error('Failed to write project file');
}

export function getActiveProject(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setActiveProject(projectName: string | null): void {
  try {
    if (projectName === null) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } else {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectName);
    }
  } catch {}
}

export interface GitHubImportProgress {
  stage: 'parsing' | 'fetching-tree' | 'downloading' | 'writing' | 'installing' | 'done' | 'error';
  message: string;
  filesTotal?: number;
  filesWritten?: number;
  repoName?: string;
  repoStars?: number;
}

export function parseGitHubUrl(text: string): { owner: string; repo: string; fullUrl: string } | null {
  const match = text.match(/https?:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  return { owner, repo, fullUrl: `https://github.com/${owner}/${repo}` };
}

export function detectGitHubUrlInResponse(responseText: string): { owner: string; repo: string; fullUrl: string } | null {
  const all = detectAllGitHubUrls(responseText);
  return all.length > 0 ? all[0] : null;
}

const GITHUB_NON_REPO_PATHS = new Set([
  'features', 'settings', 'explore', 'topics', 'trending', 'collections',
  'events', 'sponsors', 'notifications', 'issues', 'pulls', 'marketplace',
  'login', 'signup', 'join', 'pricing', 'about', 'security', 'customer-stories',
]);

export function detectAllGitHubUrls(responseText: string): { owner: string; repo: string; fullUrl: string }[] {
  const seen = new Set<string>();
  const results: { owner: string; repo: string; fullUrl: string }[] = [];
  const regex = /https?:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/g;
  let match;
  while ((match = regex.exec(responseText)) !== null) {
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    const key = `${owner}/${repo}`.toLowerCase();
    if (seen.has(key)) continue;
    if (GITHUB_NON_REPO_PATHS.has(owner.toLowerCase())) continue;
    if (GITHUB_NON_REPO_PATHS.has(repo.toLowerCase())) continue;
    seen.add(key);
    results.push({ owner, repo, fullUrl: `https://github.com/${owner}/${repo}` });
  }
  return results;
}

export async function importFromGitHub(
  githubUrl: string,
  onProgress?: (progress: GitHubImportProgress) => void,
  targetProject?: string
): Promise<{ projectName: string; framework: string }> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error('Invalid GitHub URL');

  onProgress?.({
    stage: 'fetching-tree',
    message: `Fetching repository tree from ${parsed.owner}/${parsed.repo}...`,
    repoName: parsed.repo,
  });

  const body: Record<string, string> = { owner: parsed.owner, repo: parsed.repo };
  if (targetProject) body.targetProject = targetProject;

  const res = await fetch('/api/projects/import-github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(err.error || `Import failed (${res.status})`);
  }

  const data = await res.json();

  onProgress?.({
    stage: 'done',
    message: `Imported ${parsed.repo} (${data.filesWritten} files)`,
    repoName: parsed.repo,
    filesTotal: data.filesWritten,
    filesWritten: data.filesWritten,
  });

  return {
    projectName: data.projectName || parsed.repo,
    framework: data.framework || 'react',
  };
}
