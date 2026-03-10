
const { app, BrowserWindow, shell, Menu, ipcMain, nativeTheme, session, webContents, dialog, clipboard } = require('electron');
const os = require('os');
const fs = require('fs');
const { exec, execFile } = require('child_process');

// GPU acceleration detection and graceful fallback
function configureGpuAcceleration() {
  // Check if we're in a headless environment or container
  const isHeadless = !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
  const isContainer = fs.existsSync('/.dockerenv') || process.env.container === 'docker';

  // Check for NVIDIA/AMD GPU availability (basic detection)
  let hasGpu = false;
  try {
    // Check for NVIDIA GPU
    if (fs.existsSync('/dev/nvidia0') || process.env.NVIDIA_VISIBLE_DEVICES) {
      hasGpu = true;
    }
    // Check for AMD GPU
    if (fs.existsSync('/dev/dri/card0')) {
      hasGpu = true;
    }
  } catch (e) {
    // Ignore errors in GPU detection
  }

  // Disable GPU acceleration if:
  // 1. In headless environment
  // 2. In container without GPU passthrough
  // 3. No GPU detected
  // 4. Explicitly requested via environment variable
  const shouldDisableGpu = isHeadless || (isContainer && !hasGpu) || !hasGpu || process.env.GROK_DISABLE_GPU === 'true';

  if (shouldDisableGpu) {
    console.log('Grok Desktop: Disabling GPU acceleration for compatibility');
    app.disableHardwareAcceleration();

    // Additional GPU-related switches for better compatibility
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-accelerated-video-decode');
    app.commandLine.appendSwitch('disable-accelerated-mjpeg-decode');

    // Log the reason for transparency
    const reasons = [];
    if (isHeadless) reasons.push('headless environment');
    if (isContainer && !hasGpu) reasons.push('container without GPU');
    if (!hasGpu) reasons.push('no GPU detected');
    if (process.env.GROK_DISABLE_GPU === 'true') reasons.push('explicitly disabled');

    console.log(`Grok Desktop: GPU acceleration disabled due to: ${reasons.join(', ')}`);
  } else {
    console.log('Grok Desktop: GPU acceleration enabled');
  }
}

// Configure GPU acceleration before app initialization
configureGpuAcceleration();

// Global error handler for GPU/VAAPI issues
process.on('warning', (warning) => {
  // Handle VAAPI and GPU-related warnings gracefully
  if (warning.message && (
    warning.message.includes('vaInitialize failed') ||
    warning.message.includes('VAAPI') ||
    warning.message.includes('gpu') ||
    warning.message.includes('GPU')
  )) {
    console.log('Grok Desktop: GPU warning detected, continuing with software rendering:', warning.message);
    return;
  }
  // Log other warnings normally
  console.warn(warning.name, warning.message, warning.stack);
});

// Handle uncaught exceptions related to GPU
process.on('uncaughtException', (error) => {
  if (error.message && (
    error.message.includes('vaInitialize failed') ||
    error.message.includes('VAAPI') ||
    error.message.includes('gpu') ||
    error.message.includes('GPU')
  )) {
    console.log('Grok Desktop: GPU error caught, continuing with software rendering:', error.message);
    return; // Don't exit the process
  }
  // Re-throw non-GPU errors
  throw error;
});

// Track GPU acceleration state and restart attempts
let gpuDisabled = false;
let restartAttempted = false;

// Disable GPU acceleration if we detect initialization failures
function handleGpuAcceleration() {
  // Check if we're already in fallback mode
  if (process.argv.includes('--disable-gpu') || process.env.ELECTRON_DISABLE_GPU === '1') {
    gpuDisabled = true;
    console.log('GPU acceleration disabled by flag or environment variable');
    return;
  }

  // Listen for GPU process crashes or initialization errors
  app.on('gpu-process-crashed', (event, killed) => {
    if (!killed && !gpuDisabled && !restartAttempted) {
      console.warn('GPU process crashed, attempting to restart with GPU acceleration disabled');
      event.preventDefault();
      restartWithGpuDisabled();
    }
  });

  // Monitor for VAAPI/GPU errors in stderr
  const originalStderrWrite = process.stderr.write;
  process.stderr.write = function(chunk, encoding, callback) {
    const data = chunk.toString();
    if (data.includes('vaapi') || data.includes('vaInitialize failed') ||
        data.includes('gpu_process_transport') || data.includes('gpu_init_failed')) {
      if (!gpuDisabled && !restartAttempted) {
        console.warn('GPU acceleration error detected, restarting with GPU disabled');
        restartWithGpuDisabled();
        return;
      }
    }
    return originalStderrWrite.call(this, chunk, encoding, callback);
  };
}

function restartWithGpuDisabled() {
  if (restartAttempted) return;
  restartAttempted = true;

  // Disable hardware acceleration for next start
  app.disableHardwareAcceleration();

  // Show a brief notification to user about fallback mode
  console.log('Restarting Grok Desktop with GPU acceleration disabled for compatibility...');

  // Restart the app
  app.relaunch({ args: [...process.argv.slice(1), '--disable-gpu'] });
  app.exit(0);
}

// Initialize GPU handling before app setup
handleGpuAcceleration();

// Handle open-external-url from renderer with enhanced validation
ipcMain.handle('open-external-url', async (_event, url) => {
  try {
    // Basic type and protocol validation
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return false;
    }

    // Parse URL to validate format and prevent malicious schemes
    const urlObj = new URL(url);

    // Ensure it's HTTP or HTTPS (not javascript:, data:, etc.)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }

    // Basic URL validation - ensure hostname exists and is reasonable
    if (!urlObj.hostname || urlObj.hostname.length === 0 || urlObj.hostname.length > 253) {
      return false;
    }

    // Prevent localhost/private IP access for external URLs
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') || hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return false;
    }

    await shell.openExternal(url);
    return true;
  } catch (error) {
    // Invalid URL format
    return false;
  }
});
const path = require('path');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
let aboutWindow;

// Allow autoplay without user gesture (for seamless audio playback)
try { app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); } catch (_) {}

