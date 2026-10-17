import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Edit3,
  Trash2,
  Sparkles,
  ArrowRightLeft,
  Building2,
  CreditCard,
  Coins,
  Server,
  Layers,
} from 'lucide-react';
import { db, seedDefaultWallets, type Wallet, type WalletCategory } from '../db/db';
import { formatRupiah } from '../utils/formatters';
import { WalletModal } from './WalletModal';
import { useBackHandler } from '../context/NavigationContext';

// Helper deteksi badge brand fintech Indonesia yang 100% aman (CSS & Teks murni)
export function getWalletFintechBadge(wallet: Wallet) {
  const name = wallet.name.toUpperCase();

  // 1. BANK
  if (name.includes('BCA')) {
    return {
      brand: 'BCA',
      badge: 'BCA',
      bg: 'bg-[#003893]',
      text: 'text-white',
      border: 'border-[#003893]',
      label: 'Bank BCA',
      type: 'BANK',
      icon: Building2,
    };
  }
  if (name.includes('BRI')) {
    return {
      brand: 'BRI',
      badge: 'BRI',
      bg: 'bg-[#00529C]',
      text: 'text-white',
      border: 'border-[#00529C]',
      label: 'Bank BRI',
      type: 'BANK',
      icon: Building2,
    };
  }
  if (name.includes('MANDIRI')) {
    return {
      brand: 'MANDIRI',
      badge: 'MANDIRI',
      bg: 'bg-[#003366]',
      text: 'text-[#F5A623]',
      border: 'border-[#003366]',
      label: 'Bank Mandiri',
      type: 'BANK',
      icon: Building2,
    };
  }
  if (name.includes('BNI')) {
    return {
      brand: 'BNI',
      badge: 'BNI',
      bg: 'bg-[#005E6A]',
      text: 'text-[#F15A24]',
      border: 'border-[#005E6A]',
      label: 'Bank BNI',
      type: 'BANK',
      icon: Building2,
    };
  }
  if (name.includes('BSI')) {
    return {
      brand: 'BSI',
      badge: 'BSI',
      bg: 'bg-[#00A29E]',
      text: 'text-white',
      border: 'border-[#00A29E]',
      label: 'Bank BSI',
      type: 'BANK',
      icon: Building2,
    };
  }
  if (name.includes('JAGO')) {
    return {
      brand: 'JAGO',
      badge: 'JAGO',
      bg: 'bg-[#FF5C00]',
      text: 'text-white',
      border: 'border-[#FF5C00]',
      label: 'Bank Jago',
      type: 'BANK',
      icon: Building2,
    };
  }
  if (name.includes('SEABANK') || name.includes('SEA BANK')) {
    return {
      brand: 'SEABANK',
      badge: 'SEA',
      bg: 'bg-[#FF5722]',
      text: 'text-white',
      border: 'border-[#FF5722]',
      label: 'SeaBank',
      type: 'BANK',
      icon: Building2,
    };
  }

  // 2. E-WALLET & QRIS
  if (name.includes('QRIS')) {
    return {
      brand: 'QRIS',
      badge: 'QRIS',
      bg: 'bg-[#EA1D2C]',
      text: 'text-white',
      border: 'border-[#EA1D2C]',
      label: 'QRIS Standar',
      type: 'EWALLET',
      icon: CreditCard,
    };
  }
  if (name.includes('DANA')) {
    return {
      brand: 'DANA',
      badge: 'DANA',
      bg: 'bg-[#118EEA]',
      text: 'text-white',
      border: 'border-[#118EEA]',
      label: 'DANA E-Wallet',
      type: 'EWALLET',
      icon: CreditCard,
    };
  }
  if (name.includes('GOPAY') || name.includes('GO-PAY')) {
    return {
      brand: 'GOPAY',
      badge: 'GOPAY',
      bg: 'bg-[#00AED6]',
      text: 'text-white',
      border: 'border-[#00AED6]',
      label: 'GoPay',
      type: 'EWALLET',
      icon: CreditCard,
    };
  }
  if (name.includes('OVO')) {
    return {
      brand: 'OVO',
      badge: 'OVO',
      bg: 'bg-[#4C3494]',
      text: 'text-white',
      border: 'border-[#4C3494]',
      label: 'OVO E-Wallet',
      type: 'EWALLET',
      icon: CreditCard,
    };
  }
  if (name.includes('SHOPEEPAY') || name.includes('SHOPEE')) {
    return {
      brand: 'SHOPEEPAY',
      badge: 'SHOPEE',
      bg: 'bg-[#EE4D2D]',
      text: 'text-white',
      border: 'border-[#EE4D2D]',
      label: 'ShopeePay',
      type: 'EWALLET',
      icon: CreditCard,
    };
  }

  // 3. SERVER & PPOB
  if (name.includes('DIGIPOS') || name.includes('TELKOMSEL')) {
    return {
      brand: 'DIGIPOS',
      badge: 'T-SEL',
      bg: 'bg-[#ED0226]',
      text: 'text-white',
      border: 'border-[#ED0226]',
      label: 'Server DigiPOS',
      type: 'SERVER',
      icon: Server,
    };
  }
  if (name.includes('PLN') || name.includes('LISTRIK')) {
    return {
      brand: 'PLN',
      badge: 'PLN',
      bg: 'bg-[#007799]',
      text: 'text-[#FFE600]',
      border: 'border-[#007799]',
      label: 'Server PLN Listrik',
      type: 'SERVER',
      icon: Server,
    };
  }

  // 4. FALLBACK BY CATEGORY
  if (wallet.category === 'BANK') {
    return {
      brand: 'BANK',
      badge: 'BANK',
      bg: 'bg-blue-600',
      text: 'text-white',
      border: 'border-blue-600',
      label: 'Rekening Bank',
      type: 'BANK',
      icon: Building2,
    };
  }
  if (wallet.category === 'EWALLET') {
    return {
      brand: 'QRIS',
      badge: 'QRIS',
      bg: 'bg-emerald-600',
      text: 'text-white',
      border: 'border-emerald-600',
      label: 'E-Wallet / QRIS',
      type: 'EWALLET',
      icon: CreditCard,
    };
  }
  if (wallet.category === 'SERVER') {
    return {
      brand: 'SERVER',
      badge: 'SRV',
      bg: 'bg-indigo-600',
      text: 'text-white',
      border: 'border-indigo-600',
      label: 'Server Modal',
      type: 'SERVER',
      icon: Server,
    };
  }
  if (wallet.category === 'CASH') {
    return {
      brand: 'TUNAI',
      badge: 'KAS',
      bg: 'bg-amber-500',
      text: 'text-white',
      border: 'border-amber-500',
      label: 'Kas Fisik Laci',
      type: 'CASH',
      icon: Coins,
    };
  }

  return {
    brand: 'LAIN',
    badge: 'DOM',
    bg: 'bg-slate-700',
    text: 'text-white',
    border: 'border-slate-700',
    label: 'Kantong Saldo',
    type: 'OTHER',
    icon: Layers,
  };
}

