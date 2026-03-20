const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chatForm');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const galFormEl = document.getElementById('galForm');
const galInputEl = document.getElementById('galInput');
const galSendBtn = document.getElementById('galSendBtn');
const galMicBtn = document.getElementById('galMicBtn');
const voiceToggleBtn = document.getElementById('voiceToggleBtn');
const chatModeBtn = document.getElementById('chatModeBtn');
const workModeBtn = document.getElementById('workModeBtn');
const avatarWrap = document.getElementById('avatarWrap');
const avatarStage = document.getElementById('avatarStage');
const appRoot = document.querySelector('.app');
const chatPanel = document.querySelector('.chat-panel');
const dockFlyout = document.getElementById('dockFlyout');
const dockToggleBtn = document.getElementById('dockToggleBtn');
const profileBtn = document.getElementById('profileBtn');
const followBtn = document.getElementById('followBtn');
const followBtnIcon = document.getElementById('followBtnIcon');
const cameraBtn = document.getElementById('cameraBtn');
const chatViewBtn = document.getElementById('chatViewBtn');
const chatViewBtnText = document.getElementById('chatViewBtnText');
const bgPrevBtn = document.getElementById('bgPrevBtn');
const bgNextBtn = document.getElementById('bgNextBtn');
const bgLabel = document.getElementById('bgLabel');
const gatewayStatus = document.getElementById('gatewayStatus');
const gatewayStatusText = document.getElementById('gatewayStatusText');
const phoneTimeEl = document.querySelector('.phone-time');
const profileModal = document.getElementById('profileModal');
const profileBackdrop = document.getElementById('profileBackdrop');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const profileForm = document.getElementById('profileForm');
const profileStatus = document.getElementById('profileStatus');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const profileNameInput = document.getElementById('profileName');
const profilePreferredTitleInput = document.getElementById('profilePreferredTitle');
const profileAgeInput = document.getElementById('profileAge');
const profileJobInput = document.getElementById('profileJob');
const profileTraitsInput = document.getElementById('profileTraits');
const galDialog = document.getElementById('galDialog');
const galSpeakerEl = document.getElementById('galSpeaker');
const galPromptEl = document.getElementById('galPrompt');
const galMessageEl = document.getElementById('galMessage');
const live2dCanvas = document.getElementById('live2dCanvas');
const live2dFallback = document.getElementById('live2dFallback');

let pixiApp = null;
let live2dModel = null;
let recognition = null;
let isListening = false;
let actionToken = 0;
const missingParamIds = new Set();
const modelBase = { x: 0, y: 0, scale: 1, rotation: 0 };
let actionBoost = 1;
let idleTimer = null;
let lastUserActionAt = Date.now();
let lastUserMessageAt = Date.now();
let isMouseFollowEnabled = false;
let speakingTimer = null;
let speakingToken = 0;
let armMode = 'A';
let armModeTimer = null;
let followPointer = { x: 0, y: 0 };
const modelMetrics = { width: 1, height: 1 };
let fitLive2DStage = null;
let voicePlaybackEnabled = true;
let ttsAvailable = false;
let audioContext = null;
let audioContextUnlocked = false;
let currentAudioSource = null;
let currentAudioAnalyser = null;
let currentAudioSampleData = null;
let currentMouthLevel = 0;
let speechRequestToken = 0;
let currentMode = 'chat';
let openClawConnected = false;
let currentChatView = 'phone';
let isDockExpanded = false;
let galThinkingTimer = null;
let lastUserUtterance = '';
const HISTORY_LIMIT = 20;
let runtimeStatusTimer = null;
let ttsStatusTimer = null;
let actionLockUntil = 0;
let followTarget = { x: 0, y: 0 };
let followCurrent = { x: 0, y: 0 };
let idleLookTarget = { x: 0, y: 0 };
let ambientPresenceTarget = { lookX: 0, lookY: 0, bodyX: 0, bodyY: 0, tilt: 0, lift: 0, leg: 0, scale: 0 };
let ambientPresenceCurrent = { lookX: 0, lookY: 0, bodyX: 0, bodyY: 0, tilt: 0, lift: 0, leg: 0, scale: 0 };
let nextPresenceAccentAt = 0;
let nextIdleLookAt = 0;
let blinkEndsAt = 0;
let nextBlinkAt = 0;
let sleepMode = 'awake';
let sleepModeStartedAt = 0;
let lastSleepCycleAt = Date.now();
let currentCameraMode = 'upper-body';
let currentBackgroundIndex = 0;
let faceTapCount = 0;
let faceTapTimer = null;
const hasSpeechRecognitionSupport = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
const urlSearchParams = new URLSearchParams(window.location.search);
const isCompactWindow = urlSearchParams.get('compact') === '1';
const isElectronWindow = urlSearchParams.get('electron') === '1';
const SLEEP_TRIGGER_MS = 10000;
const SLEEP_HOLD_MS = 5000;
const SLEEP_WAKE_MS = 2800;
const CAMERA_PRESETS = {
  'upper-body': {
    x: 0.5,
    y: 0.9,
    widthRatio: 0.98,
    heightRatio: 1.34,
    scaleBoost: 1.24
  },
  full: {
    x: 0.5,
    y: 0.555,
    widthRatio: 0.72,
    heightRatio: 0.86,
    scaleBoost: 0.98
  }
};
const BACKGROUND_SCENES = [
  {
    name: '教室',
    background: 'url("./assets/backgrounds/forest-window.jpg") center center / cover no-repeat'
  },
  {
    name: '雨街',
    background: 'url("./assets/backgrounds/rainy-tokyo.jpg") center center / cover no-repeat'
  },
  {
    name: '雪夜',
    background: 'url("./assets/backgrounds/snow-market.jpg") center center / cover no-repeat'
  }
];
const MAX_BLUSH_CHEEK = 3;
const API_BASE = (window.location.port === '5500' || window.location.port === '5501')
  ? 'http://127.0.0.1:8787'
  : '';

if (isCompactWindow) {
  document.body.dataset.compact = 'true';
  window.name = 'clawmuse-compact';
}

if (isElectronWindow) {
  document.body.dataset.electron = 'true';
}

const emotionMap = {
  neutral: 'neutral',
  happy: 'happy',
  sad: 'sad',
  angry: 'angry'
};

try {
  const storedChatView = window.localStorage.getItem('clawmuse-chat-view');
  if (storedChatView === 'gal' || storedChatView === 'phone') {
    currentChatView = storedChatView;
  }
} catch (_err) {}

try {
  isDockExpanded = window.localStorage.getItem('clawmuse-dock-expanded') === 'true';
} catch (_err) {}

