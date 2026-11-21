'use client';

import { useCallback, useEffect, useState } from 'react';
import AccountModal from '@/components/AccountModal';
import PlayerModal from '@/components/PlayerModal';
import PwaManager from '@/components/PwaManager';
import {
  getCurrentAccount,
  recordWatchHistory,
  removeWatchHistoryItem,
  toggleWatchlistItem,
  updateWatchProgress,
} from '@/lib/accountStore';

function formatWatchTimestamp(ts) {
  if (!ts) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const NAV_TABS = [
  { id: 'home', label: 'Beranda' },
  { id: 'movies', label: 'Film' },
  { id: 'series', label: 'Series' },
  { id: 'trending', label: 'Trending' },
  { id: 'history', label: 'Riwayat' },
];

function NavIcon({ id }) {
  if (id === 'home') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }
  if (id === 'movies') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    );
  }
  if (id === 'series') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    );
  }
  if (id === 'trending') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

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

  // Account & Cloud Sync state
  const [account, setAccount] = useState(null);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((res) => {
        if (res.cloudEnabled) {
          setCloudEnabled(true);
          setAccount(res.account || null);
        } else {
          setCloudEnabled(false);
          setAccount(getCurrentAccount());
        }
      })
      .catch(() => {
        setAccount(getCurrentAccount());
      });
  }, []);

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

  const handleTrackWatch = useCallback(
    async (item, season = 1, episode = 1) => {
      if (!account || !item?.slug) return;
      if (cloudEnabled) {
        try {
          const res = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'track', item, season, episode }),
          }).then((r) => r.json());
          if (res.success && res.account) setAccount(res.account);
        } catch {}
      } else {
        const updated = recordWatchHistory(item, season, episode);
        if (updated) setAccount({ ...updated });
      }
    },
    [account, cloudEnabled]
  );

  const handleToggleSave = useCallback(
    async (item) => {
      if (!account) {
        setShowAccountModal(true);
        return;
      }
      if (cloudEnabled) {
        try {
          const res = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle_watchlist', item }),
          }).then((r) => r.json());
          if (res.success && res.account) setAccount(res.account);
        } catch {}
      } else {
        const updated = toggleWatchlistItem(item);
        if (updated) setAccount({ ...updated });
      }
    },
    [account, cloudEnabled]
  );

  const handleRemoveHistory = async (slug) => {
    if (!account) return;
    if (cloudEnabled) {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', slug }),
      }).then((r) => r.json());
      if (res.success && res.account) setAccount(res.account);
    } else {
      const updated = removeWatchHistoryItem(slug);
      if (updated) setAccount({ ...updated });
    }
  };

  const handleUpdateProgress = useCallback(
    async (slug, progressTime) => {
      if (!account || !slug) return;
      if (cloudEnabled) {
        try {
          const res = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_progress', slug, progressTime }),
          }).then((r) => r.json());
          if (res.success && res.account) setAccount(res.account);
        } catch {}
      } else {
        const updated = updateWatchProgress(slug, progressTime);
        if (updated) setAccount({ ...updated });
      }
    },
    [account, cloudEnabled]
  );

  const handleTabClick = async (tabId) => {
    setActiveTab(tabId);
    setActiveFilter('all');
    setSearchQuery('');

    if (tabId === 'home') {
      setGridItems(null);
      return;
    }

    if (tabId === 'history') {
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
  const watchedSlugs = new Set((account?.history || []).map((h) => h.slug));
  const isSelectedSaved = Boolean(selectedItem && (account?.watchlist || []).some((w) => w.slug === selectedItem.slug));

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
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
                placeholder="Cari film..."
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

            <button
              className="account-header-btn"
              onClick={() => setShowAccountModal(true)}
              title="Akun & Riwayat Tontonan"
            >
              {account ? (
                <>
                  <span className="account-avatar-sm" style={{ background: account.avatarColor || '#e50914' }}>
                    {(account.displayName || account.username).charAt(0).toUpperCase()}
                  </span>
                  <span className="account-name-label">{account.displayName || account.username}</span>
                </>
              ) : (
                <>
                  <span>👤</span>
                  <span className="account-name-label">Masuk</span>
                </>
              )}
            </button>
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
                  <span>▶</span> Putar Sekarang
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="main-content" style={{ paddingTop: showHero ? 32 : 84 }}>
        {activeTab !== 'history' && (
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
        )}

        {activeTab === 'history' ? (
          <section>
            {!account ? (
              <div className="history-empty-box">
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>👤</div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
                  Masuk untuk Melacak Tontonan Anda
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 18 }}>
                  Buat akun gratis untuk menyimpan riwayat film, episode terakhir yang ditonton, dan daftar simpanan.
                </p>
                <button className="btn btn-primary" onClick={() => setShowAccountModal(true)}>
                  🚀 Masuk / Daftar Akun
                </button>
              </div>
            ) : (
              <>
                <div className="section-header" style={{ marginTop: 8 }}>
                  <h2 className="section-title">🕒 Riwayat Tontonan ({(account.history || []).length})</h2>
                </div>
                {account.history?.length ? (
                  <MediaGrid
                    items={account.history}
                    watchedSlugs={watchedSlugs}
                    onSelect={setSelectedItem}
                    onRemove={handleRemoveHistory}
                  />
                ) : (
                  <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>
                    Belum ada film atau serial yang ditonton.
                  </p>
                )}

                <div className="section-header" style={{ marginTop: 40 }}>
                  <h2 className="section-title">❤️ Daftar Tersimpan ({(account.watchlist || []).length})</h2>
                </div>
                {account.watchlist?.length ? (
                  <MediaGrid items={account.watchlist} watchedSlugs={watchedSlugs} onSelect={setSelectedItem} />
                ) : (
                  <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>
                    Belum ada film yang disimpan. Tekan tombol 🔖 Simpan pada player untuk menambahkan.
                  </p>
                )}
              </>
            )}
          </section>
        ) : loading ? (
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
            <MediaGrid items={gridItems} watchedSlugs={watchedSlugs} onSelect={setSelectedItem} />
          </section>
        ) : (
          <>
            {account?.history?.length > 0 && (
              <section className="content-section">
                <div className="section-header">
                  <div className="section-title-wrap">
                    <h2 className="section-title">🕒 Lanjutkan Menonton</h2>
                  </div>
                </div>
                <MediaGrid
                  items={account.history.slice(0, 12)}
                  watchedSlugs={watchedSlugs}
                  onSelect={setSelectedItem}
                />
              </section>
            )}

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
                <MediaGrid items={items.slice(0, 24)} watchedSlugs={watchedSlugs} onSelect={setSelectedItem} />
              </section>
            ))}

            {extraMovies.length > 0 && (
              <section className="content-section">
                <div className="section-header">
                  <h2 className="section-title">🎞️ Eksplorasi Film Lainnya ({extraMovies.length})</h2>
                </div>
                <MediaGrid items={extraMovies} watchedSlugs={watchedSlugs} onSelect={setSelectedItem} />
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
            <span className="mobile-nav-icon">
              <NavIcon id={tab.id} />
            </span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {selectedItem && (
        <PlayerModal
          item={selectedItem}
          isSaved={isSelectedSaved}
          historyEntry={(account?.history || []).find((h) => h.slug === selectedItem.slug) || null}
          onTrackWatch={handleTrackWatch}
          onToggleSave={handleToggleSave}
          onUpdateProgress={account ? handleUpdateProgress : null}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {showAccountModal && (
        <AccountModal
          account={account}
          cloudEnabled={cloudEnabled}
          onAccountChange={setAccount}
          onClose={() => setShowAccountModal(false)}
          onViewHistory={() => handleTabClick('history')}
        />
      )}
    </>
  );
}

function MediaGrid({ items, watchedSlugs, onSelect, onRemove }) {
  if (!items || !items.length) {
    return (
      <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>
        Tidak ada konten ditemukan.
      </p>
    );
  }

  return (
    <div className="media-grid">
      {items.map((item) => {
        const isWatched = watchedSlugs?.has(item.slug);
        const epLabel = item.type === 'series' && item.season && item.episode ? `S${item.season} E${item.episode}` : null;

        return (
          <div
            key={item.slug}
            className="media-card"
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item);
              }
            }}
          >
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
                {epLabel ? (
                  <span className="badge badge-featured">{epLabel}</span>
                ) : isWatched ? (
                  <span className="badge badge-watched">✓ Ditonton</span>
                ) : (
                  <span className="badge badge-quality">{item.quality || 'HD'}</span>
                )}
                {item.rating && <span className="badge badge-rating">⭐ {item.rating}</span>}
              </div>
              {onRemove && (
                <button
                  type="button"
                  className="card-remove-btn"
                  title="Hapus dari riwayat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.slug);
                  }}
                >
                  ✕
                </button>
              )}
              <div className="card-play-overlay">
                <div className="card-play-btn">▶</div>
              </div>
            </div>
            <div className="media-info">
              <h3 className="media-title" title={item.title}>
                {item.title}
              </h3>
              <div className="media-meta">
                <span>
                  {item.progressTime ? `⏱️ ${item.progressTime}` : (item.type === 'series' ? 'Serial TV' : 'Film')}
                </span>
                <span>{item.watchedAt ? formatWatchTimestamp(item.watchedAt) : (item.year || '')}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
