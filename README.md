# Lambda Recursive (Guardian AI)

A self-evolving desktop IDE built with React, Vite, TypeScript, and Electron. Combines AI-powered code generation with a closed error feedback loop, GitHub repo cloning, live preview, and a shared community knowledge base.

![Lambda Recursive](https://img.shields.io/badge/Lambda-Recursive-blueviolet?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

---

## What Is This?

Lambda Recursive is a Replit-like development environment that runs on your desktop. You paste AI responses (from Grok, ChatGPT, Claude, etc.) and it:

1. **Extracts code blocks** from the AI response with correct file paths
2. **Applies them to your project** with safety validation and backup
3. **Runs the project** in a live preview with hot reload
4. **Captures errors** from the preview console
5. **Sends errors back to the AI** with full context for a fix
6. **Repeats** until the project works

The goal is zero-friction AI-assisted development: paste response, apply, see result, fix errors, ship.

---

## Features

### AI Bridge
The main workspace. Embeds Grok, ChatGPT, Claude, GitHub, X, and Perplexity directly in the app (via Electron webview) or opens them in browser tabs (web mode). Supports:

- **Browser Mode**: AI sites embedded as tabs with persistent login sessions
- **API Mode**: Direct API integration with chat interface
- **Auto Mode**: Automated context building and response application
- **Code Extractor**: Parses any AI response into structured code blocks, dependencies, action items, and GitHub URLs
- **Batch Apply**: One-click applies all code blocks, installs dependencies, and commits to git
- **Auto-Apply**: Safe changes apply automatically with 5-second undo window

### GitHub Repository Import
Clone any public GitHub repo directly into a project with one click:

- **Tarball download**: Single HTTP request downloads the entire repo (no file-by-file API calls)
- **Smart package manager detection**: Detects bun/pnpm/yarn/npm from lockfiles
- **Framework detection**: Identifies Next.js, Nuxt, Angular, Svelte, Astro, Vue, React
- **Automatic dependency install**: Runs the correct install command with fallback retry
- **Auto-detected in AI responses**: GitHub URLs in any Grok/ChatGPT response get "Clone" buttons
- **Works with GITHUB_TOKEN**: Set the env var for private repos and higher rate limits

### Live Preview System
Every project gets its own dev server with:

- **Framework-aware startup**: Detects the correct dev command from package.json scripts and dependencies
- **Package manager-aware**: Uses pnpm/yarn/bun/npm based on lockfile presence
- **Embedded preview**: Split-view iframe alongside the AI browser
- **Console log capture**: Errors, warnings, and logs from the preview are captured and displayed
- **Error feedback loop**: "Send Logs to Grok" bundles errors + affected file contents into a diagnostic prompt
- **HMR-first updates**: Normal file writes use Hot Module Replacement; full restart only for config changes

### Ollama Toaster
A local Ollama instance acts as a dumb, reliable pre/post-processor (temperature 0.0):

- **Pre-Grok**: Analyzes preview errors + file tree to select only relevant files for context
- **Post-Grok**: Extracts structured code blocks from raw AI responses
- **Quick Actions**: Suggests context-aware action buttons based on project state
- **Graceful fallback**: If Ollama isn't running, falls back to regex parsing and heuristics

### Self-Evolution Engine
The IDE can scan, analyze, and improve its own source code:

- **Recursion loop**: Autonomously scans code, identifies improvements, and applies them
- **Evolution tracking**: Visualizes capability growth over time
- **Goal system**: Self-directed goals with autonomous execution
- **Safety engine**: Validates all changes before applying (balanced brackets, circular imports, infinite loops, JSX balance)

### Community Knowledge Base
Shared GitHub org for publishing and discovering proven builds:

- **Publish**: Push successful builds with `GUARDIAN-META.json` metadata
- **Search**: Query past builds by keyword, stack, or pattern
- **Priority system**: Public repos first, proven builds second, fresh start last
- **Grok decides**: AI makes the final repo selection, no conflicting suggestions

---

## Quick Start

### Web Mode (Browser Only)
```bash
# Clone the repo
git clone https://github.com/AidenRichTwitter-Glitch/guardian-ai.git
cd guardian-ai

# Install dependencies
npm install

# Start the dev server
npm run dev
```
Open `http://localhost:5000` in your browser. AI sites open in new tabs instead of embedded webviews.

### Desktop Mode (Full Experience)
```bash
# Install main dependencies
npm install

# Install Electron dependencies
cd electron-browser && npm install && cd ..

# Start Vite + Electron together
npm run electron:dev
```
This gives you embedded AI browsers with persistent login, file system access, git integration, and the full apply pipeline.

### Desktop Build
```bash
npm run electron:build
```

---

## Architecture

```
src/
  pages/
    GrokBridge.tsx          # AI Bridge - main workspace
    Index.tsx               # Self-recursion IDE view
    Evolution.tsx           # Evolution visualization
    PatternAnalysis.tsx     # Evolution cycle analysis
  components/
    ProjectExplorer.tsx     # File tree + GitHub import UI
    FileEditor.tsx          # Monaco editor for hand-editing
    LogsPanel.tsx           # Preview console log capture
    CodeViewer.tsx          # Code display with syntax highlighting
    AIChat.tsx              # API mode chat interface
    SettingsModal.tsx       # Configuration panel
    ui/                     # shadcn/ui components
  lib/
    code-parser.ts          # AI response parsing (code blocks, deps, actions)
    ollama-toaster.ts       # Ollama pre/post-processor
    recursion-engine.ts     # Self-evolution loop
    evolution-bridge.ts     # Grok-to-Evolution pipeline
    autonomy-engine.ts      # Autonomous goal execution
    safety-engine.ts        # Code validation before apply
    guardian-publish.ts     # Community publish pipeline
    guardian-knowledge.ts   # Knowledge registry search
    project-manager.ts      # Project CRUD operations
    cloud-memory.ts         # Supabase persistence
    50+ capability modules  # Auto-generated evolution capabilities

electron-browser/
  src/main.js               # Electron main process
  src/preload.js            # IPC bridge
  index.html                # Desktop browser UI
  package.json              # Electron dependencies

vite.config.ts              # Dev server + all API endpoints
```

### API Endpoints (Vite Dev Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/list` | POST | List all projects |
| `/api/projects/create` | POST | Create empty project |
| `/api/projects/delete` | POST | Delete project |
| `/api/projects/import-github` | POST | Clone GitHub repo via tarball |
| `/api/projects/files` | POST | Get project file tree |
| `/api/projects/read-file` | POST | Read a project file |
| `/api/projects/write-file` | POST | Write a project file |
| `/api/projects/preview` | POST | Start dev server for project |
| `/api/projects/stop-preview` | POST | Stop project dev server |
| `/api/projects/restart-preview` | POST | Restart project dev server |
| `/api/projects/install-deps` | POST | Install npm packages |
| `/api/projects/run-command` | POST | Run whitelisted shell command |
| `/api/programs/install` | POST | Install system programs |

---

## How the AI Loop Works

```
User pastes AI response
        |
   Code Extractor parses:
   - Code blocks (with file paths)
   - Dependencies (npm/yarn/pnpm/bun)
   - Action items (env vars, commands)
   - GitHub URLs (clone buttons)
        |
   Safety Engine validates:
   - Balanced brackets
   - No circular imports
   - No infinite loops
   - Import resolution
   - Package reference check
        |
   Apply (with backup):
   - Write files to project
   - Install dependencies
   - Run action items
        |
   Live Preview:
   - Dev server starts/HMR reloads
   - Console captures errors
        |
   If errors detected:
   - "Diagnose & Fix" button appears
   - Bundles errors + file contents + context
   - Copies diagnostic prompt to clipboard
        |
   Paste into AI -> Get fix -> Repeat
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon key |
| `GITHUB_TOKEN` | No | GitHub PAT for private repos and higher API rate limits |

### Ollama Setup (Optional)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a recommended model
ollama pull qwen2.5-coder:7b

# The toaster auto-connects to localhost:11434
```
Configure endpoint URL and model in the settings panel (gear icon).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Build | Vite 5 |
| Desktop | Electron |
| Editor | Monaco Editor |
| Animations | Framer Motion |
| State | TanStack Query, React Router v6 |
| Database | Supabase (PostgreSQL + Edge Functions) |
| AI Pre/Post | Ollama (local) |
| PWA | vite-plugin-pwa |

---

## Development

```bash
# Dev server (web mode)
npm run dev

# Desktop dev (Electron + Vite)
npm run electron:dev

# Run tests
npm test

# Watch mode tests
npm run test:watch

# Build for production
npm run build

# Build desktop app
npm run electron:build
```

### Testing
- `src/test/safety-engine.test.ts` - Safety validation tests
- `src/test/pipeline.test.ts` - Code parser unit tests
- `src/test/pipeline-e2e.test.ts` - End-to-end theme change test

---

## GitHub Import Details

The import system uses GitHub's tarball API for reliable, fast cloning:

1. **Single request**: Downloads entire repo as `.tar.gz` (vs hundreds of individual file requests)
2. **Extracts with `tar`**: `--strip-components=1` removes the GitHub wrapper directory
3. **Cleans up**: Removes `node_modules`, `.git`, `.next`, `.turbo`, `dist`, `.cache`
4. **Detects framework**: Reads `package.json` dependencies to identify the tech stack
5. **Detects package manager**: Checks for `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`
6. **Installs dependencies**: Runs the correct install command with `--ignore-scripts` for security
7. **Falls back**: If the detected PM fails, retries with `npm install --legacy-peer-deps`

### Supported Frameworks
Next.js, Nuxt, Angular, Svelte/SvelteKit, Astro, Vue, React (CRA, Vite), vanilla JS/TS

### Preview Command Detection
Reads `package.json` scripts in order: `dev` -> `start` -> dependency inference -> `vite.config` existence -> fallback to `npx vite`

---

## License

MIT