function sanitizeDisplayText(text) {
  let value = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!value) return '';
  value = value.replace(/[ \t]+$/gm, '');
  value = value.replace(/(?:[“”"']{2,}|”“|""|''|’’)\s*$/u, '');
  return value.trim();
}

function getDialogueSpeaker(role) {
  if (role === 'user') return '你';
  return currentMode === 'work' ? '铃汐·工作' : '铃汐';
}

function updateDockFlyoutUI() {
  if (!dockFlyout || !dockToggleBtn) return;
  dockFlyout.dataset.expanded = String(isDockExpanded);
  dockToggleBtn.setAttribute('aria-expanded', String(isDockExpanded));
  const label = isDockExpanded ? '收起工具栏' : '展开工具栏';
  dockToggleBtn.setAttribute('aria-label', label);
  dockToggleBtn.title = label;
}

function setDockExpanded(expanded) {
  isDockExpanded = Boolean(expanded);
  updateDockFlyoutUI();
  try {
    window.localStorage.setItem('clawmuse-dock-expanded', String(isDockExpanded));
  } catch (_err) {}
}

function shortenDialoguePrompt(text, maxLength = 42) {
  const value = String(text || '').trim();
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function stopGalThinkingIndicator() {
  if (galThinkingTimer) {
    window.clearInterval(galThinkingTimer);
    galThinkingTimer = null;
  }
  if (galDialog) {
    galDialog.classList.remove('is-thinking');
  }
}

function setGalDialogue(role, text, prompt = '') {
  if (!galDialog || !galSpeakerEl || !galPromptEl || !galMessageEl) return;
  stopGalThinkingIndicator();
  galDialog.dataset.role = role;
  galSpeakerEl.textContent = getDialogueSpeaker(role);
  galPromptEl.textContent = prompt || (role === 'user' ? '铃汐会在这里接住你。' : '隐藏手机面板时，也可以在这里继续聊天。');
  galMessageEl.textContent = sanitizeDisplayText(text) || '...';
}

function startGalThinkingIndicator() {
  if (!galDialog || !galSpeakerEl || !galPromptEl || !galMessageEl) {
    return () => {};
  }

  const phrases = [
    '铃汐正在想怎么接住你',
    '铃汐在整理这句话',
    '铃汐马上就回你'
  ];

  stopGalThinkingIndicator();
  galDialog.classList.add('is-thinking');
  galDialog.dataset.role = 'bot';
  galSpeakerEl.textContent = getDialogueSpeaker('bot');
  galPromptEl.textContent = lastUserUtterance ? `你刚刚说：${shortenDialoguePrompt(lastUserUtterance)}` : '她在认真想你的话。';
  galMessageEl.textContent = phrases[0];

  let phraseIndex = 0;
  galThinkingTimer = window.setInterval(() => {
    phraseIndex = (phraseIndex + 1) % phrases.length;
    galMessageEl.textContent = phrases[phraseIndex];
  }, 1800);

  return () => {
    stopGalThinkingIndicator();
  };
}

function updateChatViewButton() {
  if (!chatViewBtn || !chatViewBtnText) return;
  const isGal = currentChatView === 'gal';
  chatViewBtn.classList.toggle('is-gal', isGal);
  chatViewBtnText.textContent = isGal ? '手机' : '剧情框';
  const label = isGal ? '切换到手机聊天面板' : '切换到剧情框对话';
  chatViewBtn.title = label;
  chatViewBtn.setAttribute('aria-label', label);
}

function syncDraftInputs(value = '') {
  if (inputEl) {
    inputEl.value = value;
  }
  if (galInputEl) {
    galInputEl.value = value;
  }
}

function setChatView(mode) {
  currentChatView = mode === 'gal' ? 'gal' : 'phone';
  document.body.dataset.chatView = currentChatView;
  if (appRoot) {
    appRoot.dataset.chatView = currentChatView;
  }
  if (chatPanel) {
    chatPanel.setAttribute('aria-hidden', String(currentChatView === 'gal'));
  }
  updateChatViewButton();
  updateAppAvailability();
  try {
    window.localStorage.setItem('clawmuse-chat-view', currentChatView);
  } catch (_err) {}
  if (currentChatView === 'gal' && galInputEl && !galInputEl.disabled) {
    galInputEl.focus({ preventScroll: true });
  }
  if (currentChatView === 'phone' && inputEl && !inputEl.disabled) {
    inputEl.focus({ preventScroll: true });
  }
  window.setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 40);
}

function addMessage(text, role) {
  const cleanedText = sanitizeDisplayText(text);
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.dataset.role = role;
  div.textContent = cleanedText;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (role === 'user') {
    lastUserUtterance = cleanedText;
  }
  setGalDialogue(
    role,
    cleanedText,
    role === 'bot' && lastUserUtterance
      ? `你刚刚说：${shortenDialoguePrompt(lastUserUtterance)}`
      : '铃汐会在这里接住你。'
  );
  return div;
}

function addMessageNode(role) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.dataset.role = role;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function startThinkingIndicator(node) {
  if (!node) return () => {};

  const phrases = [
    '铃汐正在想想怎么回你',
    '铃汐在整理语气',
    '铃汐马上接住你'
  ];

  node.textContent = '';
  node.classList.add('is-thinking');

  const wrap = document.createElement('span');
  wrap.className = 'thinking-wrap';

  const text = document.createElement('span');
  text.className = 'thinking-text';
  text.textContent = phrases[0];

  const dots = document.createElement('span');
  dots.className = 'thinking-dots';
  for (let i = 0; i < 3; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'thinking-dot';
    dot.textContent = '.';
    dots.appendChild(dot);
  }

  wrap.appendChild(text);
  wrap.appendChild(dots);
  node.appendChild(wrap);

  let phraseIndex = 0;
  const timer = window.setInterval(() => {
    phraseIndex = (phraseIndex + 1) % phrases.length;
    text.textContent = phrases[phraseIndex];
  }, 1800);
  const stopGalThinking = startGalThinkingIndicator();

  messagesEl.scrollTop = messagesEl.scrollHeight;

  return () => {
    window.clearInterval(timer);
    stopGalThinking();
    node.classList.remove('is-thinking');
  };
}

function removeHistoryDivider() {
  const divider = messagesEl.querySelector('[data-history-divider="true"]');
  if (divider) {
    divider.remove();
  }
}

function addHistoryDivider() {
  removeHistoryDivider();
  const divider = document.createElement('div');
  divider.className = 'history-divider';
  divider.dataset.historyDivider = 'true';

  const label = document.createElement('span');
  label.textContent = '以上是历史聊天记录';
  divider.appendChild(label);

  messagesEl.appendChild(divider);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return divider;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from, to, factor) {
  return from + (to - from) * factor;
}

function shapeFollowAxis(value, curve = 1.35) {
  const sign = Math.sign(value);
  const magnitude = Math.pow(Math.abs(value), curve);
  return sign * magnitude;
}

function getCameraPreset(mode = currentCameraMode) {
  return CAMERA_PRESETS[mode] || CAMERA_PRESETS['upper-body'];
}

function updatePhoneTime() {
  if (!phoneTimeEl) return;

  const now = new Date();
  phoneTimeEl.textContent = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function getFollowRigProfile() {
  if (currentCameraMode === 'full') {
    return {
      targetX: 0.66,
      targetY: 0.48,
      stageShiftX: 7.4,
      stageShiftY: 1.7,
      stageRotation: -0.008,
      headX: 7.2,
      headY: 5.6,
      headZ: -0.9,
      bodyX: 1.5,
      bodyY: 1.15,
      bodyZ: -0.35,
      eyeX: 1.56,
      eyeY: 1.42,
      leg: 0.045
    };
  }

  return {
    targetX: 1.05,
    targetY: 1.08,
    stageShiftX: 11.5,
    stageShiftY: 2.8,
    stageRotation: -0.026,
    headX: 11.4,
    headY: 8.2,
    headZ: -2.4,
    bodyX: 3.6,
    bodyY: 3.2,
    bodyZ: -1.4,
    eyeX: 1.42,
    eyeY: 1.24,
    leg: 0.1
  };
}

function setCameraMode(mode) {
  currentCameraMode = CAMERA_PRESETS[mode] ? mode : 'upper-body';
  updateCameraButton();
  if (typeof fitLive2DStage === 'function') {
    fitLive2DStage();
  }
}

function lockCharacterMotion(duration) {
  actionLockUntil = Math.max(actionLockUntil, performance.now() + duration + 80);
}

function isChatMode() {
  return currentMode === 'chat';
}

function getModeCopy(mode = currentMode) {
  if (mode === 'work') {
    return {
      placeholder: '输入任务、报错、需求或代码问题...'
    };
  }
  return {
    placeholder: '输入消息...'
  };
}

function updateModeUI() {
  const copy = getModeCopy(currentMode);
  if (inputEl && openClawConnected) inputEl.placeholder = copy.placeholder;
  if (galInputEl && openClawConnected) galInputEl.placeholder = isChatMode() ? '在这里继续说...' : copy.placeholder;
  if (chatModeBtn) {
    chatModeBtn.classList.toggle('is-active', currentMode === 'chat');
    chatModeBtn.setAttribute('aria-pressed', String(currentMode === 'chat'));
  }
  if (workModeBtn) {
    workModeBtn.classList.toggle('is-active', currentMode === 'work');
    workModeBtn.setAttribute('aria-pressed', String(currentMode === 'work'));
  }
  messagesEl.classList.toggle('is-work', currentMode === 'work');
  updateVoiceToggleButton();
  updateAppAvailability();
}

function setMode(mode) {
  currentMode = mode === 'work' ? 'work' : 'chat';
  if (!isChatMode()) {
    stopVoicePlayback();
  }
  updateModeUI();
}

function updateVoiceToggleButton() {
  if (!voiceToggleBtn) return;
  voiceToggleBtn.classList.remove('is-on', 'is-off', 'is-unavailable');
  if (!openClawConnected) {
    voiceToggleBtn.disabled = true;
    voiceToggleBtn.title = 'OpenClaw 未连接';
    voiceToggleBtn.setAttribute('aria-label', 'OpenClaw 未连接');
    voiceToggleBtn.classList.add('is-unavailable');
    return;
  }
  if (!ttsAvailable) {
    voiceToggleBtn.disabled = true;
    voiceToggleBtn.title = '语音朗读不可用';
    voiceToggleBtn.setAttribute('aria-label', '语音朗读不可用');
    voiceToggleBtn.classList.add('is-unavailable');
    return;
  }
  if (!isChatMode()) {
    voiceToggleBtn.disabled = true;
    voiceToggleBtn.title = '工作模式默认静音';
    voiceToggleBtn.setAttribute('aria-label', '工作模式默认静音');
    voiceToggleBtn.classList.add('is-off');
    return;
  }
  voiceToggleBtn.disabled = false;
  voiceToggleBtn.title = voicePlaybackEnabled ? '关闭语音朗读' : '开启语音朗读';
  voiceToggleBtn.setAttribute('aria-label', voicePlaybackEnabled ? '关闭语音朗读' : '开启语音朗读');
  voiceToggleBtn.classList.add(voicePlaybackEnabled ? 'is-on' : 'is-off');
}

function updateAppAvailability() {
  const available = openClawConnected;
  const copy = getModeCopy(currentMode);
  const chatPlaceholder = available
    ? (isChatMode() ? '在这里继续说...' : copy.placeholder)
    : 'OpenClaw 未连接，当前不可聊天';

  if (inputEl) {
    inputEl.disabled = !available;
    inputEl.placeholder = available ? copy.placeholder : 'OpenClaw 未连接，当前不可聊天';
  }

  if (galInputEl) {
    galInputEl.disabled = !available;
    galInputEl.placeholder = chatPlaceholder;
  }

  if (sendBtn) {
    sendBtn.disabled = !available;
  }

  if (galSendBtn) {
    galSendBtn.disabled = !available;
  }

  if (micBtn) {
    micBtn.disabled = !available || !hasSpeechRecognitionSupport;
    if (!isListening) {
      micBtn.textContent = hasSpeechRecognitionSupport ? '语音' : '无语音';
    }
    micBtn.title = available
      ? (hasSpeechRecognitionSupport ? '语音识别' : '当前浏览器不支持语音识别')
      : 'OpenClaw 未连接';
  }

  if (galMicBtn) {
    galMicBtn.disabled = !available || !hasSpeechRecognitionSupport;
    if (!isListening) {
      galMicBtn.textContent = hasSpeechRecognitionSupport ? '语音' : '无语音';
    }
    galMicBtn.title = available
      ? (hasSpeechRecognitionSupport ? '语音识别' : '当前浏览器不支持语音识别')
      : 'OpenClaw 未连接';
  }

  if (messagesEl) {
    messagesEl.classList.toggle('is-blocked', !available);
  }

  if (galDialog) {
    galDialog.classList.toggle('is-blocked', !available);
  }

  if (!available) {
    stopVoicePlayback();
  }

  updateVoiceToggleButton();
}

async function initTtsStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/tts/status`);
    const data = await res.json();
    ttsAvailable = Boolean(res.ok && data?.ok);
  } catch (_err) {
    ttsAvailable = false;
  }
  updateVoiceToggleButton();
}

function startTtsStatusPolling() {
  void initTtsStatus();
  if (ttsStatusTimer) {
    window.clearInterval(ttsStatusTimer);
  }
  ttsStatusTimer = window.setInterval(() => {
    void initTtsStatus();
  }, 5000);
}

function updateGatewayStatusUI(connected, label = 'offline') {
  if (!gatewayStatus || !gatewayStatusText) return;
  openClawConnected = Boolean(connected);
  gatewayStatus.classList.toggle('status-connected', connected);
  gatewayStatus.classList.toggle('status-disconnected', !connected);
  gatewayStatusText.textContent = label;
  gatewayStatus.title = connected ? 'OpenClaw online' : 'OpenClaw offline';
  gatewayStatus.setAttribute('aria-label', connected ? 'OpenClaw online' : 'OpenClaw offline');
  gatewayStatus.style.color = connected ? '#29d764' : '#ff4d4f';
  gatewayStatus.style.borderColor = connected ? 'rgba(41, 215, 100, 0.45)' : 'rgba(255, 77, 79, 0.45)';
  gatewayStatus.style.background = connected ? 'rgba(9, 44, 20, 0.82)' : 'rgba(56, 10, 12, 0.82)';
  updateAppAvailability();
}

async function refreshRuntimeStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/runtime-status`);
    if (!res.ok) throw new Error(`status_${res.status}`);
    const data = await res.json();
    const connected = Boolean(data?.openclaw?.connected);
    const label = connected ? 'online' : 'offline';
    updateGatewayStatusUI(connected, label);
  } catch (_err) {
    updateGatewayStatusUI(false, 'offline');
  }
}

