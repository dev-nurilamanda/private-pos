import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertCircle, Layers, Wallet as WalletIcon, Box } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatRupiah } from '../utils/formatters';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_CATEGORIES = [
  'Pulsa Reguler',
  'Paket Data',
  'Token Listrik',
  'Kartu Perdana',
  'Voucher Fisik',
  'Aksesoris',
  'E-Wallet',
  'Tagihan / PPOB',
];

export const CreateProductModal: React.FC<CreateProductModalProps> = ({
  isOpen,
  onClose,
}) => {
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || [];
  const existingProducts = useLiveQuery(() => db.products.toArray(), []) || [];

  // Dompet kas tunai untuk barang fisik
  const cashWallet = useMemo(() => {
    return (
      wallets.find((w) => w.category === 'CASH') ||
      wallets.find((w) => w.id.toLowerCase().includes('cash')) ||
      wallets[0]
    );
  }, [wallets]);

  // Dompet server eksekutor untuk produk digital (hanya dari tabel wallets, non-tunai)
  const serverWallets = useMemo(() => {
    const servers = wallets.filter((w) => w.category === 'SERVER');
    if (servers.length > 0) return servers;
    const nonCash = wallets.filter((w) => w.category !== 'CASH');
    if (nonCash.length > 0) return nonCash;
    return wallets;
  }, [wallets]);

  // Daftar kategori dinamis: default + semua kategori yang pernah tersimpan di database
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    existingProducts.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [existingProducts]);

  // Form States
  const [name, setName] = useState('');
  const [isPhysical, setIsPhysical] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [category, setCategory] = useState('Pulsa Reguler');
  const [customCategory, setCustomCategory] = useState('');
  const [stock, setStock] = useState<number>(10);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selected wallet ID default
  useEffect(() => {
    if (serverWallets.length > 0 && !selectedWalletId) {
      setSelectedWalletId(serverWallets[0].id);
    }
  }, [serverWallets, selectedWalletId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setIsPhysical(false);
      setCategory('Pulsa Reguler');
      setCustomCategory('');
      setStock(10);
      setCostPrice(0);
      setSellingPrice(0);
      setError(null);
      if (serverWallets.length > 0) {
        setSelectedWalletId(serverWallets[0].id);
      }
    }
  }, [isOpen, serverWallets]);

  // Dompet server yang sedang dipilih
  const currentServerWallet = useMemo(() => {
    return (
      wallets.find((w) => w.id === selectedWalletId) ||
      serverWallets[0]
    );
  }, [wallets, selectedWalletId, serverWallets]);

  if (!isOpen) return null;

  const profitRp = sellingPrice - costPrice;
  const marginPercent =
    costPrice > 0 ? ((profitRp / costPrice) * 100).toFixed(1) : '100.0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }
    if (costPrice < 0 || sellingPrice < 0) {
      setError('Harga tidak boleh bernilai negatif.');
      return;
    }

    const finalCategory =
      category === 'CUSTOM' ? customCategory.trim() : category;

    if (!finalCategory) {
      setError('Pilih atau ketik kategori produk.');
      return;
    }

    // Penentuan Server Channel & Dompet Modal Terpotong
    let finalServerChannel = 'Toko Fisik';
    let finalDefaultWalletId = cashWallet?.id || 'cash_main';
    let finalStock = 0;

    if (isPhysical) {
      // Barang fisik: tidak butuh server digital, potong uang kas tunai
      finalServerChannel = 'Toko Fisik';
      finalDefaultWalletId = cashWallet?.id || 'cash_main';
      finalStock = Math.max(0, Number(stock) || 0);
    } else {
      // Produk digital: wajib terhubung ke server/wallet eksekutor
      if (!currentServerWallet) {
        setError('Pilih dompet / server eksekutor transaksi.');
        return;
      }
      finalServerChannel = currentServerWallet.name.replace(/^Saldo\s+/i, '').trim() || currentServerWallet.name;
      finalDefaultWalletId = currentServerWallet.id;
      finalStock = 0;
    }

    setIsSubmitting(true);
    try {
      await db.products.add({
        name: name.trim(),
        serverChannel: finalServerChannel,
        category: finalCategory,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        stock: finalStock,
        isPhysical,
        trackStock: isPhysical,
        defaultWalletId: finalDefaultWalletId,
      });

      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal menyimpan produk.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Buat Produk Baru</h3>
              <p className="text-xs text-slate-500">Tentukan jenis, harga, dan sumber modal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-800 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Nama Produk */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 text-xs">
              Nama Produk <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Telkomsel Data 10GB atau Token PLN 50rb"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-semibold text-sm focus:border-slate-900 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* 2. Switch: Barang Fisik (Memiliki Stok) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-slate-600" />
                  Barang Fisik (Memiliki Stok)
                </span>
                <span className="text-[11px] text-slate-500">
                  {isPhysical
                    ? 'Barang fisik konter (stok dihitung, modal potong Kas Tunai)'
                    : 'Produk digital/server (pulsa, data, token tanpa stok fisik)'}
                </span>
              </div>

              {/* Native Toggle Switch */}
              <button
                type="button"
                onClick={() => setIsPhysical(!isPhysical)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  isPhysical ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                    isPhysical ? 'left-6.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Jika Barang Fisik Aktif: Munculkan Input Stok Fisik & Kunci Modal ke Kas Tunai */}
            {isPhysical ? (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Jumlah Stok Fisik (Unit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold text-xs focus:border-slate-900 focus:outline-none"
                    placeholder="Contoh: 10"
                  />
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px]">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <WalletIcon className="w-3.5 h-3.5 text-slate-500" />
                    Sumber Modal (Terkunci):
                  </span>
                  <span className="font-bold text-slate-900">
                    {cashWallet?.name || 'Kas Tunai'} ({formatRupiah(cashWallet?.currentBalance || 0)})
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* 3. Server / Aplikasi Eksekutor (HANYA MUNCUL JIKA PRODUK DIGITAL) */}
          {!isPhysical && (
            <div>
              <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                Server / Aplikasi Eksekutor <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-semibold text-xs cursor-pointer focus:border-slate-900 focus:outline-none"
              >
                {serverWallets.map((w) => {
                  const cleanName = w.name.replace(/^Saldo\s+/i, '').trim() || w.name;
                  return (
                    <option key={w.id} value={w.id}>
                      {cleanName} — Saldo: {formatRupiah(w.currentBalance)}
                    </option>
                  );
                })}
              </select>

              {/* Redundansi Dihilangkan: Sumber Modal Langsung Terkunci Otomatis */}
              <div className="mt-2 flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <WalletIcon className="w-3.5 h-3.5 text-slate-500" />
                  Sumber Modal Terkunci:
                </span>
                <span className="font-bold text-slate-900">
                  {currentServerWallet?.name} ({formatRupiah(currentServerWallet?.currentBalance || 0)})
                </span>
              </div>

              <p className="mt-1.5 text-[11px] text-slate-400">
                Server terhubung langsung ke kantong saldo modal. Ingin menambah server baru? Buat di menu <strong>Dompet Modal</strong>.
              </p>
            </div>
          )}

          {/* 4. Jenis Kategori Produk (Dinamis + Opsi Tambah Kategori Baru) */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 text-xs">
              Jenis Kategori Produk <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-semibold text-xs cursor-pointer focus:border-slate-900 focus:outline-none"
            >
              {categoryOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="CUSTOM">+ Ketik Kategori Baru...</option>
            </select>

            {category === 'CUSTOM' && (
              <input
                type="text"
                required
                autoFocus
                placeholder="Ketik nama kategori baru (contoh: Voucher Wifi, Roaming)..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full mt-2 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-semibold text-xs focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            )}
          </div>

          {/* 5. Harga Modal & Jual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                Harga Modal (Beli)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">Rp</span>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-bold text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                Harga Jual (Kasir)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">Rp</span>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={sellingPrice || ''}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-bold text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 6. Live Margin Calculation */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-800 font-semibold block">
                Estimasi Laba Bersih
              </span>
              <span className="text-sm font-black text-emerald-900">
                +{formatRupiah(profitRp)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-emerald-800 font-semibold block">Margin</span>
              <span className="text-xs font-bold text-emerald-900">
                {costPrice > 0 ? `+${marginPercent}%` : '100%'}
              </span>
            </div>
          </div>

          {/* Footer Tombol Aksi */}
          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
