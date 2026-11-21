'use client';

import { useEffect, useState } from 'react';

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

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
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    if (isIos) {
      setShowIosTip((prev) => !prev);
    }
  };

  if (isStandalone || (!deferredPrompt && !isIos)) {
    return null;
  }

  return (
    <>
      <button
        className="install-pwa-btn"
        onClick={handleInstallClick}
        title="Install aplikasi di HP/Desktop"
      >
        <span>📲</span>
        <span className="install-pwa-label">Install</span>
      </button>

      {showIosTip && (
        <div className="ios-install-toast" onClick={() => setShowIosTip(false)}>
          <div>
            <strong>Install di iPhone/iPad:</strong> Ketuk ikon <strong>Share (⬆️)</strong> di Safari lalu pilih{' '}
            <strong>&quot;Add to Home Screen&quot;</strong>.
          </div>
          <span style={{ fontWeight: 700 }}>✕</span>
        </div>
      )}
    </>
  );
}
