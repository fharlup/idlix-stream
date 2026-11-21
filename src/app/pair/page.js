'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function PairContent() {
  const searchParams = useSearchParams();
  const code = (searchParams.get('code') || '').trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | approving | done | error
  const [errorMsg, setErrorMsg] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.account) {
          setAccount(res.account);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async () => {
    if (!code) {
      setStatus('error');
      setErrorMsg('Kode QR tidak ditemukan di URL.');
      return;
    }
    setStatus('approving');
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', code }),
      });
      const data = await res.json();
      if (!data.success) {
        setStatus('error');
        setErrorMsg(data.message || 'Gagal menyetujui login TV.');
        return;
      }
      setStatus('done');
    } catch {
      setStatus('error');
      setErrorMsg('Gagal menghubungi server.');
    }
  };

  const handleLoginAndApprove = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.message || 'Gagal login.');
        setAuthLoading(false);
        return;
      }
      setAccount(data.account);
      setAuthLoading(false);
    } catch {
      setErrorMsg('Gagal menghubungi server.');
      setAuthLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'var(--bg-main)',
      }}
    >
      <div className="account-modal-box" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div className="logo-badge">IDLIX</div>
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Login ke TV via QR</span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Memeriksa sesi akun HP Anda...</p>
        ) : status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>🎉</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>
              Berhasil Terhubung!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
              TV Anda sekarang otomatis login sebagai <strong>{account?.displayName || account?.username}</strong>.
            </p>
            <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none', width: '100%' }}>
              Kembali ke Beranda
            </Link>
          </div>
        ) : !code ? (
          <div className="account-alert error">Kode QR tidak valid atau kosong.</div>
        ) : account ? (
          <div>
            <div className="account-profile-header">
              <div className="account-avatar-lg" style={{ background: account.avatarColor || '#e50914' }}>
                {(account.displayName || account.username).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Masuk di HP sebagai</div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                  {account.displayName || account.username}
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  Kode Perangkat TV: {code}
                </div>
              </div>
            </div>

            {errorMsg && <div className="account-alert error">{errorMsg}</div>}

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 18px', fontSize: '0.95rem' }}
              onClick={handleApprove}
              disabled={status === 'approving'}
            >
              {status === 'approving' ? 'Menghubungkan ke TV...' : '✅ Izinkan Login ke TV'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleLoginAndApprove} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              HP Anda belum masuk ke akun mana pun. Login dulu di sini untuk menyetujui perangkat TV (Kode:{' '}
              <strong>{code}</strong>).
            </p>
            {errorMsg && <div className="account-alert error">{errorMsg}</div>}
            <div>
              <label className="account-label">Username</label>
              <input
                type="text"
                className="account-input"
                placeholder="Username Anda"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="account-label">Password / PIN</label>
              <input
                type="password"
                className="account-input"
                placeholder="Password / PIN"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={authLoading}>
              {authLoading ? 'Memproses...' : '🚀 Masuk & Lanjutkan'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PairPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Memuat...</div>}>
      <PairContent />
    </Suspense>
  );
}
