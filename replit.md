# Lambda Recursive — Self-Referential IDE

## Overview
A self-evolving, self-recursive development environment with AI-powered code evolution. The system autonomously scans, reflects on, and improves its own source code, acquiring capabilities and tracking evolution levels.

## Architecture
- **Frontend-only SPA**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Hosted Supabase (PostgreSQL database + Edge Functions)
- **No server-side code in this repo** — all backend logic runs on Supabase Edge Functions

## Key Technologies
- React 18, React Router v6, TanStack Query
- Vite 5 (dev server on port 5000)
- Tailwind CSS + shadcn/ui components
- Supabase JS client for database access
- Monaco Editor for code viewing
- Framer Motion for animations
- PWA support via vite-plugin-pwa

## Project Structure
```
src/
├── App.tsx                    # Router setup with 4 pages
├── main.tsx                   # Entry point
├── pages/
│   ├── Index.tsx              # Main IDE view with autonomous recursion loop
│   ├── Evolution.tsx          # Evolution visualization
│   ├── PatternAnalysis.tsx    # Pattern analysis / evolution cycle view
│   ├── GrokBridge.tsx         # AI bridge (Grok Desktop launcher + API chat + clipboard extractor)
│   └── NotFound.tsx
├── components/                # UI components (AIChat, CodeViewer, FileTree, etc.)
├── integrations/supabase/     # Supabase client + generated types
├── lib/                       # Core logic libraries
│   ├── recursion-engine.ts    # Main recursion loop engine
│   ├── goal-engine.ts         # Self-directed goal system
│   ├── cloud-memory.ts        # Supabase persistence layer
│   ├── safety-engine.ts       # Change validation
│   ├── self-source.ts         # Virtual file system
│   ├── evolution-bridge.ts    # Grok↔Evolution pipeline (context builder, Grok API caller, code applicator, plan manager)
│   ├── autonomy-engine.ts     # Autonomous goal execution (code-gen steps route through Grok evolution)
│   └── [50+ capability libs]  # Auto-generated capability modules
electron-browser/              # Grok Desktop Electron app (based on AnRkey/Grok-Desktop)
├── src/main.js                # Electron main process
├── src/preload.js             # Preload script
├── src/renderer.js            # Renderer process
├── src/custom-tabs.js         # Tab management
├── index.html                 # Browser UI with tabs, usage stats
├── styles.css                 # Browser styles
├── about.html                 # About dialog
└── package.json               # Electron deps (run npm install separately)
supabase/
├── functions/                 # Edge Functions (self-recurse, grok-chat, etc.)
├── migrations/                # Database migrations
└── config.toml
```

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` — Supabase project ID

## Desktop App (Electron)
- **Desktop mode**: `npm run electron:dev` — starts Vite + Electron together
  - Vite dev server on port 5000, Electron loads it as the main window
  - GrokBridge embeds Grok/ChatGPT/Claude directly in the page via Electron `<webview>` tag
  - Uses `partition="persist:grok"` for persistent login sessions across reloads
  - Clicking site tabs navigates the embedded webview (no separate windows)
- **Desktop build**: `npm run electron:build` — builds Vite then packages Electron
- **Web mode**: Sites open in new browser tabs (fallback when not in Electron)
- Detection: `typeof window.require === 'function'` → Electron; otherwise web mode
- Tauri has been fully removed from the project
- **Code Apply Pipeline** (Electron only):
  - Clipboard extractor detects code blocks + full Grok response context
  - Click "Apply" → reads current file from disk → shows confirmation dialog with diff
  - Safety checks run (balanced brackets, circular imports, infinite loops)
  - On confirm: backs up file → writes to disk → checks TypeScript compilation → auto git commit
  - If compile errors detected: shows errors + offers one-click rollback from backup
  - Rollback restores the pre-write backup; non-fatal git failures shown as warnings
  - Backups stored in `.guardian-backup/` (gitignored)
  - IPC handlers: `read-file`, `write-file`, `rollback-file`, `git-commit`, `check-compile`, `list-project-files`
  - Path traversal protection: all paths validated to be inside project root; node_modules/.git/.env blocked
- **Automated Development Loop** (Electron only — "NEW GEMINI" pattern):
  - **Auto Context**: On AI Bridge load, auto-builds project context (file tree, key file contents, git log, errors). "Copy Context" button in top bar copies structured context to clipboard for pasting into Grok.
  - **Batch Apply All**: "Apply All" button in Code Extractor writes all detected code blocks at once → backup all → write all → compile check → git commit. Progress modal shows stage: Writing → Checking → Committing → Done/Error.
  - **Error Feedback Loop**: If batch apply produces compile errors, the error dialog offers "Send to Grok" (copies error + project context to clipboard) and "Rollback All" (restores all backups). Mirrors the `ping_pong_fix` pattern: apply → error → send errors → fix → apply again.
  - **Auto Restart**: After successful batch apply, waits for Vite HMR (2s). IPC handlers `restart-dev-server` and `run-npm-install` available for full restarts / dependency installs.
  - Batch IPC handlers: `batch-write-files`, `batch-rollback`, `batch-git-commit`, `git-log`, `read-files-for-context`, `restart-dev-server`, `run-npm-install`

## Project Management
- Users can create, select, and delete sub-projects from the AI Bridge page
- Projects are stored under `projects/<name>/` relative to project root
- API endpoints in `vite.config.ts`: `/api/projects/list`, `/api/projects/create`, `/api/projects/delete`, `/api/projects/files`, `/api/projects/read-file`, `/api/projects/write-file`, `/api/projects/preview`, `/api/projects/stop-preview`, `/api/projects/install-deps`
- Client-side store: `src/lib/project-manager.ts` — `listProjects`, `createProject`, `deleteProject`, `getProjectFiles`, `readProjectFile`, `writeProjectFile`, `getActiveProject`, `setActiveProject`
- UI component: `src/components/ProjectExplorer.tsx` — file tree browser for active project
- When a project is active in GrokBridge:
  - `applyBlock`/`confirmApply`/`batchApplyAll` write to project directory instead of main app
  - `buildProjectContext` reads project files instead of SELF_SOURCE
  - Copy Context includes the project's file tree and key file contents
  - Preview button spawns a Vite dev server in the project directory on a dynamic port (5100+)
- Switching to "Main App" restores all original behavior (no project scoping)

## Testing
- `npm test` — runs all Vitest tests
- `npm run test:watch` — watch mode
- Test files:
  - `src/test/safety-engine.test.ts` — safety engine validation
  - `src/test/pipeline.test.ts` — code parser unit tests + live Grok API test (creates `src/lib/greeter.ts` function)
  - `src/test/pipeline-e2e.test.ts` — end-to-end theme change test (sends `index.css` to Grok, asks "green to blue", verifies response)
  - `src/test/fixtures/` — saved JSON fixtures from live API test runs (for reference/debugging)
- Shared module: `src/lib/code-parser.ts` — `parseCodeBlocks()` + `ParsedBlock` + `parseDependencies()` + `parseActionItems()` for comprehensive Grok response parsing (used by GrokBridge + tests)
  - Code blocks: detects filenames from inline comments, preceding prose (backtick/bold/heading-wrapped), and "create/save as" patterns
  - Dependencies: detects npm/yarn/pnpm/bun install commands in code blocks AND prose text
  - Action items: extracts shell commands, env vars, directory creation, renames, deletions, API key requirements, restart instructions
  - Shell-only code blocks (bash with only install/mkdir/cd commands) are excluded from code blocks since they're already captured as deps/actions

## Dependency Auto-Install
- When Grok's response includes a `=== DEPENDENCIES ===` block or `npm install` commands in bash code blocks, the app auto-detects packages
- `parseDependencies()` in `code-parser.ts` extracts package names with sanitization (validates against npm naming regex, blocks shell metacharacters)
- On "Apply All" for an active project, detected deps are installed via `/api/projects/install-deps` (Vite) or `install-project-deps` IPC (Electron)
- Both endpoints use `execFileSync` with arg arrays (no shell interpolation) for security
- Context instructions and evolution instructions tell Grok to use the structured format

## Development
- Dev server: `npx vite` (port 5000) — web-only mode
- Desktop dev: `npm run electron:dev` — full desktop experience
- Build: `npm run build`
- Download source: Click "Download Source" in the sidebar to get a zip of all project files (excludes node_modules, .git)
- The app connects to an existing hosted Supabase project for its database and edge functions
