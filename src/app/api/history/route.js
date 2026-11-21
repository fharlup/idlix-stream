import { NextResponse } from 'next/server';
import {
  getCloudUser,
  isCloudDbEnabled,
  sanitizeUser,
  saveCloudUser,
  verifySessionToken,
} from '@/lib/cloudDb';

const SESSION_COOKIE = 'idlix_session';

export async function POST(request) {
  if (!isCloudDbEnabled()) {
    return NextResponse.json(
      { success: false, cloudEnabled: false, message: 'Cloud DB belum dikonfigurasi' },
      { status: 503 }
    );
  }

  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const username = verifySessionToken(token);
    if (!username) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCloudUser(username);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, item, season, episode, slug } = body || {};

    if (action === 'track' && item?.slug) {
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
        season: item.type === 'series' ? (season || 1) : null,
        episode: item.type === 'series' ? (episode || 1) : null,
        watchedAt: Date.now(),
      };
      user.history = [entry, ...(user.history || []).filter((h) => h.slug !== item.slug)].slice(0, 100);
      await saveCloudUser(user);
      return NextResponse.json({ success: true, account: sanitizeUser(user) });
    }

    if (action === 'remove' && slug) {
      user.history = (user.history || []).filter((h) => h.slug !== slug);
      await saveCloudUser(user);
      return NextResponse.json({ success: true, account: sanitizeUser(user) });
    }

    if (action === 'clear') {
      user.history = [];
      await saveCloudUser(user);
      return NextResponse.json({ success: true, account: sanitizeUser(user) });
    }

    if (action === 'toggle_watchlist' && item?.slug) {
      const list = user.watchlist || [];
      const exists = list.some((w) => w.slug === item.slug);
      if (exists) {
        user.watchlist = list.filter((w) => w.slug !== item.slug);
      } else {
        user.watchlist = [
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
      await saveCloudUser(user);
      return NextResponse.json({ success: true, account: sanitizeUser(user) });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'History error' },
      { status: 500 }
    );
  }
}
