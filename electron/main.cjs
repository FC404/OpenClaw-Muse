const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const APP_ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const APP_URL = `http://127.0.0.1:${PORT}/?electron=1`;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;
const TTS_STATUS_URL = `http://127.0.0.1:${PORT}/api/tts/status`;
const RUNTIME_STATUS_URL = `http://127.0.0.1:${PORT}/api/runtime-status`;

const VOICE_DIR = process.env.CLAWMUSE_GPT_SOVITS_DIR || 'D:\\openxData\\GPT-SoVITS-Package\\GPT-SoVITS-v3lora-20250228';
const VOICE_PY = path.join(VOICE_DIR, 'runtime', 'python.exe');
const VOICE_API = path.join(VOICE_DIR, 'api_v2.py');
const VOICE_CONFIG = path.join(VOICE_DIR, 'GPT_SoVITS', 'configs', 'tts_infer.yaml');
const VOICE_PORT = Number(process.env.CLAWMUSE_GPT_SOVITS_PORT || 9880);
const MAX_LOG_ENTRIES = 500;

let mainWindow = null;
let logWindow = null;
let serverProcess = null;
let voiceProcess = null;
let serverOwnedByElectron = false;
let voiceOwnedByElectron = false;
let runtimePollTimer = null;

const logBuffer = [];
let nextLogId = 1;
let runtimeSnapshot = {
  serverReady: false,
  voiceReady: false,
  openClawConnected: false,
  openClawLabel: 'offline',
  openClawBackend: 'openclaw',
  lastCheckedAt: null
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function maskToken(token) {
  const value = String(token || '').trim();
  if (!value) return '(empty)';
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildConfigSnapshot() {
  return {
    appUrl: APP_URL,
    port: PORT,
    voicePort: VOICE_PORT,
    voiceDir: VOICE_DIR,
    voiceConfig: VOICE_CONFIG,
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
    sessionKey: process.env.OPENCLAW_SESSION_KEY || 'OpenClaw-Muse',
    backend: process.env.CHAT_BACKEND || 'openclaw',
    gatewayToken: maskToken(process.env.OPENCLAW_GATEWAY_TOKEN || '')
  };
}

function buildLogSnapshot() {
  return {
    config: buildConfigSnapshot(),
    runtime: runtimeSnapshot,
    logs: logBuffer.slice(-MAX_LOG_ENTRIES)
  };
}

function broadcastLogSnapshot() {
  if (!logWindow || logWindow.isDestroyed()) return;
  logWindow.webContents.send('logs:update', buildLogSnapshot());
}

function pushLog(source, level, text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (!lines.length) return;

  for (const line of lines) {
    logBuffer.push({
      id: nextLogId++,
      ts: new Date().toISOString(),
      source,
      level,
      text: line
    });
  }

  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES);
  }

  broadcastLogSnapshot();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`request_failed_${response.status}`);
  }
  return response.json();
}

