import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Coins,
  Building2,
  Smartphone,
  CreditCard,
  Layers,
  Edit3,
  Trash2,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import { db, seedDefaultWallets, type Wallet, type WalletCategory } from '../db/db';
import { formatRupiah } from '../utils/formatters';
import { WalletModal } from './WalletModal';
import { useBackHandler } from '../context/NavigationContext';

const categoryMeta: Record<
  WalletCategory,
  { label: string; bg: string; text: string; icon: React.FC<{ className?: string }> }
> = {
  CASH: { label: 'Tunai', bg: 'bg-slate-100 text-slate-800', text: 'text-slate-800', icon: Coins },
  BANK: { label: 'Bank', bg: 'bg-slate-100 text-slate-800', text: 'text-slate-800', icon: Building2 },
  SERVER: { label: 'Pulsa', bg: 'bg-slate-100 text-slate-800', text: 'text-slate-800', icon: Smartphone },
  EWALLET: { label: 'QRIS', bg: 'bg-slate-100 text-slate-800', text: 'text-slate-800', icon: CreditCard },
  OTHER: { label: 'Lain', bg: 'bg-slate-100 text-slate-800', text: 'text-slate-800', icon: Layers },
};

export const WalletList: React.FC = () => {
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || [];
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

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
  const serverAndBankBalance = wallets
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

  return (
    <div className="-mx-4 pb-20">
      {/* Header Total Modal Kasir & Aksi (Bersih, Tanpa Metric Grid) */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Modal Kasir
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatRupiah(totalBalance)}
          </div>
          <span className="text-xs text-slate-500 font-medium block">
            {wallets.length} kantong aktif
          </span>
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-40"
            title="Pindah Saldo Antar Kantong"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-700" />
            <span>Pindah</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* 2. List Kantong Saldo (FLAT EDGE-TO-EDGE, TANPA BOX CONTAINER) */}
      <div className="bg-white divide-y divide-slate-100 border-b border-slate-200">
        {wallets.length === 0 ? (
          <div className="py-20 px-4 text-center space-y-3">
            <p className="text-xs text-slate-400">Belum ada kantong saldo kasir/modal.</p>
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 active:bg-black text-white rounded-lg text-xs font-bold cursor-pointer transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSeeding ? 'Membuat...' : 'Muat Kantong Bawaan'}
            </button>
          </div>
        ) : (
          wallets.map((wallet) => {
            const meta = categoryMeta[wallet.category] || categoryMeta.OTHER;
            const Icon = meta.icon;

            return (
              <div
                key={wallet.id}
                onClick={() => handleOpenEdit(wallet)}
                className="group flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/70 transition cursor-pointer select-none"
              >
                {/* Kiri: Ikon & Nama */}
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 text-sm truncate block group-hover:text-black transition">
                      {wallet.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Kanan: Nominal Saldo & Aksi */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-slate-900 tracking-tight">
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
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, wallet)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
                <label className="block text-slate-600 mb-1">Dari Kantong Asal:</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-medium"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Ke Kantong Tujuan:</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-medium"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Nominal (Rp):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferAmount || ''}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Biaya Admin (Opsional):</label>
                <input
                  type="number"
                  min="0"
                  value={transferFee || ''}
                  onChange={(e) => setTransferFee(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl shadow-2xs"
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
