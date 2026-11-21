'use client';

import { useEffect, useState } from 'react';

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIos(ios);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowTip(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          return;
        }
      } catch (_) {
        // Fallback to manual tip if browser blocks prompt
      }
    }
    setShowTip((prev) => !prev);
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      <button
        className="install-pwa-btn"
        onClick={handleInstallClick}
        title="Install aplikasi di HP/Desktop"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Install</span>
      </button>

      {showTip && (
        <div className="ios-install-toast" onClick={() => setShowTip(false)}>
          <div>
            {isIos ? (
              <>
                <strong>Install di iPhone/iPad:</strong> Ketuk ikon <strong>Share (⬆️)</strong> di Safari lalu pilih{' '}
                <strong>&quot;Add to Home Screen&quot;</strong>.
              </>
            ) : (
              <>
                <strong>Install Aplikasi (PWA):</strong> Jika pop-up otomatis tidak muncul di Brave/Chrome, ketuk ikon{' '}
                <strong>⋮</strong> di pojok kanan browser lalu pilih <strong>&quot;Add to Home screen&quot; / &quot;Install app&quot;</strong>.
              </>
            )}
          </div>
          <span style={{ fontWeight: 700, flexShrink: 0 }}>✕</span>
        </div>
      )}
    </>
  );
}