function initRuntimeStatus() {
  void refreshRuntimeStatus();
  if (runtimeStatusTimer) {
    window.clearInterval(runtimeStatusTimer);
  }
  runtimeStatusTimer = window.setInterval(() => {
    void refreshRuntimeStatus();
  }, 12000);
}

function primeAudioPlayback() {
  try {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state !== 'running') {
      audioContext.resume().catch(() => {});
    }
    audioContextUnlocked = Boolean(audioContext && audioContext.state === 'running');
  } catch (_err) {
    audioContextUnlocked = false;
  }
}

function stopVoicePlayback() {
  speechRequestToken += 1;
  if (currentAudioSource) {
    try {
      currentAudioSource.stop(0);
    } catch (_err) {}
    currentAudioSource.disconnect();
    currentAudioSource = null;
  }
  currentAudioAnalyser = null;
  currentAudioSampleData = null;
  currentMouthLevel = 0;
}

function stopCurrentAudioSource() {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop(0);
    } catch (_err) {}
    currentAudioSource.disconnect();
    currentAudioSource = null;
  }
  currentAudioAnalyser = null;
  currentAudioSampleData = null;
  currentMouthLevel = 0;
}

async function playAudioBlob(audioBlob, token = speechRequestToken) {
  if (!voicePlaybackEnabled) return false;
  primeAudioPlayback();
  if (!audioContext || !audioContextUnlocked) {
    return false;
  }

  let audioBuffer = null;
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch (_err) {
    return false;
  }

  stopCurrentAudioSource();
  const source = audioContext.createBufferSource();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.82;
  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  currentAudioSource = source;
  currentAudioAnalyser = analyser;
  currentAudioSampleData = new Uint8Array(analyser.frequencyBinCount);
  return new Promise((resolve, reject) => {
    source.onended = () => {
      if (currentAudioSource === source) {
        currentAudioSource = null;
      }
      if (currentAudioAnalyser === analyser) {
        currentAudioAnalyser = null;
        currentAudioSampleData = null;
      }
      currentMouthLevel = 0;
      resolve(token === speechRequestToken);
    };
    try {
      source.start(0);
    } catch (error) {
      if (currentAudioSource === source) {
        currentAudioSource = null;
      }
      if (currentAudioAnalyser === analyser) {
        currentAudioAnalyser = null;
        currentAudioSampleData = null;
      }
      currentMouthLevel = 0;
      reject(error);
    }
  });
}

function detectPrimarySpeechLanguage(text) {
  const source = String(text || '').trim();
  if (/[\u4e00-\u9fff]/.test(source)) return 'zh';
  if (/[A-Za-z]/.test(source)) return 'en';
  return 'zh';
}

function mergeSpeechChunks(chunks, lang, chunkLimit) {
  const merged = [];
  const minChunkLength = lang === 'en' ? 110 : 20;

  for (const entry of chunks) {
    const text = String(entry?.text || '').trim();
    if (!text) continue;

    if (!merged.length) {
      merged.push({ text, lang });
      continue;
    }

    const previous = merged[merged.length - 1];
    const combined = `${previous.text} ${text}`.replace(/\s+/g, ' ').trim();
    const shouldMergeShortTail =
      previous.text.length < minChunkLength ||
      (text.length < Math.max(10, Math.floor(minChunkLength * 0.7)) && combined.length <= chunkLimit * 1.15);

    if (shouldMergeShortTail && combined.length <= chunkLimit * 1.18) {
      previous.text = combined;
    } else {
      merged.push({ text, lang });
    }
  }

  return merged;
}

function splitSpeechText(text, maxChunkLength = 92) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .trim();
  const preferredLang = detectPrimarySpeechLanguage(normalized);
  const chunkLimit = preferredLang === 'en' ? 320 : maxChunkLength;

  if (!normalized) return [];
  if (preferredLang === 'en' && normalized.length <= chunkLimit) {
    return [{ text: normalized, lang: preferredLang }];
  }

  const sentenceParts = normalized
    .split(preferredLang === 'en' ? /(?<=[.!?])/ : /(?<=[，,。！？!?；;])/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!sentenceParts.length) {
    return [{ text: normalized, lang: preferredLang }];
  }

  const chunks = [];
  let current = '';
  for (let i = 0; i < sentenceParts.length; i += 1) {
    const part = sentenceParts[i];
    const nextPart = sentenceParts[i + 1] || '';
    const candidate = `${current}${part}`.trim();
    const endsWithComma = preferredLang !== 'en' && /[，,]$/.test(candidate);
    const endsWithMajorPause = /[。！？!?；;]$/.test(candidate);
    const canGrow = candidate.length <= chunkLimit;

    if (!current || (canGrow && (!endsWithMajorPause || endsWithComma || candidate.length < 22))) {
      current = candidate;
      if (endsWithComma && nextPart) {
        continue;
      }
      if (endsWithMajorPause && current.length >= 14) {
        chunks.push(current);
        current = '';
      }
      continue;
    }

    chunks.push(current);
    current = part;
  }

  if (current) {
    chunks.push(current);
  }

  const normalizedChunks = chunks.flatMap((chunk) => {
    if (chunk.length <= chunkLimit) {
      return [{ text: chunk, lang: preferredLang }];
    }

    const pieces = [];
    if (preferredLang === 'en') {
      const words = chunk.split(/\s+/).filter(Boolean);
      let piece = '';
      for (const word of words) {
        const nextPiece = piece ? `${piece} ${word}` : word;
        if (nextPiece.length > chunkLimit && piece) {
          pieces.push({ text: piece, lang: preferredLang });
          piece = word;
        } else {
          piece = nextPiece;
        }
      }
      if (piece) {
        pieces.push({ text: piece, lang: preferredLang });
      }
      return pieces;
    }

    for (let i = 0; i < chunk.length; i += chunkLimit) {
      const piece = chunk.slice(i, i + chunkLimit);
      pieces.push({ text: piece, lang: preferredLang });
    }
    return pieces.map((piece) => ({ text: piece.text || piece, lang: preferredLang }));
  }).filter(Boolean);

  return mergeSpeechChunks(normalizedChunks, preferredLang, chunkLimit);
}

async function fetchSpeechAudio(chunk, token) {
  const text = String(chunk?.text || '').trim();
  const lang = String(chunk?.lang || '').trim().toLowerCase();
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang })
  });

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error || data?.reason || data?.message || '';
    } catch (_err) {
      detail = await res.text().catch(() => '');
    }
    throw new Error(detail || `语音请求失败：${res.status}`);
  }

  const audioBlob = await res.blob();
  if (token !== speechRequestToken) {
    return false;
  }
  return audioBlob;
}

