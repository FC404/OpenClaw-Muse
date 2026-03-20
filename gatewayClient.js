import crypto from 'crypto';
import WebSocket from 'ws';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomId() {
  return crypto.randomUUID();
}

function extractTextFromContent(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (typeof item.text === 'string') return item.text;
      if (typeof item.content === 'string') return item.content;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function extractAssistantText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text.trim();
  return extractTextFromContent(message.content);
}

function normalizeMessageText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text.trim();
  return extractTextFromContent(message.content);
}

function normalizeComparableText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function isUserMessage(message) {
  return String(message?.role || '').toLowerCase() === 'user';
}

function isAssistantMessage(message) {
  return String(message?.role || '').toLowerCase() === 'assistant';
}

function countMatchingUserMessages(messages, text) {
  const target = normalizeComparableText(text);
  return messages.filter((item) => {
    if (!isUserMessage(item)) return false;
    return normalizeComparableText(normalizeMessageText(item)) === target;
  }).length;
}

function findNthUserMessageIndex(messages, text, nth) {
  const target = normalizeComparableText(text);
  let seen = 0;
  for (let i = 0; i < messages.length; i += 1) {
    const item = messages[i];
    if (!isUserMessage(item)) continue;
    if (normalizeComparableText(normalizeMessageText(item)) !== target) continue;
    seen += 1;
    if (seen === nth) return i;
  }
  return -1;
}

class OpenClawGatewayClient {
  constructor(options = {}) {
    this.url = options.url || 'ws://127.0.0.1:18789';
    this.token = options.token || '';
    this.password = options.password || '';
    this.clientName = options.clientName || 'openclaw-control-ui';
    this.clientVersion = options.clientVersion || '0.1.0';
    this.instanceId = randomId();
    this.origin = options.origin || 'http://127.0.0.1:18789';
    this.responsePollIntervalMs = Math.max(180, Number(options.responsePollIntervalMs) || 320);
    this.responsePollAttempts = Math.max(12, Number(options.responsePollAttempts) || 40);

    this.ws = null;
    this.pending = new Map();
    this.connected = false;
    this.connectInFlight = null;
    this.manualClose = false;
    this.eventListeners = new Set();
    this.connectChallengeNonce = null;
  }

  async ensureConnected() {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectInFlight) {
      return this.connectInFlight;
    }

    this.connectInFlight = this.connect();
    try {
      await this.connectInFlight;
    } finally {
      this.connectInFlight = null;
    }
  }

  async connect() {
    this.manualClose = false;

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url, {
        headers: {
          Origin: this.origin
        }
      });
      let settled = false;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {}
        reject(err);
      };

      ws.on('open', async () => {
        this.ws = ws;
        this.connected = false;

        try {
          await this.performConnectHandshake();
          settled = true;
          resolve();
        } catch (error) {
          fail(error);
        }
      });

      ws.on('message', (raw) => {
        this.handleMessage(raw.toString());
      });

      ws.on('close', () => {
        this.connected = false;
        this.ws = null;
        if (!this.manualClose && !settled) {
          fail(new Error('OpenClaw gateway closed before handshake completed'));
        }
      });

      ws.on('error', (error) => {
        if (!settled) {
          fail(error);
        }
      });
    });
  }

  async performConnectHandshake() {
    for (let i = 0; i < 8; i += 1) {
      if (this.connectChallengeNonce) break;
      await wait(120);
    }

    const hello = await this.request('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.clientName,
        version: this.clientVersion,
        platform: process.platform,
        mode: 'webchat',
        instanceId: this.instanceId
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      caps: [],
      auth: this.token || this.password
        ? {
            token: this.token || undefined,
            password: this.password || undefined
          }
        : undefined,
      userAgent: `clawmuse/${this.clientVersion}`,
      locale: 'zh-CN'
    });

    this.connected = true;
    return hello;
  }

  handleMessage(raw) {
    let packet;
    try {
      packet = JSON.parse(raw);
    } catch {
      return;
    }

    if (packet?.type === 'event') {
      if (packet.event === 'connect.challenge') {
        this.connectChallengeNonce = packet?.payload?.nonce || null;
      }
      for (const listener of this.eventListeners) {
        try {
          listener(packet);
        } catch {}
      }
      return;
    }

    if (packet?.type === 'res') {
      const pending = this.pending.get(packet.id);
      if (!pending) return;
      this.pending.delete(packet.id);
      if (packet.ok) {
        pending.resolve(packet.payload);
      } else {
        pending.reject(new Error(packet?.error?.message || 'OpenClaw request failed'));
      }
    }
  }

  request(method, params) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('OpenClaw gateway not connected'));
    }

    const id = randomId();
    const payload = {
      type: 'req',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OpenClaw request timeout: ${method}`));
      }, 20000);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });

      this.ws.send(JSON.stringify(payload));
    });
  }

  subscribe(listener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async sendChat({ sessionKey, message, attachments }) {
    await this.ensureConnected();

    const runId = randomId();
    const historyLimit = 40;
    const targetText = normalizeComparableText(message);
    const before = await this.request('chat.history', { sessionKey, limit: historyLimit });
    const beforeMessages = Array.isArray(before?.messages) ? before.messages : [];
    const expectedUserOccurrence = countMatchingUserMessages(beforeMessages, targetText) + 1;

    const normalizedAttachments = Array.isArray(attachments) && attachments.length > 0
      ? attachments
      : undefined;

    await this.request('chat.send', {
      sessionKey,
      message,
      deliver: false,
      idempotencyKey: runId,
      attachments: normalizedAttachments
    });

    for (let i = 0; i < this.responsePollAttempts; i += 1) {
      await wait(this.responsePollIntervalMs);
      const history = await this.request('chat.history', { sessionKey, limit: historyLimit });
      const messages = Array.isArray(history?.messages) ? history.messages : [];

      const userIndex = findNthUserMessageIndex(messages, targetText, expectedUserOccurrence);
      if (userIndex < 0) {
        continue;
      }

      for (let j = userIndex + 1; j < messages.length; j += 1) {
        const item = messages[j];
        if (!isAssistantMessage(item)) continue;
        const text = normalizeMessageText(item);
        if (text) return text;
      }
    }

    throw new Error('OpenClaw chat timed out waiting for assistant reply');
  }

  getConnectionState() {
    return {
      connected: Boolean(this.connected && this.ws?.readyState === WebSocket.OPEN),
      readyState: this.ws?.readyState ?? WebSocket.CLOSED,
      url: this.url
    };
  }
}

let clientSingleton = null;

export function getOpenClawClient(options = {}) {
  if (!clientSingleton) {
    clientSingleton = new OpenClawGatewayClient(options);
  }
  return clientSingleton;
}