// Define the allowed URL patterns for internal handling with secure domain validation
const allowedUrlPatterns = [
  // Allow localhost for the React dev server
  /^https?:\/\/localhost(?::\d+)?(?:\/|$)/,
  // Allow grok.com domain and all its paths (for normal browsing), but not as subdomain
  /^https?:\/\/grok\.com(?:\/|$)/,
  // Allow x.ai domain and all its paths (for normal browsing), but not as subdomain
  /^https?:\/\/x\.ai(?:\/|$)/,
  // Allow x.com domain for OAuth flows (but not as subdomain)
  /^https?:\/\/x\.com(?:\/|$)/,
  // Allow accounts.x.ai domain and auth-related paths (but not as subdomain)
  /^https?:\/\/accounts\.x\.ai(?:\/|$)/,
  // Allow accounts.google.com domain and OAuth paths (but not as subdomain)
  /^https?:\/\/accounts\.google\.com(?:\/|$)/,
  // Allow appleid.apple.com domain and OAuth paths (but not as subdomain)
  /^https?:\/\/appleid\.apple\.com(?:\/|$)/
];

// Enforce single instance
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Track webContents that should always use light color scheme
const forcedLightWebContentsIds = new Set();

// Always On Top (AOT) functionality for cross-platform compatibility
// Windows: Uses Electron's built-in setAlwaysOnTop() method
// Linux: Uses wmctrl command-line tool for better GNOME/Wayland compatibility
// If running under Wayland on Linux, automatically restarts with X11 forced

let wmctrlAvailable = false;
let isWayland = false;
let x11Forced = false;

function checkWmctrlAvailability() {
  if (os.platform() !== 'linux') return;

  // Check if we're running under Wayland (Rocky Linux 10 defaults to Wayland)
  isWayland = !!process.env.WAYLAND_DISPLAY || !!process.env.XDG_SESSION_TYPE?.includes('wayland');
  x11Forced = process.argv.includes('--ozone-platform=x11');

  console.log(`Grok Desktop: Display server detection - Wayland: ${isWayland}, X11 forced: ${x11Forced}`);

  if (isWayland && !x11Forced) {
    console.log('Grok Desktop: Running under Wayland, forcing X11 for AOT compatibility');
    // GNOME on Wayland intentionally restricts programmatic AOT for security
    // We force X11 mode where wmctrl works reliably
    forceX11Mode();
    return;
  }

  // Check if wmctrl is available (install with: sudo dnf install wmctrl on Rocky Linux)
  exec('which wmctrl', (error) => {
    wmctrlAvailable = !error;
    if (wmctrlAvailable) {
      console.log('Grok Desktop: wmctrl available for AOT fallback');
    } else {
      console.warn('Grok Desktop: wmctrl not available, AOT may not work on this system');
      console.warn('Grok Desktop: Install wmctrl with: sudo dnf install wmctrl');
    }
  });
}

function forceX11Mode() {
  console.log('Grok Desktop: Relaunching with X11 for AOT compatibility...');

  // Relaunch with X11 forced to enable wmctrl functionality
  const newArgs = [...process.argv.slice(1), '--ozone-platform=x11'];
  app.relaunch({
    args: newArgs,
    env: { ...process.env, OZONE_PLATFORM: 'x11', ELECTRON_USE_X11: '1' }
  });
  app.exit(0);
}

