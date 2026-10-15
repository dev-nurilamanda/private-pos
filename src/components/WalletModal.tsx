import React, { useState, useEffect } from 'react';
import { X, Wallet as WalletIcon, Coins, AlertCircle } from 'lucide-react';
import { db, type Wallet, type WalletCategory } from '../db/db';
import { formatRupiah } from '../utils/formatters';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletToEdit?: Wallet | null;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  walletToEdit,
}) => {
  const isEditing = Boolean(walletToEdit);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<WalletCategory>('CASH');
  const [balance, setBalance] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [adjustMode, setAdjustMode] = useState<'set' | 'add' | 'deduct'>('set');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [customId, setCustomId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (walletToEdit) {
      setName(walletToEdit.name);
      setCategory(walletToEdit.category);
      setBalance(walletToEdit.currentBalance);
      setNotes(walletToEdit.notes || '');
      setAdjustMode('set');
      setAdjustAmount(0);
      setCustomId(walletToEdit.id);
    } else {
      setName('');
      setCategory('CASH');
      setBalance(0);
      setNotes('');
      setAdjustMode('set');
      setAdjustAmount(0);
      setCustomId(`wallet_${Date.now()}`);
    }
    setError(null);
  }, [walletToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama kantong saldo wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && walletToEdit) {
        await db.transaction('rw', db.wallets, async () => {
          const current = await db.wallets.get(walletToEdit.id);
          if (!current) throw new Error('Kantong saldo tidak ditemukan di database.');

          let finalBalance = current.currentBalance;
          if (adjustMode === 'set') {
            finalBalance = balance;
          } else if (adjustMode === 'add') {
            finalBalance = current.currentBalance + adjustAmount;
          } else if (adjustMode === 'deduct') {
            finalBalance = current.currentBalance - adjustAmount;
          }

          await db.wallets.update(walletToEdit.id, {
            name: name.trim(),
            category,
            currentBalance: finalBalance,
            notes: notes.trim() || undefined,
            updatedAt: new Date().toISOString(),
          });
        });
      } else {
        const targetId = customId.trim() || `wallet_${Date.now()}`;
        await db.transaction('rw', db.wallets, async () => {
          const existing = await db.wallets.get(targetId);
          if (existing) {
            throw new Error(`ID '${targetId}' sudah digunakan.`);
          }

          const newWallet: Wallet = {
            id: targetId,
            name: name.trim(),
            category,
            currentBalance: Number(balance) || 0,
            notes: notes.trim() || undefined,
            updatedAt: new Date().toISOString(),
          };

          await db.wallets.add(newWallet);
        });
      }

      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan data.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <WalletIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isEditing ? 'Atur Saldo Kantong' : 'Tambah Kantong Modal / Kas'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? walletToEdit?.name : 'Wadah modal atau penampungan kasir'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs text-slate-800">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Nama Kantong Saldo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Kas Laci Kasir, Bank BCA, Pulsa Portal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium text-xs focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WalletCategory)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium text-xs cursor-pointer focus:border-indigo-600"
              >
                <option value="CASH">Kas Tunai</option>
                <option value="BANK">Rekening Bank</option>
                <option value="SERVER">Server Pulsa/Modal</option>
                <option value="EWALLET">E-Wallet / QRIS</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>

            {!isEditing && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">ID Kode (Unik)</label>
                <input
                  type="text"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. kas_utama"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs focus:border-indigo-600"
                />
              </div>
            )}
          </div>

          {/* Saldo adjustment */}
          {isEditing ? (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Saldo Saat Ini:</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatRupiah(walletToEdit?.currentBalance || 0)}
                </span>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdjustMode('set')}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    adjustMode === 'set'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  Set Langsung
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('add')}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    adjustMode === 'add'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  + Tambah Saldo
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('deduct')}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    adjustMode === 'deduct'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  - Kurang
                </button>
              </div>

              {adjustMode === 'set' ? (
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">Rp</span>
                    <input
                      type="number"
                      value={balance || ''}
                      onChange={(e) => setBalance(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-slate-900 font-bold text-sm focus:border-indigo-600"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={adjustAmount || ''}
                      onChange={(e) => setAdjustAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-slate-900 font-bold text-sm focus:border-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Saldo baru menjadi:{' '}
                    <strong className="text-slate-900">
                      {formatRupiah(
                        adjustMode === 'add'
                          ? (walletToEdit?.currentBalance || 0) + adjustAmount
                          : (walletToEdit?.currentBalance || 0) - adjustAmount
                      )}
                    </strong>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Saldo Awal</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold">Rp</span>
                <input
                  type="number"
                  min="0"
                  value={balance || ''}
                  onChange={(e) => setBalance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-bold text-sm focus:border-indigo-600"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
