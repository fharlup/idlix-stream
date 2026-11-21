'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  clearWatchHistory,
  exportAccountSyncCode,
  getAccountsMap,
  importAccountSyncCode,
  loginAccount,
  logoutAccount,
  registerAccount,
} from '@/lib/accountStore';

export default function AccountModal({
  account,
  cloudEnabled,
  onAccountChange,
  onClose,
  onViewHistory,
}) {
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [syncInput, setSyncInput] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingProfiles, setExistingProfiles] = useState([]);

  // QR Login state (for TV)
  const [qrCode, setQrCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrStatus, setQrStatus] = useState('idle'); // idle | loading | pending | expired

  const createQrSession = useCallback(async () => {
    if (!cloudEnabled) return;
    setQrStatus('loading');
    setQrDataUrl('');
    try {
      const res = await fetch('/api/auth/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      }).then((r) => r.json());

      if (res.success && res.code) {
        const pairUrl = `${window.location.origin}/pair?code=${res.code}`;
        const dataUrl = await QRCode.toDataURL(pairUrl, { width: 220, margin: 2 });
        setQrCode(res.code);
        setQrDataUrl(dataUrl);
        setQrStatus('pending');
      } else {
        setQrStatus('expired');
      }
    } catch {
      setQrStatus('expired');
    }
  }, [cloudEnabled]);

  useEffect(() => {
    if (tab === 'qr' && cloudEnabled && !account) {
      createQrSession();
    }
  }, [tab, cloudEnabled, account, createQrSession]);

  useEffect(() => {
    if (tab !== 'qr' || qrStatus !== 'pending' || !qrCode || account) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr?code=${encodeURIComponent(qrCode)}`).then((r) => r.json());
        if (res.status === 'approved' && res.account) {
          clearInterval(interval);
          onAccountChange(res.account);
          onClose();
        } else if (res.status === 'expired') {
          clearInterval(interval);
          setQrStatus('expired');
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [tab, qrStatus, qrCode, account, onAccountChange, onClose]);

  useEffect(() => {
    if (!cloudEnabled) {
      setExistingProfiles(Object.values(getAccountsMap()));
    }
  }, [account, cloudEnabled]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (cloudEnabled) {
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: tab === 'register' ? 'register' : 'login',
            username,
            password: pin,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setMessage({ type: 'error', text: data.message || 'Gagal autentikasi.' });
          return;
        }
        onAccountChange(data.account);
        onClose();
      } catch {
        setMessage({ type: 'error', text: 'Gagal terhubung ke server.' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const res = tab === 'register' ? registerAccount(username, pin) : loginAccount(username, pin);
    if (!res.ok) {
      setMessage({ type: 'error', text: res.error });
      return;
    }
    onAccountChange(res.account);
    onClose();
  };

  const handleLogout = async () => {
    if (cloudEnabled) {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      }).catch(() => {});
    } else {
      logoutAccount();
    }
    onAccountChange(null);
  };

  const handleClearHistory = async () => {
    if (cloudEnabled) {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      }).then((r) => r.json());
      if (res.success) onAccountChange(res.account);
    } else {
      const updated = clearWatchHistory();
      if (updated) onAccountChange({ ...updated });
    }
    setMessage({ type: 'info', text: 'Riwayat tontonan dibersihkan.' });
  };

  const handleQuickSwitch = (profile) => {
    if (!profile.pinHash) {
      const res = loginAccount(profile.username, '');
      if (res.ok) {
        onAccountChange(res.account);
        onClose();
        return;
      }
    }
    setTab('login');
    setUsername(profile.username);
    setPin('');
    setMessage({ type: 'info', text: `Masukkan PIN untuk ${profile.displayName || profile.username}.` });
  };

  const handleCopySync = async () => {
    const code = exportAccountSyncCode();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMessage({ type: 'success', text: 'Kode Sync disalin! Tempel di perangkat lain.' });
    } catch {
      setSyncInput(code);
      setMessage({ type: 'info', text: 'Salin kode secara manual.' });
    }
  };

  const handleImportSync = (e) => {
    e.preventDefault();
    if (!syncInput.trim()) return;
    const res = importAccountSyncCode(syncInput);
    if (!res.ok) {
      setMessage({ type: 'error', text: res.error });
      return;
    }
    onAccountChange(res.account);
    setSyncInput('');
    setMessage({ type: 'success', text: `Berhasil impor akun "${res.account.displayName || res.account.username}"!` });
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="account-modal-box">
        <button className="modal-close-btn" onClick={onClose} title="Tutup">
          ✕
        </button>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 9999,
            marginBottom: 14,
            background: cloudEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: cloudEnabled ? '#6ee7b7' : '#fcd34d',
            border: `1px solid ${cloudEnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
          }}
        >
          <span>{cloudEnabled ? '☁️ Cloud DB Aktif (Sync Antar Perangkat)' : '💾 Mode Lokal (Belum Ada Cloud DB)'}</span>
        </div>

        {account ? (
          <div>
            <div className="account-profile-header">
              <div className="account-avatar-lg" style={{ background: account.avatarColor || '#e50914' }}>
                {(account.displayName || account.username).charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {account.displayName || account.username}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  @{account.username} • {(account.history || []).length} ditonton • {(account.watchlist || []).length} disimpan
                </p>
              </div>
            </div>

            {message && <div className={`account-alert ${message.type}`}>{message.text}</div>}

            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '9px 16px', flex: 1 }}
                onClick={() => {
                  onClose();
                  onViewHistory();
                }}
              >
                🕒 Lihat Riwayat & Simpanan
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '9px 16px' }}
                onClick={handleLogout}
              >
                Keluar
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: cloudEnabled ? 0 : 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '7px 12px', color: '#fca5a5' }}
                onClick={handleClearHistory}
              >
                🗑️ Hapus Semua Riwayat
              </button>
            </div>

            {!cloudEnabled && (
              <div className="account-sync-card">
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 6 }}>
                  🔄 Pindahkan Riwayat ke Perangkat Lain
                </h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '7px 12px' }}
                    onClick={handleCopySync}
                  >
                    📋 Salin Kode Sync
                  </button>
                </div>
                <form onSubmit={handleImportSync} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="account-input"
                    placeholder="Tempel Kode Sync..."
                    value={syncInput}
                    onChange={(e) => setSyncInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '8px 14px' }}>
                    Impor
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>👤 Akun & Riwayat Tontonan</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {cloudEnabled
                ? 'Masuk atau daftar akun — riwayat tontonan Anda otomatis tersinkronisasi di HP, Laptop, dan TV!'
                : 'Masuk atau buat akun untuk melacak film & episode serial yang sudah Anda tonton.'}
            </p>

            {!cloudEnabled && existingProfiles.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                  PILIH PROFIL DI PERANGKAT INI:
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {existingProfiles.map((p) => (
                    <button
                      key={p.username}
                      type="button"
                      className="profile-chip"
                      onClick={() => handleQuickSwitch(p)}
                    >
                      <span className="profile-chip-dot" style={{ background: p.avatarColor || '#e50914' }}>
                        {(p.displayName || p.username).charAt(0).toUpperCase()}
                      </span>
                      <span>{p.displayName || p.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="account-tabs">
              <button
                type="button"
                className={`account-tab ${tab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setTab('login');
                  setMessage(null);
                }}
              >
                Masuk
              </button>
              <button
                type="button"
                className={`account-tab ${tab === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setTab('register');
                  setMessage(null);
                }}
              >
                Daftar Baru
              </button>
              {cloudEnabled ? (
                <button
                  type="button"
                  className={`account-tab ${tab === 'qr' ? 'active' : ''}`}
                  onClick={() => {
                    setTab('qr');
                    setMessage(null);
                  }}
                >
                  📺 Login QR
                </button>
              ) : (
                <button
                  type="button"
                  className={`account-tab ${tab === 'sync' ? 'active' : ''}`}
                  onClick={() => {
                    setTab('sync');
                    setMessage(null);
                  }}
                >
                  Impor Sync
                </button>
              )}
            </div>

            {message && <div className={`account-alert ${message.type}`}>{message.text}</div>}

            {tab === 'qr' && cloudEnabled ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                {qrStatus === 'loading' ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', padding: 30 }}>
                    Membuat kode QR...
                  </p>
                ) : qrStatus === 'expired' ? (
                  <div style={{ padding: 20 }}>
                    <p style={{ color: '#fca5a5', fontSize: '0.88rem', marginBottom: 12 }}>
                      Kode QR sudah kedaluwarsa.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={createQrSession}>
                      🔄 Buat QR Baru
                    </button>
                  </div>
                ) : (
                  <>
                    {qrDataUrl && (
                      <div
                        style={{
                          display: 'inline-block',
                          padding: 10,
                          background: '#fff',
                          borderRadius: 12,
                          marginBottom: 12,
                        }}
                      >
                        <img src={qrDataUrl} alt="QR Login TV" width={200} height={200} style={{ display: 'block' }} />
                      </div>
                    )}
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                      Scan QR ini dengan kamera HP yang sudah login!
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      Kode TV: <strong style={{ color: 'var(--accent-cyan)' }}>{qrCode}</strong> • Menunggu persetujuan dari HP...
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                      onClick={createQrSession}
                    >
                      🔄 Ganti QR
                    </button>
                  </>
                )}
              </div>
            ) : tab === 'sync' && !cloudEnabled ? (
              <form onSubmit={handleImportSync} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  className="account-input"
                  placeholder="Tempel Kode Sync dari perangkat lain..."
                  value={syncInput}
                  onChange={(e) => setSyncInput(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  📥 Impor & Masuk
                </button>
              </form>
            ) : (
              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="account-label">Username</label>
                  <input
                    type="text"
                    className="account-input"
                    placeholder="Contoh: fajar"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="account-label">Password / PIN {cloudEnabled ? '' : '(Opsional)'}</label>
                  <input
                    type="password"
                    className="account-input"
                    placeholder="Masukkan password atau PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    required={cloudEnabled}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={submitting}>
                  {submitting
                    ? 'Memproses...'
                    : tab === 'register'
                      ? '✨ Buat Akun & Mulai Tracking'
                      : '🚀 Masuk'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
