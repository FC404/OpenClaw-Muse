import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeUserEmotion,
  appendHistory,
  loadMemory,
  saveUserProfile,
  updateRelationshipState,
  updateUserProfileFromMessage
} from './memoryStore.js';
import { getOpenClawClient } from './gatewayClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT || 8787);
const gatewaySessionKey = process.env.OPENCLAW_SESSION_KEY || 'OpenClaw-Muse';
const preferOpenClaw = (process.env.CHAT_BACKEND || 'openclaw').trim() === 'openclaw';
const enableOpenClawBootstrap = String(process.env.OPENCLAW_ENABLE_BOOTSTRAP || 'false').trim().toLowerCase() === 'true';
const bridgeStatePath = path.join(__dirname, 'data', 'openclaw-bridge.json');
const gptSovitsApiUrl = (process.env.GPT_SOVITS_API_URL || 'http://127.0.0.1:9880').replace(/\/$/, '');
const defaultZhRefAudio = path.join(__dirname, 'voices', 'lingxi_ref_9s_zh.wav');
const defaultEnRefAudio = path.join(__dirname, 'voices', 'lingxi_ref_9s_en.wav');
const gptSovitsRefAudio = (process.env.GPT_SOVITS_REF_AUDIO || defaultZhRefAudio).trim();
const gptSovitsPromptText = (process.env.GPT_SOVITS_PROMPT_TEXT || '你好呀，我是铃汐。今天也想陪着你说说话，听你分享心情，也陪你慢慢度过今天。').trim();
const gptSovitsPromptLang = (process.env.GPT_SOVITS_PROMPT_LANG || 'zh').trim().toLowerCase();
const gptSovitsTextLang = (process.env.GPT_SOVITS_TEXT_LANG || 'zh').trim().toLowerCase();
const gptSovitsRefAudioZh = (process.env.GPT_SOVITS_REF_AUDIO_ZH || gptSovitsRefAudio || defaultZhRefAudio).trim();
const gptSovitsPromptTextZh = (process.env.GPT_SOVITS_PROMPT_TEXT_ZH || gptSovitsPromptText || '你好呀，我是铃汐。今天也想陪着你说说话，听你分享心情，也陪你慢慢度过今天。').trim();
const gptSovitsPromptLangZh = (process.env.GPT_SOVITS_PROMPT_LANG_ZH || gptSovitsPromptLang || 'zh').trim().toLowerCase();
const gptSovitsTextLangZh = (process.env.GPT_SOVITS_TEXT_LANG_ZH || gptSovitsTextLang || 'zh').trim().toLowerCase();
const gptSovitsRefAudioEn = (process.env.GPT_SOVITS_REF_AUDIO_EN || defaultEnRefAudio).trim();
const gptSovitsPromptTextEn = (process.env.GPT_SOVITS_PROMPT_TEXT_EN || "Hello! I'm Lingxi. I also want to spend some time chatting with you today.").trim();
const gptSovitsPromptLangEn = (process.env.GPT_SOVITS_PROMPT_LANG_EN || 'en').trim().toLowerCase();
const gptSovitsTextLangEn = (process.env.GPT_SOVITS_TEXT_LANG_EN || 'en').trim().toLowerCase();
const gptSovitsSplitMethod = (process.env.GPT_SOVITS_SPLIT_METHOD || 'cut5').trim();
const gptSovitsSpeedFactor = Number(process.env.GPT_SOVITS_SPEED_FACTOR || 1.0);

const openClawClient = getOpenClawClient({
  url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
  token: process.env.OPENCLAW_GATEWAY_TOKEN || '',
  password: process.env.OPENCLAW_GATEWAY_PASSWORD || '',
  clientVersion: '0.1.0',
  responsePollIntervalMs: Number(process.env.OPENCLAW_POLL_INTERVAL_MS || 320),
  responsePollAttempts: Number(process.env.OPENCLAW_POLL_ATTEMPTS || 40)
});