async function speakReply(text) {
  const chunks = splitSpeechText(text);
  if (!chunks.length || !isChatMode()) return;
  const token = ++speechRequestToken;
  try {
    const audioPromises = new Map();
    const ensurePrefetch = (fromIndex) => {
      const end = Math.min(chunks.length, fromIndex + 3);
      for (let i = fromIndex; i < end; i += 1) {
        if (!audioPromises.has(i)) {
          audioPromises.set(i, fetchSpeechAudio(chunks[i], token));
        }
      }
    };

    ensurePrefetch(0);
    for (let i = 0; i < chunks.length; i += 1) {
      if (token !== speechRequestToken) return;
      const audioBlob = await audioPromises.get(i);
      if (!audioBlob || token !== speechRequestToken) return;
      ensurePrefetch(i + 1);
      const played = await playAudioBlob(audioBlob, token);
      if (!played) return;
    }
  } catch (err) {
    console.warn('[TTS] playback failed:', err);
    if (token === speechRequestToken) {
      addMessage(err instanceof Error ? err.message : '语音播放失败。', 'bot');
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCurrentEmotion() {
  return avatarWrap?.dataset?.emotion || 'neutral';
}

function getCheekValueByEmotion(emotion) {
  return emotion === 'sad' || emotion === 'angry' ? 0 : 1;
}

function getAudioDrivenMouthLevel() {
  if (!currentAudioAnalyser || !currentAudioSampleData) {
    currentMouthLevel = lerp(currentMouthLevel, 0, 0.18);
    return currentMouthLevel;
  }

  currentAudioAnalyser.getByteTimeDomainData(currentAudioSampleData);
  let sum = 0;
  for (let i = 0; i < currentAudioSampleData.length; i += 1) {
    const centered = (currentAudioSampleData[i] - 128) / 128;
    sum += centered * centered;
  }
  const rms = Math.sqrt(sum / currentAudioSampleData.length);
  const target = clampValue((rms - 0.015) * 8.4, 0, 1);
  currentMouthLevel = lerp(currentMouthLevel, target, target > currentMouthLevel ? 0.42 : 0.22);
  return currentMouthLevel;
}

function stopSpeakingAnimation() {
  speakingToken += 1;
  if (speakingTimer) {
    clearTimeout(speakingTimer);
    speakingTimer = null;
  }
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel) return;
  const emotion = getCurrentEmotion();
  const mouthFormBase =
    emotion === 'happy' ? 1 :
    emotion === 'sad' ? -1 :
    0;
  applyArmMode();
  setParam(coreModel, 'ParamMouthOpenY', 0.12);
  setParam(coreModel, 'ParamMouthForm', mouthFormBase);
  setParam(coreModel, 'ParamCheek', getCheekValueByEmotion(emotion));
}

function splitWorkReply(text) {
  const normalized = String(text || '').trim();
  const headingMatch = normalized.match(/^#{1,6}\s*(.+)$/m);
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = (headingMatch?.[1] || lines[0] || normalized).trim();
  const sentenceMatch = normalized.match(/^(.{1,90}?[。！？!?]|.{1,90})(?:\s|$)/);
  const summarySource = lines.find((line) => line !== firstLine) || sentenceMatch?.[1] || normalized;
  const summary = String(summarySource || firstLine || normalized).replace(/^#{1,6}\s*/, '').trim();
  const detailLines = lines.filter((line) => line !== firstLine);
  const details = detailLines.join('\n').trim();
  return {
    title: firstLine || '本次结果',
    summary: summary || '我已经整理好了，下面是这次的结果。',
    details
  };
}

function renderWorkReply(node, text) {
  const { title, summary, details } = splitWorkReply(sanitizeDisplayText(text));
  node.classList.add('work-card');
  node.textContent = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'work-title';
  titleEl.textContent = title;
  node.appendChild(titleEl);

  const summaryEl = document.createElement('div');
  summaryEl.className = 'work-summary';
  summaryEl.textContent = summary;
  node.appendChild(summaryEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'work-meta';
  metaEl.textContent = details ? '已为你压成摘要，详细内容在下面展开。' : '结果较短，已经直接给你。';
  node.appendChild(metaEl);

  if (details && details !== summary) {
    const detailsEl = document.createElement('details');
    detailsEl.className = 'work-details';
    const detailsSummary = document.createElement('summary');
    detailsSummary.textContent = '展开完整结果';
    const detailsContent = document.createElement('pre');
    detailsContent.textContent = details;
    detailsEl.appendChild(detailsSummary);
    detailsEl.appendChild(detailsContent);
    node.appendChild(detailsEl);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
  setGalDialogue('bot', summary || title, lastUserUtterance ? `你刚刚说：${shortenDialoguePrompt(lastUserUtterance)}` : '');
}

function renderHistoryEntry(entry) {
  if (!entry || !entry.role || !entry.content) return;
  const mode = entry.mode === 'work' ? 'work' : 'chat';
  if (entry.role === 'user') {
    addMessage(entry.content, 'user');
    return;
  }
  const node = addMessageNode('bot');
  if (mode === 'work') {
    renderWorkReply(node, entry.content);
  } else {
    node.textContent = entry.content;
  }
}

async function restoreHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/history?limit=${HISTORY_LIMIT}`);
    if (!res.ok) return false;
    const data = await res.json();
    const history = Array.isArray(data?.history) ? data.history : [];
    if (!history.length) return false;
    messagesEl.textContent = '';
    history.forEach((entry) => renderHistoryEntry(entry));
    addHistoryDivider();
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return true;
  } catch (_err) {
    return false;
  }
}

function splitChatReply(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const rawParts = normalized
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments = [];
  for (const part of rawParts) {
    if (!segments.length) {
      segments.push(part);
      continue;
    }
    const previous = segments[segments.length - 1];
    if ((previous.length < 14 || part.length < 12) && previous.length + part.length <= 34) {
      segments[segments.length - 1] = `${previous}${part}`;
    } else {
      segments.push(part);
    }
  }

  return segments.slice(0, 6);
}

function startSpeakingAnimation(char = '') {
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel) return;

  const token = ++speakingToken;
  if (speakingTimer) {
    clearTimeout(speakingTimer);
  }

  const emotion = getCurrentEmotion();
  const isPunctuation = /[，。！？,.!?、\s]/.test(char);
  const openValue = isPunctuation ? 0.14 : 0.46;
  const formBase =
    emotion === 'happy' ? 0.9 :
    emotion === 'sad' ? -0.55 :
    0.15;
  const formValue = isPunctuation ? formBase : formBase + 0.08;

  setParam(coreModel, 'ParamMouthOpenY', openValue);
  setParam(coreModel, 'ParamMouthForm', formValue);

  speakingTimer = setTimeout(() => {
    if (token !== speakingToken) return;
    setParam(coreModel, 'ParamMouthOpenY', 0.12);
    setParam(coreModel, 'ParamMouthForm', formBase);
  }, isPunctuation ? 120 : 180);
}

async function typeOutMessage(node, text) {
  const chars = Array.from(sanitizeDisplayText(text) || '');
  node.textContent = '';
  for (let i = 0; i < chars.length; i += 1) {
    node.textContent += chars[i];
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setGalDialogue('bot', node.textContent, lastUserUtterance ? `你刚刚说：${shortenDialoguePrompt(lastUserUtterance)}` : '');
    const ch = chars[i];
    const delay = /[，。！？,.!?]/.test(ch) ? 160 : 42;
    await sleep(delay);
  }
}

function setParam(coreModel, id, value) {
  try {
    if (typeof coreModel.setParameterValueById === 'function') {
      coreModel.setParameterValueById(id, value);
      return;
    }
    const index = coreModel.getParameterIndex(id);
    if (index >= 0 && typeof coreModel.setParameterValueByIndex === 'function') {
      coreModel.setParameterValueByIndex(index, value, 1);
      return;
    }
    if (!missingParamIds.has(id)) {
      missingParamIds.add(id);
      console.warn('[Live2D] Missing parameter id:', id);
    }
  } catch (err) {
    if (!missingParamIds.has(id)) {
      missingParamIds.add(id);
      console.warn('[Live2D] setParam failed:', id, err);
    }
  }
}

function setPartOpacity(coreModel, id, value) {
  try {
    if (typeof coreModel.setPartOpacityById === 'function') {
      coreModel.setPartOpacityById(id, value);
      return;
    }
    const index = coreModel.getPartIndex ? coreModel.getPartIndex(id) : -1;
    if (index >= 0 && typeof coreModel.setPartOpacityByIndex === 'function') {
      coreModel.setPartOpacityByIndex(index, value);
    }
  } catch (_err) {}
}

function normalizeArmVisibility() {
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel) return;
  setPartOpacity(coreModel, 'PartArmA', 1);
  setPartOpacity(coreModel, 'PartArmB', 0);
}

function useArmBVisibility(coreModel) {
  if (!coreModel) return;
  setPartOpacity(coreModel, 'PartArmA', 0);
  setPartOpacity(coreModel, 'PartArmB', 1);
}

function applyArmMode() {
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel) return;
  if (armMode === 'B') {
    useArmBVisibility(coreModel);
  } else {
    normalizeArmVisibility();
  }
}

function setArmMode(mode) {
  armMode = mode === 'B' ? 'B' : 'A';
  applyArmMode();
}

function startArmModeGuard() {
  if (armModeTimer) clearInterval(armModeTimer);
  armModeTimer = setInterval(() => {
    applyArmMode();
  }, 80);
}

function applyEmotionToModel(emotion) {
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel) return;

  stopSpeakingAnimation();
  applyArmMode();
  setParam(coreModel, 'ParamAngleX', 0);
  setParam(coreModel, 'ParamAngleY', 0);
  setParam(coreModel, 'ParamAngleZ', 0);
  setParam(coreModel, 'ParamMouthOpenY', 0.12);
  setParam(coreModel, 'ParamMouthForm', 0);
  setParam(coreModel, 'ParamBrowLY', 0);
  setParam(coreModel, 'ParamBrowRY', 0);
  setParam(coreModel, 'ParamCheek', 1);

  if (emotion === 'happy') {
    setParam(coreModel, 'ParamMouthForm', 1);
  } else if (emotion === 'sad') {
    setParam(coreModel, 'ParamMouthForm', -1);
    setParam(coreModel, 'ParamAngleY', -5);
    setParam(coreModel, 'ParamCheek', 0);
  } else if (emotion === 'angry') {
    setParam(coreModel, 'ParamBrowLY', -0.6);
    setParam(coreModel, 'ParamBrowRY', -0.6);
    setParam(coreModel, 'ParamAngleY', 4);
    setParam(coreModel, 'ParamCheek', 0);
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function pulse(t) {
  return Math.sin(t * Math.PI);
}

function animateAction(duration, frameFn, endFn) {
  const token = ++actionToken;
  const start = performance.now();

  const step = (now) => {
    if (token !== actionToken) return;
    const progress = Math.min(1, (now - start) / duration);
    frameFn(progress);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else if (endFn) {
      endFn();
    }
  };

  requestAnimationFrame(step);
}

function setModelTransform(x, y, scale, rotation = 0) {
  if (!live2dModel) return;
  live2dModel.x = x;
  live2dModel.y = y;
  live2dModel.scale.set(scale);
  live2dModel.rotation = rotation;
}

function animateModelMotion(duration, frameFn) {
  animateAction(
    duration,
    (t) => {
      const m = frameFn(t);
      setModelTransform(
        modelBase.x + (m.dx || 0) * actionBoost,
        modelBase.y + (m.dy || 0) * actionBoost,
        modelBase.scale * (1 + ((m.ds || 1) - 1) * actionBoost),
        (m.dr || 0) * actionBoost
      );
    },
    () => setModelTransform(modelBase.x, modelBase.y, modelBase.scale, 0)
  );
}

function resetModelViewport() {
  setModelTransform(modelBase.x, modelBase.y, modelBase.scale, modelBase.rotation || 0);
}

function markUserAction() {
  const now = Date.now();
  lastUserActionAt = now;
  if (sleepMode !== 'awake') {
    sleepMode = 'awake';
    sleepModeStartedAt = 0;
    lastSleepCycleAt = now;
    blinkEndsAt = 0;
    scheduleNextBlink(performance.now() + 120);
  }
}

function noteUserMessageActivity() {
  const now = Date.now();
  lastUserActionAt = now;
  lastUserMessageAt = now;
  lastSleepCycleAt = now;
  if (sleepMode !== 'awake') {
    sleepMode = 'awake';
    sleepModeStartedAt = 0;
    blinkEndsAt = 0;
    scheduleNextBlink(performance.now());
  }
  if (avatarWrap) {
    avatarWrap.dataset.restState = 'awake';
  }
}

function beginSleepMode(now = performance.now()) {
  if (sleepMode !== 'awake') return;
  sleepMode = 'falling-asleep';
  sleepModeStartedAt = now;
  blinkEndsAt = 0;
  if (avatarWrap) {
    avatarWrap.dataset.restState = 'sleeping';
  }
}

function updateSleepMode(now = performance.now()) {
  const idleBaseline = Math.max(lastUserMessageAt, lastUserActionAt);
  const idleMs = Date.now() - idleBaseline;
  const canRest = !isListening && !currentAudioSource && now >= actionLockUntil;

  if (sleepMode === 'awake') {
    if (avatarWrap) {
      avatarWrap.dataset.restState = 'awake';
    }
    if (idleMs >= SLEEP_TRIGGER_MS && Date.now() - lastSleepCycleAt >= SLEEP_TRIGGER_MS && canRest) {
      beginSleepMode(now);
    }
    return;
  }

  const elapsed = now - sleepModeStartedAt;
  if (sleepMode === 'falling-asleep' && elapsed >= 1100) {
    sleepMode = 'sleeping';
    sleepModeStartedAt = now;
    if (avatarWrap) {
      avatarWrap.dataset.restState = 'sleeping';
    }
    return;
  }
  if (sleepMode === 'sleeping' && elapsed >= SLEEP_HOLD_MS) {
    sleepMode = 'waking';
    sleepModeStartedAt = now;
    if (avatarWrap) {
      avatarWrap.dataset.restState = 'waking';
    }
    return;
  }
  if (sleepMode === 'waking' && elapsed >= SLEEP_WAKE_MS) {
    sleepMode = 'awake';
    sleepModeStartedAt = 0;
    lastSleepCycleAt = Date.now();
    if (avatarWrap) {
      avatarWrap.dataset.restState = 'awake';
    }
    scheduleNextBlink(now + 600);
  }
}

function getSleepPose(now = performance.now()) {
  if (sleepMode === 'awake') {
    return {
      active: false,
      eyeOpen: null,
      headX: 0,
      headY: 0,
      headZ: 0,
      bodyX: 0,
      bodyY: 0,
      bodyZ: 0,
      stageY: 0,
      mouth: 0.055
    };
  }

  const elapsed = now - sleepModeStartedAt;
  if (sleepMode === 'falling-asleep') {
    const k = easeInOut(clampValue(elapsed / 1100, 0, 1));
    return {
      active: true,
      eyeOpen: 1 - k,
      headX: 0,
      headY: 10.5 * k,
      headZ: -2.8 * k,
      bodyX: 0,
      bodyY: 2.8 * k,
      bodyZ: -1.2 * k,
      stageY: 7.5 * k,
      mouth: 0.05 - 0.016 * k
    };
  }

  if (sleepMode === 'sleeping') {
    const breathe = Math.sin(elapsed / 820);
    return {
      active: true,
      eyeOpen: 0,
      headX: 0,
      headY: 10.8 + breathe * 0.4,
      headZ: -2.8,
      bodyX: 0,
      bodyY: 2.9 + breathe * 0.25,
      bodyZ: -1.2,
      stageY: 8 + Math.abs(breathe) * 1.05,
      mouth: 0.026 + Math.abs(breathe) * 0.006
    };
  }

  const t = clampValue(elapsed / SLEEP_WAKE_MS, 0, 1);
  const wakeLift = easeInOut(t);
  const flutter = t < 0.78 ? Math.max(0, Math.sin(t * Math.PI * 3.3)) * 0.46 * (1 - t) : 0;
  const eyeOpen = clampValue(0.02 + wakeLift * 1.02 - flutter, 0, 1);
  return {
    active: true,
    eyeOpen,
    headX: 0,
    headY: 10.8 * (1 - wakeLift),
    headZ: -2.8 * (1 - wakeLift),
    bodyX: 0,
    bodyY: 2.9 * (1 - wakeLift),
    bodyZ: -1.2 * (1 - wakeLift),
    stageY: 8 * (1 - wakeLift),
    mouth: 0.03 + wakeLift * 0.022
  };
}

function isFaceTap(event) {
  if (!avatarStage) return false;
  const rect = avatarStage.getBoundingClientRect();
  const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
  if (currentCameraMode === 'full') {
    return x >= 0.3 && x <= 0.7 && y >= 0.16 && y <= 0.48;
  }
  return x >= 0.26 && x <= 0.74 && y >= 0.1 && y <= 0.42;
}

function registerFaceTap(event) {
  if (!isFaceTap(event)) {
    faceTapCount = 0;
    if (faceTapTimer) {
      clearTimeout(faceTapTimer);
      faceTapTimer = null;
    }
    return;
  }

  faceTapCount += 1;
  if (faceTapTimer) {
    clearTimeout(faceTapTimer);
  }

  if (faceTapCount >= 3) {
    faceTapCount = 0;
    faceTapTimer = null;
    playAction('shy');
    return;
  }

  faceTapTimer = setTimeout(() => {
    faceTapCount = 0;
    faceTapTimer = null;
  }, 520);
}

function resolveAction(text, emotion) {
  const source = String(text || '');
  if (/[?？]|(吗|呢|真的假的|是吗|什么情况)/.test(source)) return 'question';
  if (/(脸红|脸好烫|害羞死|羞羞|不好意思|红温)/.test(source)) return 'blush';
  if (/(晚安|拜拜|再见|回头聊|明天见)/.test(source)) return 'wave';
  if (/(害羞|脸红|不好意思|羞羞|紧张)/.test(source)) return 'shy';
  if (/(抱抱|别怕|没事|陪你|辛苦了|心疼你|安慰)/.test(source)) return 'soothe';
  if (emotion === 'angry' || /(生气|火大|烦死|讨厌)/.test(source)) return 'angry';
  if (emotion === 'happy' || /(开心|太棒|哈哈|喜欢|爱你|耶)/.test(source)) return 'happy';
  return null;
}

function playAction(actionName) {
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel || !actionName) return;
  markUserAction();
  if (sleepMode !== 'awake') {
    sleepMode = 'awake';
    sleepModeStartedAt = 0;
    if (avatarWrap) {
      avatarWrap.dataset.restState = 'awake';
    }
  }
  stopSpeakingAnimation();

  const baseEmotion = avatarWrap?.dataset?.emotion || 'neutral';
  const resetBase = (options = {}) => {
    const { smooth = false, duration = 0 } = options;
    if (smooth) {
      lockCharacterMotion(duration);
      animateAction(duration, (t) => {
        const k = easeInOut(t);
        setParam(coreModel, 'ParamAngleX', -2.6 * (1 - k));
        setParam(coreModel, 'ParamAngleY', 3.2 * (1 - k));
        setParam(coreModel, 'ParamAngleZ', -1.2 * (1 - k));
        setParam(coreModel, 'ParamMouthForm', 0.18 * (1 - k));
        setParam(coreModel, 'ParamCheek', 1 + (MAX_BLUSH_CHEEK - 1) * (1 - k) * 0.4);
        setParam(coreModel, 'ParamEyeLOpen', 0.72 + k * 0.28);
        setParam(coreModel, 'ParamEyeROpen', 0.72 + k * 0.28);
      }, () => {
        setArmMode('A');
        applyEmotionToModel(baseEmotion);
      });
      return;
    }
    setArmMode('A');
    applyEmotionToModel(baseEmotion);
  };
  resetBase();

  if (actionName === 'blush') {
    lockCharacterMotion(980);
    setArmMode('B');
    animateModelMotion(980, (t) => {
      const k = easeInOut(t);
      return { dx: -18 * k, dy: 10 * k, ds: 1.03, dr: -0.1 * k };
    });
    animateAction(980, (t) => {
      const k = easeInOut(t);
      setParam(coreModel, 'ParamCheek', 1 + k * (MAX_BLUSH_CHEEK - 1));
      setParam(coreModel, 'ParamMouthForm', 0.35 + k * 0.45);
      setParam(coreModel, 'ParamEyeLOpen', 1 - k * 0.35);
      setParam(coreModel, 'ParamEyeROpen', 1 - k * 0.35);
      setParam(coreModel, 'ParamAngleY', 8 * k);
    }, () => {
      resetBase();
    });
    return;
  }

  if (actionName === 'question') {
    lockCharacterMotion(1500);
    animateModelMotion(1500, (t) => {
      const k = Math.sin(t * Math.PI);
      return { dx: 10 * k, dy: -6 * k, ds: 1.01, dr: -0.08 * k };
    });
    animateAction(1500, (t) => {
      const k = Math.sin(t * Math.PI);
      // Questioning pose: slight body Z tilt, then recover within ~1.5s.
      setParam(coreModel, 'ParamBodyAngleZ', -10 * k);
      setParam(coreModel, 'ParamAngleZ', -7 * k);
      setParam(coreModel, 'ParamEyeBallX', 0.5 * k);
      setParam(coreModel, 'ParamMouthOpenY', 0.1 + 0.06 * k);
    }, resetBase);
    return;
  }

  if (actionName === 'happy') {
    lockCharacterMotion(720);
    setArmMode('B');
    animateModelMotion(700, (t) => {
      const k = Math.sin(t * Math.PI * 2);
      return { dx: k * 28, dy: -Math.abs(k) * 22, ds: 1.06 + Math.abs(k) * 0.08, dr: k * 0.08 };
    });
    animateAction(720, (t) => {
      const k = pulse(t);
      setParam(coreModel, 'ParamMouthForm', 0.8 + k * 0.8);
      setParam(coreModel, 'ParamCheek', 1);
      setParam(coreModel, 'ParamAngleY', -8 + k * 8);
      setParam(coreModel, 'ParamEyeLSmile', 0.4 + k * 1.1);
      setParam(coreModel, 'ParamEyeRSmile', 0.4 + k * 1.1);
    }, () => {
      resetBase();
    });
    return;
  }

  if (actionName === 'angry') {
    lockCharacterMotion(650);
    animateModelMotion(650, (t) => {
      const k = Math.sin(t * Math.PI * 10);
      return { dx: k * 38, dy: 0, ds: 1.01, dr: k * 0.09 };
    });
    animateAction(620, (t) => {
      const k = pulse(t);
      setParam(coreModel, 'ParamBrowLY', -1.0 - k * 0.6);
      setParam(coreModel, 'ParamBrowRY', -1.0 - k * 0.6);
      setParam(coreModel, 'ParamAngleX', -10 + Math.sin(t * 18) * 18);
      setParam(coreModel, 'ParamMouthForm', -1.1);
    }, resetBase);
    return;
  }

  if (actionName === 'shy') {
    lockCharacterMotion(2200);
    setArmMode('B');
    setTimeout(() => {
      if (armMode === 'B') {
        setArmMode('A');
      }
    }, 920);
    animateModelMotion(1700, (t) => {
      const hold = t < 0.55 ? easeInOut(t / 0.55) : 1 - easeInOut((t - 0.55) / 0.45);
      return { dx: -18 * hold, dy: 18 * hold, ds: 1 - hold * 0.045, dr: -0.08 * hold };
    });
    animateAction(1700, (t) => {
      const poseIn = t < 0.36 ? easeInOut(t / 0.36) : 1;
      const poseOut = t > 0.58 ? 1 - easeInOut((t - 0.58) / 0.42) : 1;
      const pose = Math.max(0, Math.min(1, poseIn * poseOut));
      const blushFade = t < 0.82 ? 1 : 1 - easeInOut((t - 0.82) / 0.18);
      setParam(coreModel, 'ParamAngleY', 10 * pose);
      setParam(coreModel, 'ParamAngleX', -8 * pose);
      setParam(coreModel, 'ParamMouthForm', 0.25 + pose * 0.65);
      setParam(coreModel, 'ParamCheek', 0.7 + blushFade * (MAX_BLUSH_CHEEK - 0.7));
      setParam(coreModel, 'ParamEyeLOpen', 1 - pose * 0.28);
      setParam(coreModel, 'ParamEyeROpen', 1 - pose * 0.28);
    }, () => {
      resetBase({ smooth: true, duration: 520 });
    });
    return;
  }

  if (actionName === 'soothe') {
    lockCharacterMotion(1100);
    animateModelMotion(1100, (t) => {
      const k = Math.sin(t * Math.PI * 2);
      return { dx: k * 18, dy: Math.abs(k) * 16, ds: 1.03, dr: k * 0.05 };
    });
    animateAction(1100, (t) => {
      const k = pulse(t);
      setParam(coreModel, 'ParamAngleY', -11 + k * 8);
      setParam(coreModel, 'ParamAngleX', Math.sin(t * 8) * 8);
      setParam(coreModel, 'ParamMouthForm', 0.35);
      setParam(coreModel, 'ParamEyeLOpen', 0.9 - k * 0.35);
      setParam(coreModel, 'ParamEyeROpen', 0.9 - k * 0.35);
    }, resetBase);
    return;
  }

  if (actionName === 'wave') {
    lockCharacterMotion(950);
    setArmMode('B');
    animateModelMotion(950, (t) => {
      const k = Math.sin(t * Math.PI * 3);
      return { dx: k * 26, dy: -Math.abs(k) * 10, ds: 1.05, dr: k * 0.14 };
    });
    animateAction(950, (t) => {
      const k = Math.sin(t * Math.PI * 3);
      setParam(coreModel, 'ParamAngleX', k * 24);
      setParam(coreModel, 'ParamAngleZ', k * 16);
      setParam(coreModel, 'ParamBodyAngleX', k * 14);
      setParam(coreModel, 'ParamMouthForm', 0.45);
    }, () => {
      resetBase();
    });
  }
}

function startIdleLoop() {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    const now = Date.now();
    if (isMouseFollowEnabled) return;
    if (now - lastUserActionAt < 2600) return;
    schedulePresenceAccent(performance.now());
    scheduleIdleLook(performance.now());
  }, 2400);
}

function updateFollowButton() {
  if (!followBtn) return;
  followBtn.classList.toggle('follow-on', isMouseFollowEnabled);
  const label = isMouseFollowEnabled ? '关闭鼠标跟随' : '开启鼠标跟随';
  if (followBtnIcon) {
    followBtnIcon.src = isMouseFollowEnabled ? './assets/icon/Openeys.png' : './assets/icon/Closeeyes.png';
  }
  followBtn.setAttribute('aria-label', label);
  followBtn.title = label;
}

function updateCameraButton() {
  if (!cameraBtn) return;
  const isFull = currentCameraMode === 'full';
  cameraBtn.classList.toggle('is-full', isFull);
  cameraBtn.classList.toggle('is-upper', !isFull);
  const nextLabel = isFull ? '上半身' : '全身';
  cameraBtn.setAttribute('aria-label', `切换到${nextLabel}镜头`);
  cameraBtn.title = `切换到${nextLabel}镜头`;
}

function applyBackgroundScene(index = currentBackgroundIndex) {
  if (!avatarStage) return;
  const normalized = ((index % BACKGROUND_SCENES.length) + BACKGROUND_SCENES.length) % BACKGROUND_SCENES.length;
  currentBackgroundIndex = normalized;
  const scene = BACKGROUND_SCENES[normalized];
  avatarStage.style.background = scene.background;
  if (bgLabel) {
    bgLabel.textContent = scene.name;
  }
}

function setProfileFeedback(message = '', tone = 'idle') {
  if (!profileStatus) return;
  profileStatus.textContent = message;
  profileStatus.dataset.tone = tone;
}

function stepBackground(delta) {
  applyBackgroundScene(currentBackgroundIndex + delta);
}

function showProfileCard() {
  setProfileFeedback('', 'idle');
  if (profileModal) {
    profileModal.classList.remove('hidden');
    profileModal.setAttribute('aria-hidden', 'false');
  }
  if (profileNameInput) {
    requestAnimationFrame(() => profileNameInput.focus());
  }
}

function hideProfileCard() {
  if (profileModal) {
    profileModal.classList.add('hidden');
    profileModal.setAttribute('aria-hidden', 'true');
  }
}

function fillProfileForm(profile = {}) {
  if (profileNameInput) profileNameInput.value = profile.name || '';
  if (profilePreferredTitleInput) profilePreferredTitleInput.value = profile.preferredTitle || '';
  if (profileAgeInput) profileAgeInput.value = profile.age || '';
  if (profileJobInput) profileJobInput.value = profile.job || '';
  if (profileTraitsInput) profileTraitsInput.value = profile.traits || '';
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/api/profile`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      setProfileFeedback('侧写接口暂时没连上，通常是服务还没重启。', 'error');
      return;
    }
    const data = await res.json();
    fillProfileForm(data?.profile || {});
  } catch (_err) {
    setProfileFeedback('侧写接口暂时没连上，通常是服务还没重启。', 'error');
  }
}

async function saveProfile() {
  const payload = {
    name: String(profileNameInput?.value || '').trim(),
    preferredTitle: String(profilePreferredTitleInput?.value || '').trim(),
    age: String(profileAgeInput?.value || '').trim(),
    job: String(profileJobInput?.value || '').trim(),
    traits: String(profileTraitsInput?.value || '').trim()
  };

  setProfileFeedback('正在保存侧写...', 'pending');
  if (saveProfileBtn) {
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = '保存中...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error('service_unavailable');
    }

    const data = await res.json();
    fillProfileForm(data?.profile || payload);
    setProfileFeedback('侧写已经保存好了，之后回答会更贴着你。', 'success');
    window.setTimeout(() => {
      hideProfileCard();
    }, 640);
  } catch (_err) {
    setProfileFeedback('侧写保存失败。现在多半是 8787 还在跑旧版本，重启服务后再试一次。', 'error');
  } finally {
    if (saveProfileBtn) {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = '保存侧写';
    }
  }
}

function scheduleIdleLook(now = performance.now()) {
  idleLookTarget.x = (Math.random() * 2 - 1) * 0.22;
  idleLookTarget.y = (Math.random() * 2 - 1) * 0.17;
  nextIdleLookAt = now + 1400 + Math.random() * 1600;
}

function resetAmbientPresenceTargets() {
  ambientPresenceTarget = { lookX: 0, lookY: 0, bodyX: 0, bodyY: 0, tilt: 0, lift: 0, leg: 0, scale: 0 };
}

function schedulePresenceAccent(now = performance.now()) {
  const strength = currentCameraMode === 'full' ? 1.08 : 1;
  ambientPresenceTarget = {
    lookX: (Math.random() * 2 - 1) * 0.09 * strength,
    lookY: (Math.random() * 2 - 1) * 0.07 * strength,
    bodyX: (Math.random() * 2 - 1) * 0.24 * strength,
    bodyY: (Math.random() * 2 - 1) * 0.12 * strength,
    tilt: (Math.random() * 2 - 1) * 0.9 * strength,
    lift: (Math.random() * 2 - 1) * 0.38 * strength,
    leg: currentCameraMode === 'full' ? (Math.random() * 2 - 1) * 0.035 : 0,
    scale: Math.random() * 0.012 * strength
  };
  nextPresenceAccentAt = now + 1700 + Math.random() * 2200;
}

function updateAmbientPresence(now = performance.now()) {
  if (!nextPresenceAccentAt) {
    schedulePresenceAccent(now);
  }

  if (isMouseFollowEnabled) {
    resetAmbientPresenceTargets();
  } else if (now >= nextPresenceAccentAt) {
    schedulePresenceAccent(now);
  }

  const blend = isMouseFollowEnabled ? 0.06 : 0.03;
  for (const key of Object.keys(ambientPresenceCurrent)) {
    ambientPresenceCurrent[key] = lerp(
      ambientPresenceCurrent[key],
      ambientPresenceTarget[key],
      blend
    );
  }
}

function scheduleNextBlink(now = performance.now()) {
  nextBlinkAt = now + 1900 + Math.random() * 2600;
}

function getBlinkOpenValue(now) {
  if (!nextBlinkAt) {
    scheduleNextBlink(now);
  }
  if (!blinkEndsAt && now >= nextBlinkAt) {
    blinkEndsAt = now + 170;
  }
  if (blinkEndsAt && now < blinkEndsAt) {
    const start = blinkEndsAt - 170;
    const t = clampValue((now - start) / 170, 0, 1);
    const k = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
    return clampValue(k, 0.08, 1);
  }
  if (blinkEndsAt && now >= blinkEndsAt) {
    blinkEndsAt = 0;
    scheduleNextBlink(now);
  }
  return 1;
}

function updateLivePresence() {
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel) return;

  const now = performance.now();
  const followRig = getFollowRigProfile();
  updateSleepMode(now);
  const sleepPose = getSleepPose(now);
  updateAmbientPresence(now);
  if (now < actionLockUntil) {
    return;
  }

  if (sleepPose.active) {
    easeFollowToCenter();
  }

  if (!sleepPose.active && !isMouseFollowEnabled && (!nextIdleLookAt || now >= nextIdleLookAt)) {
    scheduleIdleLook(now);
  }

  const targetX = sleepPose.active
    ? 0
    : isMouseFollowEnabled
    ? followTarget.x * followRig.targetX
    : idleLookTarget.x + ambientPresenceCurrent.lookX;
  const targetY = sleepPose.active
    ? 0
    : isMouseFollowEnabled
    ? followTarget.y * followRig.targetY
    : idleLookTarget.y + ambientPresenceCurrent.lookY;
  const smooth = sleepPose.active ? 0.05 : isMouseFollowEnabled ? 0.13 : 0.055;

  followCurrent.x = lerp(followCurrent.x, targetX, smooth);
  followCurrent.y = lerp(followCurrent.y, targetY, smooth);

  const breathe = Math.sin(now / 860);
  const shoulder = Math.sin(now / 1320 + 0.6);
  const torso = Math.sin(now / 1710 + 1.4);
  const sway = Math.sin(now / 2140 + 0.3);
  const settle = Math.sin(now / 2680 + 1.7);
  const eyeOpen = sleepPose.active ? sleepPose.eyeOpen : getBlinkOpenValue(now);
  const legMotion = currentCameraMode === 'full'
    ? (Math.sin(now / 1520 + 0.8) * 0.12) + ambientPresenceCurrent.leg + (followCurrent.x * followRig.leg)
    : 0;
  const stageShiftX = followCurrent.x * followRig.stageShiftX + ambientPresenceCurrent.bodyX * 11 + sway * 2.6;
  const stageShiftY = Math.abs(breathe) * 4.2 + ambientPresenceCurrent.lift * 3.4 + Math.abs(settle) * 1.1 + (followCurrent.y * followRig.stageShiftY) + sleepPose.stageY;
  const stageScale = modelBase.scale * (1 + ambientPresenceCurrent.scale + Math.abs(breathe) * 0.008);
  const ambientTilt = currentCameraMode === 'full' ? ambientPresenceCurrent.tilt * 0.018 : ambientPresenceCurrent.tilt * 0.04;
  const stageRotation = (followCurrent.x * followRig.stageRotation) + ambientTilt + (shoulder * (currentCameraMode === 'full' ? 0.006 : 0.012));
  const audioMouth = getAudioDrivenMouthLevel();

  setModelTransform(
    modelBase.x + stageShiftX,
    modelBase.y + stageShiftY,
    stageScale,
    stageRotation
  );

  setParam(coreModel, 'ParamBreath', 0.5 + breathe * 0.24);
  setParam(coreModel, 'ParamAngleX', followCurrent.x * followRig.headX + ambientPresenceCurrent.bodyX * 2.4 + breathe * 0.75 + sleepPose.headX);
  setParam(coreModel, 'ParamAngleY', -followCurrent.y * followRig.headY + torso * 1.4 + ambientPresenceCurrent.bodyY * 3.2 + sleepPose.headY);
  setParam(coreModel, 'ParamAngleZ', followCurrent.x * followRig.headZ + shoulder * 0.85 + ambientPresenceCurrent.tilt * (currentCameraMode === 'full' ? 0.55 : 1.2) + sleepPose.headZ);
  setParam(coreModel, 'ParamBodyAngleX', -followCurrent.y * followRig.bodyY + breathe * 0.72 + ambientPresenceCurrent.bodyY * 1.05 + sleepPose.bodyX);
  setParam(coreModel, 'ParamBodyAngleY', followCurrent.x * followRig.bodyX + torso * 0.72 + ambientPresenceCurrent.bodyX * 1.35 + sleepPose.bodyY);
  setParam(coreModel, 'ParamBodyAngleZ', followCurrent.x * followRig.bodyZ + shoulder * 0.45 + ambientPresenceCurrent.tilt * (currentCameraMode === 'full' ? 0.28 : 1.1) + sleepPose.bodyZ);
  setParam(coreModel, 'ParamEyeBallX', followCurrent.x * followRig.eyeX + ambientPresenceCurrent.lookX * 0.7);
  setParam(coreModel, 'ParamEyeBallY', -followCurrent.y * followRig.eyeY + ambientPresenceCurrent.lookY * 0.6);
  setParam(coreModel, 'ParamLeg', legMotion);
  setParam(coreModel, 'ParamEyeLOpen', eyeOpen);
  setParam(coreModel, 'ParamEyeROpen', eyeOpen);
  setParam(
    coreModel,
    'ParamMouthOpenY',
    sleepPose.active
      ? sleepPose.mouth
      : audioMouth > 0.02
      ? 0.08 + audioMouth * 0.85
      : 0.078 + Math.abs(breathe) * 0.016
  );
}

function handleMouseFollow(event) {
  if (!isMouseFollowEnabled || !live2dModel) return;
  if (!avatarStage) return;

  followPointer.x = event.clientX;
  followPointer.y = event.clientY;

  const rect = avatarStage.getBoundingClientRect();
  const localX = clampValue((followPointer.x - rect.left) / Math.max(rect.width, 1), 0, 1);
  const localY = clampValue((followPointer.y - rect.top) / Math.max(rect.height, 1), 0, 1);
  const nx = localX * 2 - 1;
  const ny = localY * 2 - 1;
  const deadZoneX = Math.abs(nx) < 0.025 ? 0 : nx;
  const deadZoneY = Math.abs(ny) < 0.02 ? 0 : ny;
  const shapedX = shapeFollowAxis(deadZoneX, 1.22);
  const shapedY = shapeFollowAxis(deadZoneY, 1.12);

  followTarget.x = clampValue(shapedX * (currentCameraMode === 'full' ? 0.54 : 0.72), -0.72, 0.72);
  followTarget.y = clampValue(shapedY * (currentCameraMode === 'full' ? 0.4 : 0.56), -0.56, 0.56);
}

function toggleMouseFollow() {
  isMouseFollowEnabled = !isMouseFollowEnabled;
  updateFollowButton();
  if (!isMouseFollowEnabled) {
    setEmotion(avatarWrap?.dataset?.emotion || 'neutral');
    setArmMode('A');
    resetMouseFollowPose();
  } else {
    markUserAction();
    if (typeof fitLive2DStage === 'function') {
      fitLive2DStage();
    }
  }
}

function easeFollowToCenter() {
  followTarget.x = 0;
  followTarget.y = 0;
}

function resetMouseFollowPose() {
  if (!live2dModel) return;
  followTarget.x = 0;
  followTarget.y = 0;
  followCurrent.x = 0;
  followCurrent.y = 0;
  idleLookTarget.x = 0;
  idleLookTarget.y = 0;
  resetAmbientPresenceTargets();
  ambientPresenceCurrent = { lookX: 0, lookY: 0, bodyX: 0, bodyY: 0, tilt: 0, lift: 0, leg: 0, scale: 0 };
  nextPresenceAccentAt = 0;
  setEmotion(avatarWrap?.dataset?.emotion || 'neutral');
  if (typeof fitLive2DStage === 'function') {
    fitLive2DStage();
  } else {
    resetModelViewport();
  }
}

function triggerActionByContext(userText, replyText, emotion) {
  const combined = `${userText || ''} ${replyText || ''}`;
  const action = resolveAction(combined, emotion);
  if (action) {
    console.log('[Live2D] action:', action, 'emotion:', emotion, 'text:', combined);
    playAction(action);
  }
}

function setEmotion(emotion) {
  const normalized = emotionMap[emotion] || 'neutral';
  avatarWrap.dataset.emotion = normalized;
  applyEmotionToModel(normalized);
}

async function initLive2D() {
  if (window.location.protocol === 'file:') {
    live2dFallback.textContent = '请通过 http://127.0.0.1:8787 打开，file:// 无法加载 Live2D 模型。';
    return;
  }
  if (!window.PIXI || !window.PIXI.live2d || !live2dCanvas) {
    live2dFallback.textContent = 'Live2D 依赖加载失败，请检查网络。';
    return;
  }
  if (!window.Live2DCubismCore) {
    live2dFallback.textContent = '缺少 Live2D Cubism Core，请检查 core 脚本是否可访问。';
    return;
  }

  const stage = live2dCanvas.parentElement;
  pixiApp = new window.PIXI.Application({
    view: live2dCanvas,
    resizeTo: stage,
    autoStart: true,
    transparent: true,
    antialias: true
  });

  try {
    live2dModel = await window.PIXI.live2d.Live2DModel.from('./hiyori_pro_t11.model3.json');
    pixiApp.stage.addChild(live2dModel);
    live2dFallback.style.display = 'none';

    // Keep the model under app control instead of relying on built-in interactions.
    live2dModel.interactive = false;
    live2dModel.buttonMode = false;
    if ('autoInteract' in live2dModel) {
      live2dModel.autoInteract = false;
    }

    live2dModel.anchor.set(0.5, 0.5);
    live2dModel.scale.set(1);
    live2dModel.rotation = 0;
    const naturalBounds = live2dModel.getLocalBounds();
    modelMetrics.width = Math.max(1, naturalBounds.width || 1);
    modelMetrics.height = Math.max(1, naturalBounds.height || 1);

    const fit = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const preset = getCameraPreset();
      live2dModel.anchor.set(0.5, 0.5);
      live2dModel.x = w * preset.x;
      live2dModel.y = h * preset.y;
      const scaleByWidth = (w * preset.widthRatio) / modelMetrics.width;
      const scaleByHeight = (h * preset.heightRatio) / modelMetrics.height;
      const scale = Math.min(scaleByWidth, scaleByHeight) * preset.scaleBoost;
      live2dModel.scale.set(scale);
      live2dModel.rotation = 0;
      modelBase.x = live2dModel.x;
      modelBase.y = live2dModel.y;
      modelBase.scale = scale;
      modelBase.rotation = 0;
    };

    fitLive2DStage = fit;
    fit();
    window.addEventListener('resize', fit);
    followTarget = { x: 0, y: 0 };
    followCurrent = { x: 0, y: 0 };
    resetAmbientPresenceTargets();
    ambientPresenceCurrent = { lookX: 0, lookY: 0, bodyX: 0, bodyY: 0, tilt: 0, lift: 0, leg: 0, scale: 0 };
    nextPresenceAccentAt = 0;
    scheduleIdleLook();
    schedulePresenceAccent();
    scheduleNextBlink();
    pixiApp.ticker.add(() => updateLivePresence());
    startArmModeGuard();
    setEmotion('neutral');
    setArmMode('A');
    updateCameraButton();
    updateFollowButton();
    startIdleLoop();
  } catch (err) {
    const detail = err && err.message ? ` (${err.message})` : '';
    live2dFallback.textContent = `模型加载失败，请检查 model3 / moc3 / 纹理文件路径${detail}`;
  }
}

