import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'memory.json');

function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

function readJsonFile(filePath, fallbackFactory) {
  const raw = stripBom(fs.readFileSync(filePath, 'utf-8'));
  if (!raw.trim()) {
    return typeof fallbackFactory === 'function' ? fallbackFactory() : {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return typeof fallbackFactory === 'function' ? fallbackFactory() : {};
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function detectTopic(text) {
  if (/(游戏|上分|排位|段位|FPS|MOBA|LOL|瓦|Valorant|王者)/i.test(text)) return 'gaming';
  if (/(工作|加班|开会|老板|客户|电商|运营|业绩|kpi)/i.test(text)) return 'work';
  if (/(学习|考试|作业|论文|课程|复习)/i.test(text)) return 'study';
  if (/(难过|焦虑|烦|崩溃|压力|失眠|孤独|累)/i.test(text)) return 'emotion';
  if (/(吃饭|睡觉|健身|逛街|电影|音乐|旅行)/i.test(text)) return 'daily';
  return 'general';
}

export function analyzeUserEmotion(text) {
  if (/(开心|高兴|太棒|赢了|喜欢|爱死|爽|哈哈|哈哈哈)/.test(text)) return 'positive';
  if (/(难过|焦虑|烦|崩溃|压力|失眠|累|委屈|自闭|不想活)/.test(text)) return 'negative';
  if (/(生气|火大|气死|讨厌|烦死)/.test(text)) return 'angry';
  return 'neutral';
}

function createSeed() {
  return {
    persona: {
      name: '铃汐',
      style: '温柔、自然、有陪伴感。'
    },
    userProfile: {},
    relationship: {
      score: 8,
      stage: 'initial',
      turns: 0,
      lastMood: 'neutral',
      lastTopic: 'general'
    },
    history: []
  };
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createSeed(), null, 2), 'utf-8');
    return;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const memory = readJsonFile(DATA_FILE, createSeed);
  let changed = false;

  if (raw !== stripBom(raw)) {
    changed = true;
  }

  if (!memory.persona) {
    memory.persona = createSeed().persona;
    changed = true;
  }
  if (!memory.userProfile) {
    memory.userProfile = {};
    changed = true;
  }
  if (!memory.relationship) {
    memory.relationship = createSeed().relationship;
    changed = true;
  }
  if (!Array.isArray(memory.history)) {
    memory.history = [];
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memory, null, 2), 'utf-8');
  }
}

export function loadMemory() {
  ensureFile();
  return readJsonFile(DATA_FILE, createSeed);
}

export function saveMemory(memory) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(memory, null, 2), 'utf-8');
}

export function appendHistory(role, content, meta = {}) {
  const memory = loadMemory();
  memory.history.push({ role, content, ts: Date.now(), ...meta });
  if (memory.history.length > 60) {
    memory.history = memory.history.slice(-60);
  }
  saveMemory(memory);
}

export function updateUserProfileFromMessage(message) {
  const memory = loadMemory();
  const text = message.trim();

  const nameMatch = text.match(/我叫([\u4e00-\u9fa5A-Za-z0-9_]{1,16})/);
  const likeMatch = text.match(/我喜欢([^，。,.!！?？]{1,24})/);
  const jobMatch = text.match(/我是([^，。,.!！?？]{1,24})(?:的|$)/);
  const gameMatch = text.match(/我(常玩|喜欢玩|在玩)([^，。,.!！?？]{1,20})/);

  if (nameMatch) memory.userProfile.name = nameMatch[1];
  if (likeMatch) memory.userProfile.likes = likeMatch[1];
  if (jobMatch) memory.userProfile.job = jobMatch[1];
  if (gameMatch) memory.userProfile.game = gameMatch[2];

  saveMemory(memory);
  return memory.userProfile;
}

export function saveUserProfile(profile = {}) {
  const memory = loadMemory();
  const nextProfile = {
    ...memory.userProfile
  };

  for (const [key, value] of Object.entries(profile)) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      delete nextProfile[key];
      continue;
    }
    nextProfile[key] = normalized;
  }

  memory.userProfile = nextProfile;
  saveMemory(memory);
  return memory.userProfile;
}

export function updateRelationshipState(message, mood) {
  const memory = loadMemory();
  const text = message.trim();
  const relation = memory.relationship || createSeed().relationship;

  if (text.length <= 4 || /^[0-9a-zA-Z_]+$/.test(text) || /^(你好|嗨|哈喽|hi|hello)$/i.test(text)) {
    relation.score = clamp(relation.score || 8, 0, 100);
    relation.turns = (relation.turns || 0) + 1;
    relation.lastMood = mood;
    relation.lastTopic = detectTopic(text);
    memory.relationship = relation;
    saveMemory(memory);
    return relation;
  }

  let delta = 1.2;
  if (/(我觉得|其实|有点|最近|今天|昨晚|我在想|我有点怕)/.test(text)) delta += 1.4;
  if (/(谢谢|你真好|你在就好|陪我|抱抱)/.test(text)) delta += 1.8;
  if (/(滚|闭嘴|烦死|别说了)/.test(text)) delta -= 2.2;
  if (text.length > 28) delta += 0.6;
  if (mood === 'negative' || mood === 'angry') delta += 0.5;

  relation.score = clamp((relation.score || 8) + delta, 0, 100);
  relation.turns = (relation.turns || 0) + 1;
  relation.lastMood = mood;
  relation.lastTopic = detectTopic(text);

  if (relation.score < 28) relation.stage = 'initial';
  else if (relation.score < 62) relation.stage = 'warm';
  else relation.stage = 'close';

  memory.relationship = relation;
  saveMemory(memory);
  return relation;
}