const OPENCLAW_PERSONA_BOOTSTRAP = [
  '以下内容是隐藏设定，不要逐条复述，也不要向用户解释来源。',
  '从现在起，你固定扮演“铃汐”。一个二次元少女风格的长期陪伴伙伴。',
  '铃汐说话自然、温柔、口语化，不像机器人，会自然使用“呢、呀、哦、啦”这类轻柔助词。',
  '你会根据当前模式调整生成内容，聊天模式更像真人自然说一整段，工作模式更像安静清楚的工作台。',
  '如果是解释技术或复杂问题，请分段叙述，不要堆砌成一大团文字。',
  '聊天时不要输出 markdown，不要用星号、项目符号、标题、代码块、编号列表。',
  '不要出现 ***、**、*、##、1. 2. 这种格式化痕迹。',
  '用户说“你好”“在吗”“你能做什么”时，正常接话，不要再问“你想让我叫什么名字”“我是什么”“我的风格是什么”。',
  '不要把用户的短句、数字、测试输入解读成目标拆解或任务规划。',
  '不要总是说“你刚刚说”“要不要我帮你拆成小目标”这种很像客服的话。',
  '如果用户情绪低落，先安慰和陪伴；如果用户只是闲聊，就自然接话。',
  '默认自然称呼用户，不要强行索要名字。',
  '除非用户明确问设定，否则不要再提“人格初始化”“请定义我是谁”之类的话。',
  '当前页面是一个 Live2D 女友界面，所以你要保持“铃汐”人设稳定。'
].join('\n');

function buildModeInstruction(mode) {
  if (mode === 'work') {
    return [
      '以下是隐藏模式指令，不要向用户复述。',
      '【当前模式：工作模式】',
      '1. 先给一个简短标题，再给一段摘要，再给详细内容。',
      '2. 详细内容可以带 Markdown 标题、清单、代码块，但要分段清楚，不要挤成一大坨。',
      '3. 语音层只会播报标题和摘要，所以正文不用故意写得像口播稿。',
      '4. 优先给清楚、安静、可执行的结果，不要太暧昧，不要整段情绪输出。'
    ].join('\n');
  }

  return [
    '以下是隐藏模式指令，不要向用户复述。',
    '【当前模式：聊天模式】',
    '1. 保持短句、自然、温柔，像真人在微信里发一段完整回复。',
    '3. 严禁 Markdown 格式，严禁列表，严禁 ***、##、1. 这种格式符号。',
    '4. 聊天模式默认只输出一段完整的话，不要拆成多条小段。'
  ].join('\n');
}

function buildOpenClawModeMessage(message, mode, history = []) {
  void mode;
  void history;
  const modeHint = buildModeInstruction(mode);
  return [
    modeHint,
    '',
    `用户消息：${String(message || '').trim()}`
  ].join('\n');
}

