const CINEMETA_BASE = 'https://v3-cinemeta.strem.io';
const IDLIX_BASE_URL = process.env.IDLIX_BASE_URL || 'https://z3.idlixku.com';

/**
 * Map a Cinemeta metadata object into our unified media item shape.
 */
export function mapCinemetaItem(meta) {
  if (!meta) return null;
  const imdbId = meta.imdb_id || meta.id;
  const yearMatch = String(meta.releaseInfo || '').match(/\d{4}/);

  return {
    title: meta.name || '',
    slug: imdbId,
    imdbId,
    type: meta.type === 'series' ? 'series' : 'movie',
    year: yearMatch ? parseInt(yearMatch[0], 10) : null,
    quality: 'HD',
    rating: meta.imdbRating ? parseFloat(meta.imdbRating) : null,
    poster: meta.poster || null,
    backdrop: meta.background || meta.poster || null,
    overview: meta.description || '',
    genres: meta.genres || [],
    director: Array.isArray(meta.director) ? meta.director.join(', ') : (meta.director || null),
    cast: Array.isArray(meta.cast) ? meta.cast.map((c) => ({ name: c })) : [],
    runtime: meta.runtime ? parseInt(String(meta.runtime), 10) || null : null,
  };
}

/**
 * Fetch a Cinemeta catalog endpoint with Next.js caching.
 */
export async function fetchCinemetaCatalog(path) {
  const res = await fetch(`${CINEMETA_BASE}${path}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.metas || []).map(mapCinemetaItem).filter(Boolean);
}

/**
 * Fetch full detail & seasons/episodes for a movie or series.
 */
export async function fetchCinemetaDetail(type, imdbId) {
  const metaType = type === 'series' ? 'series' : 'movie';
  const res = await fetch(`${CINEMETA_BASE}/meta/${metaType}/${imdbId}.json`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const m = data.meta;
  if (!m) return null;

  let seasons = null;
  if (metaType === 'series' && Array.isArray(m.videos) && m.videos.length) {
    const seasonsMap = new Map();
    for (const v of m.videos) {
      if (v.season === 0) continue;
      if (!seasonsMap.has(v.season)) {
        seasonsMap.set(v.season, {
          seasonNumber: v.season,
          name: `Musim ${v.season}`,
          episodes: [],
        });
      }
      seasonsMap.get(v.season).episodes.push({
        episodeNumber: v.episode,
        title: v.title || `Episode ${v.episode}`,
        overview: v.overview || '',
      });
    }
    seasons = Array.from(seasonsMap.values()).sort(
      (a, b) => a.seasonNumber - b.seasonNumber
    );
  }

  return {
    ...mapCinemetaItem(m),
    country: m.country || 'International',
    trailer: m.trailers?.[0]?.source
      ? `https://www.youtube.com/embed/${m.trailers[0].source}`
      : null,
    seasons,
  };
}

/**
 * Optional: Try upstream IDLIX API if CF_CLEARANCE or STEALTH_API_URL is configured.
 */
export async function tryIdlixUpstream(path) {
  const stealthUrl = process.env.STEALTH_API_URL;
  const cfClearance = process.env.CF_CLEARANCE;
  if (!stealthUrl && !cfClearance) return null;

  const targetUrl = `${IDLIX_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    if (stealthUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${stealthUrl}/v1/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, method: 'GET', disableMedia: true }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'ok' && json.solution?.response) {
          return JSON.parse(json.solution.response);
        }
      }
    }

    if (cfClearance) {
      const did = process.env.DID || '00000000000000000000000000000000';
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Cookie: `cf_clearance=${cfClearance}; did=${did}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) return await res.json();
    }
  } catch (_) {
    // Upstream unreachable or blocked
  }
  return null;
}
