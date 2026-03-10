import { getGuardianConfig, getEffectivePat } from './guardian-config';
import type { GuardianMeta } from './guardian-publish';

export interface KnowledgeEntry {
  repoName: string;
  repoUrl: string;
  meta: GuardianMeta;
  stars?: number;
  updatedAt?: string;
}

export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  score: number;
  matchedKeywords: string[];
}

const CACHE_KEY = 'guardian-knowledge-cache';
const CACHE_TIMESTAMP_KEY = 'guardian-knowledge-cache-ts';
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let cachedEntries: KnowledgeEntry[] | null = null;

function loadCacheFromStorage(): { entries: KnowledgeEntry[]; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (raw && ts) {
      return { entries: JSON.parse(raw), timestamp: parseInt(ts, 10) };
    }
  } catch {}
  return null;
}

function saveCacheToStorage(entries: KnowledgeEntry[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch {}
}

function isCacheStale(): boolean {
  try {
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) > REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}

async function githubGet(endpoint: string, pat?: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (pat) {
    headers.Authorization = `Bearer ${pat}`;
  }
  const res = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

async function fetchOrgRepos(orgName: string, pat?: string): Promise<{ name: string; html_url: string; stargazers_count: number; updated_at: string }[]> {
  const repos: any[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= 5) {
    const data = await githubGet(`/orgs/${orgName}/repos?per_page=${perPage}&page=${page}&sort=updated`, pat);
    if (!data || !Array.isArray(data) || data.length === 0) break;
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

async function fetchGuardianMeta(fullName: string, pat?: string): Promise<GuardianMeta | null> {
  try {
    const data = await githubGet(`/repos/${fullName}/contents/GUARDIAN-META.json`, pat);
    if (!data || !data.content) return null;
    const decoded = atob(data.content.replace(/\n/g, ''));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function refreshKnowledgeRegistry(): Promise<KnowledgeEntry[]> {
  const config = getGuardianConfig();
  const pat = getEffectivePat(config) || undefined;

  try {
    const repos = await fetchOrgRepos(config.orgName, pat);

    const entries: KnowledgeEntry[] = [];

    const metaPromises = repos.map(async (repo) => {
      const meta = await fetchGuardianMeta(`${config.orgName}/${repo.name}`, pat);
      if (meta) {
        entries.push({
          repoName: repo.name,
          repoUrl: repo.html_url,
          meta,
          stars: repo.stargazers_count,
          updatedAt: repo.updated_at,
        });
      }
    });

    await Promise.allSettled(metaPromises);

    cachedEntries = entries;
    saveCacheToStorage(entries);
    return entries;
  } catch {
    const cached = loadCacheFromStorage();
    if (cached) {
      cachedEntries = cached.entries;
      return cached.entries;
    }
    return [];
  }
}

export function getCachedKnowledge(): KnowledgeEntry[] {
  if (cachedEntries) return cachedEntries;
  const cached = loadCacheFromStorage();
  if (cached) {
    cachedEntries = cached.entries;
    return cached.entries;
  }
  return [];
}

export function startKnowledgeRefreshLoop(): void {
  if (refreshTimer) return;

  if (isCacheStale()) {
    refreshKnowledgeRegistry().catch(() => {});
  } else {
    const cached = loadCacheFromStorage();
    if (cached) cachedEntries = cached.entries;
  }

  refreshTimer = setInterval(() => {
    refreshKnowledgeRegistry().catch(() => {});
  }, REFRESH_INTERVAL_MS);
}

export function stopKnowledgeRefreshLoop(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length > 2);
}

export function searchKnowledge(description: string, maxResults = 5): KnowledgeMatch[] {
  const entries = getCachedKnowledge();
  if (entries.length === 0) return [];

  const queryTokens = new Set(tokenize(description));
  const stopWords = new Set(['the', 'and', 'with', 'for', 'app', 'that', 'this', 'from', 'have', 'are', 'was', 'has', 'can', 'will', 'use', 'using']);

  const matches: KnowledgeMatch[] = [];

  for (const entry of entries) {
    const entryText = [
      entry.meta.original_description,
      entry.meta.stack,
      ...entry.meta.tags,
      ...entry.meta.key_patterns_used,
    ].join(' ');
    const entryTokens = new Set(tokenize(entryText));

    const matchedKeywords: string[] = [];
    let score = 0;
    const queryArr = Array.from(queryTokens);
    const entryArr = Array.from(entryTokens);

    for (const qt of queryArr) {
      if (stopWords.has(qt)) continue;
      if (entryTokens.has(qt)) {
        matchedKeywords.push(qt);
        score += 1;
      }
      for (const et of entryArr) {
        if (et !== qt && (et.includes(qt) || qt.includes(et)) && et.length > 3 && qt.length > 3) {
          if (!matchedKeywords.includes(qt)) {
            matchedKeywords.push(qt);
            score += 0.5;
          }
        }
      }
    }

    for (const tag of entry.meta.tags) {
      const tagLower = tag.toLowerCase();
      if (queryTokens.has(tagLower)) {
        score += 1.5;
      }
    }

    if (entry.meta.build_success_rating) {
      score *= 1 + (entry.meta.build_success_rating / 10);
    }

    if (score > 0 && matchedKeywords.length > 0) {
      matches.push({ entry, score, matchedKeywords });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxResults);
}

export function formatKnowledgeForGrokPrompt(matches: KnowledgeMatch[]): string {
  if (matches.length === 0) return '';

  let prompt = `\n=== REPO SELECTION PRIORITY ===\n`;
  prompt += `When suggesting a starting point for a new project, follow this priority:\n`;
  prompt += `1) PUBLIC GITHUB REPO — Search for a popular, well-maintained public GitHub repo (React/TS/Vite/Tailwind preferred, high stars, MIT/Apache license). The world's open-source bounties come first.\n`;
  prompt += `2) PROVEN BUILD — If no high-quality public repo fits, consider these proven builds from our library:\n\n`;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const e = m.entry;
    prompt += `  ${i + 1}) ${e.repoName} — "${e.meta.original_description}" `;
    prompt += `(stack: ${e.meta.stack || 'unknown'}`;
    if (e.meta.build_success_rating) prompt += `, rating: ${e.meta.build_success_rating}/5`;
    if (e.meta.key_patterns_used.length > 0) prompt += `, patterns: ${e.meta.key_patterns_used.join(', ')}`;
    prompt += `) [${e.repoUrl}]\n`;
  }

  prompt += `\n3) START FRESH — Only if nothing above fits the requirements.\n`;
  prompt += `Always suggest a specific GitHub URL when recommending a repo.\n`;
  prompt += `=== END REPO SELECTION ===\n`;

  return prompt;
}

export function getKnowledgeSummary(): { totalBuilds: number; isStale: boolean; lastRefresh: number | null } {
  const entries = getCachedKnowledge();
  const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  return {
    totalBuilds: entries.length,
    isStale: isCacheStale(),
    lastRefresh: ts ? parseInt(ts, 10) : null,
  };
}
