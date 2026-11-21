import crypto from 'crypto';

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

export function isCloudDbEnabled() {
  return Boolean(getRedisConfig());
}

async function redisCommand(commandArgs) {
  const cfg = getRedisConfig();
  if (!cfg) throw new Error('Cloud DB not configured');

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandArgs),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Redis HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function getCloudUser(username) {
  const raw = await redisCommand(['GET', `idlix:user:${username}`]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCloudUser(user) {
  await redisCommand(['SET', `idlix:user:${user.username}`, JSON.stringify(user)]);
  return user;
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
