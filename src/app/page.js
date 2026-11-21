'use client';

import { useEffect, useState } from 'react';
import PlayerModal from '@/components/PlayerModal';
import PwaManager from '@/components/PwaManager';

const NAV_TABS = [
  { id: 'home', label: 'Beranda', icon: '🏠' },
  { id: 'movies', label: 'Film', icon: '🎬' },
  { id: 'series', label: 'Serial TV', icon: '📺' },
  { id: 'trending', label: 'Trending', icon: '🔥' },
  { id: 'leaderboard', label: 'Peringkat', icon: '🏆' },
];

const FILTER_PILLS = [
  { id: 'all', label: '🌟 Semua' },
  { id: 'movie', label: '🎬 Film' },
  { id: 'series', label: '📺 Serial TV' },
  { id: 'trending', label: '🔥 Sedang Trending' },
  { id: 'action', label: 'Action' },
  { id: 'sci-fi', label: 'Sci-Fi' },
  { id: 'drama', label: 'Drama' },
  { id: 'horror', label: 'Horror' },
  { id: 'comedy', label: 'Komedi' },
  { id: 'animation', label: 'Animasi' },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('home');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [featured, setFeatured] = useState([]);
  const [sections, setSections] = useState({});
  const [extraMovies, setExtraMovies] = useState([]);
  const [skip, setSkip] = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);

  const [gridTitle, setGridTitle] = useState('');
  const [gridItems, setGridItems] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load initial homepage catalog
  useEffect(() => {
    fetch('/api/catalog?mode=home')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setFeatured(res.data.featured || []);
          setSections(res.data.sections || {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      if (activeTab === 'home' && activeFilter === 'all') {
        setGridItems(null);
      }
      return;
    }
    if (q.length < 2) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      setGridTitle(`Hasil Pencarian "${q}"`);
      try {
        const res = await fetch(`/api/catalog?mode=search&q=${encodeURIComponent(q)}`).then((r) => r.json());
        const items = res.success ? res.data : [];
        setGridItems(items);
        setGridTitle(`Hasil Pencarian "${q}" (${items.length} ditemukan)`);
      } catch {
        setGridItems([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, activeFilter]);

  const handleTabClick = async (tabId) => {
    setActiveTab(tabId);
    setActiveFilter('all');
    setSearchQuery('');

    if (tabId === 'home') {
      setGridItems(null);
      return;
    }

    setLoading(true);
    try {
      if (tabId === 'movies') {
        setGridTitle('🎬 Semua Koleksi Film');
        const [p1, p2] = await Promise.all([
          fetch('/api/catalog?mode=movies&skip=0').then((r) => r.json()),
          fetch('/api/catalog?mode=movies&skip=50').then((r) => r.json()),
        ]);
        setGridItems([...(p1.data || []), ...(p2.data || [])]);
      } else if (tabId === 'series') {
        setGridTitle('📺 Serial TV & Drama Populer');
        const [p1, p2] = await Promise.all([
          fetch('/api/catalog?mode=series&skip=0').then((r) => r.json()),
          fetch('/api/catalog?mode=series&skip=50').then((r) => r.json()),
        ]);
        setGridItems([...(p1.data || []), ...(p2.data || [])]);
      } else if (tabId === 'trending') {
        setGridTitle('🔥 Sedang Trending');
        const res = await fetch('/api/catalog?mode=trending').then((r) => r.json());
        setGridItems(res.data || []);
      } else if (tabId === 'leaderboard') {
        setGridTitle('🏆 Peringkat Rating Tertinggi');
        const all = [...Object.values(sections).flat(), ...extraMovies];
        const map = new Map();
        all.forEach((item) => item?.slug && !map.has(item.slug) && map.set(item.slug, item));
        const sorted = Array.from(map.values()).sort((a, b) => (b.rating || 0) - (a.rating || 0));
        setGridItems(sorted);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterClick = async (filterId) => {
    setActiveFilter(filterId);
    setSearchQuery('');

    if (filterId === 'all') {
      setActiveTab('home');
      setGridItems(null);
      return;
    }
    if (filterId === 'movie') return handleTabClick('movies');
    if (filterId === 'series') return handleTabClick('series');
    if (filterId === 'trending') return handleTabClick('trending');

    setLoading(true);
    setGridTitle(`Genre: ${filterId.toUpperCase()}`);
    try {
      const res = await fetch(`/api/catalog?mode=genre&genre=${encodeURIComponent(filterId)}`).then((r) => r.json());
      setGridItems(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/catalog?mode=movies&skip=${skip}`).then((r) => r.json());
      if (res.success && res.data?.length) {
        setExtraMovies((prev) => [...prev, ...res.data]);
        setSkip((s) => s + 50);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const heroItem = featured[0];
  const showHero = !gridItems && activeTab === 'home' && !searchQuery;

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div className="logo-group" onClick={() => handleTabClick('home')}>
              <div className="logo-badge">IDLIX</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="logo-title">STREAM</span>
                <span className="logo-sub">NEXT.JS EDITION</span>
              </div>
            </div>

            <nav>
              <ul className="nav-links">
                {NAV_TABS.map((tab) => (
                  <li key={tab.id}>
                    <button
                      className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => handleTabClick(tab.id)}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="header-actions">
            <div className="search-box">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari judul film, series..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="clear-search-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setGridItems(null);
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <PwaManager />

            <div className="status-indicator">
              <span className="status-dot" />
              <span className="status-label">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Spotlight */}
      {showHero && heroItem && (
        <section className="hero">
          <div
            className="hero-backdrop"
            style={{ backgroundImage: heroItem.backdrop ? `url('${heroItem.backdrop}')` : 'none' }}
          />
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="hero-body">
              <div className="hero-badge-row">
                <span className="badge badge-featured">🔥 PILIHAN UTAMA</span>
                <span className="badge badge-quality">{heroItem.quality || 'HD'}</span>
                {heroItem.rating && <span className="badge badge-rating">⭐ {heroItem.rating}</span>}
                {heroItem.year && <span className="badge badge-year">{heroItem.year}</span>}
              </div>
              <h1 className="hero-title">{heroItem.title}</h1>
              <p className="hero-overview">{heroItem.overview}</p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => setSelectedItem(heroItem)}>
                  <span>▶</span> Nonton Sekarang
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedItem(heroItem)}>
                  <span>ℹ️</span> Detail & Episode
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="main-content" style={{ paddingTop: showHero ? 32 : 96 }}>
        <div className="filter-bar">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.id}
              className={`filter-pill ${activeFilter === pill.id ? 'active' : ''}`}
              onClick={() => handleFilterClick(pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="media-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ paddingTop: '148%' }} />
            ))}
          </div>
        ) : gridItems ? (
          <section>
            <div className="section-header" style={{ marginTop: 12 }}>
              <h2 className="section-title">{gridTitle}</h2>
            </div>
            <MediaGrid items={gridItems} onSelect={setSelectedItem} />
          </section>
        ) : (
          <>
            {Object.entries(sections).map(([title, items]) => (
              <section key={title} className="content-section">
                <div className="section-header">
                  <div className="section-title-wrap">
                    <h2 className="section-title">{title}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ({items.length} judul)
                    </span>
                  </div>
                </div>
                <MediaGrid items={items.slice(0, 24)} onSelect={setSelectedItem} />
              </section>
            ))}

            {extraMovies.length > 0 && (
              <section className="content-section">
                <div className="section-header">
                  <h2 className="section-title">🎞️ Eksplorasi Film Lainnya ({extraMovies.length})</h2>
                </div>
                <MediaGrid items={extraMovies} onSelect={setSelectedItem} />
              </section>
            )}

            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '12px 28px' }}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Memuat...' : '➕ Muat Lebih Banyak Film'}
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        <p>© 2026 IDLIX Stream — Powered by Next.js App Router (Vercel Ready).</p>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Navigasi Mobile">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {selectedItem && (
        <PlayerModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  );
}

function MediaGrid({ items, onSelect }) {
  if (!items || !items.length) {
    return (
      <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>
        Tidak ada konten ditemukan.
      </p>
    );
  }

  return (
    <div className="media-grid">
      {items.map((item) => (
        <div key={item.slug} className="media-card" onClick={() => onSelect(item)}>
          <div className="media-poster-wrap">
            {item.poster ? (
              <img className="media-poster" src={item.poster} alt={item.title} loading="lazy" />
            ) : (
              <div className="poster-fallback">
                <span>🎬</span>
                <strong>{item.title}</strong>
              </div>
            )}
            <div className="media-badges">
              <span className="badge badge-quality">{item.quality || 'HD'}</span>
              {item.rating && <span className="badge badge-rating">⭐ {item.rating}</span>}
            </div>
            <div className="card-play-overlay">
              <div className="card-play-btn">▶</div>
            </div>
          </div>
          <div className="media-info">
            <h3 className="media-title" title={item.title}>
              {item.title}
            </h3>
            <div className="media-meta">
              <span>{item.type === 'series' ? 'Serial TV' : 'Film'}</span>
              <span>{item.year || ''}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
