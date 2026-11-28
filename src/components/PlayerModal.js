'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SUBTITLE_OPTIONS = [
  { code: 'id', label: '🇮🇩 Indonesia (id)' },
  { code: 'en', label: '🇺🇸 English (en)' },
  { code: 'ms', label: '🇲🇾 Melayu (ms)' },
  { code: 'ja', label: '🇯🇵 Jepang (ja)' },
  { code: 'ko', label: '🇰🇷 Korea (ko)' },
  { code: 'zh', label: '🇨🇳 Mandarin (zh)' },
  { code: 'off', label: '🚫 Tanpa Subtitle' },
];

const DUB_OPTIONS = [
  { code: 'original', label: '🎙️ Audio Asli (Original)' },
  { code: 'en', label: '🇺🇸 Dub English (jika tersedia)' },
  { code: 'id', label: '🇮🇩 Dub Indonesia (jika tersedia)' },
  { code: 'ja', label: '🇯🇵 Dub Jepang (jika tersedia)' },
  { code: 'ko', label: '🇰🇷 Dub Korea (jika tersedia)' },
];

export default function PlayerModal({
  item,
  onClose,
  onTrackWatch,
  onToggleSave,
  onUpdateProgress,
  historyEntry = null,
  isSaved = false,
}) {
  const [detail, setDetail] = useState(item);
  const [server, setServer] = useState(1);
  const [season, setSeason] = useState(item?.season || 1);
  const [episode, setEpisode] = useState(item?.episode || 1);
  const [subLang, setSubLang] = useState('id');
  const [dubLang, setDubLang] = useState('original');
  const [reloadKey, setReloadKey] = useState(0);
  const [castInfo, setCastInfo] = useState(null);
  const [progressInput, setProgressInput] = useState(historyEntry?.progressTime || '');
  const [progressSavedToast, setProgressSavedToast] = useState(false);
  const [isMiniPiP, setIsMiniPiP] = useState(false);
  const [pipWindow, setPipWindow] = useState(null);
  const [pipNotice, setPipNotice] = useState(null);
  const pipWindowRef = useRef(null);
  const playerBoxRef = useRef(null);
  const fullscreenBtnRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        try {
          pipWindowRef.current.close();
        } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    setProgressInput(historyEntry?.progressTime || '');
  }, [historyEntry?.progressTime, item?.slug]);

  useEffect(() => {
    try {
      const savedSub = localStorage.getItem('idlix_sub_lang');
      if (savedSub) setSubLang(savedSub);
      const savedServer = parseInt(localStorage.getItem('idlix_preferred_server') || '1', 10);
      if (savedServer >= 1 && savedServer <= 6) setServer(savedServer);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const startSeason = item?.season || 1;
    const startEpisode = item?.episode || 1;
    setDetail(item);
    setSeason(startSeason);
    setEpisode(startEpisode);
    onTrackWatch?.(item, startSeason, startEpisode);
    // Focus fullscreen button for quick 1-click TV remote action
    setTimeout(() => fullscreenBtnRef.current?.focus(), 50);

    if (item?.imdbId?.startsWith('tt')) {
      fetch(`/api/detail?type=${item.type}&id=${item.imdbId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setDetail((prev) => ({ ...prev, ...res.data }));
            if (!item?.season && res.data.seasons?.length) {
              setSeason(res.data.seasons[0].seasonNumber);
              if (res.data.seasons[0].episodes?.length) {
                setEpisode(res.data.seasons[0].episodes[0].episodeNumber);
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [item]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        (e.key === 'Escape' ||
          (e.key === 'Backspace' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName))) &&
        !isMiniPiP
      ) {
        onClose();
      }
    };
    if (!isMiniPiP) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, isMiniPiP]);

  if (!item) return null;

  const isSeries = detail.type === 'series';
  const hasImdb = detail.imdbId && detail.imdbId.startsWith('tt');
  const idParam = hasImdb ? detail.imdbId : (detail.tmdbId || detail.slug);

  const handleServerChange = (sId) => {
    setServer(sId);
    try {
      localStorage.setItem('idlix_preferred_server', String(sId));
    } catch (_) {}
  };

  const handleSubChange = (lang) => {
    setSubLang(lang);
    try {
      localStorage.setItem('idlix_sub_lang', lang);
    } catch (_) {}
  };

  const getEmbedUrl = () => {
    const subQuery = subLang && subLang !== 'off' ? `&ds_lang=${encodeURIComponent(subLang)}` : '';

    if (server === 1) {
      return isSeries
        ? `https://nontongo.win/embed/tv/${idParam}/${season}/${episode}`
        : `https://nontongo.win/embed/movie/${idParam}`;
    }
    if (server === 2) {
      return isSeries
        ? `https://vidfast.vc/tv/${idParam}/${season}/${episode}`
        : `https://vidfast.vc/movie/${idParam}`;
    }
    if (server === 3) {
      return isSeries
        ? `https://vidsrc.sh/embed/tv?${hasImdb ? 'imdb' : 'tmdb'}=${idParam}&season=${season}&episode=${episode}${subQuery}`
        : `https://vidsrc.sh/embed/movie?${hasImdb ? 'imdb' : 'tmdb'}=${idParam}${subQuery}`;
    }
    if (server === 4) {
      return isSeries
        ? `https://multiembed.mov/?video_id=${idParam}&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${idParam}`;
    }
    if (server === 5) {
      return isSeries
        ? `https://www.2embed.cc/embedtv/${idParam}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${idParam}`;
    }
    if (detail.trailer) {
      const base = detail.trailer.includes('embed')
        ? detail.trailer
        : detail.trailer.replace('watch?v=', 'embed/');
      return `${base}?autoplay=1&modestbranding=1`;
    }
    return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(detail.title + ' official trailer')}&autoplay=1`;
  };

  const handleFullscreen = () => {
    const target = playerBoxRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {});
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
    } else if (target.msRequestFullscreen) {
      target.msRequestFullscreen();
    }
  };

  const handleCastToTv = async () => {
    // 1. Try Google Cast SDK (Chromecast / Android TV / Google TV)
    try {
      if (window.cast?.framework?.CastContext && window.chrome?.cast?.media) {
        const castContext = window.cast.framework.CastContext.getInstance();
        castContext.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        await castContext.requestSession();
        setCastInfo('Terhubung ke perangkat Google Cast! Gunakan Cast Tab di browser jika video berada di dalam embed.');
        return;
      }
    } catch (_) {}

    // 2. Try W3C Presentation API (Chromecast / Wireless Display in Chrome & Edge)
    try {
      if (window.PresentationRequest) {
        const req = new PresentationRequest([getEmbedUrl(), window.location.href]);
        await req.start();
        setCastInfo('Berhasil memulai sesi Cast ke layar TV!');
        return;
      }
    } catch (_) {}

    // 3. Fallback: Show clear Cast guide & Smart TV link copy
    setCastInfo(
      'Untuk Cast ke Smart TV / Chromecast dari Chrome atau Edge: klik ikon titik tiga (⋮) di pojok kanan atas browser → pilih "Cast, save, and share" → "Cast..." lalu pilih perangkat TV Anda (pastikan 1 Wi-Fi).'
    );
  };

  const handleToggleDocPiP = async () => {
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch (_) {}
      pipWindowRef.current = null;
      setPipWindow(null);
      return;
    }

    if (typeof window === 'undefined' || !('documentPictureInPicture' in window)) {
      setIsMiniPiP(true);
      setPipNotice('Browser Anda tidak mendukung Document PiP Pop-out. Mode PiP Mini di web telah diaktifkan.');
      setTimeout(() => setPipNotice(null), 5000);
      return;
    }

    try {
      const win = await window.documentPictureInPicture.requestWindow({
        width: 720,
        height: 405,
      });

      const style = win.document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          margin: 0;
          padding: 0;
          background: #07090e;
          color: #f8fafc;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .pip-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }
        .pip-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: #0b0e18;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 11px;
          user-select: none;
          gap: 8px;
        }
        .pip-header-title {
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pip-badge {
          background: #e50914;
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 5px;
          border-radius: 3px;
        }
        .pip-restore-btn {
          background: rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }
        .pip-restore-btn:hover {
          background: #e50914;
          border-color: #e50914;
          color: #fff;
        }
        .pip-body {
          flex: 1;
          position: relative;
          background: #000;
          width: 100%;
          height: 100%;
        }
        .pip-body iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
      `;
      win.document.head.appendChild(style);
      win.document.title = `${detail.title} - IDLIX PiP`;

      win.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
        setPipWindow(null);
      });

      pipWindowRef.current = win;
      setPipWindow(win);
      setIsMiniPiP(false);
    } catch (err) {
      console.error('Gagal membuka Document PiP:', err);
      setIsMiniPiP(true);
      setPipNotice('Tidak dapat membuka jendela PiP. Mengaktifkan Mode PiP Mini di web.');
      setTimeout(() => setPipNotice(null), 5000);
    }
  };

  const activeSeasonObj = detail.seasons?.find((s) => s.seasonNumber === season);

  if (isMiniPiP) {
    return (
      <>
        <div className="modal-pip-floating">
          <div className="modal-pip-header">
            <div className="modal-pip-title" title={detail.title}>
              <span className="pip-live-dot" />
              <span className="pip-title-text">
                {detail.title} {isSeries ? `(S${season}E${episode})` : ''}
              </span>
            </div>
            <div className="modal-pip-actions">
              <button
                type="button"
                className="modal-pip-btn"
                title="Picture-in-Picture Pop-out (OS)"
                onClick={handleToggleDocPiP}
              >
                🖼️
              </button>
              <button
                type="button"
                className="modal-pip-btn"
                title="Perbesar Layar Penuh"
                onClick={() => setIsMiniPiP(false)}
              >
                🗖
              </button>
              <button
                type="button"
                className="modal-pip-btn modal-pip-close"
                title="Tutup Pemutar"
                onClick={onClose}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="modal-pip-player">
            <iframe
              key={`mini-${server}-${season}-${episode}-${subLang}-${reloadKey}`}
              src={getEmbedUrl()}
              allow="autoplay; fullscreen *; picture-in-picture; encrypted-media; accelerometer; gyroscope"
              allowFullScreen
            />
          </div>

          <div className="modal-pip-footer">
            <span className="modal-pip-server-tag">
              ⚡ Server {server} • {subLang !== 'off' ? `Sub ${subLang.toUpperCase()}` : 'No Sub'}
            </span>
            <button
              type="button"
              className="modal-pip-expand-link"
              onClick={() => setIsMiniPiP(false)}
            >
              Perbesar & Episode ↗
            </button>
          </div>
        </div>

        {pipWindow &&
          createPortal(
            <div className="pip-container">
              <div className="pip-header">
                <div className="pip-header-title">
                  <span className="pip-badge">IDLIX PiP</span>
                  <span>
                    {detail.title} {isSeries ? `(S${season}E${episode})` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="pip-restore-btn"
                  onClick={() => pipWindow.close()}
                  title="Kembalikan pemutar ke tab browser"
                >
                  🗖 Kembali ke Web
                </button>
              </div>
              <div className="pip-body">
                <iframe
                  key={`pip-${server}-${season}-${episode}-${subLang}-${reloadKey}`}
                  src={getEmbedUrl()}
                  allow="autoplay; fullscreen *; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                  allowFullScreen
                />
              </div>
            </div>,
            pipWindow.document.body
          )}
      </>
    );
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-container">
        <div className="modal-window-controls">
          <button
            type="button"
            className="modal-ctrl-btn"
            onClick={() => setIsMiniPiP(true)}
            title="Kecilkan ke pojok kanan bawah web agar bisa jelajahi film lain"
          >
            🗕 <span className="ctrl-text">Mode Mini</span>
          </button>
          <button
            type="button"
            className="modal-ctrl-btn"
            onClick={handleToggleDocPiP}
            title="Picture-in-Picture Pop-out (Terapung di luar browser)"
          >
            🖼️ <span className="ctrl-text">PiP Pop-out</span>
          </button>
          <button
            type="button"
            className="modal-ctrl-btn modal-ctrl-close"
            onClick={onClose}
            title="Tutup (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Video Player */}
        <div className="modal-player-wrap">
          <div className="player-servers-bar">
            <div className="server-tabs-group">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: 4 }}>
                SERVER:
              </span>
              {[
                { id: 1, label: '⚡ Server 1 (NontonGo)' },
                { id: 2, label: '🌐 Server 2 (VidFast)' },
                { id: 3, label: '🚀 Server 3 (VidSrc.sh)' },
                { id: 4, label: '✨ Server 4 (MultiEmbed)' },
                { id: 5, label: '🎞️ Server 5 (2Embed)' },
                { id: 6, label: '🎬 Trailer' },
              ].map((s) => (
                <button
                  key={s.id}
                  className={`server-tab-btn ${server === s.id ? 'active' : ''}`}
                  onClick={() => handleServerChange(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="player-status-tag">
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span>Player Aktif</span>
            </div>
          </div>

          {/* Dub & Subtitle Bar */}
          <div className="player-lang-bar">
            <div className="lang-controls-group">
              <label className="lang-control">
                <span>💬 Subtitle:</span>
                <select
                  className="lang-select"
                  value={subLang}
                  onChange={(e) => handleSubChange(e.target.value)}
                >
                  {SUBTITLE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="lang-control">
                <span>🔊 Dub / Audio:</span>
                <select
                  className="lang-select"
                  value={dubLang}
                  onChange={(e) => {
                    setDubLang(e.target.value);
                    setReloadKey((k) => k + 1);
                  }}
                >
                  {DUB_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <span className="lang-hint">
              💡 Klik ikon ⚙️ / 🎧 / CC di dalam player untuk mengganti trek audio/dub & subtitle lain.
            </span>
          </div>

          {pipWindow ? (
            <div className="pip-active-placeholder">
              <div className="pip-placeholder-icon">🖼️</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>
                Sedang Diputar di Jendela Picture-in-Picture (PiP)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 14, maxWidth: 440 }}>
                Video melayang di atas semua aplikasi desktop. Anda dapat menonton sambil bekerja atau membuka aplikasi lain.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => pipWindow.close()}
                  style={{ fontSize: '0.82rem', padding: '7px 16px' }}
                >
                  🗖 Kembalikan Pemutar ke Web
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    pipWindow.close();
                    setIsMiniPiP(true);
                  }}
                  style={{ fontSize: '0.82rem', padding: '7px 16px' }}
                >
                  🗕 Pindah ke Mini PiP Web
                </button>
              </div>
            </div>
          ) : (
            <div ref={playerBoxRef} className="player-aspect">
              <iframe
                key={`${server}-${season}-${episode}-${subLang}-${reloadKey}`}
                src={getEmbedUrl()}
                allow="autoplay; fullscreen *; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                allowFullScreen
              />
            </div>
          )}
        </div>

        {/* Detail Content */}
        <div className="modal-content">
          <div className="modal-header-row">
            {detail.poster && (
              <img className="modal-poster-thumb" src={detail.poster} alt={detail.title} />
            )}
            <div className="modal-info-col">
              <h2 className="modal-title">{detail.title}</h2>
              <div className="modal-meta-row">
                <span className="badge badge-quality">{detail.quality || 'HD'}</span>
                {detail.rating && <span className="badge badge-rating">⭐ {detail.rating}</span>}
                {detail.year && <span>Tahun: {detail.year}</span>}
                {detail.runtime && <span>Durasi: {detail.runtime} mnt</span>}
                <span>Tipe: {isSeries ? 'Serial TV' : 'Film'}</span>
              </div>

              <div className="genre-tags">
                {(detail.genres?.length ? detail.genres : [isSeries ? 'Drama' : 'Cinema']).map((g) => (
                  <span key={g} className="genre-tag">
                    {g}
                  </span>
                ))}
              </div>

              <p className="modal-overview">
                {detail.overview || 'Sinopsis tidak tersedia.'}
              </p>

              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  ref={fullscreenBtnRef}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '8px 18px' }}
                  onClick={handleFullscreen}
                >
                  ⛶ Layar Penuh
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '8px 16px',
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                    color: '#c084fc',
                  }}
                  onClick={handleToggleDocPiP}
                  title="Picture-in-Picture Pop-out (Jendela terapung di luar browser)"
                >
                  🖼️ PiP Pop-out
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '8px 16px',
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    color: '#6ee7b7',
                  }}
                  onClick={() => setIsMiniPiP(true)}
                  title="Kecilkan pemutar ke pojok kanan bawah agar bisa jelajahi web"
                >
                  🗕 Mode Mini (PiP Web)
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '8px 18px', borderColor: 'rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}
                  onClick={handleCastToTv}
                >
                  📺 Cast ke TV
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '8px 18px' }}
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  🔄 Muat Ulang
                </button>
                <button
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '8px 16px',
                    borderColor: isSaved ? 'rgba(229, 9, 20, 0.6)' : undefined,
                    color: isSaved ? '#fda4af' : undefined,
                  }}
                  onClick={() => onToggleSave?.(detail)}
                >
                  {isSaved ? '❤️ Tersimpan' : '🔖 Simpan'}
                </button>
                <a
                  href={getEmbedUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}
                  title="Buka player di tab baru jika verifikasi CAPTCHA butuh cookie langsung"
                >
                  ↗️ Tab Baru
                </a>
              </div>

              {pipNotice && (
                <div className="pip-toast-banner">
                  <span>💡 {pipNotice}</span>
                  <button type="button" onClick={() => setPipNotice(null)}>✕</button>
                </div>
              )}

              {/* Watch Timestamp & Last Minute Marker */}
              {onUpdateProgress && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onUpdateProgress(detail.slug, progressInput);
                    setProgressSavedToast(true);
                    setTimeout(() => setProgressSavedToast(false), 2000);
                  }}
                  style={{
                    marginTop: 14,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {historyEntry?.watchedAt ? (
                      <>
                        🕒 Terakhir ditonton:{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {new Date(historyEntry.watchedAt).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </strong>
                      </>
                    ) : (
                      <span>⏱️ Tandai menit terakhir ditonton:</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="text"
                      className="account-input"
                      style={{ width: 110, padding: '5px 8px', fontSize: '0.78rem' }}
                      placeholder="mis. 42:15"
                      value={progressInput}
                      onChange={(e) => setProgressInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
                      {progressSavedToast ? '✓ Tersimpan' : 'Simpan Menit'}
                    </button>
                  </div>
                </form>
              )}

              {castInfo && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    fontSize: '0.8rem',
                    color: '#e0f2fe',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <div>
                    <strong>📺 Cast ke TV:</strong> {castInfo}
                  </div>
                  <button
                    onClick={() => setCastInfo(null)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Series Episodes */}
          {isSeries && detail.seasons?.length > 0 && (
            <div className="episodes-section">
              <h3 className="episodes-title">Pilih Episode</h3>
              <div className="season-tabs">
                {detail.seasons.map((s) => (
                  <button
                    key={s.seasonNumber}
                    className={`season-tab ${season === s.seasonNumber ? 'active' : ''}`}
                    onClick={() => {
                      const nextEp = s.episodes?.[0]?.episodeNumber || 1;
                      setSeason(s.seasonNumber);
                      setEpisode(nextEp);
                      onTrackWatch?.(detail, s.seasonNumber, nextEp);
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="episodes-grid">
                {(activeSeasonObj?.episodes || []).map((ep) => (
                  <button
                    key={ep.episodeNumber}
                    className={`episode-btn ${episode === ep.episodeNumber ? 'active' : ''}`}
                    title={ep.title}
                    onClick={() => {
                      setEpisode(ep.episodeNumber);
                      onTrackWatch?.(detail, season, ep.episodeNumber);
                    }}
                  >
                    Eps {ep.episodeNumber}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extra Details */}
          <div className="modal-details-grid">
            <div>
              <div className="detail-label">Sutradara</div>
              <div className="detail-val">{detail.director?.name || detail.director || '-'}</div>
            </div>
            <div>
              <div className="detail-label">Pemeran Utama</div>
              <div className="detail-val">
                {detail.cast?.length ? detail.cast.map((c) => c.name || c).slice(0, 4).join(', ') : '-'}
              </div>
            </div>
            <div>
              <div className="detail-label">Negara / Bahasa</div>
              <div className="detail-val">{detail.country || 'International'}</div>
            </div>
          </div>
        </div>
      </div>

      {pipWindow &&
        createPortal(
          <div className="pip-container">
            <div className="pip-header">
              <div className="pip-header-title">
                <span className="pip-badge">IDLIX PiP</span>
                <span>
                  {detail.title} {isSeries ? `(S${season}E${episode})` : ''}
                </span>
              </div>
              <button
                type="button"
                className="pip-restore-btn"
                onClick={() => pipWindow.close()}
                title="Kembalikan pemutar ke tab browser"
              >
                🗖 Kembali ke Web
              </button>
            </div>
            <div className="pip-body">
              <iframe
                key={`pip-${server}-${season}-${episode}-${subLang}-${reloadKey}`}
                src={getEmbedUrl()}
                allow="autoplay; fullscreen *; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                allowFullScreen
              />
            </div>
          </div>,
          pipWindow.document.body
        )}
    </div>
  );
}
