import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Building2,
  CreditCard,
  Clock,
  Wallet as WalletIcon,
  AlertCircle,
  CheckCircle2,
  Server,
  FileText,
  User,
  ChevronDown,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { type Wallet, type Discount } from '../db/db';
import { executeCartTransaction, type CartItem } from '../db/transactionService';
import { formatRupiah } from '../utils/formatters';
import { useBackHandler } from '../context/NavigationContext';

export interface PaymentScreenProps {
  cart: CartItem[];
  totalSelling: number;
  discountAmount: number;
  selectedDiscount: Discount | null;
  finalTotal: number;
  wallets: Wallet[];
  onBack: () => void;
  onSuccess: (summary: string) => void;
  onClearCart: () => void;
  onBackToCashier: () => void;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS' | 'HUTANG';

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  cart,
  totalSelling,
  discountAmount,
  selectedDiscount,
  finalTotal,
  wallets,
  onBack,
  onSuccess,
  onClearCart,
  onBackToCashier,
}) => {
  // Navigasi Bertingkat: Jika tombol back fisik / browser ditekan di layar pembayaran, kembali ke keranjang
  useBackHandler('checkout-payment-screen', onBack, true, 35);

  // 1. Metode Pembayaran & Dompet Penerima (inWallet)
  const [method, setMethod] = useState<PaymentMethod>('CASH');

  // Cari dompet default berdasarkan kategori
  const defaultCashWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
  const defaultBankWallet = wallets.find((w) => w.category === 'BANK') || wallets[0];
  const defaultQrisWallet = wallets.find((w) => w.category === 'EWALLET') || wallets[0];

  const [selectedInWalletId, setSelectedInWalletId] = useState<string>(
    defaultCashWallet?.id || 'cash_main'
  );
  const [isCustomInWalletOpen, setIsCustomInWalletOpen] = useState(false);

  // 2. State Input Uang Tunai Diterima (Khusus Metode CASH)
  const [cashReceived, setCashReceived] = useState<number>(finalTotal);

  // 3. Info Pembeli & Catatan
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // 4. Submission & Modal Struk Sukses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedSuccessData, setCompletedSuccessData] = useState<{
    inWalletName: string;
    totalPaid: number;
    cashReceived?: number;
    changeAmount?: number;
    method: PaymentMethod;
    deductedModal: { walletName: string; cost: number; remaining: number }[];
  } | null>(null);

  // Navigasi Bertingkat saat modal struk sukses muncul (priority 50)
  useBackHandler(
    'payment-success-modal',
    () => {
      onClearCart();
      onBackToCashier();
    },
    !!completedSuccessData,
    50
  );

  // Switch dompet penerima saat metode diubah (jika belum di-custom)
  const handleSelectMethod = (newMethod: PaymentMethod) => {
    setMethod(newMethod);
    setErrorMessage(null);
    if (newMethod === 'CASH' && defaultCashWallet) {
      setSelectedInWalletId(defaultCashWallet.id);
    } else if (newMethod === 'TRANSFER' && defaultBankWallet) {
      setSelectedInWalletId(defaultBankWallet.id);
    } else if (newMethod === 'QRIS' && defaultQrisWallet) {
      setSelectedInWalletId(defaultQrisWallet.id);
    } else if (newMethod === 'HUTANG' && defaultCashWallet) {
      setSelectedInWalletId(defaultCashWallet.id);
    }
  };

  // Dompet penerima terpilih saat ini
  const activeInWallet = wallets.find((w) => w.id === selectedInWalletId);

  // Perhitungan Kembalian Uang Tunai
  const changeAmount = Math.max(0, cashReceived - finalTotal);
  const isCashInsufficient = method === 'CASH' && cashReceived < finalTotal;

  // Analisis Saldo Modal & Server Eksekutor (outWallet)
  const modalAnalysis = useMemo(() => {
    const totalCostAll = cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
    const estimatedProfit = finalTotal - totalCostAll;

    // Kelompokkan pemotongan modal berdasarkan outWalletId
    const breakdownMap: Record<
      string,
      {
        wallet: Wallet | undefined;
        cost: number;
        items: { name: string; qty: number; cost: number }[];
      }
    > = {};

    cart.forEach((item) => {
      const wId = item.outWalletId || 'cash_main';
      if (!breakdownMap[wId]) {
        breakdownMap[wId] = {
          wallet: wallets.find((w) => w.id === wId),
          cost: 0,
          items: [],
        };
      }
      const itemTotalCost = item.costPrice * item.quantity;
      breakdownMap[wId].cost += itemTotalCost;
      breakdownMap[wId].items.push({
        name: item.productName,
        qty: item.quantity,
        cost: itemTotalCost,
      });
    });

    const breakdown = Object.entries(breakdownMap).map(([walletId, data]) => {
      const currentBalance = data.wallet ? data.wallet.currentBalance : 0;
      const remainingBalance = currentBalance - data.cost;
      const isBalanceLow = currentBalance < data.cost;
      return {
        walletId,
        walletName: data.wallet?.name || `Dompet (${walletId})`,
        category: data.wallet?.category || 'SERVER',
        currentBalance,
        cost: data.cost,
        remainingBalance,
        isBalanceLow,
        items: data.items,
      };
    });

    const hasAnyBalanceWarning = breakdown.some((b) => b.isBalanceLow);

    return {
      totalCostAll,
      estimatedProfit,
      breakdown,
      hasAnyBalanceWarning,
    };
  }, [cart, finalTotal, wallets]);

  // Tombol Cepat Pecahan Uang Tunai
  const quickCashOptions = useMemo(() => {
    const opts = new Set<number>();
    opts.add(finalTotal); // Uang Pas

    // Tambah kelipatan terdekat di atas finalTotal
    const standardDenominations = [
      10000, 20000, 50000, 100000, 150000, 200000, 300000, 500000,
    ];
    standardDenominations.forEach((val) => {
      if (val > finalTotal && opts.size < 4) {
        opts.add(val);
      }
    });

    // Bulatan ke atas 5.000 atau 10.000 terdekat
    const roundTo5k = Math.ceil(finalTotal / 5000) * 5000;
    if (roundTo5k > finalTotal) opts.add(roundTo5k);

    const roundTo10k = Math.ceil(finalTotal / 10000) * 10000;
    if (roundTo10k > finalTotal) opts.add(roundTo10k);

    const roundTo50k = Math.ceil(finalTotal / 50000) * 50000;
    if (roundTo50k > finalTotal) opts.add(roundTo50k);

    return Array.from(opts)
      .sort((a, b) => a - b)
      .slice(0, 5);
  }, [finalTotal]);

  // Eksekusi Konfirmasi Pembayaran
  const handleConfirmPayment = async () => {
    if (cart.length === 0) {
      setErrorMessage('Keranjang belanja kosong.');
      return;
    }

    if (method === 'CASH' && cashReceived < finalTotal) {
      setErrorMessage(
        `Uang tunai yang diterima masih kurang ${formatRupiah(finalTotal - cashReceived)}.`
      );
      return;
    }

    if (method === 'HUTANG' && !customerName.trim()) {
      setErrorMessage(
        'Untuk transaksi kasbon / hutang, Nama Pembeli / Pelanggan wajib diisi.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const inWalletId = selectedInWalletId || 'cash_main';
      const targetCustomer = [customerName.trim(), customerPhone.trim()]
        .filter(Boolean)
        .join(' - ');

      await executeCartTransaction({
        items: cart,
        inWalletId,
        paymentStatus: method === 'HUTANG' ? 'UNPAID' : 'PAID',
        paymentMethod: method,
        customerTarget: targetCustomer || undefined,
        cashReceived: method === 'CASH' ? cashReceived : finalTotal,
        discountId: selectedDiscount?.id,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountName: selectedDiscount?.name,
        finalTotal,
        notes: notes.trim() || undefined,
      });

      // Siapkan data struk ringkas berhasil
      const deductedModalData = modalAnalysis.breakdown.map((b) => ({
        walletName: b.walletName,
        cost: b.cost,
        remaining: b.remainingBalance,
      }));

      setCompletedSuccessData({
        inWalletName: activeInWallet?.name || 'Kasir',
        totalPaid: finalTotal,
        cashReceived: method === 'CASH' ? cashReceived : undefined,
        changeAmount: method === 'CASH' ? changeAmount : undefined,
        method,
        deductedModal: deductedModalData,
      });
    } catch (err: unknown) {
      console.error('Payment processing error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memproses pembayaran transaksi.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // MODAL STRUK RINGKAS TRANSAKSI BERHASIL
  // ==========================================
  if (completedSuccessData) {
    return (
      <div className="-mx-4 min-h-[85vh] bg-slate-50 flex flex-col justify-between pb-10">
        <div className="bg-white px-4 pt-8 pb-6 border-b border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {completedSuccessData.method === 'HUTANG'
                ? 'Piutang Berhasil Dicatat!'
                : 'Pembayaran Sukses!'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transaksi kasir telah tersimpan & saldo dompet terupdate
            </p>
          </div>
          <div className="pt-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Pembayaran
            </span>
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {formatRupiah(completedSuccessData.totalPaid)}
            </span>
          </div>
        </div>

        {/* Rincian Struk */}
        <div className="px-4 py-4 space-y-3.5">
          {/* Rincian Uang & Kembalian (Jika Tunai) */}
          {completedSuccessData.method === 'CASH' && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Uang Tunai Diterima:</span>
                <span className="font-bold text-slate-800">
                  {formatRupiah(completedSuccessData.cashReceived || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                <span>Kembalian Kasir:</span>
                <span className="text-base font-black">
                  {formatRupiah(completedSuccessData.changeAmount || 0)}
                </span>
              </div>
            </div>
          )}

          {/* Rincian Akun Penerima (Modul Dompet Masuk) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <WalletIcon className="w-3.5 h-3.5" />
              <span>Akun Penerima (Modul Dompet)</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {completedSuccessData.inWalletName}
                </span>
                <span className="text-xs text-slate-500">
                  Metode: {completedSuccessData.method}
                </span>
              </div>
              <span className="font-extrabold text-sm text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                +{formatRupiah(completedSuccessData.totalPaid)}
              </span>
            </div>
          </div>

          {/* Rincian Saldo Modal Terpotong */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Server className="w-3.5 h-3.5" />
              <span>Saldo Modal Terpotong</span>
            </div>
            <div className="divide-y divide-slate-100">
              {completedSuccessData.deductedModal.map((dm, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      {dm.walletName}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Sisa saldo: {formatRupiah(dm.remaining)}
                    </span>
                  </div>
                  <span className="font-bold text-rose-600">
                    -{formatRupiah(dm.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tombol Selesai & Kembali ke Kasir */}
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={() => {
              onSuccess(`Transaksi ${formatRupiah(finalTotal)} berhasil diselesaikan.`);
              onClearCart();
              onBackToCashier();
            }}
            className="w-full h-14 bg-slate-900 hover:bg-black active:scale-[0.99] text-white font-extrabold rounded-2xl shadow-md text-base flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Receipt className="w-5 h-5" />
            <span>Kembali ke Kasir</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN FULL LAYAR FITUR PEMBAYARAN
  // ==========================================
  return (
    <div className="-mx-4 pb-32 bg-slate-50/60 min-h-screen">
      {/* 1. Header Full Layar Pembayaran dengan Tombol Kembali */}
      <div className="sticky top-0 z-30 px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Kembali ke Keranjang"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900 leading-tight">
            Pilih Pembayaran
          </h1>
        </div>

        <span className="text-xs text-slate-500 font-medium shrink-0">
          {cart.length} jenis item • {cart.reduce((a, b) => a + b.quantity, 0)} unit
        </span>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-700 animate-in fade-in duration-100">
          <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* 2. Ringkasan Tagihan Ramping (Tanpa Container Box) */}
        <div className="px-0.5 pb-2.5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Pembayaran
            </span>
            <div className="text-right">
              {discountAmount > 0 && (
                <span className="text-xs text-slate-400 line-through mr-2">
                  {formatRupiah(totalSelling)}
                </span>
              )}
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {formatRupiah(finalTotal)}
              </span>
            </div>
          </div>

          {selectedDiscount && (
            <div className="text-right text-[11px] font-bold text-rose-600 -mt-0.5">
              Hemat {formatRupiah(discountAmount)} ({selectedDiscount.name})
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <div>
              <span className="text-slate-400">Total Modal (Cost): </span>
              <strong className="text-slate-700 font-semibold">{formatRupiah(modalAnalysis.totalCostAll)}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Estimasi Laba: </span>
              <strong className="text-emerald-600 font-semibold">
                +{formatRupiah(modalAnalysis.estimatedProfit)}
              </strong>
            </div>
          </div>
        </div>

        {/* 3. METODE PEMBAYARAN & AKUN PENERIMA (TANPA CONTAINER BOX) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <WalletIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>Metode & Akun Penerima</span>
            </label>
          </div>

          {/* Grid 4 Opsi Pembayaran Flat Ramping */}
          <div className="grid grid-cols-2 gap-2">
            {/* Opsi 1: Tunai */}
            <button
              type="button"
              onClick={() => handleSelectMethod('CASH')}
              className={`px-3 py-2.5 rounded-lg text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                method === 'CASH'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Coins
                  className={`w-4 h-4 shrink-0 ${method === 'CASH' ? 'text-amber-300' : 'text-slate-600'}`}
                />
                <span className="font-semibold text-xs sm:text-sm truncate">Tunai</span>
              </div>
              {method === 'CASH' && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
            </button>

            {/* Opsi 2: Transfer Bank */}
            <button
              type="button"
              onClick={() => handleSelectMethod('TRANSFER')}
              className={`px-3 py-2.5 rounded-lg text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                method === 'TRANSFER'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2
                  className={`w-4 h-4 shrink-0 ${method === 'TRANSFER' ? 'text-blue-300' : 'text-slate-600'}`}
                />
                <span className="font-semibold text-xs sm:text-sm truncate">Transfer Bank</span>
              </div>
              {method === 'TRANSFER' && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
            </button>

            {/* Opsi 3: QRIS / E-Wallet */}
            <button
              type="button"
              onClick={() => handleSelectMethod('QRIS')}
              className={`px-3 py-2.5 rounded-lg text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                method === 'QRIS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CreditCard
                  className={`w-4 h-4 shrink-0 ${method === 'QRIS' ? 'text-emerald-300' : 'text-slate-600'}`}
                />
                <span className="font-semibold text-xs sm:text-sm truncate">QRIS</span>
              </div>
              {method === 'QRIS' && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
            </button>

            {/* Opsi 4: Kasbon / Hutang */}
            <button
              type="button"
              onClick={() => handleSelectMethod('HUTANG')}
              className={`px-3 py-2.5 rounded-lg text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                method === 'HUTANG'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Clock
                  className={`w-4 h-4 shrink-0 ${method === 'HUTANG' ? 'text-white' : 'text-amber-600'}`}
                />
                <span className="font-semibold text-xs sm:text-sm truncate">Kasbon</span>
              </div>
              {method === 'HUTANG' && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
            </button>
          </div>

          {/* Pilihan Dompet Penerima (Tanpa Container Box) */}
          <div className="relative pt-0.5">
            <button
              type="button"
              onClick={() => setIsCustomInWalletOpen(!isCustomInWalletOpen)}
              className="w-full flex items-center justify-between py-1.5 px-0.5 hover:bg-slate-100/60 active:bg-slate-100 rounded-lg transition cursor-pointer group text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
                  {activeInWallet?.category === 'BANK' ? (
                    <Building2 className="w-3.5 h-3.5" />
                  ) : activeInWallet?.category === 'EWALLET' ? (
                    <CreditCard className="w-3.5 h-3.5" />
                  ) : (
                    <Coins className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex items-baseline gap-1.5 truncate">
                  <span className="font-bold text-slate-900 text-xs truncate">
                    {activeInWallet?.name || 'Kas Tunai'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    • {formatRupiah(activeInWallet?.currentBalance || 0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 group-hover:text-slate-800 shrink-0 pl-2">
                <span>Ganti</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    isCustomInWalletOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {/* Dropdown Dompet Proporsional */}
            {isCustomInWalletOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-lg space-y-0.5 max-h-48 overflow-y-auto z-30 animate-in fade-in duration-100">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setSelectedInWalletId(w.id);
                      setIsCustomInWalletOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition text-left ${
                      w.id === selectedInWalletId
                        ? 'bg-slate-900 text-white font-bold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{w.name}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                          w.id === selectedInWalletId
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {w.category}
                      </span>
                    </div>
                    <span className="font-semibold shrink-0 pl-2">
                      {formatRupiah(w.currentBalance)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form Pembayaran Tunai (Kalkulator Uang Diterima & Kembalian) */}
          {/* Form Pembayaran Tunai Flat */}
          {method === 'CASH' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Uang Diterima Konsumen
                </label>
                <button
                  type="button"
                  onClick={() => setCashReceived(finalTotal)}
                  className="text-xs font-bold text-slate-600 hover:text-black flex items-center gap-1 active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Uang Pas</span>
                </button>
              </div>

              {/* Input Nominal Diterima Flat */}
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm pointer-events-none">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  value={cashReceived || ''}
                  onChange={(e) => setCashReceived(Number(e.target.value))}
                  placeholder="0"
                  className="w-full h-10 bg-slate-100 rounded-lg pl-10 pr-3 text-base font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              {/* Tombol Pecahan Cepat Flat */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {quickCashOptions.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashReceived(amt)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap active:scale-95 ${
                      cashReceived === amt
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {amt === finalTotal ? 'Uang Pas' : formatRupiah(amt)}
                  </button>
                ))}
              </div>

              {/* Bar Kembalian Flat */}
              <div className="flex items-center justify-between py-2 px-0.5 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">
                  {isCashInsufficient ? 'Uang Masih Kurang:' : 'Kembalian:'}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-base font-bold tracking-tight ${
                      isCashInsufficient ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {isCashInsufficient
                      ? formatRupiah(finalTotal - cashReceived)
                      : formatRupiah(changeAmount)}
                  </span>
                  {!isCashInsufficient && (
                    <span className="text-xs font-bold text-emerald-600">
                      • Lunas
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Khusus Hutang / Kasbon Flat */}
          {method === 'HUTANG' && (
            <div className="py-2 px-0.5 text-xs text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Transaksi Belum Lunas (Piutang)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Uang masuk belum diterima di kasir. Saldo modal tetap dipotong secara otomatis dari dompet modal terkait.
              </p>
            </div>
          )}
        </div>



        {/* 5. DATA PELANGGAN & CATATAN (FLAT TANPA BOX CONTAINER) */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Pelanggan & Catatan{' '}
              {method === 'HUTANG' ? (
                <span className="text-rose-600 font-bold">*Wajib</span>
              ) : (
                <span className="text-slate-400 font-normal">(Opsional)</span>
              )}
            </span>
          </label>

          <div className="space-y-2">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={
                method === 'HUTANG'
                  ? 'Nama Pelanggan / Pengutang (Wajib) *'
                  : 'Nama Pelanggan / ID Target (Opsional)'
              }
              className="w-full h-10 bg-slate-100 rounded-lg px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
            />

            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Nomor HP / WhatsApp (Opsional)"
              className="w-full h-10 bg-slate-100 rounded-lg px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
            />

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan Transaksi Kasir (Opsional)"
              className="w-full h-10 bg-slate-100 rounded-lg px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
            />
          </div>
        </div>
      </div>

      {/* 6. FLOATING ACTION BAR: KONFIRMASI PEMBAYARAN (FLAT) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
        <div className="w-full max-w-4xl mx-auto px-4 py-3">
          <button
            type="button"
            disabled={isSubmitting || (method === 'CASH' && isCashInsufficient)}
            onClick={handleConfirmPayment}
            className={`w-full h-12 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99] disabled:opacity-40 ${
              method === 'HUTANG'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-900 hover:bg-black'
            }`}
          >
            {isSubmitting ? (
              <span>Memproses Pembayaran...</span>
            ) : method === 'HUTANG' ? (
              <span>Simpan Sebagai Piutang • {formatRupiah(finalTotal)}</span>
            ) : (
              <span>Konfirmasi Pembayaran • {formatRupiah(finalTotal)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
