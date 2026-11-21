const ACCOUNTS_KEY = 'idlix_accounts_v1';
const CURRENT_USER_KEY = 'idlix_current_user_v1';

const AVATAR_COLORS = ['#e50914', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export function getAccountsMap() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAccountsMap(map) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map));
}

export function getCurrentUsername() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_USER_KEY) || null;
}

export function getCurrentAccount() {
  const username = getCurrentUsername();
  if (!username) return null;
  const map = getAccountsMap();
  return map[username] || null;
}

export function registerAccount(username, pin = '') {
  const cleanName = username.trim().toLowerCase();
  if (!cleanName || cleanName.length < 2) {
    return { ok: false, error: 'Username minimal 2 karakter.' };
  }
  const map = getAccountsMap();
  if (map[cleanName]) {
    return { ok: false, error: 'Username sudah terdaftar. Silakan masuk.' };
  }

  const color = AVATAR_COLORS[cleanName.charCodeAt(0) % AVATAR_COLORS.length];
  const account = {
    username: cleanName,
    displayName: username.trim(),
    pinHash: pin ? simpleHash(pin) : '',
    avatarColor: color,
    createdAt: Date.now(),
    history: [],
    watchlist: [],
  };
  map[cleanName] = account;
  saveAccountsMap(map);
  localStorage.setItem(CURRENT_USER_KEY, cleanName);
  return { ok: true, account };
}

export function loginAccount(username, pin = '') {
  const cleanName = username.trim().toLowerCase();
  const map = getAccountsMap();
  const account = map[cleanName];
  if (!account) {
    return { ok: false, error: 'Akun tidak ditemukan. Silakan daftar dulu.' };
  }
  if (account.pinHash && account.pinHash !== simpleHash(pin)) {
    return { ok: false, error: 'PIN / Password salah.' };
  }
  localStorage.setItem(CURRENT_USER_KEY, cleanName);
  return { ok: true, account };
}

export function logoutAccount() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function recordWatchHistory(item, season = 1, episode = 1, progressTime) {
  const username = getCurrentUsername();
  if (!username || !item?.slug) return null;

  const map = getAccountsMap();
  const account = map[username];
  if (!account) return null;

  const existing = (account.history || []).find((h) => h.slug === item.slug);
  const entry = {
    slug: item.slug,
    imdbId: item.imdbId || item.slug,
    tmdbId: item.tmdbId || null,
    title: item.title,
    type: item.type || 'movie',
    poster: item.poster || null,
    backdrop: item.backdrop || null,
    year: item.year || null,
    rating: item.rating || null,
    quality: item.quality || 'HD',
    overview: item.overview || '',
    genres: item.genres || [],
    season: item.type === 'series' ? season : null,
    episode: item.type === 'series' ? episode : null,
    progressTime: progressTime !== undefined ? progressTime : (existing?.progressTime || ''),
    watchedAt: Date.now(),
  };

  const filtered = (account.history || []).filter((h) => h.slug !== item.slug);
  account.history = [entry, ...filtered].slice(0, 100);
  map[username] = account;
  saveAccountsMap(map);
  return account;
}

export function updateWatchProgress(slug, progressTime) {
  const username = getCurrentUsername();
  if (!username || !slug) return null;
  const map = getAccountsMap();
  const account = map[username];
  if (!account) return null;

  account.history = (account.history || []).map((h) =>
    h.slug === slug ? { ...h, progressTime: String(progressTime || '').trim(), watchedAt: Date.now() } : h
  );
  map[username] = account;
  saveAccountsMap(map);
  return account;
}

export function removeWatchHistoryItem(slug) {
  const username = getCurrentUsername();
  if (!username) return null;
  const map = getAccountsMap();
  const account = map[username];
  if (!account) return null;

  account.history = (account.history || []).filter((h) => h.slug !== slug);
  map[username] = account;
  saveAccountsMap(map);
  return account;
}

export function clearWatchHistory() {
  const username = getCurrentUsername();
  if (!username) return null;
  const map = getAccountsMap();
  const account = map[username];
  if (!account) return null;

  account.history = [];
  map[username] = account;
  saveAccountsMap(map);
  return account;
}

export function toggleWatchlistItem(item) {
  const username = getCurrentUsername();
  if (!username || !item?.slug) return null;
  const map = getAccountsMap();
  const account = map[username];
  if (!account) return null;

  const list = account.watchlist || [];
  const exists = list.some((w) => w.slug === item.slug);
  if (exists) {
    account.watchlist = list.filter((w) => w.slug !== item.slug);
  } else {
    account.watchlist = [
      {
        slug: item.slug,
        imdbId: item.imdbId || item.slug,
        tmdbId: item.tmdbId || null,
        title: item.title,
        type: item.type || 'movie',
        poster: item.poster || null,
        backdrop: item.backdrop || null,
        year: item.year || null,
        rating: item.rating || null,
        quality: item.quality || 'HD',
        overview: item.overview || '',
        genres: item.genres || [],
      },
      ...list,
    ].slice(0, 100);
  }
  map[username] = account;
  saveAccountsMap(map);
  return account;
}

export function exportAccountSyncCode() {
  const account = getCurrentAccount();
  if (!account) return '';
  try {
    const json = JSON.stringify(account);
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return '';
  }
}

export function importAccountSyncCode(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const parsed = JSON.parse(json);
    if (!parsed?.username || !Array.isArray(parsed.history)) {
      return { ok: false, error: 'Kode sinkronisasi tidak valid.' };
    }
    const map = getAccountsMap();
    map[parsed.username] = parsed;
    saveAccountsMap(map);
    localStorage.setItem(CURRENT_USER_KEY, parsed.username);
    return { ok: true, account: parsed };
  } catch {
    return { ok: false, error: 'Gagal membaca kode sinkronisasi.' };
  }
}