async function sendMessage(message) {
  if (!openClawConnected) {
    addMessage('OpenClaw 还没有连接上，现在不能聊天。', 'bot');
    return;
  }
  noteUserMessageActivity();
  stopVoicePlayback();
  addMessage(message, 'user');
  const loadingNode = addMessageNode('bot');
  const stopThinkingIndicator = startThinkingIndicator(loadingNode);
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = '...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, mode: currentMode })
    });

    if (!res.ok) {
      stopThinkingIndicator();
      let errorMessage = '服务暂时不可用，请稍后再试。';
      try {
        const data = await res.json();
        if (data?.message) {
          errorMessage = String(data.message);
        }
      } catch (_err) {}
      loadingNode.textContent = sanitizeDisplayText(errorMessage);
      setGalDialogue('bot', errorMessage, lastUserUtterance ? `你刚刚说：${shortenDialoguePrompt(lastUserUtterance)}` : '');
      return;
    }

    const data = await res.json();
    const shouldSpeak = ttsAvailable && voicePlaybackEnabled && isChatMode();
    const replyText = sanitizeDisplayText(data.reply || '');
    const ttsText = sanitizeDisplayText(data.ttsText || data.reply || '');

    stopThinkingIndicator();
    if (currentMode === 'work') {
      renderWorkReply(loadingNode, replyText);
      setEmotion('neutral');
    } else {
      if (shouldSpeak) {
        void speakReply(ttsText);
      }
      await typeOutMessage(loadingNode, replyText);
      setEmotion(data.emotion || 'neutral');
    }
    setArmMode('A');
    triggerActionByContext(message, replyText, data.emotion || 'neutral');
  } catch (_err) {
    stopThinkingIndicator();
    loadingNode.textContent = '服务暂时不可用，请稍后再试。';
    setGalDialogue('bot', '服务暂时不可用，请稍后再试。', lastUserUtterance ? `你刚刚说：${shortenDialoguePrompt(lastUserUtterance)}` : '');
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = '发送';
    }
  }
}
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition || !micBtn) {
    if (micBtn) {
      micBtn.disabled = true;
      micBtn.textContent = '无语音';
      micBtn.title = '当前浏览器不支持语音识别';
    }
    if (galMicBtn) {
      galMicBtn.disabled = true;
      galMicBtn.textContent = '无语音';
      galMicBtn.title = '当前浏览器不支持语音识别';
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    if (!openClawConnected) {
      recognition.stop();
      return;
    }
    isListening = true;
    micBtn.classList.add('listening');
    micBtn.textContent = '识别中';
    if (galMicBtn) {
      galMicBtn.classList.add('listening');
      galMicBtn.textContent = '识别中';
    }
    inputEl.placeholder = '正在听你说话...';
    if (galInputEl) {
      galInputEl.placeholder = '正在听你说话...';
    }
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    syncDraftInputs(transcript.trim());
  };

  recognition.onerror = () => {
    addMessage('语音识别失败，请检查麦克风权限后重试。', 'bot');
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('listening');
    micBtn.textContent = '语音';
    if (galMicBtn) {
      galMicBtn.classList.remove('listening');
      galMicBtn.textContent = '语音';
    }
    inputEl.placeholder = getModeCopy(currentMode).placeholder;
    if (galInputEl) {
      galInputEl.placeholder = isChatMode() ? '在这里继续说...' : getModeCopy(currentMode).placeholder;
    }
  };
}

