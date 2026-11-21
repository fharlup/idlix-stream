import { NextResponse } from 'next/server';
import { fetchCinemetaCatalog } from '@/lib/catalog';

const GENRE_MAP = {
  action: 'Action',
  'sci-fi': 'Sci-Fi',
  drama: 'Drama',
  horror: 'Horror',
  comedy: 'Comedy',
  animation: 'Animation',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'home';
  const query = (searchParams.get('q') || '').trim();
  const genre = (searchParams.get('genre') || '').trim();
  const skip = parseInt(searchParams.get('skip') || '0', 10) || 0;

  try {
    if (mode === 'search' && query) {
      const encoded = encodeURIComponent(query);
      const [movies, series] = await Promise.all([
        fetchCinemetaCatalog(`/catalog/movie/top/search=${encoded}.json`),
        fetchCinemetaCatalog(`/catalog/series/top/search=${encoded}.json`),
      ]);
      const seen = new Set();
      const items = [...movies, ...series].filter((item) => {
        if (!item || seen.has(item.slug)) return false;
        seen.add(item.slug);
        return true;
      });
      return NextResponse.json({ success: true, data: items });
    }

    if (mode === 'movies') {
      const suffix = skip > 0 ? `/skip=${skip}.json` : '.json';
      const items = await fetchCinemetaCatalog(`/catalog/movie/top${suffix}`);
      return NextResponse.json({ success: true, data: items });
    }

    if (mode === 'series') {
      const suffix = skip > 0 ? `/skip=${skip}.json` : '.json';
      const items = await fetchCinemetaCatalog(`/catalog/series/top${suffix}`);
      return NextResponse.json({ success: true, data: items });
    }

    if (mode === 'trending') {
      const items = await fetchCinemetaCatalog('/catalog/movie/year.json');
      return NextResponse.json({ success: true, data: items });
    }

    if (mode === 'genre' && genre) {
      const genreName = GENRE_MAP[genre.toLowerCase()] || genre;
      const encoded = encodeURIComponent(genreName);
      const [movies, series] = await Promise.all([
        fetchCinemetaCatalog(`/catalog/movie/top/genre=${encoded}.json`),
        fetchCinemetaCatalog(`/catalog/series/top/genre=${encoded}.json`),
      ]);
      return NextResponse.json({ success: true, data: [...movies, ...series] });
    }

    // Default: home sections
    const [topMovies, newMovies, topSeries] = await Promise.all([
      fetchCinemetaCatalog('/catalog/movie/top.json'),
      fetchCinemetaCatalog('/catalog/movie/year.json'),
      fetchCinemetaCatalog('/catalog/series/top.json'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        featured: topMovies.slice(0, 8),
        sections: {
          '🔥 Film Populer & Trending': topMovies,
          '🎬 Rilisan Terbaru': newMovies,
          '📺 Serial TV & Drama Populer': topSeries,
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to load catalog' },
      { status: 500 }
    );
  }
}