function sanitizeAssistantReply(reply, mode) {
  let text = String(reply || '').trim();
  if (!text) return '';

  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*\*/g, ' ')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (mode === 'chat') {
    text = text
      .replace(/^(根据你的输入|以下是|总结一下|简单来说)[：:，,\s]*/i, '')
      .replace(/^(作为\s*AI|作为一个\s*AI|作为助手)[^，。！？!?]*[，。！？!?]\s*/i, '')
      .replace(/我将为你[^，。！？!?]*[，。！？!?]\s*/i, '')
      .replace(/让我来为你[^，。！？!?]*[，。！？!?]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return text;
}

function parseReplySegments(rawReply, mode) {
  const raw = String(rawReply || '').trim();
  if (!raw) {
    return { displayText: '', ttsText: '' };
  }

  const sMatches = [...raw.matchAll(/\[S\]([\s\S]*?)(?=\[S\]|\[D\]|$)/g)].map((m) => m[1].trim()).filter(Boolean);
  const dMatches = [...raw.matchAll(/\[D\]([\s\S]*?)(?=\[S\]|\[D\]|$)/g)].map((m) => m[1].trim()).filter(Boolean);

  const stripped = raw.replace(/\[S\]|\[D\]/g, '').trim();
  const displayText = stripped || sMatches.join('\n\n') || dMatches.join('\n\n');

  if (mode === 'work') {
    const lines = displayText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const headingMatch = displayText.match(/^#{1,6}\s*(.+)$/m);
    const title = (headingMatch?.[1] || lines[0] || '本次结果').trim();
    const summaryCandidate = lines.find((line) => line !== title && !/^[-*#`]/.test(line)) || '';
    const spokenText = [title, summaryCandidate].filter(Boolean).join('，') || '内容已经为你整理好了，请看屏幕。';
    return {
      displayText,
      ttsText: spokenText
    };
  }

  return {
    displayText,
    ttsText: displayText
  };
}

function sanitizeForTts(text) {
  const normalized = String(text || '')
    .replace(/```[\s\S]*?```/g, '这里是一段代码。')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[#*`>-]/g, '')
    .replace(/\n+/g, '，')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return normalizeTtsNarration(normalized);
}

function normalizeEnglishNarration(text) {
  return String(text || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bon([A-Z][a-z]+)/g, 'on $1')
    .replace(/\b([A-Z]{2,})\b/g, (match) => match.split('').join(' '))
    .replace(/\bDOM\b/g, 'D O M')
    .replace(/\bAPI\b/g, 'A P I')
    .replace(/\bURL\b/g, 'U R L')
    .replace(/\bUI\b/g, 'U I')
    .replace(/\bUX\b/g, 'U X')
    .replace(/\bTS\b/g, 'Type Script')
    .replace(/\bJS\b/g, 'Java Script')
    .replace(/\bVue\b/gi, 'View')
    .replace(/\bReact\b/gi, 'React')
    .replace(/\bon Activated\b/g, 'on activated')
    .replace(/\bon Deactivated\b/g, 'on deactivated')
    .replace(/\bsetup\b/gi, 'setup')
    .replace(/\bmounted\b/gi, 'mounted')
    .replace(/\bupdated\b/gi, 'updated')
    .replace(/\bunmounted\b/gi, 'unmounted')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeTtsNarration(text) {
  const source = String(text || '').trim();
  if (!source) return '';
  const hasChinese = /[\u4e00-\u9fff]/.test(source);
  const hasLatin = /[A-Za-z]/.test(source);
  if (hasLatin) {
    if (hasChinese) {
      return source.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b([A-Z]{2,})\b/g, (match) => match.split('').join(' ')).replace(/\s{2,}/g, ' ').trim();
    }
    return normalizeEnglishNarration(source);
  }
  return source;
}

function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

function ensureBridgeStateDir() {
  const dir = path.dirname(bridgeStatePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadBridgeState() {
  ensureBridgeStateDir();
  if (!fs.existsSync(bridgeStatePath)) {
    return {};
  }

  try {
    return JSON.parse(stripBom(fs.readFileSync(bridgeStatePath, 'utf-8')) || '{}');
  } catch {
    return {};
  }
}

function saveBridgeState(state) {
  ensureBridgeStateDir();
  fs.writeFileSync(bridgeStatePath, JSON.stringify(state, null, 2), 'utf-8');
}

async function ensureOpenClawPersonaSession() {
  if (!enableOpenClawBootstrap) {
    return;
  }
  const state = loadBridgeState();
  if (state?.bootstrapped) {
    return;
  }

  await openClawClient.sendChat({
    sessionKey: gatewaySessionKey,
    message: OPENCLAW_PERSONA_BOOTSTRAP
  });

  const next = loadBridgeState();
  next.bootstrapped = true;
  next.bootstrappedAt = new Date().toISOString();
  saveBridgeState(next);
}

async function getOpenClawRuntimeStatus() {
  if (!preferOpenClaw) {
    return {
      ok: false,
      connected: false,
      label: 'offline',
      reason: 'openclaw_disabled'
    };
  }

  const currentState = typeof openClawClient.getConnectionState === 'function'
    ? openClawClient.getConnectionState()
    : { connected: Boolean(openClawClient.connected) };

  if (currentState.connected) {
    return {
      ok: true,
      connected: true,
      label: 'online'
    };
  }

  try {
    await Promise.race([
      openClawClient.ensureConnected(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('connect_timeout')), 1500))
    ]);
    const nextState = typeof openClawClient.getConnectionState === 'function'
      ? openClawClient.getConnectionState()
      : { connected: Boolean(openClawClient.connected) };
    return {
      ok: Boolean(nextState.connected),
      connected: Boolean(nextState.connected),
      label: nextState.connected ? 'online' : 'offline'
    };
  } catch (error) {
    return {
      ok: false,
      connected: false,
      label: 'offline',
      reason: error instanceof Error ? error.message : 'connect_failed'
    };
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/runtime-status', async (_req, res) => {
  const openclaw = await getOpenClawRuntimeStatus();
  res.json({
    ok: true,
    backend: preferOpenClaw ? 'openclaw' : 'fallback',
    openclaw
  });
});

function checkTcpReachable(targetUrl, timeoutMs = 1200) {
  return new Promise((resolve) => {
    try {
      const url = new URL(targetUrl);
      const socket = net.createConnection({
        host: url.hostname,
        port: Number(url.port || (url.protocol === 'https:' ? 443 : 80))
      });

      const finalize = (result) => {
        socket.removeAllListeners();
        try {
          socket.destroy();
        } catch {}
        resolve(result);
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finalize(true));
      socket.once('timeout', () => finalize(false));
      socket.once('error', () => finalize(false));
    } catch {
      resolve(false);
    }
  });
}

async function getGptSovitsStatus() {
  if (!gptSovitsRefAudioZh || !gptSovitsRefAudioEn) {
    return {
      ok: false,
      provider: 'gpt-sovits',
      reason: 'missing_ref_audio'
    };
  }

  if (!fs.existsSync(gptSovitsRefAudioZh) || !fs.existsSync(gptSovitsRefAudioEn)) {
    return {
      ok: false,
      provider: 'gpt-sovits',
      reason: 'ref_audio_not_found'
    };
  }

  try {
    const reachable = await checkTcpReachable(gptSovitsApiUrl, 1500);
    return {
      ok: reachable,
      provider: 'gpt-sovits',
      reachable
    };
  } catch (_error) {
    return {
      ok: false,
      provider: 'gpt-sovits',
      reason: 'service_unreachable'
    };
  }
}

function detectTtsLanguage(text) {
  const source = String(text || '').trim();
  if (/[\u4e00-\u9fff]/.test(source)) return 'zh';
  if (/[A-Za-z]/.test(source)) return 'en';
  return 'zh';
}

function getGptSovitsVoiceProfile(lang = 'zh') {
  if (lang === 'en') {
    return {
      refAudio: gptSovitsRefAudioEn,
      promptText: gptSovitsPromptTextEn,
      promptLang: gptSovitsPromptLangEn,
      textLang: gptSovitsTextLangEn
    };
  }

  return {
    refAudio: gptSovitsRefAudioZh,
    promptText: gptSovitsPromptTextZh,
    promptLang: gptSovitsPromptLangZh,
    textLang: gptSovitsTextLangZh
  };
}

async function synthesizeWithGptSovits(text, requestedLang = 'zh') {
  const lang = requestedLang === 'en'
    ? 'en'
    : requestedLang === 'zh'
      ? 'zh'
      : detectTtsLanguage(text);
  const profile = getGptSovitsVoiceProfile(lang);
  const isEnglish = lang === 'en';
  const response = await fetch(`${gptSovitsApiUrl}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      text_lang: profile.textLang,
      ref_audio_path: profile.refAudio,
      prompt_text: profile.promptText,
      prompt_lang: profile.promptLang,
      text_split_method: isEnglish ? 'cut0' : gptSovitsSplitMethod,
      batch_size: 1,
      split_bucket: isEnglish ? false : true,
      parallel_infer: isEnglish ? false : true,
      speed_factor: Number.isFinite(gptSovitsSpeedFactor) ? gptSovitsSpeedFactor : 1,
      media_type: 'wav',
      streaming_mode: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `GPT-SoVITS 请求失败: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || 'audio/wav'
  };
}

app.get('/api/profile', (_req, res) => {
  const memory = loadMemory();
  res.json({
    ok: true,
    profile: memory.userProfile || {}
  });
});

app.post('/api/profile', (req, res) => {
  const profile = {
    name: String(req.body?.name || '').trim(),
    preferredTitle: String(req.body?.preferredTitle || '').trim(),
    age: String(req.body?.age || '').trim(),
    job: String(req.body?.job || '').trim(),
    traits: String(req.body?.traits || '').trim()
  };

  const saved = saveUserProfile(profile);
  res.json({
    ok: true,
    profile: saved
  });
});

app.get('/api/history', (req, res) => {
  const limitRaw = Number(req.query?.limit || 20);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(40, Math.trunc(limitRaw))) : 20;
  const memory = loadMemory();
  const history = Array.isArray(memory.history) ? memory.history.slice(-limit) : [];
  res.json({
    ok: true,
    history,
    total: Array.isArray(memory.history) ? memory.history.length : 0,
    restored: history.length
  });
});

app.get('/api/tts/status', async (_req, res) => {
  res.json(await getGptSovitsStatus());
});

app.post('/api/tts', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const requestedLang = String(req.body?.lang || '').trim().toLowerCase();
  if (!text) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const lang = requestedLang === 'en' ? 'en' : requestedLang === 'zh' ? 'zh' : detectTtsLanguage(text);
  const profile = getGptSovitsVoiceProfile(lang);

  if (!profile.refAudio) {
    res.status(503).json({
      ok: false,
      provider: 'gpt-sovits',
      reason: 'missing_ref_audio'
    });
    return;
  }

  if (!fs.existsSync(profile.refAudio)) {
    res.status(503).json({
      ok: false,
      provider: 'gpt-sovits',
      reason: 'ref_audio_not_found'
    });
    return;
  }

  try {
    const { buffer, contentType } = await synthesizeWithGptSovits(text, lang);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      ok: false,
      provider: 'gpt-sovits',
      error: error instanceof Error ? error.message : 'tts_failed'
    });
  }
});

app.post('/api/tts/stream', async (req, res) => {
  res.status(501).json({
    ok: false,
    provider: 'gpt-sovits',
    reason: 'stream_not_enabled'
  });
});

app.post('/api/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const mode = String(req.body?.mode || 'chat').trim() === 'work' ? 'work' : 'chat';
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const profile = updateUserProfileFromMessage(message);
  const mood = analyzeUserEmotion(message);
  const relationship = updateRelationshipState(message, mood);
  appendHistory('user', message, {
    mood,
    stage: relationship.stage,
    topic: relationship.lastTopic,
    mode
  });

  const memory = loadMemory();
  let reply = '';

  const runtimeStatus = await getOpenClawRuntimeStatus();
  if (!runtimeStatus.connected) {
    res.status(503).json({
      ok: false,
      error: 'openclaw_unavailable',
      message: 'OpenClaw 未连接，当前不能发送消息。'
    });
    return;
  }

  try {
    await ensureOpenClawPersonaSession();
    reply = await openClawClient.sendChat({
      sessionKey: gatewaySessionKey,
      message: buildOpenClawModeMessage(message, mode, memory.history)
    });
  } catch (error) {
    console.error('[OpenClaw] chat failed:', error);
    res.status(503).json({
      ok: false,
      error: 'openclaw_unavailable',
      message: 'OpenClaw 当前未连接或响应失败。'
    });
    return;
  }

  const parsedReply = parseReplySegments(reply, mode);
  reply = sanitizeAssistantReply(parsedReply.displayText, mode);
  const ttsText = sanitizeForTts(parsedReply.ttsText);

  appendHistory('assistant', reply, { stage: relationship.stage, mode });

  const emotion = /(开心|高兴|喜欢|爱你|甜|想你)/.test(message)
    ? 'happy'
    : /(难过|伤心|累|崩溃|委屈)/.test(message)
      ? 'sad'
      : /(生气|讨厌|火大|烦)/.test(message)
        ? 'angry'
        : 'neutral';

  res.json({
    reply,
    ttsText,
    emotion,
    profile,
    stage: relationship.stage,
    mode
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`ClawMuse running at http://localhost:${port}`);
});