function toggleSpeechRecognition() {
  if (!recognition || !micBtn) return;
  if (isListening) {
    recognition.stop();
    return;
  }
  try {
    recognition.start();
  } catch (_err) {}
}

async function submitDraftMessage(message) {
  markUserAction();
  if (voicePlaybackEnabled && ttsAvailable && isChatMode()) {
    primeAudioPlayback();
  }
  if (!message) return;
  const boostCmd = message.match(/^\/boost\s+([0-9.]+)$/i);
  if (boostCmd) {
    const val = Number(boostCmd[1]);
    actionBoost = Number.isFinite(val) ? Math.max(0.8, Math.min(3, val)) : 1;
    return;
  }
  const cameraCmd = message.match(/^\/camera\s+(upper-body|full)$/i);
  if (cameraCmd) {
    setCameraMode(cameraCmd[1].toLowerCase());
    addMessage(`镜头已切到 ${cameraCmd[1].toLowerCase() === 'full' ? '全身' : '上半身'}。`, 'bot');
    return;
  }
  const actionCmd = message.match(/^\/act\s+(happy|shy|blush|question|angry|soothe|wave)$/i);
  if (actionCmd) {
    playAction(actionCmd[1].toLowerCase());
    return;
  }
  await sendMessage(message);
}

async function handleComposerSubmit(event, sourceInput) {
  event.preventDefault();
  const message = String(sourceInput?.value || '').trim();
  if (!message) return;
  syncDraftInputs('');
  await submitDraftMessage(message);
}

