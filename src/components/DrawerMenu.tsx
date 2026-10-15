import React, { useState } from 'react';
import {
  X,
  ShoppingCart,
  Wallet,
  Clock,
  Package,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Share,
  Tag,
} from 'lucide-react';
import { db, seedDefaultWallets, seedDefaultProducts, seedDefaultDiscounts } from '../db/db';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: 'cashier' | 'checkout' | 'wallets' | 'debts' | 'products' | 'discounts';
  onSelectView: (view: 'cashier' | 'checkout' | 'wallets' | 'debts' | 'products' | 'discounts') => void;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
      onClose();
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const handleExportBackup = async () => {
    try {
      const wallets = await db.wallets.toArray();
      const products = await db.products.toArray();
      const customers = await db.customers.toArray();
      const transactions = await db.transactions.toArray();
      const walletTransfers = await db.walletTransfers.toArray();
      const discounts = await db.discounts.toArray();

      const backupData = {
        app: 'Private POS PWA',
        exportedAt: new Date().toISOString(),
        data: {
          wallets,
          products,
          customers,
          transactions,
          walletTransfers,
          discounts,
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_private_pos_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor backup data.');
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          if (!parsed.data) throw new Error('Format file backup tidak valid.');

          if (
            !confirm(
              'Pulihkan data dari backup? Seluruh data kasir saat ini akan ditimpa dengan data backup.'
            )
          ) {
            return;
          }

          await db.transaction(
            'rw',
            [db.wallets, db.products, db.customers, db.transactions, db.walletTransfers, db.discounts],
            async () => {
              if (parsed.data.wallets) {
                await db.wallets.clear();
                await db.wallets.bulkAdd(parsed.data.wallets);
              }
              if (parsed.data.products) {
                await db.products.clear();
                await db.products.bulkAdd(parsed.data.products);
              }
              if (parsed.data.customers) {
                await db.customers.clear();
                await db.customers.bulkAdd(parsed.data.customers);
              }
              if (parsed.data.transactions) {
                await db.transactions.clear();
                await db.transactions.bulkAdd(parsed.data.transactions);
              }
              if (parsed.data.walletTransfers) {
                await db.walletTransfers.clear();
                await db.walletTransfers.bulkAdd(parsed.data.walletTransfers);
              }
              if (parsed.data.discounts) {
                await db.discounts.clear();
                await db.discounts.bulkAdd(parsed.data.discounts);
              }
            }
          );

          alert('Data berhasil dipulihkan dari backup!');
          onClose();
        } catch (err: unknown) {
          console.error(err);
          alert(err instanceof Error ? err.message : 'Gagal membaca file backup.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleResetData = async () => {
    if (!confirm('Yakin ingin mereset seluruh data kembali ke setelan bawaan?')) {
      return;
    }
    await db.transaction('rw', [db.wallets, db.products, db.transactions, db.walletTransfers, db.discounts], async () => {
      await db.wallets.clear();
      await db.products.clear();
      await db.transactions.clear();
      await db.walletTransfers.clear();
      await db.discounts.clear();
    });
    await seedDefaultWallets();
    await seedDefaultProducts();
    await seedDefaultDiscounts();
    alert('Database berhasil direset dengan data default bawaan!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content: Lebar 80-85% Layar HP (w-[84vw] max-w-sm) */}
      <div className="relative w-[84vw] max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Drawer Header (Lega & Nyaman) */}
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white text-sm shadow-2xs">
              POS
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight text-slate-900">Private POS</h3>
              <p className="text-xs text-slate-500 font-medium">100% Offline-First POS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 active:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Baris py-4 yang Santai & Luas) */}
        <div className="p-4 space-y-1.5 flex-1 overflow-y-auto text-sm font-semibold">
          {/* PWA Install Button if not already standalone */}
          {!isInstalled && (isInstallable || isIOS) && (
            <div className="mb-3 p-3.5 bg-slate-100 border border-slate-300 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold">
                <Smartphone className="w-4 h-4 text-slate-900" />
                <span>Pasang Aplikasi di HP</span>
              </div>
              <p className="text-xs text-slate-600 font-normal leading-relaxed">
                Akses cepat dari layar utama HP tanpa buka browser & kuota.
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Install Private POS</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              onSelectView('cashier');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition cursor-pointer active:scale-98 ${
              activeView === 'cashier'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-800 hover:bg-slate-100 active:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">Kasir Utama</span>
          </button>

          <button
            onClick={() => {
              onSelectView('products');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition cursor-pointer active:scale-98 ${
              activeView === 'products'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-800 hover:bg-slate-100 active:bg-slate-100'
            }`}
          >
            <Package className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">Manajemen Produk</span>
          </button>

          <button
            onClick={() => {
              onSelectView('wallets');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition cursor-pointer active:scale-98 ${
              activeView === 'wallets'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-800 hover:bg-slate-100 active:bg-slate-100'
            }`}
          >
            <Wallet className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">Dompet & Saldo Modal</span>
          </button>

          <button
            onClick={() => {
              onSelectView('debts');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition cursor-pointer active:scale-98 ${
              activeView === 'debts'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-800 hover:bg-slate-100 active:bg-slate-100'
            }`}
          >
            <Clock className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">Riwayat & Piutang</span>
          </button>

          <button
            onClick={() => {
              onSelectView('discounts');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition cursor-pointer active:scale-98 ${
              activeView === 'discounts'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-800 hover:bg-slate-100 active:bg-slate-100'
            }`}
          >
            <Tag className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">Diskon & Promo</span>
          </button>

          <div className="pt-4 pb-1 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4">
              Backup & Penyimpanan
            </span>
          </div>

          <button
            onClick={handleExportBackup}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-slate-800 hover:bg-slate-100 active:bg-slate-100 transition cursor-pointer"
          >
            <Download className="w-5 h-5 text-slate-600 shrink-0" />
            <span className="text-sm font-medium">Ekspor Backup JSON</span>
          </button>

          <button
            onClick={handleImportBackup}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-slate-800 hover:bg-slate-100 active:bg-slate-100 transition cursor-pointer"
          >
            <Upload className="w-5 h-5 text-slate-600 shrink-0" />
            <span className="text-sm font-medium">Impor Pulihkan Backup</span>
          </button>

          <button
            onClick={handleResetData}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-rose-600 hover:bg-rose-50 active:bg-rose-50 transition cursor-pointer"
          >
            <RefreshCw className="w-5 h-5 text-rose-500 shrink-0" />
            <span className="text-sm font-medium">Reset ke Setelan Awal</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Dexie IndexedDB • 100% Offline-First</span>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">Pasang di iPhone / iPad</h4>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              1. Buka di browser Safari.<br />
              2. Tekan tombol <strong className="text-slate-900">Bagikan (Share)</strong> <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" /> di bar bawah.<br />
              3. Gulir ke bawah dan pilih <strong className="text-slate-900">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