export const WalletList: React.FC = () => {
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || [];
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CASH' | 'BANK' | 'EWALLET' | 'SERVER'>('ALL');

  // Transfer modal state
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferFee, setTransferFee] = useState<number>(0);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Navigasi Bertingkat: Tutup modal transfer saldo jika terbuka
  useBackHandler('wallet-transfer-modal', () => {
    setIsTransferOpen(false);
  }, isTransferOpen, 45);

  // Navigasi Bertingkat: Tutup modal tambah/edit dompet jika terbuka
  useBackHandler('wallet-manage-modal', () => {
    setIsModalOpen(false);
    setSelectedWallet(null);
  }, isModalOpen, 40);

  const totalBalance = wallets.reduce((acc, w) => acc + (w.currentBalance || 0), 0);
  const cashBalance = wallets
    .filter((w) => w.category === 'CASH')
    .reduce((acc, w) => acc + (w.currentBalance || 0), 0);
  const nonCashBalance = wallets
    .filter((w) => w.category !== 'CASH')
    .reduce((acc, w) => acc + (w.currentBalance || 0), 0);

  const handleOpenAdd = () => {
    setSelectedWallet(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setIsModalOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, wallet: Wallet) => {
    e.stopPropagation();
    if (!window.confirm(`Hapus kantong saldo "${wallet.name}"?`)) return;
    await db.transaction('rw', db.wallets, async () => {
      await db.wallets.delete(wallet.id);
    });
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDefaultWallets();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    if (!transferFrom || !transferTo) {
      setTransferError('Pilih kantong asal dan tujuan.');
      return;
    }
    if (transferFrom === transferTo) {
      setTransferError('Kantong asal & tujuan tidak boleh sama.');
      return;
    }
    if (transferAmount <= 0) {
      setTransferError('Nominal harus lebih dari 0.');
      return;
    }

    try {
      await db.transaction('rw', [db.wallets, db.walletTransfers], async () => {
        const source = await db.wallets.get(transferFrom);
        const destination = await db.wallets.get(transferTo);

        if (!source || !destination) throw new Error('Data dompet tidak ditemukan.');

        const deduction = transferAmount + (Number(transferFee) || 0);

        await db.wallets.update(transferFrom, {
          currentBalance: source.currentBalance - deduction,
          updatedAt: new Date().toISOString(),
        });

        await db.wallets.update(transferTo, {
          currentBalance: destination.currentBalance + transferAmount,
          updatedAt: new Date().toISOString(),
        });

        await db.walletTransfers.add({
          date: new Date().toISOString(),
          fromWalletId: transferFrom,
          toWalletId: transferTo,
          amount: transferAmount,
          fee: Number(transferFee) || 0,
          notes: transferNotes.trim() || undefined,
        });
      });

      setIsTransferOpen(false);
      setTransferAmount(0);
      setTransferFee(0);
      setTransferNotes('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setTransferError(err.message);
      } else {
        setTransferError('Gagal memproses transfer.');
      }
    }
  };

  const filteredWallets = wallets.filter((w) => {
    if (categoryFilter === 'ALL') return true;
    return w.category === categoryFilter;
  });

  return (
    <div className="-mx-4 pb-28 space-y-3 bg-slate-50 min-h-screen">
      {/* 1. Header Toolbar Fintech (Flat Edge-to-Edge) */}
      <div className="bg-white border-b border-slate-200/90 px-4 py-4.5 space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Modal Kasir & Toko
            </span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatRupiah(totalBalance)}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Kas Tunai: {formatRupiah(cashBalance)}</span>
              <span aria-hidden="true">·</span>
              <span>Bank/Server: {formatRupiah(nonCashBalance)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                if (wallets.length > 0) {
                  setTransferFrom(wallets[0].id);
                  setTransferTo(wallets[1]?.id || wallets[0].id);
                }
                setIsTransferOpen(true);
              }}
              disabled={wallets.length < 2}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-40"
              title="Pindah Saldo Antar Kantong"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-700" />
              <span>Pindah</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-extrabold transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filter Kategori Tab Fintech (Flat Edge-to-Edge) */}
      <div className="bg-white border-y border-slate-200/90 px-4 py-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {(
            [
              { id: 'ALL', label: 'Semua Kantong' },
              { id: 'CASH', label: 'Kas Tunai' },
              { id: 'BANK', label: 'Bank' },
              { id: 'EWALLET', label: 'QRIS & E-Wallet' },
              { id: 'SERVER', label: 'Server Modal' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                categoryFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Daftar Dompet dengan Fintech Brand Badges (Flat Edge-to-Edge) */}
      <div className="bg-white border-y border-slate-200/90 divide-y divide-slate-100">
        {filteredWallets.length === 0 ? (
          <div className="py-20 px-4 text-center space-y-3">
            <p className="text-xs text-slate-400">Belum ada kantong saldo pada kategori ini.</p>
            {wallets.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={isSeeding}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 active:bg-black text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isSeeding ? 'Membuat...' : 'Muat Kantong Bawaan'}
              </button>
            )}
          </div>
        ) : (
          filteredWallets.map((wallet) => {
            const badge = getWalletFintechBadge(wallet);

            return (
              <div
                key={wallet.id}
                onClick={() => handleOpenEdit(wallet)}
                className="group flex items-center justify-between px-4 py-4.5 sm:py-5 hover:bg-slate-50 transition cursor-pointer select-none"
              >
                {/* Kiri: Badge Brand Fintech & Nama */}
                <div className="flex items-center gap-3.5 min-w-0 pr-3">
                  {/* Badge Typographic Monogram yang 100% Aman & Estetik */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 tracking-wider shadow-2xs ${badge.bg} ${badge.text}`}
                  >
                    {badge.badge}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <span className="font-bold text-slate-900 text-sm truncate block group-hover:text-black transition">
                      {wallet.name}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                      <span>{badge.label}</span>
                      {wallet.notes && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[140px] text-slate-500">{wallet.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Kanan: Nominal Saldo & Tombol Aksi */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                    {formatRupiah(wallet.currentBalance)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(wallet);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg transition"
                    title="Atur Saldo"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, wallet)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Wallet Edit/Create Modal */}
      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        walletToEdit={selectedWallet}
      />

      {/* Internal Transfer Modal */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <ArrowRightLeft className="w-4 h-4 text-slate-800" />
                <span>Pindah Saldo Antar Kantong</span>
              </div>
              <button
                onClick={() => setIsTransferOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-4 space-y-3 text-xs">
              {transferError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-[11px]">
                  {transferError}
                </div>
              )}

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Dari Kantong Asal:</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Ke Kantong Tujuan:</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Nominal Pindah (Rp):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferAmount || ''}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Biaya Admin (Opsional):</label>
                <input
                  type="number"
                  min="0"
                  value={transferFee || ''}
                  onChange={(e) => setTransferFee(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl shadow-xs"
                >
                  Eksekusi Pindah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