if (avatarStage) {
  avatarStage.addEventListener('mouseleave', () => {
    if (isMouseFollowEnabled) {
      easeFollowToCenter();
    }
  });
  avatarStage.addEventListener('click', (event) => {
    registerFaceTap(event);
  });
}
window.addEventListener('mousemove', handleMouseFollow);
window.addEventListener('blur', () => {
  if (isMouseFollowEnabled) {
    resetMouseFollowPose();
  }
});
if (followBtn) {
  followBtn.addEventListener('click', () => toggleMouseFollow());
  updateFollowButton();
}
if (cameraBtn) {
  cameraBtn.addEventListener('click', () => {
    setCameraMode(currentCameraMode === 'full' ? 'upper-body' : 'full');
  });
  updateCameraButton();
}
if (profileBtn) {
  profileBtn.addEventListener('click', () => showProfileCard());
}
if (closeProfileBtn) {
  closeProfileBtn.addEventListener('click', () => hideProfileCard());
}
if (profileBackdrop) {
  profileBackdrop.addEventListener('click', () => hideProfileCard());
}
if (profileForm) {
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveProfile();
  });
}
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal && !profileModal.classList.contains('hidden')) {
    hideProfileCard();
  }
});
if (bgPrevBtn) {
  bgPrevBtn.addEventListener('click', () => stepBackground(-1));
}
if (bgNextBtn) {
  bgNextBtn.addEventListener('click', () => stepBackground(1));
}
if (inputEl && galInputEl) {
  inputEl.addEventListener('input', () => {
    if (document.activeElement === inputEl) {
      galInputEl.value = inputEl.value;
    }
  });
  galInputEl.addEventListener('input', () => {
    if (document.activeElement === galInputEl) {
      inputEl.value = galInputEl.value;
    }
  });
}
if (formEl) {
  formEl.addEventListener('submit', async (event) => {
    await handleComposerSubmit(event, inputEl);
  });
}
if (galFormEl) {
  galFormEl.addEventListener('submit', async (event) => {
    await handleComposerSubmit(event, galInputEl);
  });
}
if (micBtn) {
  micBtn.addEventListener('click', () => toggleSpeechRecognition());
}
if (galMicBtn) {
  galMicBtn.addEventListener('click', () => toggleSpeechRecognition());
}
if (voiceToggleBtn) {
  voiceToggleBtn.addEventListener('click', () => {
    if (!ttsAvailable || !isChatMode()) return;
    voicePlaybackEnabled = !voicePlaybackEnabled;
    if (!voicePlaybackEnabled) {
      stopVoicePlayback();
    } else {
      primeAudioPlayback();
    }
    updateVoiceToggleButton();
  });
}
if (chatModeBtn) {
  chatModeBtn.addEventListener('click', () => setMode('chat'));
}
if (workModeBtn) {
  workModeBtn.addEventListener('click', () => setMode('work'));
}
if (chatViewBtn) {
  chatViewBtn.addEventListener('click', () => {
    setChatView(currentChatView === 'gal' ? 'phone' : 'gal');
  });
}
if (dockToggleBtn) {
  dockToggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setDockExpanded(!isDockExpanded);
  });
}
window.addEventListener('click', (event) => {
  if (!dockFlyout || !isDockExpanded) return;
  if (dockFlyout.contains(event.target)) return;
  setDockExpanded(false);
});

window.addEventListener('pointerdown', () => {
  primeAudioPlayback();
}, { passive: true });
window.addEventListener('keydown', () => {
  primeAudioPlayback();
}, { passive: true });

initSpeechRecognition();
startTtsStatusPolling();
initRuntimeStatus();
updateModeUI();
updateDockFlyoutUI();
setChatView(currentChatView);
applyBackgroundScene(0);
updatePhoneTime();
window.setInterval(updatePhoneTime, 30000);
void loadProfile();
initLive2D();
(async () => {
  const restored = await restoreHistory();
  if (!restored) {
    const seedMessage = addMessage('嗨，我是铃汐。今天也想陪你把事情做顺一点。', 'bot');
    seedMessage.dataset.systemSeed = 'true';
  }
})();
