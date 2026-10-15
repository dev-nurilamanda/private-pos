import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Clock,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { executeCartTransaction, type CartItem } from '../db/transactionService';
import { formatRupiah } from '../utils/formatters';

export interface CheckoutBottomSheetProps {
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: string, newQty: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onSuccess: (summary: string) => void;
  onBackToCashier: () => void;
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
}) => {
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || [];
  const [paymentType, setPaymentType] = useState<'CASH' | 'QRIS' | 'TRANSFER' | 'UNPAID'>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [inWalletId, setInWalletId] = useState('');
  const [debtCustomerName, setDebtCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Perhitungan Keuangan Keranjang
  const totalItems = cart.length;
  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCost = cart.reduce((acc, item) => acc + item.costPrice * item.quantity, 0);
  const totalSelling = cart.reduce((acc, item) => acc + item.sellingPrice * item.quantity, 0);
  const totalProfit = totalSelling - totalCost;

  // Inisialisasi wallet penerima uang
  useEffect(() => {
    if (wallets.length > 0 && !inWalletId) {
      const defaultIn = wallets.find((w) => w.category === 'CASH') || wallets[0];
      if (defaultIn) setInWalletId(defaultIn.id);
    }
  }, [wallets, inWalletId]);

  // Set nilai awal uang diterima saat keranjang berubah
  useEffect(() => {
    setCashReceived(totalSelling);
    setError(null);
  }, [totalSelling]);

  // Pilihan pecahan uang cepat
  const quickCashOptions = () => {
    const opts = new Set<number>();
    opts.add(totalSelling); // Uang Pas

    const denominations = [10000, 20000, 50000, 100000];
    for (const d of denominations) {
      if (d > totalSelling) {
        opts.add(d);
      } else {
        const nextRound = Math.ceil(totalSelling / d) * d;
        if (nextRound > totalSelling) opts.add(nextRound);
      }
    }
    return Array.from(opts).sort((a, b) => a - b).slice(0, 5);
  };

  const change = Math.max(0, cashReceived - totalSelling);
  const isUnderpaid = paymentType === 'CASH' && cashReceived < totalSelling;

  // Eksekusi Transaksi Kasir
  const handleExecute = async () => {
    if (cart.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }

    if (paymentType === 'CASH' && isUnderpaid) {
      setError('Nominal uang diterima kurang dari total tagihan.');
      return;
    }

    if (paymentType === 'UNPAID' && !debtCustomerName.trim()) {
      setError('Nama pelanggan yang berhutang wajib diisi.');
      return;
    }

    let targetInWalletId = inWalletId;
    if (paymentType === 'CASH') {
      const cashWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
      targetInWalletId = cashWallet?.id || 'cash_main';
    } else if (paymentType === 'QRIS' || paymentType === 'TRANSFER') {
      if (!targetInWalletId) {
        const digitalWallet = wallets.find((w) => w.category === 'EWALLET' || w.category === 'BANK') || wallets[0];
        targetInWalletId = digitalWallet?.id || 'qris_ewallet';
      }
    } else if (paymentType === 'UNPAID') {
      const cashWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
      targetInWalletId = cashWallet?.id || 'cash_main';
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await executeCartTransaction({
        items: cart,
        inWalletId: targetInWalletId,
        paymentStatus: paymentType === 'UNPAID' ? 'UNPAID' : 'PAID',
        paymentMethod: paymentType === 'UNPAID' ? 'HUTANG' : paymentType,
        customerTarget: paymentType === 'UNPAID' ? debtCustomerName.trim() : undefined,
        cashReceived: paymentType === 'CASH' ? cashReceived : undefined,
        notes: notes.trim() || undefined,
      });

      const summaryText =
        paymentType === 'UNPAID'
          ? `Piutang ${totalQty} item (${debtCustomerName}) berhasil dicatat`
          : `Pembayaran ${totalQty} item (${formatRupiah(totalSelling)}) berhasil`;

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

  // Tampilan jika keranjang kosong
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

  return (
    <div className="-mx-4 pb-36">
      {/* Alert Error */}
      {error && (
        <div className="mx-4 mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-700 animate-in fade-in duration-100">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. DAFTAR ITEM DI DALAM KERANJANG (Langsung Flat List, Tanpa Container Box Pembungkus) */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>Item Terpilih ({totalItems})</span>
          <span>Subtotal</span>
        </div>

        <div className="divide-y divide-slate-100">
          {cart.map((item) => {
            const isPhys = item.isPhysical;
            const isMaxStock = isPhys ? item.quantity >= item.stock : item.quantity >= 1;
            const itemSubtotal = item.sellingPrice * item.quantity;
            const initials = getItemInitials(item.productName);

            return (
              <div
                key={item.id}
                className="px-4 py-4 sm:py-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                {/* Kiri: Avatar & Nama & Info Produk */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0 tracking-wider shadow-2xs">
                    {initials}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h4 className="font-bold text-slate-900 text-base leading-snug truncate">
                      {item.productName}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                      <span className="font-bold text-slate-900">
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

                {/* Tengah & Kanan: Stepper Qty, Subtotal & Tombol Hapus */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

                  {/* Subtotal Item */}
                  <div className="text-right min-w-[70px] sm:min-w-[90px]">
                    <span className="font-black text-slate-900 text-sm sm:text-base">
                      {formatRupiah(itemSubtotal)}
                    </span>
                  </div>

                  {/* Tombol Hapus */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 active:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Hapus Dari Keranjang"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. RINGKASAN BIAYA & LABA KOTOR (Flat Section, Tanpa Container Card) */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>Total Modal Terpotong</span>
          <span className="font-bold text-slate-800">{formatRupiah(totalCost)}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-semibold">Estimasi Laba Bersih</span>
          <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            +{formatRupiah(totalProfit)}
          </span>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
              Total Tagihan
            </span>
            <span className="text-[11px] text-slate-400">Termasuk seluruh item</span>
          </div>
          <span className="font-black text-2xl text-slate-900 tracking-tight">
            {formatRupiah(totalSelling)}
          </span>
        </div>
      </div>

      {/* 3. PILIHAN METODE PEMBAYARAN (Flat Section, Tanpa Container Card) */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 space-y-4">
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          Metode Pembayaran
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Tunai */}
          <button
            type="button"
            onClick={() => {
              setPaymentType('CASH');
              setCashReceived(totalSelling);
            }}
            className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
              paymentType === 'CASH'
                ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Banknote className="w-5 h-5" />
            <span className="font-bold text-xs">Tunai (Cash)</span>
          </button>

          {/* QRIS / Bank */}
          <button
            type="button"
            onClick={() => setPaymentType('QRIS')}
            className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
              paymentType === 'QRIS'
                ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="font-bold text-xs">QRIS / Bank</span>
          </button>

          {/* Piutang (Hutang) */}
          <button
            type="button"
            onClick={() => setPaymentType('UNPAID')}
            className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
              paymentType === 'UNPAID'
                ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="font-bold text-xs">Piutang (Hutang)</span>
          </button>
        </div>

        {/* Form Tunai */}
        {paymentType === 'CASH' && (
          <div className="space-y-3 pt-1 animate-in fade-in duration-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Uang Diterima Konsumen
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">Rp</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cashReceived || ''}
                  onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-12 bg-slate-50 border border-slate-300 rounded-xl pl-12 pr-4 text-base font-extrabold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 shadow-2xs"
                />
              </div>
            </div>

            {/* Quick Money Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickCashOptions().map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCashReceived(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer border ${
                    cashReceived === opt
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt === totalSelling ? 'Uang Pas' : formatRupiah(opt)}
                </button>
              ))}
            </div>

            {/* Status Kembalian / Kurang */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                isUnderpaid
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <span>{isUnderpaid ? 'Pembayaran Masih Kurang:' : 'Kembalian:'}</span>
              <span className="text-sm font-black">
                {isUnderpaid
                  ? formatRupiah(totalSelling - cashReceived)
                  : formatRupiah(change)}
              </span>
            </div>
          </div>
        )}

        {/* Form QRIS / Bank: Pilih Rekening Penerima */}
        {paymentType === 'QRIS' && (
          <div className="space-y-1.5 pt-1 animate-in fade-in duration-100">
            <label className="block text-xs font-bold text-slate-700">
              Rekening / Dompet Penerima
            </label>
            <select
              value={inWalletId}
              onChange={(e) => setInWalletId(e.target.value)}
              className="w-full h-12 bg-slate-50 border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-slate-900 shadow-2xs"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (Saldo: {formatRupiah(w.currentBalance)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Form Piutang (Hutang): Nama Pelanggan */}
        {paymentType === 'UNPAID' && (
          <div className="space-y-2.5 pt-1 animate-in fade-in duration-100">
            <label className="block text-xs font-bold text-slate-700">
              Nama Pelanggan yang Berhutang <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={debtCustomerName}
              onChange={(e) => setDebtCustomerName(e.target.value)}
              placeholder="Ketik nama pelanggan atau nomor telepon..."
              className="w-full h-12 bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 shadow-2xs placeholder:text-slate-400"
            />
            <p className="text-[11px] text-amber-700 bg-amber-50 px-3.5 py-2.5 rounded-xl border border-amber-200 leading-relaxed">
              Pesanan ini akan dicatat sebagai <strong>Belum Bayar (UNPAID)</strong> dan otomatis masuk ke daftar Piutang Kasir.
            </p>
          </div>
        )}

        {/* Catatan Transaksi Opsional */}
        <div className="pt-1">
          <label className="block text-xs font-bold text-slate-600 mb-1.5">
            Catatan Tambahan (Opsional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: Titipan tetangga, nomor referensi..."
            className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-4 text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-slate-900 shadow-2xs"
          />
        </div>
      </div>

      {/* 4. FLOATING BOTTOM ACTION BAR: EKSEKUSI PEMBAYARAN */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl">
        <div className="w-full max-w-4xl mx-auto px-4 py-3">
          <button
            type="button"
            disabled={
              isSubmitting ||
              cart.length === 0 ||
              (paymentType === 'CASH' && isUnderpaid) ||
              (paymentType === 'UNPAID' && !debtCustomerName.trim())
            }
            onClick={handleExecute}
            className="w-full h-14 bg-slate-900 hover:bg-black active:scale-[0.99] disabled:opacity-40 text-white font-extrabold rounded-2xl shadow-md text-base flex items-center justify-center gap-2.5 transition cursor-pointer"
          >
            {isSubmitting ? (
              <span>Memproses Transaksi...</span>
            ) : paymentType === 'UNPAID' ? (
              <span>Catat Sebagai Piutang • {formatRupiah(totalSelling)}</span>
            ) : paymentType === 'CASH' ? (
              isUnderpaid ? (
                <span>Nominal Kurang {formatRupiah(totalSelling - cashReceived)}</span>
              ) : (
                <span>Bayar Tunai • Kembalian {formatRupiah(change)}</span>
              )
            ) : (
              <span>Bayar & Catat Transaksi • {formatRupiah(totalSelling)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