// Fallback AOT toggle using wmctrl on Linux
function toggleAlwaysOnTopLinux(mainWindow) {
  if (!wmctrlAvailable) return false;

  return new Promise((resolve) => {
    // Get the window title to target it specifically
    const windowTitle = mainWindow.getTitle() || 'Grok Desktop';

    // First focus the window, then toggle always-on-top
    const commands = [
      `wmctrl -a "${windowTitle}"`,  // Focus/activate the window
      `wmctrl -r "${windowTitle}" -b toggle,above`  // Toggle always-on-top
    ];

    exec(commands.join(' && '), (error) => {
      if (error) {
        console.warn('Grok Desktop: wmctrl AOT toggle failed:', error.message);
        resolve(false);
      } else {
        console.log('Grok Desktop: AOT toggled via wmctrl');
        resolve(true);
      }
    });
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true, // Enable Node.js integration
      contextIsolation: false, // Disable context isolation for this use case
      webviewTag: true, // Enable webview tag for tabs
      spellcheck: true
    },
    icon: path.join(__dirname, 'grok.png')
  });

  // Disable the menu bar
  Menu.setApplicationMenu(null);

  // Ensure shortcuts work when focus is on the main window UI
  try { attachShortcutHandlers(mainWindow.webContents); } catch (_) {}

  // In dev mode, load the React app from Vite; in production, load the built files
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Configure spellchecker languages for default session and webview partition
  try {
    const locale = (typeof app.getLocale === 'function' && app.getLocale()) || 'en-US';
    const languages = Array.isArray(locale) ? locale : [locale];

    const defaultSession = session.defaultSession;
    if (defaultSession) {
      if (typeof defaultSession.setSpellCheckerEnabled === 'function') {
        defaultSession.setSpellCheckerEnabled(true);
      }
      if (typeof defaultSession.setSpellCheckerLanguages === 'function') {
        defaultSession.setSpellCheckerLanguages(languages);
      }
    }

    const browserSession = session.fromPartition('persist:browser');
    if (browserSession) {
      if (typeof browserSession.setSpellCheckerEnabled === 'function') {
        browserSession.setSpellCheckerEnabled(true);
      }
      if (typeof browserSession.setSpellCheckerLanguages === 'function') {
        browserSession.setSpellCheckerLanguages(languages);
      }
    }
  } catch (_) {}

  // Send initial theme and listen for OS theme changes
  const sendTheme = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-theme-updated', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
    }
  };
  sendTheme();
  // Apply color scheme to all web contents (main and webviews)
  const applyColorSchemeToAll = () => {
    const scheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    try {
      webContents.getAllWebContents().forEach((wc) => {
        if (typeof wc.setColorScheme === 'function') {
          if (forcedLightWebContentsIds.has(wc.id)) {
            wc.setColorScheme('light');
          } else {
            wc.setColorScheme(scheme);
          }
        }
      });
    } catch (_) {}
  };
  applyColorSchemeToAll();

  nativeTheme.on('updated', () => {
    sendTheme();
    applyColorSchemeToAll();
  });

  // Open DevTools in development mode
  // mainWindow.webContents.openDevTools();

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up URL handling
  setupUrlHandling();

  // Set up IPC handlers
  setupIpcHandlers();

  // Set up WebRTC/media permissions (allow across all domains)
  setupPermissions();

  // Enable right-click context menus
  setupContextMenus();

  // Set up keyboard shortcuts (Ctrl+T, Ctrl+Tab, Ctrl+R)
  setupKeyboardShortcuts();

  // Ensure newly created webContents/webviews get correct color scheme
  app.on('web-contents-created', (_event, contents) => {
    const scheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    if (typeof contents.setColorScheme === 'function') {
      if (forcedLightWebContentsIds.has(contents.id)) {
        contents.setColorScheme('light');
      } else {
        contents.setColorScheme(scheme);
      }
    }
    contents.on('did-attach-webview', (_e, wc) => {
      if (wc && typeof wc.setColorScheme === 'function') {
        if (forcedLightWebContentsIds.has(wc.id)) {
          wc.setColorScheme('light');
        } else {
          wc.setColorScheme(scheme);
        }
      }
    });
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  checkWmctrlAvailability();
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handle URL navigation and determine if URLs should be opened internally
function setupUrlHandling() {
  // Handle navigation events from webContents
  app.on('web-contents-created', (event, contents) => {
    // Intercept new window requests; always deny BrowserWindow creation
    // Internal domains will be handled by the renderer's webview 'new-window' handler
    contents.setWindowOpenHandler(({ url }) => {
      const isInternal = allowedUrlPatterns.some(pattern => pattern.test(url));
      if (!isInternal) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  });
}

// Set up IPC handlers for renderer-to-main process communication
function setupIpcHandlers() {
  // Handle always-on-top toggle
  ipcMain.handle('toggle-always-on-top', async () => {
    if (!mainWindow) return false;

    // On Linux, use wmctrl if available for better GNOME compatibility
    if (os.platform() === 'linux') {
      if (wmctrlAvailable) {
        const result = await toggleAlwaysOnTopLinux(mainWindow);
        if (result) return true;
      } else {
        console.warn('Grok Desktop: wmctrl not available on Linux, AOT may not work');
      }
      // Fall back to Electron method if wmctrl fails or isn't available
    }

    // Use Electron's built-in method (works on Windows/macOS, may not work reliably on Linux GNOME/Wayland)
    try {
      const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
      return !isAlwaysOnTop;
    } catch (error) {
      console.warn('Grok Desktop: Electron AOT toggle failed:', error.message);
      return false;
    }
  });

  // Provide app version to renderer
  ipcMain.handle('get-app-version', () => {
    try {
      return app.getVersion();
    } catch (_) {
      return '0.0.0';
    }
  });

  // Open About page in a new tab instead of a window
  ipcMain.handle('show-app-info', async () => {
    const name = typeof app.getName === 'function' ? app.getName() : 'Grok Desktop';
    const version = typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0';
    const repoUrl = 'https://github.com/AnRkey/Grok-Desktop';

    // Build the about page URL with parameters
    const urlObj = new URL(`file://${path.join(__dirname, '../about.html')}`);
    urlObj.searchParams.set('name', name);
    urlObj.searchParams.set('version', version);
    urlObj.searchParams.set('repo', repoUrl);

    // Derive developer/contact from the GitHub repo URL
    let developer = 'AnRkey';
    try {
      const m = repoUrl.match(/^https?:\/\/github\.com\/([^/]+)/i);
      if (m && m[1]) developer = m[1];
    } catch (_) {}
    const contactUrl = 'https://github.com/AnRkey/Grok-Desktop/discussions';
    urlObj.searchParams.set('developer', developer);
    urlObj.searchParams.set('contact', contactUrl);

    // Send the URL to the renderer to create a new tab
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-about-tab', urlObj.toString());
    }

    return { name, version };
  });

  // Fetch Grok usage rate limits
  // Usage stats feature inspired by Joshua Wang's Grok Usage Watch extension
  // https://github.com/JoshuaWang2211
  // Fixed: Execute fetch inside the webview's context (where user is logged in)
  // to avoid 403 errors from session.fetch() in main process
  // Thanks to Joshua for identifying the root cause and suggesting this solution!
  ipcMain.handle('fetch-grok-rate-limits', async () => {
    try {
      // Find the active Grok webview's webContents
      const allContents = webContents.getAllWebContents();
      const grokWebview = allContents.find(wc => {
        try {
          const url = wc.getURL();
          return url.includes('grok.com') && !url.includes('about.html');
        } catch (e) {
          return false;
        }
      });
      
      if (!grokWebview) {
        return { error: 'No Grok tab found' };
      }
      
      // Execute the fetch inside the webview's context where session cookies are available
      const result = await grokWebview.executeJavaScript(`
        (async () => {
          const fetchRateLimits = async (requestKind, modelName) => {
            try {
              const response = await fetch('https://grok.com/rest/rate-limits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestKind, modelName })
              });
              
              if (response.status === 401 || response.status === 403) {
                return { error: 'UNAUTHORIZED' };
              }
              if (!response.ok) {
                return { error: \`HTTP \${response.status}\` };
              }
              return await response.json();
            } catch (e) {
              return { error: e.message };
            }
          };
          
          const [defaultLimits, grok4HeavyLimits] = await Promise.all([
            fetchRateLimits('DEFAULT', 'grok-3'),
            fetchRateLimits('DEFAULT', 'grok-4-heavy')
          ]);
          
          return {
            DEFAULT: defaultLimits,
            GROK4HEAVY: grok4HeavyLimits
          };
        })()
      `);
      
      return result;
    } catch (error) {
      return { error: error.message };
    }
  });

  // Read system clipboard text (called from React app's clipboard extractor)
  ipcMain.handle('read-clipboard', async () => {
    try {
      return clipboard.readText() || '';
    } catch { return ''; }
  });

  // ─── Guardian AI: File system operations for code apply pipeline ───────────

  function getProjectRoot() {
    const isDev = !app.isPackaged;
    if (isDev) {
      return path.resolve(process.cwd());
    }
    return path.resolve(app.getAppPath(), '..', '..');
  }

  function isPathSafe(filePath) {
    const projectRoot = getProjectRoot();
    const resolved = path.resolve(projectRoot, filePath);
    if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
      return { safe: false, resolved: '', error: `Path traversal blocked: "${filePath}" resolves outside project root` };
    }
    try {
      const parentDir = path.dirname(resolved);
      if (fs.existsSync(parentDir)) {
        const realParent = fs.realpathSync(parentDir);
        const realRoot = fs.realpathSync(projectRoot);
        if (!realParent.startsWith(realRoot + path.sep) && realParent !== realRoot) {
          return { safe: false, resolved: '', error: `Symlink escape blocked: "${filePath}" resolves outside project root` };
        }
      }
    } catch (_) {}
    const dangerous = ['node_modules', '.git', '.env', 'package-lock.json'];
    const relParts = path.relative(projectRoot, resolved).split(path.sep);
    for (const part of relParts) {
      if (dangerous.includes(part)) {
        return { safe: false, resolved: '', error: `Protected path: cannot write to "${part}"` };
      }
    }
    return { safe: true, resolved, error: '' };
  }

  const BACKUP_DIR = path.join(getProjectRoot(), '.guardian-backup');

  ipcMain.handle('read-file', async (_event, { filePath }) => {
    try {
      const check = isPathSafe(filePath);
      if (!check.safe) return { success: false, error: check.error };
      if (!fs.existsSync(check.resolved)) return { success: true, content: '', exists: false };
      const content = fs.readFileSync(check.resolved, 'utf-8');
      return { success: true, content, exists: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('write-file', async (_event, { filePath, content }) => {
    try {
      const check = isPathSafe(filePath);
      if (!check.safe) return { success: false, error: check.error };

      let backupPath = '';
      if (fs.existsSync(check.resolved)) {
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const timestamp = Date.now();
        const safeName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
        backupPath = path.join(BACKUP_DIR, `${timestamp}-${safeName}`);
        fs.copyFileSync(check.resolved, backupPath);
      }

      const dir = path.dirname(check.resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(check.resolved, content, 'utf-8');
      return { success: true, backupPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('rollback-file', async (_event, { filePath, backupPath }) => {
    try {
      const check = isPathSafe(filePath);
      if (!check.safe) return { success: false, error: check.error };
      if (!backupPath || !fs.existsSync(backupPath)) {
        return { success: false, error: 'Backup file not found' };
      }
      const resolvedBackup = path.resolve(backupPath);
      const relToBackup = path.relative(BACKUP_DIR, resolvedBackup);
      if (!relToBackup || relToBackup.startsWith('..') || path.isAbsolute(relToBackup)) {
        return { success: false, error: 'Invalid backup path' };
      }
      fs.copyFileSync(backupPath, check.resolved);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('git-commit', async (_event, { filePath, message }) => {
    const projectRoot = getProjectRoot();
    const check = isPathSafe(filePath);
    if (!check.safe) return { success: false, error: check.error };
    return new Promise((resolve) => {
      execFile('git', ['add', '--', filePath], { cwd: projectRoot, timeout: 10000 }, (addErr, _addOut, addStderr) => {
        if (addErr) {
          resolve({ success: false, error: addStderr || addErr.message });
          return;
        }
        execFile('git', ['commit', '-m', message], { cwd: projectRoot, timeout: 10000 }, (commitErr, commitOut, commitStderr) => {
          if (commitErr) {
            resolve({ success: false, error: commitStderr || commitErr.message });
          } else {
            resolve({ success: true, output: commitOut });
          }
        });
      });
    });
  });

  ipcMain.handle('check-compile', async (_event, { filePath }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const projectRoot = getProjectRoot();
        const ext = path.extname(filePath).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          const check = isPathSafe(filePath);
          if (!check.safe) { resolve({ hasErrors: false, errorText: '' }); return; }
          const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
          execFile(npxCmd, ['tsc', '--noEmit', '--pretty', 'false', check.resolved], { cwd: projectRoot, timeout: 15000 }, (error, stdout, stderr) => {
            const output = (stdout || '') + (stderr || '');
            if (error && output.includes('error TS')) {
              resolve({ hasErrors: true, errorText: output.slice(0, 2000) });
            } else {
              resolve({ hasErrors: false, errorText: '' });
            }
          });
          return;
        }
        resolve({ hasErrors: false, errorText: '' });
      }, 1500);
    });
  });

  ipcMain.handle('check-compile-project', async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const projectRoot = getProjectRoot();
        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        execFile(npxCmd, ['tsc', '--noEmit', '--pretty', 'false'], { cwd: projectRoot, timeout: 30000 }, (error, stdout, stderr) => {
          const output = (stdout || '') + (stderr || '');
          if (error && output.includes('error TS')) {
            resolve({ hasErrors: true, errorText: output.slice(0, 4000) });
          } else {
            resolve({ hasErrors: false, errorText: '' });
          }
        });
      }, 1500);
    });
  });

  ipcMain.handle('list-project-files', async () => {
    try {
      const projectRoot = getProjectRoot();
      const results = [];
      function walk(dir, prefix) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.guardian-backup') continue;
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), rel);
          } else {
            results.push(rel);
          }
        }
      }
      walk(projectRoot, '');
      return { success: true, files: results };
    } catch (e) {
      return { success: false, error: e.message, files: [] };
    }
  });

  // ─── Guardian AI: Git log for context ────────────────────────────────────────

  ipcMain.handle('git-log', async (_event, { count }) => {
    const projectRoot = getProjectRoot();
    const n = Math.min(Math.max(count || 5, 1), 20);
    return new Promise((resolve) => {
      execFile('git', ['log', `--max-count=${n}`, '--oneline', '--no-decorate'], { cwd: projectRoot, timeout: 5000 }, (err, stdout) => {
        if (err) resolve({ success: false, error: err.message, log: '' });
        else resolve({ success: true, log: stdout.trim() });
      });
    });
  });

  // ─── Guardian AI: Batch write multiple files at once ───────────────────────

  ipcMain.handle('batch-write-files', async (_event, { files }) => {
    const results = [];
    const backups = [];
    let allSuccess = true;

    for (const { filePath, content } of files) {
      const check = isPathSafe(filePath);
      if (!check.safe) {
        results.push({ filePath, success: false, error: check.error });
        allSuccess = false;
        break;
      }

      try {
        let backupPath = '';
        if (fs.existsSync(check.resolved)) {
          if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
          const timestamp = Date.now();
          const safeName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
          backupPath = path.join(BACKUP_DIR, `${timestamp}-${safeName}`);
          fs.copyFileSync(check.resolved, backupPath);
        }
        backups.push({ filePath, backupPath, resolved: check.resolved });

        const dir = path.dirname(check.resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(check.resolved, content, 'utf-8');
        results.push({ filePath, success: true, backupPath });
      } catch (e) {
        results.push({ filePath, success: false, error: e.message });
        allSuccess = false;
        break;
      }
    }

    return { success: allSuccess, results, backupCount: backups.length };
  });

  // ─── Guardian AI: Batch rollback all files ─────────────────────────────────

  ipcMain.handle('batch-rollback', async (_event, { backups }) => {
    let restored = 0;
    for (const { filePath, backupPath } of backups) {
      try {
        const check = isPathSafe(filePath);
        if (!check.safe) continue;
        if (backupPath && fs.existsSync(backupPath)) {
          const resolvedBackup = path.resolve(backupPath);
          const relToBackup = path.relative(BACKUP_DIR, resolvedBackup);
          if (relToBackup && !relToBackup.startsWith('..') && !path.isAbsolute(relToBackup)) {
            fs.copyFileSync(backupPath, check.resolved);
            restored++;
          }
        }
      } catch (_) {}
    }
    return { success: true, restored };
  });

  // ─── Guardian AI: Batch git commit ─────────────────────────────────────────

  ipcMain.handle('batch-git-commit', async (_event, { filePaths, message }) => {
    const projectRoot = getProjectRoot();
    const safePaths = filePaths.filter(fp => isPathSafe(fp).safe);
    if (safePaths.length === 0) return { success: false, error: 'No safe paths to commit' };
    return new Promise((resolve) => {
      execFile('git', ['add', '--', ...safePaths], { cwd: projectRoot, timeout: 10000 }, (addErr, _out, addStderr) => {
        if (addErr) { resolve({ success: false, error: addStderr || addErr.message }); return; }
        execFile('git', ['commit', '-m', message], { cwd: projectRoot, timeout: 10000 }, (commitErr, commitOut, commitStderr) => {
          if (commitErr) resolve({ success: false, error: commitStderr || commitErr.message });
          else resolve({ success: true, output: commitOut });
        });
      });
    });
  });

  // ─── Guardian AI: Restart dev server ───────────────────────────────────────

  let viteProcess = null;

  ipcMain.handle('restart-dev-server', async () => {
    const projectRoot = getProjectRoot();
    try {
      if (viteProcess) {
        try { viteProcess.kill('SIGTERM'); } catch (_) {}
        viteProcess = null;
        await new Promise(r => setTimeout(r, 1000));
      }
      const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      viteProcess = require('child_process').spawn(npxCmd, ['vite', '--host', '0.0.0.0', '--port', '5000'], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      return new Promise((resolve) => {
        let output = '';
        const timeout = setTimeout(() => {
          resolve({ success: true, output: output || 'Server starting...' });
        }, 5000);

        viteProcess.stdout.on('data', (data) => {
          output += data.toString();
          if (output.includes('ready in') || output.includes('Local:')) {
            clearTimeout(timeout);
            resolve({ success: true, output });
          }
        });
        viteProcess.stderr.on('data', (data) => { output += data.toString(); });
        viteProcess.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        });
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Guardian AI: Run npm install ──────────────────────────────────────────

  ipcMain.handle('run-npm-install', async () => {
    const projectRoot = getProjectRoot();
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    return new Promise((resolve) => {
      execFile(npmCmd, ['install'], { cwd: projectRoot, timeout: 60000 }, (err, stdout, stderr) => {
        if (err) resolve({ success: false, error: stderr || err.message });
        else resolve({ success: true, output: stdout });
      });
    });
  });

  ipcMain.handle('run-project-command', async (_event, { projectName, command }) => {
    if (!projectName || typeof projectName !== 'string' || /[\/\\]|\.\./.test(projectName)) {
      return { success: false, error: 'Invalid project name' };
    }
    if (!command || typeof command !== 'string') {
      return { success: false, error: 'No command specified' };
    }
    const allowedPrefixes = [
      'npm ', 'npx ', 'yarn ', 'pnpm ', 'bun ',
      'node ', 'deno ', 'tsc', 'tsx ',
      'corepack ', 'nvm ', 'fnm ',
      'mkdir ', 'cp ', 'mv ', 'rm ', 'touch ', 'cat ', 'ls ', 'pwd',
      'chmod ', 'chown ', 'ln ',
      'git ', 'curl ', 'wget ',
      'python', 'pip', 'cargo ', 'go ', 'rustc', 'gcc', 'g++', 'make',
      'docker ', 'docker-compose ',
    ];
    const trimmed = command.trim().replace(/\s+#\s+.*$/, '').trim();
    if (/[\r\n\x00]/.test(trimmed)) return { success: false, error: 'Control characters not allowed in commands' };

    if (/^curl-install:https?:\/\//i.test(trimmed)) {
      const scriptUrl = trimmed.replace(/^curl-install:/i, '');
      try {
        const projectRoot = getProjectRoot();
        const projectDir = path.join(projectRoot, 'projects', projectName);
        if (!fs.existsSync(projectDir)) return { success: false, error: 'Project not found' };
        const isWin = process.platform === 'win32';

        const WIN_NPM_ALTERNATIVES = {
          'bun.sh/install': 'npm install -g bun',
          'get.pnpm.io/install.sh': 'npm install -g pnpm',
          'install.python-poetry.org': 'pip install poetry',
          'rustup.rs': 'winget install Rustlang.Rustup',
          'deno.land/install.sh': 'npm install -g deno',
        };

        if (isWin) {
          const winKey = Object.keys(WIN_NPM_ALTERNATIVES).find(k => scriptUrl.includes(k));
          if (winKey) {
            const altCmd = WIN_NPM_ALTERNATIVES[winKey];
            return new Promise((resolve) => {
              exec(altCmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                  resolve({ success: false, error: `${err.message?.slice(0, 400)} (ran: ${altCmd})`, output: (stdout || '').slice(0, 4000), stderr: (stderr || '').slice(0, 2000) });
                } else {
                  resolve({ success: true, output: `Windows alternative: ${altCmd}\n${(stdout || '').slice(0, 4000)}` });
                }
              });
            });
          }

          const ps1Url = scriptUrl.replace(/\.sh$/, '.ps1');
          let usePsScript = false;
          try { const head = await fetch(ps1Url, { method: 'HEAD' }); usePsScript = head.ok; } catch {}

          if (usePsScript) {
            const psCmd = `irm ${ps1Url} | iex`;
            const encodedCmd = Buffer.from(psCmd, 'utf16le').toString('base64');
            return new Promise((resolve) => {
              exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCmd}`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                  resolve({ success: false, error: err.message?.slice(0, 500), output: (stdout || '').slice(0, 4000), stderr: (stderr || '').slice(0, 2000) });
                } else {
                  resolve({ success: true, output: (stdout || '').slice(0, 4000) });
                }
              });
            });
          }
        }

        const resp = await fetch(scriptUrl);
        if (!resp.ok) return { success: false, error: `Failed to download script: ${resp.status} ${resp.statusText}` };
        const script = await resp.text();
        const tmpScript = path.join(os.tmpdir(), `install-${Date.now()}.sh`);
        fs.writeFileSync(tmpScript, script, { mode: 0o755 });
        return new Promise((resolve) => {
          exec(`bash "${tmpScript}"`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, BUN_INSTALL: projectDir, CARGO_HOME: projectDir, RUSTUP_HOME: projectDir } }, (err, stdout, stderr) => {
            try { fs.unlinkSync(tmpScript); } catch {}
            if (err) {
              resolve({ success: false, error: err.message?.slice(0, 500), output: (stdout || '').slice(0, 4000), stderr: (stderr || '').slice(0, 2000) });
            } else {
              resolve({ success: true, output: (stdout || '').slice(0, 4000) });
            }
          });
        });
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    const devServerRe = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
    if (devServerRe.test(trimmed)) return { success: false, error: 'Dev server commands should use the Preview button instead' };
    const isAllowed = allowedPrefixes.some(p => trimmed.startsWith(p)) || trimmed === 'npm install' || trimmed === 'corepack enable';
    if (!isAllowed) return { success: false, error: `Command not allowed: ${trimmed.slice(0, 50)}` };
    if (/[;&|`$(){}]/.test(trimmed)) {
      return { success: false, error: 'Shell metacharacters not allowed' };
    }
    if (/\.\.[\/\\]/.test(trimmed)) {
      return { success: false, error: 'Path traversal not allowed' };
    }

    const projectRoot = getProjectRoot();
    const projectDir = path.join(projectRoot, 'projects', projectName);
    const resolvedDir = path.resolve(projectDir);
    const projectsRoot = path.resolve(path.join(projectRoot, 'projects'));
    if (!resolvedDir.startsWith(projectsRoot)) return { success: false, error: 'Invalid project path' };
    if (!fs.existsSync(projectDir)) return { success: false, error: `Project directory not found: ${projectDir}` };

    const isWin = process.platform === 'win32';
    let actualCmd = trimmed === 'npm install' ? 'npm install --legacy-peer-deps' : trimmed;

    const nodeHandled = (() => {
      if (/^rm\s+(-rf?\s+)?/i.test(actualCmd)) {
        const targets = actualCmd.replace(/^rm\s+(-rf?\s+)?/i, '').trim().split(/\s+/);
        const results = [];
        for (const t of targets) {
          const targetPath = path.resolve(projectDir, t);
          if (!targetPath.startsWith(projectDir)) { results.push(`Skipped (outside project): ${t}`); continue; }
          try { fs.rmSync(targetPath, { recursive: true, force: true }); results.push(`Removed: ${t}`); }
          catch (e) { results.push(`Failed to remove ${t}: ${e.message}`); }
        }
        return { success: true, output: results.join('\n') };
      }
      if (/^mkdir\s+(-p\s+)?/i.test(actualCmd)) {
        const dir = actualCmd.replace(/^mkdir\s+(-p\s+)?/i, '').trim();
        const dirPath = path.resolve(projectDir, dir);
        if (!dirPath.startsWith(projectDir)) return { success: false, error: 'Path outside project' };
        try { fs.mkdirSync(dirPath, { recursive: true }); return { success: true, output: `Created: ${dir}` }; }
        catch (e) { return { success: false, error: e.message }; }
      }
      if (/^touch\s/i.test(actualCmd)) {
        const file = actualCmd.replace(/^touch\s+/i, '').trim();
        const filePath = path.resolve(projectDir, file);
        if (!filePath.startsWith(projectDir)) return { success: false, error: 'Path outside project' };
        try {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, '', { flag: 'a' });
          return { success: true, output: `Touched: ${file}` };
        } catch (e) { return { success: false, error: e.message }; }
      }
      if (/^cat\s/i.test(actualCmd)) {
        const file = actualCmd.replace(/^cat\s+/i, '').trim();
        const filePath = path.resolve(projectDir, file);
        if (!filePath.startsWith(projectDir)) return { success: false, error: 'Path outside project' };
        try { return { success: true, output: fs.readFileSync(filePath, 'utf-8').slice(0, 4000) }; }
        catch (e) { return { success: false, error: e.message }; }
      }
      if (/^cp\s/i.test(actualCmd)) {
        const args = actualCmd.replace(/^cp\s+(-r\s+)?/i, '').trim().split(/\s+/);
        if (args.length >= 2) {
          const src = path.resolve(projectDir, args[0]);
          const dest = path.resolve(projectDir, args[1]);
          if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: 'Path outside project' };
          try { fs.cpSync(src, dest, { recursive: true, force: true }); return { success: true, output: `Copied: ${args[0]} → ${args[1]}` }; }
          catch (e) { return { success: false, error: e.message }; }
        }
      }
      if (/^mv\s/i.test(actualCmd)) {
        const args = actualCmd.replace(/^mv\s+/i, '').trim().split(/\s+/);
        if (args.length >= 2) {
          const src = path.resolve(projectDir, args[0]);
          const dest = path.resolve(projectDir, args[1]);
          if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: 'Path outside project' };
          try { fs.renameSync(src, dest); return { success: true, output: `Moved: ${args[0]} → ${args[1]}` }; }
          catch (e) { return { success: false, error: e.message }; }
        }
      }
      return null;
    })();

    if (nodeHandled) return nodeHandled;

    if (isWin && /^corepack\s/i.test(actualCmd)) {
      actualCmd = `npx ${actualCmd}`;
    }

    return new Promise((resolve) => {
      exec(actualCmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: err.message?.slice(0, 500), output: (stdout || '').slice(0, 4000), stderr: (stderr || '').slice(0, 2000) });
        } else {
          resolve({ success: true, output: (stdout || '').slice(0, 4000) });
        }
      });
    });
  });

  ipcMain.handle('ensure-project-polling', async (_event, { projectName }) => {
    if (!projectName || typeof projectName !== 'string' || /[\/\\]|\.\./.test(projectName)) {
      return { success: false, error: 'Invalid project name' };
    }
    const projectRoot = getProjectRoot();
    const projectDir = path.join(projectRoot, 'projects', projectName);
    const viteConfigPath = path.join(projectDir, 'vite.config.ts');
    if (!fs.existsSync(viteConfigPath)) return { success: true, patched: false, reason: 'No vite.config.ts' };
    const content = fs.readFileSync(viteConfigPath, 'utf-8');
    if (content.includes('usePolling')) return { success: true, patched: false, reason: 'Already has polling' };
    const patched = content.replace(
      /defineConfig\(\{/,
      `defineConfig({\n  server: {\n    watch: {\n      usePolling: true,\n      interval: 500,\n    },\n  },`
    );
    if (patched !== content) {
      fs.writeFileSync(viteConfigPath, patched, 'utf-8');
      return { success: true, patched: true };
    }
    return { success: true, patched: false, reason: 'No defineConfig found' };
  });

  ipcMain.handle('install-project-deps', async (_event, { projectName, dependencies, devDependencies }) => {
    if (!projectName || typeof projectName !== 'string' || /[\/\\]|\.\./.test(projectName)) {
      return { success: false, error: 'Invalid project name' };
    }
    const projectRoot = getProjectRoot();
    const projectDir = path.join(projectRoot, 'projects', projectName);
    const resolvedDir = path.resolve(projectDir);
    const projectsRoot = path.resolve(path.join(projectRoot, 'projects'));
    if (!resolvedDir.startsWith(projectsRoot)) return { success: false, error: 'Invalid project path' };
    if (!fs.existsSync(projectDir)) return { success: false, error: 'Project not found' };

    const pkgJsonPath = path.join(projectDir, 'package.json');
    let pkgJsonValid = false;
    if (fs.existsSync(pkgJsonPath)) {
      try { JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')); pkgJsonValid = true; } catch {}
    }
    if (!pkgJsonValid) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify({ name: projectName, version: '0.0.1', private: true }, null, 2));
    }

    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const validPkg = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;
    const notAPkg = new Set(["npm","npx","yarn","pnpm","bun","node","deno","run","dev","start","build","test","serve","watch","lint","deploy","preview","install","add","remove","uninstall","update","init","create","cd","ls","mkdir","rm","cp","mv","cat","echo","touch","git","curl","wget","then","and","or","the","a","an","to","in","of","for","with","from","your","this","that","it","is","are","was","be","has","have","do","does","if","not","no","yes","on","off","up","so","but","by","at","as","server","app","application","project","file","directory","folder","next","first","following","above","below","after","before","all","any","each","every","both","new","old"]);
    const sanitize = (arr) => (arr || []).filter(d => {
      if (typeof d !== 'string' || !validPkg.test(d) || /[;&|`$(){}]/.test(d)) return false;
      const base = d.replace(/@[^\s]*$/, '').toLowerCase();
      return !notAPkg.has(base) && (base.length > 1 || d.startsWith('@'));
    });
    const safeDeps = sanitize(dependencies);
    const safeDevDeps = sanitize(devDependencies);
    const results = [];

    const errors = [];

    if (safeDeps.length > 0) {
      try {
        const { execFileSync } = require('child_process');
        execFileSync(npmCmd, ['install', '--legacy-peer-deps', ...safeDeps], { cwd: projectDir, timeout: 60000, stdio: 'pipe' });
        results.push(`Installed: ${safeDeps.join(', ')}`);
      } catch (err) {
        errors.push(`Failed to install deps: ${err.message}`);
      }
    }

    if (safeDevDeps.length > 0) {
      try {
        const { execFileSync } = require('child_process');
        execFileSync(npmCmd, ['install', '--legacy-peer-deps', '--save-dev', ...safeDevDeps], { cwd: projectDir, timeout: 60000, stdio: 'pipe' });
        results.push(`Installed dev: ${safeDevDeps.join(', ')}`);
      } catch (err) {
        errors.push(`Failed to install dev deps: ${err.message}`);
      }
    }

    return { success: errors.length === 0, results, errors };
  });

  // ─── Guardian AI: Read multiple files for context ──────────────────────────

  ipcMain.handle('read-files-for-context', async (_event, { filePaths, maxSizePerFile }) => {
    const maxSize = maxSizePerFile || 8000;
    const results = [];
    for (const filePath of filePaths) {
      const check = isPathSafe(filePath);
      if (!check.safe) continue;
      try {
        if (!fs.existsSync(check.resolved)) continue;
        const stat = fs.statSync(check.resolved);
        if (stat.size > 500000) continue;
        let content = fs.readFileSync(check.resolved, 'utf-8');
        if (content.length > maxSize) content = content.slice(0, maxSize) + '\n... (truncated)';
        results.push({ path: filePath, content });
      } catch (_) {}
    }
    return { success: true, files: results };
  });

  // Open Grok in a new native BrowserWindow (called from React app)
  ipcMain.handle('open-grok-browser', async () => {
    const grokWin = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Grok — xAI',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:browser',
        spellcheck: true
      },
      icon: path.join(__dirname, 'grok.png')
    });
    grokWin.loadURL('https://grok.com');
    grokWin.setMenuBarVisibility(false);
    return true;
  });

  // Open any URL in a new native BrowserWindow (called from React app)
  ipcMain.handle('open-url-browser', async (_event, url, title) => {
    if (typeof url !== 'string' || !url.startsWith('http')) return false;
    const urlWin = new BrowserWindow({
      width: 1100,
      height: 750,
      title: title || url,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:browser',
        spellcheck: true
      },
      icon: path.join(__dirname, 'grok.png')
    });
    urlWin.loadURL(url);
    urlWin.setMenuBarVisibility(false);
    return true;
  });

  // Force light/dynamic color scheme for specific webContents id
  ipcMain.handle('force-light-color-scheme', (_event, wcId, shouldForceLight) => {
    try {
      const wc = webContents.fromId(wcId);
      if (!wc) return false;
      if (shouldForceLight) {
        forcedLightWebContentsIds.add(wcId);
        if (typeof wc.setColorScheme === 'function') wc.setColorScheme('light');
        // Stronger override via DevTools Protocol: emulate prefers-color-scheme: light
        try {
          if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
          wc.debugger.sendCommand('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: 'light' }]
          });
        } catch (_) {}
      } else {
        forcedLightWebContentsIds.delete(wcId);
        const scheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
        if (typeof wc.setColorScheme === 'function') wc.setColorScheme(scheme);
        // Remove emulation
        try {
          if (wc.debugger.isAttached()) {
            wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
            wc.debugger.detach();
          }
        } catch (_) {}
      }
      return true;
    } catch (_) {
      return false;
    }
  });
} 

// Enable context menus across the app (window and webviews)
function setupContextMenus() {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('context-menu', (event, params) => {
      const template = [];

      // Spell-check suggestions (when right-clicking a misspelled word)
      if (params.misspelledWord && params.misspelledWord.trim()) {
        const suggestions = Array.isArray(params.dictionarySuggestions)
          ? params.dictionarySuggestions.slice(0, 6)
          : [];

        if (suggestions.length > 0 && typeof contents.replaceMisspelling === 'function') {
          suggestions.forEach((suggestion) => {
            template.push({
              label: suggestion,
              click: () => contents.replaceMisspelling(suggestion)
            });
          });
        }

        // Allow adding the word to the custom dictionary for this session
        if (contents.session && typeof contents.session.addWordToSpellCheckerDictionary === 'function') {
          template.push({
            label: `Add to Dictionary: "${params.misspelledWord}"`,
            click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
          });
        }

        if (template.length > 0) {
          template.push({ type: 'separator' });
        }
      }

      // Link options
      if (params.linkURL) {
        template.push({
          label: 'Open Link in Browser',
          click: () => shell.openExternal(params.linkURL)
        });
      }

      // Image options
      if (params.hasImageContents && params.srcURL) {
        template.push({
          label: 'Save Image As…',
          click: () => contents.downloadURL(params.srcURL)
        });
      }

      // Edit actions
      if (params.isEditable) {
        template.push(
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        );
      } else if (params.selectionText && params.selectionText.trim()) {
        template.push({ role: 'copy' }, { type: 'separator' });
      }

      // Navigation (for webviews/pages)
      const canGoBack = contents.navigationHistory && typeof contents.navigationHistory.canGoBack === 'function' && contents.navigationHistory.canGoBack();
      const canGoForward = contents.navigationHistory && typeof contents.navigationHistory.canGoForward === 'function' && contents.navigationHistory.canGoForward();
      template.push(
        { label: 'Back', enabled: canGoBack, click: () => contents.navigationHistory && contents.navigationHistory.goBack && contents.navigationHistory.goBack() },
        { label: 'Forward', enabled: canGoForward, click: () => contents.navigationHistory && contents.navigationHistory.goForward && contents.navigationHistory.goForward() },
        { label: 'Reload', click: () => contents.reload && contents.reload() }
      );


      const menu = Menu.buildFromTemplate(template);
      const win = BrowserWindow.fromWebContents(contents);
      if (win) menu.popup({ window: win });
    });
  });
}

// Allow all media-related permissions for all domains (both default and persist:browser sessions)
function setupPermissions() {
  const enableForSession = (targetSession) => {
    if (!targetSession) return;
    try {
      // Always grant permission checks
      if (typeof targetSession.setPermissionCheckHandler === 'function') {
        targetSession.setPermissionCheckHandler(() => true);
      }
      // Always grant runtime permission requests
      if (typeof targetSession.setPermissionRequestHandler === 'function') {
        targetSession.setPermissionRequestHandler((_wc, _permission, callback, _details) => {
          try { callback(true); } catch (_) {}
        });
      }
      // Best-effort: allow device and display capture if supported by current Electron
      if (typeof targetSession.setDevicePermissionHandler === 'function') {
        targetSession.setDevicePermissionHandler(() => true);
      }
      if (typeof targetSession.setDisplayMediaRequestHandler === 'function') {
        targetSession.setDisplayMediaRequestHandler((_wc, request, callback) => {
          // Approve requested audio/video capture; defer exact source selection to default behavior
          try { callback({ video: !!request.video, audio: !!request.audio }); } catch (_) {}
        });
      }
    } catch (_) {}
  };

  try { enableForSession(session.defaultSession); } catch (_) {}
  try { enableForSession(session.fromPartition('persist:browser')); } catch (_) {}

  // Ensure any future sessions/webviews also have audio unmuted
  try {
    app.on('web-contents-created', (_event, contents) => {
      try { if (typeof contents.setAudioMuted === 'function') contents.setAudioMuted(false); } catch (_) {}
    });
  } catch (_) {}
}

// Keyboard shortcuts wired at the webContents level so they work in webviews too
function setupKeyboardShortcuts() {
  try {
    app.on('web-contents-created', (_event, contents) => attachShortcutHandlers(contents));
  } catch (_) {}
}

function attachShortcutHandlers(contents) {
  try {
    contents.on('before-input-event', (event, input) => {
      try {
        // Only handle keyDown with Control on Windows/Linux
        if (input.type !== 'keyDown' || !input.control) return;

        const key = input.key;
        // Deliver to the hosting window (handles webviews as well)
        const host = contents.hostWebContents || contents;
        const win = BrowserWindow.fromWebContents(host);
        if (!win || win.isDestroyed()) return;

        // Ctrl+K -> Remap to Ctrl+Shift+K for grok.com search
        // grok.com responds to Ctrl+Shift+K, not Ctrl+K (which Chromium intercepts for omnibox)
        if ((key === 'k' || key === 'K') && !input.shift) {
          event.preventDefault();
          // Send Ctrl+Shift+K to the webContents using sendInputEvent (creates trusted OS-level events)
          contents.sendInputEvent({
            type: 'keyDown',
            keyCode: 'K',
            modifiers: ['control', 'shift']
          });
          // Send keyUp after a short delay
          setTimeout(() => {
            try {
              contents.sendInputEvent({
                type: 'keyUp',
                keyCode: 'K',
                modifiers: ['control', 'shift']
              });
            } catch (_) {}
          }, 10);
          return;
        }
        // Don't intercept Ctrl+Shift+K - let it pass through naturally (it already works)

        // Ctrl+T -> new tab
        if (key === 't' || key === 'T') {
          event.preventDefault();
          win.webContents.send('shortcut-new-tab');
          return;
        }
        // Ctrl+Tab -> next tab, Ctrl+Shift+Tab -> previous tab
        if (key === 'Tab') {
          event.preventDefault();
          if (input.shift) {
            win.webContents.send('shortcut-prev-tab');
          } else {
            win.webContents.send('shortcut-next-tab');
          }
          return;
        }
        // Ctrl+R -> reload active tab (override default window reload)
        if (key === 'r' || key === 'R') {
          event.preventDefault();
          win.webContents.send('shortcut-reload-tab');
          return;
        }
        // Ctrl+I -> show information/about dialog
        if (key === 'i' || key === 'I') {
          event.preventDefault();
          win.webContents.send('shortcut-show-info');
          return;
        }
      } catch (_) {}
    });
  } catch (_) {}
}