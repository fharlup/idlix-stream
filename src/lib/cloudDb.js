import crypto from 'crypto';
import { createClient } from 'redis';

let _redisClient = null;
let _redisConnecting = null;

function getRestConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

function getTcpUrl() {
  return process.env.REDIS_URL || null;
}

export function isCloudDbEnabled() {
  return Boolean(getRestConfig() || getTcpUrl());
}

async function getTcpClient() {
  const url = getTcpUrl();
  if (!url) throw new Error('REDIS_URL not configured');

  if (_redisClient?.isOpen) return _redisClient;
  if (_redisConnecting) return _redisConnecting;

  const client = createClient({ url });
  client.on('error', (err) => console.error('[redis]', err.message));

  _redisConnecting = client.connect().then(() => {
    _redisClient = client;
    _redisConnecting = null;
    return client;
  }).catch((err) => {
    _redisConnecting = null;
    throw err;
  });

  return _redisConnecting;
}

async function restCommand(commandArgs) {
  const cfg = getRestConfig();
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandArgs),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Redis REST HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function getCloudUser(username) {
  const key = `idlix:user:${username}`;
  let raw = null;

  if (getRestConfig()) {
    raw = await restCommand(['GET', key]);
  } else if (getTcpUrl()) {
    const client = await getTcpClient();
    raw = await client.get(key);
  } else {
    throw new Error('Cloud DB not configured');
  }

  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCloudUser(user) {
  const key = `idlix:user:${user.username}`;
  const value = JSON.stringify(user);

  if (getRestConfig()) {
    await restCommand(['SET', key, value]);
  } else if (getTcpUrl()) {
    const client = await getTcpClient();
    await client.set(key, value);
  } else {
    throw new Error('Cloud DB not configured');
  }

  return user;
}

export async function setTempValue(key, obj, ttlSeconds = 300) {
  const value = JSON.stringify(obj);
  if (getRestConfig()) {
    await restCommand(['SET', key, value, 'EX', ttlSeconds]);
  } else if (getTcpUrl()) {
    const client = await getTcpClient();
    await client.set(key, value, { EX: ttlSeconds });
  } else {
    throw new Error('Cloud DB not configured');
  }
}

export async function getTempValue(key) {
  let raw = null;
  if (getRestConfig()) {
    raw = await restCommand(['GET', key]);
  } else if (getTcpUrl()) {
    const client = await getTcpClient();
    raw = await client.get(key);
  } else {
    throw new Error('Cloud DB not configured');
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function deleteTempValue(key) {
  if (getRestConfig()) {
    await restCommand(['DEL', key]);
  } else if (getTcpUrl()) {
    const client = await getTcpClient();
    await client.del(key);
  }
}

export function hashPassword(password, salt) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${password || ''}`)
    .digest('hex');
}

function getSessionSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.REDIS_URL ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    'idlix-default-session-secret'
  );
}

export function signSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, iat: Date.now() })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed?.u || null;
  } catch {
    return null;
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe;
}
