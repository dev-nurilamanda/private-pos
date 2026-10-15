import React, { useState } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  ChevronRight,
  Tag,
  Check,
  Percent,
  X,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Discount } from '../db/db';
import { executeCartTransaction, type CartItem } from '../db/transactionService';
import { formatRupiah } from '../utils/formatters';
import { useBackHandler } from '../context/NavigationContext';

export interface CheckoutBottomSheetProps {
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: string, newQty: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onSuccess: (summary: string) => void;
  onBackToCashier: () => void;
  onNavigateToDiscounts?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function getItemInitials(name: string): string {
  const upper = name.toUpperCase().trim();
  if (upper.includes('PLN') || upper.includes('TOKEN')) return 'PLN';
  if (upper.includes('TELKOMSEL') || upper.includes('TSL')) return 'TSL';
  if (upper.includes('INDOSAT') || upper.includes('ISAT')) return 'ISAT';
  if (upper.includes('AXIS')) return 'AXS';
  if (upper.includes('DANA')) return 'DANA';
  if (upper.includes('PERDANA')) return 'SIM';
  const words = upper.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return upper.slice(0, 3).toUpperCase();
}

export const CheckoutBottomSheet: React.FC<CheckoutBottomSheetProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSuccess,
  onBackToCashier,
  onNavigateToDiscounts,
}) => {
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || [];
  const discounts = useLiveQuery(() => db.discounts.toArray(), []) || [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discount Selection State
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [isSelectingDiscount, setIsSelectingDiscount] = useState(false);

  // Quick Create Discount State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickType, setQuickType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [quickValue, setQuickValue] = useState<number>(10);
  const [quickMinPurchase, setQuickMinPurchase] = useState<number>(0);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Navigasi Bertingkat: Jika modal tambah diskon cepat terbuka, tutup modal dulu (priority 60)
  useBackHandler('checkout-quick-add', () => {
    setIsQuickAddOpen(false);
  }, isQuickAddOpen, 60);

  // Navigasi Bertingkat: Jika sedang di daftar pilih diskon, kembali ke ringkasan keranjang (priority 25)
  useBackHandler('checkout-select-discount', () => {
    setIsSelectingDiscount(false);
  }, isSelectingDiscount, 25);

  const handleQuickAddDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      setQuickError('Nama diskon wajib diisi.');
      return;
    }
    if (quickValue <= 0) {
      setQuickError('Nilai diskon harus lebih dari 0.');
      return;
    }
    if (quickType === 'PERCENT' && quickValue > 100) {
      setQuickError('Persentase maksimal 100%.');
      return;
    }

    try {
      const newId = await db.discounts.add({
        name: quickName.trim(),
        type: quickType,
        value: quickValue,
        minPurchase: quickMinPurchase > 0 ? quickMinPurchase : undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      const added = await db.discounts.get(newId);
      if (added) {
        setSelectedDiscount(added);
      }
      setIsQuickAddOpen(false);
      setQuickName('');
      setQuickValue(10);
      setQuickMinPurchase(0);
      setQuickError(null);
      setIsSelectingDiscount(false);
    } catch (err) {
      console.error(err);
      setQuickError('Gagal menyimpan diskon.');
    }
  };

  // Perhitungan Keuangan Keranjang
  const totalItems = cart.length;
  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalSelling = cart.reduce((acc, item) => acc + item.sellingPrice * item.quantity, 0);

  // Kalkulasi Diskon Terpilih
  let discountAmount = 0;
  if (selectedDiscount) {
    if (selectedDiscount.type === 'PERCENT') {
      discountAmount = Math.round((totalSelling * selectedDiscount.value) / 100);
    } else {
      discountAmount = selectedDiscount.value;
    }
  }
  discountAmount = Math.min(totalSelling, discountAmount);
  const finalTotal = Math.max(0, totalSelling - discountAmount);

  // Eksekusi Transaksi Kasir Langsung
  const handleExecute = async () => {
    if (cart.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }

    const cashWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
    const targetInWalletId = cashWallet?.id || 'cash_main';

    setIsSubmitting(true);
    setError(null);

    try {
      await executeCartTransaction({
        items: cart,
        inWalletId: targetInWalletId,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        cashReceived: finalTotal,
      });

      const summaryText = `Transaksi ${totalQty} item (${formatRupiah(finalTotal)}) berhasil disimpan`;

      onSuccess(summaryText);
      onClearCart();
      onBackToCashier();
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memproses transaksi kasir.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // TAMPILAN 1: HALAMAN PILIH DISKON (Saat baris diskon ditekan)
  if (isSelectingDiscount) {
    const activeDiscounts = discounts.filter((d) => d.isActive);

    return (
      <div className="-mx-4 pb-20">
        {/* Header Pilih Diskon */}
        <div className="px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSelectingDiscount(false)}
              className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-extrabold text-slate-900">Pilih Diskon</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setQuickName('');
                setQuickValue(10);
                setQuickType('PERCENT');
                setQuickMinPurchase(0);
                setQuickError(null);
                setIsQuickAddOpen(true);
              }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah</span>
            </button>
          </div>
        </div>

        {/* Subtotal Info Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>Subtotal Pesanan:</span>
          <span className="font-bold text-slate-900">{formatRupiah(totalSelling)}</span>
        </div>

        {/* List Diskon Tersedia */}
        <div className="bg-white divide-y divide-slate-100 border-b border-slate-200">
          {/* Pilihan: Tanpa Diskon */}
          <div
            onClick={() => {
              setSelectedDiscount(null);
              setIsSelectingDiscount(false);
            }}
            className={`px-4 py-3.5 flex items-center justify-between cursor-pointer transition active:bg-slate-100 ${
              !selectedDiscount ? 'bg-slate-50/80 font-bold' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center">
                <X className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-800">Tanpa Diskon</span>
                <p className="text-xs text-slate-400">Tidak menggunakan potongan harga</p>
              </div>
            </div>
            {!selectedDiscount && (
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}
          </div>

          {/* List Diskon dari Database */}
          {activeDiscounts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm space-y-3 px-4">
              <p>Belum ada diskon aktif.</p>
              <button
                type="button"
                onClick={() => {
                  setQuickName('');
                  setQuickValue(10);
                  setQuickType('PERCENT');
                  setQuickMinPurchase(0);
                  setQuickError(null);
                  setIsQuickAddOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl active:scale-95 transition"
              >
                + Buat Diskon Baru Sekarang
              </button>
            </div>
          ) : (
            activeDiscounts.map((d) => {
              const isSelected = selectedDiscount?.id === d.id;
              const isEligible = !d.minPurchase || totalSelling >= d.minPurchase;
              const calculatedCut =
                d.type === 'PERCENT'
                  ? Math.round((totalSelling * d.value) / 100)
                  : d.value;

              return (
                <div
                  key={d.id}
                  onClick={() => {
                    if (!isEligible) return;
                    setSelectedDiscount(d);
                    setIsSelectingDiscount(false);
                  }}
                  className={`px-4 py-4 flex items-center justify-between transition cursor-pointer ${
                    !isEligible
                      ? 'opacity-40 cursor-not-allowed bg-slate-50/50'
                      : isSelected
                      ? 'bg-slate-50 hover:bg-slate-100'
                      : 'hover:bg-slate-50/80 active:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-2">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm border ${
                        d.type === 'PERCENT'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}
                    >
                      {d.type === 'PERCENT' ? `${d.value}%` : <Tag className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                          {d.name}
                        </h4>
                        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          - {formatRupiah(calculatedCut)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">
                        {d.type === 'PERCENT'
                          ? `Potongan ${d.value}%`
                          : `Potongan ${formatRupiah(d.value)}`}
                        {d.minPurchase && d.minPurchase > 0 && (
                          <span> • Min. Belanja {formatRupiah(d.minPurchase)}</span>
                        )}
                      </p>

                      {!isEligible && d.minPurchase && (
                        <p className="text-[11px] font-semibold text-rose-600">
                          Belum memenuhi minimal belanja {formatRupiah(d.minPurchase)}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Link Navigasi ke Modul Manajemen Diskon */}
        {onNavigateToDiscounts && (
          <div className="p-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSelectingDiscount(false);
                onNavigateToDiscounts();
              }}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
            >
              Buka Modul Manajemen Diskon Lengkap →
            </button>
          </div>
        )}

        {/* Modal Cepat Tambah Diskon (Nominal / %) */}
        {isQuickAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-base text-slate-900">Tambah Diskon Baru</h3>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleQuickAddDiscount} className="p-5 space-y-4">
                {quickError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{quickError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Nama Diskon <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Contoh: Diskon Karyawan / Promo Spesial"
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Tipe Diskon <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickType('PERCENT');
                        if (quickValue > 100) setQuickValue(10);
                      }}
                      className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        quickType === 'PERCENT'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Percent className="w-4 h-4" />
                      <span>Persentase (%)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickType('FIXED')}
                      className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        quickType === 'FIXED'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                      <span>Nominal (Rp)</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {quickType === 'PERCENT' ? 'Besaran Diskon (%)' : 'Besaran Diskon (Rp)'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                      {quickType === 'PERCENT' ? '%' : 'Rp'}
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      max={quickType === 'PERCENT' ? 100 : undefined}
                      value={quickValue || ''}
                      onChange={(e) => setQuickValue(Number(e.target.value) || 0)}
                      placeholder={quickType === 'PERCENT' ? '10' : '5000'}
                      className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 text-sm font-extrabold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Minimal Pembelian (Opsional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={quickMinPurchase || ''}
                      onChange={(e) => setQuickMinPurchase(Number(e.target.value) || 0)}
                      placeholder="0 (Tanpa Minimal)"
                      className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickAddOpen(false)}
                    className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                  >
                    Terapkan Diskon
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // TAMPILAN JIKA KERANJANG KOSONG
  if (cart.length === 0) {
    return (
      <div className="py-20 px-4 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
          <ShoppingCart className="w-8 h-8 stroke-[1.8]" />
        </div>
        <div className="space-y-1">
          <h3 className="font-extrabold text-lg text-slate-900">Keranjang Belanja Kosong</h3>
          <p className="text-sm text-slate-500">
            Belum ada produk yang dipilih. Silakan kembali ke katalog kasir untuk memilih barang.
          </p>
        </div>
        <button
          onClick={onBackToCashier}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Kasir</span>
        </button>
      </div>
    );
  }

  // TAMPILAN UTAMA HALAMAN KERANJANG
  return (
    <div className="-mx-4 pb-28">
      {/* Alert Error */}
      {error && (
        <div className="mx-4 mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-700 animate-in fade-in duration-100">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. DAFTAR ITEM DI DALAM KERANJANG (Nama Lengkap Jelas Tanpa Terpotong & Tanpa Harga Samping Sampah) */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>Item Terpilih ({totalItems})</span>
        </div>

        <div className="divide-y divide-slate-100">
          {cart.map((item) => {
            const isPhys = item.isPhysical;
            const isMaxStock = isPhys ? item.quantity >= item.stock : item.quantity >= 1;
            const initials = getItemInitials(item.productName);

            return (
              <div
                key={item.id}
                className="px-4 py-4 sm:py-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                {/* Kiri: Avatar & Nama Lengkap Produk (Tanpa Terpotong) */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-1.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0 tracking-wider shadow-2xs">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Nama Produk Terbaca Jelas Tanpa Terpotong */}
                    <h4 className="font-bold text-slate-900 text-base leading-snug break-words">
                      {item.productName}
                    </h4>

                    {/* Harga Satuan & Tag Server/Stok */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                      <span className="font-bold text-slate-900 text-sm">
                        {formatRupiah(item.sellingPrice)}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                        {item.serverChannel}
                      </span>
                      {isPhys ? (
                        <span className="text-[11px] text-slate-500 font-medium">
                          • Stok: {item.stock}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Maks 1 Unit
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Kanan: Stepper Qty & Tombol Hapus */}
                <div className="flex items-center gap-2.5 shrink-0 pl-1">
                  <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-white active:bg-slate-200 flex items-center justify-center text-slate-700 shadow-2xs cursor-pointer active:scale-90 transition"
                      title="Kurangi Qty"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    <span className="w-7 text-center font-black text-xs text-slate-900 select-none">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      disabled={isMaxStock}
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-white active:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 shadow-2xs cursor-pointer active:scale-90 transition"
                      title={isMaxStock ? (!isPhys ? 'Produk digital max 1' : 'Batas stok tercapai') : 'Tambah Qty'}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Tombol Hapus */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 active:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Hapus Dari Keranjang"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. RINGKASAN BIAYA (Hanya 2 Baris Proposional: Subtotal & Diskon) */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 space-y-3.5">
        {/* Baris 1: Subtotal di kiri, nilainya di kanan */}
        <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span>Subtotal</span>
          <span className="font-bold text-slate-900">{formatRupiah(totalSelling)}</span>
        </div>

        {/* Baris 2: Diskon di kiri, icon panah di kanan (Klik untuk pilih diskon) */}
        <div
          onClick={() => setIsSelectingDiscount(true)}
          className="flex items-center justify-between text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition active:bg-slate-100"
        >
          <div className="flex items-center gap-2">
            <span>Diskon</span>
            {selectedDiscount && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 truncate max-w-[150px]">
                {selectedDiscount.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {discountAmount > 0 ? (
              <span className="font-bold text-rose-600">
                -{formatRupiah(discountAmount)}
              </span>
            ) : (
              <span className="text-slate-400 font-medium text-xs">Pilih Diskon</span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* 3. FLOATING BOTTOM ACTION BAR: EKSEKUSI PEMBAYARAN */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl">
        <div className="w-full max-w-4xl mx-auto px-4 py-3">
          <button
            type="button"
            disabled={isSubmitting || cart.length === 0}
            onClick={handleExecute}
            className="w-full h-14 bg-slate-900 hover:bg-black active:scale-[0.99] disabled:opacity-40 text-white font-extrabold rounded-2xl shadow-md text-base flex items-center justify-center gap-2.5 transition cursor-pointer"
          >
            {isSubmitting ? (
              <span>Memproses Transaksi...</span>
            ) : (
              <span>Selesaikan Transaksi • {formatRupiah(finalTotal)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