async function isServerReady() {
  try {
    const response = await fetch(HEALTH_URL, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

async function isVoiceReady() {
  try {
    const data = await fetchJson(TTS_STATUS_URL);
    return Boolean(data && data.ok);
  } catch {
    return false;
  }
}

async function refreshRuntimeSnapshot() {
  const next = {
    ...runtimeSnapshot,
    lastCheckedAt: new Date().toISOString()
  };

  try {
    next.serverReady = await isServerReady();
  } catch {
    next.serverReady = false;
  }

  try {
    next.voiceReady = await isVoiceReady();
  } catch {
    next.voiceReady = false;
  }

  try {
    const runtime = await fetchJson(RUNTIME_STATUS_URL);
    next.openClawConnected = Boolean(runtime?.openclaw?.connected);
    next.openClawLabel = next.openClawConnected ? 'online' : 'offline';
    next.openClawBackend = runtime?.backend || 'openclaw';
  } catch {
    next.openClawConnected = false;
    next.openClawLabel = 'offline';
  }

  runtimeSnapshot = next;
  broadcastLogSnapshot();
}

function resolveNodeExecutable() {
  if (process.env.CLAWMUSE_NODE_PATH && fs.existsSync(process.env.CLAWMUSE_NODE_PATH)) {
    return process.env.CLAWMUSE_NODE_PATH;
  }

  if (path.basename(process.execPath).toLowerCase().startsWith('node')) {
    return process.execPath;
  }

  if (process.platform === 'win32') {
    const lookup = spawnSync('where.exe', ['node'], {
      encoding: 'utf8',
      windowsHide: true
    });
    const firstMatch = String(lookup.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (firstMatch) {
      return firstMatch;
    }
  }

  return 'node';
}

function attachProcessLogging(child, source) {
  if (!child) return;

  const encoding = process.platform === 'win32' && source === 'voice' ? 'gb18030' : 'utf8';
  const stdoutDecoder = iconv.getDecoder(encoding);
  const stderrDecoder = iconv.getDecoder(encoding);

  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      pushLog(source, 'info', stdoutDecoder.write(chunk));
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      pushLog(source, 'error', stderrDecoder.write(chunk));
    });
  }

  child.on('exit', (code, signal) => {
    const stdoutTail = stdoutDecoder.end();
    const stderrTail = stderrDecoder.end();
    if (stdoutTail) {
      pushLog(source, 'info', stdoutTail);
    }
    if (stderrTail) {
      pushLog(source, 'error', stderrTail);
    }
    pushLog(source, code === 0 ? 'info' : 'error', `process exited (code=${code}, signal=${signal || 'none'})`);
  });
}

function spawnHidden(command, args, options = {}) {
  return spawn(command, args, {
    cwd: options.cwd || APP_ROOT,
    env: options.env || process.env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
}

function startLocalServer() {
  const nodeExecutable = resolveNodeExecutable();
  pushLog('server', 'info', `starting local server with ${nodeExecutable}`);

  serverProcess = spawnHidden(nodeExecutable, [path.join(APP_ROOT, 'server.js')], {
    cwd: APP_ROOT,
    env: process.env
  });

  serverOwnedByElectron = true;
  attachProcessLogging(serverProcess, 'server');
  serverProcess.on('exit', () => {
    serverProcess = null;
  });
}

function validateVoiceRuntime() {
  const required = [VOICE_PY, VOICE_API, VOICE_CONFIG];
  const missing = required.find((target) => !fs.existsSync(target));
  if (missing) {
    throw new Error(`voice_runtime_missing: ${missing}`);
  }
}

function startVoiceService() {
  validateVoiceRuntime();
  pushLog('voice', 'info', `starting GPT-SoVITS at ${VOICE_DIR}`);

  voiceProcess = spawnHidden(
    VOICE_PY,
    [
      '-B',
      VOICE_API,
      '-a',
      '127.0.0.1',
      '-p',
      String(VOICE_PORT),
      '-c',
      VOICE_CONFIG
    ],
    {
      cwd: VOICE_DIR,
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1'
      }
    }
  );

  voiceOwnedByElectron = true;
  attachProcessLogging(voiceProcess, 'voice');
  voiceProcess.on('exit', () => {
    voiceProcess = null;
  });
}

async function ensureLocalServer() {
  if (await isServerReady()) {
    pushLog('system', 'info', 'local server already available');
    return;
  }

  startLocalServer();
  for (let i = 0; i < 80; i += 1) {
    if (await isServerReady()) {
      pushLog('system', 'info', 'local server is ready');
      return;
    }
    await sleep(500);
  }

  throw new Error('ClawMuse local server did not become ready in time.');
}

async function ensureVoiceService() {
  if (await isVoiceReady()) {
    pushLog('system', 'info', 'voice service already available');
    return;
  }

  startVoiceService();
  for (let i = 0; i < 80; i += 1) {
    if (await isVoiceReady()) {
      pushLog('system', 'info', 'voice service is ready');
      return;
    }
    await sleep(500);
  }

  throw new Error('GPT-SoVITS voice service did not become ready in time.');
}

function clampZoom(factor) {
  return Math.max(0.8, Math.min(1.4, factor));
}

function adjustZoom(delta) {
  if (!mainWindow) return;
  const nextZoom = clampZoom(mainWindow.webContents.getZoomFactor() + delta);
  mainWindow.webContents.setZoomFactor(nextZoom);
}

function resetZoom() {
  if (!mainWindow) return;
  mainWindow.webContents.setZoomFactor(1);
}

function setPinned(checked) {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(Boolean(checked), 'screen-saver');
}

function getWindowState() {
  return {
    pinned: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isAlwaysOnTop()),
    hasLogWindow: Boolean(logWindow && !logWindow.isDestroyed())
  };
}

function getWindowLayout() {
  const display = screen.getPrimaryDisplay().workArea;
  const gap = 14;
  const logWidth = clamp(Math.round(display.width * 0.26), 380, 500);
  const mainWidth = clamp(display.width - logWidth - gap - 40, 500, 1320);
  const height = clamp(display.height - 40, 300, 940);
  const totalWidth = mainWidth + logWidth + gap;
  const startX = display.x + Math.max(0, Math.floor((display.width - totalWidth) / 2));
  const startY = display.y + Math.max(10, Math.floor((display.height - height) / 2));

  return {
    gap,
    main: { x: startX, y: startY, width: mainWidth, height },
    log: { x: startX + mainWidth + gap, y: startY, width: logWidth, height }
  };
}

function syncLogWindowBounds() {
  if (!mainWindow || !logWindow || logWindow.isDestroyed()) return;
  const mainBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(mainBounds).workArea;
  const gap = 12;
  const logWidth = clamp(Math.round(display.width * 0.25), 360, 500);
  const xRight = mainBounds.x + mainBounds.width + gap;
  const fitsRight = xRight + logWidth <= display.x + display.width;
  const xLeft = mainBounds.x - logWidth - gap;
  const targetX = fitsRight ? xRight : Math.max(display.x, xLeft);
  const targetY = clamp(mainBounds.y, display.y, display.y + Math.max(0, display.height - mainBounds.height));
  logWindow.setBounds({
    x: targetX,
    y: targetY,
    width: logWidth,
    height: mainBounds.height
  });
}

function createLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.show();
    syncLogWindowBounds();
    return;
  }

  const layout = getWindowLayout();
  logWindow = new BrowserWindow({
    x: layout.log.x,
    y: layout.log.y,
    width: layout.log.width,
    height: layout.log.height,
    minWidth: 360,
    minHeight: 540,
    backgroundColor: '#0a0a0a',
    title: 'ClawMuse Logs',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  logWindow.once('ready-to-show', () => {
    logWindow.show();
    broadcastLogSnapshot();
  });

  logWindow.on('closed', () => {
    logWindow = null;
  });

  logWindow.loadFile(path.join(__dirname, 'logs.html')).catch((error) => {
    pushLog('system', 'error', `failed to load logs window: ${error.message}`);
  });
}

function buildMenu() {
  const template = [
    {
      label: 'OpenClaw-Muse',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'DevTools' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Always On Top',
          type: 'checkbox',
          accelerator: 'Ctrl+Shift+T',
          click: (menuItem) => setPinned(menuItem.checked)
        },
        {
          label: 'Show Logs',
          accelerator: 'Ctrl+Shift+L',
          click: () => createLogWindow()
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'Ctrl+=',
          click: () => adjustZoom(0.1)
        },
        {
          label: 'Zoom Out',
          accelerator: 'Ctrl+-',
          click: () => adjustZoom(-0.1)
        },
        {
          label: 'Reset Zoom',
          accelerator: 'Ctrl+0',
          click: () => resetZoom()
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function ensureBackendsReady() {
  await ensureLocalServer();
  await ensureVoiceService();
  await refreshRuntimeSnapshot();
}

async function createMainWindow() {
  const layout = getWindowLayout();
  await ensureBackendsReady();

  mainWindow = new BrowserWindow({
    x: layout.main.x,
    y: layout.main.y,
    width: layout.main.width,
    height: layout.main.height,
    minWidth: 500,
    minHeight: 300,
    backgroundColor: '#0b0b0b',
    title: 'OpenClaw-Muse',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.show();
  });

  mainWindow.on('move', () => {
    syncLogWindowBounds();
  });

  mainWindow.on('resize', () => {
    syncLogWindowBounds();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(APP_URL);
}

function terminateChildTree(child) {
  if (!child || !child.pid) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore'
    });
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch {}
}

ipcMain.handle('logs:snapshot', () => buildLogSnapshot());
ipcMain.handle('logs:refresh', async () => {
  await refreshRuntimeSnapshot();
  return buildLogSnapshot();
});
ipcMain.handle('window:show-logs', () => {
  createLogWindow();
  return { ok: true, ...getWindowState() };
});
ipcMain.handle('window:get-state', () => getWindowState());
ipcMain.handle('window:set-pinned', (_event, checked) => {
  setPinned(checked);
  return getWindowState();
});
ipcMain.handle('window:refresh-app', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reloadIgnoringCache();
  }
  return { ok: true };
});

app.whenReady().then(async () => {
  pushLog('system', 'info', 'Electron main process is starting');
  buildMenu();
  await createMainWindow();
  runtimePollTimer = setInterval(() => {
    void refreshRuntimeSnapshot();
  }, 5000);

  app.on('activate', async () => {
    if (!BrowserWindow.getAllWindows().length) {
      await createMainWindow();
    }
  });
}).catch((error) => {
  console.error('[Electron] Failed to start ClawMuse:', error);
  pushLog('system', 'error', `startup failed: ${error.message}`);
  app.quit();
});

app.on('before-quit', () => {
  if (runtimePollTimer) {
    clearInterval(runtimePollTimer);
    runtimePollTimer = null;
  }
  if (serverOwnedByElectron && serverProcess) {
    terminateChildTree(serverProcess);
  }
  if (voiceOwnedByElectron && voiceProcess) {
    terminateChildTree(voiceProcess);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
