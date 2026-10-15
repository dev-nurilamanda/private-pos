import React, { useState } from 'react';
import { Smartphone, Download, X, HelpCircle, Share2, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already installed as standalone PWA or user dismissed this session
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome) setIsDismissed(true);
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Sleek Top Banner */}
      <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between gap-2.5 text-xs shadow-xs border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="truncate font-medium text-slate-200 text-[11px]">
            Pasang Kasir di layar utama HP
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 active:scale-95 text-slate-900 rounded-md font-bold text-[11px] shadow-2xs transition cursor-pointer flex items-center gap-1"
          >
            <Download className="w-3 h-3 text-slate-900" />
            <span>Install</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded-md transition cursor-pointer"
            title="Tutup banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Manual Install Instruction Modal for Android Chrome & iOS */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  KM
                </div>
                <h4 className="font-bold text-sm text-slate-900">
                  {isIOS ? 'Pasang di iPhone / iPad' : 'Pasang di HP Android'}
                </h4>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-xs text-slate-700">
                <p className="leading-relaxed">
                  1. Buka situs ini di browser <strong className="text-slate-900">Safari</strong>.
                </p>
                <p className="leading-relaxed flex items-center gap-1">
                  2. Tekan tombol <strong className="text-slate-900">Bagikan (Share)</strong> <Share2 className="w-3.5 h-3.5 text-blue-600 inline" /> di bilah bawah.
                </p>
                <p className="leading-relaxed">
                  3. Gulir ke bawah dan pilih <strong className="text-slate-900">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-700">
                <p className="leading-relaxed flex items-center gap-1">
                  1. Ketuk ikon <strong className="text-slate-900">titik tiga</strong> <MoreVertical className="w-3.5 h-3.5 inline text-slate-900" /> di pojok kanan atas browser Chrome.
                </p>
                <p className="leading-relaxed">
                  2. Pilih menu <strong className="text-slate-900">"Install aplikasi"</strong> (atau <strong className="text-slate-900">"Tambahkan ke Layar Utama"</strong>).
                </p>
                <p className="leading-relaxed">
                  3. Tekan <strong className="text-slate-900">"Install"</strong> pada pop-up konfirmasi.
                </p>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                  💡 Setelah dipasang, aplikasi Private POS dapat dibuka langsung dari layar depan HP tanpa perlu membuka browser lagi dan 100% offline.
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs active:scale-95 transition"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
